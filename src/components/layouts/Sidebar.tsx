import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Settings,
  Building2,
  UserCog,
  LogOut,
  Repeat,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Shield,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles: string[];
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    roles: ['admin', 'manager'],
  },
  {
    to: '/clients',
    icon: Users,
    label: 'Clients',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/subscriptions',
    icon: Repeat,
    label: 'Subscriptions',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/events',
    icon: CalendarCheck,
    label: 'Events',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/invoices',
    icon: FileText,
    label: 'Invoices',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/payments',
    icon: DollarSign,
    label: 'Payments',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/reports',
    icon: TrendingUp,
    label: 'Reports',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/reports/gst-working',
    icon: FileText,
    label: 'GST Working',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/inventory',
    icon: Package,
    label: 'Inventory',
    roles: ['admin', 'manager', 'accountant'],
  },
];

const adminNavItems: NavItem[] = [
  {
    to: '/admin/users',
    icon: UserCog,
    label: 'Users',
    roles: ['admin'],
  },
  {
    to: '/admin/outlets',
    icon: Building2,
    label: 'Outlets',
    roles: ['admin'],
  },
  {
    to: '/admin/access-matrix',
    icon: Shield,
    label: 'Access Matrix',
    roles: ['admin', 'accountant'],
  },
  {
    to: '/admin/activity-logs',
    icon: Activity,
    label: 'Activity Logs',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    to: '/admin/settings',
    icon: Settings,
    label: 'Settings',
    roles: ['admin'],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen w-64 bg-brand-deep text-white/90">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 px-4">
        <img src="/logo.png" alt="Hybits" className="h-10 w-auto" />
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="text-sm font-medium text-white">{user?.full_name}</div>
        <div className="text-xs text-white/70 capitalize">{user?.role}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Main Navigation */}
        <div className="space-y-1 mb-6">
          {navItems.map((item) => {
            if (!item.roles.includes(user?.role || '')) {
              return null;
            }

            const Icon = item.icon;
            // Handle exact match and prefix match for inventory
            const isActive = item.to === '/inventory'
              ? location.pathname === item.to || location.pathname.startsWith('/inventory/')
              : location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-primary text-white'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        {adminNavItems.some((item) => item.roles.includes(user?.role || '')) && (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
              Admin
            </div>
            <div className="space-y-1">
              {adminNavItems.map((item) => {
                if (!item.roles.includes(user?.role || '')) {
                  return null;
                }

                const Icon = item.icon;
                const isActive = location.pathname === item.to;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-primary text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
