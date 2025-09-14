import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import ProtectedRoute from "components/ProtectedRoute";
import NotFound from "pages/NotFound";
import InventoryManagementSystem from './pages/inventory-management-system';
import InventoryItemCreation from './pages/inventory-item-creation';
import AuthenticationRoleSelection from './pages/authentication-role-selection';
import ExecutiveDashboard from './pages/executive-dashboard';
import CustomerRelationshipManagement from './pages/customer-relationship-management';
import CustomerCreation from './pages/customer-creation';
import RentalOrderManagement from './pages/rental-order-management';
import OrderCreation from './pages/order-creation';
import ScheduleDelivery from './pages/schedule-delivery';
import GSTCompliantBillingSystem from './pages/gst-compliant-billing-system';
import InvoiceCreation from './pages/invoice-creation';
import LocationManagement from './pages/location-management';
import UserManagement from './pages/user-management';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Public routes */}
        <Route path="/" element={<AuthenticationRoleSelection />} />
        <Route path="/authentication-role-selection" element={<AuthenticationRoleSelection />} />
        
        {/* Protected routes with role-based access */}
        <Route path="/executive-dashboard" element={
          <ProtectedRoute requiredRole="manager">
            <ExecutiveDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/customer-relationship-management" element={
          <ProtectedRoute requiredRole="manager">
            <CustomerRelationshipManagement />
          </ProtectedRoute>
        } />
        
        <Route path="/customer-creation" element={
          <ProtectedRoute requiredRole="manager">
            <CustomerCreation />
          </ProtectedRoute>
        } />
        
        <Route path="/rental-order-management" element={
          <ProtectedRoute requiredRole="manager">
            <RentalOrderManagement />
          </ProtectedRoute>
        } />
        
        <Route path="/order-creation" element={
          <ProtectedRoute requiredRole="manager">
            <OrderCreation />
          </ProtectedRoute>
        } />
        
        <Route path="/schedule-delivery" element={
          <ProtectedRoute requiredRole="manager">
            <ScheduleDelivery />
          </ProtectedRoute>
        } />
        
        <Route path="/inventory-management-system" element={
          <ProtectedRoute requiredRole="manager">
            <InventoryManagementSystem />
          </ProtectedRoute>
        } />
        
        <Route path="/inventory-item-creation" element={
          <ProtectedRoute requiredRole="manager">
            <InventoryItemCreation />
          </ProtectedRoute>
        } />
        
        <Route path="/gst-compliant-billing-system" element={
          <ProtectedRoute requiredRole="manager">
            <GSTCompliantBillingSystem />
          </ProtectedRoute>
        } />
        
        <Route path="/invoice-creation" element={
          <ProtectedRoute requiredRole="manager">
            <InvoiceCreation />
          </ProtectedRoute>
        } />
        
        <Route path="/location-management" element={
          <ProtectedRoute requiredRole="admin">
            <LocationManagement />
          </ProtectedRoute>
        } />
        
        <Route path="/user-management" element={
          <ProtectedRoute requiredRole="admin">
            <UserManagement />
          </ProtectedRoute>
        } />
        
        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
