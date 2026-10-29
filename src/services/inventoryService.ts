import { supabase } from '@/lib/supabase';
import type {
  InventoryItem,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryFilters,
} from '@/types';
import { createStockInV2 } from './inventoryMovementServiceV2';
import { fetchAllRows } from './inventoryMovementService';

// ================================================================
// INVENTORY SERVICE (ITEM MASTER)
// ================================================================
// RESPONSIBILITY: CRUD for inventory_items
// NO stock changes here - stock always changes via movements only
// ================================================================

/**
 * Get user role and assigned outlets (for managers). Used by writes for a
 * clear error message; RLS is the real guard.
 */
async function getUserRoleAndOutlets(userId: string): Promise<{
  role: string;
  outletIds: string[] | null;
}> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    throw new Error('User profile not found');
  }

  // Managers: Get assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignmentsError) throw new Error(assignmentsError.message);
    const outletIds = (assignments || []).map((a: { outlet_id: string }) => a.outlet_id);
    return { role: profile.role, outletIds };
  }

  // Admin/Accountant: All outlets
  return { role: profile.role, outletIds: null };
}

/** Throws unless the user is an admin, or a manager assigned to the outlet. */
async function assertCanWrite(userId: string, outletId: string, action: string): Promise<void> {
  const roleData = await getUserRoleAndOutlets(userId);
  if (roleData.role === 'admin') return;
  if (roleData.role === 'manager') {
    if (roleData.outletIds?.includes(outletId)) return;
    throw new Error(`You can only ${action} items for your assigned outlets`);
  }
  throw new Error(`Only admins and managers can ${action} inventory items`);
}

type ItemRow = InventoryItem & { outlets?: { name?: string; code?: string } | null };

function mapItem(item: ItemRow): InventoryItem {
  const { outlets, ...rest } = item;
  return { ...rest, outlet_name: outlets?.name, outlet_code: outlets?.code };
}

const ITEM_SELECT = `
      *,
      outlets:outlet_id (
        name,
        code
      )
    `;

/**
 * Get inventory items with filters
 *
 * @param _userId - Current user ID (RLS applies outlet filtering)
 * @param filters - Optional filters. is_active: true/false, 'all', or undefined (= active only)
 * @returns List of inventory items
 */
export async function getInventoryItems(
  _userId: string,
  filters: InventoryFilters = {}
): Promise<InventoryItem[]> {
  const rows = await fetchAllRows<ItemRow>((from, to) => {
    let query = supabase.from('inventory_items').select(ITEM_SELECT).order('name').order('id');

    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.category) query = query.eq('category', filters.category);

    if (filters.is_active === undefined) {
      query = query.eq('is_active', true); // Default: only active items
    } else if (filters.is_active !== 'all') {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.has_damaged) query = query.gt('damaged_quantity', 0);
    if (filters.in_repair) query = query.gt('in_repair_quantity', 0);
    if (filters.opening_unlocked) query = query.eq('opening_balance_confirmed', false);

    return query.range(from, to);
  });

  return rows.map(mapItem);
}

/**
 * Get single inventory item by ID
 *
 * @param _userId - Current user ID
 * @param itemId - Inventory item ID
 * @returns Single inventory item (RLS applies)
 */
export async function getInventoryItemById(
  _userId: string,
  itemId: string
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(ITEM_SELECT)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Inventory item not found');
  }

  return mapItem(data as ItemRow);
}

/**
 * Create new inventory item
 *
 * CRITICAL: Initial stock creates a stock_in movement via inventoryMovementServiceV2
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
  await assertCanWrite(userId, input.outlet_id, 'create');

  // Validate initial stock
  if (input.initial_stock < 0) {
    throw new Error('Initial stock cannot be negative');
  }

  // Create item with zero quantities (quantities will be set by movement trigger).
  // The opening balance starts UNLOCKED; the DB locks it on the first allocation.
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
      in_repair_quantity: 0,
      lost_quantity: 0,
      lifecycle_status: 'active',
      opening_balance_confirmed: false,
      created_by: userId,
    })
    .select()
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }
  if (!item) {
    throw new Error('Item was not returned after creation');
  }

  // If initial stock > 0, create stock_in movement
  // This will trigger DB function to update quantities
  if (input.initial_stock > 0) {
    try {
      await createStockInV2(userId, {
        outlet_id: input.outlet_id,
        inventory_item_id: item.id,
        quantity: input.initial_stock,
        reason_code: 'opening_balance',
        notes: 'Initial stock on item creation',
      });
    } catch (err) {
      // The item exists now; retrying the create would duplicate it.
      const reason = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `Item "${input.name}" was created, but its opening stock could not be recorded (${reason}). ` +
          'Open the item and use Add Stock instead of creating it again.'
      );
    }
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
 * @param input - Updated item details (NO quantities). material: null clears it.
 * @returns Updated inventory item
 */
export async function updateInventoryItem(
  userId: string,
  itemId: string,
  input: UpdateInventoryItemInput
): Promise<InventoryItem> {
  // Fetch item to check outlet (RLS will enforce, but explicit check for better error)
  const existingItem = await getInventoryItemById(userId, itemId);
  await assertCanWrite(userId, existingItem.outlet_id, 'update');

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
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return getInventoryItemById(userId, itemId);
}

/**
 * Deactivate inventory item (active -> discontinued via enforce_item_lifecycle_v2).
 *
 * CRITICAL: the DB blocks this while dishes are still allocated.
 * DO NOT catch and override this error - it's a safety feature
 *
 * @param userId - Current user ID
 * @param itemId - Inventory item ID
 */
export async function deactivateInventoryItem(
  userId: string,
  itemId: string
): Promise<void> {
  const existingItem = await getInventoryItemById(userId, itemId);
  await assertCanWrite(userId, existingItem.outlet_id, 'deactivate');

  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', itemId);

  if (error) {
    // Surface DB error directly
    throw new Error(error.message);
  }
}

/**
 * Get available categories (for dropdowns)
 *
 * RLS scopes outlets to the current user.
 * @returns List of unique categories
 */
export async function getInventoryCategories(): Promise<string[]> {
  const rows = await fetchAllRows<{ category: string }>((from, to) =>
    supabase
      .from('inventory_items')
      .select('category')
      .eq('is_active', true)
      .order('category')
      .order('id')
      .range(from, to)
  );

  // Extract unique categories
  const categories = [...new Set(rows.map((item) => item.category))];
  return categories.sort();
}
