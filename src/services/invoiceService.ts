// ============================================================================
// INVOICE SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';
import { CodeGeneratorService } from './codeGeneratorService';

export interface InvoiceFormData {
  customer_id: string;
  invoice_date: string;
  due_date: string;
  items: InvoiceItemFormData[];
  notes?: string;
}

export interface InvoiceItemFormData {
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  total_gst: number;
  total_amount: number;
  payment_status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItemFormData[];
}

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(invoiceData: InvoiceFormData): Promise<Invoice> {
    try {
      // Generate invoice number automatically
      const invoiceNumber = await CodeGeneratorService.generateCode('invoice');

      // Calculate totals
      const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const totalGst = invoiceData.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.rate;
        return sum + (itemTotal * item.gst_rate / 100);
      }, 0);
      const totalAmount = subtotal + totalGst;

      const insertData = {
        invoice_number: invoiceNumber,
        customer_id: invoiceData.customer_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        subtotal: subtotal,
        total_gst: totalGst,
        total_amount: totalAmount,
        payment_status: 'pending',
        notes: invoiceData.notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from('invoices')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating invoice:', error);
        throw new Error(error.message);
      }

      // Create invoice items
      if (invoiceData.items.length > 0) {
        const invoiceItems = invoiceData.items.map(item => ({
          invoice_id: data.id,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          total_amount: (item.quantity * item.rate) + (item.quantity * item.rate * item.gst_rate / 100)
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);

        if (itemsError) {
          console.error('Error creating invoice items:', itemsError);
          throw new Error(itemsError.message);
        }
      }

      return {
        ...data,
        items: invoiceData.items
      };
    } catch (error: any) {
      console.error('Error in createInvoice:', error);
      throw new Error(error.message || 'Failed to create invoice');
    }
  }

  /**
   * Get all invoices
   */
  static async getInvoices(): Promise<Invoice[]> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers(contact_person),
          invoice_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        throw new Error(error.message);
      }

      return (data || []).map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        customer_name: invoice.customers?.contact_person,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        subtotal: invoice.subtotal,
        total_gst: invoice.total_gst,
        total_amount: invoice.total_amount,
        payment_status: invoice.payment_status,
        notes: invoice.notes,
        created_at: invoice.created_at,
        updated_at: invoice.updated_at,
        items: invoice.invoice_items || []
      }));
    } catch (error: any) {
      console.error('Error in getInvoices:', error);
      throw new Error(error.message || 'Failed to fetch invoices');
    }
  }

  /**
   * Get a single invoice by ID
   */
  static async getInvoice(id: string): Promise<Invoice> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers(contact_person),
          invoice_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching invoice:', error);
        throw new Error(error.message);
      }

      return {
        id: data.id,
        invoice_number: data.invoice_number,
        customer_id: data.customer_id,
        customer_name: data.customers?.contact_person,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        subtotal: data.subtotal,
        total_gst: data.total_gst,
        total_amount: data.total_amount,
        payment_status: data.payment_status,
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items: data.invoice_items || []
      };
    } catch (error: any) {
      console.error('Error in getInvoice:', error);
      throw new Error(error.message || 'Failed to fetch invoice');
    }
  }
}
