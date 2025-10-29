// ============================================================================
// SUBSCRIPTIONS MODULE PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { VendorSubscription, BillingStats } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const SubscriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [vendorSubscriptions, setVendorSubscriptions] = useState<VendorSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, subscriptionsData] = await Promise.all([
        BillingService.getBillingStats(),
        BillingService.getVendorSubscriptions()
      ]);

      setStats(statsData);
      setVendorSubscriptions(subscriptionsData);
    } catch (err: any) {
      console.error('Error loading subscription data:', err);
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendor Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage vendor subscriptions and rental items
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Vendor Subscriptions</h1>
        <p className="text-muted-foreground mt-2">
          Manage vendor subscriptions and their rental items from Hybits
        </p>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Vendors</p>
                <p className="text-2xl font-bold text-foreground mt-1">{vendorSubscriptions.length}</p>
              </div>
              <Icon name="users" size={24} className="text-blue-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {vendorSubscriptions.filter(sub => sub.status === 'active').length}
                </p>
              </div>
              <Icon name="check-circle" size={24} className="text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Monthly Revenue</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ₹{vendorSubscriptions
                    .filter(sub => sub.status === 'active')
                    .reduce((sum, sub) => sum + sub.monthly_fee, 0)
                    .toLocaleString()}
                </p>
              </div>
              <Icon name="dollar-sign" size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex space-x-4">
        <Button
          onClick={() => navigate('/subscriptions/new')}
        >
          <Icon name="plus" size={20} className="mr-2" />
          New Vendor Subscription
        </Button>
      </div>

      {/* Vendor Subscriptions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Vendor Subscriptions</h2>
          <p className="text-muted-foreground mt-1">
            Manage all vendor subscriptions and their rental items
          </p>
        </div>

        {vendorSubscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Icon name="users" size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Vendor Subscriptions</h3>
            <p className="text-muted-foreground mb-6">
              No vendors have subscribed yet. Create the first vendor subscription to get started.
            </p>
            <Button onClick={() => navigate('/subscriptions/new')}>
              <Icon name="plus" size={20} className="mr-2" />
              Create First Subscription
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Deposit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Monthly Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendorSubscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {subscription.vendor_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Started: {new Date(subscription.subscription_start).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {subscription.plan_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {subscription.items.length} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      ₹{subscription.total_dish_value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div>
                        <div className="font-medium">₹{subscription.final_deposit.toLocaleString()}</div>
                        {subscription.deposit_manual && subscription.deposit_manual !== subscription.deposit_auto && (
                          <div className="text-xs text-muted-foreground">
                            (Manual: ₹{subscription.deposit_manual.toLocaleString()})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      ₹{subscription.monthly_fee.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        subscription.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : subscription.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          subscription.status === 'active' 
                            ? 'bg-green-500' 
                            : subscription.status === 'suspended'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}></div>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Icon name="eye" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Icon name="edit" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Icon name="trash" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsPage;