// ============================================================================
// BILLING PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Invoice, InvoiceStatus } from '@/types';

// Mock data
const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoice_number: 'INV-001',
    customer_id: '1',
    customer_name: 'John Doe',
    customer_email: 'john.doe@email.com',
    customer_phone: '+91 98765 43210',
    customer_address: {
      street: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India'
    },
    customer_gstin: '27ABCDE1234F1Z5',
    invoice_date: '2024-01-15',
    due_date: '2024-02-15',
    items: [
      { id: '1', description: 'Plastic Chair (150 pcs)', quantity: 150, rate: 150, gst_rate: 18, amount: 22500 },
      { id: '2', description: 'Round Table (25 pcs)', quantity: 25, rate: 2500, gst_rate: 18, amount: 62500 }
    ],
    subtotal: 85000,
    gst_amount: 15300,
    total_amount: 100300,
    status: 'sent',
    notes: 'Payment due within 30 days',
    created_at: '2024-01-15',
    updated_at: '2024-01-15'
  },
  {
    id: '2',
    invoice_number: 'INV-002',
    customer_id: '2',
    customer_name: 'Jane Smith',
    customer_email: 'jane.smith@email.com',
    customer_phone: '+91 87654 32109',
    customer_address: {
      street: '456 Park Avenue',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India'
    },
    customer_gstin: '07FGHIJ5678K2L6',
    invoice_date: '2024-01-14',
    due_date: '2024-02-14',
    items: [
      { id: '3', description: 'Party Tent (1 pc)', quantity: 1, rate: 15000, gst_rate: 18, amount: 15000 }
    ],
    subtotal: 15000,
    gst_amount: 2700,
    total_amount: 17700,
    status: 'paid',
    notes: 'Payment received',
    created_at: '2024-01-14',
    updated_at: '2024-01-14'
  }
];

const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [invoices] = useState<Invoice[]>(mockInvoices);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || invoice.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && !invoices.find(inv => inv.due_date === dueDate)?.status.includes('paid');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Manage invoices, payments, and GST compliance
          </p>
        </div>
        <Button onClick={() => navigate('/billing/invoice/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: 'Total Invoices', value: invoices.length, icon: 'file-text', color: 'text-blue-600' },
          { title: 'Paid Invoices', value: invoices.filter(inv => inv.status === 'paid').length, icon: 'check-circle', color: 'text-green-600' },
          { title: 'Pending Amount', value: '₹1,18,000', icon: 'dollar-sign', color: 'text-orange-600' },
          { title: 'Overdue', value: invoices.filter(inv => isOverdue(inv.due_date)).length, icon: 'alert-triangle', color: 'text-red-600' }
        ].map((stat, index) => (
          <div key={index} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <Icon name={stat.icon} size={24} className={stat.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value as InvoiceStatus | '')}
              placeholder="All Status"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <Icon name="filter" size={16} className="mr-2" />
              Filters
            </Button>
            <Button variant="outline">
              <Icon name="download" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
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
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {invoice.invoice_number}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {invoice.customer_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {invoice.customer_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      ₹{invoice.total_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      GST: ₹{invoice.gst_amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
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
                      <Button variant="ghost" size="sm">
                        <Icon name="download" size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredInvoices.length === 0 && (
        <div className="text-center py-12">
          <Icon name="file-text" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No invoices found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search criteria or create new invoices.
          </p>
          <Button onClick={() => navigate('/billing/invoice/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Create First Invoice
          </Button>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
