import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const PaymentTracker = ({ onPaymentUpdate, onSendReminder }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filterOptions = [
    { value: 'all', label: 'All Payments' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partially Paid' },
    { value: 'paid', label: 'Paid' }
  ];

  const mockPayments = [
    {
      id: 1,
      invoiceNumber: 'INV-2024-001',
      customerName: 'Rajesh Enterprises',
      totalAmount: 25680,
      paidAmount: 0,
      dueDate: '2024-08-15',
      status: 'overdue',
      daysPastDue: 5,
      paymentMethod: '',
      lastReminder: '2024-08-10'
    },
    {
      id: 2,
      invoiceNumber: 'INV-2024-002',
      customerName: 'Mumbai Caterers Ltd',
      totalAmount: 45200,
      paidAmount: 20000,
      dueDate: '2024-08-20',
      status: 'partial',
      daysPastDue: 0,
      paymentMethod: 'Bank Transfer',
      lastReminder: null
    },
    {
      id: 3,
      invoiceNumber: 'INV-2024-003',
      customerName: 'Golden Events',
      totalAmount: 18900,
      paidAmount: 0,
      dueDate: '2024-08-25',
      status: 'pending',
      daysPastDue: 0,
      paymentMethod: '',
      lastReminder: null
    },
    {
      id: 4,
      invoiceNumber: 'INV-2024-004',
      customerName: 'Royal Wedding Planners',
      totalAmount: 67500,
      paidAmount: 67500,
      dueDate: '2024-08-18',
      status: 'paid',
      daysPastDue: 0,
      paymentMethod: 'UPI',
      lastReminder: null
    },
    {
      id: 5,
      invoiceNumber: 'INV-2024-005',
      customerName: 'Celebration Hub',
      totalAmount: 32400,
      paidAmount: 0,
      dueDate: '2024-08-12',
      status: 'overdue',
      daysPastDue: 8,
      paymentMethod: '',
      lastReminder: '2024-08-14'
    }
  ];

  const filteredPayments = mockPayments?.filter(payment => {
    const matchesFilter = selectedFilter === 'all' || payment?.status === selectedFilter;
    const matchesSearch = payment?.invoiceNumber?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
                         payment?.customerName?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status, daysPastDue) => {
    const statusConfig = {
      paid: { color: 'bg-success text-success-foreground', label: 'Paid', icon: 'CheckCircle' },
      pending: { color: 'bg-warning text-warning-foreground', label: 'Pending', icon: 'Clock' },
      overdue: { color: 'bg-error text-error-foreground', label: `Overdue (${daysPastDue}d)`, icon: 'AlertTriangle' },
      partial: { color: 'bg-accent text-accent-foreground', label: 'Partial', icon: 'DollarSign' }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;
    return (
      <div className="flex items-center space-x-1">
        <Icon name={config?.icon} size={14} />
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
          {config?.label}
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

  const calculateSummary = () => {
    const totalAmount = filteredPayments?.reduce((sum, payment) => sum + payment?.totalAmount, 0);
    const paidAmount = filteredPayments?.reduce((sum, payment) => sum + payment?.paidAmount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const overdueAmount = filteredPayments?.filter(p => p?.status === 'overdue')?.reduce((sum, payment) => sum + (payment?.totalAmount - payment?.paidAmount), 0);

    return { totalAmount, paidAmount, pendingAmount, overdueAmount };
  };

  const summary = calculateSummary();

  const handlePaymentUpdate = (paymentId, amount, method) => {
    onPaymentUpdate({ paymentId, amount, method });
  };

  const handleSendReminder = (paymentId, type) => {
    onSendReminder({ paymentId, type });
  };

  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Payment Tracker</h2>
          <Button
            variant="default"
            iconName="Plus"
            iconPosition="left"
          >
            Record Payment
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search invoices or customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value)}
              iconName="Search"
            />
          </div>
          <Select
            options={filterOptions}
            value={selectedFilter}
            onChange={setSelectedFilter}
            className="w-48"
          />
        </div>
      </div>
      {/* Summary Cards */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{formatCurrency(summary?.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">Total Amount</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{formatCurrency(summary?.paidAmount)}</p>
            <p className="text-sm text-muted-foreground">Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">{formatCurrency(summary?.pendingAmount)}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-error">{formatCurrency(summary?.overdueAmount)}</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </div>
      </div>
      {/* Payment List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium text-foreground">Invoice</th>
              <th className="text-left p-3 font-medium text-foreground">Customer</th>
              <th className="text-left p-3 font-medium text-foreground">Amount</th>
              <th className="text-left p-3 font-medium text-foreground">Due Date</th>
              <th className="text-left p-3 font-medium text-foreground">Status</th>
              <th className="text-left p-3 font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments?.map((payment) => (
              <tr key={payment?.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-primary">{payment?.invoiceNumber}</div>
                  {payment?.paymentMethod && (
                    <div className="text-xs text-muted-foreground">via {payment?.paymentMethod}</div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{payment?.customerName}</div>
                  {payment?.lastReminder && (
                    <div className="text-xs text-muted-foreground">
                      Last reminder: {formatDate(payment?.lastReminder)}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{formatCurrency(payment?.totalAmount)}</div>
                  {payment?.paidAmount > 0 && (
                    <div className="text-xs text-success">
                      Paid: {formatCurrency(payment?.paidAmount)}
                    </div>
                  )}
                  {payment?.totalAmount > payment?.paidAmount && (
                    <div className="text-xs text-warning">
                      Due: {formatCurrency(payment?.totalAmount - payment?.paidAmount)}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className={`text-sm ${payment?.status === 'overdue' ? 'text-error font-medium' : 'text-foreground'}`}>
                    {formatDate(payment?.dueDate)}
                  </div>
                </td>
                <td className="p-3">
                  {getStatusBadge(payment?.status, payment?.daysPastDue)}
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-1">
                    {payment?.status !== 'paid' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePaymentUpdate(payment?.id)}
                          className="h-8 w-8"
                          title="Record Payment"
                        >
                          <Icon name="DollarSign" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendReminder(payment?.id, 'email')}
                          className="h-8 w-8"
                          title="Send Email Reminder"
                        >
                          <Icon name="Mail" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendReminder(payment?.id, 'sms')}
                          className="h-8 w-8"
                          title="Send SMS Reminder"
                        >
                          <Icon name="MessageSquare" size={16} />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="View Details"
                    >
                      <Icon name="Eye" size={16} />
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
          Showing {filteredPayments?.length} of {mockPayments?.length} payments
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
            <Icon name="ChevronRight" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentTracker;