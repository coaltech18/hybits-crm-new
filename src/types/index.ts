// ================================================================
// DATABASE TYPES
// ================================================================
// TypeScript types matching the database schema exactly.
// These types represent the data structure in Supabase.
// ================================================================

// ================================================================
// ENUMS
// ================================================================

export type UserRole = 'admin' | 'manager' | 'accountant';
export type ClientType = 'corporate' | 'event';

// ================================================================
// USER & AUTHENTICATION TYPES
// ================================================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ================================================================
// OUTLET TYPES
// ================================================================

export interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ================================================================
// USER OUTLET ASSIGNMENT TYPES
// ================================================================

export interface UserOutletAssignment {
  id: string;
  user_id: string;
  outlet_id: string;
  assigned_at: string;
  assigned_by: string | null;
  // Joined data
  outlets?: Outlet;
}

// ================================================================
// CLIENT TYPES
// ================================================================

export interface Client {
  id: string;
  outlet_id: string;
  client_type: ClientType;
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  gstin: string | null;
  billing_address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data (when fetching with outlets)
  outlets?: Outlet;
  outlet_name?: string;
  outlet_code?: string;
  outlet_city?: string;
}

// ================================================================
// FORM INPUT TYPES
// ================================================================

// Create Client Input
export interface CreateClientInput {
  outlet_id: string;
  client_type: ClientType;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  gstin?: string;
  billing_address?: string;
}

// Update Client Input (partial updates allowed)
export interface UpdateClientInput {
  name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  billing_address?: string;
  // Admin-only fields
  client_type?: ClientType;
  outlet_id?: string;
  is_active?: boolean;
}

// Client Filters for List/Search
export interface ClientFilters {
  client_type?: ClientType;
  outlet_id?: string;
  search?: string; // Search by name or phone
  is_active?: boolean;
}

// Create Outlet Input
export interface CreateOutletInput {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
}

// Update Outlet Input
export interface UpdateOutletInput {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

// Create User Profile Input
export interface CreateUserProfileInput {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  password: string; // For auth.users creation
}

// Update User Profile Input
export interface UpdateUserProfileInput {
  full_name?: string;
  phone?: string;
  role?: UserRole;
  is_active?: boolean;
}

// Assign Manager to Outlet
export interface AssignOutletInput {
  user_id: string;
  outlet_id: string;
}

// ================================================================
// AUTH CONTEXT TYPES
// ================================================================

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  outlets: Outlet[]; // For managers: their assigned outlets
  selectedOutlet: string | null; // Current outlet filter (for managers)
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAccountant: boolean;
}

// ================================================================
// API RESPONSE TYPES
// ================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ================================================================
// VALIDATION ERROR TYPES
// ================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
}

// ================================================================
// SUBSCRIPTION TYPES (PHASE 3)
// ================================================================

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type BillingCycle = 'daily' | 'weekly' | 'monthly';

export interface Subscription {
  id: string;
  outlet_id: string;
  client_id: string;
  billing_cycle: BillingCycle;
  billing_day: number | null;
  start_date: string; // ISO date string
  end_date: string | null;
  status: SubscriptionStatus;
  quantity: number;
  price_per_unit: number;
  next_billing_date: string; // ISO date string
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data (when fetching with details)
  clients?: Client;
  outlets?: Outlet;
  client_name?: string;
  outlet_name?: string;
  outlet_code?: string;
  total_amount?: number; // quantity * price_per_unit
}

export interface CreateSubscriptionInput {
  outlet_id: string;
  client_id: string;
  billing_cycle: BillingCycle;
  billing_day?: number; // Required if monthly
  start_date: string; // ISO date string
  quantity: number;
  price_per_unit: number;
  notes?: string;
}

export interface UpdateSubscriptionInput {
  billing_cycle?: BillingCycle;
  billing_day?: number;
  quantity?: number;
  price_per_unit?: number;
  notes?: string;
  // Admin-only fields
  outlet_id?: string;
  client_id?: string;
}

export interface SubscriptionFilters {
  client_id?: string;
  status?: SubscriptionStatus;
  outlet_id?: string;
}

// ================================================================
// EVENT TYPES (PHASE 4)
// ================================================================

export type EventStatus = 'planned' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  outlet_id: string;
  client_id: string;
  event_name: string;
  event_type: string | null;
  event_date: string; // ISO date string
  guest_count: number | null;
  notes: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data (when fetching with details)
  clients?: Client;
  outlets?: Outlet;
  client_name?: string;
  outlet_name?: string;
  outlet_code?: string;
}

export interface CreateEventInput {
  outlet_id: string;
  client_id: string;
  event_name: string;
  event_type?: string;
  event_date: string; // ISO date string
  guest_count?: number;
  notes?: string;
}

export interface UpdateEventInput {
  event_name?: string;
  event_type?: string;
  event_date?: string; // ISO date string
  guest_count?: number;
  notes?: string;
  status?: EventStatus;
  // Admin-only fields
  outlet_id?: string;
  client_id?: string;
}

export interface EventFilters {
  client_id?: string;
  status?: EventStatus;
  outlet_id?: string;
  date_from?: string;
  date_to?: string;
}

// ================================================================
// INVOICE TYPES (PHASE 5)
// ================================================================

export type InvoiceType = 'subscription' | 'event';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate: number;
  tax_amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  client_id: string;
  outlet_id: string;
  event_id: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  clients?: Client;
  outlets?: Outlet;
  events?: Event;
  client_name?: string;
  outlet_name?: string;
  event_name?: string;
  invoice_items?: InvoiceItem[];
}

export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export interface CreateInvoiceInput {
  invoice_type: InvoiceType;
  client_id: string;
  outlet_id: string;
  event_id?: string | null;
  items: CreateInvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
}

export interface InvoiceFilters {
  invoice_type?: InvoiceType;
  status?: InvoiceStatus;
  client_id?: string;
  outlet_id?: string;
}

// Add payment status (derived, not stored in DB)
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

// Extended invoice with payment info (from view)
export interface InvoiceWithPaymentStatus extends Invoice {
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
}

// ================================================================
// PAYMENT TYPES (PHASE 6)
// ================================================================

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'cheque';

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string; // ISO date string
  reference_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data (from view)
  invoice_number?: string;
  invoice_type?: InvoiceType;
  invoice_total?: number;
  invoice_status?: InvoiceStatus;
  client_name?: string;
  client_phone?: string;
  outlet_name?: string;
  outlet_code?: string;
  recorded_by_name?: string;
}

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string; // ISO date string
  reference_number?: string;
  notes?: string;
}

export interface UpdatePaymentInput {
  amount?: number;
  payment_method?: PaymentMethod;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
}

export interface PaymentFilters {
  invoice_id?: string;
  payment_method?: PaymentMethod;
  date_from?: string;
  date_to?: string;
  outlet_id?: string;
  is_active?: boolean; // Show deleted payments
}

// ================================================================
// INVENTORY TYPES (PHASE 8)
// ================================================================

// Movement type enum
export type MovementType = 'stock_in' | 'allocation' | 'return' | 'damage' | 'loss' | 'adjustment';

// Reference type enum (already defined, but including for inventory context)
export type ReferenceType = 'subscription' | 'event' | 'manual';

// Inventory item
export interface InventoryItem {
  id: string;
  outlet_id: string;
  name: string;
  category: string;
  material: string | null;
  unit: string;
  total_quantity: number;
  available_quantity: number;
  allocated_quantity: number;
  damaged_quantity: number;
  lost_quantity: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  outlet_name?: string;
  outlet_code?: string;
}

// Inventory movement
export interface InventoryMovement {
  id: string;
  outlet_id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type: ReferenceType;
  reference_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined data
  item_name?: string;
  item_category?: string;
  outlet_name?: string;
  reference_name?: string;
  created_by_name?: string;
}

// Inventory allocation
export interface InventoryAllocation {
  id: string;
  outlet_id: string;
  inventory_item_id: string;
  reference_type: ReferenceType;
  reference_id: string;
  allocated_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  item_name?: string;
  item_category?: string;
  outlet_name?: string;
  reference_name?: string;
  outstanding_quantity?: number; // DERIVED from movements
}

// Create inventory item input
export interface CreateInventoryItemInput {
  outlet_id: string;
  name: string;
  category: string;
  material?: string;
  unit?: string;
  initial_stock: number; // Creates stock_in movement
}

// Update inventory item input
export interface UpdateInventoryItemInput {
  name?: string;
  category?: string;
  material?: string;
  unit?: string;
}

// Create stock in input
export interface CreateStockInInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  notes?: string;
}

// Allocate inventory input
export interface AllocateInventoryInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  notes?: string;
}

// Return inventory input
export interface ReturnInventoryInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  notes?: string;
}

// Mark damage input
export interface MarkDamageInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  notes: string; // Mandatory
}

// Mark loss input
export interface MarkLossInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  reference_type: 'subscription' | 'event';
  reference_id: string;
  notes: string; // Mandatory
}

// Adjust inventory input (admin only)
export interface AdjustInventoryInput {
  outlet_id: string;
  inventory_item_id: string;
  quantity: number;
  notes: string; // Mandatory
}

// Inventory filters
export interface InventoryFilters {
  outlet_id?: string;
  category?: string;
  is_active?: boolean;
}

// Movement filters
export interface MovementFilters {
  outlet_id?: string;
  inventory_item_id?: string;
  movement_type?: MovementType;
  reference_type?: ReferenceType;
  reference_id?: string;
  date_from?: string;
  date_to?: string;
}

// ================================================================
// REPORT TYPES (PHASE 7)
// ================================================================

// Aging buckets for outstanding report
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

// Report date filters
export interface ReportDateFilter {
  date_from?: string;
  date_to?: string;
}

// Common report filters
export interface ReportFilters extends ReportDateFilter {
  outlet_id?: string;
}

// Revenue report data
export interface RevenueReportRow {
  report_date: string;
  outlet_id: string;
  outlet_name: string;
  invoice_type: InvoiceType;
  invoice_count: number;
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
}

// Payments report data
export interface PaymentsReportRow {
  report_date: string;
  invoice_id: string;
  outlet_id: string;
  outlet_name: string;
  payment_method: PaymentMethod;
  payment_count: number;
  total_amount: number;
}

// Outstanding aging report data
export interface OutstandingAgingRow {
  invoice_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  client_id: string;
  client_name: string;
  client_phone: string;
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  days_outstanding: number;
  aging_bucket: AgingBucket;
  bucket_order: number;
}

// Subscription MRR data
export interface SubscriptionMRRRow {
  subscription_id: string;
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  client_id: string;
  client_name: string;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  quantity: number;
  price_per_unit: number;
  start_date: string;
  next_billing_date: string;
  cycle_amount: number;
  mrr: number;
  annual_value: number;
}

// Client revenue data
export interface ClientRevenueRow {
  client_id: string;
  client_name: string;
  client_type: ClientType;
  client_phone: string;
  client_email: string | null;
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  invoice_count: number;
  subscription_invoice_count: number;
  event_invoice_count: number;
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  subscription_revenue: number;
  event_revenue: number;
  active_subscriptions: number;
  completed_events: number;
}

// Outlet performance data
export interface OutletPerformanceRow {
  outlet_id: string;
  outlet_name: string;
  outlet_code: string;
  city: string | null;
  state: string | null;
  active_clients: number;
  corporate_clients: number;
  event_clients: number;
  total_invoices: number;
  subscription_invoices: number;
  event_invoices: number;
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  collection_rate_percent: number;
  active_subscriptions: number;
  paused_subscriptions: number;
  cancelled_subscriptions: number;
  mrr: number;
  completed_events: number;
  cancelled_events: number;
  planned_events: number;
}

// Chart data point
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ================================================================
// EXPORT ALL TYPES
// ================================================================

export type {
  // Re-export for convenience
  UserProfile as User,
};
