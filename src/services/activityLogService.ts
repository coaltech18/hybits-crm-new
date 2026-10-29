import { supabase } from '@/lib/supabase';
import { toCsv } from '@/utils/csv';

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

/** Rows per page on the Activity log (PostgREST caps a response at 1000). */
export const ACTIVITY_LOG_PAGE_SIZE = 100;

export interface ActivityLogFilters {
  outlet_id?: string;
  user_id?: string;
  module?: string;
  action_type?: string;
  /** Local (IST) calendar date, YYYY-MM-DD, inclusive */
  date_from?: string;
  /** Local (IST) calendar date, YYYY-MM-DD, inclusive */
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

export interface ActivityLogResult {
  rows: ActivityLogEntry[];
  /** Total matching rows in the view (may exceed rows.length). */
  total: number;
}

// ----------------------------------------------------------------
// Filter options
// ----------------------------------------------------------------
// Derived from admin_activity_log_unified (016) and the source enums, so
// the dropdowns are complete regardless of which rows are most recent.
// Update these when the view or the enums change.
// ----------------------------------------------------------------

const ACTION_TYPES_BY_MODULE: Record<string, string[]> = {
  event: ['event_created', 'event_status_planned', 'event_status_completed', 'event_status_cancelled'],
  inventory: [
    'stock_in',
    'allocation',
    'return',
    'return_damaged',
    'damage',
    'loss',
    'disposal',
    'send_to_repair',
    'return_from_repair',
    'adjustment',
  ],
  invoice: ['invoice_subscription', 'invoice_event'],
  payment: ['payment_cash', 'payment_upi', 'payment_bank_transfer', 'payment_card', 'payment_cheque'],
  subscription: [
    'subscription_created',
    'subscription_status_active',
    'subscription_status_paused',
    'subscription_status_cancelled',
  ],
};

export const ACTIVITY_MODULES: string[] = Object.keys(ACTION_TYPES_BY_MODULE).sort();

/** Action types for a module, or all of them when no module is chosen. */
export function getActivityActionTypes(module?: string): string[] {
  if (module) return ACTION_TYPES_BY_MODULE[module] ?? [];
  return [...new Set(Object.values(ACTION_TYPES_BY_MODULE).flat())].sort();
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

/** The calendar day after a YYYY-MM-DD date, as YYYY-MM-DD. */
function nextCalendarDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Get one page of activity logs (role-based filtering), newest first,
 * with the total matching count.
 */
export async function getActivityLogs(
  userId: string,
  filters: ActivityLogFilters = {},
  { page = 0, pageSize = ACTIVITY_LOG_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
): Promise<ActivityLogResult> {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('admin_activity_log_unified')
    .select('*', { count: 'exact' })
    // Tie-breakers keep the order stable across pages when timestamps repeat
    .order('occurred_at', { ascending: false })
    .order('module')
    .order('action_type')
    .order('entity_id');

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length === 0) {
      return { rows: [], total: 0 }; // No outlets assigned
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

  // Date range: whole IST calendar days. occurred_at is timestamptz, so a bare
  // 'YYYY-MM-DD' would mean UTC midnight (05:30 IST).
  if (filters.date_from) {
    query = query.gte('occurred_at', `${filters.date_from}T00:00:00+05:30`);
  }
  if (filters.date_to) {
    query = query.lt('occurred_at', `${nextCalendarDay(filters.date_to)}T00:00:00+05:30`);
  }

  const from = page * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    throw new Error(`Failed to fetch activity logs: ${error.message}`);
  }

  const rows = data || [];
  return { rows, total: count ?? rows.length };
}

/**
 * Build the activity-log CSV from rows already on screen
 * (formula-injection safe via @/utils/csv).
 */
export function activityLogsToCSV(rows: ActivityLogEntry[]): string {
  return toCsv(
    ['Date', 'Time', 'User', 'Outlet', 'Module', 'Action', 'Description'],
    rows.map((row) => {
      const at = new Date(row.occurred_at);
      return [
        at.toLocaleDateString('en-IN'),
        at.toLocaleTimeString('en-IN'),
        row.user_name || 'System',
        row.outlet_name,
        row.module.toUpperCase(),
        row.action_type.replace(/_/g, ' ').toUpperCase(),
        row.description,
      ];
    })
  );
}

// PHASE 9 STEP 2 COMPLETE (activityLogService.ts)
