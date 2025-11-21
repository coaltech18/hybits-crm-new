// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import Icon from '../AppIcon';
import { User, NavItem } from '@/types';

interface SidebarProps {
  user?: User | null;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, isCollapsed = false, onToggle }) => {
  const { user: currentUser } = useAuth();

  if (!currentUser?.role) {
    return null;
  }

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
      name: 'Subscriptions',
      href: '/subscriptions',
      icon: 'credit-card',
      roles: ['admin', 'manager']
    },
    {
      name: 'Vendors',
      href: '/vendors',
      icon: 'truck',
      roles: ['admin', 'manager']
    },
    {
      name: 'Accounting',
      href: '/accounting',
      icon: 'dollar-sign',
      roles: ['admin', 'manager', 'accountant']
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
      roles: ['admin']
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: 'settings',
      roles: ['admin']
    }
  ];

  // Filter navigation items using hasPermission
  const filteredNavItems = navigationItems.filter(item => {
    // Map routes to permission resources
    const resourceMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/inventory': 'inventory',
      '/customers': 'customers',
      '/orders': 'orders',
      '/subscriptions': 'billing', // subscriptions uses billing permissions
      '/vendors': 'vendors',
      '/outlets': 'outlets',
      '/accounting': 'accounting',
      '/users': 'users',
      '/settings': 'settings',
    };
    
    const resource = resourceMap[item.href];
    
    // If resource mapping exists, use hasPermission
    if (resource) {
      // Special handling for Accounting: show for admin OR if user has accounting read permission
      if (resource === 'accounting') {
        return currentUser.role === 'admin' || hasPermission(currentUser.role, 'accounting', 'read');
      }
      
      // Users and Settings: only show if user has read permission (admin only)
      if (resource === 'users' || resource === 'settings') {
        return hasPermission(currentUser.role, resource, 'read');
      }
      
      // For other resources, check read permission
      return hasPermission(currentUser.role, resource, 'read');
    }
    
    // Fallback to role-based check for items not in resourceMap
    return item.roles.includes(currentUser.role);
  });

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-card border-r border-border z-50 transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        lg:translate-x-0
        ${!isCollapsed ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center justify-center">
              <img 
                src="/assets/LOGO.png" 
                alt="Hybits Logo" 
                className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-auto' : 'h-10 w-auto'}`}
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted/30 hover:shadow-sm'
                  }
                `}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon name={item.icon} size={isCollapsed ? 20 : 20} />
                {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          {user && (
            <div className="p-4 border-t border-border bg-gradient-to-r from-muted/30 to-muted/10">
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                <div className={`bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm ${isCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
                  <span className={`text-primary-foreground font-bold ${isCollapsed ? 'text-xs' : 'text-sm'}`}>
                    {user.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-medium capitalize">
                      {user.role}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;