import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const StockAlertPanel = ({ alerts, onAlertAction, onDismissAlert }) => {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical': return 'AlertTriangle';
      case 'low': return 'AlertCircle';
      case 'reorder': return 'Target';
      case 'expired': return 'Clock';
      default: return 'Info';
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'critical': return 'text-error bg-error/10 border-error/20';
      case 'low': return 'text-warning bg-warning/10 border-warning/20';
      case 'reorder': return 'text-primary bg-primary/10 border-primary/20';
      case 'expired': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-primary bg-primary/10 border-primary/20';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High Priority';
      case 'medium': return 'Medium Priority';
      case 'low': return 'Low Priority';
      default: return 'Normal';
    }
  };

  if (alerts?.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center">
        <Icon name="CheckCircle" size={48} className="text-success mx-auto mb-3" />
        <h3 className="font-medium text-foreground mb-2">All Good!</h3>
        <p className="text-sm text-muted-foreground">No stock alerts at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Stock Alerts ({alerts?.length})</h3>
        <Button variant="outline" size="sm" iconName="RefreshCw" iconPosition="left">
          Refresh
        </Button>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alerts?.map((alert) => (
          <div
            key={alert.id}
            className={`border rounded-lg p-4 ${getAlertColor(alert.type)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Icon 
                  name={getAlertIcon(alert.type)} 
                  size={20} 
                  className={alert.type === 'critical' ? 'text-error' : 
                           alert.type === 'low' ? 'text-warning' : 'text-primary'}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium text-foreground">{alert.itemName}</h4>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded font-medium">
                      {alert.itemCode}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-2">{alert.message}</p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>Current: {alert.currentStock}</span>
                    <span>Reorder: {alert.reorderPoint}</span>
                    <span>Location: {alert.location}</span>
                    <span className={`font-medium ${
                      alert.priority === 'high' ? 'text-error' :
                      alert.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'
                    }`}>
                      {getPriorityLabel(alert.priority)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDismissAlert(alert.id)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" size={14} />
              </Button>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                {new Date(alert.createdAt)?.toLocaleString('en-IN')}
              </span>
              <div className="flex items-center space-x-2">
                {alert.type === 'reorder' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAlertAction(alert.id, 'create-order')}
                    iconName="ShoppingCart"
                    iconPosition="left"
                  >
                    Create Order
                  </Button>
                )}
                {alert.type === 'low' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAlertAction(alert.id, 'adjust-stock')}
                    iconName="Edit3"
                    iconPosition="left"
                  >
                    Adjust Stock
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAlertAction(alert.id, 'view-details')}
                  iconName="Eye"
                  iconPosition="left"
                >
                  Details
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockAlertPanel;