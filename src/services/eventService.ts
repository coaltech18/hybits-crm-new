import { supabase } from '@/lib/supabase';
import type {
  Event,
  EventFilters,
  CreateEventInput,
  UpdateEventInput,
  Invoice,
  UserRole,
} from '@/types';
import { getClientById } from './clientService';
import { getAllocationSummary } from './allocationService';

// ================================================================
// EVENT SERVICE
// ================================================================
// All CRUD operations for events with role-based access control
// Lifecycle: planned -> completed | planned -> cancelled
// ================================================================

async function getUserRole(userId: string): Promise<UserRole> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!profile) {
    throw new Error('User profile not found');
  }

  return profile.role as UserRole;
}

/** Only admins and managers may change events. */
async function requireEventWriter(userId: string, action: string): Promise<UserRole> {
  const role = await getUserRole(userId);
  if (role === 'admin' || role === 'manager') {
    return role;
  }
  throw new Error(`You do not have permission to ${action} events`);
}

function isValidGuestCount(value: number | null | undefined): boolean {
  return value == null || (Number.isInteger(value) && value > 0);
}

/**
 * Get all events with filters (role-based)
 * - Admin/Accountant: See all events
 * - Manager: See only assigned outlet events
 */
export async function getEvents(
  userId: string,
  filters: EventFilters = {}
): Promise<Event[]> {
  const role = await getUserRole(userId);

  let query = supabase
    .from('events')
    .select(`
      *,
      clients (
        id,
        name,
        client_type,
        phone,
        outlets (id, name, code)
      ),
      outlets (
        id,
        name,
        code,
        city
      )
    `)
    .order('event_date', { ascending: false });

  // Role-based outlet filtering
  if (role === 'manager') {
    // Managers only see their assigned outlet events
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    if (assignments && assignments.length > 0) {
      const outletIds = assignments.map(a => a.outlet_id);
      query = query.in('outlet_id', outletIds);
    } else {
      // Manager has no outlets assigned, return empty array
      return [];
    }
  }

  // Optional outlet filter (for managers this intersects with their assignments)
  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Status filter
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  // Client filter
  if (filters.client_id) {
    query = query.eq('client_id', filters.client_id);
  }

  // Date range filters
  if (filters.date_from) {
    query = query.gte('event_date', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('event_date', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get event by ID. Returns null when the event does not exist or RLS hides it.
 */
export async function getEventById(eventId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      clients (
        id,
        name,
        client_type,
        phone,
        email,
        outlets (id, name, code)
      ),
      outlets (
        id,
        name,
        code,
        city,
        state
      )
    `)
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Invoices linked to an event (newest first).
 */
export async function getEventInvoices(
  eventId: string
): Promise<Pick<Invoice, 'id' | 'invoice_number' | 'status' | 'grand_total' | 'issued_at' | 'created_at'>[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, grand_total, issued_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Create new event
 *
 * LOCKED RULES ENFORCED:
 * - Client must be event type
 * - Client outlet must match event outlet
 * - Managers can only create for assigned outlets
 */
export async function createEvent(
  userId: string,
  input: CreateEventInput
): Promise<Event> {
  const role = await requireEventWriter(userId, 'create');

  // Validate required fields
  if (!input.outlet_id) {
    throw new Error('Outlet is required');
  }

  if (!input.client_id) {
    throw new Error('Client is required');
  }

  if (!input.event_name || input.event_name.trim() === '') {
    throw new Error('Event name is required');
  }

  if (!input.event_date) {
    throw new Error('Event date is required');
  }

  if (!isValidGuestCount(input.guest_count)) {
    throw new Error('Guest count must be a whole number greater than 0');
  }

  // Validate client exists and is event type
  const client = await getClientById(input.client_id);
  if (!client) {
    throw new Error('Client not found');
  }

  if (client.client_type !== 'event') {
    throw new Error('Only event clients can have events. This client is a corporate client.');
  }

  // Validate outlet matching
  if (client.outlet_id !== input.outlet_id) {
    throw new Error('Client does not belong to the selected outlet');
  }

  // If manager, verify outlet is in their assigned outlets
  if (role === 'manager') {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];

    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create events for your assigned outlets');
    }
  }

  // Insert event (created_by will be set automatically by trigger)
  const { data, error } = await supabase
    .from('events')
    .insert({
      outlet_id: input.outlet_id,
      client_id: input.client_id,
      event_name: input.event_name.trim(),
      event_type: input.event_type?.trim() || null,
      event_date: input.event_date,
      guest_count: input.guest_count ?? null,
      notes: input.notes?.trim() || null,
      status: 'planned',
    })
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Event could not be created. You may no longer have access to this outlet.');
  }

  return data;
}

/**
 * Update a planned event
 *
 * LOCKED RULES:
 * - Only planned events can be edited
 * - Managers cannot change outlet_id or client_id (enforced by trigger)
 * - Accountants cannot update
 * - Status changes go through completeEvent / cancelEvent
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  updates: UpdateEventInput
): Promise<Event> {
  const role = await requireEventWriter(userId, 'update');

  // Managers cannot change outlet_id or client_id
  if (role === 'manager') {
    if (updates.outlet_id !== undefined) {
      throw new Error('Only admins can change outlet assignment');
    }
    if (updates.client_id !== undefined) {
      throw new Error('Only admins can change client assignment');
    }
  }

  if (updates.event_name !== undefined && updates.event_name.trim() === '') {
    throw new Error('Event name is required');
  }

  // Validate guest count if provided (null clears it)
  if (!isValidGuestCount(updates.guest_count)) {
    throw new Error('Guest count must be a whole number greater than 0');
  }

  // Build update object (trim strings)
  const updateData: Partial<Pick<Event,
    'event_name' | 'event_type' | 'event_date' | 'guest_count' | 'notes' | 'outlet_id' | 'client_id'
  >> = {};
  if (updates.event_name !== undefined) updateData.event_name = updates.event_name.trim();
  if (updates.event_type !== undefined) updateData.event_type = updates.event_type?.trim() || null;
  if (updates.event_date !== undefined) updateData.event_date = updates.event_date;
  if (updates.guest_count !== undefined) updateData.guest_count = updates.guest_count;
  if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;
  if (updates.outlet_id !== undefined) updateData.outlet_id = updates.outlet_id;
  if (updates.client_id !== undefined) updateData.client_id = updates.client_id;

  // Update event (only while it is still planned)
  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .eq('status', 'planned')
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      'Event was not updated. It may no longer be planned, or you no longer have access. Reload the page and try again.'
    );
  }

  return data;
}

/**
 * Move a planned event to a final status. The status predicate makes this
 * safe against double clicks and concurrent complete/cancel: only the first
 * write matches.
 */
async function transitionFromPlanned(
  eventId: string,
  status: 'completed' | 'cancelled'
): Promise<void> {
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .eq('status', 'planned')
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Event was changed by someone else or is no longer planned. Reload the page and try again.'
    );
  }
}

/**
 * Complete event
 * - Sets status to 'completed'
 * - The event can then be invoiced
 */
export async function completeEvent(
  userId: string,
  eventId: string
): Promise<void> {
  await requireEventWriter(userId, 'complete');

  // Verify event exists and is planned (friendly message; the update re-checks)
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'planned') {
    throw new Error('Only planned events can be completed');
  }

  await transitionFromPlanned(eventId, 'completed');
}

/**
 * Cancel event
 * - Sets status to 'cancelled'
 * - No invoice will be generated
 * - Blocked while dishware sent to the event is still outstanding
 */
export async function cancelEvent(
  userId: string,
  eventId: string
): Promise<void> {
  await requireEventWriter(userId, 'cancel');

  const event = await getEventById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status === 'cancelled') {
    throw new Error('Event is already cancelled');
  }

  if (event.status === 'completed') {
    throw new Error('Cannot cancel a completed event');
  }

  const { totalOutstanding } = await getAllocationSummary(userId, 'event', eventId);
  if (totalOutstanding > 0) {
    throw new Error(
      `This event still has ${totalOutstanding} item(s) out. ` +
      'Record their return, damage or loss before cancelling the event.'
    );
  }

  await transitionFromPlanned(eventId, 'cancelled');
}
