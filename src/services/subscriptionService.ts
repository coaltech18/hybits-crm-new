import { supabase } from '@/lib/supabase';
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
import { getClientById } from './clientService';

// ================================================================
// SUBSCRIPTION SERVICE
// ================================================================
// All CRUD operations for subscriptions with role-based access control
// Includes pause, resume, and cancel functionality
// ================================================================

/**
 * Get all subscriptions with filters (role-based)
 * - Admin/Accountant: See all subscriptions
 * - Manager: See only assigned outlet subscriptions
 */
export async function getSubscriptions(
  userId: string,
  filters: SubscriptionFilters = {}
): Promise<Subscription[]> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

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
  if (profile.role === 'manager') {
    // Managers only see their assigned outlet subscriptions
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignments && assignments.length > 0) {
      const outletIds = assignments.map(a => a.outlet_id);
      query = query.in('outlet_id', outletIds);
    } else {
      // Manager has no outlets assigned, return empty array
      return [];
    }
  }

  // Admin/Accountant can optionally filter by specific outlet
  if (filters.outlet_id && ['admin', 'accountant'].includes(profile.role)) {
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
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found or no access
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create new subscription
 * 
 * V1 COMMERCIAL LAYER:
 * - price_per_unit: Manual entry, REQUIRED
 * - notes: REQUIRED (for pricing justification)
 * - questionnaire: Optional reference data
 * 
 * LOCKED RULES ENFORCED:
 * - Client must be corporate
 * - Client outlet must match subscription outlet
 * - Admin can create past-dated subscriptions
 * - Manager cannot create past-dated subscriptions
 */
export async function createSubscription(
  userId: string,
  input: CreateSubscriptionInput
): Promise<Subscription> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot create subscriptions
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to create subscriptions');
  }

  // Validate required fields
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
  if (profile.role === 'manager' && isDateInPast(input.start_date)) {
    throw new Error('Managers cannot create subscriptions with past start dates');
  }

  // Validate client exists and is corporate
  const client = await getClientById(input.client_id);
  if (!client) {
    throw new Error('Client not found');
  }

  if (client.client_type !== 'corporate') {
    throw new Error('Only corporate clients can have subscriptions. This client is an event client.');
  }

  // Validate outlet matching
  if (client.outlet_id !== input.outlet_id) {
    throw new Error('Client does not belong to the selected outlet');
  }

  // If manager, verify outlet is in their assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];

    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create subscriptions for your assigned outlets');
    }
  }

  // Calculate next_billing_date
  const nextBillingDate = calculateNextBillingDate(
    input.start_date,
    input.billing_cycle,
    input.billing_day
  );

  // Insert subscription (created_by will be set automatically by trigger)
  // V1: questionnaire is stored for reference only
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
      questionnaire: input.questionnaire || null,
      status: 'active',
    })
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .single();

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

  // V1: Create inventory allocations (Standard Dishware Kit)
  // This is for operational planning only, does NOT affect pricing
  if (input.inventoryItems && input.inventoryItems.length > 0) {
    const allocations = input.inventoryItems
      .filter(item => item.quantity > 0)
      .map(item => ({
        outlet_id: input.outlet_id,
        inventory_item_id: item.inventoryItemId,
        reference_type: 'subscription' as const,
        reference_id: data.id,
        allocated_quantity: item.quantity,
        is_active: true,
      }));

    if (allocations.length > 0) {
      const { error: allocationError } = await supabase
        .from('inventory_allocations')
        .insert(allocations);

      if (allocationError) {
        // Log but don't fail - inventory is optional for ops planning
        console.warn('Failed to create inventory allocations:', allocationError.message);
      }
    }
  }

  return data;
}

/**
 * Update subscription
 * 
 * V1 COMMERCIAL LAYER:
 * - Price change BLOCKED if issued invoices exist
 * - price_change_reason REQUIRED when changing price
 * - Reason is passed to DB trigger via session variable
 * 
 * LOCKED RULES:
 * - Managers cannot change outlet_id or client_id (enforced by trigger)
 * - Price/quantity changes affect ONLY future invoices
 */
export async function updateSubscription(
  userId: string,
  subscriptionId: string,
  updates: UpdateSubscriptionInput
): Promise<Subscription> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot update subscriptions
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to update subscriptions');
  }

  // Managers cannot change outlet_id or client_id
  if (profile.role === 'manager') {
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

  // V1: Price change validation
  const isPriceChanging = updates.price_per_unit !== undefined &&
    updates.price_per_unit !== current.price_per_unit;

  if (isPriceChanging) {
    // Check if issued invoices exist for this subscription
    const { count: issuedInvoiceCount, error: countError } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_type', 'subscription')
      .eq('client_id', current.client_id)
      .eq('status', 'issued');

    if (countError) {
      throw new Error(`Failed to check invoices: ${countError.message}`);
    }

    // Block price change if any issued invoices exist
    if (issuedInvoiceCount && issuedInvoiceCount > 0) {
      throw new Error(
        'Cannot change price: issued invoices exist for this subscription. ' +
        'Price changes are only allowed before invoices are issued.'
      );
    }

    // Require price_change_reason when price changes
    if (!updates.price_change_reason || updates.price_change_reason.trim().length === 0) {
      throw new Error('Price change reason is required when updating the price');
    }
  }

  // If billing_cycle or billing_day changed, recalculate next_billing_date
  let nextBillingDate: string | undefined;
  if (updates.billing_cycle || updates.billing_day !== undefined) {
    const newCycle = updates.billing_cycle || current.billing_cycle;
    const newBillingDay = updates.billing_day !== undefined ? updates.billing_day : current.billing_day;

    nextBillingDate = calculateNextBillingDate(
      current.next_billing_date,
      newCycle,
      newBillingDay || undefined
    );
  }

  // Build update object
  // IMPORTANT: Include price_change_reason in payload - trigger will read it and clear it
  const updateData: any = { ...updates };
  if (nextBillingDate) {
    updateData.next_billing_date = nextBillingDate;
  }

  // Trim price_change_reason if present
  if (updateData.price_change_reason) {
    updateData.price_change_reason = updateData.price_change_reason.trim();
  }

  // Update subscription
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscriptionId)
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city)
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Pause subscription
 * - Sets status to 'paused'
 * - Does NOT set end_date (can be resumed)
 * - Stops invoice generation
 */
export async function pauseSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot pause subscriptions
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to pause subscriptions');
  }

  // Verify subscription exists and is active
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status !== 'active') {
    throw new Error('Only active subscriptions can be paused');
  }

  // Pause subscription
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused' })
    .eq('id', subscriptionId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Resume subscription
 * - Sets status to 'active'
 * - Recalculates next_billing_date from today
 * - Restarts invoice generation
 */
export async function resumeSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot resume subscriptions
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to resume subscriptions');
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

  // Resume subscription
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      next_billing_date: nextBillingDate,
    })
    .eq('id', subscriptionId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Cancel subscription
 * - Sets status to 'cancelled'
 * - Sets end_date (permanent)
 * - Stops invoice generation permanently
 * - CANNOT be undone
 */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  cancellationDate?: string
): Promise<void> {
  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot cancel subscriptions
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to cancel subscriptions');
  }

  // Verify subscription exists and is not already cancelled
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status === 'cancelled') {
    throw new Error('Subscription is already cancelled');
  }

  // Use provided date or today
  const endDate = cancellationDate || getTodayISO();

  // Cancel subscription (permanent)
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      end_date: endDate,
    })
    .eq('id', subscriptionId);

  if (error) {
    throw new Error(error.message);
  }
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

  // Transform to flatten user profile
  return (data || []).map((row: any) => ({
    id: row.id,
    subscription_id: row.subscription_id,
    old_price: row.old_price,
    new_price: row.new_price,
    changed_by: row.changed_by,
    reason: row.reason,
    created_at: row.created_at,
    changed_by_name: row.user_profiles?.full_name || null,
  }));
}
