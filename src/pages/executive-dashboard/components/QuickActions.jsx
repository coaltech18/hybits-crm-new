import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onActionClick }) => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'new-order',
      label: 'New Order',
      description: 'Create rental order',
      icon: 'Plus',
      variant: 'default',
      path: '/rental-order-management',
      action: () => navigate('/rental-order-management')
    },
    {
      id: 'add-customer',
      label: 'Add Customer',
      description: 'Register new client',
      icon: 'UserPlus',
      variant: 'outline',
      path: '/customer-relationship-management',
      action: () => navigate('/customer-relationship-management')
    },
    {
      id: 'generate-invoice',
      label: 'Generate Invoice',
      description: 'Create GST bill',
      icon: 'Receipt',
      variant: 'outline',
      path: '/gst-compliant-billing-system',
      action: () => navigate('/gst-compliant-billing-system')
    },
    {
      id: 'check-inventory',
      label: 'Check Inventory',
      description: 'View stock levels',
      icon: 'Package',
      variant: 'outline',
      path: '/inventory-management-system',
      action: () => navigate('/inventory-management-system')
    }
  ];

  const handleActionClick = (action) => {
    if (onActionClick) {
      onActionClick(action?.id);
    }
    if (action?.action) {
      action?.action();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions?.map((action) => (
          <Button
            key={action?.id}
            variant={action?.variant}
            onClick={() => handleActionClick(action)}
            className="h-auto p-4 flex flex-col items-start space-y-2 text-left"
            iconName={action?.icon}
            iconPosition="left"
          >
            <div className="flex items-center space-x-2 w-full">
              <span className="font-medium">{action?.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {action?.description}
            </span>
          </Button>
        ))}
      </div>
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-foreground mb-3">System Status</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Database</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-success">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Payment Gateway</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-success">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GST Portal</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <span className="text-warning">Syncing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;