// ============================================================================
// INVOICES PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import InvoiceRow from '@/components/billing/InvoiceRow';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';
import { exportData, formatDateForExport, formatCurrencyForExport } from '@/utils/exportUtils';

const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadInvoices();
  }, [user]);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter]);

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

  const filterInvoices = () => {
    let filtered = [...invoices];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        (invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    // Navigate to invoice detail page
    window.location.href = `/accounting/invoices/${invoice.id}`;
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    // In a real app, this would download the invoice PDF
    alert(`Downloading invoice ${invoice.invoice_number || invoice.id}`);
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) {
      alert('No invoices to export');
      return;
    }

    const headers = [
      'Invoice Number',
      'Description',
      'Customer',
      'Amount',
      'Status',
      'Due Date',
      'Paid Date',
      'Created At'
    ];

    const rows = filteredInvoices.map(invoice => [
      invoice.invoice_number || invoice.id,
      invoice.description || '',
      '', // Customer name not available in billing Invoice type
      formatCurrencyForExport(invoice.amount),
      invoice.status,
      formatDateForExport(invoice.due_date),
      '', // Paid date not available in billing Invoice type
      formatDateForExport(invoice.created_at)
    ]);

    exportData([headers, ...rows], 'excel', {
      filename: `invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Invoices'
    });
  };

  const getInvoiceStats = () => {
    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const paidAmount = invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const pendingAmount = invoices
      .filter(invoice => invoice.status === 'pending')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const overdueAmount = invoices
      .filter(invoice => invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    return { totalAmount, paidAmount, pendingAmount, overdueAmount };
  };

  const stats = getInvoiceStats();

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your billing invoices
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
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your billing invoices
          </p>
        </div>
        
        <Button variant="outline" onClick={handleExport} disabled={filteredInvoices.length === 0}>
          <Icon name="download" size={20} className="mr-2" />
          Export All
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{stats.totalAmount.toLocaleString()}
              </p>
            </div>
            <Icon name="file-text" size={24} className="text-blue-600" />
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
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{stats.overdueAmount.toLocaleString()}
              </p>
            </div>
            <Icon name="alert-triangle" size={24} className="text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search invoices..."
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

      {/* Invoices Table */}
      {filteredInvoices.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Invoice
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
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onView={handleViewInvoice}
                    onDownload={handleDownloadInvoice}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Icon name="file-text" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {invoices.length === 0 ? 'No Invoices Yet' : 'No Matching Invoices'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {invoices.length === 0 
              ? 'Your invoices will appear here once you have an active subscription.'
              : 'Try adjusting your search criteria or filters.'
            }
          </p>
          {invoices.length === 0 && (
            <Button onClick={() => window.location.href = '/billing/plans'}>
              <Icon name="credit-card" size={20} className="mr-2" />
              Browse Plans
            </Button>
          )}
        </div>
      )}

      {/* Payment Information */}
      {invoices.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Payment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-foreground mb-2">Payment Methods</h4>
              <p className="text-sm text-muted-foreground mb-3">
                We accept all major credit cards, debit cards, and UPI payments.
              </p>
              <div className="flex space-x-2">
                <div className="bg-muted rounded px-2 py-1 text-xs">Visa</div>
                <div className="bg-muted rounded px-2 py-1 text-xs">Mastercard</div>
                <div className="bg-muted rounded px-2 py-1 text-xs">RuPay</div>
                <div className="bg-muted rounded px-2 py-1 text-xs">UPI</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-foreground mb-2">Need Help?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                If you have questions about your invoices or payments, we're here to help.
              </p>
              <Button variant="outline" size="sm">
                <Icon name="mail" size={16} className="mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
