import { supabase } from '@/lib/supabase';
import type {
  InventoryMovement,
  CreateStockInInput,
  AllocateInventoryInput,
  ReturnInventoryInput,
  MarkDamageInput,
  MarkLossInput,
  AdjustInventoryInput,
  MovementFilters,
} from '@/types';

// ================================================================
// INVENTORY MOVEMENT SERVICE (SOURCE OF TRUTH)
// ================================================================
// RESPONSIBILITY: ONLY place where stock changes are initiated
// Every change = INSERT into inventory_movements
// NEVER updates inventory_items directly - DB triggers handle that
// ================================================================

/**
 * Get user role
 */
async function getUserRole(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  return profile.role;
}

/**
 * Get inventory movements with filters
 * 
 * @param userId - Current user ID
 * @param filters - Optional filters
 * @returns List of movements (RLS applies)
 */
export async function getInventoryMovements(
  _userId: string,
  filters: MovementFilters = {}
): Promise<InventoryMovement[]> {
  let query = supabase
    .from('inventory_movements_with_details')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  if (filters.inventory_item_id) {
    query = query.eq('inventory_item_id', filters.inventory_item_id);
  }

  if (filters.movement_type) {
    query = query.eq('movement_type', filters.movement_type);
  }

  if (filters.reference_type) {
    query = query.eq('reference_type', filters.reference_type);
  }

  if (filters.reference_id) {
    query = query.eq('reference_id', filters.reference_id);
  }

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

/**
 * Create stock in movement
 * 
 * CRITICAL: DB trigger will:
 * - Update available_quantity and total_quantity
 * - Validate user permissions
 * - Prevent negative stock
 * 
 * @param userId - Current user ID
 * @param input - Stock in details
 * @returns Created movement
 */
export async function createStockIn(
  userId: string,
  input: CreateStockInInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // Accountants cannot create movements
  if (role === 'accountant') {
    throw new Error('Accountants cannot create stock movements');
  }

  // Validate quantity is positive
  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Insert movement (DB trigger will update inventory_items)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'stock_in',
      quantity: input.quantity,
      reference_type: 'manual',
      reference_id: null,
      notes: input.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly (e.g., outlet mismatch, invalid item)
    throw new Error(error.message);
  }

  return data;
}

/**
 * Allocate inventory to subscription or event
 * 
 * CRITICAL: DB trigger will:
 * - Validate available stock (prevents negative)
 * - Update available_quantity (decrease) and allocated_quantity (increase)
 * - Validate reference exists
 * 
 * @param userId - Current user ID
 * @param input - Allocation details
 * @returns Created movement
 */
export async function allocateInventory(
  userId: string,
  input: AllocateInventoryInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // Accountants cannot create movements
  if (role === 'accountant') {
    throw new Error('Accountants cannot allocate inventory');
  }

  // Validate quantity is positive
  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Validate reference type
  if (!['subscription', 'event'].includes(input.reference_type)) {
    throw new Error('Reference type must be subscription or event');
  }

  // Insert movement (DB trigger validates availability and updates quantities)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'allocation',
      quantity: input.quantity,
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      notes: input.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly (e.g., "Insufficient stock available")
    throw new Error(error.message);
  }

  return data;
}

/**
 * Return inventory from subscription or event
 * 
 * CRITICAL: DB trigger will:
 * - Validate allocation exists
 * - Validate not returning more than allocated
 * - Update available_quantity (increase) and allocated_quantity (decrease)
 * 
 * @param userId - Current user ID
 * @param input - Return details
 * @returns Created movement
 */
export async function returnInventory(
  userId: string,
  input: ReturnInventoryInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // Accountants cannot create movements
  if (role === 'accountant') {
    throw new Error('Accountants cannot return inventory');
  }

  // Validate quantity is positive
  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Validate reference type
  if (!['subscription', 'event'].includes(input.reference_type)) {
    throw new Error('Reference type must be subscription or event');
  }

  // Insert movement (DB trigger validates allocation and updates quantities)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'return',
      quantity: input.quantity,
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      notes: input.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly (e.g., "Cannot return more than outstanding")
    throw new Error(error.message);
  }

  return data;
}

/**
 * Mark inventory as damaged
 * 
 * CRITICAL: DB trigger will:
 * - Validate allocation exists
 * - Update damaged_quantity (increase) and allocated_quantity (decrease)
 * - Notes are MANDATORY
 * 
 * @param userId - Current user ID
 * @param input - Damage details (notes required)
 * @returns Created movement
 */
export async function markDamage(
  userId: string,
  input: MarkDamageInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // Accountants cannot create movements
  if (role === 'accountant') {
    throw new Error('Accountants cannot mark damage');
  }

  // Validate quantity is positive
  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Validate notes are provided
  if (!input.notes || input.notes.trim() === '') {
    throw new Error('Notes are required when marking damage');
  }

  // Validate reference type
  if (!['subscription', 'event'].includes(input.reference_type)) {
    throw new Error('Reference type must be subscription or event');
  }

  // Insert movement (DB trigger validates allocation and updates quantities)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'damage',
      quantity: input.quantity,
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly
    throw new Error(error.message);
  }

  return data;
}

/**
 * Mark inventory as lost
 * 
 * CRITICAL: DB trigger will:
 * - Validate allocation exists
 * - Update lost_quantity (increase), allocated_quantity (decrease), total_quantity (decrease)
 * - Notes are MANDATORY
 * 
 * @param userId - Current user ID
 * @param input - Loss details (notes required)
 * @returns Created movement
 */
export async function markLoss(
  userId: string,
  input: MarkLossInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // Accountants cannot create movements
  if (role === 'accountant') {
    throw new Error('Accountants cannot mark loss');
  }

  // Validate quantity is positive
  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Validate notes are provided
  if (!input.notes || input.notes.trim() === '') {
    throw new Error('Notes are required when marking loss');
  }

  // Validate reference type
  if (!['subscription', 'event'].includes(input.reference_type)) {
    throw new Error('Reference type must be subscription or event');
  }

  // Insert movement (DB trigger validates allocation and updates quantities)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'loss',
      quantity: input.quantity,
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly
    throw new Error(error.message);
  }

  return data;
}

/**
 * Adjust inventory (ADMIN ONLY)
 * 
 * CRITICAL: DB trigger will:
 * - Validate user is ADMIN (non-admins will be rejected)
 * - Validate notes are provided (mandatory)
 * - Update available_quantity and total_quantity
 * - Log adjustment for audit
 * 
 * @param userId - Current user ID (must be admin)
 * @param input - Adjustment details (notes mandatory)
 * @returns Created movement
 */
export async function adjustInventory(
  userId: string,
  input: AdjustInventoryInput
): Promise<InventoryMovement> {
  const role = await getUserRole(userId);

  // ADMIN ONLY - DB trigger will also validate this
  if (role !== 'admin') {
    throw new Error('Only admins can perform inventory adjustments');
  }

  // Validate quantity is positive (even for adjustments)
  if (input.quantity <= 0) {
    throw new Error('Adjustment quantity must be greater than zero');
  }

  // Validate notes are provided (MANDATORY for adjustments)
  if (!input.notes || input.notes.trim() === '') {
    throw new Error('Notes are MANDATORY for inventory adjustments (explain the reason)');
  }

  // Insert movement (DB trigger validates admin role and notes)
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      outlet_id: input.outlet_id,
      inventory_item_id: input.inventory_item_id,
      movement_type: 'adjustment',
      quantity: input.quantity,
      reference_type: 'manual',
      reference_id: null,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Surface DB error directly (e.g., "Only admins can perform adjustments")
    throw new Error(error.message);
  }

  return data;
}
