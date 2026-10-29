import { supabase } from '@/lib/supabase';
import type {
  Invoice,
  InvoiceItem,
  InvoiceFilters,
  InvoiceStatus,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UserRole,
} from '@/types';
import { ALLOWED_GST_RATES } from '@/types';
import { getClientById } from './clientService';
import { getEventById } from './eventService';
import { roundCurrency, toPaise, calcInvoiceTotals } from '@/utils/format';
import { todayISO, parseLocalISODate, toLocalISODate } from '@/utils/date';

// ================================================================
// INVOICE SERVICE
// ================================================================
// All CRUD operations for invoices with role-based access control
// Single source of truth for pricing and GST
//
// Invoice Lifecycle:
//   draft → finalized → partially_paid → paid
//   draft → cancelled
//   finalized → paid (single full payment)
//   finalized → cancelled
//   partially_paid → finalized (payment reversal)
//   paid → partially_paid / finalized (payment reversal)
//
// This map must stay in sync with the DB trigger
// validate_invoice_status_transition() (migration 034).
// ================================================================

// ================================================================
// STATUS TRANSITION VALIDATION
// ================================================================

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['finalized', 'cancelled'],
  finalized: ['partially_paid', 'paid', 'cancelled'],
  partially_paid: ['paid', 'finalized'],
  paid: ['partially_paid', 'finalized'],
  cancelled: [],
};

/** Earliest valid invoice date: GST came into force on 1 July 2017. */
export const MIN_INVOICE_DATE = '2017-07-01';

/** Default page size for the invoice list. */
export const INVOICE_PAGE_SIZE = 50;

/**
 * Validate that a status transition is allowed
 * @throws Error if the transition is not allowed
 */
function validateStatusTransition(oldStatus: InvoiceStatus, newStatus: InvoiceStatus): void {
  if (oldStatus === newStatus) return; // No change

  const allowed = ALLOWED_TRANSITIONS[oldStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${oldStatus} → ${newStatus}. Not allowed.`
    );
  }
}

// ================================================================
// ACCESS HELPERS
// ================================================================

async function getUserRole(userId: string): Promise<UserRole> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!profile) {
    throw new Error('User profile not found');
  }
  return profile.role as UserRole;
}

function canWriteInvoices(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}

async function getManagerOutletIds(userId: string): Promise<string[]> {
  const { data: assignments, error } = await supabase
    .from('user_outlet_assignments')
    .select('outlet_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
  return (assignments || []).map(a => a.outlet_id as string);
}

function assertAllowedGstRates(items: { tax_rate: number }[]): void {
  const invalid = items.filter(
    item => !ALLOWED_GST_RATES.includes(item.tax_rate as 0 | 5 | 12 | 18)
  );
  if (invalid.length > 0) {
    throw new Error(
      `Invalid GST rate. Allowed rates are: ${ALLOWED_GST_RATES.join('%, ')}%`
    );
  }
}

// ================================================================
// READ OPERATIONS
// ================================================================

/** A list row: the invoice plus its payment position from invoices_with_payment_status. */
export type InvoiceListRow = Invoice & {
  /** Sum of active payments (null when the balance lookup returned nothing for this row). */
  amount_paid: number | null;
  /** grand_total minus active payments, 0 within the settlement tolerance. */
  balance_due: number | null;
};

export interface InvoicePage {
  invoices: InvoiceListRow[];
  /** Total rows matching the filters, across all pages. */
  total: number;
  /**
   * Balance still due on every matching finalized / part-paid invoice, across
   * all pages. null when it could not be totalled (the list itself still loads).
   */
  outstanding: number | null;
}

// Statuses that can still owe money
const OUTSTANDING_STATUSES: InvoiceStatus[] = ['finalized', 'partially_paid'];
const BALANCE_PAGE = 1000;

/**
 * Get one page of invoices with filters (role-based).
 * Paged with .range() so lists never get silently cut at PostgREST max_rows.
 */
export async function getInvoices(
  userId: string,
  filters: InvoiceFilters = {},
  paging: { page?: number; pageSize?: number } = {}
): Promise<InvoicePage> {
  const role = await getUserRole(userId);
  const pageSize = paging.pageSize ?? INVOICE_PAGE_SIZE;
  const page = Math.max(0, paging.page ?? 0);
  const from = page * pageSize;

  let query = supabase
    .from('invoices')
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city),
      events (id, event_name, event_date)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);

  // Role-based outlet filtering (RLS enforces this too)
  let managerOutletIds: string[] | null = null;
  if (role === 'manager') {
    managerOutletIds = await getManagerOutletIds(userId);
    if (managerOutletIds.length === 0) {
      return { invoices: [], total: 0, outstanding: 0 };
    }
    query = query.in('outlet_id', managerOutletIds);
  }

  // Filters
  if (filters.outlet_id && (role === 'admin' || role === 'accountant')) {
    query = query.eq('outlet_id', filters.outlet_id);
  }
  if (filters.invoice_type) {
    query = query.eq('invoice_type', filters.invoice_type);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.client_id) {
    query = query.eq('client_id', filters.client_id);
  }

  const [{ data, error, count }, outstanding] = await Promise.all([
    query,
    getOutstandingTotal(role, managerOutletIds, filters).catch((err: unknown) => {
      console.error('Failed to total the outstanding balance:', err);
      return null;
    }),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as Invoice[];

  // Balances come from invoices_with_payment_status. That view is `i.*`
  // frozen at migration 016, so newer invoice columns (027+) are missing
  // from it: the rows themselves stay on `invoices` and only the payment
  // figures are merged in by id.
  const balances = new Map<string, { amount_paid: number; balance_due: number }>();
  if (rows.length > 0) {
    const { data: balanceRows, error: balanceError } = await supabase
      .from('invoices_with_payment_status')
      .select('id, amount_paid, balance_due')
      .in('id', rows.map((r) => r.id));

    // A failed lookup only hides the balances (null); the list still shows.
    if (balanceError) {
      console.error('Failed to load invoice balances:', balanceError.message);
    }
    (balanceRows || []).forEach((b) => {
      balances.set(b.id as string, {
        amount_paid: Number(b.amount_paid) || 0,
        balance_due: Number(b.balance_due) || 0,
      });
    });
  }

  return {
    invoices: rows.map((r) => ({
      ...r,
      amount_paid: balances.get(r.id)?.amount_paid ?? null,
      balance_due: balances.get(r.id)?.balance_due ?? null,
    })),
    total: count ?? rows.length,
    outstanding,
  };
}

/**
 * Sum of balance_due over every invoice matching the list filters that can
 * still owe money (finalized / part paid). Reads only columns that exist in
 * invoices_with_payment_status since migration 016.
 */
async function getOutstandingTotal(
  role: UserRole,
  managerOutletIds: string[] | null,
  filters: InvoiceFilters
): Promise<number> {
  if (filters.status && !OUTSTANDING_STATUSES.includes(filters.status)) {
    return 0;
  }

  let total = 0;
  for (let from = 0; ; from += BALANCE_PAGE) {
    let query = supabase
      .from('invoices_with_payment_status')
      .select('id, balance_due')
      .in('status', filters.status ? [filters.status] : OUTSTANDING_STATUSES)
      .gt('balance_due', 0)
      .order('id')
      .range(from, from + BALANCE_PAGE - 1);

    if (managerOutletIds) query = query.in('outlet_id', managerOutletIds);
    if (filters.outlet_id && (role === 'admin' || role === 'accountant')) {
      query = query.eq('outlet_id', filters.outlet_id);
    }
    if (filters.invoice_type) query = query.eq('invoice_type', filters.invoice_type);
    if (filters.client_id) query = query.eq('client_id', filters.client_id);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to total the outstanding balance: ${error.message}`);
    }
    const chunk = data || [];
    chunk.forEach((row) => {
      total += Number(row.balance_due) || 0;
    });
    if (chunk.length < BALANCE_PAGE) return roundCurrency(total);
  }
}

/**
 * Get invoice by ID with items.
 * Returns null when the invoice does not exist or RLS hides it.
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients (id, name, client_type, phone, email, gstin, billing_address, gst_type),
      outlets (id, name, code, city, state, address, gstin, phone, email),
      events (id, event_name, event_date, event_type)
    `)
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  // Fetch invoice items
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return {
    ...data,
    invoice_items: items || [],
  };
}

/**
 * Ids of the outlet's events that already have a non-cancelled invoice.
 */
export async function getInvoicedEventIds(outletId: string): Promise<Set<string>> {
  if (!outletId) return new Set();

  const { data, error } = await supabase
    .from('invoices')
    .select('event_id')
    .eq('outlet_id', outletId)
    .not('event_id', 'is', null)
    .neq('status', 'cancelled');

  if (error) {
    throw new Error(error.message);
  }
  return new Set((data || []).map(r => r.event_id as string));
}

// ================================================================
// CREATE INVOICE
// ================================================================

/**
 * Validate a user-supplied invoice date.
 *
 * issued_at is the invoice date used by the PDF, all report_* views,
 * the aging buckets and the GST working sheets. A future-dated tax
 * invoice is invalid, so reject it here rather than at the form only.
 *
 * Returns the date to store, or null to let the DB default to today.
 */
function normalizeIssuedAt(value: string | null | undefined): string | null {
  if (!value) return null;

  // Shape check plus a round-trip so impossible dates (2026-02-31) fail
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || toLocalISODate(parseLocalISODate(value)) !== value) {
    throw new Error('Invoice date must be a valid date');
  }

  // Plain YYYY-MM-DD strings compare correctly as text
  if (value > todayISO()) {
    throw new Error('Invoice date cannot be in the future');
  }

  if (value < MIN_INVOICE_DATE) {
    throw new Error('Invoice date is too far in the past');
  }

  return value;
}

/**
 * Remove a draft whose items failed to save, so no item-less invoice is
 * left behind. Deleting a draft is allowed from migration 042; until then
 * (or without a DELETE policy) fall back to cancelling it.
 * Returns a sentence describing what happened, for the error message.
 */
async function discardFailedDraft(invoiceId: string, invoiceNumber: string): Promise<string> {
  const { data: deleted, error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('status', 'draft')
    .select('id');

  if (!deleteError && deleted && deleted.length > 0) {
    return 'The incomplete draft was discarded.';
  }

  const { data: cancelled, error: cancelError } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
    .eq('status', 'draft')
    .select('id');

  if (!cancelError && cancelled && cancelled.length > 0) {
    return `The incomplete draft ${invoiceNumber} was cancelled.`;
  }

  console.error('[invoiceService] could not discard failed draft', invoiceId, deleteError, cancelError);
  return `The incomplete draft ${invoiceNumber} could not be removed. Cancel it from the invoice list.`;
}

/**
 * Create new invoice
 *
 * LOCKED RULES:
 * - Event invoices only for completed events, one active invoice per event
 * - Subscription invoices must not have event_id
 * - Client outlet must match invoice outlet; client type must match invoice type
 * - Status is always 'draft' on creation
 */
export async function createInvoice(
  userId: string,
  input: CreateInvoiceInput
): Promise<Invoice> {
  const role = await getUserRole(userId);

  if (!canWriteInvoices(role)) {
    throw new Error('You do not have permission to create invoices');
  }

  // Validate required fields
  if (!input.client_id) {
    throw new Error('Client is required');
  }

  if (!input.outlet_id) {
    throw new Error('Outlet is required');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('At least one invoice item is required');
  }

  // Validate GST rates - must be one of allowed values (0, 5, 12, 18)
  assertAllowedGstRates(input.items);

  const issuedAt = normalizeIssuedAt(input.issued_at);

  // Validate client
  const client = await getClientById(input.client_id);
  if (!client) {
    throw new Error('Client not found');
  }

  if (client.outlet_id !== input.outlet_id) {
    throw new Error('Client does not belong to the selected outlet');
  }

  const expectedClientType = input.invoice_type === 'subscription' ? 'corporate' : 'event';
  if (client.client_type !== expectedClientType) {
    throw new Error('Client type does not match invoice type');
  }

  // Validate event for event invoices
  if (input.invoice_type === 'event') {
    if (!input.event_id) {
      throw new Error('Event invoices must have an event');
    }

    const event = await getEventById(input.event_id);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== 'completed') {
      throw new Error('Only completed events can be invoiced');
    }

    if (event.outlet_id !== input.outlet_id) {
      throw new Error('Event does not belong to the selected outlet');
    }

    if (event.client_id !== input.client_id) {
      throw new Error('Event does not belong to the selected client');
    }

    const { data: existing, error: existingError } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('event_id', input.event_id)
      .neq('status', 'cancelled')
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (existing && existing.length > 0) {
      throw new Error(
        `This event is already invoiced (${existing[0].invoice_number}). Cancel that invoice first to bill it again.`
      );
    }
  }

  // Validate subscription invoices
  if (input.invoice_type === 'subscription') {
    if (input.event_id) {
      throw new Error('Subscription invoices cannot have an event');
    }
  } else if (input.subscription_id) {
    throw new Error('Only subscription invoices can be linked to a subscription');
  }

  // Manager outlet check
  if (role === 'manager') {
    const allowedOutlets = await getManagerOutletIds(userId);
    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create invoices for your assigned outlets');
    }
  }

  // Calculate totals (exact paise maths, matches the DB CHECKs)
  const totals = calcInvoiceTotals(input.items);

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_type: input.invoice_type,
      client_id: input.client_id,
      outlet_id: input.outlet_id,
      event_id: input.event_id || null,
      // The DB checks the subscription belongs to this client and outlet (042)
      subscription_id: input.invoice_type === 'subscription' ? input.subscription_id || null : null,
      status: 'draft',
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      grand_total: totals.grand_total,
      // Keep '' when the user cleared the terms; only a missing value is NULL
      terms_and_conditions: input.terms_and_conditions ?? null,
      invoice_number_format: input.invoice_number_format || null,
      issued_at: issuedAt,
    })
    .select()
    .maybeSingle();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }
  if (!invoice) {
    throw new Error('Failed to create invoice');
  }

  // Create invoice items
  const itemsToInsert = totals.items.map(item => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    tax_rate: item.tax_rate,
    tax_amount: item.tax_amount,
  }));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsToInsert);

  if (itemsError) {
    const outcome = await discardFailedDraft(invoice.id, invoice.invoice_number);
    throw new Error(`Could not save the invoice items: ${itemsError.message}. ${outcome}`);
  }

  // Fetch complete invoice
  const completeInvoice = await getInvoiceById(invoice.id);
  if (!completeInvoice) {
    throw new Error('Failed to fetch created invoice');
  }

  return completeInvoice;
}

// ================================================================
// UPDATE INVOICE (DRAFT ONLY)
// ================================================================

/**
 * Thrown when some writes of a draft edit landed and a later one failed.
 * The caller should reload the invoice before letting the user retry,
 * otherwise new rows would be inserted twice.
 */
export class InvoicePartialSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoicePartialSaveError';
  }
}

function itemNeedsUpdate(
  stored: InvoiceItem,
  next: { description: string; quantity: number; unit_price: number; tax_rate: number; line_total: number; tax_amount: number }
): boolean {
  return (
    stored.description !== next.description ||
    toPaise(stored.quantity) !== toPaise(next.quantity) ||
    toPaise(stored.unit_price) !== toPaise(next.unit_price) ||
    toPaise(stored.tax_rate) !== toPaise(next.tax_rate) ||
    toPaise(stored.line_total) !== toPaise(next.line_total) ||
    toPaise(stored.tax_amount) !== toPaise(next.tax_amount)
  );
}

/**
 * Update a draft invoice's items, terms and date
 *
 * LOCKED RULES:
 * - Only draft invoices can be edited
 * - client_id, outlet_id, invoice_type, invoice_number cannot be changed
 * - Items are diffed against the stored rows: changed rows are updated in
 *   place, new rows inserted, removed rows deleted (the DB allows item
 *   deletes only while the invoice is a draft, migration 042)
 */
export async function updateInvoice(
  userId: string,
  invoiceId: string,
  updates: UpdateInvoiceInput
): Promise<Invoice> {
  const role = await getUserRole(userId);

  if (!canWriteInvoices(role)) {
    throw new Error('You do not have permission to update invoices');
  }

  // Fetch current invoice
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // STRICT: Only draft invoices can be edited
  if (invoice.status !== 'draft') {
    throw new Error('Only draft invoices can be edited');
  }

  // Manager outlet check
  if (role === 'manager') {
    const allowedOutlets = await getManagerOutletIds(userId);
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only edit invoices for your assigned outlets');
    }
  }

  const invoiceUpdate: Partial<Pick<Invoice, 'subtotal' | 'tax_total' | 'grand_total' | 'terms_and_conditions' | 'issued_at'>> = {};

  if (updates.terms_and_conditions !== undefined) {
    invoiceUpdate.terms_and_conditions = updates.terms_and_conditions;
  }

  if (updates.issued_at !== undefined) {
    invoiceUpdate.issued_at = normalizeIssuedAt(updates.issued_at);
  }

  let wroteItems = false;

  if (updates.items !== undefined) {
    if (updates.items.length === 0) {
      throw new Error('At least one invoice item is required');
    }
    assertAllowedGstRates(updates.items);

    const totals = calcInvoiceTotals(updates.items);
    const stored = invoice.invoice_items || [];
    const storedById = new Map(stored.map(item => [item.id, item]));

    const keptIds = new Set(
      totals.items.filter(item => item.id && storedById.has(item.id)).map(item => item.id as string)
    );
    const toDelete = stored.filter(item => !keptIds.has(item.id)).map(item => item.id);
    const toUpdate = totals.items.filter(item => {
      const prev = item.id ? storedById.get(item.id) : undefined;
      return prev !== undefined && itemNeedsUpdate(prev, item);
    });
    const toInsert = totals.items.filter(item => !item.id || !storedById.has(item.id));

    const fail = (step: string, message: string): never => {
      if (wroteItems) {
        throw new InvoicePartialSaveError(
          `Some changes were saved, but ${step} failed: ${message}. The invoice has been reloaded; check it before saving again.`
        );
      }
      throw new Error(message);
    };

    // Deletes first: if the DB refuses them, nothing else has been written.
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .in('id', toDelete)
        .eq('invoice_id', invoiceId);
      if (deleteError) fail('removing items', deleteError.message);
      wroteItems = true;
    }

    for (const item of toUpdate) {
      const { error: updateItemError } = await supabase
        .from('invoice_items')
        .update({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_total: item.line_total,
          tax_amount: item.tax_amount,
        })
        .eq('id', item.id as string)
        .eq('invoice_id', invoiceId);
      if (updateItemError) fail('updating an item', updateItemError.message);
      wroteItems = true;
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('invoice_items')
        .insert(
          toInsert.map(item => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            tax_rate: item.tax_rate,
            tax_amount: item.tax_amount,
          }))
        );
      if (insertError) fail('adding items', insertError.message);
      wroteItems = true;
    }

    invoiceUpdate.subtotal = totals.subtotal;
    invoiceUpdate.tax_total = totals.tax_total;
    invoiceUpdate.grand_total = totals.grand_total;
  }

  if (Object.keys(invoiceUpdate).length > 0) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update(invoiceUpdate)
      .eq('id', invoiceId);

    if (updateError) {
      if (wroteItems) {
        throw new InvoicePartialSaveError(
          `The items were saved, but updating the invoice totals failed: ${updateError.message}. The invoice has been reloaded; save again to fix the totals.`
        );
      }
      throw new Error(updateError.message);
    }
  }

  // Fetch and return updated invoice
  const updatedInvoice = await getInvoiceById(invoiceId);
  if (!updatedInvoice) {
    throw new Error('Failed to fetch updated invoice');
  }

  return updatedInvoice;
}

// ================================================================
// STATUS CHANGES
// ================================================================

/**
 * Update invoice status with transition validation
 *
 * LOCKED RULES:
 * - Only allowed transitions are permitted
 * - Finalized/paid invoices cannot be edited
 * - Cancelled invoices cannot be reactivated
 */
export async function updateInvoiceStatus(
  userId: string,
  invoiceId: string,
  newStatus: InvoiceStatus
): Promise<Invoice> {
  const role = await getUserRole(userId);

  if (!canWriteInvoices(role)) {
    throw new Error('You do not have permission to update invoices');
  }

  // Fetch current invoice
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Validate status transition
  validateStatusTransition(invoice.status, newStatus);

  if (newStatus === 'finalized' && invoice.status === 'draft' && (invoice.invoice_items || []).length === 0) {
    throw new Error('Add at least one line item before finalizing this invoice');
  }

  // Update invoice status
  const { error } = await supabase
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', invoiceId);

  if (error) {
    throw new Error(error.message);
  }

  const updatedInvoice = await getInvoiceById(invoiceId);
  if (!updatedInvoice) {
    throw new Error('Failed to fetch updated invoice');
  }

  return updatedInvoice;
}

/**
 * Finalize invoice (change status from draft to finalized)
 *
 * After finalization:
 * - Invoice is locked from editing
 * - issued_at timestamp is set (by DB trigger)
 * - Invoice number is preserved
 */
export async function finalizeInvoice(userId: string, invoiceId: string): Promise<void> {
  await updateInvoiceStatus(userId, invoiceId, 'finalized');
}

/**
 * Cancel invoice (change status to cancelled)
 *
 * Allowed from: draft, finalized
 * Not allowed from: partially_paid, paid, cancelled
 */
export async function cancelInvoice(userId: string, invoiceId: string): Promise<void> {
  await updateInvoiceStatus(userId, invoiceId, 'cancelled');
}

// ================================================================
// DELETE INVOICE - NOT ALLOWED
// ================================================================
// Invoices are GST legal documents and CANNOT be deleted.
// Use cancelInvoice() for cancellation. The only delete is the
// internal rollback of a draft whose items failed to save.
// Future scope: voidInvoice(), creditNote()
// ================================================================
