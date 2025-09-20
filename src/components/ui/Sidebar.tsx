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
        <div className="flex items-center justify-center p-6 border-b border-border">
          <img 
            src="/assets/LOGO.png" 
            alt="Hybits Logo" 
            className="h-10 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => {
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {user.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
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