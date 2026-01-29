import { supabase } from '@/lib/supabase';
import type {
  Client,
  ClientFilters,
  CreateClientInput,
  UpdateClientInput,
} from '@/types';
import { validateGSTIN, validatePhone } from '@/utils/validation';

// ================================================================
// CLIENT SERVICE
// ================================================================
// All CRUD operations for clients with role-based access control
// ================================================================

/**
 * Get all clients with filters (role-based)
 * - Admin/Accountant: See all clients
 * - Manager: See only assigned outlet clients
 */
export async function getClients(
  userId: string,
  filters: ClientFilters = {}
): Promise<Client[]> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

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
  if (profile.role === 'manager') {
    // Managers only see their assigned outlet clients
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

  // Client type filter
  if (filters.client_type) {
    query = query.eq('client_type', filters.client_type);
  }

  // Search filter (name or phone)
  if (filters.search && filters.search.trim() !== '') {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`);
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
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found or no access
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create new client
 */
export async function createClient(
  userId: string,
  input: CreateClientInput
): Promise<Client> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot create clients
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to create clients');
  }

  // Validate required fields
  if (!input.name || input.name.trim().length < 2) {
    throw new Error('Client name must be at least 2 characters');
  }

  if (!input.phone) {
    throw new Error('Phone number is required');
  }

  // Validate phone
  const phoneValidation = validatePhone(input.phone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error);
  }

  // Validate GSTIN if provided
  if (input.gstin) {
    const gstinValidation = validateGSTIN(input.gstin);
    if (!gstinValidation.valid) {
      throw new Error(gstinValidation.error);
    }
  }

  // If manager, verify outlet is in their assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];

    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create clients for your assigned outlets');
    }
  }

  // Insert client (created_by will be set automatically by trigger)
  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...input,
      gstin: input.gstin?.toUpperCase() || null,
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
    .single();

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
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot update clients
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to update clients');
  }

  // Managers cannot change client_type or outlet_id
  if (profile.role === 'manager') {
    if (updates.client_type !== undefined) {
      throw new Error('Only admins can change client type');
    }
    if (updates.outlet_id !== undefined) {
      throw new Error('Only admins can change outlet assignment');
    }
  }

  // Validate phone if being updated
  if (updates.phone) {
    const phoneValidation = validatePhone(updates.phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error);
    }
  }

  // Validate GSTIN if being updated
  if (updates.gstin) {
    const gstinValidation = validateGSTIN(updates.gstin);
    if (!gstinValidation.valid) {
      throw new Error(gstinValidation.error);
    }
  }

  // Update client
  const { data, error } = await supabase
    .from('clients')
    .update({
      ...updates,
      gstin: updates.gstin ? updates.gstin.toUpperCase() : undefined,
    })
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
    .single();

  if (error) {
    throw new Error(error.message);
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
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot deactivate clients
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to deactivate clients');
  }

  // TODO: In Phase 3+, check for active subscriptions/events and show warning
  // For now, just deactivate

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
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot reactivate clients
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to reactivate clients');
  }

  const { error } = await supabase
    .from('clients')
    .update({ is_active: true })
    .eq('id', clientId);

  if (error) {
    throw new Error(error.message);
  }
}
