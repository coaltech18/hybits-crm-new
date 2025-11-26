// ============================================================================
// APPLICATION ROUTES
// ============================================================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

// Layout Components
import MainLayout from '@/components/layouts/MainLayout';
import AuthLayout from '@/components/layouts/AuthLayout';

// Page Components
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import InventoryPage from '@/pages/inventory/InventoryPage';
import NewItemPage from '@/pages/inventory/NewItemPage';
import CustomersPage from '@/pages/customers/CustomersPage';
import NewCustomerPage from '@/pages/customers/NewCustomerPage';
import OrdersPage from '@/pages/orders/OrdersPage';
import NewOrderPage from '@/pages/orders/NewOrderPage';
import BillingPage from '@/pages/billing/BillingPage';
import NewInvoicePage from '@/pages/billing/NewInvoicePage';
import InvoicesPage from '@/pages/billing/InvoicesPage';
import SubscriptionsPage from '@/pages/SubscriptionsPage';
import AccountingPage from '@/pages/AccountingPage';
import PaymentsPage from '@/pages/accounting/PaymentsPage';
import InvoiceDetailPage from '@/pages/accounting/InvoiceDetailPage';
import SubscriptionEntryPage from '@/pages/subscriptions/SubscriptionEntryPage';
import CustomerSubscriptionsPage from '@/pages/subscriptions/CustomerSubscriptionsPage';
import NewCustomerSubscriptionPage from '@/pages/subscriptions/NewCustomerSubscriptionPage';
import CustomerSubscriptionDetailPage from '@/pages/subscriptions/CustomerSubscriptionDetailPage';
import VendorsPage from '@/pages/vendors/VendorsPage';
import VendorFormPage from '@/pages/vendors/VendorFormPage';
import VendorProfilePage from '@/pages/vendors/VendorProfilePage';
import LocationsPage from '@/pages/locations/LocationsPage';
import OutletsPage from '@/pages/outlets/OutletsPage';
import AddOutletPage from '@/pages/outlets/AddOutletPage';
import UsersPage from '@/pages/users/UsersPage';
import AddUserPage from '@/pages/users/AddUserPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import GSTReportPage from '@/pages/reports/GSTReportPage';

// Helper function to get default route based on user role
const getDefaultRoute = (role: string): string => {
  switch (role) {
    case 'accountant':
      return '/accounting';
    case 'admin':
    case 'manager':
    default:
      return '/dashboard';
  }
};

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requireAdmin?: boolean;
  allowedRoles?: string[];
}> = ({ 
  children, 
  requireAdmin = false,
  allowedRoles
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires admin
  if (requireAdmin && !hasPermission(user.role, 'users', 'read')) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  // Check if route has allowed roles restriction
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to role-based default route if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return <>{children}</>;
};

// Default Route Component (redirects based on role)
const DefaultRoute: React.FC = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Navigate to={getDefaultRoute(user.role)} replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRoute />} />
        <Route 
          path="dashboard" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/new" element={<NewItemPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/new" element={<NewCustomerPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/invoice/new" element={<NewInvoicePage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/new" element={<SubscriptionEntryPage />} />
        {/* Customer Subscriptions */}
        <Route path="subscriptions/customer" element={<CustomerSubscriptionsPage />} />
        <Route path="subscriptions/customer/new" element={<NewCustomerSubscriptionPage />} />
        <Route path="subscriptions/customer/:id" element={<CustomerSubscriptionDetailPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/new" element={<VendorFormPage />} />
        <Route path="vendors/:id/edit" element={<VendorFormPage />} />
        <Route path="vendors/:id" element={<VendorProfilePage />} />
        <Route 
          path="accounting" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <AccountingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="accounting/invoices" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InvoicesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="accounting/invoices/:id" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InvoiceDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="accounting/payments" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <PaymentsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="accounting/invoice/new" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <NewInvoicePage />
            </ProtectedRoute>
          } 
        />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="outlets/new" element={<AddOutletPage />} />
        <Route 
          path="users" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="users/new" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AddUserPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="settings" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <SettingsPage />
            </ProtectedRoute>
          } 
        />
        <Route path="reports/gst" element={<GSTReportPage />} />
        
        {/* Admin Routes */}
      </Route>

      {/* Legacy Routes (for backward compatibility) */}
      <Route
        path="/executive-dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory-management-system"
        element={
          <ProtectedRoute>
            <MainLayout>
              <InventoryPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer-relationship-management"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CustomersPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rental-order-management"
        element={
          <ProtectedRoute>
            <MainLayout>
              <OrdersPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/gst-compliant-billing-system"
        element={
          <ProtectedRoute>
            <MainLayout>
              <BillingPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/location-management"
        element={
          <ProtectedRoute>
            <MainLayout>
              <LocationsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user-management"
        element={
          <ProtectedRoute>
            <MainLayout>
              <UsersPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
