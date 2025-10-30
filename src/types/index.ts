// ============================================================================
// HYBITS CRM - COMPREHENSIVE TYPE DEFINITIONS
// ============================================================================

// ============================================================================
// CORE USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  is_active: boolean;
  outlet_id?: string; // For managers - limits access to specific outlet
  outlet_name?: string; // For display purposes
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export type UserRole = 'admin' | 'manager';

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  [key: string]: Permission[];
}

export interface AuthContextType {
  user: User | null;
  currentOutlet: Outlet | null;
  availableOutlets: Outlet[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  switchOutlet: (outletId: string) => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
}

// ============================================================================
// LOCATION & ORGANIZATION TYPES
// ============================================================================

export interface Outlet {
  id: string;
  code: string;
  name: string;
  address: Address;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Keep Location for backward compatibility, but it's now an alias for Outlet
export interface Location extends Outlet {}

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

// ============================================================================
// CUSTOMER MANAGEMENT TYPES
// ============================================================================

export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address: Address;
  gstin?: string;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export type CustomerStatus = 'active' | 'inactive' | 'suspended';

// ============================================================================
// INVENTORY MANAGEMENT TYPES
// ============================================================================

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  location_id: string;
  condition: ItemCondition;
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  unit_price: number;
  last_movement?: string;
  image_url?: string;
  thumbnail_url?: string;
  image_alt_text?: string;
  created_at: string;
  updated_at: string;
}

export type ItemCondition = 'excellent' | 'good' | 'fair' | 'damaged' | 'out_of_service';

export interface StockAlert {
  id: string;
  item_id: string;
  item_name: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  current_quantity: number;
  threshold_quantity: number;
  message: string;
  created_at: string;
}

export type AlertType = 'low_stock' | 'out_of_stock' | 'overstock';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  item_count: number;
}

// ============================================================================
// ORDER MANAGEMENT TYPES
// ============================================================================

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  event_date: string;
  event_type: EventType;
  event_duration: number;
  guest_count: number;
  location_type: LocationType;
  items: OrderItem[];
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type EventType = 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other';
export type LocationType = 'indoor' | 'outdoor' | 'both';
export type OrderStatus = 'pending' | 'confirmed' | 'items_dispatched' | 'items_returned' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export interface OrderItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

// ============================================================================
// INVOICE & BILLING TYPES
// ============================================================================

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: Address;
  customer_gstin?: string;
  invoice_date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  amount: number;
}

// ============================================================================
// DELIVERY & SCHEDULING TYPES
// ============================================================================

export interface DeliverySchedule {
  id: string;
  order_id: string;
  delivery_date: string;
  delivery_window: string;
  delivery_type: DeliveryType;
  delivery_address: Address;
  contact_person: string;
  contact_phone: string;
  vehicle_type: VehicleType;
  estimated_duration: number;
  driver_name: string;
  driver_phone: string;
  status: DeliveryStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type DeliveryType = 'pickup' | 'delivery' | 'both';
export type VehicleType = 'small_van' | 'large_van' | 'truck' | 'car';
export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'failed';

// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | undefined;
  label?: string;
  multiline?: boolean;
  rows?: number;
  readOnly?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  label?: string;
  required?: boolean;
  error?: string | undefined;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

// ============================================================================
// LAYOUT COMPONENT TYPES
// ============================================================================

export interface HeaderProps {
  className?: string;
  user?: User | null;
  onLogout?: () => void;
  onRoleSwitch?: () => void;
  onSearch?: (query: string) => void;
}

export interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  user?: User | null;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

// ============================================================================
// THEME & CONTEXT TYPES
// ============================================================================

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// ============================================================================
// NAVIGATION & ROUTING TYPES
// ============================================================================

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles: UserRole[];
  children?: NavItem[];
}

export interface LocationState {
  from?: string;
  message?: string;
  [key: string]: any;
}

// ============================================================================
// API & SERVICE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  dateRange?: string;
  location?: string;
  category?: string;
  [key: string]: any;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormState<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
}

// ============================================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================================

export interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
  overdueInvoices: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingState {
  status: Status;
  message?: string;
}

export type DateRange = {
  start: string;
  end: string;
};

export type SortDirection = 'asc' | 'desc';

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export * from './components';
export * from './api';
export * from './forms';
