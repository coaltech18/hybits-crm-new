import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import Input from './Input';
import LocationSelector from './LocationSelector';
import ThemeToggle from './ThemeToggle';

const Header = ({ user, notifications = [], onLogout, onRoleSwitch, onSearch, userLocations = [], currentLocation, onLocationSwitch }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const handleSearch = (e) => {
    e?.preventDefault();
    if (searchQuery?.trim() && onSearch) {
      onSearch(searchQuery?.trim());
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e?.target?.value);
  };

  const unreadCount = notifications?.filter(n => !n?.read)?.length;

  const mockNotifications = [
    { id: 1, title: 'New rental order received', message: 'Order #RO-2024-001 requires approval', time: '2 min ago', read: false, type: 'info' },
    { id: 2, title: 'Low inventory alert', message: 'Generator Model X has only 2 units left', time: '15 min ago', read: false, type: 'warning' },
    { id: 3, title: 'Payment received', message: 'Invoice #INV-2024-045 has been paid', time: '1 hour ago', read: true, type: 'success' },
  ];

  const displayNotifications = notifications?.length > 0 ? notifications : mockNotifications;
  const displayUnreadCount = notifications?.length > 0 ? unreadCount : 2;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-subtle">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-subtle">
              <Icon name="Building2" size={22} color="white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">Hybits CRM</span>
              <span className="text-xs text-muted-foreground font-medium">Rental Management</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <Icon 
                name="Search" 
                size={18} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
              />
              <Input
                type="search"
                placeholder="Search customers, orders, inventory..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10 pr-4 py-2 w-full bg-muted border-border focus:bg-surface transition-colors"
              />
            </div>
          </form>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Location Selector */}
          <LocationSelector
            userLocations={userLocations}
            currentLocation={currentLocation}
            onLocationSwitch={onLocationSwitch}
          />

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative"
            >
              <Icon name="Bell" size={20} />
              {displayUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-error text-error-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {displayUnreadCount > 9 ? '9+' : displayUnreadCount}
                </span>
              )}
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {isNotificationOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-lg shadow-pronounced z-50">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-popover-foreground">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {displayNotifications?.map((notification) => (
                    <div
                      key={notification?.id}
                      className={`p-4 border-b border-border last:border-b-0 hover:bg-muted transition-colors ${
                        !notification?.read ? 'bg-accent/5' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          notification?.type === 'success' ? 'bg-success' :
                          notification?.type === 'warning' ? 'bg-warning' :
                          notification?.type === 'error' ? 'bg-error' : 'bg-primary'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-popover-foreground">{notification?.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{notification?.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{notification?.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 px-3 py-2"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Icon name="User" size={16} color="white" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-foreground">
                  {user?.name || 'John Smith'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.role || 'Operations Manager'}
                </p>
              </div>
              <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
            </Button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-lg shadow-pronounced z-50">
                <div className="p-4 border-b border-border">
                  <p className="font-medium text-popover-foreground">{user?.name || 'John Smith'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || 'john.smith@hybits.com'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{user?.role || 'Operations Manager'}</p>
                </div>
                
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    iconName="User"
                    iconPosition="left"
                  >
                    Profile Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    iconName="Settings"
                    iconPosition="left"
                  >
                    Preferences
                  </Button>
                  {user?.roles && user?.roles?.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      iconName="RefreshCw"
                      iconPosition="left"
                      onClick={onRoleSwitch}
                    >
                      Switch Role
                    </Button>
                  )}
                </div>
                
                <div className="p-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-error hover:text-error hover:bg-error/10"
                    iconName="LogOut"
                    iconPosition="left"
                    onClick={onLogout}
                  >
                    Sign Out
                  </Button>
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