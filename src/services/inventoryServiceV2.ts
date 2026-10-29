import { supabase } from '@/lib/supabase';
import type { InventoryItem, InventoryFilters } from '@/types';

// ================================================================
// INVENTORY SERVICE V2 (ITEM LIFECYCLE)  
// ================================================================
// Enhanced item operations supporting:
// - lifecycle_status (draft, active, discontinued, archived)
// - opening_balance_confirmed
// - in_repair_quantity
//
// CRITICAL: Quantities are NEVER directly modified
// All stock changes go through inventoryMovementServiceV2
// ================================================================

export type LifecycleStatus = 'draft' | 'active' | 'discontinued' | 'archived';

export interface InventoryItemV2 extends InventoryItem {
    lifecycle_status: LifecycleStatus;
    opening_balance_confirmed: boolean;
    in_repair_quantity: number;
}

export interface InventoryFiltersV2 extends InventoryFilters {
    lifecycle_status?: LifecycleStatus | LifecycleStatus[];
    opening_balance_confirmed?: boolean;
}

export interface CreateInventoryItemV2Input {
    outlet_id: string;
    name: string;
    category: string;
    material?: string;
    unit?: string;
    initial_stock?: number;
    lifecycle_status?: 'draft' | 'active'; // Only draft or active on create
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

async function getUserRoleAndOutlets(userId: string): Promise<{
    role: string;
    outletIds: string[] | null;
}> {
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (!profile) {
        throw new Error('User profile not found');
    }

    if (profile.role === 'manager') {
        const { data: assignments } = await supabase
            .from('user_outlet_assignments')
            .select('outlet_id')
            .eq('user_id', userId);

        const outletIds = assignments?.map(a => a.outlet_id) || [];
        return { role: profile.role, outletIds };
    }

    return { role: profile.role, outletIds: null };
}

// ================================================================
// GET FUNCTIONS (V2)
// ================================================================

/**
 * Get inventory items with V2 filters (lifecycle_status aware)
 */
export async function getInventoryItemsV2(
    _userId: string,
    filters: InventoryFiltersV2 = {}
): Promise<InventoryItemV2[]> {
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

    // Apply outlet filter
    if (filters.outlet_id) {
        query = query.eq('outlet_id', filters.outlet_id);
    }

    // Apply category filter
    if (filters.category) {
        query = query.eq('category', filters.category);
    }

    // Apply lifecycle_status filter (V2)
    if (filters.lifecycle_status) {
        if (Array.isArray(filters.lifecycle_status)) {
            query = query.in('lifecycle_status', filters.lifecycle_status);
        } else {
            query = query.eq('lifecycle_status', filters.lifecycle_status);
        }
    } else if (filters.is_active !== undefined && filters.is_active !== 'all') {
        // Backward compatibility: is_active maps to lifecycle_status
        if (filters.is_active) {
            query = query.in('lifecycle_status', ['draft', 'active']);
        } else {
            query = query.in('lifecycle_status', ['discontinued', 'archived']);
        }
    } else if (filters.is_active !== 'all') {
        // Default: show draft, active, discontinued (not archived)
        query = query.in('lifecycle_status', ['draft', 'active', 'discontinued']);
    }

    // Apply opening_balance_confirmed filter
    if (filters.opening_balance_confirmed !== undefined) {
        query = query.eq('opening_balance_confirmed', filters.opening_balance_confirmed);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    type Row = InventoryItemV2 & { outlets?: { name?: string; code?: string } | null };
    return ((data || []) as Row[]).map((item) => ({
        ...item,
        outlet_name: item.outlets?.name,
        outlet_code: item.outlets?.code,
    }));
}

/**
 * Get items available for allocation (active items only)
 */
export async function getItemsForAllocation(
    userId: string,
    outletId: string
): Promise<InventoryItemV2[]> {
    return getInventoryItemsV2(userId, {
        outlet_id: outletId,
        lifecycle_status: 'active',
    });
}

/**
 * Get single inventory item with V2 fields
 */
export async function getInventoryItemByIdV2(
    _userId: string,
    itemId: string
): Promise<InventoryItemV2> {
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
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Inventory item not found');

    return {
        ...data,
        outlet_name: data.outlets?.name,
        outlet_code: data.outlets?.code,
    };
}

// ================================================================
// CREATE FUNCTIONS (V2)
// ================================================================

/**
 * Create new inventory item (V2)
 * Supports lifecycle_status on creation
 */
export async function createInventoryItemV2(
    userId: string,
    input: CreateInventoryItemV2Input
): Promise<InventoryItemV2> {
    const { role, outletIds } = await getUserRoleAndOutlets(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot create inventory items');
    }

    if (role === 'manager') {
        if (!outletIds || !outletIds.includes(input.outlet_id)) {
            throw new Error('You can only create items for your assigned outlets');
        }
    }

    // Validate initial stock
    if (input.initial_stock && input.initial_stock < 0) {
        throw new Error('Initial stock cannot be negative');
    }

    // Determine starting lifecycle_status
    const lifecycleStatus = input.lifecycle_status || 'draft';

    // Create item with zero quantities
    const { data: item, error: itemError } = await supabase
        .from('inventory_items')
        .insert({
            outlet_id: input.outlet_id,
            name: input.name,
            category: input.category,
            material: input.material || null,
            unit: input.unit || 'pcs',
            // All quantities start at 0
            total_quantity: 0,
            available_quantity: 0,
            allocated_quantity: 0,
            damaged_quantity: 0,
            in_repair_quantity: 0,
            lost_quantity: 0,
            // V2 fields
            lifecycle_status: lifecycleStatus,
            opening_balance_confirmed: false, // Always starts unlocked
            is_active: true, // On creation, items are always active (draft or active status)
            created_by: userId,
        })
        .select()
        .maybeSingle();

    if (itemError) throw new Error(itemError.message);

    // If initial stock > 0, create stock_in movement
    if (input.initial_stock && input.initial_stock > 0) {
        const { createStockInV2 } = await import('./inventoryMovementServiceV2');
        await createStockInV2(userId, {
            outlet_id: input.outlet_id,
            inventory_item_id: item.id,
            quantity: input.initial_stock,
            reason_code: 'opening_balance',
            notes: 'Initial stock on item creation',
        });
    }

    return getInventoryItemByIdV2(userId, item.id);
}

// ================================================================
// LIFECYCLE TRANSITION FUNCTIONS
// ================================================================

/**
 * Discontinue an item (no new allocations, but can still receive returns)
 */
export async function discontinueItemV2(
    userId: string,
    itemId: string
): Promise<InventoryItemV2> {
    const { role } = await getUserRoleAndOutlets(userId);

    if (role === 'accountant') {
        throw new Error('Accountants cannot discontinue items');
    }

    const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('lifecycle_status, allocated_quantity')
        .eq('id', itemId)
        .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!item) throw new Error('Item not found');

    if (item.lifecycle_status === 'archived') {
        throw new Error('Archived items cannot be modified');
    }

    if (item.lifecycle_status === 'discontinued') {
        return getInventoryItemByIdV2(userId, itemId);
    }

    // Check for outstanding allocations
    if (item.allocated_quantity > 0) {
        throw new Error(`Cannot discontinue item with ${item.allocated_quantity} units still allocated. Resolve allocations first.`);
    }

    const { error } = await supabase
        .from('inventory_items')
        .update({ lifecycle_status: 'discontinued' })
        .eq('id', itemId);

    if (error) throw new Error(error.message);

    return getInventoryItemByIdV2(userId, itemId);
}

// activateItem, archiveItem, confirmOpeningBalance, getLifecycleSummary and
// getItemsNeedingAttention were removed: they had no callers.

// ================================================================
// BACKWARD COMPATIBILITY
// ================================================================

export {
    getInventoryItemsV2 as getInventoryItems,
    getInventoryItemByIdV2 as getInventoryItemById,
    createInventoryItemV2 as createInventoryItem,
    discontinueItemV2 as deactivateInventoryItem,
};
