import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SystemStatus = ({ onRefresh }) => {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock system status data
  const systemServices = [
    {
      id: 'auth',
      name: 'Authentication Service',
      status: 'operational',
      description: 'User login and session management',
      lastCheck: new Date(Date.now() - 30000),
      responseTime: '45ms'
    },
    {
      id: 'database',
      name: 'Database Connection',
      status: 'operational',
      description: 'Primary PostgreSQL database',
      lastCheck: new Date(Date.now() - 15000),
      responseTime: '12ms'
    },
    {
      id: 'ldap',
      name: 'LDAP Integration',
      status: 'warning',
      description: 'Active Directory synchronization',
      lastCheck: new Date(Date.now() - 120000),
      responseTime: '2.3s'
    },
    {
      id: 'backup',
      name: 'Backup Service',
      status: 'operational',
      description: 'Automated data backup system',
      lastCheck: new Date(Date.now() - 300000),
      responseTime: 'N/A'
    }
  ];

  const maintenanceSchedule = [
    {
      id: 1,
      title: 'Database Maintenance',
      description: 'Scheduled database optimization and indexing',
      scheduledDate: new Date('2025-01-08T02:00:00'),
      duration: '2 hours',
      impact: 'low',
      status: 'scheduled'
    },
    {
      id: 2,
      title: 'Security Updates',
      description: 'Critical security patches and system updates',
      scheduledDate: new Date('2025-01-15T01:00:00'),
      duration: '4 hours',
      impact: 'high',
      status: 'scheduled'
    }
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock API call
      setLastUpdated(new Date());
      if (onRefresh) onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'operational': 'CheckCircle',
      'warning': 'AlertTriangle',
      'error': 'XCircle',
      'maintenance': 'Settings'
    };
    return iconMap?.[status] || 'HelpCircle';
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'operational': 'text-success',
      'warning': 'text-warning',
      'error': 'text-error',
      'maintenance': 'text-muted-foreground'
    };
    return colorMap?.[status] || 'text-muted-foreground';
  };

  const getStatusBgColor = (status) => {
    const bgMap = {
      'operational': 'bg-success/10 border-success/20',
      'warning': 'bg-warning/10 border-warning/20',
      'error': 'bg-error/10 border-error/20',
      'maintenance': 'bg-muted border-border'
    };
    return bgMap?.[status] || 'bg-muted border-border';
  };

  const getImpactColor = (impact) => {
    const colorMap = {
      'low': 'text-success',
      'medium': 'text-warning',
      'high': 'text-error'
    };
    return colorMap?.[impact] || 'text-muted-foreground';
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatScheduledDate = (date) => {
    return date?.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="Activity" size={32} color="white" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">System Status</h2>
        <p className="text-muted-foreground">
          Real-time status of all system components and services
        </p>
      </div>
      <div className="space-y-8">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Icon name="CheckCircle" size={20} className="text-success" />
              <span className="font-medium text-foreground">All Systems Operational</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Last updated: {formatTimeAgo(lastUpdated)}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={isRefreshing}
            iconName="RefreshCw"
            iconPosition="left"
          >
            Refresh Status
          </Button>
        </div>

        {/* System Services */}
        <div>
          <h3 className="text-lg font-medium text-foreground mb-4">System Services</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {systemServices?.map((service) => (
              <div
                key={service?.id}
                className={`p-4 border rounded-lg ${getStatusBgColor(service?.status)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Icon 
                      name={getStatusIcon(service?.status)} 
                      size={20} 
                      className={getStatusColor(service?.status)} 
                    />
                    <div>
                      <h4 className="font-medium text-foreground">{service?.name}</h4>
                      <p className="text-sm text-muted-foreground">{service?.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    service?.status === 'operational' ?'bg-success text-success-foreground' 
                      : service?.status === 'warning' ?'bg-warning text-warning-foreground' :'bg-error text-error-foreground'
                  }`}>
                    {service?.status?.charAt(0)?.toUpperCase() + service?.status?.slice(1)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last check: {formatTimeAgo(service?.lastCheck)}</span>
                  <span>Response: {service?.responseTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Schedule */}
        <div>
          <h3 className="text-lg font-medium text-foreground mb-4">Scheduled Maintenance</h3>
          <div className="space-y-4">
            {maintenanceSchedule?.map((maintenance) => (
              <div
                key={maintenance?.id}
                className="p-4 bg-card border border-border rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3">
                    <Icon name="Calendar" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground">{maintenance?.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{maintenance?.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      maintenance?.impact === 'low' ?'bg-success/10 text-success' 
                        : maintenance?.impact === 'medium' ?'bg-warning/10 text-warning' :'bg-error/10 text-error'
                    }`}>
                      {maintenance?.impact?.charAt(0)?.toUpperCase() + maintenance?.impact?.slice(1)} Impact
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {formatScheduledDate(maintenance?.scheduledDate)}
                  </span>
                  <span className="text-muted-foreground">
                    Duration: {maintenance?.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Status */}
        <div className="p-4 bg-muted rounded-lg border border-border">
          <div className="flex items-start space-x-3">
            <Icon name="Zap" size={20} className="text-primary mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-2">Integration Status</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment Gateway</span>
                  <span className="text-success">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SMS Service</span>
                  <span className="text-success">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email Service</span>
                  <span className="text-success">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">GST API</span>
                  <span className="text-success">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Banking API</span>
                  <span className="text-warning">Limited</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Backup Storage</span>
                  <span className="text-success">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;