// Common types for the Hybits CRM application

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer';

export interface AuthContextType {
  user: User | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  name: string;
  item_code: string;
  description?: string;
  category: string;
  subcategory?: string;
  location: string;
  condition: 'new' | 'good' | 'fair' | 'poor';
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  unit_price: number;
  last_movement?: string;
  created_at: string;
  updated_at: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  categoryId: string;
}

export interface StockAlert {
  id: string;
  item_id: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'reorder_needed';
  current_quantity: number;
  reorder_point: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  is_resolved: boolean;
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address: Address;
  gstin?: string;
  customer_type: 'individual' | 'business';
  status: 'active' | 'inactive' | 'suspended';
  total_orders: number;
  total_spent: number;
  last_order_date?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  tags?: string[];
}

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

// Order Types
export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  location: string;
  order_date: string;
  delivery_date: string;
  return_date: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
  total_amount: number;
  items: OrderItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'returned' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type DeliveryStatus = 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'returned';

export interface OrderItem {
  id: string;
  item_id: string;
  item_name: string;
  item_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  condition: string;
}

// Invoice Types
export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_gstin?: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
}

// Location Types
export interface Location {
  id: string;
  name: string;
  address: Address;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Dashboard Types
export interface KPIData {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  subtitle: string;
  trend?: boolean;
}

export interface ChartData {
  month: string;
  revenue: number;
  orders: number;
  target: number;
}

export interface InventoryChartData {
  name: string;
  value: number;
  available: number;
  total: number;
  color: string;
}

// Filter Types
export interface FilterState {
  condition: string;
  availability: string;
  stockLevel: string;
}

export interface AppliedFilters {
  condition: string;
  availability: string;
  stockLevel: string;
}

// Component Props Types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success' | 'warning' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs' | 'xl';
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  iconName?: string;
  iconPosition?: 'left' | 'right';
  iconSize?: number | null;
  fullWidth?: boolean;
  asChild?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | undefined;
  label?: string;
  multiline?: boolean;
  rows?: number;
  readOnly?: boolean;
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

// Location state type for navigation
export interface LocationState {
  from?: string;
  message?: string;
  newItem?: any;
  item?: any;
  invoice?: any;
  order?: any;
  orders?: any[];
  [key: string]: any;
}

// API Response Types
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
  hasMore: boolean;
}

// Service Types
export interface InventoryService {
  getInventoryItems: () => Promise<InventoryItem[]>;
  getCategories: () => Promise<Category[]>;
  getStockAlerts: () => Promise<StockAlert[]>;
  updateStockQuantities: (itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
  createItem: (item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) => Promise<InventoryItem>;
  updateItem: (itemId: string, updates: Partial<InventoryItem>) => Promise<InventoryItem>;
  deleteItem: (itemId: string) => Promise<void>;
}

export interface CustomerService {
  getCustomers: () => Promise<Customer[]>;
  getCustomer: (id: string) => Promise<Customer>;
  createCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
}

export interface OrderService {
  getOrders: () => Promise<Order[]>;
  getOrder: (id: string) => Promise<Order>;
  createOrder: (order: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<Order>;
  deleteOrder: (id: string) => Promise<void>;
}

export interface LocationService {
  getLocations: () => Promise<Location[]>;
  getLocation: (id: string) => Promise<Location>;
  createLocation: (location: Omit<Location, 'id' | 'created_at' | 'updated_at'>) => Promise<Location>;
  updateLocation: (id: string, updates: Partial<Location>) => Promise<Location>;
  deleteLocation: (id: string) => Promise<void>;
}

// Utility Types
export type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export type BulkActionType = 'update_status' | 'export' | 'delete' | 'update_category';

export interface BulkActionData {
  actionType: BulkActionType;
  items: string[];
  formData?: Record<string, any>;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

// Theme Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
}
