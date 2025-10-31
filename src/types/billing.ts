// ============================================================================
// BILLING & SUBSCRIPTION TYPES
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name?: string; // For display purposes
  status: SubscriptionStatus;
  start_date: string;
  end_date: string;
  next_billing_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  invoice_number?: string;
  description?: string;
}

export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trialing';
export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

// Form types for creating/editing
export interface PlanFormData {
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  description?: string;
  active: boolean;
}

export interface SubscriptionFormData {
  plan_id: string;
  user_id: string;
}

// API response types
export interface BillingStats {
  totalPlans: number;
  activeSubscriptions: number;
  totalRevenue: number;
  pendingInvoices: number;
}

// ============================================================================
// VENDOR SUBSCRIPTION TYPES
// ============================================================================

export interface Vendor {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  status: 'active' | 'paused' | 'terminated';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  size?: string;
  price_per_piece: number;
  quantity: number;
  total: number;
  status?: 'issued' | 'returned' | 'damaged' | 'lost';
}

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  plan_type: '30k' | '40k' | '60k' | 'custom';
  subscription_start: string;
  subscription_end?: string;
  items?: SubscriptionItem[];
  total_dish_value: number;
  security_deposit_amount: number;
  monthly_fee: number;
  status: 'active' | 'suspended' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionEntryFormData {
  vendor_id: string;
  plan_type: '30k' | '40k' | '60k' | 'custom';
  subscription_start: string;
  items: Omit<SubscriptionItem, 'id' | 'total'>[];
  security_deposit_amount: number;
  monthly_fee?: number; // Required when plan_type is 'custom'
}

export interface SubscriptionCalculation {
  total_dish_value: number;
  monthly_fee: number;
}

export interface VendorPayment {
  id: string;
  subscription_id?: string;
  amount: number;
  payment_type?: 'subscription' | 'deposit' | 'refund' | 'damage';
  payment_mode?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  transaction_ref?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface VendorDepositLedgerEntry {
  id: string;
  vendor_id: string;
  subscription_id?: string;
  entry_type: 'collect' | 'adjust' | 'refund';
  amount: number;
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface VendorFormData {
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  status?: 'active' | 'paused' | 'terminated';
  notes?: string;
}

export interface VendorPaymentFormData {
  subscription_id?: string;
  amount: number;
  payment_type: 'subscription' | 'deposit' | 'refund' | 'damage';
  payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  transaction_ref?: string;
  notes?: string;
}
