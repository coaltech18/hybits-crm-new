import { supabase } from '@/lib/supabase';
import type { InventoryAllocation, InventoryAllocationHistory, ReferenceType } from '@/types';

// ================================================================
// ALLOCATION SERVICE (READ ONLY)
// ================================================================
// inventory_allocations is maintained by the DB trigger
// sync_allocation_on_movement: it is created, topped up and closed
// from inventory_movements. The app never writes it directly.
// ================================================================

// Both views expose the allocation's primary key as allocation_id.
// Map it to `id` so callers (and React keys) have a stable identifier.
function withId<T extends { allocation_id?: string; id?: string }>(rows: T[] | null): (T & { id: string })[] {
  return (rows || []).map((r) => ({ ...r, id: r.allocation_id ?? r.id ?? '' }));
}

/**
 * Get ACTIVE allocations by reference (subscription or event)
 *
 * CRITICAL: outstanding_quantity is DERIVED from movements view
 * NOT stored in the allocation record
 *
 * @param userId - Current user ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription ID or Event ID
 * @returns List of active allocations with DERIVED outstanding quantity
 */
export async function getAllocationsByReference(
  _userId: string,
  referenceType: ReferenceType,
  referenceId: string
): Promise<InventoryAllocation[]> {
  // Use view that derives outstanding quantity from movements
  const { data, error } = await supabase
    .from('inventory_allocations_with_details')
    .select('*')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return withId(data as (InventoryAllocation & { allocation_id?: string })[] | null);
}

/**
 * Get the full allocation history for a reference, including allocations
 * that are fully resolved (closed). Returns per-outcome totals:
 * returned_good, returned_damaged, lost, disposed and outstanding.
 *
 * Reads view reference_allocation_history (migration 042).
 */
export async function getAllocationHistoryByReference(
  referenceType: ReferenceType,
  referenceId: string
): Promise<InventoryAllocationHistory[]> {
  const { data, error } = await supabase
    .from('reference_allocation_history')
    .select('*')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return withId(data as InventoryAllocationHistory[] | null).map((r) => ({
    ...r,
    allocated_quantity: Number(r.allocated_quantity) || 0,
    returned_good: Number(r.returned_good) || 0,
    returned_damaged: Number(r.returned_damaged) || 0,
    lost: Number(r.lost) || 0,
    disposed: Number(r.disposed) || 0,
    outstanding_quantity: Number(r.outstanding_quantity) || 0,
  }));
}

/** Totals for a set of active allocations (sent, still out, item count). */
export function summarizeAllocations(allocations: InventoryAllocation[]): {
  totalAllocated: number;
  totalOutstanding: number;
  itemCount: number;
} {
  return {
    totalAllocated: allocations.reduce((sum, a) => sum + a.allocated_quantity, 0),
    totalOutstanding: allocations.reduce((sum, a) => sum + (a.outstanding_quantity || 0), 0),
    itemCount: allocations.length,
  };
}

/**
 * Get allocation summary for a reference
 *
 * Returns total allocated and outstanding quantities (active allocations).
 * Callers that already hold the allocation rows should use
 * summarizeAllocations instead of querying again.
 *
 * @param userId - Current user ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription ID or Event ID
 * @returns Summary with totals
 */
export async function getAllocationSummary(
  userId: string,
  referenceType: ReferenceType,
  referenceId: string
): Promise<{
  totalAllocated: number;
  totalOutstanding: number;
  itemCount: number;
}> {
  const allocations = await getAllocationsByReference(userId, referenceType, referenceId);
  return summarizeAllocations(allocations);
}
