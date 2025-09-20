// ============================================================================
// HEADER COMPONENT
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import Icon from '../AppIcon';
import Button from './Button';
import OutletSelector from './OutletSelector';
import { User } from '@/types';

interface HeaderProps {
  user?: User | null;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:block">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Icon name="zap" size={18} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Hybits Suite
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Business Management Platform
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative">
            <Icon 
              name="search" 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            <input
              type="text"
              placeholder="Search customers, orders, inventory..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2">
          {/* Outlet Selector */}
          <OutletSelector />
          
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="hidden sm:flex"
          >
            <Icon 
              name={theme === 'light' ? 'moon' : 'sun'} 
              size={20} 
            />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative"
          >
            <Icon name="bell" size={20} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
              3
            </span>
          </Button>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground text-sm font-bold">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-foreground">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.role || 'Employee'}
                </p>
              </div>
              <Icon name="chevron-down" size={16} />
            </Button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 backdrop-blur-sm">
                <div className="py-2">
                  <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/20 to-muted/10">
                    <p className="text-sm font-semibold text-foreground">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                  
                  <button className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/20 flex items-center space-x-3 transition-all duration-150">
                    <Icon name="user" size={16} />
                    <span className="font-medium">Profile</span>
                  </button>
                  
                  <button className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/20 flex items-center space-x-3 transition-all duration-150">
                    <Icon name="settings" size={16} />
                    <span className="font-medium">Settings</span>
                  </button>
                  
                  <div className="border-t border-border my-1" />
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50/50 flex items-center space-x-3 transition-all duration-150"
                  >
                    <Icon name="log-out" size={16} />
                    <span className="font-medium">Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;