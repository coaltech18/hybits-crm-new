import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/AppIcon';
import { cn } from '@/utils/cn';

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  user?: any;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { user, sidebarCollapsed } = useAuth();
  const location = useLocation();

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/executive-dashboard',
      icon: 'LayoutDashboard',
      roles: ['manager', 'admin', 'super_admin']
    },
    {
      name: 'Inventory',
      href: '/inventory-management-system',
      icon: 'Package',
      roles: ['operator', 'manager', 'admin', 'super_admin']
    },
    {
      name: 'Customers',
      href: '/customer-relationship-management',
      icon: 'Users',
      roles: ['operator', 'manager', 'admin', 'super_admin']
    },
    {
      name: 'Orders',
      href: '/rental-order-management',
      icon: 'ShoppingCart',
      roles: ['operator', 'manager', 'admin', 'super_admin']
    },
    {
      name: 'Billing',
      href: '/gst-compliant-billing-system',
      icon: 'Receipt',
      roles: ['operator', 'manager', 'admin', 'super_admin']
    },
    {
      name: 'Locations',
      href: '/location-management',
      icon: 'MapPin',
      roles: ['admin', 'super_admin']
    },
    {
      name: 'Users',
      href: '/user-management',
      icon: 'UserCog',
      roles: ['admin', 'super_admin']
    }
  ];

  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className={cn(
      "bg-background border-r border-border transition-all duration-300",
      sidebarCollapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center px-4 py-6 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Icon name="Building2" size={16} className="text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <span className="ml-3 text-lg font-bold text-foreground">Hybits</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon 
                  name={item.icon} 
                  size={20} 
                  className={cn(
                    "flex-shrink-0",
                    sidebarCollapsed ? "" : "mr-3"
                  )}
                />
                {!sidebarCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        {user && !sidebarCollapsed && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
