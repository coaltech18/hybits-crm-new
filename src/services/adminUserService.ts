import { supabase } from '@/lib/supabase';
import { countErrorMessage } from '@/utils/query';

// ================================================================
// ADMIN USER SERVICE
// ================================================================
// CRITICAL RULES:
// - Admin-only operations
// - Cannot deactivate last admin
// - Cannot deactivate self
// - Soft delete only (is_active flag)
// ================================================================

export interface CreateUserInput {
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'accountant';
  outlet_ids?: string[]; // Only for managers
}

export interface UserSummary {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  assigned_outlets: string[];
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

/**
 * Verify user is admin
 */
async function verifyAdminRole(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();

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
 * Get all users (admin only)
 */
export async function getUsers(adminUserId: string): Promise<UserSummary[]> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('admin_users_summary')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data || [];
}

/**
 * Every outlet assignment, grouped by user id (admin only).
 * Includes assignments to inactive outlets, which admin_users_summary hides
 * but which still grant database access.
 */
export async function getAllOutletAssignments(
  adminUserId: string
): Promise<Record<string, string[]>> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('user_outlet_assignments')
    .select('user_id, outlet_id');

  if (error) {
    throw new Error(`Failed to fetch outlet assignments: ${error.message}`);
  }

  const byUser: Record<string, string[]> = {};
  for (const row of data || []) {
    (byUser[row.user_id] ??= []).push(row.outlet_id);
  }
  return byUser;
}

/**
 * Outlet IDs currently assigned to one user (admin only)
 */
export async function getUserOutletIds(
  adminUserId: string,
  targetUserId: string
): Promise<string[]> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('user_outlet_assignments')
    .select('outlet_id')
    .eq('user_id', targetUserId);

  if (error) {
    throw new Error(`Failed to fetch outlet assignments: ${error.message}`);
  }

  return (data || []).map((row) => row.outlet_id);
}

/**
 * Create new user (admin only)
 *
 * NOT AVAILABLE FROM THE APP. Creating a login needs the Supabase service
 * role, which must never be in the browser. Until a server-side function
 * exists, users are created in the Supabase Dashboard (see AddEditUserModal).
 */
export async function createUser(
  adminUserId: string,
  input: CreateUserInput
): Promise<{ user_id: string }> {
  await verifyAdminRole(adminUserId);

  throw new Error(
    `Cannot create ${input.email || 'this user'} from the app. ` +
      'Create the login in Supabase Dashboard → Authentication → Users, then add their user_profiles row.'
  );
}

/**
 * Toggle user active status (admin only)
 */
export async function toggleUserActive(
  adminUserId: string,
  targetUserId: string,
  isActive: boolean
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Cannot deactivate self
  if (adminUserId === targetUserId && !isActive) {
    throw new Error('Cannot deactivate your own account');
  }

  // If deactivating an admin, check if last admin
  if (!isActive) {
    const { data: targetProfile, error: targetError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError) {
      throw new Error(`Failed to fetch user profile: ${targetError.message}`);
    }

    if (targetProfile?.role === 'admin') {
      const { count, error: countError, status: countStatus } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);

      if (countError) {
        throw new Error(`Failed to check admin count: ${countErrorMessage(countError, countStatus, 'active admins')}`);
      }

      if (count !== null && count <= 1) {
        throw new Error('Cannot deactivate the last active admin');
      }
    }
  }

  // Update status
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to update user status: ${error.message}`);
  }
}

/**
 * Set the exact list of outlets assigned to a manager (admin only).
 *
 * Prefers the atomic set_user_outlet_assignments RPC (migration 042). If that
 * function is not deployed yet, falls back to add-first-then-remove, so a
 * failure part-way never leaves the manager with zero outlets.
 */
export async function assignUserOutlets(
  adminUserId: string,
  targetUserId: string,
  outletIds: string[]
): Promise<void> {
  await verifyAdminRole(adminUserId);

  const uniqueIds = [...new Set(outletIds)];

  const { error: rpcError } = await supabase.rpc('set_user_outlet_assignments', {
    p_user_id: targetUserId,
    p_outlet_ids: uniqueIds,
  });

  if (!rpcError) return;

  // PGRST202 / 42883: function not found. Any other error is real.
  const missingFunction = rpcError.code === 'PGRST202' || rpcError.code === '42883';
  if (!missingFunction) {
    throw new Error(`Failed to assign outlets: ${rpcError.message}`);
  }

  // ---- Fallback (no RPC yet) ----
  const { data: targetProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to fetch user profile: ${profileError.message}`);
  }

  if (!targetProfile) {
    throw new Error('User profile not found');
  }

  if (targetProfile.role !== 'manager') {
    throw new Error('Only managers can be assigned to outlets');
  }

  // 1. Add the new set first (existing rows are left untouched)
  if (uniqueIds.length > 0) {
    const { error: upsertError } = await supabase
      .from('user_outlet_assignments')
      .upsert(
        uniqueIds.map((outletId) => ({
          user_id: targetUserId,
          outlet_id: outletId,
          assigned_by: adminUserId,
        })),
        { onConflict: 'user_id,outlet_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      throw new Error(`Failed to assign outlets: ${upsertError.message}`);
    }
  }

  // 2. Then remove the ones no longer selected
  let removeQuery = supabase
    .from('user_outlet_assignments')
    .delete()
    .eq('user_id', targetUserId);

  if (uniqueIds.length > 0) {
    removeQuery = removeQuery.not('outlet_id', 'in', `(${uniqueIds.join(',')})`);
  }

  const { error: deleteError } = await removeQuery;

  if (deleteError) {
    throw new Error(`Failed to remove old outlet assignments: ${deleteError.message}`);
  }
}

// PHASE 9 STEP 2 COMPLETE (adminUserService.ts)
