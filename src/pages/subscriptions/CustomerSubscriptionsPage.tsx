// ============================================================================
// CUSTOMER SUBSCRIPTIONS PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerSubscription } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Icon from '@/components/AppIcon';

const CustomerSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, getCurrentOutletId, isAdmin } = useAuth();
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  useEffect(() => {
    loadSubscriptions();
  }, [user]);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const outletId = isAdmin() ? undefined : getCurrentOutletId();
      const data = await BillingService.getCustomerSubscriptions({ outletId });
      setSubscriptions(data);
    } catch (err: any) {
      console.error('Error loading subscriptions:', err);
      setError(err.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoices = async () => {
    try {
      setGeneratingInvoices(true);
      const selectedDate = new Date(invoiceDate);
      const results = await BillingService.rpcGenerateMonthlyInvoices(selectedDate);
      
      alert(`Generated ${results.length} invoices successfully!`);
      setShowInvoiceGenerator(false);
      // Reload subscriptions to show updated data
      loadSubscriptions();
    } catch (err: any) {
      console.error('Error generating invoices:', err);
      alert(`Error: ${err.message || 'Failed to generate invoices'}`);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage daily-delivered item subscriptions billed monthly
          </p>
        </div>
        <div className="flex space-x-2">
          {(isAdmin() || user?.role === 'manager') && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowInvoiceGenerator(!showInvoiceGenerator)}
              >
                <Icon name="file-text" size={16} className="mr-2" />
                Generate Invoices
              </Button>
              <Button onClick={() => navigate('/subscriptions/customer/new')}>
                <Icon name="plus" size={16} className="mr-2" />
                New Subscription
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Invoice Generator Modal */}
      {showInvoiceGenerator && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Generate Monthly Invoices</h3>
          <div className="space-y-4">
            <Input
              type="date"
              label="Billing Date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            <div className="flex space-x-2">
              <Button
                onClick={handleGenerateInvoices}
                loading={generatingInvoices}
                disabled={generatingInvoices}
              >
                Generate for Month
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInvoiceGenerator(false)}
                disabled={generatingInvoices}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="package" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Subscriptions</h3>
            <p className="text-muted-foreground mb-6">
              No customer subscriptions found. Create the first subscription to get started.
            </p>
            {(isAdmin() || user?.role === 'manager') && (
              <Button onClick={() => navigate('/subscriptions/customer/new')}>
                <Icon name="plus" size={16} className="mr-2" />
                Create First Subscription
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Qty/Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Monthly Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {sub.subscription_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{sub.customer_name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {sub.quantity_per_day}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      ₹{sub.unit_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      ₹{sub.monthly_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sub.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/subscriptions/customer/${sub.id}`)}
                      >
                        <Icon name="eye" size={16} />
                      </Button>
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

export default CustomerSubscriptionsPage;

