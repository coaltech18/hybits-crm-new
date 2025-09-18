// ============================================================================
// DASHBOARD PAGE
// ============================================================================

import React from 'react';
import Icon from '@/components/AppIcon';
import { DashboardStats } from '@/types';

// Mock data for demonstration
const mockStats: DashboardStats = {
  totalCustomers: 1247,
  totalOrders: 89,
  totalRevenue: 2450000,
  pendingOrders: 12,
  lowStockItems: 8,
  overdueInvoices: 3
};

const DashboardPage: React.FC = () => {
  const stats = mockStats;

  const statCards = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toLocaleString(),
      icon: 'users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      change: '+12%',
      changeType: 'positive' as const
    },
    {
      title: 'Active Orders',
      value: stats.totalOrders.toString(),
      icon: 'shopping-cart',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      change: '+5%',
      changeType: 'positive' as const
    },
    {
      title: 'Total Revenue',
      value: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`,
      icon: 'dollar-sign',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      change: '+18%',
      changeType: 'positive' as const
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders.toString(),
      icon: 'clock',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      change: '-2',
      changeType: 'negative' as const
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockItems.toString(),
      icon: 'alert-triangle',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      change: '+3',
      changeType: 'negative' as const
    },
    {
      title: 'Overdue Invoices',
      value: stats.overdueInvoices.toString(),
      icon: 'file-text',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      change: '-1',
      changeType: 'positive' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

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
                <div className="flex items-center mt-2">
                  <Icon 
                    name={stat.changeType === 'positive' ? 'trending-up' : 'trending-down'} 
                    size={16} 
                    className={`mr-1 ${
                      stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                    }`} 
                  />
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">from last month</span>
                </div>
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
          <div className="space-y-3">
            {[
              { id: 'ORD-001', customer: 'John Doe', amount: '₹25,000', status: 'Confirmed' },
              { id: 'ORD-002', customer: 'Jane Smith', amount: '₹18,500', status: 'Pending' },
              { id: 'ORD-003', customer: 'Mike Johnson', amount: '₹32,000', status: 'In Progress' },
              { id: 'ORD-004', customer: 'Sarah Wilson', amount: '₹15,750', status: 'Completed' },
              { id: 'ORD-005', customer: 'David Brown', amount: '₹28,900', status: 'Confirmed' }
            ].map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.customer}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{order.amount}</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                    order.status === 'Confirmed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                    order.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
