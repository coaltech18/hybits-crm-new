import { supabase } from '@/lib/supabase';

// ================================================================
// ADMIN USER SERVICE
// ================================================================
// CRITICAL RULES:
// - Admin-only operations
// - Cannot deactivate last admin
// - Cannot downgrade self
// - Soft delete only (is_active flag)
// - All changes auditable
// ================================================================

export interface CreateUserInput {
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'accountant';
  outlet_ids?: string[]; // Only for managers
}

export interface UpdateUserRoleInput {
  role: 'admin' | 'manager' | 'accountant';
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
 * Get single user by ID (admin only)
 */
export async function getUserById(
  adminUserId: string,
  targetUserId: string
): Promise<UserSummary> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('admin_users_summary')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
}

/**
 * Create new user (admin only)
 * 
 * ⚠️ USER CREATION VIA FRONTEND DISABLED
 * Users should be created directly in Supabase Dashboard:
 * 1. Go to Authentication → Users → Invite User
 * 2. After user is created, add a row in user_profiles table
 * 3. If manager, add rows in user_outlet_assignments table
 */
export async function createUser(
  adminUserId: string,
  _input: CreateUserInput
): Promise<{ user_id: string }> {
  // Verify admin role first (for consistency)
  await verifyAdminRole(adminUserId);

  throw new Error(
    'User creation via the app is currently disabled. ' +
    'Please create users directly in Supabase Dashboard → Authentication → Users.'
  );
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  adminUserId: string,
  targetUserId: string,
  newRole: 'admin' | 'manager' | 'accountant'
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Cannot downgrade self
  if (adminUserId === targetUserId) {
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (currentProfile?.role === 'admin' && newRole !== 'admin') {
      throw new Error('Cannot downgrade your own admin role');
    }
  }

  // If downgrading from admin, check if last admin
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (targetProfile?.role === 'admin' && newRole !== 'admin') {
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true);

    if (countError) {
      throw new Error(`Failed to check admin count: ${countError.message}`);
    }

    if (count && count <= 1) {
      throw new Error('Cannot downgrade the last active admin');
    }
  }

  // Update role
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to update user role: ${error.message}`);
  }

  // If changing to non-manager, remove outlet assignments
  if (newRole !== 'manager') {
    await supabase
      .from('user_outlet_assignments')
      .delete()
      .eq('user_id', targetUserId);
  }
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
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfile?.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);

      if (countError) {
        throw new Error(`Failed to check admin count: ${countError.message}`);
      }

      if (count && count <= 1) {
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
 * Assign outlets to user (managers only)
 */
export async function assignUserOutlets(
  adminUserId: string,
  targetUserId: string,
  outletIds: string[]
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Verify target user is a manager
  const { data: targetProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to fetch user profile: ${profileError.message}`);
  }

  if (targetProfile.role !== 'manager') {
    throw new Error('Only managers can be assigned to outlets');
  }

  // Remove existing assignments
  const { error: deleteError } = await supabase
    .from('user_outlet_assignments')
    .delete()
    .eq('user_id', targetUserId);

  if (deleteError) {
    throw new Error(`Failed to remove existing outlet assignments: ${deleteError.message}`);
  }

  // Add new assignments
  if (outletIds.length > 0) {
    const assignments = outletIds.map((outletId) => ({
      user_id: targetUserId,
      outlet_id: outletId,
    }));

    const { error: insertError } = await supabase
      .from('user_outlet_assignments')
      .insert(assignments);

    if (insertError) {
      throw new Error(`Failed to assign outlets: ${insertError.message}`);
    }
  }
}

/**
 * Check if a user can be deactivated
 */
export async function canDeactivateUser(
  adminUserId: string,
  targetUserId: string
): Promise<{ canDeactivate: boolean; reason?: string }> {
  await verifyAdminRole(adminUserId);

  // Cannot deactivate self
  if (adminUserId === targetUserId) {
    return { canDeactivate: false, reason: 'Cannot deactivate your own account' };
  }

  // Check if last admin
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (!targetProfile?.is_active) {
    return { canDeactivate: false, reason: 'User is already inactive' };
  }

  if (targetProfile?.role === 'admin') {
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true);

    if (count && count <= 1) {
      return { canDeactivate: false, reason: 'Cannot deactivate the last active admin' };
    }
  }

  return { canDeactivate: true };
}

// PHASE 9 STEP 2 COMPLETE (adminUserService.ts)
