import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import Icon from '@/components/AppIcon';
import Button from './Button';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  className?: string;
  user?: any;
  onLogout?: () => void;
  onRoleSwitch?: () => void;
  onSearch?: (query: string) => void;
  userLocations?: any[];
  currentLocation?: any;
  onLocationSwitch?: (location: any) => void;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { user, logout, sidebarCollapsed, toggleSidebar } = useAuth();
  useTheme();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className={`bg-background border-b border-border shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Logo and Navigation */}
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title={`${sidebarCollapsed ? 'Show' : 'Hide'} sidebar`}
          >
            <Icon 
              name={sidebarCollapsed ? "Menu" : "X"} 
              size={20} 
              className="text-foreground" 
            />
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="Building2" size={16} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Hybits CRM</h1>
          </div>
        </div>

        {/* Right side - User info and actions */}
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          
          {user && (
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
              
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="LogOut" size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
