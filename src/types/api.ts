// ============================================================================
// API & SERVICE TYPE DEFINITIONS
// ============================================================================

// ============================================================================
// HTTP TYPES
// ============================================================================

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface AuthService {
  login: (email: string, password: string) => Promise<{ user: any; session: any }>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<{ user: any; session: any }>;
  getCurrentUser: () => Promise<any>;
  updateProfile: (updates: any) => Promise<any>;
  changePassword: (newPassword: string) => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
}

export interface CustomerService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (customer: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  search: (query: string) => Promise<any[]>;
}

export interface InventoryService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (item: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  updateStock: (id: string, quantity: number) => Promise<any>;
  getStockAlerts: () => Promise<any[]>;
  getCategories: () => Promise<any[]>;
}

export interface OrderService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (order: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  getStatistics: () => Promise<any>;
}

export interface InvoiceService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (invoice: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  send: (id: string) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
}

export interface LocationService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (location: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  getUserLocations: (userId: string) => Promise<any[]>;
}

export interface DeliveryService {
  getAll: (filters?: any) => Promise<any[]>;
  getById: (id: string) => Promise<any>;
  create: (delivery: any) => Promise<any>;
  update: (id: string, updates: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  schedule: (orderIds: string[], deliveryData: any) => Promise<any>;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  filters?: Record<string, any>;
  search?: string;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  key: string;
  tags?: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

// ============================================================================
// FILE UPLOAD TYPES
// ============================================================================

export interface FileUploadOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  multiple?: boolean;
  onProgress?: (progress: number) => void;
  onSuccess?: (file: File, url: string) => void;
  onError?: (error: string) => void;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filename?: string;
  columns?: string[];
  filters?: Record<string, any>;
}

export interface ImportOptions {
  format: 'csv' | 'excel' | 'json';
  file: File;
  mapping?: Record<string, string>;
  onProgress?: (progress: number) => void;
  onSuccess?: (data: any[]) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
}

export interface AnalyticsConfig {
  trackingId: string;
  enabled: boolean;
  debug?: boolean;
  anonymizeIp?: boolean;
}
