// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '../AppIcon';
import { User, NavItem } from '@/types';

interface SidebarProps {
  user?: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const { user: currentUser } = useAuth();

  const navigationItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: 'home',
      roles: ['admin', 'manager']
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: 'package',
      roles: ['admin', 'manager']
    },
    {
      name: 'Customers',
      href: '/customers',
      icon: 'users',
      roles: ['admin', 'manager']
    },
    {
      name: 'Orders',
      href: '/orders',
      icon: 'shopping-cart',
      roles: ['admin', 'manager']
    },
    {
      name: 'Billing',
      href: '/billing',
      icon: 'file-text',
      roles: ['admin', 'manager']
    },
    {
      name: 'Outlets',
      href: '/outlets',
      icon: 'map-pin',
      roles: ['admin', 'manager']
    },
    {
      name: 'Users',
      href: '/users',
      icon: 'user',
      roles: ['admin', 'manager']
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: 'settings',
      roles: ['admin']
    }
  ];

  const filteredNavItems = navigationItems.filter(item => 
    currentUser?.role && item.roles.includes(currentUser.role)
  );

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-40">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center space-x-3">
            <img 
              src="/assets/LOGO.png" 
              alt="Hybits Logo" 
              className="h-10 w-auto"
            />
            <div className="hidden lg:block">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Hybits Suite
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Professional Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => {
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted/30 hover:shadow-sm'
                  }
                `}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        {user && (
          <div className="p-4 border-t border-border bg-gradient-to-r from-muted/30 to-muted/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground text-sm font-bold">
                  {user.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate font-medium capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;