import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { LocationState } from '@/types';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Icon from '../../components/AppIcon.tsx';

interface Invoice {
  id?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  invoiceDate?: string;
  dueDate?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  gstAmount?: number;
  totalAmount?: number;
  status?: string;
  notes?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
  amount: number;
}

interface FormData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerGstin: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: string;
  notes: string;
}

const InvoiceCreation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get invoice data from location state if editing
  const editingInvoice: Invoice | null = (location.state as any)?.invoice || null;
  const isEditing = !!editingInvoice;

  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerGstin: '',
    invoiceDate: new Date().toISOString().split('T')[0] || '',
    dueDate: '',
    items: [
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        gstRate: 18,
        amount: 0
      }
    ],
    subtotal: 0,
    gstAmount: 0,
    totalAmount: 0,
    status: 'draft',
    notes: ''
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form data if editing existing invoice
  useEffect(() => {
    if (editingInvoice) {
      setFormData({
        invoiceNumber: editingInvoice.invoiceNumber || '',
        customerName: editingInvoice.customerName || '',
        customerEmail: editingInvoice.customerEmail || '',
        customerPhone: editingInvoice.customerPhone || '',
        customerAddress: editingInvoice.customerAddress || '',
        customerGstin: editingInvoice.customerGstin || '',
        invoiceDate: editingInvoice.invoiceDate || new Date().toISOString().split('T')[0] || '',
        dueDate: editingInvoice.dueDate || '',
        items: editingInvoice.items || [
          {
            id: '1',
            description: '',
            quantity: 1,
            rate: 0,
            gstRate: 18,
            amount: 0
          }
        ],
        subtotal: editingInvoice.subtotal || 0,
        gstAmount: editingInvoice.gstAmount || 0,
        totalAmount: editingInvoice.totalAmount || 0,
        status: editingInvoice.status || 'draft',
        notes: editingInvoice.notes || ''
      });
    }
  }, [editingInvoice]);

  const gstRateOptions = [
    { value: 0, label: '0% (Exempt)' },
    { value: 5, label: '5%' },
    { value: 12, label: '12%' },
    { value: 18, label: '18%' },
    { value: 28, label: '28%' }
  ];

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const handleInputChange = (field: keyof FormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddItem = (): void => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      gstRate: 18,
      amount: 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (itemId: string): void => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
    calculateTotals();
  };

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: string | number): void => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      })
    }));
    calculateTotals();
  };

  const calculateTotals = (): void => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = formData.items.reduce((sum, item) => sum + (item.amount * item.gstRate / 100), 0);
    const totalAmount = subtotal + gstAmount;
    
    setFormData(prev => ({ 
      ...prev, 
      subtotal,
      gstAmount,
      totalAmount
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = 'Customer email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Email is invalid';
    }

    if (!formData.invoiceDate) {
      newErrors.invoiceDate = 'Invoice date is required';
    }

    if (formData.items.length === 0) {
      newErrors.items = 'At least one item is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Invoice data:', formData);
      
      // Navigate back to billing system with success message
      navigate('/gst-compliant-billing-system', {
        state: {
          message: isEditing 
            ? 'Invoice updated successfully!' 
            : 'Invoice created successfully!'
        }
      });
    } catch (error) {
      console.error('Error saving invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (): void => {
    navigate('/gst-compliant-billing-system');
  };

  const handleLogout = (): void => {
    navigate('/authentication-role-selection');
  };

  const handleRoleSwitch = (): void => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query: string): void => {
    console.log('Global search:', query);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={userProfile}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onSearch={handleSearchAction}
      />
      
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />

      <main className={`pt-16 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      }`}>
        <div className="p-6">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isEditing ? 'Edit Invoice' : 'Create New Invoice'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing 
                ? 'Update invoice information and billing details.' 
                : 'Create a new GST-compliant invoice with customer and item details.'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Invoice Header */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="FileText" size={20} className="mr-2" />
                Invoice Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Invoice Number"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
                <Input
                  label="Invoice Date *"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                  error={errors.invoiceDate}
                  required
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                />
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(value) => handleInputChange('status', value)}
                  options={statusOptions}
                />
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="User" size={20} className="mr-2" />
                Customer Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Customer Name *"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  error={errors.customerName}
                  required
                />
                <Input
                  label="Customer Email *"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                  error={errors.customerEmail}
                  required
                />
                <Input
                  label="Customer Phone"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                />
                <Input
                  label="Customer GSTIN"
                  value={formData.customerGstin}
                  onChange={(e) => handleInputChange('customerGstin', e.target.value)}
                  placeholder="e.g., 27ABCDE1234F1Z5"
                />
                <div className="md:col-span-2">
                  <Input
                    label="Customer Address"
                    value={formData.customerAddress}
                    onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                    placeholder="Complete billing address"
                  />
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center">
                  <Icon name="Package" size={20} className="mr-2" />
                  Invoice Items
                </h2>
                <Button type="button" onClick={handleAddItem} iconName="Plus">
                  Add Item
                </Button>
              </div>
              
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Package" size={48} className="mx-auto mb-4" />
                  <p>No items added yet. Click "Add Item" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, _index) => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border border-border rounded-lg">
                      <Input
                        label="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                      <Input
                        label="Quantity"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      />
                      <Input
                        label="Rate (₹)"
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      />
                      <Select
                        label="GST Rate"
                        value={item.gstRate}
                        onChange={(value) => handleItemChange(item.id, 'gstRate', parseFloat(value))}
                        options={gstRateOptions}
                      />
                      <Input
                        label="Amount (₹)"
                        type="number"
                        value={item.amount}
                        readOnly
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-foreground">Subtotal:</span>
                      <span className="font-medium">₹{formData.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">GST Amount:</span>
                      <span className="font-medium">₹{formData.gstAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
                      <span className="text-foreground">Total Amount:</span>
                      <span>₹{formData.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {errors.items && (
                <p className="text-sm text-destructive mt-2">{errors.items}</p>
              )}
            </div>

            {/* Additional Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="FileText" size={20} className="mr-2" />
                Additional Information
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes or terms and conditions"
                  multiline
                  rows={4}
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEditing ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default InvoiceCreation;
