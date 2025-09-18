// ============================================================================
// COMPONENT-SPECIFIC TYPE DEFINITIONS
// ============================================================================

import { ReactNode } from 'react';

// ============================================================================
// MODAL TYPES
// ============================================================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onSort?: (field: keyof T, direction: 'asc' | 'desc') => void;
  onRowClick?: (item: T) => void;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  className?: string;
}

// ============================================================================
// FORM COMPONENT TYPES
// ============================================================================

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  className?: string;
  children: ReactNode;
}

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// ============================================================================
// CARD TYPES
// ============================================================================

export interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  trend?: number[];
  subtitle?: string;
  loading?: boolean;
}

// ============================================================================
// CHART TYPES
// ============================================================================

export interface ChartProps {
  data: any;
  height?: number;
  className?: string;
  loading?: boolean;
}

export interface LineChartProps extends ChartProps {
  type?: 'line' | 'area';
  showGrid?: boolean;
  showLegend?: boolean;
}

export interface BarChartProps extends ChartProps {
  orientation?: 'horizontal' | 'vertical';
  showGrid?: boolean;
  showLegend?: boolean;
}

export interface PieChartProps extends ChartProps {
  showLegend?: boolean;
  showLabels?: boolean;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface FilterProps {
  onFilterChange: (filters: Record<string, any>) => void;
  onClearFilters: () => void;
  savedPresets?: FilterPreset[];
  className?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  suggestions?: string[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

// ============================================================================
// TOAST TYPES
// ============================================================================

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// ============================================================================
// LOADING TYPES
// ============================================================================

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: ReactNode;
}

// ============================================================================
// EMPTY STATE TYPES
// ============================================================================

export interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ============================================================================
// BADGE TYPES
// ============================================================================

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

// ============================================================================
// TOOLTIP TYPES
// ============================================================================

export interface TooltipProps {
  content: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

// ============================================================================
// DROPDOWN TYPES
// ============================================================================

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onItemClick: (item: DropdownItem) => void;
  className?: string;
}

export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
}
