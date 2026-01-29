import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

// ================================================================
// INVENTORY REPORT SERVICE
// ================================================================
// CRITICAL RULES:
// - Reports are READ-ONLY
// - Data from DB views ONLY (no UI calculations)
// - CSV export matches table data exactly
// - Role-based outlet filtering enforced
// - Soft-deleted records excluded
// ================================================================

/**
 * Get user role and assigned outlets (for managers)
 */
async function getUserRoleAndOutlets(userId: string): Promise<{
  role: string;
  outletIds: string[] | null;
}> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Managers: Get assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const outletIds = assignments?.map(a => a.outlet_id) || [];
    return { role: profile.role, outletIds };
  }

  // Admin/Accountant: All outlets
  return { role: profile.role, outletIds: null };
}

// ================================================================
// 1. STOCK SUMMARY REPORT
// ================================================================

export interface StockSummaryFilters {
  outlet_id?: string;
  category?: string;
  is_active?: boolean;
}

export async function getStockSummaryReport(
  userId: string,
  filters: StockSummaryFilters = {}
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('inventory_stock_summary')
    .select('*')
    .order('item_name');

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  // Admin/Accountant: Optional outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Category filter
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  // Active filter (default: true)
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function exportStockSummaryCSV(
  userId: string,
  filters: StockSummaryFilters = {}
): Promise<string> {
  const data = await getStockSummaryReport(userId, filters);

  const csvData = data.map(row => ({
    'Item Name': row.item_name,
    'Category': row.category,
    'Material': row.material || '',
    'Unit': row.unit,
    'Outlet': row.outlet_name,
    'Outlet Code': row.outlet_code,
    'Total Quantity': row.total_quantity,
    'Available': row.available_quantity,
    'Allocated': row.allocated_quantity,
    'Damaged': row.damaged_quantity,
    'Lost': row.lost_quantity,
    'Status': row.is_active ? 'Active' : 'Inactive',
  }));

  return Papa.unparse(csvData);
}

// ================================================================
// 2. ALLOCATION REPORT
// ================================================================

export interface AllocationReportFilters {
  outlet_id?: string;
  reference_type?: 'subscription' | 'event';
  inventory_item_id?: string;
}

export async function getAllocationReport(
  userId: string,
  filters: AllocationReportFilters = {}
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('inventory_allocations_with_details')
    .select('*')
    .order('item_name');

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  // Admin/Accountant: Optional outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Reference type filter
  if (filters.reference_type) {
    query = query.eq('reference_type', filters.reference_type);
  }

  // Item filter
  if (filters.inventory_item_id) {
    query = query.eq('inventory_item_id', filters.inventory_item_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function exportAllocationReportCSV(
  userId: string,
  filters: AllocationReportFilters = {}
): Promise<string> {
  const data = await getAllocationReport(userId, filters);

  const csvData = data.map(row => ({
    'Item Name': row.item_name,
    'Category': row.item_category,
    'Outlet': row.outlet_name,
    'Reference Type': row.reference_type,
    'Reference': row.reference_name || '',
    'Allocated Quantity': row.allocated_quantity,
    'Outstanding Quantity': row.outstanding_quantity,
    'Status': row.is_active ? 'Active' : 'Closed',
    'Created At': new Date(row.created_at).toLocaleString(),
  }));

  return Papa.unparse(csvData);
}

// ================================================================
// 3. DAMAGE & LOSS REPORT
// ================================================================

export interface DamageLossReportFilters {
  outlet_id?: string;
  movement_type?: 'damage' | 'loss';
  inventory_item_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function getDamageLossReport(
  userId: string,
  filters: DamageLossReportFilters = {}
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('inventory_damage_loss_report')
    .select('*')
    .order('report_date', { ascending: false });

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  // Admin/Accountant: Optional outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Movement type filter
  if (filters.movement_type) {
    query = query.eq('movement_type', filters.movement_type);
  }

  // Item filter
  if (filters.inventory_item_id) {
    query = query.eq('inventory_item_id', filters.inventory_item_id);
  }

  // Date filters
  if (filters.date_from) {
    query = query.gte('report_date', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('report_date', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function exportDamageLossCSV(
  userId: string,
  filters: DamageLossReportFilters = {}
): Promise<string> {
  const data = await getDamageLossReport(userId, filters);

  const csvData = data.map(row => ({
    'Date': row.report_date,
    'Item Name': row.item_name,
    'Category': row.item_category,
    'Outlet': row.outlet_name,
    'Type': row.movement_type.toUpperCase(),
    'Incident Count': row.incident_count,
    'Total Quantity': row.total_quantity,
    'Reference Type': row.reference_type,
    'Reference': row.reference_name || 'Manual',
  }));

  return Papa.unparse(csvData);
}

// ================================================================
// 4. MOVEMENT HISTORY REPORT
// ================================================================

export interface MovementHistoryReportFilters {
  outlet_id?: string;
  inventory_item_id?: string;
  movement_type?: 'stock_in' | 'allocation' | 'return' | 'damage' | 'loss' | 'adjustment';
  date_from?: string;
  date_to?: string;
}

export async function getMovementHistoryReport(
  userId: string,
  filters: MovementHistoryReportFilters = {}
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('inventory_movements_with_details')
    .select('*')
    .order('created_at', { ascending: false });

  // Manager: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  // Admin/Accountant: Optional outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Item filter
  if (filters.inventory_item_id) {
    query = query.eq('inventory_item_id', filters.inventory_item_id);
  }

  // Movement type filter
  if (filters.movement_type) {
    query = query.eq('movement_type', filters.movement_type);
  }

  // Date filters
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function exportMovementHistoryCSV(
  userId: string,
  filters: MovementHistoryReportFilters = {}
): Promise<string> {
  const data = await getMovementHistoryReport(userId, filters);

  const csvData = data.map(row => ({
    'Date': new Date(row.created_at).toLocaleDateString(),
    'Time': new Date(row.created_at).toLocaleTimeString(),
    'Item Name': row.item_name,
    'Category': row.item_category,
    'Outlet': row.outlet_name,
    'Movement Type': row.movement_type.toUpperCase(),
    'Quantity': row.quantity,
    'Reference Type': row.reference_type,
    'Reference': row.reference_name || 'Manual',
    'Notes': row.notes || '',
    'User': row.created_by_name,
  }));

  return Papa.unparse(csvData);
}
