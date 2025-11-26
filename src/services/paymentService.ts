// ============================================================================
// PAYMENT SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  customer_id: string;
  outlet_id?: string;
  payment_date: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'online';
  reference_number?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface PaymentFormData {
  invoice_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'online';
  payment_date: string;
  reference_number?: string;
  notes?: string;
}

export interface PaymentFilters {
  date_from?: string;
  date_to?: string;
  invoice_id?: string;
  customer_id?: string;
  outlet_id?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  payment_received: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  total_amount: number;
}

export class PaymentService {
  /**
   * Create a new payment and update invoice totals
   */
  static async createPayment(data: PaymentFormData & { outlet_id?: string }): Promise<{ payment: Payment; invoice: Invoice }> {
    try {
      // Validate amount > 0
      if (data.amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();

      // Get invoice to determine customer_id and outlet_id
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, customer_id, outlet_id, total_amount, payment_received, payment_status')
        .eq('id', data.invoice_id)
        .maybeSingle();

      if (invoiceError) {
        console.error('Error fetching invoice:', invoiceError);
        throw new Error('Failed to fetch invoice');
      }

      if (!invoiceData) {
        throw new Error('Invoice not found');
      }

      // Insert payment row
      const insertData: any = {
        invoice_id: data.invoice_id,
        customer_id: invoiceData.customer_id,
        payment_date: data.payment_date,
        amount: data.amount,
        payment_method: data.payment_method,
        reference_number: data.reference_number || null,
        notes: data.notes || null,
        created_by: user?.id
      };

      // Add outlet_id if available
      const outletId = data.outlet_id || invoiceData.outlet_id;
      if (outletId) {
        insertData.outlet_id = outletId;
      }

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (paymentError) {
        console.error('Error creating payment:', paymentError);
        throw new Error('Failed to create payment');
      }

      if (!paymentData) {
        throw new Error('Failed to create payment');
      }

      // Recalculate invoice payment_received by summing all non-deleted payments
      const { data: allPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', data.invoice_id)
        .is('deleted_at', null);

      if (paymentsError) {
        console.error('Error fetching payments for recalculation:', paymentsError);
        throw new Error('Failed to recalculate invoice totals');
      }

      const paymentReceived = (allPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Update invoice.payment_status based on payment_received
      let paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';
      if (paymentReceived === 0) {
        paymentStatus = 'pending';
      } else if (paymentReceived >= invoiceData.total_amount) {
        paymentStatus = 'paid';
      } else {
        paymentStatus = 'partial';
      }

      // Update invoice with recalculated values
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          payment_received: paymentReceived,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.invoice_id)
        .select('id, invoice_number, payment_received, payment_status, total_amount')
        .maybeSingle();

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        throw new Error('Failed to update invoice totals');
      }

      if (!updatedInvoice) {
        throw new Error('Failed to update invoice');
      }

      return {
        payment: {
          id: paymentData.id,
          payment_number: paymentData.payment_number,
          invoice_id: paymentData.invoice_id,
          customer_id: paymentData.customer_id,
          outlet_id: paymentData.outlet_id,
          payment_date: paymentData.payment_date,
          amount: Number(paymentData.amount),
          payment_method: paymentData.payment_method,
          reference_number: paymentData.reference_number,
          notes: paymentData.notes,
          created_by: paymentData.created_by,
          created_at: paymentData.created_at,
          deleted_at: paymentData.deleted_at
        },
        invoice: {
          id: updatedInvoice.id,
          invoice_number: updatedInvoice.invoice_number,
          payment_received: Number(updatedInvoice.payment_received),
          payment_status: updatedInvoice.payment_status as 'pending' | 'partial' | 'paid' | 'overdue',
          total_amount: Number(updatedInvoice.total_amount)
        }
      };
    } catch (error: any) {
      console.error('Error in createPayment:', error);
      throw new Error(error.message || 'Failed to create payment');
    }
  }

  /**
   * Get payments with optional filters
   */
  static async getPayments(filters?: PaymentFilters): Promise<Payment[]> {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          invoices(invoice_number),
          customers(contact_person, company_name)
        `)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });

      // Apply filters
      if (filters?.date_from) {
        query = query.gte('payment_date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('payment_date', filters.date_to);
      }
      if (filters?.invoice_id) {
        query = query.eq('invoice_id', filters.invoice_id);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.outlet_id) {
        query = query.eq('outlet_id', filters.outlet_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payments:', error);
        throw new Error(error.message || 'Failed to fetch payments');
      }

      return (data || []).map((payment: any) => ({
        id: payment.id,
        payment_number: payment.payment_number,
        invoice_id: payment.invoice_id,
        customer_id: payment.customer_id,
        outlet_id: payment.outlet_id,
        payment_date: payment.payment_date,
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        notes: payment.notes,
        created_by: payment.created_by,
        created_at: payment.created_at,
        deleted_at: payment.deleted_at,
        invoice_number: payment.invoices?.invoice_number,
        customer_name: payment.customers?.contact_person || payment.customers?.company_name
      } as Payment & { invoice_number?: string; customer_name?: string }));
    } catch (error: any) {
      console.error('Error in getPayments:', error);
      throw new Error(error.message || 'Failed to fetch payments');
    }
  }

  /**
   * Get payments for a specific invoice
   */
  static async getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Error fetching payments for invoice:', error);
        throw new Error(error.message || 'Failed to fetch payments');
      }

      return (data || []).map((payment: any) => ({
        id: payment.id,
        payment_number: payment.payment_number,
        invoice_id: payment.invoice_id,
        customer_id: payment.customer_id,
        outlet_id: payment.outlet_id,
        payment_date: payment.payment_date,
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        notes: payment.notes,
        created_by: payment.created_by,
        created_at: payment.created_at,
        deleted_at: payment.deleted_at
      }));
    } catch (error: any) {
      console.error('Error in getPaymentsForInvoice:', error);
      throw new Error(error.message || 'Failed to fetch payments');
    }
  }

  /**
   * Soft delete a payment and recalculate invoice totals
   */
  static async softDeletePayment(paymentId: string): Promise<{ payment: Payment; invoice: Invoice }> {
    try {
      // Get payment to find invoice_id
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('id, invoice_id')
        .eq('id', paymentId)
        .maybeSingle();

      if (paymentError) {
        console.error('Error fetching payment:', paymentError);
        throw new Error('Failed to fetch payment');
      }

      if (!paymentData) {
        throw new Error('Payment not found');
      }

      // Soft delete: set deleted_at
      const { data: deletedPayment, error: deleteError } = await supabase
        .from('payments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', paymentId)
        .select()
        .maybeSingle();

      if (deleteError) {
        console.error('Error soft deleting payment:', deleteError);
        throw new Error('Failed to delete payment');
      }

      if (!deletedPayment) {
        throw new Error('Failed to delete payment');
      }

      // Get invoice to recalculate totals
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, payment_received, payment_status')
        .eq('id', paymentData.invoice_id)
        .maybeSingle();

      if (invoiceError) {
        console.error('Error fetching invoice:', invoiceError);
        throw new Error('Failed to fetch invoice');
      }

      if (!invoiceData) {
        throw new Error('Invoice not found');
      }

      // Recalculate invoice payment_received by summing all non-deleted payments
      const { data: allPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', paymentData.invoice_id)
        .is('deleted_at', null);

      if (paymentsError) {
        console.error('Error fetching payments for recalculation:', paymentsError);
        throw new Error('Failed to recalculate invoice totals');
      }

      const paymentReceived = (allPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Update invoice.payment_status based on payment_received
      let paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';
      if (paymentReceived === 0) {
        paymentStatus = 'pending';
      } else if (paymentReceived >= invoiceData.total_amount) {
        paymentStatus = 'paid';
      } else {
        paymentStatus = 'partial';
      }

      // Update invoice with recalculated values
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          payment_received: paymentReceived,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentData.invoice_id)
        .select('id, invoice_number, payment_received, payment_status, total_amount')
        .maybeSingle();

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        throw new Error('Failed to update invoice totals');
      }

      if (!updatedInvoice) {
        throw new Error('Failed to update invoice');
      }

      return {
        payment: {
          id: deletedPayment.id,
          payment_number: deletedPayment.payment_number,
          invoice_id: deletedPayment.invoice_id,
          customer_id: deletedPayment.customer_id,
          outlet_id: deletedPayment.outlet_id,
          payment_date: deletedPayment.payment_date,
          amount: Number(deletedPayment.amount),
          payment_method: deletedPayment.payment_method,
          reference_number: deletedPayment.reference_number,
          notes: deletedPayment.notes,
          created_by: deletedPayment.created_by,
          created_at: deletedPayment.created_at,
          deleted_at: deletedPayment.deleted_at
        },
        invoice: {
          id: updatedInvoice.id,
          invoice_number: updatedInvoice.invoice_number,
          payment_received: Number(updatedInvoice.payment_received),
          payment_status: updatedInvoice.payment_status as 'pending' | 'partial' | 'paid' | 'overdue',
          total_amount: Number(updatedInvoice.total_amount)
        }
      };
    } catch (error: any) {
      console.error('Error in softDeletePayment:', error);
      throw new Error(error.message || 'Failed to delete payment');
    }
  }
}

