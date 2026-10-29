import { supabase } from '@/lib/supabase';
import { objectsToCsv } from '@/utils/csv';
import type { InventoryAllocation, InventoryMovement, MovementType, ReferenceType } from '@/types';
import {
  fetchAllRows,
  formatISTDateTime,
  istDateTimeParts,
  istDayStartISO,
  istNextDayStartISO,
} from '@/services/inventoryMovementService';
import { movementTypeLabel } from '@/components/inventory/movementLabels';
import { ilikePattern } from '@/utils/query';

// ================================================================
// INVENTORY REPORT SERVICE
// ================================================================
// CRITICAL RULES:
// - Reports are READ-ONLY
// - Data from DB views ONLY (no UI calculations)
// - Outlet scoping is enforced by RLS (managers only see assigned outlets)
// - Every query is paged internally, so results are never truncated at
//   PostgREST max_rows
// - CSV goes through @/utils/csv (formula-injection safe)
// - Soft-deleted records excluded
// ================================================================

// Row of view inventory_stock_summary (025)
export interface StockSummaryRow {
  item_id: string;
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  item_name: string;
  category: string;
  material: string | null;
  unit: string;
  total_quantity: number;
  available_quantity: number;
  allocated_quantity: number;
  damaged_quantity: number;
  in_repair_quantity: number;
  lost_quantity: number;
  lifecycle_status: string;
  opening_balance_confirmed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Row of view inventory_allocations_with_details (025)
export interface AllocationReportRow extends Omit<InventoryAllocation, 'id'> {
  allocation_id: string;
  outlet_code?: string;
  lifecycle_status?: string;
}

// Row of view inventory_damage_loss_report
export interface DamageLossRow {
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  inventory_item_id: string;
  item_name: string;
  item_category: string;
  movement_type: 'damage' | 'loss';
  incident_count: number;
  total_quantity: number;
  report_date: string;
  reference_type: ReferenceType;
  reference_id: string | null;
  reference_name: string | null;
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
  _userId: string,
  filters: StockSummaryFilters = {}
): Promise<StockSummaryRow[]> {
  return fetchAllRows<StockSummaryRow>((from, to) => {
    let query = supabase
      .from('inventory_stock_summary')
      .select('*')
      .order('item_name')
      .order('item_id');

    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.category?.trim()) query = query.ilike('category', ilikePattern(filters.category));
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

    return query.range(from, to);
  });
}

export async function exportStockSummaryCSV(
  userId: string,
  filters: StockSummaryFilters = {}
): Promise<string> {
  const data = await getStockSummaryReport(userId, filters);

  const csvData = data.map((row) => ({
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
    'In Repair': row.in_repair_quantity ?? 0,
    'Lost (lifetime)': row.lost_quantity,
    'Status': row.is_active ? 'Active' : 'Inactive',
  }));

  return objectsToCsv(csvData);
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
  _userId: string,
  filters: AllocationReportFilters = {}
): Promise<AllocationReportRow[]> {
  return fetchAllRows<AllocationReportRow>((from, to) => {
    let query = supabase
      .from('inventory_allocations_with_details')
      .select('*')
      .order('item_name')
      .order('allocation_id');

    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.reference_type) query = query.eq('reference_type', filters.reference_type);
    if (filters.inventory_item_id) query = query.eq('inventory_item_id', filters.inventory_item_id);

    return query.range(from, to);
  });
}

export async function exportAllocationReportCSV(
  userId: string,
  filters: AllocationReportFilters = {}
): Promise<string> {
  const data = await getAllocationReport(userId, filters);

  const csvData = data.map((row) => ({
    'Item Name': row.item_name,
    'Category': row.item_category,
    'Outlet': row.outlet_name,
    'Reference Type': row.reference_type,
    'Reference': row.reference_name || '',
    'Allocated Quantity': row.allocated_quantity,
    'Outstanding Quantity': row.outstanding_quantity,
    'Status': row.is_active ? 'Active' : 'Closed',
    'Created At': formatISTDateTime(row.created_at),
  }));

  return objectsToCsv(csvData);
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
  _userId: string,
  filters: DamageLossReportFilters = {}
): Promise<DamageLossRow[]> {
  return fetchAllRows<DamageLossRow>((from, to) => {
    let query = supabase
      .from('inventory_damage_loss_report')
      .select('*')
      .order('report_date', { ascending: false })
      .order('item_name')
      .order('movement_type')
      .order('reference_id');

    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.movement_type) query = query.eq('movement_type', filters.movement_type);
    if (filters.inventory_item_id) query = query.eq('inventory_item_id', filters.inventory_item_id);
    // report_date is a calendar date column, so plain YYYY-MM-DD comparison is correct
    if (filters.date_from) query = query.gte('report_date', filters.date_from);
    if (filters.date_to) query = query.lte('report_date', filters.date_to);

    return query.range(from, to);
  });
}

export async function exportDamageLossCSV(
  userId: string,
  filters: DamageLossReportFilters = {}
): Promise<string> {
  const data = await getDamageLossReport(userId, filters);

  const csvData = data.map((row) => ({
    'Date': row.report_date,
    'Item Name': row.item_name,
    'Category': row.item_category,
    'Outlet': row.outlet_name,
    'Type': String(row.movement_type).toUpperCase(),
    'Incident Count': row.incident_count,
    'Total Quantity': row.total_quantity,
    'Reference Type': row.reference_type,
    'Reference': row.reference_name || 'Manual',
  }));

  return objectsToCsv(csvData);
}

// ================================================================
// 4. MOVEMENT HISTORY REPORT
// ================================================================

export interface MovementHistoryReportFilters {
  outlet_id?: string;
  inventory_item_id?: string;
  movement_type?: MovementType;
  date_from?: string; // IST calendar day, inclusive
  date_to?: string; // IST calendar day, inclusive
}

export async function getMovementHistoryReport(
  _userId: string,
  filters: MovementHistoryReportFilters = {}
): Promise<InventoryMovement[]> {
  const rows = await fetchAllRows<InventoryMovement & { movement_id?: string }>((from, to) => {
    let query = supabase
      .from('inventory_movements_with_details')
      .select('*')
      .order('created_at', { ascending: false })
      .order('movement_id', { ascending: false });

    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.inventory_item_id) query = query.eq('inventory_item_id', filters.inventory_item_id);
    if (filters.movement_type) query = query.eq('movement_type', filters.movement_type);
    if (filters.date_from) query = query.gte('created_at', istDayStartISO(filters.date_from));
    if (filters.date_to) query = query.lt('created_at', istNextDayStartISO(filters.date_to));

    return query.range(from, to);
  });
  return rows.map((row) => ({ ...row, id: row.id ?? (row.movement_id as string) }));
}

export async function exportMovementHistoryCSV(
  userId: string,
  filters: MovementHistoryReportFilters = {}
): Promise<string> {
  const data = await getMovementHistoryReport(userId, filters);

  const csvData = data.map((row) => {
    const { date, time } = istDateTimeParts(row.created_at);
    return {
      'Date': date,
      'Time': time,
      'Item Name': row.item_name,
      'Category': row.item_category,
      'Outlet': row.outlet_name,
      'Movement Type': movementTypeLabel(row.movement_type),
      'Quantity': row.quantity,
      'Reference Type': row.reference_type,
      'Reference': row.reference_name || 'Manual',
      'Notes': row.notes || '',
      'User': row.created_by_name || '',
    };
  });

  return objectsToCsv(csvData);
}
