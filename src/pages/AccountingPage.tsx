// ============================================================================
// ACCOUNTING MODULE PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Invoice } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import { hasPermission } from '@/utils/permissions';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const AccountingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user && hasPermission(user.role, 'settings', 'read');

  useEffect(() => {
    loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const invoicesData = await BillingService.getInvoices(user.id);
      setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error loading invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceStats = () => {
    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const paidAmount = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const pendingAmount = invoices
      .filter(invoice => invoice.status === 'pending')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const overdueCount = invoices.filter(invoice => invoice.status === 'overdue').length;

    return { totalAmount, paidAmount, pendingAmount, overdueCount };
  };

  const stats = getInvoiceStats();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-2">
            Manage invoices, payments, and financial records
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
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-2">
            Manage invoices, payments, and financial records
          </p>
        </div>
        
        <Button onClick={() => navigate('/accounting/invoice/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          Create Invoice
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

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{stats.totalAmount.toLocaleString()}
              </p>
            </div>
            <Icon name="calculator" size={24} className="text-blue-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Paid</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{stats.paidAmount.toLocaleString()}
              </p>
            </div>
            <Icon name="check-circle" size={24} className="text-green-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{stats.pendingAmount.toLocaleString()}
              </p>
            </div>
            <Icon name="clock" size={24} className="text-yellow-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.overdueCount}</p>
            </div>
            <Icon name="alert-triangle" size={24} className="text-red-600" />
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      {invoices.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Invoices</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/accounting/invoices')}
            >
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">
                    {invoice.invoice_number || `INV-${invoice.id.slice(-6)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">₹{invoice.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.status === 'paid' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : invoice.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="flex flex-col items-center p-6 h-auto"
          onClick={() => navigate('/accounting/invoice/new')}
        >
          <Icon name="plus" size={32} className="mb-3 text-primary" />
          <span className="font-medium">Create Invoice</span>
          <span className="text-sm text-muted-foreground mt-1">Generate new invoice</span>
        </Button>

        <Button
          variant="outline"
          className="flex flex-col items-center p-6 h-auto"
          onClick={() => navigate('/accounting/invoices')}
        >
          <Icon name="file-text" size={32} className="mb-3 text-primary" />
          <span className="font-medium">View Invoices</span>
          <span className="text-sm text-muted-foreground mt-1">Manage all invoices</span>
        </Button>

        <Button
          variant="outline"
          className="flex flex-col items-center p-6 h-auto"
        >
          <Icon name="bar-chart" size={32} className="mb-3 text-primary" />
          <span className="font-medium">Financial Reports</span>
          <span className="text-sm text-muted-foreground mt-1">View detailed reports</span>
        </Button>

        <Button
          variant="outline"
          className="flex flex-col items-center p-6 h-auto"
        >
          <Icon name="download" size={32} className="mb-3 text-primary" />
          <span className="font-medium">Export Data</span>
          <span className="text-sm text-muted-foreground mt-1">Download financial data</span>
        </Button>
      </div>

      {/* No Invoices State */}
      {invoices.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Icon name="file-text" size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Invoices Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            You haven't created any invoices yet. Start by creating your first invoice to track payments and manage your finances.
          </p>
          <Button onClick={() => navigate('/accounting/invoice/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Create First Invoice
          </Button>
        </div>
      )}

      {/* Accounting Features */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Accounting Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="file-text" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Invoice Management</h3>
            <p className="text-sm text-muted-foreground">
              Create, send, and track invoices with automated reminders
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="credit-card" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Payment Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Monitor payment status and manage overdue accounts
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Icon name="bar-chart" size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Financial Reports</h3>
            <p className="text-sm text-muted-foreground">
              Generate detailed financial reports and analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingPage;
