// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../ui/Header';
import Sidebar from '../ui/Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar user={user} />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col ml-64">
          {/* Header */}
          <Header user={user} />
          
          {/* Page content */}
          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;