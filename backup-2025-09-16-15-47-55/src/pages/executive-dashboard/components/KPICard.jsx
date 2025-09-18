import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ title, value, change, changeType, icon, trend, subtitle, loading = false }) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-error';
    return 'text-muted-foreground';
  };

  const getChangeIcon = () => {
    if (changeType === 'positive') return 'TrendingUp';
    if (changeType === 'negative') return 'TrendingDown';
    return 'Minus';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
        </div>
        <div className="h-8 bg-muted rounded w-32 mb-2"></div>
        <div className="h-4 bg-muted rounded w-20"></div>
      </div>
    );
  }

  return (
    <div className="gradient-card border border-primary/20 rounded-xl p-6 hover:shadow-pronounced transition-all duration-300 hover:scale-105">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="p-3 gradient-primary rounded-xl shadow-subtle">
            <Icon name={icon} size={20} color="#6B7280" />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="text-3xl font-bold text-gradient">{value}</div>
        {subtitle && (
          <div className="text-sm text-muted-foreground font-medium">{subtitle}</div>
        )}
        {change && (
          <div className={`flex items-center space-x-2 text-sm font-semibold px-3 py-1.5 rounded-full ${
            changeType === 'positive' ? 'text-green-700 bg-green-100' :
            changeType === 'negative' ? 'text-red-700 bg-red-100' :
            'text-gray-700 bg-gray-100'
          }`}>
            <Icon name={getChangeIcon()} size={16} color="currentColor" />
            <span>{change}</span>
            {trend && <span className="text-muted-foreground">vs last month</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;