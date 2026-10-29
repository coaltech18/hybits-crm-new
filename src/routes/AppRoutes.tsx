import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { MainLayout } from '@/components/layouts/MainLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Pages are code-split per route; each loads on first visit.

// Auth Pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

// Dashboard
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));

// Client Pages
const ClientsPage = lazy(() => import('@/pages/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const AddClientPage = lazy(() => import('@/pages/clients/AddClientPage').then((m) => ({ default: m.AddClientPage })));
const ClientDetailPage = lazy(() => import('@/pages/clients/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })));
const EditClientPage = lazy(() => import('@/pages/clients/EditClientPage').then((m) => ({ default: m.EditClientPage })));

// Subscription Pages
const SubscriptionsPage = lazy(() => import('@/pages/subscriptions/SubscriptionsPage'));
const AddSubscriptionPage = lazy(() => import('@/pages/subscriptions/AddSubscriptionPage'));
const EditSubscriptionPage = lazy(() => import('@/pages/subscriptions/EditSubscriptionPage'));
const SubscriptionDetailPage = lazy(() => import('@/pages/subscriptions/SubscriptionDetailPage'));

// Event Pages
const EventsPage = lazy(() => import('@/pages/events/EventsPage'));
const AddEventPage = lazy(() => import('@/pages/events/AddEventPage'));
const EditEventPage = lazy(() => import('@/pages/events/EditEventPage'));
const EventDetailPage = lazy(() => import('@/pages/events/EventDetailPage'));

// Invoice Pages
const InvoicesPage = lazy(() => import('@/pages/invoices/InvoicesPage'));
const CreateInvoicePage = lazy(() => import('@/pages/invoices/CreateInvoicePage'));
const EditInvoicePage = lazy(() => import('@/pages/invoices/EditInvoicePage'));
const InvoiceDetailPage = lazy(() => import('@/pages/invoices/InvoiceDetailPage'));

// Payment Pages
const PaymentsPage = lazy(() => import('@/pages/payments/PaymentsPage'));

// Report Pages
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const GSTWorkingReportsPage = lazy(() => import('@/pages/reports/GSTWorkingReportsPage'));

// Inventory Pages
const InventoryItemsPage = lazy(() => import('@/pages/inventory/InventoryItemsPage'));
const InventoryMovementsPage = lazy(() => import('@/pages/inventory/InventoryMovementsPage'));
const InventoryAllocationPage = lazy(() => import('@/pages/inventory/InventoryAllocationPage'));
const InventoryReportsPage = lazy(() => import('@/pages/inventory/InventoryReportsPage'));
const InventoryOverviewPage = lazy(() => import('@/pages/inventory/InventoryOverviewPage'));
const InventoryAuditPage = lazy(() => import('@/pages/inventory/InventoryAuditPage'));
const InventoryAuditDetailPage = lazy(() => import('@/pages/inventory/InventoryAuditDetailPage'));
const InventoryItemDetailPage = lazy(() => import('@/pages/inventory/InventoryItemDetailPage'));

// Admin Pages
const UsersManagementPage = lazy(() => import('@/pages/admin/UsersManagementPage'));
const OutletsManagementPage = lazy(() => import('@/pages/admin/OutletsManagementPage'));
const ActivityLogsPage = lazy(() => import('@/pages/admin/ActivityLogsPage'));
const SystemSettingsPage = lazy(() => import('@/pages/admin/SystemSettingsPage'));

/**
 * Wraps each routed page: a per-route error boundary (reset on navigation so
 * one crashing page doesn't blank the shell) and the lazy-load fallback.
 */
function RouteBoundary() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} variant="section">
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Spinner size="lg" label="Loading page" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

function UnauthorizedPage() {
  useDocumentTitle('No Access');
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-xl py-16">
      <PageHeader
        title="You don't have access to this page"
        description={`${user ? `Your ${user.role} account` : 'Your account'} can't open this page. Ask an admin if you need access.`}
        actions={<Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>}
      />
    </div>
  );
}

function NotFoundPage() {
  useDocumentTitle('Page Not Found');
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl py-16">
      <PageHeader
        title="Page not found"
        description="This address doesn't match any page. It may have been moved, or the link may be wrong."
        actions={<Button onClick={() => navigate('/dashboard')}>Go to dashboard</Button>}
      />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route element={<RouteBoundary />}>
          <Route path="/login" element={<LoginPage />} />
          {/* Public: reached from recovery/invite email links (signs the user in) */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route element={<RouteBoundary />}>
          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
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
          <Route
            path="/invoices/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <EditInvoicePage />
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
                <InventoryOverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/items"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
                <InventoryItemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/items/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
                <InventoryItemDetailPage />
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
          <Route
            path="/inventory/audit"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
                <InventoryAuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/audit/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'accountant']}>
                <InventoryAuditDetailPage />
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
            path="/admin/activity-logs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
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

          {/* 403 / 404 render inside the app shell so navigation stays available */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
