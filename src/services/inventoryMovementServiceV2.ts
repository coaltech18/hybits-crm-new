import { supabase } from '@/lib/supabase';
import type { InventoryMovement } from '@/types';

// ================================================================
// INVENTORY MOVEMENT SERVICE V2
// ================================================================
// Enhanced movement operations supporting:
// - movement_category (inflow, outflow, return, writeoff, adjustment, repair)
// - reason_code for detailed classification
// - negative adjustments (admin only)
// - repair flow (send_to_repair, return_from_repair)
// - opening balance corrections
//
// CRITICAL PRINCIPLES:
// - All stock changes MUST go through this service
// - DB triggers handle quantity updates
// - Movements are APPEND-ONLY
// ================================================================

// ================================================================
// TYPES (V2)
// ================================================================

export type MovementCategory =
    | 'inflow'
    | 'outflow'
    | 'return'
    | 'writeoff'
    | 'adjustment'
    | 'repair';

export type ReasonCode =
    // Inflow
    | 'opening_balance'
    | 'new_purchase'
    | 'gift_received'
    | 'transfer_in'
    | 'legacy_stock_in'
    // Outflow
    | 'subscription_start'
    | 'event_dispatch'
    | 'additional_dispatch'
    // Return
    | 'normal_return'
    | 'early_return'
    | 'client_damage'
    | 'transit_damage'
    // Writeoff - Damage
    | 'handling_damage'
    | 'storage_damage'
    | 'client_reported'
    | 'delivery_damage'
    // Writeoff - Loss
    | 'client_lost'
    | 'transit_lost'
    | 'theft'
    | 'missing_stock'
    // Writeoff - Disposal
    | 'end_of_life'
    | 'unrepairable'
    | 'audit_writeoff'
    // Adjustment
    | 'audit_surplus'
    | 'audit_shortage'
    | 'found_stock'
    | 'count_correction'
    | 'count_correction_negative'
    | 'opening_balance_correction'
    // Repair
    | 'internal_repair'
    | 'external_vendor'
    | 'repaired'
    | 'irreparable';

export interface CreateMovementV2Input {
    outlet_id: string;
    inventory_item_id: string;
    movement_category: MovementCategory;
    movement_type?: string; // For backward compatibility
    quantity: number;
    reference_type?: 'subscription' | 'event' | 'manual';
    reference_id?: string;
    reason_code?: ReasonCode;
    notes?: string;
}

export interface StockInV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    reason_code: 'opening_balance' | 'new_purchase' | 'gift_received' | 'transfer_in';
    notes?: string;
}

export interface AllocateV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    reference_type: 'subscription' | 'event';
    reference_id: string;
    reason_code?: 'subscription_start' | 'event_dispatch' | 'additional_dispatch';
    notes?: string;
}

export interface ReturnV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    reference_type: 'subscription' | 'event';
    reference_id: string;
    is_damaged: boolean;
    reason_code?: 'normal_return' | 'early_return' | 'client_damage' | 'transit_damage';
    notes?: string;
}

export interface AdjustV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    is_negative: boolean;
    reason_code: 'audit_surplus' | 'audit_shortage' | 'found_stock' | 'count_correction' | 'opening_balance_correction';
    notes: string; // MANDATORY
}

export interface WriteOffV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    reason_code: ReasonCode;
    reference_type?: 'subscription' | 'event' | 'manual';
    reference_id?: string;
    notes: string; // MANDATORY
}

export interface RepairV2Input {
    outlet_id: string;
    inventory_item_id: string;
    quantity: number;
    action: 'send' | 'return_fixed' | 'return_unfixable';
    notes?: string;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

async function getUserRoleAndStatus(userId: string): Promise<{
    role: string;
    isActive: boolean;
}> {
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw new Error(`Failed to get user profile: ${error.message}`);
    if (!profile) throw new Error('User profile not found');

    return { role: profile.role, isActive: profile.is_active };
}

async function checkItemLifecycle(itemId: string): Promise<{
    lifecycle_status: string;
    opening_balance_confirmed: boolean;
    available_quantity: number;
    damaged_quantity: number;
    in_repair_quantity: number;
}> {
    const { data: item, error } = await supabase
        .from('inventory_items')
        .select('lifecycle_status, opening_balance_confirmed, available_quantity, damaged_quantity, in_repair_quantity')
        .eq('id', itemId)
        .maybeSingle();

    if (error) throw new Error(`Failed to get item: ${error.message}`);
    if (!item) throw new Error('Inventory item not found');

    return item;
}

// ================================================================
// V2 MOVEMENT FUNCTIONS
// ================================================================

/**
 * Create stock inflow (V2)
 * Supports: opening_balance, new_purchase, gift_received, transfer_in
 */
export async function createStockInV2(
    userId: string,
    input: StockInV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot create stock movements');
    }

    if (input.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
    }

    const item = await checkItemLifecycle(input.inventory_item_id);

    // Only draft or active items can receive inflow
    if (!['draft', 'active'].includes(item.lifecycle_status)) {
        throw new Error(`Cannot add stock to ${item.lifecycle_status} items. Only draft or active items can receive stock.`);
    }

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'inflow',
            movement_type: 'stock_in',
            quantity: input.quantity,
            reference_type: 'manual',
            reference_id: null,
            reason_code: input.reason_code,
            notes: input.notes || null,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Allocate inventory to subscription/event (V2)
 * Automatically locks opening balance
 */
export async function allocateInventoryV2(
    userId: string,
    input: AllocateV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot allocate inventory');
    }

    if (input.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
    }

    const item = await checkItemLifecycle(input.inventory_item_id);

    // ONLY active items can be allocated
    if (item.lifecycle_status !== 'active') {
        throw new Error(`Cannot allocate from ${item.lifecycle_status} items. Only ACTIVE items can be allocated.`);
    }

    // Check availability (service-level check, DB trigger also validates)
    if (item.available_quantity < input.quantity) {
        throw new Error(`Insufficient stock. Available: ${item.available_quantity}, Requested: ${input.quantity}`);
    }

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'outflow',
            movement_type: 'allocation',
            quantity: input.quantity,
            reference_type: input.reference_type,
            reference_id: input.reference_id,
            reason_code: input.reason_code || 'subscription_start',
            notes: input.notes || null,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Return inventory from subscription/event (V2)
 * Supports: normal return or damaged return
 */
export async function returnInventoryV2(
    userId: string,
    input: ReturnV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot return inventory');
    }

    if (input.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
    }

    // Determine movement type and reason based on damage flag
    const movementType = input.is_damaged ? 'return_damaged' : 'return';
    const reasonCode = input.reason_code || (input.is_damaged ? 'client_damage' : 'normal_return');

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'return',
            movement_type: movementType,
            quantity: input.quantity,
            reference_type: input.reference_type,
            reference_id: input.reference_id,
            reason_code: reasonCode,
            notes: input.notes || null,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Adjust inventory (V2)
 * Supports: positive and negative adjustments
 * ADMIN ONLY after opening balance is confirmed
 */
export async function adjustInventoryV2(
    userId: string,
    input: AdjustV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    // Validate notes (mandatory)
    if (!input.notes || input.notes.trim() === '') {
        throw new Error('Notes are MANDATORY for inventory adjustments');
    }

    if (input.quantity <= 0) {
        throw new Error('Adjustment quantity must be greater than zero');
    }

    const item = await checkItemLifecycle(input.inventory_item_id);

    // After opening balance confirmed: ADMIN ONLY
    if (item.opening_balance_confirmed) {
        if (role !== 'admin') {
            throw new Error('Only admins can adjust inventory after opening balance is confirmed');
        }
    }

    // Negative adjustments: ALWAYS admin only
    if (input.is_negative && role !== 'admin') {
        throw new Error('Only admins can perform negative adjustments');
    }

    // Check availability for negative adjustments
    if (input.is_negative && item.available_quantity < input.quantity) {
        throw new Error(`Cannot adjust below zero. Available: ${item.available_quantity}, Adjustment: ${input.quantity}`);
    }

    // Determine reason code for negative adjustments
    let reasonCode: ReasonCode = input.reason_code;
    if (input.is_negative && !['audit_shortage', 'count_correction'].includes(input.reason_code)) {
        reasonCode = 'count_correction_negative';
    }

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'adjustment',
            movement_type: 'adjustment',
            quantity: input.quantity,
            reference_type: 'manual',
            reference_id: null,
            reason_code: reasonCode,
            notes: input.notes,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Write off inventory (V2)
 * Supports: damage, loss, disposal
 */
export async function writeOffInventoryV2(
    userId: string,
    input: WriteOffV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot write off inventory');
    }

    // Validate notes (mandatory)
    if (!input.notes || input.notes.trim() === '') {
        throw new Error('Notes are MANDATORY for writeoffs');
    }

    if (input.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
    }

    // Determine movement_type from reason_code
    let movementType: string;
    if (['handling_damage', 'storage_damage', 'client_damage', 'client_reported', 'delivery_damage'].includes(input.reason_code)) {
        movementType = 'damage';
    } else if (['client_lost', 'transit_lost', 'theft', 'missing_stock'].includes(input.reason_code)) {
        movementType = 'loss';
    } else if (['end_of_life', 'unrepairable', 'audit_writeoff'].includes(input.reason_code)) {
        movementType = 'disposal';
    } else {
        movementType = 'damage'; // fallback
    }

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'writeoff',
            movement_type: movementType,
            quantity: input.quantity,
            reference_type: input.reference_type || 'manual',
            reference_id: input.reference_id || null,
            reason_code: input.reason_code,
            notes: input.notes,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/**
 * Handle repair flow (V2)
 * Actions: send to repair, return fixed, return unfixable
 */
export async function processRepairV2(
    userId: string,
    input: RepairV2Input
): Promise<InventoryMovement> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot process repairs');
    }

    if (input.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
    }

    const item = await checkItemLifecycle(input.inventory_item_id);

    let movementType: string;
    let reasonCode: ReasonCode;

    switch (input.action) {
        case 'send':
            // Validate damaged stock available
            if (item.damaged_quantity < input.quantity) {
                throw new Error(`Insufficient damaged stock. Damaged: ${item.damaged_quantity}, Requested: ${input.quantity}`);
            }
            movementType = 'send_to_repair';
            reasonCode = 'external_vendor';
            break;

        case 'return_fixed':
            // Validate in_repair stock available
            if (item.in_repair_quantity < input.quantity) {
                throw new Error(`Insufficient items in repair. In repair: ${item.in_repair_quantity}, Requested: ${input.quantity}`);
            }
            movementType = 'return_from_repair';
            reasonCode = 'repaired';
            break;

        case 'return_unfixable':
            // Validate in_repair stock available
            if (item.in_repair_quantity < input.quantity) {
                throw new Error(`Insufficient items in repair. In repair: ${item.in_repair_quantity}, Requested: ${input.quantity}`);
            }
            movementType = 'return_from_repair';
            reasonCode = 'irreparable';
            break;

        default:
            throw new Error(`Invalid repair action: ${input.action}`);
    }

    const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
            outlet_id: input.outlet_id,
            inventory_item_id: input.inventory_item_id,
            movement_category: 'repair',
            movement_type: movementType,
            quantity: input.quantity,
            reference_type: 'manual',
            reference_id: null,
            reason_code: reasonCode,
            notes: input.notes || null,
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

// ================================================================
// ITEM LIFECYCLE FUNCTIONS (V2)
// ================================================================

/**
 * Discontinue an inventory item (V2)
 * Requires: allocated_quantity = 0
 */
export async function discontinueItem(
    userId: string,
    itemId: string
): Promise<{ success: boolean; message: string }> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot discontinue inventory items');
    }

    // Get item with allocated quantity and lifecycle status
    const { data: fullItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('allocated_quantity, lifecycle_status')
        .eq('id', itemId)
        .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!fullItem) throw new Error('Item not found');

    if (fullItem.lifecycle_status === 'archived') {
        throw new Error('Archived items cannot be modified');
    }

    if (fullItem.lifecycle_status === 'discontinued') {
        return { success: true, message: 'Item is already discontinued' };
    }

    if (fullItem.allocated_quantity > 0) {
        throw new Error(`Cannot discontinue item with outstanding allocations. Allocated: ${fullItem.allocated_quantity}. Resolve allocations first.`);
    }

    const { error } = await supabase
        .from('inventory_items')
        .update({ lifecycle_status: 'discontinued' })
        .eq('id', itemId);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Item discontinued successfully' };
}

/**
 * Reactivate a discontinued item (V2)
 */
export async function reactivateItem(
    userId: string,
    itemId: string
): Promise<{ success: boolean; message: string }> {
    const { role } = await getUserRoleAndStatus(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot reactivate inventory items');
    }

    const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('lifecycle_status')
        .eq('id', itemId)
        .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!item) throw new Error('Item not found');

    if (item.lifecycle_status === 'archived') {
        throw new Error('Archived items cannot be reactivated');
    }

    if (item.lifecycle_status === 'active') {
        return { success: true, message: 'Item is already active' };
    }

    const { error } = await supabase
        .from('inventory_items')
        .update({ lifecycle_status: 'active' })
        .eq('id', itemId);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Item reactivated successfully' };
}

/**
 * Check if item can be deleted (V2)
 * Returns detailed reason if not deletable
 */
export async function canDeleteItem(
    itemId: string
): Promise<{ canDelete: boolean; reason?: string; suggestion?: string }> {
    // Check total quantity
    const { data: item, error: itemError } = await supabase
        .from('inventory_items')
        .select('total_quantity, lifecycle_status, name')
        .eq('id', itemId)
        .maybeSingle();

    if (itemError) throw new Error(itemError.message);
    if (!item) throw new Error('Item not found');

    if (item.total_quantity > 0) {
        return {
            canDelete: false,
            reason: `Item "${item.name}" has ${item.total_quantity} units in stock.`,
            suggestion: 'Dispose or write-off all stock first.',
        };
    }

    // Check for customer allocation history
    const { count, error: countError } = await supabase
        .from('inventory_movements')
        .select('id', { count: 'exact', head: true })
        .eq('inventory_item_id', itemId)
        .in('reference_type', ['subscription', 'event']);

    if (countError) throw new Error(countError.message);

    if (count && count > 0) {
        return {
            canDelete: false,
            reason: `Item "${item.name}" has ${count} customer allocation(s) in history.`,
            suggestion: 'Use DISCONTINUE instead to preserve audit trail.',
        };
    }

    return { canDelete: true };
}

/**
 * Delete inventory item (V2)
 * Pre-checks before attempting delete
 */
export async function deleteItemV2(
    userId: string,
    itemId: string
): Promise<{ success: boolean; message: string }> {
    const { role } = await getUserRoleAndStatus(userId);

    // Only admin can delete
    if (role !== 'admin') {
        throw new Error('Only admins can delete inventory items');
    }

    // Pre-check
    const canDeleteResult = await canDeleteItem(itemId);

    if (!canDeleteResult.canDelete) {
        throw new Error(`${canDeleteResult.reason} ${canDeleteResult.suggestion}`);
    }

    // Attempt delete
    const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Item deleted successfully' };
}

// ================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ================================================================
// These functions convert old calls to V2 format

export {
    createStockInV2 as createStockIn,
    allocateInventoryV2 as allocateInventory,
    returnInventoryV2 as returnInventory,
    adjustInventoryV2 as adjustInventory,
};
