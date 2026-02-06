import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

// ================================================================
// ACTIVITY LOG SERVICE
// ================================================================
// CRITICAL RULES:
// - READ-ONLY service
// - Admin: all outlets
// - Accountant: all outlets (read-only)
// - Manager: assigned outlets ONLY
// - Data from admin_activity_log_unified view ONLY
// - CSV must match table exactly
// ================================================================

export interface ActivityLogFilters {
  outlet_id?: string;
  user_id?: string;
  module?: string;
  action_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface ActivityLogEntry {
  occurred_at: string;
  user_id: string | null;
  user_name: string | null;
  outlet_id: string;
  outlet_name: string;
  module: string;
  action_type: string;
  entity_id: string;
  description: string;
}

/**
 * Get user role and assigned outlets
 */
async function getUserRoleAndOutlets(userId: string): Promise<{
  role: string;
  outletIds: string[] | null;
}> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    throw new Error('User profile not found');
  }

  if (!profile.is_active) {
    throw new Error('User account is inactive');
  }

  // Check if user has permission to view activity logs
  if (!['admin', 'manager', 'accountant'].includes(profile.role)) {
    throw new Error('Permission denied: Insufficient privileges to view activity logs');
  }

  // Manager: Get assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments, error: assignError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignError) {
      throw new Error(`Failed to fetch outlet assignments: ${assignError.message}`);
    }

    const outletIds = assignments?.map(a => a.outlet_id) || [];
    return { role: profile.role, outletIds };
  }

  // Admin/Accountant: All outlets
  return { role: profile.role, outletIds: null };
}

/**
 * Get activity logs (role-based filtering)
 */
export async function getActivityLogs(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<ActivityLogEntry[]> {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('admin_activity_log_unified')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(1000); // Limit for performance

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length === 0) {
      return []; // No outlets assigned
    }
    query = query.in('outlet_id', roleData.outletIds);
  }

  // Admin/Accountant: Optional outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // User filter
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }

  // Module filter
  if (filters.module) {
    query = query.eq('module', filters.module);
  }

  // Action type filter
  if (filters.action_type) {
    query = query.eq('action_type', filters.action_type);
  }

  // Date range filters
  if (filters.date_from) {
    query = query.gte('occurred_at', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('occurred_at', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch activity logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Export activity logs as CSV (role-based filtering)
 */
export async function exportActivityLogsCSV(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<string> {
  const data = await getActivityLogs(userId, filters);

  // Map to CSV-friendly format
  const csvData = data.map(row => ({
    'Date': new Date(row.occurred_at).toLocaleDateString(),
    'Time': new Date(row.occurred_at).toLocaleTimeString(),
    'User': row.user_name || 'System',
    'Outlet': row.outlet_name,
    'Module': row.module.toUpperCase(),
    'Action': row.action_type.replace(/_/g, ' ').toUpperCase(),
    'Description': row.description,
  }));

  return Papa.unparse(csvData);
}

/**
 * Get available modules (for filter dropdowns)
 */
export async function getActivityModules(userId: string): Promise<string[]> {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('admin_activity_log_unified')
    .select('module');

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length === 0) {
      return [];
    }
    query = query.in('outlet_id', roleData.outletIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch modules: ${error.message}`);
  }

  // Get unique modules
  const modules = [...new Set(data?.map(row => row.module) || [])];
  return modules.sort();
}

/**
 * Get available action types (for filter dropdowns)
 */
export async function getActivityActionTypes(
  userId: string,
  module?: string
): Promise<string[]> {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('admin_activity_log_unified')
    .select('action_type');

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length === 0) {
      return [];
    }
    query = query.in('outlet_id', roleData.outletIds);
  }

  // Module filter
  if (module) {
    query = query.eq('module', module);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch action types: ${error.message}`);
  }

  // Get unique action types
  const actionTypes = [...new Set(data?.map(row => row.action_type) || [])];
  return actionTypes.sort();
}

/**
 * Get activity log statistics (for dashboard cards)
 */
export async function getActivityLogStats(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<{
  total_activities: number;
  unique_users: number;
  modules_active: number;
}> {
  const data = await getActivityLogs(userId, filters);

  const uniqueUsers = new Set(data.map(row => row.user_id).filter(Boolean));
  const uniqueModules = new Set(data.map(row => row.module));

  return {
    total_activities: data.length,
    unique_users: uniqueUsers.size,
    modules_active: uniqueModules.size,
  };
}

// PHASE 9 STEP 2 COMPLETE (activityLogService.ts)
