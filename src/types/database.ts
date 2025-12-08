// ============================================================================
// DATABASE PAYLOAD TYPES
// Types for database insert/update operations
// ============================================================================

// Database payload types for insert/update operations

export interface RentalOrderInsertPayload {
  customer_id: string;
  event_date: string;
  delivery_date?: string;
  return_date?: string;
  event_type: 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other';
  event_duration: number;
  guest_count: number;
  location_type: 'indoor' | 'outdoor' | 'both';
  total_amount: number;
  security_deposit?: number;
  gst_amount: number;
  status: 'pending' | 'confirmed' | 'items_dispatched' | 'items_returned' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes?: string | null;
  created_by?: string | null;
  outlet_id?: string;
}

export interface RentalOrderItemInsertPayload {
  order_id: string;
  item_id: string;
  quantity: number;
  rental_days: number;
  unit_price: number;
  total_price: number;
  gst_rate: number;
}

export interface InvoiceInsertPayload {
  order_id?: string | null;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  invoice_type?: string;
  subtotal: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
  total_amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes?: string | null;
  created_by?: string | null;
  outlet_id?: string | null;
}

export interface InvoiceItemInsertPayload {
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  amount: number;
  hsn_code?: string | null;
  total_amount?: number;
}

