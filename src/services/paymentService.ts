import { supabase } from '@/lib/supabase';
import type {
  Payment,
  PaymentFilters,
  CreatePaymentInput,
  InvoiceWithPaymentStatus,
  UserRole,
} from '@/types';
import { roundCurrency, formatCurrency, SETTLEMENT_TOLERANCE } from '@/utils/format';
import { todayISO, toLocalISODate } from '@/utils/date';

// ================================================================
// PAYMENT SERVICE
// ================================================================
// All CRUD operations for payments with role-based access control
// Enforces overpayment prevention and invoice status validation
// ================================================================

export const PAYMENTS_PAGE_SIZE = 50;

export interface PaymentPage {
  rows: Payment[];
  /** Total rows matching the filters (across all pages). */
  count: number;
}

export interface PaymentsSummary {
  total_amount: number;
  total_count: number;
  today_amount: number;
  today_count: number;
  voided_count: number;
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

async function getCallerRole(userId: string): Promise<UserRole> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('User profile not found');
  return profile.role as UserRole;
}

function canWritePayments(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}

async function assertManagerOutlet(userId: string, outletId: string, message: string) {
  const { data: assignments, error } = await supabase
    .from('user_outlet_assignments')
    .select('outlet_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  const allowedOutlets = (assignments ?? []).map((a) => a.outlet_id);
  if (!allowedOutlets.includes(outletId)) {
    throw new Error(message);
  }
}

/**
 * Attach the void trail (migration 043: void_reason, voided_by, voided_at)
 * to voided rows. payments_with_details expands p.* as it was when the
 * view was created (042), so these columns are read from payments by id,
 * and the voider's name is resolved with user_display_name (SECURITY
 * DEFINER, so it works for managers too where user_profiles RLS hides
 * other users). Failures here never break the list: rows come back
 * without the extra detail.
 */
async function attachVoidDetails(rows: Payment[]): Promise<Payment[]> {
  const voidedIds = rows.filter((r) => !r.is_active).map((r) => r.id);
  if (voidedIds.length === 0) return rows;

  const { data, error } = await supabase
    .from('payments')
    .select('id, void_reason, voided_by, voided_at')
    .in('id', voidedIds);
  if (error || !data) return rows;

  type VoidRow = { id: string; void_reason: string | null; voided_by: string | null; voided_at: string | null };
  const byId = new Map((data as VoidRow[]).map((d) => [d.id, d]));

  const userIds = [...new Set((data as VoidRow[]).map((d) => d.voided_by).filter((u): u is string => !!u))];
  const names = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data: name } = await supabase.rpc('user_display_name', { p_id: uid });
      if (typeof name === 'string' && name.trim()) names.set(uid, name.trim());
    })
  );

  return rows.map((r) => {
    const v = byId.get(r.id);
    if (!v) return r;
    return {
      ...r,
      void_reason: v.void_reason,
      voided_by: v.voided_by,
      voided_at: v.voided_at,
      voided_by_name: v.voided_by ? names.get(v.voided_by) ?? null : null,
    };
  });
}

/** Throws unless `date` is a valid YYYY-MM-DD that is not after today (local/IST). */
function assertPaymentDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid payment date');
  }
  if (date > todayISO()) {
    throw new Error('Payment date cannot be in the future');
  }
}

// ----------------------------------------------------------------
// Reads
// ----------------------------------------------------------------

/**
 * Get one page of payments. Outlet scoping is enforced by RLS on
 * payments_with_details (security_invoker), so no client-side outlet
 * pre-filtering is needed.
 */
export async function getPayments(
  filters: PaymentFilters = {},
  { page = 0, pageSize = PAYMENTS_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
): Promise<PaymentPage> {
  let query = supabase
    .from('payments_with_details')
    .select('*', { count: 'exact' })
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.outlet_id) {
    query = query.eq('outlet_id', filters.outlet_id);
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

  if (filters.include_inactive) {
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  } else {
    query = query.eq('is_active', filters.is_active ?? true);
  }

  const from = page * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  return { rows: await attachVoidDetails((data as Payment[]) || []), count: count ?? 0 };
}

/**
 * Server-side totals for the Payments page cards (migration 042,
 * payments_summary). RLS applies, so managers see only their outlets.
 */
export async function getPaymentsSummary(filters: PaymentFilters = {}): Promise<PaymentsSummary> {
  const { data, error } = await supabase.rpc('payments_summary', {
    p_date_from: filters.date_from || null,
    p_date_to: filters.date_to || null,
    p_method: filters.payment_method || null,
    p_outlet: filters.outlet_id || null,
    p_today: todayISO(),
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Partial<Record<keyof PaymentsSummary, unknown>> | null;
  return {
    total_amount: roundCurrency(Number(row?.total_amount) || 0),
    total_count: Number(row?.total_count) || 0,
    today_amount: roundCurrency(Number(row?.today_amount) || 0),
    today_count: Number(row?.today_count) || 0,
    voided_count: Number(row?.voided_count) || 0,
  };
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments_with_details')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) {
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
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Payment[]) || [];
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
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InvoiceWithPaymentStatus | null;
}

// ----------------------------------------------------------------
// Writes
// ----------------------------------------------------------------

/**
 * Create new payment
 *
 * LOCKED RULES:
 * - No payments on draft or cancelled invoices
 * - No overpayments (enforced by DB trigger with ₹0.05 tolerance)
 * - No future dates and no dates before the invoice was issued
 * - Manager: Only for assigned outlet invoices
 */
export async function createPayment(
  userId: string,
  input: CreatePaymentInput
): Promise<{ payment: Payment }> {
  const role = await getCallerRole(userId);
  if (!canWritePayments(role)) {
    throw new Error('You do not have permission to record payments');
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

  assertPaymentDate(input.payment_date);

  // Get invoice with payment status
  const invoice = await getInvoiceWithPaymentStatus(input.invoice_id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Check invoice status
  if (invoice.status === 'draft') {
    throw new Error('Cannot record payment for draft invoice. Finalize the invoice first.');
  }

  if (invoice.status === 'cancelled') {
    throw new Error('Cannot record payment for cancelled invoice');
  }

  if (invoice.issued_at && input.payment_date < toLocalISODate(new Date(invoice.issued_at))) {
    throw new Error('Payment date cannot be before the invoice date');
  }

  // CRITICAL: round amount to avoid floating-point drift
  const roundedAmount = roundCurrency(input.amount);

  // Check overpayment (frontend validation) - use settlement tolerance
  if (roundedAmount > roundCurrency(invoice.balance_due + SETTLEMENT_TOLERANCE)) {
    throw new Error(
      `Payment amount (${formatCurrency(roundedAmount)}) exceeds balance due (${formatCurrency(invoice.balance_due)})`
    );
  }

  if (role === 'manager') {
    await assertManagerOutlet(
      userId,
      invoice.outlet_id,
      'You can only record payments for your assigned outlets'
    );
  }

  const { data: inserted, error: paymentError } = await supabase
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

  // The payment is saved from here on: nothing below may throw, or the UI
  // would keep the form open and a retry would record it twice.
  let payment = inserted as Payment;
  try {
    payment = (await getPaymentById(inserted.id)) ?? payment;
  } catch (err) {
    console.error('[paymentService] could not reload created payment:', err);
  }

  // The invoice status follows the payments in the DB (trigger
  // sync_invoice_status_from_payments, migration 043); callers re-fetch the invoice.
  return { payment };
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
export async function deactivatePayment(
  userId: string,
  paymentId: string,
  voidReason?: string
): Promise<void> {
  const role = await getCallerRole(userId);
  if (!canWritePayments(role)) {
    throw new Error('You do not have permission to void payments');
  }

  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (!payment.is_active) {
    throw new Error('Payment is already deactivated');
  }

  if (role === 'manager') {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('outlet_id')
      .eq('id', payment.invoice_id)
      .maybeSingle();

    if (invoiceError) throw new Error(invoiceError.message);
    if (!invoice) throw new Error('Invoice not found');

    await assertManagerOutlet(
      userId,
      invoice.outlet_id,
      'You can only deactivate payments for your assigned outlets'
    );
  }

  // Soft delete (set is_active = false). Select the row back so an update
  // that RLS silently filtered out (0 rows) is reported, not shown as success.
  // The DB stamps voided_at / voided_by and keeps the optional reason (migration 043).
  const reason = voidReason?.trim();
  const { data: updated, error } = await supabase
    .from('payments')
    .update({ is_active: false, void_reason: reason ? reason : null })
    .eq('id', paymentId)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }
  if (!updated || updated.length === 0) {
    throw new Error('Payment could not be voided (no permission or it no longer exists)');
  }

  // The invoice status reverts in the DB (trigger, migration 043); callers re-fetch.
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
