// ============================================================================
// OVERDUE SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export interface OverdueInvoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string;
  outlet_id: string | null;
  due_date: string;
  total_amount: number;
  payment_status: string;
  customer_name?: string;
  outlet_name?: string;
}

/**
 * Run the mark_overdue_invoices() database function
 * Returns the count of invoices marked as overdue
 */
export async function runMarkOverdue(): Promise<{ updatedCount: number }> {
  try {
    // Call the RPC function
    const { data, error } = await supabase.rpc('mark_overdue_invoices');

    if (error) {
      console.error('Error calling mark_overdue_invoices RPC:', error);
      throw new Error(error.message || 'Failed to mark overdue invoices');
    }

    // data should be an integer (count of updated invoices)
    const updatedCount = typeof data === 'number' ? data : 0;

    return { updatedCount };
  } catch (err: any) {
    console.error('Error in runMarkOverdue:', err);
    throw err;
  }
}

/**
 * Fetch recent overdue invoices with customer and outlet information
 */
export async function fetchOverdueInvoices(limit = 10): Promise<OverdueInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        order_id,
        customer_id,
        outlet_id,
        due_date,
        total_amount,
        payment_status,
        customers:customer_id (
          contact_person
        ),
        locations:outlet_id (
          name
        )
      `)
      .eq('payment_status', 'overdue')
      .order('due_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching overdue invoices:', error);
      throw new Error(error.message || 'Failed to fetch overdue invoices');
    }

    // Transform the data to match the interface
    return (data || []).map((invoice: any) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      order_id: invoice.order_id,
      customer_id: invoice.customer_id,
      outlet_id: invoice.outlet_id,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      payment_status: invoice.payment_status,
      customer_name: invoice.customers?.contact_person || 'Unknown',
      outlet_name: invoice.locations?.name || 'Unknown',
    }));
  } catch (err: any) {
    console.error('Error in fetchOverdueInvoices:', err);
    throw err;
  }
}

