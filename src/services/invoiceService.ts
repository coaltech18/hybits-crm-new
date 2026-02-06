import { supabase } from '@/lib/supabase';
import type {
  Invoice,
  InvoiceFilters,
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
      clients (id, name, client_type, phone, email, gstin, billing_address),
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

/**
 * Create new invoice
 * 
 * LOCKED RULES:
 * - Event invoices only for completed events
 * - Subscription invoices must not have event_id
 * - Client outlet must match invoice outlet
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

/**
 * Update invoice status
 * 
 * LOCKED RULES:
 * - Issued invoices cannot be edited
 * - Cancelled invoices cannot be issued
 */
export async function updateInvoiceStatus(
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

  // Cannot edit issued invoices
  if (invoice.status === 'issued' && updates.status !== 'cancelled') {
    throw new Error('Issued invoices cannot be modified');
  }

  // Cannot issue cancelled invoices
  if (invoice.status === 'cancelled' && updates.status === 'issued') {
    throw new Error('Cancelled invoices cannot be issued');
  }

  // Update invoice
  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .maybeSingle();

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
 * Issue invoice (change status to issued)
 */
export async function issueInvoice(userId: string, invoiceId: string): Promise<void> {
  await updateInvoiceStatus(userId, invoiceId, { status: 'issued' });
}

/**
 * Cancel invoice
 */
export async function cancelInvoice(userId: string, invoiceId: string): Promise<void> {
  await updateInvoiceStatus(userId, invoiceId, { status: 'cancelled' });
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

