import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import ImportExport from '../../../components/ui/ImportExport';

const InvoiceGrid = ({ invoices, selectedInvoices, onInvoiceSelect, onInvoiceEdit, onBulkAction }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onInvoiceSelect(invoices?.map(inv => inv?.id));
    } else {
      onInvoiceSelect([]);
    }
  };

  const handleSelectInvoice = (invoiceId, checked) => {
    if (checked) {
      onInvoiceSelect([...selectedInvoices, invoiceId]);
    } else {
      onInvoiceSelect(selectedInvoices?.filter(id => id !== invoiceId));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { color: 'bg-green-600 text-white', label: 'Paid' },
      pending: { color: 'bg-yellow-500 text-white', label: 'Pending' },
      overdue: { color: 'bg-red-600 text-white', label: 'Overdue' },
      partial: { color: 'bg-blue-600 text-white', label: 'Partial' },
      cancelled: { color: 'bg-gray-600 text-white', label: 'Cancelled' }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;
    return (
      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  const getComplianceIndicator = (isCompliant) => {
    return (
      <div className="flex items-center">
        <Icon 
          name={isCompliant ? "CheckCircle" : "AlertCircle"} 
          size={16} 
          className={isCompliant ? "text-green-600" : "text-orange-600"} 
        />
        <span className={`ml-2 text-xs font-semibold px-2 py-1 rounded-md ${
          isCompliant 
            ? "text-green-700 bg-green-100" 
            : "text-orange-700 bg-orange-100"
        }`}>
          {isCompliant ? "Compliant" : "Review"}
        </span>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const sortedInvoices = [...invoices]?.sort((a, b) => {
    if (sortConfig?.direction === 'asc') {
      return a?.[sortConfig?.key] > b?.[sortConfig?.key] ? 1 : -1;
    }
    return a?.[sortConfig?.key] < b?.[sortConfig?.key] ? 1 : -1;
  });

  const isAllSelected = selectedInvoices?.length === invoices?.length && invoices?.length > 0;
  const isIndeterminate = selectedInvoices?.length > 0 && selectedInvoices?.length < invoices?.length;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header with Bulk Actions */}
      {selectedInvoices?.length > 0 && (
        <div className="bg-accent/10 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedInvoices?.length} invoice{selectedInvoices?.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction('email')}
                iconName="Mail"
                iconPosition="left"
              >
                Send Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction('reminder')}
                iconName="Bell"
                iconPosition="left"
              >
                Send Reminder
              </Button>
              <ImportExport
                data={selectedInvoices?.length > 0 ? selectedInvoices : invoices}
                dataType="invoices"
                onExport={(result) => {
                  console.log('Invoice export completed:', result);
                  onBulkAction('export');
                }}
                onImport={(result) => {
                  console.log('Invoice import completed:', result);
                }}
                requiredFields={['invoice_number', 'customer_name', 'total_amount']}
                showImport={false}
                className="inline-flex"
              />
            </div>
          </div>
        </div>
      )}
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="w-12 p-3">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="text-left p-3 font-medium text-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('invoiceNumber')}
                  className="h-auto p-0 font-medium"
                >
                  Invoice #
                  <Icon name="ArrowUpDown" size={14} className="ml-1" />
                </Button>
              </th>
              <th className="text-left p-3 font-medium text-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('customerName')}
                  className="h-auto p-0 font-medium"
                >
                  Customer
                  <Icon name="ArrowUpDown" size={14} className="ml-1" />
                </Button>
              </th>
              <th className="text-left p-3 font-medium text-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('date')}
                  className="h-auto p-0 font-medium"
                >
                  Date
                  <Icon name="ArrowUpDown" size={14} className="ml-1" />
                </Button>
              </th>
              <th className="text-left p-3 font-medium text-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('totalAmount')}
                  className="h-auto p-0 font-medium"
                >
                  Amount
                  <Icon name="ArrowUpDown" size={14} className="ml-1" />
                </Button>
              </th>
              <th className="text-left p-3 font-medium text-foreground">GST Breakdown</th>
              <th className="text-left p-3 font-medium text-foreground">Status</th>
              <th className="text-left p-3 font-medium text-foreground">Compliance</th>
              <th className="text-left p-3 font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices?.map((invoice) => (
              <tr key={invoice?.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                <td className="p-3">
                  <Checkbox
                    checked={selectedInvoices?.includes(invoice?.id)}
                    onChange={(e) => handleSelectInvoice(invoice?.id, e?.target?.checked)}
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium text-primary cursor-pointer hover:underline"
                       onClick={() => onInvoiceEdit(invoice)}>
                    {invoice?.invoiceNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Due: {formatDate(invoice?.dueDate)}
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{invoice?.customerName}</div>
                  <div className="text-xs text-muted-foreground">{invoice?.customerGstin}</div>
                </td>
                <td className="p-3 text-foreground">{formatDate(invoice?.date)}</td>
                <td className="p-3">
                  <div className="font-bold text-primary bg-primary/5 px-2 py-1 rounded-md">{formatCurrency(invoice?.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Base: {formatCurrency(invoice?.baseAmount)}
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-xs space-y-1">
                    {invoice?.gstBreakdown?.cgst > 0 && (
                      <div>CGST: {formatCurrency(invoice?.gstBreakdown?.cgst)}</div>
                    )}
                    {invoice?.gstBreakdown?.sgst > 0 && (
                      <div>SGST: {formatCurrency(invoice?.gstBreakdown?.sgst)}</div>
                    )}
                    {invoice?.gstBreakdown?.igst > 0 && (
                      <div>IGST: {formatCurrency(invoice?.gstBreakdown?.igst)}</div>
                    )}
                  </div>
                </td>
                <td className="p-3">{getStatusBadge(invoice?.paymentStatus)}</td>
                <td className="p-3">{getComplianceIndicator(invoice?.isGstCompliant)}</td>
                <td className="p-3">
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onInvoiceEdit(invoice)}
                      className="h-8 w-8"
                    >
                      <Icon name="Edit" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Icon name="Eye" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Icon name="Download" size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Showing {sortedInvoices?.length} of {sortedInvoices?.length} invoices
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" disabled>
            <Icon name="ChevronLeft" size={16} />
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="ChevronRight" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGrid;