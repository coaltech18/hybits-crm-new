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
import SubscriptionEntryPage from '@/pages/subscriptions/SubscriptionEntryPage';
import LocationsPage from '@/pages/locations/LocationsPage';
import OutletsPage from '@/pages/outlets/OutletsPage';
import AddOutletPage from '@/pages/outlets/AddOutletPage';
import UsersPage from '@/pages/users/UsersPage';
import AddUserPage from '@/pages/users/AddUserPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ 
  children, 
  requireAdmin = false 
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

  if (requireAdmin && !hasPermission(user.role, 'settings', 'read')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if already logged in)
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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
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
        <Route path="accounting" element={<AccountingPage />} />
        <Route path="accounting/invoices" element={<InvoicesPage />} />
        <Route path="accounting/invoice/new" element={<NewInvoicePage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="outlets/new" element={<AddOutletPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/new" element={<AddUserPage />} />
        <Route path="settings" element={<SettingsPage />} />
        
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
