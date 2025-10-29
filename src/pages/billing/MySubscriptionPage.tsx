// ============================================================================
// MY SUBSCRIPTION PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, Subscription } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import SubscriptionCard from '@/components/billing/SubscriptionCard';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const MySubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, [user]);

  const loadSubscriptionData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const subscriptionData = await BillingService.getUserSubscription(user.id);
      setSubscription(subscriptionData);

      if (subscriptionData) {
        const planData = await BillingService.getPlan(subscriptionData.plan_id);
        setPlan(planData);
      }
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.'
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError(null);

      await BillingService.cancelSubscription(subscriptionId);
      
      // Reload subscription data
      await loadSubscriptionData();
      
      alert('Your subscription has been cancelled successfully.');
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenewSubscription = async (subscriptionId: string) => {
    if (!user || !subscription) return;

    try {
      setActionLoading(true);
      setError(null);

      // Create a new subscription with the same plan
      await BillingService.createSubscription(subscription.plan_id, user.id);
      
      // Reload subscription data
      await loadSubscriptionData();
      
      alert('Your subscription has been renewed successfully.');
    } catch (err: any) {
      console.error('Error renewing subscription:', err);
      setError(err.message || 'Failed to renew subscription');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Subscription</h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription and billing information
          </p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Subscription</h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription and billing information
          </p>
        </div>
        
        {!subscription && (
          <Button onClick={() => window.location.href = '/billing/plans'}>
            <Icon name="credit-card" size={20} className="mr-2" />
            Browse Plans
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Card */}
      {subscription ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Current Subscription</h2>
            <SubscriptionCard
              subscription={subscription}
              plan={plan}
              onCancel={handleCancelSubscription}
              onRenew={handleRenewSubscription}
              loading={actionLoading}
            />
          </div>

          {/* Billing Information */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Billing Information</h2>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Method:</span>
                <div className="flex items-center">
                  <Icon name="credit-card" size={16} className="mr-2" />
                  <span className="text-foreground">•••• •••• •••• 4242</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Billing Email:</span>
                <span className="text-foreground">{user?.email}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Currency:</span>
                <span className="text-foreground">INR (₹)</span>
              </div>

              <div className="pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="w-full">
                  <Icon name="edit" size={16} className="mr-2" />
                  Update Payment Method
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* No Subscription State */
        <div className="text-center py-12">
          <div className="bg-muted/50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <Icon name="credit-card" size={48} className="text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No Active Subscription</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            You don't have an active subscription yet. Choose a plan that fits your business needs and start managing your customers more effectively.
          </p>
          <div className="space-y-3">
            <Button onClick={() => window.location.href = '/billing/plans'}>
              <Icon name="credit-card" size={20} className="mr-2" />
              Browse Subscription Plans
            </Button>
            <div className="text-sm text-muted-foreground">
              All plans include a 14-day free trial
            </div>
          </div>
        </div>
      )}

      {/* Usage Statistics */}
      {subscription && subscription.status === 'active' && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Usage This Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold text-foreground mt-1">247</p>
                </div>
                <Icon name="users" size={24} className="text-blue-600" />
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">
                  {plan?.name === 'Basic' ? 'of 100 limit' : 'Unlimited'}
                </div>
                {plan?.name === 'Basic' && (
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold text-foreground mt-1">89</p>
                </div>
                <Icon name="shopping-cart" size={24} className="text-green-600" />
              </div>
              <div className="mt-2">
                <div className="text-xs text-green-600">+12% from last month</div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reports Generated</p>
                  <p className="text-2xl font-bold text-foreground mt-1">15</p>
                </div>
                <Icon name="file-text" size={24} className="text-purple-600" />
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">This month</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="flex flex-col items-center p-4 h-auto"
            onClick={() => window.location.href = '/billing/invoices'}
          >
            <Icon name="file-text" size={24} className="mb-2" />
            <span className="text-sm">View Invoices</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center p-4 h-auto"
            onClick={() => window.location.href = '/billing/plans'}
          >
            <Icon name="arrow-up" size={24} className="mb-2" />
            <span className="text-sm">Upgrade Plan</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center p-4 h-auto"
          >
            <Icon name="download" size={24} className="mb-2" />
            <span className="text-sm">Download Receipt</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center p-4 h-auto"
          >
            <Icon name="help-circle" size={24} className="mb-2" />
            <span className="text-sm">Get Support</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MySubscriptionPage;
