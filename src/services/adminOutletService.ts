import { supabase } from '@/lib/supabase';

// ================================================================
// ADMIN OUTLET SERVICE
// ================================================================
// CRITICAL RULES:
// - Admin-only operations
// - Cannot deactivate outlet with active subscriptions
// - Cannot deactivate outlet with allocated inventory
// - Soft deactivate only (is_active flag)
// - Metadata edits only (no business logic)
// ================================================================

export interface CreateOutletInput {
  name: string;
  code: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface UpdateOutletInput {
  name?: string;
  code?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface OutletSummary {
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  city: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
  client_count: number;
  active_subscription_count: number;
  allocated_inventory_count: number;
  active_event_count: number;
}

/**
 * Verify user is admin
 */
async function verifyAdminRole(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    throw new Error('User profile not found');
  }

  if (profile.role !== 'admin') {
    throw new Error('Permission denied: Admin access required');
  }

  if (!profile.is_active) {
    throw new Error('Permission denied: User account is inactive');
  }
}

/**
 * Get all outlets (admin only)
 */
export async function getOutlets(adminUserId: string): Promise<OutletSummary[]> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('admin_outlets_summary')
    .select('*')
    .order('is_active', { ascending: false })
    .order('outlet_name');

  if (error) {
    throw new Error(`Failed to fetch outlets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get single outlet by ID (admin only)
 */
export async function getOutletById(
  adminUserId: string,
  outletId: string
): Promise<OutletSummary> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('admin_outlets_summary')
    .select('*')
    .eq('outlet_id', outletId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch outlet: ${error.message}`);
  }

  return data;
}

/**
 * Create new outlet (admin only)
 */
export async function createOutlet(
  adminUserId: string,
  input: CreateOutletInput
): Promise<{ outlet_id: string }> {
  await verifyAdminRole(adminUserId);

  // Validate code uniqueness
  const { data: existing, error: checkError } = await supabase
    .from('outlets')
    .select('id')
    .eq('code', input.code)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check outlet code: ${checkError.message}`);
  }

  if (existing) {
    throw new Error(`Outlet code '${input.code}' already exists`);
  }

  // Create outlet
  const { data, error } = await supabase
    .from('outlets')
    .insert({
      name: input.name,
      code: input.code,
      city: input.city,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      is_active: true,
      created_by: adminUserId,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create outlet: ${error.message}`);
  }

  return { outlet_id: data.id };
}

/**
 * Update outlet metadata (admin only)
 */
export async function updateOutlet(
  adminUserId: string,
  outletId: string,
  updates: UpdateOutletInput
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // If updating code, check uniqueness
  if (updates.code) {
    const { data: existing, error: checkError } = await supabase
      .from('outlets')
      .select('id')
      .eq('code', updates.code)
      .neq('id', outletId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check outlet code: ${checkError.message}`);
    }

    if (existing) {
      throw new Error(`Outlet code '${updates.code}' already exists`);
    }
  }

  // Update outlet
  const { error } = await supabase
    .from('outlets')
    .update(updates)
    .eq('id', outletId);

  if (error) {
    throw new Error(`Failed to update outlet: ${error.message}`);
  }
}

/**
 * Deactivate outlet (admin only)
 * CRITICAL: Cannot deactivate if outlet has active subscriptions or allocated inventory
 */
export async function deactivateOutlet(
  adminUserId: string,
  outletId: string
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Check if outlet can be deactivated
  const validation = await canDeactivateOutlet(adminUserId, outletId);
  
  if (!validation.canDeactivate) {
    throw new Error(validation.reason || 'Cannot deactivate outlet');
  }

  // Soft deactivate
  const { error } = await supabase
    .from('outlets')
    .update({ is_active: false })
    .eq('id', outletId);

  if (error) {
    throw new Error(`Failed to deactivate outlet: ${error.message}`);
  }
}

/**
 * Check if an outlet can be deactivated
 * CRITICAL VALIDATION: Prevents data integrity issues
 */
export async function canDeactivateOutlet(
  adminUserId: string,
  outletId: string
): Promise<{ canDeactivate: boolean; reason?: string }> {
  await verifyAdminRole(adminUserId);

  // Check if already inactive
  const { data: outlet } = await supabase
    .from('outlets')
    .select('is_active')
    .eq('id', outletId)
    .single();

  if (!outlet?.is_active) {
    return { canDeactivate: false, reason: 'Outlet is already inactive' };
  }

  // Check for active subscriptions
  const { count: subscriptionCount, error: subError } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('outlet_id', outletId)
    .eq('status', 'active');

  if (subError) {
    throw new Error(`Failed to check subscriptions: ${subError.message}`);
  }

  if (subscriptionCount && subscriptionCount > 0) {
    return {
      canDeactivate: false,
      reason: `Cannot deactivate: ${subscriptionCount} active subscription(s) found. Please cancel or move subscriptions first.`,
    };
  }

  // Check for allocated inventory
  const { count: inventoryCount, error: invError } = await supabase
    .from('inventory_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('outlet_id', outletId)
    .eq('is_active', true);

  if (invError) {
    throw new Error(`Failed to check inventory allocations: ${invError.message}`);
  }

  if (inventoryCount && inventoryCount > 0) {
    return {
      canDeactivate: false,
      reason: `Cannot deactivate: ${inventoryCount} active inventory allocation(s) found. Please return all allocated items first.`,
    };
  }

  // Check for active events
  const { count: eventCount, error: eventError } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('outlet_id', outletId)
    .eq('status', 'planned');

  if (eventError) {
    throw new Error(`Failed to check events: ${eventError.message}`);
  }

  if (eventCount && eventCount > 0) {
    return {
      canDeactivate: false,
      reason: `Cannot deactivate: ${eventCount} active event(s) found. Please complete or cancel events first.`,
    };
  }

  return { canDeactivate: true };
}

/**
 * Activate outlet (admin only)
 */
export async function activateOutlet(
  adminUserId: string,
  outletId: string
): Promise<void> {
  await verifyAdminRole(adminUserId);

  const { error } = await supabase
    .from('outlets')
    .update({ is_active: true })
    .eq('id', outletId);

  if (error) {
    throw new Error(`Failed to activate outlet: ${error.message}`);
  }
}

// PHASE 9 STEP 2 COMPLETE (adminOutletService.ts)
