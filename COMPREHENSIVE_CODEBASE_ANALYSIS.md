# 🔍 HYBITS CRM - COMPREHENSIVE CODEBASE ANALYSIS
**Date:** November 15, 2025  
**Purpose:** Complete feature, automation, workflow, and dependency analysis for production deployment

---

## 📋 TABLE OF CONTENTS

1. [Features Overview](#features-overview)
2. [Automations & Workflows](#automations--workflows)
3. [Hidden Workflows](#hidden-workflows)
4. [Backend Logic Implementation](#backend-logic-implementation)
5. [Frontend Staff Flows](#frontend-staff-flows)
6. [Role Logic Implementation](#role-logic-implementation)
7. [Outlet ID Dependencies](#outlet-id-dependencies)
8. [User Profiles Dependencies](#user-profiles-dependencies)
9. [Missing & Half-Built Features](#missing--half-built-features)

---

## 1. FEATURES OVERVIEW

### ✅ **Core Features Implemented**

#### 1.1 **Authentication & User Management**
- **Login/Logout** (`src/pages/auth/LoginPage.tsx`)
  - Email/password authentication via Supabase Auth
  - Session management with AuthContext
  - Protected route system
  
- **User Management** (`src/pages/users/`)
  - Create users (admin only) - `AddUserPage.tsx`
  - View all users - `UsersPage.tsx`
  - User roles: admin, manager, accountant
  - User profile management via `user_profiles` table
  - Edge Function: `supabase/functions/manage-users/index.ts` for admin operations

#### 1.2 **Dashboard** (`src/pages/dashboard/DashboardPage.tsx`)
- **Status:** ⚠️ **MOCK DATA ONLY** - Not connected to real data
- Displays:
  - Total Customers (mock: 1247)
  - Active Orders (mock: 89)
  - Total Revenue (mock: ₹24.5L)
  - Pending Orders (mock: 12)
  - Low Stock Items (mock: 8)
  - Overdue Invoices (mock: 3)
- Quick Actions: New Order, Add Customer, Add Inventory, Create Invoice
- **Missing:** Real-time data integration, charts implementation

#### 1.3 **Inventory Management** (`src/pages/inventory/`)
- **Features:**
  - View all inventory items - `InventoryPage.tsx`
  - Create new items - `NewItemPage.tsx`
  - Image upload support (via `imageService.ts`)
  - Stock tracking (total, available, reserved quantities)
  - Category management
  - Location-based inventory
  - Reorder point alerts
- **Service:** `src/services/inventoryService.ts`
- **Database Table:** `inventory_items`

#### 1.4 **Customer Management** (`src/pages/customers/`)
- **Features:**
  - View all customers - `CustomersPage.tsx`
  - Create new customer - `NewCustomerPage.tsx`
  - Customer search and filtering
  - GSTIN tracking
  - Address management
  - Customer status (active/inactive)
- **Service:** `src/services/customerService.ts`
- **Database Table:** `customers`
- **Code Generation:** Auto-generates customer codes (CUST-YYYY-XXXXXX)

#### 1.5 **Order Management** (`src/pages/orders/`)
- **Features:**
  - View all orders - `OrdersPage.tsx`
  - Create new order - `NewOrderPage.tsx`
  - Order status tracking (pending, confirmed, items_dispatched, items_returned, completed, cancelled)
  - Event type management (wedding, corporate, birthday, anniversary, other)
  - Order items management
  - Customer assignment
- **Service:** `src/services/orderService.ts`
- **Database Tables:** `rental_orders`, `rental_order_items`
- **Code Generation:** Auto-generates order numbers (ORD-YYYY-MM-XXXXXX)
- **⚠️ Incomplete:** Order items selection UI (TODO comment in code)

#### 1.6 **Billing & Invoicing** (`src/pages/billing/`)
- **Features:**
  - Billing dashboard - `BillingPage.tsx`
  - Create invoice - `NewInvoicePage.tsx`
  - View invoices - `InvoicesPage.tsx`
  - GST calculation (0%, 5%, 12%, 18%, 28%)
  - Invoice items management
  - Payment status tracking
- **Service:** `src/services/invoiceService.ts`
- **Database Tables:** `invoices`, `invoice_items`
- **Code Generation:** Auto-generates invoice numbers (INV-YYYY-MM-XXXXXX)
- **⚠️ Incomplete:** Invoice creation API call (TODO comment)

#### 1.7 **Vendor Management** (`src/pages/vendors/`)
- **Features:**
  - View all vendors - `VendorsPage.tsx`
  - Create/edit vendor - `VendorFormPage.tsx`
  - Vendor profile view - `VendorProfilePage.tsx`
  - Vendor subscriptions management
  - Vendor payments tracking
  - Deposit ledger
- **Service:** `src/services/billingService.ts` (vendor methods)
- **Database Tables:** `vendors`, `vendor_subscriptions`, `vendor_subscription_items`, `vendor_payments`, `vendor_deposit_ledger`
- **⚠️ Status:** Tables may not exist in database (needs verification)

#### 1.8 **Subscriptions** (`src/pages/subscriptions/`)
- **Features:**
  - Subscription entry - `SubscriptionEntryPage.tsx`
  - View subscriptions - `SubscriptionsPage.tsx`
  - Plan types: 30k, 40k, 60k, custom
  - Subscription items management
  - Security deposit tracking
- **Service:** `src/services/billingService.ts`
- **⚠️ Status:** Uses mock data for plans/subscriptions (not connected to real database)

#### 1.9 **Accounting Module** (`src/pages/AccountingPage.tsx`)
- **Features:**
  - Accounting dashboard
  - Invoice management
  - Payment tracking
- **⚠️ Status:** 
  - Shows for admin/manager (should be accountant ONLY)
  - Route not protected
  - Permissions not implemented

#### 1.10 **Location/Outlet Management** (`src/pages/locations/`, `src/pages/outlets/`)
- **Features:**
  - View locations - `LocationsPage.tsx`
  - View outlets - `OutletsPage.tsx`
  - Add outlet - `AddOutletPage.tsx`
  - Outlet code generation (OUT-XXXX)
- **Service:** `src/services/outletService.ts`, `src/services/locationService.ts`
- **Database Table:** `locations` (outlets are stored here)
- **⚠️ Incomplete:** Outlet creation API call (TODO comment)

#### 1.11 **Reports** (`src/pages/reports/`)
- **Features:**
  - GST Report - `GSTReportPage.tsx`
  - Excel export functionality
- **Service:** `src/services/gstReportService.ts`
- **⚠️ Status:** GST report view (`gst_reports_final`) may not exist

#### 1.12 **Settings** (`src/pages/settings/SettingsPage.tsx`)
- **Features:**
  - System settings (admin only)
  - Theme toggle (light/dark mode)
- **Status:** Basic implementation

---

## 2. AUTOMATIONS & WORKFLOWS

### ✅ **Database-Level Automations**

#### 2.1 **User Profile Auto-Creation**
- **Trigger:** `handle_new_user()` function
- **Location:** Database trigger (should be in migration `010_user_management_triggers.sql`)
- **Workflow:**
  1. User signs up via Supabase Auth
  2. Trigger fires automatically
  3. Creates entry in `user_profiles` table
  4. Copies metadata from auth user
  5. Sets default role and status
- **Status:** ✅ Implemented (via Edge Function fallback if trigger fails)

#### 2.2 **Code Generation Automation**
- **Service:** `src/services/codeGeneratorService.ts`
- **Automated Code Generation:**
  - **Customers:** `CUST-YYYY-XXXXXX` (e.g., CUST-2025-000001)
  - **Inventory Items:** `ITEM-YYYY-XXXXXX`
  - **Orders:** `ORD-YYYY-MM-XXXXXX`
  - **Invoices:** `INV-YYYY-MM-XXXXXX`
  - **Locations:** `LOC-XXXX`
  - **Outlets:** `OUT-XXXX`
  - **Users:** `USR-XXXX`
- **Workflow:**
  1. Service queries latest code from database
  2. Extracts number from last code
  3. Increments by 1
  4. Formats with prefix, year, month (if applicable)
  5. Returns unique code
- **Fallback:** Timestamp-based code if database query fails

#### 2.3 **Stock Movement Automation** (Expected)
- **Trigger:** `update_stock_on_movement()` function
- **Expected Workflow:**
  1. Stock movement record created
  2. Trigger fires automatically
  3. Updates `inventory_items` quantities
  4. Adjusts available/reserved quantities
- **Status:** ⚠️ **Expected but needs verification** - Referenced in production docs but trigger may not exist

### ✅ **Application-Level Automations**

#### 2.4 **Session Management**
- **Location:** `src/contexts/AuthContext.tsx`
- **Automation:**
  - Auto-checks session on app load
  - Auto-loads user profile from `user_profiles`
  - Auto-loads available outlets
  - Auto-sets current outlet based on user's `outlet_id`
  - Persists outlet selection in localStorage

#### 2.5 **Outlet Context Automation**
- **Location:** `src/contexts/AuthContext.tsx`
- **Workflow:**
  1. On login, fetches all outlets user can access
  2. For managers: Filters to their assigned outlet only
  3. For admins: Shows all outlets
  4. Sets current outlet automatically
  5. Allows switching outlets (admin only)

#### 2.6 **Route Protection Automation**
- **Location:** `src/routes/AppRoutes.tsx`
- **Automation:**
  - `ProtectedRoute` component checks authentication
  - Redirects to `/login` if not authenticated
  - Checks permissions for admin-only routes
  - Shows loading state during auth check

#### 2.7 **Permission-Based UI Filtering**
- **Location:** `src/components/ui/Sidebar.tsx`
- **Automation:**
  - Sidebar items filtered by user role
  - Only shows menu items user has access to
  - Updates automatically when user role changes

---

## 3. HIDDEN WORKFLOWS

### 🔍 **Workflows Not Immediately Visible**

#### 3.1 **User Creation Workflow** (Admin → Edge Function → Database)
- **Hidden Steps:**
  1. Admin fills form in `AddUserPage.tsx`
  2. Frontend calls `AuthService.createUser()`
  3. Service invokes Supabase Edge Function `manage-users`
  4. Edge Function validates admin permissions
  5. Creates auth user via Supabase Admin API
  6. Updates `user_profiles` table (bypasses RLS)
  7. Fetches outlet name if `outlet_id` provided
  8. Returns complete user object
- **Files:** `src/services/AuthService.ts`, `supabase/functions/manage-users/index.ts`

#### 3.2 **Order Creation Workflow** (Frontend → Service → Database → Items)
- **Hidden Steps:**
  1. User fills order form
  2. `OrderService.createOrder()` generates order number
  3. Creates order record in `rental_orders`
  4. Creates order items in `rental_order_items` (separate transaction)
  5. Calculates totals
  6. Returns complete order with items
- **Files:** `src/services/orderService.ts`

#### 3.3 **Invoice Creation Workflow** (Frontend → Service → Database → Items → GST)
- **Hidden Steps:**
  1. User fills invoice form
  2. `InvoiceService.createInvoice()` generates invoice number
  3. Calculates subtotal from items
  4. Calculates GST per item (different rates)
  5. Sums total GST
  6. Creates invoice record
  7. Creates invoice items (separate transaction)
  8. Returns complete invoice
- **Files:** `src/services/invoiceService.ts`

#### 3.4 **Customer Address Parsing Workflow**
- **Hidden Steps:**
  1. Database stores address as single string (comma-separated)
  2. Service parses: `street, city, state, pincode, country`
  3. Frontend displays as structured address object
  4. On save, combines back to single string
- **Files:** `src/services/customerService.ts`

#### 3.5 **Inventory Image Upload Workflow**
- **Hidden Steps:**
  1. User uploads image in `NewItemPage.tsx`
  2. `imageService.ts` handles upload to Supabase Storage
  3. Generates thumbnail (if implemented)
  4. Stores URLs in `image_url`, `thumbnail_url`, `image_alt_text`
  5. Saves to database on item creation
- **Files:** `src/services/imageService.ts`

#### 3.6 **Vendor Subscription Calculation Workflow**
- **Hidden Steps:**
  1. User selects plan type (30k/40k/60k/custom)
  2. Adds subscription items (dishes with prices/quantities)
  3. `BillingService.calculateSubscription()` calculates:
   - Total dish value (sum of price × quantity)
   - Monthly fee (based on plan type)
  4. Creates subscription record
  5. Creates subscription items
  6. Records security deposit payment if amount > 0
- **Files:** `src/services/billingService.ts`

---

## 4. BACKEND LOGIC IMPLEMENTATION

### ✅ **Service Layer Architecture**

#### 4.1 **Authentication Service** (`src/services/AuthService.ts`)
- **Methods:**
  - `login()` - Sign in with email/password
  - `register()` - Create new user account
  - `logout()` - Sign out current user
  - `getCurrentUser()` - Get logged-in user
  - `getCurrentSession()` - Get current session
  - `updatePassword()` - Change password
  - `resetPassword()` - Send password reset email
  - `getAllUsers()` - List all users (admin)
  - `createUser()` - Create user via Edge Function (admin)
  - `adminUpdateUser()` - Update user via Edge Function (admin)
  - `deleteUser()` - Delete user via Edge Function (admin)
  - `updateProfile()` - Update own profile
- **Database Tables Used:** `user_profiles`, `auth.users` (via Supabase)
- **Edge Functions:** `manage-users`

#### 4.2 **Customer Service** (`src/services/customerService.ts`)
- **Methods:**
  - `getCustomers()` - List all customers
  - `getCustomer(id)` - Get single customer
  - `createCustomer()` - Create new customer
  - `updateCustomer()` - Update customer
  - `deleteCustomer()` - Soft delete (sets is_active=false)
- **Database Tables Used:** `customers`
- **Code Generation:** Auto-generates customer codes

#### 4.3 **Inventory Service** (`src/services/inventoryService.ts`)
- **Methods:**
  - `getInventoryItems()` - List all items
  - `getInventoryItem(id)` - Get single item
  - `createInventoryItem()` - Create new item
  - `updateInventoryItem()` - Update item
  - `deleteInventoryItem()` - Hard delete
  - `updateStock()` - Update stock quantities (add/remove/set)
- **Database Tables Used:** `inventory_items`
- **Code Generation:** Auto-generates item codes
- **Image Support:** Handles image URLs

#### 4.4 **Order Service** (`src/services/orderService.ts`)
- **Methods:**
  - `createOrder()` - Create new order with items
  - `getOrders()` - List all orders
  - `getOrder(id)` - Get single order
  - `updateOrder()` - Update order
  - `deleteOrder()` - Delete order
- **Database Tables Used:** `rental_orders`, `rental_order_items`
- **Code Generation:** Auto-generates order numbers
- **Business Logic:** Calculates totals, handles order items

#### 4.5 **Invoice Service** (`src/services/invoiceService.ts`)
- **Methods:**
  - `createInvoice()` - Create invoice with items and GST
  - `getInvoices()` - List all invoices
  - `getInvoice(id)` - Get single invoice
- **Database Tables Used:** `invoices`, `invoice_items`
- **Code Generation:** Auto-generates invoice numbers
- **Business Logic:** GST calculation per item, totals

#### 4.6 **Billing Service** (`src/services/billingService.ts`)
- **Methods:**
  - **Plans:** `getPlans()`, `getAllPlans()`, `getPlan()`, `createPlan()`, `updatePlan()`, `deletePlan()`
  - **Subscriptions:** `getUserSubscription()`, `getAllSubscriptions()`, `createSubscription()`, `cancelSubscription()`
  - **Invoices:** `getInvoices()`, `getAllInvoices()`, `getBillingStats()`
  - **Vendors:** `getVendors()`, `getVendorById()`, `createVendor()`, `updateVendor()`, `deleteVendor()`
  - **Vendor Subscriptions:** `createVendorSubscription()`, `getVendorSubscriptions()`, `getVendorSubscriptionsByVendorId()`
  - **Vendor Payments:** `createVendorPayment()`, `getSubscriptionPayments()`, `getVendorPayments()`
  - **Deposit Ledger:** `addVendorDepositEntry()`, `getVendorDepositLedger()`
  - **Calculations:** `calculateSubscription()`
- **Database Tables Used:** `vendors`, `vendor_subscriptions`, `vendor_subscription_items`, `vendor_payments`, `vendor_deposit_ledger`
- **⚠️ Status:** Many methods use mock data (plans, subscriptions, invoices)

#### 4.7 **Outlet Service** (`src/services/outletService.ts`)
- **Methods:**
  - `getAllOutlets()` - List all outlets
  - `getOutletById(id)` - Get single outlet
  - `createOutlet()` - Create outlet (incomplete)
  - `updateOutlet()` - Update outlet
- **Database Tables Used:** `locations` (outlets stored here)

#### 4.8 **Location Service** (`src/services/locationService.ts`)
- **Methods:** Similar to outlet service
- **Database Tables Used:** `locations`

#### 4.9 **Code Generator Service** (`src/services/codeGeneratorService.ts`)
- **Methods:**
  - `generateCode(entityType)` - Generate unique code for entity
  - `generateMultipleCodes()` - Generate multiple codes
- **Supported Entities:** customer, inventory_item, order, invoice, location, outlet, user
- **Logic:** Queries latest code, extracts number, increments, formats

#### 4.10 **GST Report Service** (`src/services/gstReportService.ts`)
- **Methods:** GST report generation and Excel export
- **Database Views Used:** `gst_reports_final` (may not exist)

#### 4.11 **Image Service** (`src/services/imageService.ts`)
- **Methods:** Image upload to Supabase Storage
- **Storage:** Supabase Storage buckets

### ✅ **Edge Functions**

#### 4.12 **Manage Users Edge Function** (`supabase/functions/manage-users/index.ts`)
- **Actions:**
  - `createUser` - Admin creates user (bypasses RLS)
  - `updateUser` - Admin updates user
  - `deleteUser` - Admin deletes user
- **Security:** Validates admin role before allowing operations
- **Uses:** Service role key for admin operations

---

## 5. FRONTEND STAFF FLOWS

### 👥 **Admin User Flows**

#### 5.1 **Login Flow**
1. Navigate to `/login`
2. Enter email/password
3. `AuthService.login()` authenticates
4. Fetches user profile from `user_profiles`
5. Loads all available outlets
6. Redirects to `/dashboard`

#### 5.2 **Dashboard Flow**
1. View mock statistics (not real data)
2. Quick actions: New Order, Add Customer, Add Inventory, Create Invoice
3. View recent orders (mock data)
4. Revenue chart placeholder (not implemented)

#### 5.3 **User Management Flow**
1. Navigate to `/users`
2. View all users in table
3. Click "Add User" → `/users/new`
4. Fill form (email, name, role, phone, outlet)
5. Submit → Edge Function creates user
6. Redirects to `/users`

#### 5.4 **Customer Management Flow**
1. Navigate to `/customers`
2. View all customers (searchable/filterable)
3. Click "Add Customer" → `/customers/new`
4. Fill form (name, email, phone, address, GSTIN)
5. Submit → Auto-generates customer code
6. Creates customer in database
7. Redirects to `/customers`

#### 5.5 **Inventory Management Flow**
1. Navigate to `/inventory`
2. View all items (with images, stock levels)
3. Click "Add Item" → `/inventory/new`
4. Fill form (name, category, location, quantity, price, image)
5. Upload image (optional)
6. Submit → Auto-generates item code
7. Creates item in database
8. Redirects to `/inventory`

#### 5.6 **Order Creation Flow**
1. Navigate to `/orders`
2. Click "New Order" → `/orders/new`
3. Select customer (or add new)
4. Fill event details (date, type, duration, guest count, location type)
5. **⚠️ TODO:** Add inventory items selection (not implemented)
6. Submit → Auto-generates order number
7. Creates order and order items
8. Redirects to `/orders`

#### 5.7 **Invoice Creation Flow**
1. Navigate to `/billing` or `/accounting/invoice/new`
2. Click "New Invoice" → `/billing/invoice/new`
3. Select customer
4. Add invoice items (description, quantity, rate, GST rate)
5. System calculates subtotal and GST automatically
6. **⚠️ TODO:** Submit button has TODO - no API call implemented
7. Should create invoice in database

#### 5.8 **Vendor Management Flow**
1. Navigate to `/vendors`
2. View all vendors
3. Click "Add Vendor" → `/vendors/new`
4. Fill vendor form
5. Submit → Creates vendor
6. View vendor profile → `/vendors/:id`
7. Manage subscriptions and payments

#### 5.9 **Outlet Management Flow**
1. Navigate to `/outlets`
2. View all outlets
3. Click "Add Outlet" → `/outlets/new`
4. Fill outlet form (name, address, contact info)
5. **⚠️ TODO:** Submit has TODO - no API call implemented
6. Should create outlet in database

### 👤 **Manager User Flows**

#### 5.10 **Manager Login Flow**
1. Same as admin login
2. System filters outlets to manager's assigned outlet only
3. Sets current outlet automatically

#### 5.11 **Manager Dashboard Flow**
1. Same dashboard as admin
2. But data should be filtered by outlet (may not be implemented)

#### 5.12 **Manager Restricted Access**
- **Can Access:** Dashboard, Inventory, Customers, Orders, Billing, Locations (read), Outlets (read), Reports (read)
- **Cannot Access:** Users, Settings (admin only)
- **Outlet Restriction:** Should only see data for their assigned outlet

---

## 6. ROLE LOGIC IMPLEMENTATION

### 🔐 **Role Definitions**

#### 6.1 **User Roles** (`src/types/index.ts`)
```typescript
export type UserRole = 'admin' | 'manager' | 'accountant';
```
- **admin:** Full system access
- **manager:** Limited to assigned outlet
- **accountant:** Accounting module only (⚠️ NOT IMPLEMENTED)

#### 6.2 **Permission System** (`src/utils/permissions.ts`)

**Admin Permissions:**
```typescript
{
  dashboard: ['read'],
  inventory: ['read', 'create', 'update', 'delete'],
  customers: ['read', 'create', 'update', 'delete'],
  orders: ['read', 'create', 'update', 'delete'],
  billing: ['read', 'create', 'update', 'delete'],
  locations: ['read', 'create', 'update', 'delete'],
  outlets: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'delete'],
  settings: ['read', 'update'],
  reports: ['read', 'export'],
  analytics: ['read']
}
```

**Manager Permissions:**
```typescript
{
  dashboard: ['read'],
  inventory: ['read', 'create', 'update'], // No delete
  customers: ['read', 'create', 'update'], // No delete
  orders: ['read', 'create', 'update'], // No delete
  billing: ['read', 'create', 'update'], // No delete
  locations: ['read'], // Read only
  outlets: ['read'], // Read only
  settings: ['read'], // Read only
  reports: ['read'], // Read only
  analytics: ['read']
}
```

**Accountant Permissions:**
```typescript
// ⚠️ NOT DEFINED - Missing from ROLE_PERMISSIONS
```

#### 6.3 **Permission Functions**

**`hasPermission(role, resource, action)`**
- Checks if user role has permission for resource/action
- Used in route protection and UI rendering

**`canAccessOutlet(role, userOutletId, targetOutletId)`**
- Admin: Can access all outlets (returns true)
- Manager: Can only access their assigned outlet
- Used for outlet-based data filtering

**`getUserResources(role)`**
- Returns list of resources user can access

**`getUserActions(role, resource)`**
- Returns list of actions user can perform on resource

**`isAdmin(role)`** / **`isManager(role)`**
- Helper functions for role checks

#### 6.4 **Role-Based UI Filtering**

**Sidebar Filtering** (`src/components/ui/Sidebar.tsx`):
- Filters navigation items by user role
- Admin sees: Dashboard, Inventory, Customers, Orders, Subscriptions, Vendors, Accounting, Outlets, Users, Settings
- Manager sees: Dashboard, Inventory, Customers, Orders, Subscriptions, Vendors, Accounting, Outlets (no Users, Settings)
- **⚠️ Issue:** Accounting shows for admin/manager (should be accountant only)

**Route Protection** (`src/routes/AppRoutes.tsx`):
- `ProtectedRoute` component checks authentication
- `requireAdmin` flag for admin-only routes
- **⚠️ Issue:** Accounting route not protected

#### 6.5 **Role Logic in Services**

**AuthService:**
- `getAllUsers()` - Admin only (should check permissions)
- `createUser()` - Admin only (via Edge Function)
- `adminUpdateUser()` - Admin only (via Edge Function)
- `deleteUser()` - Admin only (via Edge Function)

**Edge Function (`manage-users`):**
- Validates requester is admin before allowing operations
- Uses service role key for admin operations

#### 6.6 **Outlet-Based Access Control**

**Manager Outlet Restriction:**
- Managers have `outlet_id` in `user_profiles`
- `canAccessOutlet()` function enforces restriction
- **⚠️ Issue:** Database queries may not filter by `outlet_id` for managers
- **⚠️ Issue:** RLS policies may not enforce outlet restrictions

**Admin Outlet Access:**
- Admins have no `outlet_id` (or null)
- Can access all outlets
- Can switch outlets via `switchOutlet()` in AuthContext

---

## 7. OUTLET ID DEPENDENCIES

### 📍 **Where `outlet_id` is Used**

#### 7.1 **User Profiles Table** (`user_profiles`)
- **Column:** `outlet_id` (UUID, nullable)
- **Purpose:** Links manager users to their assigned outlet
- **Used In:**
  - `src/types/index.ts` - User interface
  - `src/services/AuthService.ts` - User profile mapping
  - `src/contexts/AuthContext.tsx` - Outlet assignment
  - `src/pages/users/AddUserPage.tsx` - User creation form
  - `supabase/functions/manage-users/index.ts` - User management

#### 7.2 **User Creation Flow**
- **File:** `src/pages/users/AddUserPage.tsx`
- **Logic:**
  - If role is 'manager', `outlet_id` is required
  - Form validates outlet selection for managers
  - Payload includes `outlet_id` when creating manager
- **Edge Function:** Fetches outlet name and stores in `outlet_name`

#### 7.3 **Auth Context** (`src/contexts/AuthContext.tsx`)
- **Uses `outlet_id` for:**
  - Setting current outlet on login
  - Filtering available outlets for managers
  - Outlet switching (admin only)

#### 7.4 **Permission System** (`src/utils/permissions.ts`)
- **Function:** `canAccessOutlet(role, userOutletId, targetOutletId)`
- **Logic:**
  - Admin: Returns true (can access all)
  - Manager: Returns true only if `userOutletId === targetOutletId`
  - Used for data filtering

#### 7.5 **Database Queries** (Expected but needs verification)
- **Should Filter By `outlet_id` For:**
  - Inventory items (if items are outlet-specific)
  - Orders (if orders are outlet-specific)
  - Customers (if customers are outlet-specific)
  - **⚠️ Status:** May not be implemented in all services

#### 7.6 **RLS Policies** (Expected but needs verification)
- **Should Enforce:**
  - Managers can only see data for their `outlet_id`
  - Admins can see all data
  - **⚠️ Status:** RLS policies may not exist or may not enforce outlet restrictions

#### 7.7 **Locations Table** (`locations`)
- **Relationship:** `outlet_id` references `locations.id`
- **Used For:** Outlet assignment to managers

---

## 8. USER_PROFILES DEPENDENCIES

### 👤 **Where `user_profiles` is Used**

#### 8.1 **Authentication Flow**
- **File:** `src/services/AuthService.ts`
- **Methods Using `user_profiles`:**
  - `login()` - Fetches profile after auth login
  - `register()` - Fetches profile after registration
  - `getCurrentUser()` - Fetches profile for current session
  - `getCurrentSession()` - Fetches profile for session
  - `getAllUsers()` - Lists all profiles
  - `updateUserProfile()` - Updates profile
- **Purpose:** Stores user metadata (role, outlet, phone, etc.)

#### 8.2 **User Profile Structure**
```typescript
{
  id: string; // Matches auth.users.id
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'accountant';
  phone?: string;
  outlet_id?: string; // For managers
  outlet_name?: string; // Denormalized for display
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}
```

#### 8.3 **Auto-Creation Trigger**
- **Expected Trigger:** `handle_new_user()`
- **Location:** Database trigger (migration `010_user_management_triggers.sql`)
- **Workflow:**
  1. User created in `auth.users`
  2. Trigger fires
  3. Creates entry in `user_profiles`
  4. Copies metadata from auth user
- **Fallback:** Edge Function updates profile if trigger fails

#### 8.4 **Edge Function** (`supabase/functions/manage-users/index.ts`)
- **Uses `user_profiles` for:**
  - Validating admin role before operations
  - Creating user profiles
  - Updating user profiles
  - Fetching outlet names for `outlet_name`

#### 8.5 **Auth Context** (`src/contexts/AuthContext.tsx`)
- **Uses `user_profiles` for:**
  - Storing current user object
  - Accessing user role for permissions
  - Accessing `outlet_id` for outlet filtering
  - User display in UI

#### 8.6 **Permission Checks**
- **File:** `src/utils/permissions.ts`
- **Uses:** User role from `user_profiles` for all permission checks

#### 8.7 **UI Components**
- **Sidebar** (`src/components/ui/Sidebar.tsx`):
  - Displays user name and role from profile
  - Filters menu items by role
  
- **Header** (`src/components/ui/Header.tsx`):
  - Displays user info from profile

#### 8.8 **User Management Pages**
- **UsersPage** (`src/pages/users/UsersPage.tsx`):
  - Lists all users from `user_profiles`
  
- **AddUserPage** (`src/pages/users/AddUserPage.tsx`):
  - Creates user via Edge Function
  - Edge Function creates/updates `user_profiles`

#### 8.9 **RLS Policies** (Expected)
- **Should Enforce:**
  - Users can read their own profile
  - Admins can read all profiles
  - **⚠️ Status:** RLS policies may cause recursion issues (see production docs)

---

## 9. MISSING & HALF-BUILT FEATURES

### ❌ **Completely Missing Features**

#### 9.1 **Accountant Role Implementation**
- **Status:** ❌ NOT IMPLEMENTED
- **Missing:**
  - Permissions not defined in `ROLE_PERMISSIONS`
  - Accounting module shows for admin/manager (should be accountant only)
  - Accounting route not protected
  - Sidebar shows Accounting for wrong roles
- **Files to Update:**
  - `src/utils/permissions.ts` - Add accountant permissions
  - `src/components/ui/Sidebar.tsx` - Update Accounting menu item
  - `src/routes/AppRoutes.tsx` - Add route protection
  - `src/pages/AccountingPage.tsx` - Add permission check

#### 9.2 **Real Dashboard Data**
- **Status:** ❌ MOCK DATA ONLY
- **Missing:**
  - Real-time statistics from database
  - Revenue charts implementation
  - Recent orders from database
  - Low stock alerts from database
- **File:** `src/pages/dashboard/DashboardPage.tsx`

#### 9.3 **Order Items Selection UI**
- **Status:** ❌ TODO COMMENT
- **Missing:**
  - UI for selecting inventory items when creating order
  - Items array is empty in order creation
- **File:** `src/pages/orders/NewOrderPage.tsx` (line 88)
- **Code:** `items: [], // TODO: Add inventory items selection`

#### 9.4 **Invoice Creation API Call**
- **Status:** ❌ TODO COMMENT
- **Missing:**
  - Actual API call to create invoice
  - Currently just logs to console
- **File:** `src/pages/billing/NewInvoicePage.tsx` (line 115)
- **Code:** `// TODO: Implement invoice creation API call`

#### 9.5 **Outlet Creation API Call**
- **Status:** ❌ TODO COMMENT
- **Missing:**
  - Actual API call to create outlet
  - Currently just simulates with setTimeout
- **File:** `src/pages/outlets/AddOutletPage.tsx` (line 92)
- **Code:** `// TODO: Implement outlet creation API call`

#### 9.6 **Registration Flow**
- **Status:** ❌ TODO COMMENT
- **Missing:**
  - Registration page/flow not implemented
- **File:** `src/pages/auth/LoginPage.tsx` (line 118)
- **Code:** `// TODO: Implement registration flow`

#### 9.7 **Database Tables**
- **Status:** ❌ MISSING TABLES
- **Missing Tables:**
  - `vendors` (referenced but may not exist)
  - `vendor_subscriptions` (referenced but may not exist)
  - `vendor_subscription_items` (referenced but may not exist)
  - `vendor_payments` (referenced but may not exist)
  - `vendor_deposit_ledger` (referenced but may not exist)
  - `gst_reports_final` VIEW (referenced but may not exist)

#### 9.8 **Database Migrations**
- **Status:** ❌ MIGRATIONS REMOVED
- **Missing:**
  - All SQL migration files removed
  - Database schema not applied
  - RLS policies not created
  - Triggers not created
- **Reference:** `supabase/MIGRATIONS_REFERENCE.md`

#### 9.9 **RLS Policies**
- **Status:** ❌ MISSING POLICIES
- **Missing Policies For:**
  - `inventory_items`
  - `rental_orders`
  - `rental_order_items`
  - `invoices`
  - `invoice_items`
  - `stock_movements`
- **Impact:** Security risk

#### 9.10 **Database Schema Columns**
- **Status:** ❌ SCHEMA MISMATCHES
- **Missing Columns:**
  - `rental_orders`: event_type, event_duration, guest_count, location_type, payment_status, delivery_date, return_date, delivery_address, security_deposit, gst_amount, created_by, updated_at
  - `inventory_items`: rental_price_per_day, available_quantity, reserved_quantity, reorder_point, image_url, thumbnail_url, image_alt_text, condition
  - `locations`: location_code, manager_id, phone, email, gstin, is_active, settings, updated_at
  - `invoices`: subtotal, total_gst, due_date, payment_status, notes, created_by, updated_at

### ⚠️ **Half-Built Features**

#### 9.11 **Billing/Subscription System**
- **Status:** ⚠️ PARTIALLY IMPLEMENTED
- **Issues:**
  - Plans and subscriptions use mock data
  - Not connected to real database
  - Vendor subscriptions may work (if tables exist)
- **Files:** `src/services/billingService.ts`, `src/services/mockBillingData.ts`

#### 9.12 **GST Reporting**
- **Status:** ⚠️ PARTIALLY IMPLEMENTED
- **Issues:**
  - View `gst_reports_final` may not exist
  - Excel export may not work without view
- **File:** `src/services/gstReportService.ts`

#### 9.13 **Manager Outlet Filtering**
- **Status:** ⚠️ LOGIC EXISTS BUT NOT ENFORCED
- **Issues:**
  - `canAccessOutlet()` function exists
  - But database queries may not filter by `outlet_id`
  - RLS policies may not enforce restrictions
- **Files:** `src/utils/permissions.ts`, service files

#### 9.14 **Stock Movement Automation**
- **Status:** ⚠️ EXPECTED BUT NOT VERIFIED
- **Issues:**
  - Trigger `update_stock_on_movement()` referenced in docs
  - But trigger may not exist in database
  - Stock updates may be manual only

#### 9.15 **Image Upload**
- **Status:** ⚠️ SERVICE EXISTS BUT MAY NOT BE FULLY INTEGRATED
- **Issues:**
  - `imageService.ts` exists
  - But thumbnail generation may not be implemented
  - Storage bucket configuration may be missing

#### 9.16 **Delivery Address in Orders**
- **Status:** ⚠️ HARDCODED VALUE
- **Issues:**
  - `delivery_address` set to 'TBD' in order creation
  - TODO comment: "Get from customer or form"
- **File:** `src/services/orderService.ts` (line 43)

#### 9.17 **Order Date Handling**
- **Status:** ⚠️ SIMPLIFIED LOGIC
- **Issues:**
  - `delivery_date` and `return_date` both set to `event_date`
  - Should be calculated based on event duration
- **File:** `src/services/orderService.ts` (lines 41-42)

---

## 📊 SUMMARY STATISTICS

### **Features Status:**
- ✅ **Fully Implemented:** 8 features
- ⚠️ **Partially Implemented:** 6 features
- ❌ **Missing/Incomplete:** 17 features/issues

### **Services:**
- ✅ **11 Services** implemented
- ⚠️ **2 Services** use mock data
- ❌ **1 Edge Function** (manage-users)

### **Database:**
- ✅ **8 Core Tables** expected
- ❌ **5 Vendor Tables** may be missing
- ❌ **Migrations** removed (need to recreate)
- ❌ **RLS Policies** missing for 6+ tables

### **Role Logic:**
- ✅ **Admin Role** - Fully implemented
- ✅ **Manager Role** - Partially implemented (outlet filtering needs verification)
- ❌ **Accountant Role** - Not implemented

---

## 🎯 RECOMMENDATIONS FOR PRODUCTION

### **Critical (Must Fix):**
1. ✅ Implement accountant role permissions
2. ✅ Complete invoice creation API call
3. ✅ Complete outlet creation API call
4. ✅ Add order items selection UI
5. ✅ Connect dashboard to real data
6. ✅ Verify/create database migrations
7. ✅ Add RLS policies for all tables
8. ✅ Fix schema mismatches

### **High Priority:**
1. ✅ Verify manager outlet filtering in queries
2. ✅ Implement delivery address in orders
3. ✅ Fix order date calculations
4. ✅ Verify/create vendor tables
5. ✅ Verify stock movement trigger

### **Medium Priority:**
1. ✅ Complete registration flow
2. ✅ Implement revenue charts
3. ✅ Add thumbnail generation for images
4. ✅ Verify GST report view exists

---

**END OF ANALYSIS**

**Last Updated:** November 15, 2025

