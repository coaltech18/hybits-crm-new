import React from 'react';
import Icon from '../../../components/AppIcon';

const ActivityFeed = ({ activities, maxItems = 10 }) => {
  const mockActivities = activities || [
    {
      id: 1,
      type: 'order',
      title: 'New rental order received',
      description: 'Order #RO-2024-001 for wedding event - 500 dinner plates',
      user: 'Priya Sharma',
      timestamp: new Date(Date.now() - 300000),
      icon: 'ShoppingCart',
      iconColor: 'text-success'
    },
    {
      id: 2,
      type: 'payment',
      title: 'Payment received',
      description: 'Invoice #INV-2024-045 - ₹25,000 paid via UPI',
      user: 'Rajesh Kumar',
      timestamp: new Date(Date.now() - 900000),
      icon: 'CreditCard',
      iconColor: 'text-primary'
    },
    {
      id: 3,
      type: 'inventory',
      title: 'Low stock alert',
      description: 'Glass tumblers - Only 15 units remaining',
      user: 'System',
      timestamp: new Date(Date.now() - 1800000),
      icon: 'AlertTriangle',
      iconColor: 'text-warning'
    },
    {
      id: 4,
      type: 'customer',
      title: 'New customer registered',
      description: 'Mumbai Catering Services added to database',
      user: 'Amit Patel',
      timestamp: new Date(Date.now() - 3600000),
      icon: 'UserPlus',
      iconColor: 'text-success'
    },
    {
      id: 5,
      type: 'delivery',
      title: 'Delivery completed',
      description: 'Order #RO-2024-038 delivered to Andheri venue',
      user: 'Delivery Team',
      timestamp: new Date(Date.now() - 5400000),
      icon: 'Truck',
      iconColor: 'text-primary'
    },
    {
      id: 6,
      type: 'gst',
      title: 'GST return filed',
      description: 'July 2024 GSTR-1 submitted successfully',
      user: 'Accounting Team',
      timestamp: new Date(Date.now() - 7200000),
      icon: 'FileText',
      iconColor: 'text-success'
    }
  ];

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const displayActivities = mockActivities?.slice(0, maxItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
        <button className="text-sm text-primary hover:text-primary/80 transition-colors">
          View All
        </button>
      </div>
      <div className="space-y-3">
        {displayActivities?.map((activity) => (
          <div key={activity?.id} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <div className={`p-2 rounded-lg bg-surface ${activity?.iconColor}`}>
              <Icon name={activity?.icon} size={16} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {activity?.title}
                </h4>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {formatTimestamp(activity?.timestamp)}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-1">
                {activity?.description}
              </p>
              
              <div className="flex items-center space-x-2">
                <Icon name="User" size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{activity?.user}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {displayActivities?.length === 0 && (
        <div className="text-center py-8">
          <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No recent activity</p>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;