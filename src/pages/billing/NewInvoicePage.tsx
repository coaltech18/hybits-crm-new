// ============================================================================
// NEW INVOICE PAGE
// Hotfix: Wired customer selection to payload with proper validation
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import { hasPermission } from '@/utils/permissions';
import { InvoiceService } from '@/services/invoiceService';
import { CustomerService } from '@/services/customerService';
import { Customer } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomerSelector from '@/components/ui/CustomerSelector';
import Icon from '@/components/AppIcon';

interface InvoiceItem {
  id: string;
  description: string;
  hsn_code?: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  amount: number;
}

interface InvoiceFormData {
  invoice_date: string;
  due_date: string;
  notes: string;
}

const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentOutlet, getCurrentOutletId, isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description: '',
      hsn_code: '',
      quantity: 1,
      rate: 0,
      gst_rate: 18,
      amount: 0,
    }
  ]);

  // Get current outlet ID
  const currentOutletId = getCurrentOutletId();

  const { data, errors, handleChange, handleSubmit, setError, setData } = useForm<InvoiceFormData>({
    initialData: {
      invoice_date: new Date().toISOString().split('T')[0] || '',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
      notes: '',
    },
    validationRules: {
      invoice_date: [
        commonValidationRules.required('Invoice date is required'),
      ],
      due_date: [
        commonValidationRules.required('Due date is required'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        setCustomerError(null);
        
        // CRITICAL: Validate customer is selected
        if (!selectedCustomer || !selectedCustomer.id) {
          setCustomerError('Please select a customer');
          return;
        }

        // Validate invoice items
        const validItems = invoiceItems.filter(item => 
          item.description.trim() && item.quantity > 0 && item.rate > 0
        );
        
        if (validItems.length === 0) {
          setError('notes', 'Please add at least one invoice item with description, quantity, and rate');
          return;
        }
        
        // Validate outlet
        if (!currentOutletId) {
          setError('notes', 'Outlet not selected. Please select an outlet.');
          return;
        }

        // Create invoice payload with selected customer
        const payload = {
          customer_id: selectedCustomer.id,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          items: validItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            gst_rate: item.gst_rate,
            hsn_code: item.hsn_code || undefined
          })),
          notes: formData.notes,
          outlet_id: currentOutletId,
          // Pass state info for GST calculation (intra vs inter state)
          outletState: currentOutlet?.address?.state,
          customerState: selectedCustomer.address?.state
        };

        const res = await InvoiceService.createInvoice(payload);
        navigate(`/accounting/invoices/${res.id}`);
      } catch (error: any) {
        console.error('Invoice creation error:', error);
        setError('notes', error.message || 'Failed to create invoice');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const gstRateOptions = [
    { value: 0, label: '0% (Exempt)' },
    { value: 5, label: '5%' },
    { value: 12, label: '12%' },
    { value: 18, label: '18%' },
    { value: 28, label: '28%' },
  ];

  const addInvoiceItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      hsn_code: '',
      quantity: 1,
      rate: 0,
      gst_rate: 18,
      amount: 0,
    };
    setInvoiceItems([...invoiceItems, newItem]);
  };

  const removeInvoiceItem = (id: string) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    }
  };

  const updateInvoiceItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate' || field === 'gst_rate') {
          const amount = updatedItem.quantity * updatedItem.rate;
          const gstAmount = amount * (updatedItem.gst_rate / 100);
          updatedItem.amount = amount + gstAmount;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const gstAmount = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.rate * item.gst_rate / 100), 0);
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setCustomerError(null);
  };

  // Handle add new customer - navigate to customer creation
  const handleAddNewCustomer = () => {
    // Store current form data in session storage for restoration
    sessionStorage.setItem('invoice_draft', JSON.stringify({
      items: invoiceItems,
      formData: data
    }));
    navigate('/customers/new?returnTo=/billing/invoice/new');
  };

  if (!user || !hasPermission(user.role, 'billing', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create invoices.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Invoice</h1>
          <p className="text-muted-foreground">
            Create a new invoice for your customer
            {currentOutlet && (
              <span className="ml-2 text-primary">• {currentOutlet.name}</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/accounting')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Accounting
        </Button>
      </div>

      {/* Invoice Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection - CRITICAL SECTION */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Select Customer <span className="text-destructive">*</span>
            </h3>
            <CustomerSelector
              value={selectedCustomer}
              onChange={handleCustomerSelect}
              error={customerError || undefined}
              required
              disabled={isSubmitting}
              onAddNewCustomer={handleAddNewCustomer}
            />
            
            {/* Selected Customer Details */}
            {selectedCustomer && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="ml-2 font-medium">{selectedCustomer.name}</span>
                    {selectedCustomer.company && (
                      <span className="text-muted-foreground"> ({selectedCustomer.company})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Code:</span>
                    <span className="ml-2 font-medium">{selectedCustomer.code}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="ml-2">{selectedCustomer.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="ml-2">{selectedCustomer.email}</span>
                  </div>
                  {selectedCustomer.gstin && (
                    <div>
                      <span className="text-muted-foreground">GSTIN:</span>
                      <span className="ml-2 font-mono">{selectedCustomer.gstin}</span>
                    </div>
                  )}
                  {selectedCustomer.address?.state && (
                    <div>
                      <span className="text-muted-foreground">State:</span>
                      <span className="ml-2">{selectedCustomer.address.state}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Invoice Date"
                value={data.invoice_date}
                onChange={handleChange('invoice_date')}
                error={errors.invoice_date}
                required
                disabled={isSubmitting}
              />
              <Input
                type="date"
                label="Due Date"
                value={data.due_date}
                onChange={handleChange('due_date')}
                error={errors.due_date}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Invoice Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Invoice Items</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addInvoiceItem}
                disabled={isSubmitting}
              >
                <Icon name="plus" size={16} className="mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="space-y-4">
              {invoiceItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 items-end p-4 border border-border rounded-lg">
                  <div className="col-span-4">
                    <Input
                      type="text"
                      label="Description"
                      placeholder="Enter item description"
                      value={item.description}
                      onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      label="HSN/SAC"
                      placeholder="HSN Code"
                      value={item.hsn_code || ''}
                      onChange={(e) => updateInvoiceItem(item.id, 'hsn_code', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      label="Qty"
                      value={item.quantity}
                      onChange={(e) => updateInvoiceItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      min={1}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      label="Rate (₹)"
                      value={item.rate}
                      onChange={(e) => updateInvoiceItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      options={gstRateOptions}
                      value={item.gst_rate}
                      onChange={(value) => updateInvoiceItem(item.id, 'gst_rate', parseInt(value))}
                      label="GST %"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInvoiceItem(item.id)}
                      disabled={isSubmitting || invoiceItems.length === 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  </div>
                  <div className="col-span-12">
                    <div className="text-right">
                      <span className="text-sm text-muted-foreground">
                        Amount: <span className="font-medium text-foreground">₹{item.amount.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Totals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Invoice Summary</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST Amount:</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-border pt-2">
                <span>Total Amount:</span>
                <span className="text-primary">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Additional Notes</h3>
            <Input
              multiline
              rows={4}
              label="Notes"
              placeholder="Enter any additional notes or terms..."
              value={data.notes}
              onChange={handleChange('notes')}
              error={errors.notes}
              disabled={isSubmitting}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/accounting')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || !selectedCustomer}
            >
              {isSubmitting ? 'Creating Invoice...' : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewInvoicePage;
