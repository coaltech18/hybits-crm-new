// ============================================================================
// CUSTOMER SUBSCRIPTION DETAIL PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomerSubscription, SubscriptionInvoice } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const CustomerSubscriptionDetailPage: React.FC = () => {
  const params = useParams();
  const id = params.id;
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSubscription();
    }
  }, [id]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [subData, invoicesData] = await Promise.all([
        BillingService.getCustomerSubscription(id!),
        BillingService.getSubscriptionInvoices(id!)
      ]);
      
      setSubscription(subData);
      setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="text-center py-12">
        <Icon name="alert-triangle" size={48} className="mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Subscription Not Found</h3>
        <p className="text-muted-foreground mb-6">{error || 'The subscription could not be loaded.'}</p>
        <Button onClick={() => navigate('/subscriptions/customer')}>
          Back to Subscriptions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{subscription.subscription_code}</h1>
          <p className="text-muted-foreground mt-1">
            Customer: {subscription.customer_name}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/subscriptions/customer')}>
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back
        </Button>
      </div>

      {/* Subscription Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              subscription.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {subscription.status}
            </span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Start Date:</span>
            <span className="ml-2 text-sm font-medium">{new Date(subscription.start_date).toLocaleDateString()}</span>
          </div>
          {subscription.end_date && (
            <div>
              <span className="text-sm text-muted-foreground">End Date:</span>
              <span className="ml-2 text-sm font-medium">{new Date(subscription.end_date).toLocaleDateString()}</span>
            </div>
          )}
          <div>
            <span className="text-sm text-muted-foreground">Quantity Per Day:</span>
            <span className="ml-2 text-sm font-medium">{subscription.quantity_per_day}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Unit Price:</span>
            <span className="ml-2 text-sm font-medium">₹{subscription.unit_price.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Monthly Amount:</span>
            <span className="ml-2 text-sm font-medium">₹{subscription.monthly_amount.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Security Deposit:</span>
            <span className="ml-2 text-sm font-medium">₹{subscription.security_deposit.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">GST Rate:</span>
            <span className="ml-2 text-sm font-medium">{subscription.gst_rate}%</span>
          </div>
        </div>
      </div>

      {/* Subscription Items */}
      {subscription.items && subscription.items.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Items</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Unit Price</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscription.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-foreground">{item.name}</td>
                    <td className="px-4 py-2 text-sm text-foreground">{item.quantity}</td>
                    <td className="px-4 py-2 text-sm text-foreground">₹{item.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm font-medium text-foreground">₹{item.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground">No invoices generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Invoice Number</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Billing Period</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-2 text-sm text-foreground">{invoice.invoice_number || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-foreground">₹{invoice.amount?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-2 text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/invoices/${invoice.invoice_id}`)}
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

export default CustomerSubscriptionDetailPage;

