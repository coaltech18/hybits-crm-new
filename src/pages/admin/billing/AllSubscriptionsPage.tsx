// ============================================================================
// ALL SUBSCRIPTIONS PAGE (ADMIN)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Subscription, Invoice } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

interface SubscriptionWithUser extends Subscription {
  user_name?: string;
  user_email?: string;
}

interface InvoiceWithUser extends Invoice {
  user_name?: string;
  user_email?: string;
}

const AllSubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithUser[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithUser[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchTerm, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subscriptionsData, invoicesData] = await Promise.all([
        BillingService.getAllSubscriptions(),
        BillingService.getAllInvoices()
      ]);

      setSubscriptions(subscriptionsData);
      setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filterSubscriptions = () => {
    let filtered = [...subscriptions];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(subscription =>
        subscription.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subscription.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subscription.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(subscription => subscription.status === statusFilter);
    }

    setFilteredSubscriptions(filtered);
  };

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

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSubscriptionStats = () => {
    const activeCount = subscriptions.filter(s => s.status === 'active').length;
    const trialingCount = subscriptions.filter(s => s.status === 'trialing').length;
    const canceledCount = subscriptions.filter(s => s.status === 'canceled').length;
    const expiredCount = subscriptions.filter(s => s.status === 'expired').length;

    return { activeCount, trialingCount, canceledCount, expiredCount };
  };

  const getInvoiceStats = () => {
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const pendingCount = invoices.filter(i => i.status === 'pending').length;
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);

    return { paidCount, pendingCount, overdueCount, totalRevenue };
  };

  const subscriptionStats = getSubscriptionStats();
  const invoiceStats = getInvoiceStats();

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'trialing', label: 'Trialing' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'expired', label: 'Expired' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage all user subscriptions and billing
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
          <h1 className="text-3xl font-bold text-foreground">All Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage all user subscriptions and billing
          </p>
        </div>
        
        <Button variant="outline">
          <Icon name="download" size={20} className="mr-2" />
          Export Data
        </Button>
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

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'subscriptions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
          >
            Subscriptions ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invoices'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </nav>
      </div>

      {/* Stats Cards */}
      {activeTab === 'subscriptions' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-foreground mt-1">{subscriptionStats.activeCount}</p>
              </div>
              <Icon name="check-circle" size={24} className="text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Trialing</p>
                <p className="text-2xl font-bold text-foreground mt-1">{subscriptionStats.trialingCount}</p>
              </div>
              <Icon name="clock" size={24} className="text-blue-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Canceled</p>
                <p className="text-2xl font-bold text-foreground mt-1">{subscriptionStats.canceledCount}</p>
              </div>
              <Icon name="x-circle" size={24} className="text-red-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-foreground mt-1">{subscriptionStats.expiredCount}</p>
              </div>
              <Icon name="alert-circle" size={24} className="text-gray-600" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-foreground mt-1">{invoiceStats.paidCount}</p>
              </div>
              <Icon name="check-circle" size={24} className="text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground mt-1">{invoiceStats.pendingCount}</p>
              </div>
              <Icon name="clock" size={24} className="text-yellow-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-foreground mt-1">{invoiceStats.overdueCount}</p>
              </div>
              <Icon name="alert-triangle" size={24} className="text-red-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ₹{invoiceStats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <Icon name="dollar-sign" size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {activeTab === 'subscriptions' && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                type="search"
                placeholder="Search users or plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Filter by status"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                }}
                className="flex-1"
              >
                <Icon name="x" size={16} className="mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'subscriptions' ? (
        /* Subscriptions Table */
        filteredSubscriptions.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Next Billing
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {subscription.user_name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {subscription.user_email || 'No email'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {subscription.plan_name || 'Unknown Plan'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {formatDate(subscription.start_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {subscription.next_billing_date ? formatDate(subscription.next_billing_date) : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Icon name="eye" size={16} />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Icon name="mail" size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Icon name="users" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {subscriptions.length === 0 ? 'No Subscriptions Yet' : 'No Matching Subscriptions'}
            </h3>
            <p className="text-muted-foreground">
              {subscriptions.length === 0 
                ? 'Subscriptions will appear here once users start subscribing to plans.'
                : 'Try adjusting your search criteria or filters.'
              }
            </p>
          </div>
        )
      ) : (
        /* Invoices Table */
        invoices.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Due Date
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
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {invoice.invoice_number || `INV-${invoice.id.slice(-6)}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {invoice.user_name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invoice.user_email || 'No email'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          ₹{invoice.amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {formatDate(invoice.due_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(invoice.status)}`}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Icon name="eye" size={16} />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Icon name="download" size={16} />
                          </Button>
                          {invoice.status === 'pending' && (
                            <Button variant="ghost" size="sm">
                              <Icon name="check" size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Icon name="file-text" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Invoices Yet</h3>
            <p className="text-muted-foreground">
              Invoices will appear here once users start subscribing to plans.
            </p>
          </div>
        )
      )}
    </div>
  );
};

export default AllSubscriptionsPage;
