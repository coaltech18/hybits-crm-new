// ============================================================================
// SUBSCRIPTION CARD COMPONENT
// ============================================================================

import React from 'react';
import { Subscription, Plan } from '@/types/billing';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

interface SubscriptionCardProps {
  subscription: Subscription;
  plan?: Plan;
  onCancel?: (subscriptionId: string) => void;
  onRenew?: (subscriptionId: string) => void;
  loading?: boolean;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  plan,
  onCancel,
  onRenew,
  loading = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return 'check-circle';
      case 'trialing':
        return 'clock';
      case 'canceled':
        return 'x-circle';
      case 'expired':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isExpiringSoon = () => {
    if (!subscription.next_billing_date) return false;
    const nextBilling = new Date(subscription.next_billing_date);
    const today = new Date();
    const daysUntilBilling = Math.ceil((nextBilling.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilBilling <= 7 && daysUntilBilling > 0;
  };

  const handleCancel = () => {
    if (onCancel && !loading) {
      onCancel(subscription.id);
    }
  };

  const handleRenew = () => {
    if (onRenew && !loading) {
      onRenew(subscription.id);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {subscription.plan_name || 'Unknown Plan'}
          </h3>
          <div className="flex items-center">
            <Icon 
              name={getStatusIcon(subscription.status)} 
              size={16} 
              className="mr-2"
            />
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>
        </div>
        
        {plan && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              ₹{plan.price.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              per {plan.interval}
            </div>
          </div>
        )}
      </div>

      {/* Subscription details */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Start Date:</span>
          <span className="text-foreground">{formatDate(subscription.start_date)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">End Date:</span>
          <span className="text-foreground">{formatDate(subscription.end_date)}</span>
        </div>

        {subscription.next_billing_date && subscription.status === 'active' && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Next Billing:</span>
            <span className={`text-foreground ${isExpiringSoon() ? 'font-medium text-orange-600' : ''}`}>
              {formatDate(subscription.next_billing_date)}
              {isExpiringSoon() && (
                <Icon name="alert-triangle" size={14} className="inline ml-1 text-orange-600" />
              )}
            </span>
          </div>
        )}
      </div>

      {/* Expiring soon warning */}
      {isExpiringSoon() && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={16} className="text-orange-600 mr-2" />
            <span className="text-sm text-orange-800 dark:text-orange-200">
              Your subscription renews in {Math.ceil((new Date(subscription.next_billing_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3">
        {subscription.status === 'active' && (
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            loading={loading}
            className="flex-1"
          >
            <Icon name="x-circle" size={16} className="mr-2" />
            Cancel Subscription
          </Button>
        )}

        {(subscription.status === 'canceled' || subscription.status === 'expired') && (
          <Button
            onClick={handleRenew}
            variant="primary"
            size="sm"
            loading={loading}
            className="flex-1"
          >
            <Icon name="refresh-cw" size={16} className="mr-2" />
            Renew Subscription
          </Button>
        )}

        {subscription.status === 'trialing' && (
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
          >
            <Icon name="credit-card" size={16} className="mr-2" />
            Add Payment Method
          </Button>
        )}
      </div>

      {/* Plan features */}
      {plan && plan.features && (
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">Plan Features:</h4>
          <div className="grid grid-cols-1 gap-2">
            {plan.features.slice(0, 4).map((feature, index) => (
              <div key={index} className="flex items-center text-sm">
                <Icon name="check" size={14} className="text-green-500 mr-2 flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
            {plan.features.length > 4 && (
              <div className="text-sm text-muted-foreground">
                +{plan.features.length - 4} more features
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionCard;
