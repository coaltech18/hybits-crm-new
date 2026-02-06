import { supabase } from '@/lib/supabase';
import { allocateInventory, returnInventory } from './inventoryMovementService';
import { createAllocation, closeAllocationsByReference } from './allocationService';

// ================================================================
// INVENTORY INTEGRATION HOOKS
// ================================================================
// CRITICAL: Automatic inventory integration with existing phases
// These hooks are called when subscription/event status changes
// ================================================================

/**
 * Get system user ID for automated operations
 * In production, you might have a dedicated system user
 * For now, we'll use the user who created the subscription/event
 */
async function getSystemUserId(referenceType: 'subscription' | 'event', referenceId: string): Promise<string> {
  if (referenceType === 'subscription') {
    const { data } = await supabase
      .from('subscriptions')
      .select('created_by')
      .eq('id', referenceId)
      .maybeSingle();

    return data?.created_by || '';
  } else {
    const { data } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', referenceId)
      .maybeSingle();

    return data?.created_by || '';
  }
}

// ================================================================
// SUBSCRIPTION HOOKS
// ================================================================

/**
 * Hook: Called when subscription becomes ACTIVE
 * 
 * LOCKED BEHAVIOR:
 * - Allocate inventory items defined for this subscription
 * - Allocation persists through 'active' and 'paused' states
 * - Only deallocated when subscription is cancelled
 * 
 * NOTE: In production, you'll need a subscription_items table
 * For now, this is a placeholder that demonstrates the pattern
 * 
 * @param subscriptionId - Subscription ID that became active
 */
export async function onSubscriptionActivated(subscriptionId: string): Promise<void> {
  try {

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, outlet_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    // TODO: In production, fetch subscription_items from a related table
    // For now, this is a placeholder
    // Example structure:
    // SELECT inventory_item_id, quantity FROM subscription_items WHERE subscription_id = subscriptionId

    // Placeholder: Log that allocation should happen
    console.log(`[INVENTORY HOOK] Subscription ${subscriptionId} activated - ready for inventory allocation`);

    // Pattern for actual implementation:
    // const { data: items } = await supabase
    //   .from('subscription_items')
    //   .select('inventory_item_id, quantity')
    //   .eq('subscription_id', subscriptionId);
    //
    // for (const item of items) {
    //   await allocateInventory(userId, {
    //     outlet_id: subscription.outlet_id,
    //     inventory_item_id: item.inventory_item_id,
    //     quantity: item.quantity,
    //     reference_type: 'subscription',
    //     reference_id: subscriptionId,
    //     notes: 'Subscription activated',
    //   });
    //
    //   await createAllocation(
    //     userId,
    //     subscription.outlet_id,
    //     item.inventory_item_id,
    //     'subscription',
    //     subscriptionId,
    //     item.quantity
    //   );
    // }
  } catch (error) {
    console.error('[INVENTORY HOOK ERROR] onSubscriptionActivated:', error);
    // Don't throw - log error but don't block subscription activation
  }
}

/**
 * Hook: Called when subscription is CANCELLED
 * 
 * LOCKED BEHAVIOR:
 * - Trigger return flow for all allocated items
 * - Close all allocations for this subscription
 * 
 * @param subscriptionId - Subscription ID that was cancelled
 */
export async function onSubscriptionCancelled(subscriptionId: string): Promise<void> {
  try {
    const userId = await getSystemUserId('subscription', subscriptionId);

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, outlet_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Get all active allocations for this subscription
    const { data: allocations } = await supabase
      .from('inventory_allocations_with_details')
      .select('*')
      .eq('reference_type', 'subscription')
      .eq('reference_id', subscriptionId)
      .eq('is_active', true);

    if (!allocations || allocations.length === 0) {
      console.log(`[INVENTORY HOOK] No allocations found for subscription ${subscriptionId}`);
      return;
    }

    // Return all outstanding items
    for (const allocation of allocations) {
      const outstanding = allocation.outstanding_quantity || 0;

      if (outstanding > 0) {
        await returnInventory(userId, {
          outlet_id: subscription.outlet_id,
          inventory_item_id: allocation.inventory_item_id,
          quantity: outstanding,
          reference_type: 'subscription',
          reference_id: subscriptionId,
          notes: 'Subscription cancelled - auto return',
        });
      }
    }

    // Close all allocations
    await closeAllocationsByReference(userId, 'subscription', subscriptionId);

    console.log(`[INVENTORY HOOK] Subscription ${subscriptionId} cancelled - inventory returned and allocations closed`);
  } catch (error) {
    console.error('[INVENTORY HOOK ERROR] onSubscriptionCancelled:', error);
    // Don't throw - log error but don't block subscription cancellation
  }
}

// ================================================================
// EVENT HOOKS
// ================================================================

/**
 * Hook: Called when event status becomes PLANNED
 * 
 * LOCKED BEHAVIOR:
 * - Allocate inventory BEFORE the event (dishes go before event happens)
 * - Allocation is temporary (must return after event)
 * 
 * NOTE: In production, you'll need an event_items table
 * For now, this is a placeholder that demonstrates the pattern
 * 
 * @param eventId - Event ID that was planned
 */
export async function onEventPlanned(eventId: string): Promise<void> {
  try {

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, outlet_id')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // TODO: In production, fetch event_items from a related table
    // For now, this is a placeholder
    console.log(`[INVENTORY HOOK] Event ${eventId} planned - ready for inventory allocation`);

    // Pattern for actual implementation:
    // const { data: items } = await supabase
    //   .from('event_items')
    //   .select('inventory_item_id, quantity')
    //   .eq('event_id', eventId);
    //
    // for (const item of items) {
    //   await allocateInventory(userId, {
    //     outlet_id: event.outlet_id,
    //     inventory_item_id: item.inventory_item_id,
    //     quantity: item.quantity,
    //     reference_type: 'event',
    //     reference_id: eventId,
    //     notes: 'Event planned',
    //   });
    //
    //   await createAllocation(
    //     userId,
    //     event.outlet_id,
    //     item.inventory_item_id,
    //     'event',
    //     eventId,
    //     item.quantity
    //   );
    // }
  } catch (error) {
    console.error('[INVENTORY HOOK ERROR] onEventPlanned:', error);
    // Don't throw - log error but don't block event planning
  }
}

/**
 * Hook: Called when event status becomes COMPLETED
 * 
 * LOCKED BEHAVIOR:
 * - Trigger return flow (can be partial with damage/loss)
 * - User must manually process returns, damages, and losses
 * - This hook just logs - actual processing happens in UI
 * 
 * @param eventId - Event ID that was completed
 */
export async function onEventCompleted(eventId: string): Promise<void> {
  try {
    // Get allocations for this event
    const { data: allocations } = await supabase
      .from('inventory_allocations_with_details')
      .select('*')
      .eq('reference_type', 'event')
      .eq('reference_id', eventId)
      .eq('is_active', true);

    if (!allocations || allocations.length === 0) {
      console.log(`[INVENTORY HOOK] No allocations found for event ${eventId}`);
      return;
    }

    console.log(`[INVENTORY HOOK] Event ${eventId} completed - ${allocations.length} allocations need return/damage/loss processing`);

    // In production, you might:
    // - Send notification to user
    // - Show pending returns in UI
    // - Auto-return if configured
  } catch (error) {
    console.error('[INVENTORY HOOK ERROR] onEventCompleted:', error);
  }
}

/**
 * Hook: Called when event is CANCELLED
 * 
 * LOCKED BEHAVIOR:
 * - Deallocate immediately (items never left the warehouse)
 * - Close allocations
 * 
 * @param eventId - Event ID that was cancelled
 */
export async function onEventCancelled(eventId: string): Promise<void> {
  try {
    const userId = await getSystemUserId('event', eventId);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, outlet_id')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Get all active allocations for this event
    const { data: allocations } = await supabase
      .from('inventory_allocations_with_details')
      .select('*')
      .eq('reference_type', 'event')
      .eq('reference_id', eventId)
      .eq('is_active', true);

    if (!allocations || allocations.length === 0) {
      console.log(`[INVENTORY HOOK] No allocations found for event ${eventId}`);
      return;
    }

    // Return all allocated items (items never left, so no damage/loss)
    for (const allocation of allocations) {
      const outstanding = allocation.outstanding_quantity || 0;

      if (outstanding > 0) {
        await returnInventory(userId, {
          outlet_id: event.outlet_id,
          inventory_item_id: allocation.inventory_item_id,
          quantity: outstanding,
          reference_type: 'event',
          reference_id: eventId,
          notes: 'Event cancelled - auto return',
        });
      }
    }

    // Close all allocations
    await closeAllocationsByReference(userId, 'event', eventId);

    console.log(`[INVENTORY HOOK] Event ${eventId} cancelled - inventory returned and allocations closed`);
  } catch (error) {
    console.error('[INVENTORY HOOK ERROR] onEventCancelled:', error);
    // Don't throw - log error but don't block event cancellation
  }
}

// ================================================================
// HELPER: Allocate items in transaction
// ================================================================

/**
 * Allocate multiple items in a single transaction
 * Used by subscription and event activation
 * 
 * @param userId - User ID performing allocation
 * @param outletId - Outlet ID
 * @param referenceType - 'subscription' or 'event'
 * @param referenceId - Subscription or Event ID
 * @param items - Array of {inventory_item_id, quantity}
 */
export async function allocateMultipleItems(
  userId: string,
  outletId: string,
  referenceType: 'subscription' | 'event',
  referenceId: string,
  items: Array<{ inventory_item_id: string; quantity: number }>
): Promise<void> {
  // Transaction: All or nothing
  try {
    for (const item of items) {
      // Create allocation movement
      await allocateInventory(userId, {
        outlet_id: outletId,
        inventory_item_id: item.inventory_item_id,
        quantity: item.quantity,
        reference_type: referenceType,
        reference_id: referenceId,
        notes: `${referenceType} allocation`,
      });

      // Create allocation record
      await createAllocation(
        userId,
        outletId,
        item.inventory_item_id,
        referenceType,
        referenceId,
        item.quantity
      );
    }
  } catch (error) {
    // If any allocation fails, all previous allocations should be manually reversed
    // In production, use Postgres transactions or Supabase RPC for atomic operations
    console.error('[INVENTORY] Allocation failed:', error);
    throw error;
  }
}
