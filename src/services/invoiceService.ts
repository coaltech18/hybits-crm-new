import { supabase } from '@/lib/supabase';
import type {
  Invoice,
  InvoiceFilters,
  InvoiceStatus,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreateInvoiceItemInput,
} from '@/types';
import { ALLOWED_GST_RATES } from '@/types';
import { getClientById } from './clientService';
import { getEventById } from './eventService';
import { roundCurrency } from '@/utils/format';

// ================================================================
// INVOICE SERVICE
// ================================================================
// All CRUD operations for invoices with role-based access control
// Single source of truth for pricing and GST
//
// Invoice Lifecycle:
//   draft → finalized → partially_paid → paid
//   draft → cancelled
//   finalized → cancelled
//   partially_paid → finalized (payment reversal)
// ================================================================

// ================================================================
// STATUS TRANSITION VALIDATION
// ================================================================

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['finalized', 'cancelled'],
  finalized: ['partially_paid', 'cancelled'],
  partially_paid: ['paid', 'finalized'],
  paid: [],
  cancelled: [],
};

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
// CALCULATION HELPERS
// ================================================================

/**
 * Calculate line item totals with currency-safe rounding
 */
function calculateLineItem(item: CreateInvoiceItemInput) {
  const line_total = roundCurrency(item.quantity * item.unit_price);
  const tax_amount = roundCurrency(line_total * (item.tax_rate / 100));

  return {
    ...item,
    line_total,
    tax_amount,
  };
}

/**
 * Calculate invoice totals from items with currency-safe rounding
 */
function calculateInvoiceTotals(items: CreateInvoiceItemInput[]) {
  const calculated = items.map(calculateLineItem);

  // Sum each item's values, then round the totals
  const subtotal = roundCurrency(
    calculated.reduce((sum, item) => sum + item.line_total, 0)
  );
  const tax_total = roundCurrency(
    calculated.reduce((sum, item) => sum + item.tax_amount, 0)
  );
  const grand_total = roundCurrency(subtotal + tax_total);

  return {
    subtotal,
    tax_total,
    grand_total,
    items: calculated,
  };
}

// ================================================================
// READ OPERATIONS
// ================================================================

/**
 * Get all invoices with filters (role-based)
 */
export async function getInvoices(
  userId: string,
  filters: InvoiceFilters = {}
): Promise<Invoice[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  let query = supabase
    .from('invoices')
    .select(`
      *,
      clients (id, name, client_type, phone),
      outlets (id, name, code, city),
      events (id, event_name, event_date)
    `)
    .order('created_at', { ascending: false });

  // Role-based outlet filtering
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignments && assignments.length > 0) {
      const outletIds = assignments.map(a => a.outlet_id);
      query = query.in('outlet_id', outletIds);
    } else {
      return [];
    }
  }

  // Filters
  if (filters.outlet_id && ['admin', 'accountant'].includes(profile.role)) {
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

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get invoice by ID with items
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
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  // Fetch invoice items
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return {
    ...data,
    invoice_items: items || [],
  };
}

// ================================================================
// CREATE INVOICE
// ================================================================

/**
 * Create new invoice
 * 
 * LOCKED RULES:
 * - Event invoices only for completed events
 * - Subscription invoices must not have event_id
 * - Client outlet must match invoice outlet
 * - Status is always 'draft' on creation
 */
export async function createInvoice(
  userId: string,
  input: CreateInvoiceInput
): Promise<Invoice> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot create invoices
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to create invoices');
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
  const invalidRateItems = input.items.filter(
    item => !ALLOWED_GST_RATES.includes(item.tax_rate as 0 | 5 | 12 | 18)
  );
  if (invalidRateItems.length > 0) {
    throw new Error(
      `Invalid GST rate. Allowed rates are: ${ALLOWED_GST_RATES.join('%, ')}%`
    );
  }

  // Validate client
  const client = await getClientById(input.client_id);
  if (!client) {
    throw new Error('Client not found');
  }

  if (client.outlet_id !== input.outlet_id) {
    throw new Error('Client does not belong to the selected outlet');
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
  }

  // Validate subscription invoices
  if (input.invoice_type === 'subscription') {
    if (input.event_id) {
      throw new Error('Subscription invoices cannot have an event');
    }
  }

  // Manager outlet check
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(input.outlet_id)) {
      throw new Error('You can only create invoices for your assigned outlets');
    }
  }

  // Calculate totals
  const totals = calculateInvoiceTotals(input.items);

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_type: input.invoice_type,
      client_id: input.client_id,
      outlet_id: input.outlet_id,
      event_id: input.event_id || null,
      status: 'draft',
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      grand_total: totals.grand_total,
      terms_and_conditions: input.terms_and_conditions || null,
      invoice_number_format: input.invoice_number_format || null,
    })
    .select()
    .maybeSingle();

  if (invoiceError) {
    throw new Error(invoiceError.message);
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
    // Rollback: delete invoice
    await supabase.from('invoices').delete().eq('id', invoice.id);
    throw new Error(itemsError.message);
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
 * Update a draft invoice's items and terms
 * 
 * LOCKED RULES:
 * - Only draft invoices can be edited
 * - client_id, outlet_id, invoice_type, invoice_number cannot be changed
 * - Items are replaced entirely (old items deleted, new items inserted)
 */
export async function updateInvoice(
  userId: string,
  invoiceId: string,
  updates: UpdateInvoiceInput
): Promise<Invoice> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot update invoices
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to update invoices');
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
  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    const allowedOutlets = assignments?.map(a => a.outlet_id) || [];
    if (!allowedOutlets.includes(invoice.outlet_id)) {
      throw new Error('You can only edit invoices for your assigned outlets');
    }
  }

  // Update items if provided
  if (updates.items && updates.items.length > 0) {
    // Validate GST rates
    const invalidRateItems = updates.items.filter(
      item => !ALLOWED_GST_RATES.includes(item.tax_rate as 0 | 5 | 12 | 18)
    );
    if (invalidRateItems.length > 0) {
      throw new Error(
        `Invalid GST rate. Allowed rates are: ${ALLOWED_GST_RATES.join('%, ')}%`
      );
    }

    // Recalculate totals
    const totals = calculateInvoiceTotals(updates.items);

    // Delete old items
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Insert new items
    const itemsToInsert = totals.items.map(item => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
    }));

    const { error: insertError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert);

    if (insertError) {
      throw new Error(insertError.message);
    }

    // Update invoice totals
    const invoiceUpdate: Record<string, any> = {
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      grand_total: totals.grand_total,
    };

    if (updates.terms_and_conditions !== undefined) {
      invoiceUpdate.terms_and_conditions = updates.terms_and_conditions;
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update(invoiceUpdate)
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else if (updates.terms_and_conditions !== undefined) {
    // Only updating terms (no item changes)
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ terms_and_conditions: updates.terms_and_conditions })
      .eq('id', invoiceId);

    if (updateError) {
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
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Accountants cannot update invoices
  if (profile.role === 'accountant') {
    throw new Error('Accountants do not have permission to update invoices');
  }

  // Fetch current invoice
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Validate status transition
  validateStatusTransition(invoice.status, newStatus);

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

/**
 * Update invoice payment status based on payment summary
 * 
 * Called after every payment record/delete to sync invoice status.
 * Uses service-layer logic (not DB trigger) for debuggability.
 *
 * Rules:
 *   amount_paid >= grand_total → 'paid'
 *   amount_paid > 0 → 'partially_paid'
 *   amount_paid === 0 → revert to 'finalized'
 */
export async function syncInvoicePaymentStatus(
  _userId: string,
  invoiceId: string,
  amountPaid: number,
  grandTotal: number
): Promise<void> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return;

  // Only sync for finalized/partially_paid/paid invoices
  if (!['finalized', 'partially_paid', 'paid'].includes(invoice.status)) {
    return;
  }

  let targetStatus: InvoiceStatus;
  if (amountPaid >= grandTotal) {
    targetStatus = 'paid';
  } else if (amountPaid > 0) {
    targetStatus = 'partially_paid';
  } else {
    targetStatus = 'finalized';
  }

  // Only update if status actually changes
  if (invoice.status !== targetStatus) {
    // Direct update (skip transition validation since payment sync is trusted)
    const { error } = await supabase
      .from('invoices')
      .update({ status: targetStatus })
      .eq('id', invoiceId);

    if (error) {
      console.error('Failed to sync invoice payment status:', error.message);
    }
  }
}

// ================================================================
// DELETE INVOICE - NOT ALLOWED
// ================================================================
// Invoices are GST legal documents and CANNOT be deleted.
// Use cancelInvoice() for cancellation.
// Future scope: voidInvoice(), creditNote()
//
// The database has a BEFORE DELETE trigger that blocks all deletes.
// ================================================================
