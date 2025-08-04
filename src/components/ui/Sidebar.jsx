import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';

const Sidebar = ({ isCollapsed = false, onToggle, user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navigationItems = [
    {
      label: 'Dashboard',
      path: '/executive-dashboard',
      icon: 'BarChart3',
      tooltip: 'Executive command center with real-time KPIs',
      roles: ['executive', 'manager', 'admin']
    },
    {
      label: 'Customers',
      path: '/customer-relationship-management',
      icon: 'Users',
      tooltip: 'Customer relationship and lead management',
      roles: ['executive', 'manager', 'sales', 'admin']
    },
    {
      label: 'Orders',
      path: '/rental-order-management',
      icon: 'ShoppingCart',
      tooltip: 'Rental order processing and tracking',
      roles: ['executive', 'manager', 'operations', 'admin']
    },
    {
      label: 'Inventory',
      path: '/inventory-management-system',
      icon: 'Package',
      tooltip: 'Stock tracking and inventory management',
      roles: ['executive', 'manager', 'operations', 'warehouse', 'admin']
    },
    {
      label: 'Billing',
      path: '/gst-compliant-billing-system',
      icon: 'Receipt',
      tooltip: 'GST-compliant invoicing and tax management',
      roles: ['executive', 'manager', 'accounting', 'admin']
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const filteredNavItems = navigationItems?.filter(item => {
    if (!user?.role) return true;
    return item?.roles?.includes(user?.role?.toLowerCase());
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-0 z-40 bg-surface border-r border-border transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-70'
      } hidden lg:block`}>
        <div className="flex flex-col h-full">
          {/* Toggle Button */}
          <div className="flex items-center justify-end p-4 border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="hover:bg-muted"
            >
              <Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"} size={20} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredNavItems?.map((item) => (
              <div key={item?.path} className="relative group">
                <Button
                  variant={isActive(item?.path) ? "default" : "ghost"}
                  onClick={() => handleNavigation(item?.path)}
                  className={`w-full justify-start h-12 px-3 ${
                    isActive(item?.path) 
                      ? 'bg-primary text-primary-foreground shadow-subtle' 
                      : 'hover:bg-muted text-foreground'
                  } transition-all duration-200`}
                >
                  <Icon 
                    name={item?.icon} 
                    size={20} 
                    className={`${isCollapsed ? '' : 'mr-3'} flex-shrink-0`}
                  />
                  {!isCollapsed && (
                    <span className="font-medium truncate">{item?.label}</span>
                  )}
                </Button>

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg shadow-pronounced opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    <div className="font-medium">{item?.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item?.tooltip}</div>
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-popover rotate-45 border-l border-t border-border"></div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user?.name || 'John Smith'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role || 'Operations Manager'}
                  </p>
                </div>
              )}
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="User" size={16} color="white" />
              </div>
            </div>
          </div>
        </div>
      </aside>
      {/* Mobile Sidebar Overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${isCollapsed ? 'pointer-events-none' : ''}`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isCollapsed ? 'opacity-0' : 'opacity-50'
          }`}
          onClick={onToggle}
        />
        
        {/* Sidebar */}
        <aside className={`absolute left-0 top-0 bottom-0 w-80 bg-surface border-r border-border transform transition-transform duration-300 ${
          isCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Icon name="Building2" size={20} color="white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold text-foreground">Hybits CRM</span>
                  <span className="text-xs text-muted-foreground">Rental Management</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="hover:bg-muted"
              >
                <Icon name="X" size={20} />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {filteredNavItems?.map((item) => (
                <Button
                  key={item?.path}
                  variant={isActive(item?.path) ? "default" : "ghost"}
                  onClick={() => {
                    handleNavigation(item?.path);
                    onToggle();
                  }}
                  className={`w-full justify-start h-12 px-3 ${
                    isActive(item?.path) 
                      ? 'bg-primary text-primary-foreground shadow-subtle' 
                      : 'hover:bg-muted text-foreground'
                  } transition-all duration-200`}
                >
                  <Icon name={item?.icon} size={20} className="mr-3 flex-shrink-0" />
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="font-medium truncate">{item?.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{item?.tooltip}</span>
                  </div>
                </Button>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="User" size={20} color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.name || 'John Smith'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || 'john.smith@hybits.com'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role || 'Operations Manager'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};

export default Sidebar;