import { supabase } from '@/lib/supabase';
import type {
  Client,
  ClientFilters,
  CreateClientInput,
  UpdateClientInput,
  UserRole,
} from '@/types';
import { validateGSTIN, validatePhone, validateEmail, normalizePhone } from '@/utils/validation';
import { orIlike, countErrorMessage } from '@/utils/query';

// ================================================================
// CLIENT SERVICE
// ================================================================
// All CRUD operations for clients with role-based access control
// ================================================================

/**
 * Look up the caller's role. Query errors are surfaced, not turned into
 * "profile not found".
 */
export async function getUserRole(userId: string): Promise<UserRole> {
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

/**
 * Outlet IDs assigned to a manager. Query errors are surfaced so a transient
 * failure never looks like "no outlets" or "not your outlet".
 */
export async function getAssignedOutletIds(userId: string): Promise<string[]> {
  const { data: assignments, error } = await supabase
    .from('user_outlet_assignments')
    .select('outlet_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
  return (assignments || []).map((a) => a.outlet_id as string);
}

/** Trim optional text; empty becomes null, undefined stays undefined (field not sent). */
function cleanText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const t = (value ?? '').trim();
  return t ? t : null;
}

/**
 * Get all clients with filters (role-based)
 * - Admin/Accountant: See all clients
 * - Manager: See only assigned outlet clients
 */
export async function getClients(
  userId: string,
  filters: ClientFilters = {}
): Promise<Client[]> {
  const role = await getUserRole(userId);

  let query = supabase
    .from('clients')
    .select(`
      *,
      outlets (
        id,
        name,
        code,
        city
      )
    `)
    .eq('is_active', filters.is_active ?? true)
    .order('created_at', { ascending: false });

  // Role-based outlet filtering
  if (role === 'manager') {
    // Managers only see their assigned outlet clients
    const outletIds = await getAssignedOutletIds(userId);
    if (outletIds.length === 0) {
      // Manager has no outlets assigned
      return [];
    }
    query = query.in('outlet_id', outletIds);
  }

  // Optional specific-outlet filter (managers stay limited to their outlets above)
  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Client type filter
  if (filters.client_type) {
    query = query.eq('client_type', filters.client_type);
  }

  // Search filter (name or phone); orIlike quotes the value so , ( ) . : % _ are literal
  if (filters.search && filters.search.trim() !== '') {
    query = query.or(orIlike(['name', 'phone'], filters.search));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get client by ID
 */
export async function getClientById(clientId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      outlets (
        id,
        name,
        code,
        city,
        state,
        gstin
      )
    `)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data; // null when not found or no access
}

/**
 * Count records that reference a client. A client with any of these cannot
 * change type or outlet (the DB rules on subscriptions/events would break).
 */
export async function getClientUsageCounts(
  clientId: string
): Promise<{ subscriptions: number; events: number; invoices: number }> {
  const [subs, events, invoices] = await Promise.all([
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ]);

  if (subs.error) throw new Error(countErrorMessage(subs.error, subs.status, 'subscriptions'));
  if (events.error) throw new Error(countErrorMessage(events.error, events.status, 'events'));
  if (invoices.error) throw new Error(countErrorMessage(invoices.error, invoices.status, 'invoices'));

  return {
    subscriptions: subs.count ?? 0,
    events: events.count ?? 0,
    invoices: invoices.count ?? 0,
  };
}

/**
 * Create new client
 */
export async function createClient(
  userId: string,
  input: CreateClientInput
): Promise<Client> {
  const role = await getUserRole(userId);

  // Only admins and managers can create clients
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to create clients');
  }

  // Validate required fields
  const name = (input.name || '').trim();
  if (name.length < 2) {
    throw new Error('Client name must be at least 2 characters');
  }

  const phone = (input.phone || '').trim();
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error);
  }

  const emailValidation = validateEmail(input.email || '');
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error);
  }

  // GSTIN and GST type apply to corporate clients only
  const isCorporate = input.client_type === 'corporate';
  const rawGstin = isCorporate ? (input.gstin || '').trim() : '';
  if (rawGstin) {
    const gstinValidation = validateGSTIN(rawGstin);
    if (!gstinValidation.valid) {
      throw new Error(gstinValidation.error);
    }
  }

  // If manager, verify outlet is in their assigned outlets
  if (role === 'manager') {
    const allowedOutlets = await getAssignedOutletIds(userId);
    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create clients for your assigned outlets');
    }
  }

  // Insert client (created_by will be set automatically by trigger)
  const { data, error } = await supabase
    .from('clients')
    .insert({
      outlet_id: input.outlet_id,
      client_type: input.client_type,
      name,
      contact_person: cleanText(input.contact_person) ?? null,
      phone: normalizePhone(phone),
      email: cleanText(input.email) ?? null,
      gstin: rawGstin ? rawGstin.toUpperCase() : null,
      billing_address: cleanText(input.billing_address) ?? null,
      gst_type: isCorporate ? input.gst_type ?? 'domestic' : null,
    })
    .select(`
      *,
      outlets (
        id,
        name,
        code,
        city
      )
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update client
 */
export async function updateClient(
  userId: string,
  clientId: string,
  updates: UpdateClientInput
): Promise<Client> {
  const role = await getUserRole(userId);

  // Only admins and managers can update clients
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to update clients');
  }

  // Managers cannot change client_type or outlet_id
  if (role === 'manager') {
    if (updates.client_type !== undefined) {
      throw new Error('Only admins can change client type');
    }
    if (updates.outlet_id !== undefined) {
      throw new Error('Only admins can change outlet assignment');
    }
  }

  // Build a trimmed payload; only fields present in `updates` are sent
  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (name.length < 2) {
      throw new Error('Client name must be at least 2 characters');
    }
    payload.name = name;
  }

  if (updates.phone !== undefined) {
    const phone = updates.phone.trim();
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error);
    }
    payload.phone = normalizePhone(phone);
  }

  if (updates.email !== undefined) {
    const emailValidation = validateEmail(updates.email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }
    payload.email = cleanText(updates.email);
  }

  if (updates.contact_person !== undefined) {
    payload.contact_person = cleanText(updates.contact_person);
  }

  if (updates.billing_address !== undefined) {
    payload.billing_address = cleanText(updates.billing_address);
  }

  if (updates.gstin !== undefined) {
    const gstin = updates.gstin.trim();
    if (gstin) {
      const gstinValidation = validateGSTIN(gstin);
      if (!gstinValidation.valid) {
        throw new Error(gstinValidation.error);
      }
    }
    // Empty clears the GSTIN (null) instead of being silently dropped
    payload.gstin = gstin ? gstin.toUpperCase() : null;
  }

  if (updates.gst_type !== undefined) {
    payload.gst_type = updates.gst_type;
  }

  if (updates.client_type !== undefined) {
    payload.client_type = updates.client_type;
    // Event clients carry no GSTIN
    if (updates.client_type === 'event') {
      payload.gstin = null;
    }
  }

  if (updates.outlet_id !== undefined) {
    payload.outlet_id = updates.outlet_id;
  }

  if (updates.is_active !== undefined) {
    payload.is_active = updates.is_active;
  }

  // Update client
  const { data, error } = await supabase
    .from('clients')
    .update(payload)
    .eq('id', clientId)
    .select(`
      *,
      outlets (
        id,
        name,
        code,
        city
      )
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Client not found or you do not have permission to update it');
  }

  return data;
}

/**
 * Deactivate client (soft delete)
 */
export async function deactivateClient(
  userId: string,
  clientId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Only admins and managers can deactivate clients
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to deactivate clients');
  }

  // Block while the client still has live subscriptions (they would stay in MRR)
  const { count: liveSubs, error: countError, status: countStatus } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .in('status', ['active', 'paused']);

  if (countError) {
    throw new Error(countErrorMessage(countError, countStatus, 'live subscriptions'));
  }

  if (liveSubs && liveSubs > 0) {
    throw new Error(
      `This client has ${liveSubs} active or paused subscription${liveSubs === 1 ? '' : 's'}. ` +
      'Cancel them before deactivating the client.'
    );
  }

  const { error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', clientId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Reactivate client
 */
export async function reactivateClient(
  userId: string,
  clientId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Only admins and managers can reactivate clients
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to reactivate clients');
  }

  const { error } = await supabase
    .from('clients')
    .update({ is_active: true })
    .eq('id', clientId);

  if (error) {
    throw new Error(error.message);
  }
}
