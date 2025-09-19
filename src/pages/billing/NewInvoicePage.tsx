// ============================================================================
// NEW INVOICE PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import { hasPermission } from '@/utils/permissions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  amount: number;
}

interface InvoiceFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_street: string;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
  customer_gstin: string;
  invoice_date: string;
  due_date: string;
  notes: string;
}

const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      rate: 0,
      gst_rate: 18,
      amount: 0,
    }
  ]);

  const { data, errors, handleChange, handleSubmit, setError, setData } = useForm<InvoiceFormData>({
    initialData: {
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_street: '',
      customer_city: '',
      customer_state: '',
      customer_pincode: '',
      customer_gstin: '',
      invoice_date: new Date().toISOString().split('T')[0] || '',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
      notes: '',
    },
    validationRules: {
      customer_name: [
        commonValidationRules.required('Customer name is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
      ],
      customer_email: [
        commonValidationRules.required('Email is required'),
        commonValidationRules.email('Please enter a valid email address'),
      ],
      customer_phone: [
        commonValidationRules.required('Phone number is required'),
        commonValidationRules.pattern(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'),
      ],
      customer_street: [
        commonValidationRules.required('Street address is required'),
      ],
      customer_city: [
        commonValidationRules.required('City is required'),
      ],
      customer_state: [
        commonValidationRules.required('State is required'),
      ],
      customer_pincode: [
        commonValidationRules.required('Pincode is required'),
        commonValidationRules.pattern(/^[0-9]{6}$/, 'Pincode must be 6 digits'),
      ],
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
        
        // Validate invoice items
        const validItems = invoiceItems.filter(item => 
          item.description.trim() && item.quantity > 0 && item.rate > 0
        );
        
        if (validItems.length === 0) {
          setError('customer_name', 'Please add at least one invoice item');
          return;
        }
        
        // TODO: Implement invoice creation API call
        console.log('Creating invoice:', { ...formData, items: validItems });
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to billing page
        navigate('/billing');
      } catch (error: any) {
        setError('customer_name', error.message || 'Failed to create invoice');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const gstRateOptions = [
    { value: 0, label: '0%' },
    { value: 5, label: '5%' },
    { value: 12, label: '12%' },
    { value: 18, label: '18%' },
    { value: 28, label: '28%' },
  ];

  const stateOptions = [
    { value: '', label: 'Select state' },
    { value: 'Maharashtra', label: 'Maharashtra' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Karnataka', label: 'Karnataka' },
    { value: 'Tamil Nadu', label: 'Tamil Nadu' },
    { value: 'Gujarat', label: 'Gujarat' },
    { value: 'West Bengal', label: 'West Bengal' },
    { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
    { value: 'Rajasthan', label: 'Rajasthan' },
    { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
    { value: 'Telangana', label: 'Telangana' },
    { value: 'Kerala', label: 'Kerala' },
    { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
    { value: 'Punjab', label: 'Punjab' },
    { value: 'Haryana', label: 'Haryana' },
    { value: 'Other', label: 'Other' },
  ];

  const addInvoiceItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
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
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/billing')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Billing
        </Button>
      </div>

      {/* Invoice Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Customer Name"
                placeholder="Enter customer name"
                value={data.customer_name}
                onChange={handleChange('customer_name')}
                error={errors.customer_name}
                required
                disabled={isSubmitting}
              />
              <Input
                type="email"
                label="Email"
                placeholder="Enter email address"
                value={data.customer_email}
                onChange={handleChange('customer_email')}
                error={errors.customer_email}
                required
                disabled={isSubmitting}
              />
              <Input
                type="tel"
                label="Phone Number"
                placeholder="Enter phone number"
                value={data.customer_phone}
                onChange={handleChange('customer_phone')}
                error={errors.customer_phone}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="GSTIN (Optional)"
                placeholder="Enter GSTIN number"
                value={data.customer_gstin}
                onChange={handleChange('customer_gstin')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Customer Address */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Customer Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  type="text"
                  label="Street Address"
                  placeholder="Enter street address"
                  value={data.customer_street}
                  onChange={handleChange('customer_street')}
                  error={errors.customer_street}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Input
                type="text"
                label="City"
                placeholder="Enter city"
                value={data.customer_city}
                onChange={handleChange('customer_city')}
                error={errors.customer_city}
                required
                disabled={isSubmitting}
              />
              <Select
                options={stateOptions}
                value={data.customer_state}
                onChange={(value) => setData({ customer_state: value })}
                label="State"
                error={errors.customer_state}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Pincode"
                placeholder="Enter 6-digit pincode"
                value={data.customer_pincode}
                onChange={handleChange('customer_pincode')}
                error={errors.customer_pincode}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Invoice Date"
                value={data.invoice_date}
                onChange={handleChange('invoice_date')}
                error={errors.invoice_date}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
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
                  <div className="col-span-5">
                    <Input
                      type="text"
                      label="Description"
                      placeholder="Enter item description"
                      value={item.description}
                      onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      label="Quantity"
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
                      <span className="text-sm text-muted-foreground">Amount: ₹{item.amount.toFixed(2)}</span>
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
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST Amount:</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-border pt-2">
                <span>Total Amount:</span>
                <span>₹{total.toFixed(2)}</span>
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
              disabled={isSubmitting}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/billing')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
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
