import { supabase } from '@/lib/supabase';
import type {
  InventoryItem,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryFilters,
} from '@/types';
import { createStockIn } from './inventoryMovementService';

// ================================================================
// INVENTORY SERVICE (ITEM MASTER)
// ================================================================
// RESPONSIBILITY: CRUD for inventory_items
// NO stock changes here - stock always changes via movements only
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

/**
 * Get inventory items with filters
 * 
 * @param userId - Current user ID
 * @param filters - Optional filters (outlet_id, category, is_active)
 * @returns List of inventory items (RLS applies outlet filtering)
 */
export async function getInventoryItems(
  userId: string,
  filters: InventoryFilters = {}
): Promise<InventoryItem[]> {
  await getUserRoleAndOutlets(userId);

  // Accountants are read-only - allowed
  // Managers and Admins can view their items
  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      outlets:outlet_id (
        name,
        code
      )
    `)
    .order('name');

  // Apply filters
  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  } else {
    // Default: only active items
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Transform joined data
  return (data || []).map((item: any) => ({
    ...item,
    outlet_name: item.outlets?.name,
    outlet_code: item.outlets?.code,
  }));
}

/**
 * Get single inventory item by ID
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 * @returns Single inventory item (RLS applies)
 */
export async function getInventoryItemById(
  _userId: string,
  itemId: string
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      *,
      outlets:outlet_id (
        name,
        code
      )
    `)
    .eq('id', itemId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Inventory item not found');
  }

  return {
    ...data,
    outlet_name: data.outlets?.name,
    outlet_code: data.outlets?.code,
  };
}

/**
 * Create new inventory item
 * 
 * CRITICAL: Initial stock creates a stock_in movement via inventoryMovementService
 * NEVER updates quantity directly
 * 
 * @param userId - Current user ID
 * @param input - Item details + initial_stock
 * @returns Created inventory item
 */
export async function createInventoryItem(
  userId: string,
  input: CreateInventoryItemInput
): Promise<InventoryItem> {
  const roleData = await getUserRoleAndOutlets(userId);

  // Accountants are read-only
  if (roleData.role === 'accountant') {
    throw new Error('Accountants cannot create inventory items');
  }

  // Managers: Validate outlet assignment
  if (roleData.role === 'manager') {
    if (!roleData.outletIds || !roleData.outletIds.includes(input.outlet_id)) {
      throw new Error('You can only create items for your assigned outlets');
    }
  }

  // Validate initial stock
  if (input.initial_stock < 0) {
    throw new Error('Initial stock cannot be negative');
  }

  // Create item with zero quantities (quantities will be set by movement trigger)
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .insert({
      outlet_id: input.outlet_id,
      name: input.name,
      category: input.category,
      material: input.material || null,
      unit: input.unit || 'pcs',
      // All quantities start at 0 - will be updated by stock_in movement
      total_quantity: 0,
      available_quantity: 0,
      allocated_quantity: 0,
      damaged_quantity: 0,
      lost_quantity: 0,
      created_by: userId,
    })
    .select()
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  // If initial stock > 0, create stock_in movement
  // This will trigger DB function to update quantities
  if (input.initial_stock > 0) {
    await createStockIn(userId, {
      outlet_id: input.outlet_id,
      inventory_item_id: item.id,
      quantity: input.initial_stock,
      notes: 'Initial stock',
    });
  }

  // Fetch updated item (quantities now reflect movement)
  return getInventoryItemById(userId, item.id);
}

/**
 * Update inventory item details
 * 
 * CRITICAL: Does NOT update quantities
 * Quantities can ONLY change via movements
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 * @param input - Updated item details (NO quantities)
 * @returns Updated inventory item
 */
export async function updateInventoryItem(
  userId: string,
  itemId: string,
  input: UpdateInventoryItemInput
): Promise<InventoryItem> {
  const roleData = await getUserRoleAndOutlets(userId);

  // Accountants are read-only
  if (roleData.role === 'accountant') {
    throw new Error('Accountants cannot update inventory items');
  }

  // Fetch item to check outlet (RLS will enforce, but explicit check for better error)
  const existingItem = await getInventoryItemById(userId, itemId);

  // Managers: Validate outlet assignment
  if (roleData.role === 'manager') {
    if (!roleData.outletIds || !roleData.outletIds.includes(existingItem.outlet_id)) {
      throw new Error('You can only update items for your assigned outlets');
    }
  }

  // Update item (quantities NOT included)
  const { error } = await supabase
    .from('inventory_items')
    .update({
      name: input.name,
      category: input.category,
      material: input.material,
      unit: input.unit,
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return getInventoryItemById(userId, itemId);
}

/**
 * Deactivate (soft delete) inventory item
 * 
 * CRITICAL: DB trigger will PREVENT deactivation if movements exist
 * DO NOT catch and override this error - it's a safety feature
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 */
export async function deactivateInventoryItem(
  userId: string,
  itemId: string
): Promise<void> {
  const roleData = await getUserRoleAndOutlets(userId);

  // Accountants are read-only
  if (roleData.role === 'accountant') {
    throw new Error('Accountants cannot deactivate inventory items');
  }

  // Fetch item to check outlet
  const existingItem = await getInventoryItemById(userId, itemId);

  // Managers: Validate outlet assignment
  if (roleData.role === 'manager') {
    if (!roleData.outletIds || !roleData.outletIds.includes(existingItem.outlet_id)) {
      throw new Error('You can only deactivate items for your assigned outlets');
    }
  }

  // Attempt deactivation
  // DB trigger will FAIL if movements exist - this is intentional
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', itemId);

  if (error) {
    // Surface DB error directly (e.g., "Cannot deactivate item with movement history")
    throw new Error(error.message);
  }
}

/**
 * Get available categories (for dropdowns)
 * 
 * @param userId - Current user ID
 * @returns List of unique categories
 */
export async function getInventoryCategories(userId: string): Promise<string[]> {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('inventory_items')
    .select('category')
    .eq('is_active', true);

  // Managers: Filter by assigned outlets
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Extract unique categories
  const categories = [...new Set(data?.map(item => item.category) || [])];
  return categories.sort();
}

/**
 * Mark inventory item as inactive (soft delete)
 * Alias for deactivateInventoryItem - for business-friendly naming
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 */
export async function markInventoryItemInactive(
  userId: string,
  itemId: string
): Promise<void> {
  return deactivateInventoryItem(userId, itemId);
}

/**
 * Reactivate inventory item
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 */
export async function reactivateInventoryItem(
  userId: string,
  itemId: string
): Promise<void> {
  const roleData = await getUserRoleAndOutlets(userId);

  // Accountants are read-only
  if (roleData.role === 'accountant') {
    throw new Error('Accountants cannot reactivate inventory items');
  }

  // Fetch item to check outlet
  const existingItem = await getInventoryItemById(userId, itemId);

  // Managers: Validate outlet assignment
  if (roleData.role === 'manager') {
    if (!roleData.outletIds || !roleData.outletIds.includes(existingItem.outlet_id)) {
      throw new Error('You can only reactivate items for your assigned outlets');
    }
  }

  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: true })
    .eq('id', itemId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Delete inventory item (CONDITIONAL)
 * 
 * BUSINESS RULES:
 * - Items with movement history CANNOT be deleted
 * - Items without movements CAN be deleted
 * 
 * This service performs a pre-check before attempting delete.
 * The database trigger provides a second safety net.
 * 
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 */
export async function deleteInventoryItem(
  userId: string,
  itemId: string
): Promise<void> {
  const roleData = await getUserRoleAndOutlets(userId);

  // Accountants are read-only
  if (roleData.role === 'accountant') {
    throw new Error('Accountants cannot delete inventory items');
  }

  // Fetch item to check outlet
  const existingItem = await getInventoryItemById(userId, itemId);

  // Managers: Validate outlet assignment
  if (roleData.role === 'manager') {
    if (!roleData.outletIds || !roleData.outletIds.includes(existingItem.outlet_id)) {
      throw new Error('You can only delete items for your assigned outlets');
    }
  }

  // ================================================================
  // PRE-CHECK: Does this item have movements?
  // ================================================================
  const { count: movementCount, error: countError } = await supabase
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId);

  if (countError) {
    throw new Error(`Failed to check movements: ${countError.message}`);
  }

  // BLOCK: Item has movements
  if (movementCount && movementCount > 0) {
    throw new Error(
      `This inventory item has ${movementCount} movement record(s) and cannot be deleted. ` +
      'Mark the item as inactive instead.'
    );
  }

  // ================================================================
  // SAFE TO DELETE: No movements exist
  // ================================================================
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    // Catch DB trigger error and convert to business message
    if (error.message.includes('cannot be deleted') ||
      error.message.includes('movement')) {
      throw new Error(
        'This inventory item has movement history and cannot be deleted. ' +
        'Mark the item as inactive instead.'
      );
    }
    throw new Error(error.message);
  }
}
