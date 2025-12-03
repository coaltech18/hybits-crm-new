// ============================================================================
// AUDIT SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export interface InvoiceCreationAudit {
  id: number;
  order_id: string;
  invoice_id: string | null;
  outlet_id: string | null;
  requester_id: string | null;
  attempt_integer: number;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export class AuditService {
  /**
   * Fetch invoice creation audit entries for an order
   */
  static async fetchInvoiceCreationAuditForOrder(orderId: string, limit: number = 10): Promise<InvoiceCreationAudit[]> {
    try {
      const { data, error } = await supabase
        .from('invoice_creation_audit')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching invoice creation audit:', error);
        throw error;
      }

      return (data || []) as InvoiceCreationAudit[];
    } catch (error: any) {
      console.error('Error in fetchInvoiceCreationAuditForOrder:', error);
      throw new Error(error.message || 'Failed to fetch invoice creation audit');
    }
  }

  /**
   * Check if order has failed invoice creation attempts
   */
  static async hasFailedInvoiceCreation(orderId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('invoice_creation_audit')
        .select('id')
        .eq('order_id', orderId)
        .eq('success', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking failed invoice creation:', error);
        return false;
      }

      return (data || []).length > 0;
    } catch (error) {
      console.error('Error in hasFailedInvoiceCreation:', error);
      return false;
    }
  }
}

