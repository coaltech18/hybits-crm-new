// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '../AppIcon';
import { User, NavItem } from '@/types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  user?: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, user }) => {
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
    <div className={`fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-40 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="package" size={20} className="text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">Hybits</span>
            </div>
          )}
          
          <button
            onClick={onToggle}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <Icon 
              name={isCollapsed ? 'chevron-right' : 'chevron-left'} 
              size={16} 
            />
          </button>
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
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon name={item.icon} size={20} />
                {!isCollapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        {!isCollapsed && user && (
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