// ============================================================================
// DASHBOARD PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import Icon from '@/components/AppIcon';
import DashboardService, { DashboardStatsExtended, RecentOrder } from '@/services/dashboardService';

const DashboardPage: React.FC = () => {
  const { user, currentOutlet, getCurrentOutletId, isAdmin, isManager } = useAuth();
  const [stats, setStats] = useState<DashboardStatsExtended | null>(null);
  const [aggregatedStats, setAggregatedStats] = useState<DashboardStatsExtended | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to access dashboard
  if (!user || !hasPermission(user.role, 'dashboard', 'read')) {
    // Redirect based on role
    if (user?.role === 'accountant') {
      return <Navigate to="/accounting" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    loadDashboardData();
  }, [user, currentOutlet]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const outletId = getCurrentOutletId();

      if (isAdmin()) {
        // Admin: Load both aggregated and outlet-specific stats
        const [aggStats, outletStats, orders] = await Promise.all([
          DashboardService.getAggregatedStats(),
          outletId ? DashboardService.getOutletStats(outletId) : null,
          DashboardService.getRecentOrders(outletId, 5),
        ]);

        setAggregatedStats(aggStats);
        setStats(outletStats || aggStats); // Use outlet stats if outlet selected, else aggregated
        setRecentOrders(orders);
      } else if (isManager()) {
        // Manager: Only outlet-specific stats
        if (!outletId) {
          setError('No outlet assigned. Please contact administrator.');
          return;
        }

        const [outletStats, orders] = await Promise.all([
          DashboardService.getOutletStats(outletId),
          DashboardService.getRecentOrders(outletId, 5),
        ]);

        setStats(outletStats);
        setRecentOrders(orders);
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Error</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Format revenue for display
  const formatRevenue = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(2)}K`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const statCards = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toLocaleString(),
      icon: 'users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders.toString(),
      icon: 'shopping-cart',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Total Revenue',
      value: formatRevenue(stats.totalRevenue),
      icon: 'dollar-sign',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders.toString(),
      icon: 'clock',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockItems.toString(),
      icon: 'alert-triangle',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    },
    {
      title: 'Overdue Invoices',
      value: stats.overdueInvoices.toString(),
      icon: 'file-text',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'items_dispatched':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            {isAdmin() && currentOutlet 
              ? `Viewing data for ${currentOutlet.name}`
              : isAdmin()
              ? 'Viewing aggregated data across all outlets'
              : `Welcome back! Here's what's happening with your outlet today.`}
          </p>
        </div>
        {isAdmin() && aggregatedStats && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">All Outlets:</span> {aggregatedStats.totalCustomers} customers, {aggregatedStats.totalOrders} orders
          </div>
        )}
      </div>

      {/* Admin: Show aggregated stats comparison if outlet selected */}
      {isAdmin() && aggregatedStats && currentOutlet && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">All Outlets - Customers</p>
              <p className="text-lg font-semibold">{aggregatedStats.totalCustomers}</p>
            </div>
            <div>
              <p className="text-muted-foreground">All Outlets - Orders</p>
              <p className="text-lg font-semibold">{aggregatedStats.totalOrders}</p>
            </div>
            <div>
              <p className="text-muted-foreground">All Outlets - Revenue</p>
              <p className="text-lg font-semibold">{formatRevenue(aggregatedStats.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">All Outlets - Pending</p>
              <p className="text-lg font-semibold">{aggregatedStats.pendingOrders}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <Icon name={stat.icon} size={24} className={stat.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Revenue Overview
          </h3>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Icon name="bar-chart" size={48} className="mx-auto mb-2" />
              <p>Revenue chart will be displayed here</p>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Recent Orders
          </h3>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="shopping-cart" size={48} className="mx-auto mb-2 opacity-50" />
              <p>No recent orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{formatRevenue(order.amount)}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'New Order', icon: 'plus', href: '/orders' },
            { name: 'Add Customer', icon: 'users', href: '/customers' },
            { name: 'Add Inventory', icon: 'package', href: '/inventory' },
            { name: 'Create Invoice', icon: 'file-text', href: '/billing' }
          ].map((action) => (
            <a
              key={action.name}
              href={action.href}
              className="flex flex-col items-center p-4 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              <Icon name={action.icon} size={24} className="mb-2" />
              <span className="text-sm font-medium text-foreground">{action.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
