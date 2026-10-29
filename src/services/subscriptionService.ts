import { supabase } from '@/lib/supabase';
import { countErrorMessage } from '@/utils/query';
import type {
  Subscription,
  SubscriptionFilters,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '@/types';
import {
  calculateNextBillingDate,
  calculateNextBillingDateFromToday,
  isDateInPast,
  getTodayISO,
} from '@/utils/billingDate';
import { getClientById, getUserRole, getAssignedOutletIds } from './clientService';

// ================================================================
// SUBSCRIPTION SERVICE
// ================================================================
// All CRUD operations for subscriptions with role-based access control
// Includes pause, resume, and cancel functionality
// ================================================================

const CONCURRENT_CHANGE_MESSAGE = 'Subscription was changed by someone else, please reload';

/**
 * Standard Dishware Kit entry. The kit is a PLAN only: it is stored inside
 * `questionnaire.standard_kit` and never moves stock. Dishes are dispatched
 * through Inventory > Allocate, which writes the movement ledger.
 */
export interface SubscriptionKitItem {
  inventory_item_id: string;
  item_name: string | null;
  quantity: number;
}

/** Read the planned dishware kit from a subscription (empty when none). */
export function getSubscriptionKit(subscription: Pick<Subscription, 'questionnaire'>): SubscriptionKitItem[] {
  const raw: unknown = subscription.questionnaire?.standard_kit;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (k): k is SubscriptionKitItem =>
      typeof k === 'object' && k !== null &&
      typeof (k as SubscriptionKitItem).inventory_item_id === 'string' &&
      typeof (k as SubscriptionKitItem).quantity === 'number'
  );
}

/**
 * Get all subscriptions with filters (role-based)
 * - Admin/Accountant: See all subscriptions
 * - Manager: See only assigned outlet subscriptions
 */
export async function getSubscriptions(
  userId: string,
  filters: SubscriptionFilters = {}
): Promise<Subscription[]> {
  const role = await getUserRole(userId);

  let query = supabase
    .from('subscriptions')
    .select(`
      *,
      clients (
        id,
        name,
        client_type,
        phone,
        outlets (id, name, code)
      ),
      outlets (
        id,
        name,
        code,
        city
      )
    `)
    .order('created_at', { ascending: false });

  // Role-based outlet filtering
  if (role === 'manager') {
    // Managers only see their assigned outlet subscriptions
    const outletIds = await getAssignedOutletIds(userId);
    if (outletIds.length === 0) {
      // Manager has no outlets assigned
      return [];
    }
    query = query.in('outlet_id', outletIds);
  }

  // Optional specific-outlet filter (managers stay limited to their outlets above)
  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  // Status filter
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  // Client filter
  if (filters.client_id) {
    query = query.eq('client_id', filters.client_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      clients (
        id,
        name,
        client_type,
        phone,
        email,
        outlets (id, name, code)
      ),
      outlets (
        id,
        name,
        code,
        city,
        state
      )
    `)
    .eq('id', subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data; // null when not found or no access
}

/**
 * Whether the subscription's price is locked by finalized/paid invoices.
 *
 * Invoices raised from the subscription carry invoices.subscription_id
 * (migration 042), so those are matched directly. Older rows have
 * subscription_id NULL; for them, subscription invoices of the same client
 * created after this subscription was created still count (invoices older
 * than the subscription cannot belong to it).
 * Throws on query errors so callers can stay conservative.
 */
export async function isSubscriptionPriceLocked(
  subscription: Pick<Subscription, 'id' | 'client_id' | 'created_at'>
): Promise<boolean> {
  const billed = () =>
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_type', 'subscription')
      .in('status', ['finalized', 'partially_paid', 'paid']);

  const [linked, legacy] = await Promise.all([
    billed().eq('subscription_id', subscription.id),
    billed()
      .is('subscription_id', null)
      .eq('client_id', subscription.client_id)
      .gte('created_at', subscription.created_at),
  ]);

  for (const res of [linked, legacy]) {
    if (res.error) {
      throw new Error(`Failed to check invoices: ${countErrorMessage(res.error, res.status, 'invoices')}`);
    }
  }

  return (linked.count ?? 0) + (legacy.count ?? 0) > 0;
}

/**
 * Create new subscription
 *
 * V1 COMMERCIAL LAYER:
 * - price_per_unit: Manual entry, REQUIRED
 * - notes: REQUIRED (for pricing justification)
 * - questionnaire: Optional reference data
 * - inventoryItems: Optional dishware kit PLAN (stored in questionnaire.standard_kit,
 *   never written to inventory_allocations, never moves stock)
 *
 * LOCKED RULES ENFORCED:
 * - Client must be active and corporate
 * - Client outlet must match subscription outlet
 * - Admin can create past-dated subscriptions
 * - Manager cannot create past-dated subscriptions
 */
export async function createSubscription(
  userId: string,
  input: CreateSubscriptionInput
): Promise<Subscription> {
  const role = await getUserRole(userId);

  // Only admins and managers can create subscriptions
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to create subscriptions');
  }

  // Validate required fields
  if (!input.outlet_id) {
    throw new Error('Outlet is required');
  }

  if (!input.client_id) {
    throw new Error('Client is required');
  }

  if (!input.billing_cycle) {
    throw new Error('Billing cycle is required');
  }

  if (!input.start_date) {
    throw new Error('Start date is required');
  }

  if (!input.quantity || input.quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  // V1: Manual pricing - price is required
  if (input.price_per_unit === undefined || input.price_per_unit < 0) {
    throw new Error('Price per unit is required and must be 0 or greater');
  }

  // V1: Notes required for pricing justification
  if (!input.notes || input.notes.trim().length === 0) {
    throw new Error('Notes/reason is required for pricing justification');
  }

  // Validate billing day for monthly
  if (input.billing_cycle === 'monthly') {
    if (!input.billing_day || input.billing_day < 1 || input.billing_day > 28) {
      throw new Error('Billing day must be between 1 and 28 for monthly billing');
    }
  }

  // LOCKED RULE: Manager cannot create past-dated subscriptions
  if (role === 'manager' && isDateInPast(input.start_date)) {
    throw new Error('Managers cannot create subscriptions with past start dates');
  }

  // Validate client exists, is active and is corporate
  const client = await getClientById(input.client_id);
  if (!client) {
    throw new Error('Client not found');
  }

  if (!client.is_active) {
    throw new Error('Client is inactive. Reactivate the client before creating a subscription.');
  }

  if (client.client_type !== 'corporate') {
    throw new Error('Only corporate clients can have subscriptions. This client is an event client.');
  }

  // Validate outlet matching
  if (client.outlet_id !== input.outlet_id) {
    throw new Error('Client does not belong to the selected outlet');
  }

  // If manager, verify outlet is in their assigned outlets
  if (role === 'manager') {
    const allowedOutlets = await getAssignedOutletIds(userId);
    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create subscriptions for your assigned outlets');
    }
  }

  // V1: Standard Dishware Kit, stored as a plan only (see SubscriptionKitItem)
  const kit: SubscriptionKitItem[] = (input.inventoryItems || [])
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      inventory_item_id: item.inventoryItemId,
      item_name: item.itemName ?? null,
      quantity: Math.floor(item.quantity),
    }));

  if (kit.length > 0) {
    // Every kit item must exist in the subscription's outlet
    const { data: kitItems, error: kitError } = await supabase
      .from('inventory_items')
      .select('id, name')
      .eq('outlet_id', input.outlet_id)
      .in('id', kit.map((k) => k.inventory_item_id));

    if (kitError) {
      throw new Error(`Failed to check dishware kit items: ${kitError.message}`);
    }

    const found = new Map((kitItems || []).map((i) => [i.id as string, i.name as string]));
    const missing = kit.filter((k) => !found.has(k.inventory_item_id));
    if (missing.length > 0) {
      throw new Error('Some dishware kit items do not belong to the selected outlet. Please re-select them.');
    }
    kit.forEach((k) => {
      k.item_name = found.get(k.inventory_item_id) ?? k.item_name;
    });
  }

  const questionnaire =
    input.questionnaire || kit.length > 0
      ? { ...(input.questionnaire || {}), ...(kit.length > 0 ? { standard_kit: kit } : {}) }
      : null;

  // Calculate next_billing_date
  const nextBillingDate = calculateNextBillingDate(
    input.start_date,
    input.billing_cycle,
    input.billing_day
  );

  // Insert subscription (created_by will be set automatically by trigger)
  // V1: questionnaire (and kit plan) is stored for reference only
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      outlet_id: input.outlet_id,
      client_id: input.client_id,
      billing_cycle: input.billing_cycle,
      // IMPORTANT: billing_day must be null for non-monthly, valid (1-28) for monthly
      billing_day: input.billing_cycle === 'monthly' ? input.billing_day : null,
      start_date: input.start_date,
      quantity: input.quantity,
      price_per_unit: input.price_per_unit,
      next_billing_date: nextBillingDate,
      notes: input.notes.trim(),
      questionnaire,
      status: 'active',
    })
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .maybeSingle();

  if (error) {
    // Convert database constraint errors to user-friendly messages
    if (error.message.includes('subscriptions_check') ||
      error.message.includes('check constraint')) {
      if (error.message.includes('billing_day')) {
        throw new Error('Billing day must be between 1 and 28 for monthly subscriptions');
      }
      if (error.message.includes('end_date')) {
        throw new Error('End date must be on or after start date');
      }
      if (error.message.includes('quantity')) {
        throw new Error('Quantity must be greater than 0');
      }
      if (error.message.includes('price_per_unit')) {
        throw new Error('Price per unit must be 0 or greater');
      }
      // Generic check constraint message
      throw new Error(
        'Subscription data validation failed. Please check: ' +
        '1) Billing day is 1-28 for monthly cycle, ' +
        '2) Quantity is positive, ' +
        '3) Price is non-negative'
      );
    }
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Subscription could not be created');
  }

  return data;
}

/**
 * Update subscription
 *
 * V1 COMMERCIAL LAYER:
 * - Price change BLOCKED if finalized invoices exist
 * - price_change_reason REQUIRED when changing price
 * - Reason is passed to DB trigger via session variable
 *
 * LOCKED RULES:
 * - Cancelled subscriptions cannot be modified
 * - Managers cannot change outlet_id or client_id (enforced by trigger)
 * - Price/quantity changes affect ONLY future invoices
 * - next_billing_date is recomputed only when the cycle or billing day changes
 */
export async function updateSubscription(
  userId: string,
  subscriptionId: string,
  updates: UpdateSubscriptionInput
): Promise<Subscription> {
  const role = await getUserRole(userId);

  // Only admins and managers can update subscriptions
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to update subscriptions');
  }

  // Managers cannot change outlet_id or client_id
  if (role === 'manager') {
    if (updates.outlet_id !== undefined) {
      throw new Error('Only admins can change outlet assignment');
    }
    if (updates.client_id !== undefined) {
      throw new Error('Only admins can change client assignment');
    }
  }

  // Get current subscription for validation
  const current = await getSubscriptionById(subscriptionId);
  if (!current) {
    throw new Error('Subscription not found');
  }

  if (current.status === 'cancelled') {
    throw new Error('Cancelled subscriptions cannot be modified');
  }

  if (updates.quantity !== undefined && !(updates.quantity > 0)) {
    throw new Error('Quantity must be greater than 0');
  }

  if (updates.price_per_unit !== undefined && !(updates.price_per_unit >= 0)) {
    throw new Error('Price per unit must be 0 or greater');
  }

  // V1: Pricing notes are mandatory at create, so they cannot be blanked later
  if (updates.notes !== undefined && !updates.notes.trim()) {
    throw new Error('Pricing notes / justification is required');
  }

  // V1: Price change validation
  const isPriceChanging = updates.price_per_unit !== undefined &&
    updates.price_per_unit !== current.price_per_unit;

  if (isPriceChanging) {
    // Block price change if finalized/paid invoices exist
    if (await isSubscriptionPriceLocked(current)) {
      throw new Error(
        'Cannot change price: finalized invoices exist for this client\'s subscription billing. ' +
        'Price changes are only allowed before invoices are finalized.'
      );
    }

    // Require price_change_reason when price changes
    if (!updates.price_change_reason || updates.price_change_reason.trim().length === 0) {
      throw new Error('Price change reason is required when updating the price');
    }
  }

  // Billing schedule
  const newCycle = updates.billing_cycle ?? current.billing_cycle;
  const newBillingDay = updates.billing_day !== undefined ? updates.billing_day : current.billing_day;
  const cycleChanged = updates.billing_cycle !== undefined && updates.billing_cycle !== current.billing_cycle;
  const dayChanged = updates.billing_day !== undefined && (updates.billing_day ?? null) !== current.billing_day;

  if (newCycle === 'monthly' && (!newBillingDay || newBillingDay < 1 || newBillingDay > 28)) {
    throw new Error('Billing day must be between 1 and 28 for monthly billing');
  }

  // Build update object
  // IMPORTANT: Include price_change_reason in payload - trigger will read it and clear it
  const updateData: Record<string, unknown> = { ...updates };

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes.trim();
  }

  // billing_day is meaningful only for monthly cycles
  if (newCycle !== 'monthly' && (updates.billing_day !== undefined || current.billing_day !== null)) {
    updateData.billing_day = null;
  }

  // Recompute next_billing_date only when the schedule actually changed
  if (cycleChanged || dayChanged) {
    const today = getTodayISO();
    const anchor = current.start_date > today ? current.start_date : today;
    updateData.next_billing_date = calculateNextBillingDate(
      anchor,
      newCycle,
      newCycle === 'monthly' ? newBillingDay ?? undefined : undefined
    );
  }

  // Trim price_change_reason if present; drop it when the price is not changing
  if (isPriceChanging && updates.price_change_reason) {
    updateData.price_change_reason = updates.price_change_reason.trim();
  } else {
    delete updateData.price_change_reason;
  }

  if (Object.keys(updateData).length === 0) {
    return current; // Nothing to change
  }

  // Update subscription
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscriptionId)
    .neq('status', 'cancelled')
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(CONCURRENT_CHANGE_MESSAGE);
  }

  return data;
}

/**
 * Pause subscription
 * - Sets status to 'paused'
 * - Does NOT set end_date (can be resumed)
 */
export async function pauseSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Only admins and managers can pause subscriptions
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to pause subscriptions');
  }

  // Verify subscription exists and is active
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status !== 'active') {
    throw new Error('Only active subscriptions can be paused');
  }

  // Pause subscription (conditional on status, so a concurrent change is not overwritten)
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused' })
    .eq('id', subscriptionId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(CONCURRENT_CHANGE_MESSAGE);
  }
}

/**
 * Resume subscription
 * - Sets status to 'active'
 * - Recalculates next_billing_date from today
 */
export async function resumeSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Only admins and managers can resume subscriptions
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to resume subscriptions');
  }

  // Verify subscription exists and is paused
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status !== 'paused') {
    throw new Error('Only paused subscriptions can be resumed');
  }

  // LOCKED RULE: Recalculate next_billing_date from today
  const nextBillingDate = calculateNextBillingDateFromToday(
    subscription.billing_cycle,
    subscription.billing_day || undefined
  );

  // Resume subscription (conditional on status)
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      next_billing_date: nextBillingDate,
    })
    .eq('id', subscriptionId)
    .eq('status', 'paused')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(CONCURRENT_CHANGE_MESSAGE);
  }
}

/**
 * Cancel subscription
 * - Sets status to 'cancelled'
 * - Sets end_date (permanent); never earlier than start_date
 * - CANNOT be undone
 */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  cancellationDate?: string
): Promise<void> {
  const role = await getUserRole(userId);

  // Only admins and managers can cancel subscriptions
  if (!(role === 'admin' || role === 'manager')) {
    throw new Error('You do not have permission to cancel subscriptions');
  }

  // Verify subscription exists and is not already cancelled
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status === 'cancelled') {
    throw new Error('Subscription is already cancelled');
  }

  // Use provided date or today, but never before the start date
  // (CHECK end_date >= start_date; ISO date strings compare correctly as text)
  let endDate = cancellationDate || getTodayISO();
  if (endDate < subscription.start_date) {
    endDate = subscription.start_date;
  }

  // Cancel subscription (permanent, conditional on status)
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      end_date: endDate,
    })
    .eq('id', subscriptionId)
    .in('status', ['active', 'paused'])
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.message.includes('check constraint') && error.message.includes('end_date')) {
      throw new Error('End date cannot be before the start date');
    }
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(CONCURRENT_CHANGE_MESSAGE);
  }
}

interface PriceHistoryRow {
  id: string;
  subscription_id: string;
  old_price: number;
  new_price: number;
  changed_by: string | null;
  reason: string;
  created_at: string;
  changed_by_name?: string | null;
  user_profiles?: { full_name: string | null } | null;
}

/**
 * Get subscription price change history
 *
 * V1 COMMERCIAL LAYER:
 * - Returns audit trail of all price changes
 * - Includes who changed it and why
 */
export async function getSubscriptionPriceHistory(
  subscriptionId: string
): Promise<Array<{
  id: string;
  subscription_id: string;
  old_price: number;
  new_price: number;
  changed_by: string | null;
  reason: string;
  created_at: string;
  changed_by_name?: string;
}>> {
  const { data, error } = await supabase
    .from('subscription_price_history')
    .select(`
      *,
      user_profiles!subscription_price_history_changed_by_fkey (
        full_name
      )
    `)
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch price history: ${error.message}`);
  }

  // Prefer the stored name snapshot (readable by every role once migration 042
  // adds changed_by_name); fall back to the profile embed, which RLS limits.
  return ((data || []) as PriceHistoryRow[]).map((row) => ({
    id: row.id,
    subscription_id: row.subscription_id,
    old_price: row.old_price,
    new_price: row.new_price,
    changed_by: row.changed_by,
    reason: row.reason,
    created_at: row.created_at,
    changed_by_name: row.changed_by_name || row.user_profiles?.full_name || undefined,
  }));
}
