// ============================================================================
// AUTH LAYOUT COMPONENT
// ============================================================================

import React from 'react';
import Icon from '../AppIcon';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
            <div className="mb-8">
              <div className="w-16 h-16 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Icon name="package" size={32} className="text-primary-foreground" />
              </div>
              <h1 className="text-4xl font-bold mb-2">Hybits CRM</h1>
              <p className="text-primary-foreground/80 text-lg">
                Complete Rental Management Solution
              </p>
            </div>
            
            <div className="space-y-4 text-left max-w-md">
              <div className="flex items-center space-x-3">
                <Icon name="check-circle" size={20} className="text-green-400 flex-shrink-0" />
                <span>Inventory Management</span>
              </div>
              <div className="flex items-center space-x-3">
                <Icon name="check-circle" size={20} className="text-green-400 flex-shrink-0" />
                <span>Customer Relationship Management</span>
              </div>
              <div className="flex items-center space-x-3">
                <Icon name="check-circle" size={20} className="text-green-400 flex-shrink-0" />
                <span>Order & Billing Management</span>
              </div>
              <div className="flex items-center space-x-3">
                <Icon name="check-circle" size={20} className="text-green-400 flex-shrink-0" />
                <span>Delivery Scheduling</span>
              </div>
              <div className="flex items-center space-x-3">
                <Icon name="check-circle" size={20} className="text-green-400 flex-shrink-0" />
                <span>Multi-location Support</span>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-10 right-10 w-32 h-32 bg-primary-foreground/10 rounded-full" />
          <div className="absolute bottom-10 left-10 w-24 h-24 bg-primary-foreground/10 rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-primary-foreground/10 rounded-full" />
        </div>

        {/* Right side - Auth form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Icon name="package" size={24} className="text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Hybits CRM</h1>
            </div>
            
            <div className="bg-card border border-border rounded-lg shadow-lg p-8">
              {children}
            </div>
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>© 2024 Hybits. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;