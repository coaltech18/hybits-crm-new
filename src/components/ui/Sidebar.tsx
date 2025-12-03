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

  // Debug: Log current user role (remove in production)
  // console.log('Sidebar - Current user role:', currentUser.role);

  // Group navigation items by sections
  const mainNavItems: NavItem[] = [
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
    }
  ];

  const subscriptionNavItems: NavItem[] = [
    {
      name: 'Vendor Subscriptions',
      href: '/subscriptions',
      icon: 'credit-card',
      roles: ['admin', 'manager']
    },
    {
      name: 'Customer Subscriptions',
      href: '/subscriptions/customer',
      icon: 'repeat',
      roles: ['admin', 'manager', 'accountant']
    }
  ];

  const businessNavItems: NavItem[] = [
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
      roles: ['admin']
    }
  ];

  const adminNavItems: NavItem[] = [
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
    },
    {
      name: 'Overdue Runner',
      href: '/admin/overdue-runner',
      icon: 'clock',
      roles: ['admin', 'manager']
    }
  ];

  // Combine all items for filtering
  const navigationItems: NavItem[] = [
    ...mainNavItems,
    ...subscriptionNavItems,
    ...businessNavItems,
    ...adminNavItems
  ];

  // Filter navigation items using hasPermission
  const filteredNavItems = navigationItems.filter(item => {
    // Ensure we have a valid role - if no role, hide all items
    if (!currentUser?.role) {
      return false;
    }

    // Normalize role to ensure exact match (defensive check)
    const userRole = (currentUser.role.toLowerCase().trim() as 'admin' | 'manager' | 'accountant');
    
    // Validate role is one of the expected values - if invalid, hide all items
    if (!['admin', 'manager', 'accountant'].includes(userRole)) {
      return false;
    }
    
    // Map routes to permission resources
    const resourceMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/inventory': 'inventory',
      '/customers': 'customers',
      '/orders': 'orders',
      '/subscriptions': 'billing', // vendor subscriptions uses billing permissions
      '/subscriptions/customer': 'billing', // customer subscriptions uses billing permissions
      '/vendors': 'vendors',
      '/outlets': 'outlets',
      '/accounting': 'accounting',
      '/users': 'users',
      '/settings': 'settings',
    };
    
    const resource = resourceMap[item.href];
    
    // If resource mapping exists, use hasPermission (strict check)
    if (resource) {
      // Special handling for Accounting: show for admin OR if user has accounting read permission
      if (resource === 'accounting') {
        return userRole === 'admin' || hasPermission(userRole, 'accounting', 'read');
      }
      
      // Users and Settings: only show if user has read permission (admin only)
      if (resource === 'users' || resource === 'settings') {
        return hasPermission(userRole, resource, 'read');
      }
      
      // For other resources, check read permission (strict check)
      return hasPermission(userRole, resource, 'read');
    }
    
    // Fallback: if no resource mapping, check if role is in item.roles array
    // This should rarely happen as all routes should be in resourceMap
    return item.roles.map(r => r.toLowerCase()).includes(userRole);
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
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
            {/* Main Navigation Section */}
            <div className="px-3 mb-6">
              {filteredNavItems.filter(item => mainNavItems.some(nav => nav.href === item.href)).map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) => `
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative mb-1
                    ${isActive 
                      ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }
                  `}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon name={item.icon} size={isCollapsed ? 20 : 18} className={isCollapsed ? '' : 'mr-3 flex-shrink-0'} />
                  {!isCollapsed && <span className="transition-opacity duration-200 truncate">{item.name}</span>}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Subscriptions Section */}
            {filteredNavItems.filter(item => subscriptionNavItems.some(nav => nav.href === item.href)).length > 0 && (
              <div className="px-3 mb-6">
                {!isCollapsed && (
                  <div className="px-3 mb-2">
                    <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Subscriptions</p>
                  </div>
                )}
                {filteredNavItems.filter(item => subscriptionNavItems.some(nav => nav.href === item.href)).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `
                      flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative mb-1
                      ${isActive 
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon name={item.icon} size={isCollapsed ? 20 : 18} className={isCollapsed ? '' : 'mr-3 flex-shrink-0'} />
                    {!isCollapsed && <span className="transition-opacity duration-200 truncate">{item.name}</span>}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Business Section */}
            {filteredNavItems.filter(item => businessNavItems.some(nav => nav.href === item.href)).length > 0 && (
              <div className="px-3 mb-6">
                {!isCollapsed && (
                  <div className="px-3 mb-2">
                    <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Business</p>
                  </div>
                )}
                {filteredNavItems.filter(item => businessNavItems.some(nav => nav.href === item.href)).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `
                      flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative mb-1
                      ${isActive 
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon name={item.icon} size={isCollapsed ? 20 : 18} className={isCollapsed ? '' : 'mr-3 flex-shrink-0'} />
                    {!isCollapsed && <span className="transition-opacity duration-200 truncate">{item.name}</span>}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Admin Section */}
            {filteredNavItems.filter(item => adminNavItems.some(nav => nav.href === item.href)).length > 0 && (
              <div className="px-3">
                {!isCollapsed && (
                  <div className="px-3 mb-2">
                    <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Administration</p>
                  </div>
                )}
                {filteredNavItems.filter(item => adminNavItems.some(nav => nav.href === item.href)).map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `
                      flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative mb-1
                      ${isActive 
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon name={item.icon} size={isCollapsed ? 20 : 18} className={isCollapsed ? '' : 'mr-3 flex-shrink-0'} />
                    {!isCollapsed && <span className="transition-opacity duration-200 truncate">{item.name}</span>}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>

          {/* User info */}
          {user && (
            <div className="p-4 border-t border-border bg-gradient-to-r from-muted/30 to-muted/10">
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                <div className={`bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-md flex-shrink-0 ${isCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
                  <span className={`text-primary-foreground font-bold ${isCollapsed ? 'text-xs' : 'text-sm'}`}>
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-medium capitalize">
                      {user.role || 'user'}
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