// ============================================================================
// VENDOR PROFILE PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Vendor, VendorSubscription, VendorPayment } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

type TabType = 'overview' | 'subscriptions' | 'payments';

const VendorProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id as string | undefined;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [subscriptions, setSubscriptions] = useState<VendorSubscription[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadVendorData();
    }
  }, [id]);

  const loadVendorData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const [vendorData, subsData, paymentsData] = await Promise.all([
        BillingService.getVendorById(id),
        BillingService.getVendorSubscriptionsByVendorId(id),
        BillingService.getVendorPayments(id)
      ]);

      setVendor(vendorData);
      setSubscriptions(subsData);
      setPayments(paymentsData);
    } catch (err: any) {
      console.error('Error loading vendor data:', err);
      setError(err.message || 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'paused':
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'terminated':
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Vendor Not Found</h3>
        <Button onClick={() => navigate('/vendors')}>
          Back to Vendors
        </Button>
      </div>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const totalDeposit = subscriptions.reduce((sum, sub) => sum + sub.security_deposit_amount, 0);
  const totalMonthlyFee = activeSubscriptions.reduce((sum, sub) => sum + sub.monthly_fee, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{vendor.name}</h1>
          <p className="text-muted-foreground mt-2">Vendor Profile</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/vendors/${id}/edit`)}
          >
            <Icon name="edit" size={20} className="mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/vendors')}
          >
            <Icon name="arrow-left" size={20} className="mr-2" />
            Back to Vendors
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-4">
          {(['overview', 'subscriptions', 'payments'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Vendor Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Vendor Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vendor.status)}`}>
                    {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                <p className="mt-1 text-foreground">{vendor.contact_person || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="mt-1 text-foreground">{vendor.phone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="mt-1 text-foreground">{vendor.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p className="mt-1 text-foreground">{vendor.address || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">GST Number</label>
                <p className="mt-1 text-foreground">{vendor.gst_number || 'N/A'}</p>
              </div>
              {vendor.notes && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="mt-1 text-foreground">{vendor.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{activeSubscriptions.length}</p>
                </div>
                <Icon name="credit-card" size={24} className="text-blue-600" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Security Deposit</p>
                  <p className="text-2xl font-bold text-foreground mt-1">₹{totalDeposit.toLocaleString()}</p>
                </div>
                <Icon name="dollar-sign" size={24} className="text-green-600" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-foreground mt-1">₹{totalMonthlyFee.toLocaleString()}</p>
                </div>
                <Icon name="trending-up" size={24} className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Subscriptions</h2>
            <Button onClick={() => navigate(`/subscriptions/new?vendor=${id}`)}>
              <Icon name="plus" size={20} className="mr-2" />
              New Subscription
            </Button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Icon name="credit-card" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Subscriptions</h3>
              <p className="text-muted-foreground mb-6">
                This vendor doesn't have any subscriptions yet.
              </p>
              <Button onClick={() => navigate(`/subscriptions/new?vendor=${id}`)}>
                Create First Subscription
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <h3 className="text-lg font-semibold text-foreground">
                          {sub.plan_type.toUpperCase()} Plan
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                          {sub.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Start Date:</span>
                          <p className="text-foreground">{new Date(sub.subscription_start).toLocaleDateString()}</p>
                        </div>
                        {sub.subscription_end && (
                          <div>
                            <span className="text-muted-foreground">End Date:</span>
                            <p className="text-foreground">{new Date(sub.subscription_end).toLocaleDateString()}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Monthly Fee:</span>
                          <p className="text-foreground">₹{sub.monthly_fee.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Security Deposit:</span>
                          <p className="text-foreground">₹{sub.security_deposit_amount.toLocaleString()}</p>
                        </div>
                      </div>
                      {sub.items && sub.items.length > 0 && (
                        <div className="mt-4">
                          <span className="text-sm font-medium text-muted-foreground">Items ({sub.items.length}):</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sub.items.slice(0, 5).map((item, idx) => (
                              <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                                {item.name} ({item.quantity})
                              </span>
                            ))}
                            {sub.items.length > 5 && (
                              <span className="text-xs text-muted-foreground">+{sub.items.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Payment History</h2>

          {payments.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Icon name="dollar-sign" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Payments</h3>
              <p className="text-muted-foreground">No payment records found for this vendor.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Mode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          ₹{payment.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {payment.payment_type || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {payment.payment_mode || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {payment.transaction_ref || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorProfilePage;

