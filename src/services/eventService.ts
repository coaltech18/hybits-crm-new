import { supabase } from '@/lib/supabase';
import type {
  Event,
  EventFilters,
  CreateEventInput,
  UpdateEventInput,
} from '@/types';
import { getClientById } from './clientService';

// ================================================================
// EVENT SERVICE
// ================================================================
// All CRUD operations for events with role-based access control
// ================================================================

/**
 * Get all events with filters (role-based)
 * - Admin/Accountant: See all events
 * - Manager: See only assigned outlet events
 */
export async function getEvents(
  userId: string,
  filters: EventFilters = {}
): Promise<Event[]> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

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
  if (profile.role === 'manager') {
    // Managers only see their assigned outlet events
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignments && assignments.length > 0) {
      const outletIds = assignments.map(a => a.outlet_id);
      query = query.in('outlet_id', outletIds);
    } else {
      // Manager has no outlets assigned, return empty array
      return [];
    }
  }

  // Admin/Accountant can optionally filter by specific outlet
  if (filters.outlet_id && ['admin', 'accountant'].includes(profile.role)) {
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
 * Get event by ID
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
    if (error.code === 'PGRST116') {
      return null; // Not found or no access
    }
    throw new Error(error.message);
  }

  return data;
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
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot create events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to create events');
  }

  // Validate required fields
  if (!input.client_id) {
    throw new Error('Client is required');
  }

  if (!input.event_name || input.event_name.trim() === '') {
    throw new Error('Event name is required');
  }

  if (!input.event_date) {
    throw new Error('Event date is required');
  }

  if (input.guest_count !== undefined && input.guest_count <= 0) {
    throw new Error('Guest count must be greater than 0');
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
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

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
      guest_count: input.guest_count || null,
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

  return data;
}

/**
 * Update event
 * 
 * LOCKED RULES:
 * - Managers cannot change outlet_id or client_id (enforced by trigger)
 * - Accountants cannot update
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  updates: UpdateEventInput
): Promise<Event> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot update events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to update events');
  }

  // Managers cannot change outlet_id or client_id
  if (profile.role === 'manager') {
    if (updates.outlet_id !== undefined) {
      throw new Error('Only admins can change outlet assignment');
    }
    if (updates.client_id !== undefined) {
      throw new Error('Only admins can change client assignment');
    }
  }

  // Validate guest count if provided
  if (updates.guest_count !== undefined && updates.guest_count <= 0) {
    throw new Error('Guest count must be greater than 0');
  }

  // Build update object (trim strings)
  const updateData: any = {};
  if (updates.event_name !== undefined) updateData.event_name = updates.event_name.trim();
  if (updates.event_type !== undefined) updateData.event_type = updates.event_type?.trim() || null;
  if (updates.event_date !== undefined) updateData.event_date = updates.event_date;
  if (updates.guest_count !== undefined) updateData.guest_count = updates.guest_count;
  if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.outlet_id !== undefined) updateData.outlet_id = updates.outlet_id;
  if (updates.client_id !== undefined) updateData.client_id = updates.client_id;

  // Update event
  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Complete event
 * - Sets status to 'completed'
 * - Event is considered done
 * - Ready for invoice generation (Phase 5)
 */
export async function completeEvent(
  userId: string,
  eventId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot complete events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to complete events');
  }

  // Verify event exists and is planned
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'planned') {
    throw new Error('Only planned events can be completed');
  }

  // Complete event
  const { error } = await supabase
    .from('events')
    .update({ status: 'completed' })
    .eq('id', eventId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Cancel event
 * - Sets status to 'cancelled'
 * - No invoice will be generated
 */
export async function cancelEvent(
  userId: string,
  eventId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot cancel events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to cancel events');
  }

  // Verify event exists and is not already cancelled
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

  // Cancel event
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Archive event
 * - Sets status to 'archived'
 * - Event is hidden from active views but data is preserved
 * - Use when event is completed but no longer relevant
 */
export async function archiveEvent(
  userId: string,
  eventId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot archive events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to archive events');
  }

  // Verify event exists
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status === 'archived') {
    throw new Error('Event is already archived');
  }

  // Archive event
  const { error } = await supabase
    .from('events')
    .update({ status: 'archived' })
    .eq('id', eventId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Delete event (CONDITIONAL)
 * 
 * BUSINESS RULES:
 * - Events with invoices CANNOT be deleted
 * - Events without invoices CAN be deleted
 * 
 * This service performs a pre-check before attempting delete.
 * The database trigger provides a second safety net.
 */
export async function deleteEvent(
  userId: string,
  eventId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot delete events
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to delete events');
  }

  // Verify event exists
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  // ================================================================
  // PRE-CHECK: Does this event have invoices?
  // ================================================================
  const { count: invoiceCount, error: countError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (countError) {
    throw new Error(`Failed to check invoices: ${countError.message}`);
  }

  // BLOCK: Event has invoices
  if (invoiceCount && invoiceCount > 0) {
    throw new Error(
      `This event has ${invoiceCount} invoice(s) and cannot be deleted. ` +
      'Archive or cancel the event instead.'
    );
  }

  // ================================================================
  // SAFE TO DELETE: No invoices exist
  // ================================================================
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    // Catch DB trigger error and convert to business message
    if (error.message.includes('cannot be deleted') ||
      error.message.includes('invoice')) {
      throw new Error(
        'This event has invoices and cannot be deleted. ' +
        'Archive or cancel the event instead.'
      );
    }
    throw new Error(error.message);
  }
}
