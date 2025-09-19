// ============================================================================
// FORM TYPE DEFINITIONS
// ============================================================================

// ============================================================================
// BASE FORM TYPES
// ============================================================================

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[];
  helpText?: string;
  className?: string;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'email' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface FormErrors {
  [fieldName: string]: string | undefined;
}

export interface FormState<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  touched: Record<string, boolean>;
}

// ============================================================================
// SPECIFIC FORM TYPES
// ============================================================================

// Customer Form
export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  gstin?: string;
  status: 'active' | 'inactive' | 'suspended';
}

// Inventory Item Form
export interface InventoryItemFormData {
  name: string;
  description?: string;
  category: string;
  location_id: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged' | 'out_of_service';
  total_quantity: number;
  available_quantity: number;
  reorder_point: number;
  unit_price: number;
  image_url?: string;
  thumbnail_url?: string;
  image_alt_text?: string;
}

// Order Form
export interface OrderFormData {
  customer_id: string;
  event_date: string;
  event_type: 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other';
  event_duration: number;
  guest_count: number;
  location_type: 'indoor' | 'outdoor' | 'both';
  items: OrderItemFormData[];
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface OrderItemFormData {
  item_id: string;
  quantity: number;
  rate: number;
}

// Invoice Form
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

// Location Form
export interface LocationFormData {
  code: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  manager_id: string;
}

// User Form
export interface UserFormData {
  email: string;
  full_name: string;
  role: 'admin' | 'manager';
  phone?: string;
  is_active: boolean;
  outlet_id?: string; // For managers
}

// Outlet Form
export interface OutletFormData {
  code: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  manager_id?: string;
  is_active: boolean;
}

// Delivery Schedule Form
export interface DeliveryScheduleFormData {
  order_id: string;
  delivery_date: string;
  delivery_window: string;
  delivery_type: 'pickup' | 'delivery' | 'both';
  delivery_address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contact_person: string;
  contact_phone: string;
  vehicle_type: 'small_van' | 'large_van' | 'truck' | 'car';
  estimated_duration: number;
  driver_name: string;
  driver_phone: string;
  notes?: string;
}

// ============================================================================
// FORM VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
}

// ============================================================================
// FORM HOOK TYPES
// ============================================================================

export interface UseFormOptions<T> {
  initialData: T;
  validationRules?: Record<keyof T, ValidationRule[]>;
  onSubmit: (data: T) => Promise<void> | void;
  onError?: (errors: FormErrors) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface UseFormReturn<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  touched: Record<string, boolean>;
  setValue: (field: keyof T, value: any) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (field: keyof T) => (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  reset: () => void;
  validate: () => ValidationResult;
  validateField: (field: keyof T) => FieldValidationResult;
}

// ============================================================================
// FORM COMPONENT PROPS
// ============================================================================

export interface FormProps<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (field: keyof T, value: any) => void;
  onBlur?: (field: keyof T) => void;
  className?: string;
  children: React.ReactNode;
}

export interface FormFieldComponentProps {
  field: FormField;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  onBlur?: () => void;
  className?: string;
}

// ============================================================================
// SEARCH FORM TYPES
// ============================================================================

export interface SearchFormData {
  query: string;
  filters: Record<string, any>;
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
}

// ============================================================================
// FILTER FORM TYPES
// ============================================================================

export interface FilterFormData {
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string;
  location?: string;
  category?: string;
  [key: string]: any;
}

// ============================================================================
// BULK ACTION FORM TYPES
// ============================================================================

export interface BulkActionFormData {
  action: string;
  selectedIds: string[];
  additionalData?: Record<string, any>;
}

// ============================================================================
// IMPORT/EXPORT FORM TYPES
// ============================================================================

export interface ImportFormData {
  file: File;
  format: 'csv' | 'excel' | 'json';
  mapping: Record<string, string>;
  options: {
    skipFirstRow?: boolean;
    delimiter?: string;
    encoding?: string;
  };
}

export interface ExportFormData {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filename: string;
  columns: string[];
  filters: Record<string, any>;
  options: {
    includeHeaders?: boolean;
    dateFormat?: string;
    numberFormat?: string;
  };
}
