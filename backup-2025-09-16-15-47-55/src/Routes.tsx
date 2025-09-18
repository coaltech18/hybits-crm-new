import React from 'react';
import { useRoutes } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute.tsx';

// Page imports
// import AuthenticationRoleSelection from '@/pages/authentication-role-selection';
import ExecutiveDashboard from '@/pages/executive-dashboard';
import CustomerRelationshipManagement from '@/pages/customer-relationship-management';
import RentalOrderManagement from '@/pages/rental-order-management';
import InventoryManagementSystem from '@/pages/inventory-management-system';
import GSTCompliantBillingSystem from '@/pages/gst-compliant-billing-system';
import UserManagement from '@/pages/user-management';
import LocationManagement from '@/pages/location-management';
import CustomerCreation from '@/pages/customer-creation';
import InventoryItemCreation from '@/pages/inventory-item-creation';
import InvoiceCreation from '@/pages/invoice-creation';
import OrderCreation from '@/pages/order-creation';
import ScheduleDelivery from '@/pages/schedule-delivery';
import NotFound from '@/pages/NotFound';

const Routes: React.FC = () => {
  const element = useRoutes([
    {
      path: '/',
      element: <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Hybits CRM</h1>
          <p className="text-muted-foreground mb-6">Loading...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    },
    {
      path: '/test',
      element: <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Test Page</h1>
          <p className="text-muted-foreground">This is a test page to verify routing works.</p>
        </div>
      </div>
    },
    {
      path: '/executive-dashboard',
      element: (
        <ProtectedRoute>
          <ExecutiveDashboard />
        </ProtectedRoute>
      )
    },
    {
      path: '/customer-relationship-management',
      element: (
        <ProtectedRoute>
          <CustomerRelationshipManagement />
        </ProtectedRoute>
      )
    },
    {
      path: '/rental-order-management',
      element: (
        <ProtectedRoute>
          <RentalOrderManagement />
        </ProtectedRoute>
      )
    },
    {
      path: '/inventory-management-system',
      element: (
        <ProtectedRoute>
          <InventoryManagementSystem />
        </ProtectedRoute>
      )
    },
    {
      path: '/gst-compliant-billing-system',
      element: (
        <ProtectedRoute>
          <GSTCompliantBillingSystem />
        </ProtectedRoute>
      )
    },
    {
      path: '/user-management',
      element: (
        <ProtectedRoute>
          <UserManagement />
        </ProtectedRoute>
      )
    },
    {
      path: '/location-management',
      element: (
        <ProtectedRoute>
          <LocationManagement />
        </ProtectedRoute>
      )
    },
    {
      path: '/customer-creation',
      element: (
        <ProtectedRoute>
          <CustomerCreation />
        </ProtectedRoute>
      )
    },
    {
      path: '/inventory-item-creation',
      element: (
        <ProtectedRoute>
          <InventoryItemCreation />
        </ProtectedRoute>
      )
    },
    {
      path: '/invoice-creation',
      element: (
        <ProtectedRoute>
          <InvoiceCreation />
        </ProtectedRoute>
      )
    },
    {
      path: '/order-creation',
      element: (
        <ProtectedRoute>
          <OrderCreation />
        </ProtectedRoute>
      )
    },
    {
      path: '/schedule-delivery',
      element: (
        <ProtectedRoute>
          <ScheduleDelivery />
        </ProtectedRoute>
      )
    },
    {
      path: '*',
      element: <NotFound />
    }
  ]);

  return element;
};

export default Routes;
