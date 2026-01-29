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

  if (input.price_per_unit === undefined || input.price_per_unit < 0) {
    throw new Error('Price per unit must be 0 or greater');
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
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      outlet_id: input.outlet_id,
      client_id: input.client_id,
      billing_cycle: input.billing_cycle,
      billing_day: input.billing_day || null,
      start_date: input.start_date,
      quantity: input.quantity,
      price_per_unit: input.price_per_unit,
      next_billing_date: nextBillingDate,
      notes: input.notes || null,
      status: 'active',
    })
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
 * Update subscription
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

  // If billing_cycle or billing_day changed, recalculate next_billing_date
  let nextBillingDate: string | undefined;
  if (updates.billing_cycle || updates.billing_day !== undefined) {
    const current = await getSubscriptionById(subscriptionId);
    if (!current) {
      throw new Error('Subscription not found');
    }

    const newCycle = updates.billing_cycle || current.billing_cycle;
    const newBillingDay = updates.billing_day !== undefined ? updates.billing_day : current.billing_day;

    nextBillingDate = calculateNextBillingDate(
      current.next_billing_date,
      newCycle,
      newBillingDay || undefined
    );
  }

  // Build update object
  const updateData: any = { ...updates };
  if (nextBillingDate) {
    updateData.next_billing_date = nextBillingDate;
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
