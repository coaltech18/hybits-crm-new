import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onAction }) => {
  const quickActions = [
    {
      id: 'new-order',
      label: 'New Order',
      icon: 'Plus',
      description: 'Create a new rental order',
      color: 'bg-primary text-primary-foreground',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'bulk-invoice',
      label: 'Bulk Invoice',
      icon: 'FileText',
      description: 'Generate invoices for multiple orders',
      color: 'bg-blue-600 text-white',
      shortcut: 'Ctrl+I'
    },
    {
      id: 'delivery-schedule',
      label: 'Schedule Delivery',
      icon: 'Truck',
      description: 'Plan delivery routes and schedules',
      color: 'bg-green-600 text-white',
      shortcut: 'Ctrl+D'
    },
    {
      id: 'payment-reminder',
      label: 'Payment Reminders',
      icon: 'Bell',
      description: 'Send payment reminders to customers',
      color: 'bg-orange-600 text-white',
      shortcut: 'Ctrl+R'
    },
    {
      id: 'inventory-check',
      label: 'Inventory Check',
      icon: 'Package',
      description: 'Check item availability and stock levels',
      color: 'bg-purple-600 text-white',
      shortcut: 'Ctrl+K'
    },
    {
      id: 'export-data',
      label: 'Export Orders',
      icon: 'Download',
      description: 'Export order data to Excel/CSV',
      color: 'bg-gray-600 text-white',
      shortcut: 'Ctrl+E'
    }
  ];

  const handleActionClick = (actionId) => {
    onAction(actionId);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
        <Button
          variant="ghost"
          size="sm"
          iconName="Settings"
          iconPosition="left"
        >
          Customize
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickActions?.map((action) => (
          <div
            key={action?.id}
            className="group relative"
          >
            <Button
              variant="ghost"
              onClick={() => handleActionClick(action?.id)}
              className="w-full h-auto p-4 flex flex-col items-center space-y-2 hover:bg-muted transition-all duration-200 border border-transparent hover:border-border"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action?.color} group-hover:scale-110 transition-transform duration-200`}>
                <Icon name={action?.icon} size={24} />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground">{action?.label}</div>
                <div className="text-xs text-muted-foreground mt-1 hidden lg:block">
                  {action?.description}
                </div>
              </div>
            </Button>

            {/* Tooltip with keyboard shortcut */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-pronounced opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              <div className="font-medium">{action?.label}</div>
              <div className="text-muted-foreground">{action?.description}</div>
              <div className="text-xs mt-1 text-accent">{action?.shortcut}</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-popover rotate-45 border-r border-b border-border"></div>
            </div>
          </div>
        ))}
      </div>
      {/* Keyboard Shortcuts Info */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>💡 Use keyboard shortcuts for faster access</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            iconName="Keyboard"
            iconPosition="left"
          >
            View All Shortcuts
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;