import { supabase } from '@/lib/supabase';
import type {
  Payment,
  PaymentFilters,
  CreatePaymentInput,
  UpdatePaymentInput,
  InvoiceWithPaymentStatus,
} from '@/types';
import { roundCurrency, settleBalance, SETTLEMENT_TOLERANCE } from '@/utils/format';

// ================================================================
// PAYMENT SERVICE
// ================================================================
// All CRUD operations for payments with role-based access control
// Enforces overpayment prevention and invoice status validation
// ================================================================

/**
 * Get all payments with filters (role-based)
 */
export async function getPayments(
  userId: string,
  filters: PaymentFilters = {}
): Promise<Payment[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  let query = supabase
    .from('payments_with_details')
    .select('*')
    .order('payment_date', { ascending: false });

  // Role-based outlet filtering
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignments && assignments.length > 0) {
      const outletIds = assignments.map(a => a.outlet_id);
      // Filter payments by invoice outlet
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .in('outlet_id', outletIds);

      if (invoices && invoices.length > 0) {
        const invoiceIds = invoices.map(i => i.id);
        query = query.in('invoice_id', invoiceIds);
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  // Filters
  if (filters.outlet_id && ['admin', 'accountant'].includes(profile.role)) {
    // Get invoices for this outlet
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('outlet_id', filters.outlet_id);

    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      query = query.in('invoice_id', invoiceIds);
    } else {
      return [];
    }
  }

  if (filters.invoice_id) {
    query = query.eq('invoice_id', filters.invoice_id);
  }

  if (filters.payment_method) {
    query = query.eq('payment_method', filters.payment_method);
  }

  if (filters.date_from) {
    query = query.gte('payment_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('payment_date', filters.date_to);
  }

  // Show deleted payments filter
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  } else {
    // By default, show only active payments
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments_with_details')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get payments for a specific invoice
 */
export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments_with_details')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get invoice with payment status (balance, amount paid)
 */
export async function getInvoiceWithPaymentStatus(
  invoiceId: string
): Promise<InvoiceWithPaymentStatus | null> {
  const { data, error } = await supabase
    .from('invoices_with_payment_status')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  return data as InvoiceWithPaymentStatus;
}

/**
 * Create new payment
 * 
 * LOCKED RULES:
 * - No payments on draft or cancelled invoices
 * - No overpayments (enforced by DB trigger with ₹1 tolerance)
 * - Manager: Only for assigned outlet invoices
 */
export async function createPayment(
  userId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Validate required fields
  if (!input.invoice_id) {
    throw new Error('Invoice is required');
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  if (!input.payment_method) {
    throw new Error('Payment method is required');
  }

  if (!input.payment_date) {
    throw new Error('Payment date is required');
  }

  // Validate payment date not in future
  const paymentDate = new Date(input.payment_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (paymentDate > today) {
    throw new Error('Payment date cannot be in the future');
  }

  // Get invoice with payment status
  const invoice = await getInvoiceWithPaymentStatus(input.invoice_id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Check invoice status
  if (invoice.status === 'draft') {
    throw new Error('Cannot record payment for draft invoice. Issue the invoice first.');
  }

  if (invoice.status === 'cancelled') {
    throw new Error('Cannot record payment for cancelled invoice');
  }

  // Check overpayment (frontend validation) - use settlement tolerance
  if (input.amount > invoice.balance_due + SETTLEMENT_TOLERANCE) {
    throw new Error(
      `Payment amount (₹${input.amount}) exceeds balance due (₹${invoice.balance_due})`
    );
  }

  // Manager outlet check
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only record payments for your assigned outlets');
    }
  }

  // Create payment - CRITICAL: round amount to avoid floating-point drift
  const roundedAmount = roundCurrency(input.amount);

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      invoice_id: input.invoice_id,
      amount: roundedAmount,
      payment_method: input.payment_method,
      payment_date: input.payment_date,
      reference_number: input.reference_number || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  // Fetch complete payment with details
  const completePayment = await getPaymentById(payment.id);
  if (!completePayment) {
    throw new Error('Failed to fetch created payment');
  }

  return completePayment;
}

/**
 * Update payment
 * 
 * LOCKED RULES:
 * - Cannot change invoice_id
 * - Re-validates overpayment if amount changed
 * - Manager: Only for assigned outlet invoices
 */
export async function updatePayment(
  userId: string,
  paymentId: string,
  updates: UpdatePaymentInput
): Promise<Payment> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Fetch current payment
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  // Check if payment is active
  if (!payment.is_active) {
    throw new Error('Cannot edit deleted payment');
  }

  // Get invoice
  const invoice = await getInvoiceWithPaymentStatus(payment.invoice_id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Cannot edit payments for cancelled invoices
  if (invoice.status === 'cancelled') {
    throw new Error('Cannot edit payment for cancelled invoice');
  }

  // Validate payment date not in future
  if (updates.payment_date) {
    const paymentDate = new Date(updates.payment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (paymentDate > today) {
      throw new Error('Payment date cannot be in the future');
    }
  }

  // If amount is being updated, validate overpayment
  if (updates.amount !== undefined) {
    // CRITICAL: Round to avoid floating-point drift
    updates.amount = roundCurrency(updates.amount);

    if (updates.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Calculate balance if this payment amount changes - use rounded values
    const currentBalance = roundCurrency(invoice.balance_due + payment.amount); // Add back current payment
    const newBalance = settleBalance(currentBalance - updates.amount); // Subtract new payment, apply settlement

    if (newBalance < -SETTLEMENT_TOLERANCE) {
      throw new Error(
        `Updated payment amount (₹${updates.amount}) would cause overpayment. ` +
        `Available balance: ₹${currentBalance}`
      );
    }
  }

  // Manager outlet check
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only edit payments for your assigned outlets');
    }
  }

  // Update payment
  const { error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updatedPayment = await getPaymentById(paymentId);
  if (!updatedPayment) {
    throw new Error('Failed to fetch updated payment');
  }

  return updatedPayment;
}

// ================================================================
// PAYMENT DELETION - NOT ALLOWED (SOFT DELETE ONLY)
// ================================================================
// Payments are financial records and CANNOT be hard deleted.
// Use deactivatePayment() to mark as inactive (soft delete).
// The database has a BEFORE DELETE trigger that blocks hard deletes.
// ================================================================

/**
 * Deactivate payment (soft delete - set is_active = false)
 * 
 * IMPORTANT: This is a SOFT DELETE, not a hard delete.
 * The payment record remains in the database for audit purposes.
 * Deactivated payments are excluded from balance calculations.
 */
export async function deactivatePayment(userId: string, paymentId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (!payment.is_active) {
    throw new Error('Payment is already deactivated');
  }

  // Get invoice for outlet check
  const { data: invoice } = await supabase
    .from('invoices')
    .select('outlet_id')
    .eq('id', payment.invoice_id)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Manager outlet check
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only deactivate payments for your assigned outlets');
    }
  }

  // Soft delete (set is_active = false)
  const { error } = await supabase
    .from('payments')
    .update({ is_active: false })
    .eq('id', paymentId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Reactivate payment (undo soft delete)
 */
export async function reactivatePayment(userId: string, paymentId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.is_active) {
    throw new Error('Payment is already active');
  }

  // Get invoice for outlet check
  const { data: invoice } = await supabase
    .from('invoices')
    .select('outlet_id')
    .eq('id', payment.invoice_id)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Manager outlet check
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only reactivate payments for your assigned outlets');
    }
  }

  // Reactivate (set is_active = true)
  const { error } = await supabase
    .from('payments')
    .update({ is_active: true })
    .eq('id', paymentId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Calculate payment summary for an invoice
 */
export async function getPaymentSummary(invoiceId: string) {
  const invoice = await getInvoiceWithPaymentStatus(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const payments = await getPaymentsByInvoice(invoiceId);
  const activePayments = payments.filter(p => p.is_active);

  return {
    invoice_total: invoice.grand_total,
    amount_paid: invoice.amount_paid,
    balance_due: invoice.balance_due,
    payment_status: invoice.payment_status,
    payment_count: activePayments.length,
    payments: activePayments,
  };
}
