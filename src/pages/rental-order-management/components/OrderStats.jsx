import React from 'react';
import Icon from '../../../components/AppIcon';

const OrderStats = ({ stats }) => {
  const defaultStats = {
    totalOrders: 1247,
    activeRentals: 89,
    pendingDeliveries: 23,
    overdueReturns: 7,
    totalRevenue: 2847500,
    avgOrderValue: 12500,
    customerSatisfaction: 4.8,
    inventoryUtilization: 78
  };

  const displayStats = { ...defaultStats, ...stats };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN')?.format(num);
  };

  const statCards = [
    {
      title: 'Total Orders',
      value: formatNumber(displayStats?.totalOrders),
      change: '+12.5%',
      changeType: 'positive',
      icon: 'ShoppingCart',
      color: 'bg-blue-500'
    },
    {
      title: 'Active Rentals',
      value: formatNumber(displayStats?.activeRentals),
      change: '+8.2%',
      changeType: 'positive',
      icon: 'Clock',
      color: 'bg-green-500'
    },
    {
      title: 'Pending Deliveries',
      value: formatNumber(displayStats?.pendingDeliveries),
      change: '-5.1%',
      changeType: 'negative',
      icon: 'Truck',
      color: 'bg-orange-500'
    },
    {
      title: 'Overdue Returns',
      value: formatNumber(displayStats?.overdueReturns),
      change: '+2.3%',
      changeType: 'negative',
      icon: 'AlertTriangle',
      color: 'bg-red-500'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(displayStats?.totalRevenue),
      change: '+18.7%',
      changeType: 'positive',
      icon: 'DollarSign',
      color: 'bg-purple-500'
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(displayStats?.avgOrderValue),
      change: '+6.4%',
      changeType: 'positive',
      icon: 'TrendingUp',
      color: 'bg-indigo-500'
    },
    {
      title: 'Customer Rating',
      value: `${displayStats?.customerSatisfaction}/5.0`,
      change: '+0.2',
      changeType: 'positive',
      icon: 'Star',
      color: 'bg-yellow-500'
    },
    {
      title: 'Inventory Usage',
      value: `${displayStats?.inventoryUtilization}%`,
      change: '+4.1%',
      changeType: 'positive',
      icon: 'Package',
      color: 'bg-teal-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards?.map((stat, index) => (
        <div
          key={index}
          className="bg-surface border border-border rounded-lg p-4 hover:shadow-subtle transition-shadow duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {stat?.title}
              </p>
              <p className="text-2xl font-bold text-foreground mb-2">
                {stat?.value}
              </p>
              <div className="flex items-center space-x-1">
                <Icon
                  name={stat?.changeType === 'positive' ? 'TrendingUp' : 'TrendingDown'}
                  size={14}
                  className={stat?.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}
                />
                <span
                  className={`text-xs font-medium ${
                    stat?.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat?.change}
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat?.color}`}>
              <Icon name={stat?.icon} size={24} color="white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderStats;