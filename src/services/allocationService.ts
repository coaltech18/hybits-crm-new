import { supabase } from '@/lib/supabase';
import type { InventoryAllocation, ReferenceType } from '@/types';

// ================================================================
// ALLOCATION SERVICE (STATE ONLY)
// ================================================================
// RESPONSIBILITY: Manage inventory_allocations table
// NO quantity math here - allocation state is derived from movements
// Allocation ≠ movement (allocation is created AFTER movement succeeds)
// ================================================================

/**
 * Get user role
 */
async function getUserRole(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  return profile.role;
}

/**
 * Get allocations by reference (subscription or event)
 * 
 * CRITICAL: outstanding_quantity is DERIVED from movements view
 * NOT stored in the allocation record
 * 
 * @param userId - Current user ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription ID or Event ID
 * @returns List of allocations with DERIVED outstanding quantity
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

  return data || [];
}

/**
 * Get all active allocations for an inventory item
 * 
 * @param userId - Current user ID
 * @param inventoryItemId - Inventory item ID
 * @returns List of allocations
 */
export async function getAllocationsByItem(
  _userId: string,
  inventoryItemId: string
): Promise<InventoryAllocation[]> {
  const { data, error } = await supabase
    .from('inventory_allocations_with_details')
    .select('*')
    .eq('inventory_item_id', inventoryItemId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Create allocation record
 * 
 * CRITICAL: This is called AFTER allocation movement succeeds
 * NOT used directly - called by integration hooks
 * Relies on UNIQUE constraint (inventory_item_id, reference_type, reference_id)
 * 
 * @param userId - Current user ID
 * @param outletId - Outlet ID
 * @param inventoryItemId - Inventory item ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription ID or Event ID
 * @param allocatedQuantity - Quantity allocated
 * @returns Created allocation record
 */
export async function createAllocation(
  userId: string,
  outletId: string,
  inventoryItemId: string,
  referenceType: ReferenceType,
  referenceId: string,
  allocatedQuantity: number
): Promise<InventoryAllocation> {
  const role = await getUserRole(userId);

  // Accountants cannot create allocations
  if (role === 'accountant') {
    throw new Error('Accountants cannot create allocations');
  }

  // Insert allocation record
  // UNIQUE constraint will prevent duplicates
  const { data, error } = await supabase
    .from('inventory_allocations')
    .insert({
      outlet_id: outletId,
      inventory_item_id: inventoryItemId,
      reference_type: referenceType,
      reference_id: referenceId,
      allocated_quantity: allocatedQuantity,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (error) {
    // If duplicate, update the existing allocation (increment)
    if (error.code === '23505') {
      // First, fetch the current allocation
      const { data: existing, error: fetchError } = await supabase
        .from('inventory_allocations')
        .select('allocated_quantity')
        .eq('inventory_item_id', inventoryItemId)
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!existing) {
        throw new Error('Failed to fetch existing allocation');
      }

      // Then update with incremented value
      const { data: updated, error: updateError } = await supabase
        .from('inventory_allocations')
        .update({
          allocated_quantity: (existing.allocated_quantity || 0) + allocatedQuantity,
        })
        .eq('inventory_item_id', inventoryItemId)
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .select()
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return updated;
    }

    throw new Error(error.message);
  }

  return data;
}

/**
 * Close allocation (mark as inactive)
 * 
 * CRITICAL: Called when all items are returned/damaged/lost
 * DB trigger (sync_allocation_on_movement) automatically closes allocations
 * when outstanding = 0
 * 
 * Manual close is also allowed (e.g., subscription cancelled)
 * 
 * @param userId - Current user ID
 * @param allocationId - Allocation ID
 */
export async function closeAllocation(
  userId: string,
  allocationId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Accountants cannot close allocations
  if (role === 'accountant') {
    throw new Error('Accountants cannot close allocations');
  }

  // Update allocation to inactive
  const { error } = await supabase
    .from('inventory_allocations')
    .update({ is_active: false })
    .eq('id', allocationId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Close all allocations for a reference (subscription or event)
 * 
 * Used when subscription is cancelled or event is cancelled
 * 
 * @param userId - Current user ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription ID or Event ID
 */
export async function closeAllocationsByReference(
  userId: string,
  referenceType: ReferenceType,
  referenceId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Accountants cannot close allocations
  if (role === 'accountant') {
    throw new Error('Accountants cannot close allocations');
  }

  // Update all active allocations for this reference
  const { error } = await supabase
    .from('inventory_allocations')
    .update({ is_active: false })
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get allocation summary for a reference
 * 
 * Returns total allocated and outstanding quantities
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

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_quantity, 0);
  const totalOutstanding = allocations.reduce((sum, a) => sum + (a.outstanding_quantity || 0), 0);
  const itemCount = allocations.length;

  return {
    totalAllocated,
    totalOutstanding,
    itemCount,
  };
}
