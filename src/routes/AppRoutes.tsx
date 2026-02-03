import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { MainLayout } from '@/components/layouts/MainLayout';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';

// Dashboard
import { DashboardPage } from '@/pages/dashboard/DashboardPage';

// Client Pages
import { ClientsPage } from '@/pages/clients/ClientsPage';
import { AddClientPage } from '@/pages/clients/AddClientPage';
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage';
import { EditClientPage } from '@/pages/clients/EditClientPage';

// Subscription Pages
import SubscriptionsPage from '@/pages/subscriptions/SubscriptionsPage';
import AddSubscriptionPage from '@/pages/subscriptions/AddSubscriptionPage';
import EditSubscriptionPage from '@/pages/subscriptions/EditSubscriptionPage';
import SubscriptionDetailPage from '@/pages/subscriptions/SubscriptionDetailPage';

// Event Pages
import EventsPage from '@/pages/events/EventsPage';
import AddEventPage from '@/pages/events/AddEventPage';
import EditEventPage from '@/pages/events/EditEventPage';
import EventDetailPage from '@/pages/events/EventDetailPage';

// Invoice Pages
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import CreateInvoicePage from '@/pages/invoices/CreateInvoicePage';
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage';

// Payment Pages
import PaymentsPage from '@/pages/payments/PaymentsPage';

// Report Pages
import ReportsPage from '@/pages/reports/ReportsPage';
import GSTWorkingReportsPage from '@/pages/reports/GSTWorkingReportsPage';

// Inventory Pages
import InventoryItemsPage from '@/pages/inventory/InventoryItemsPage';
import InventoryMovementsPage from '@/pages/inventory/InventoryMovementsPage';
import InventoryAllocationPage from '@/pages/inventory/InventoryAllocationPage';
import InventoryReportsPage from '@/pages/inventory/InventoryReportsPage';

// Admin Pages
import UsersManagementPage from '@/pages/admin/UsersManagementPage';
import OutletsManagementPage from '@/pages/admin/OutletsManagementPage';
import AccessMatrixPage from '@/pages/admin/AccessMatrixPage';
import ActivityLogsPage from '@/pages/admin/ActivityLogsPage';
import SystemSettingsPage from '@/pages/admin/SystemSettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Clients */}
        <Route
          path="/clients"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/new"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AddClientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <ClientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <EditClientPage />
            </ProtectedRoute>
          }
        />

        {/* Subscriptions */}
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <SubscriptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions/add"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AddSubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <SubscriptionDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <EditSubscriptionPage />
            </ProtectedRoute>
          }
        />

        {/* Events */}
        <Route
          path="/events"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/add"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AddEventPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <EditEventPage />
            </ProtectedRoute>
          }
        />

        {/* Invoices */}
        <Route
          path="/invoices"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/create"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <CreateInvoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InvoiceDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Payments */}
        <Route
          path="/payments"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/gst-working"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <GSTWorkingReportsPage />
            </ProtectedRoute>
          }
        />

        {/* Inventory */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InventoryItemsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/movements"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InventoryMovementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/allocate"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <InventoryAllocationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <InventoryReportsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes - Phase 9 */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/outlets"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <OutletsManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/access-matrix"
          element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AccessMatrixPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity-logs"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
              <ActivityLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SystemSettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Default Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/unauthorized"
        element={
          <div className="flex items-center justify-center min-h-screen bg-brand-bg">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-brand-text">403</h1>
              <p className="text-brand-text/70 mt-2">You don't have permission to access this page</p>
            </div>
          </div>
        }
      />
      <Route
        path="*"
        element={
          <div className="flex items-center justify-center min-h-screen bg-brand-bg">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-brand-text">404</h1>
              <p className="text-brand-text/70 mt-2">Page not found</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
