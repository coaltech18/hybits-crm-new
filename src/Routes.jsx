import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import InventoryManagementSystem from './pages/inventory-management-system';
import AuthenticationRoleSelection from './pages/authentication-role-selection';
import ExecutiveDashboard from './pages/executive-dashboard';
import CustomerRelationshipManagement from './pages/customer-relationship-management';
import RentalOrderManagement from './pages/rental-order-management';
import GSTCompliantBillingSystem from './pages/gst-compliant-billing-system';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<AuthenticationRoleSelection />} />
        <Route path="/inventory-management-system" element={<InventoryManagementSystem />} />
        <Route path="/authentication-role-selection" element={<AuthenticationRoleSelection />} />
        <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
        <Route path="/customer-relationship-management" element={<CustomerRelationshipManagement />} />
        <Route path="/rental-order-management" element={<RentalOrderManagement />} />
        <Route path="/gst-compliant-billing-system" element={<GSTCompliantBillingSystem />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
