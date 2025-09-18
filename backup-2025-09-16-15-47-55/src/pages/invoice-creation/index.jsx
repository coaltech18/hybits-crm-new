import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

const InvoiceCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get invoice data from location state if editing
  const editingInvoice = location.state?.invoice || null;
  const isEditing = !!editingInvoice;

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerGstin: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [
      {
        id: 1,
        description: '',
        quantity: 1,
        rate: 0,
        gstRate: 18,
        amount: 0
      }
    ],
    notes: '',
    terms: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Mock customers data
  const customers = [
    { id: 1, name: 'Rajesh Enterprises', email: 'rajesh@enterprises.com', gstin: '27ABCDE1234F1Z5' },
    { id: 2, name: 'Mumbai Caterers Ltd', email: 'info@mumbaicaterers.com', gstin: '27FGHIJ5678K2L6' },
    { id: 3, name: 'Golden Events', email: 'contact@goldenevents.com', gstin: '27MNOPQ9012R3S7' },
    { id: 4, name: 'Royal Wedding Planners', email: 'info@royalwedding.com', gstin: '29TUVWX3456Y4Z8' }
  ];

  const gstRates = [
    { value: 0, label: '0% (Exempt)' },
    { value: 5, label: '5%' },
    { value: 12, label: '12%' },
    { value: 18, label: '18%' },
    { value: 28, label: '28%' }
  ];

  useEffect(() => {
    if (isEditing && editingInvoice) {
      setFormData({
        ...editingInvoice,
        invoiceDate: editingInvoice.date || new Date().toISOString().split('T')[0],
        dueDate: editingInvoice.dueDate || ''
      });
    } else {
      // Generate new invoice number
      const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      setFormData(prev => ({
        ...prev,
        invoiceNumber: newInvoiceNumber,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 15 days from now
      }));
    }
  }, [isEditing, editingInvoice]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c.id === parseInt(customerId));
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerName: customer.name,
        customerEmail: customer.email,
        customerGstin: customer.gstin
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Calculate amount
    if (field === 'quantity' || field === 'rate') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : newItems[index].quantity;
      const rate = field === 'rate' ? parseFloat(value) || 0 : newItems[index].rate;
      newItems[index].amount = quantity * rate;
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
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

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const gstBreakdown = { cgst: 0, sgst: 0, igst: 0 };
    
    formData.items.forEach(item => {
      const itemAmount = item.amount || 0;
      const gstAmount = (itemAmount * item.gstRate) / 100;
      
      // For now, assuming all items are within same state (CGST + SGST)
      // In real app, you'd check if customer is in same state
      gstBreakdown.cgst += gstAmount / 2;
      gstBreakdown.sgst += gstAmount / 2;
    });
    
    const totalGst = gstBreakdown.cgst + gstBreakdown.sgst + gstBreakdown.igst;
    const total = subtotal + totalGst;
    
    return { subtotal, gstBreakdown, totalGst, total };
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!formData.customerEmail.trim()) newErrors.customerEmail = 'Customer email is required';
    if (!formData.invoiceDate) newErrors.invoiceDate = 'Invoice date is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';
    
    formData.items.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`item_${index}_description`] = 'Item description is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Valid quantity is required';
      }
      if (!item.rate || item.rate <= 0) {
        newErrors[`item_${index}_rate`] = 'Valid rate is required';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const totals = calculateTotals();
      const invoiceData = {
        ...formData,
        baseAmount: totals.subtotal,
        gstBreakdown: totals.gstBreakdown,
        totalAmount: totals.total,
        paymentStatus: 'pending',
        isGstCompliant: true,
        createdBy: userProfile?.id,
        createdAt: new Date().toISOString()
      };
      
      // In a real app, you'd save to database here
      console.log('Saving invoice:', invoiceData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate back to billing system
      navigate('/gst-compliant-billing-system', { 
        state: { 
          message: isEditing ? 'Invoice updated successfully' : 'Invoice created successfully',
          newInvoice: !isEditing ? invoiceData : null
        }
      });
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErrors({ general: 'Failed to save invoice. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/gst-compliant-billing-system');
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={() => navigate('/')}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditing ? 'Edit Invoice' : 'Create New Invoice'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing ? 'Update invoice details and items' : 'Generate a new GST-compliant invoice'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={loading}
                iconName="Save"
                iconPosition="left"
              >
                {isEditing ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </div>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{errors.general}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="xl:col-span-2 space-y-6">
              {/* Invoice Details */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Invoice Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Invoice Number
                    </label>
                    <Input
                      value={formData.invoiceNumber}
                      onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                      placeholder="INV-2024-001"
                      disabled={isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Invoice Date
                    </label>
                    <Input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                      error={errors.invoiceDate}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Due Date
                    </label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      error={errors.dueDate}
                    />
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Customer Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Customer
                    </label>
                    <Select
                      value=""
                      onChange={handleCustomerSelect}
                      placeholder="Choose existing customer or enter manually"
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.gstin}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Customer Name *
                    </label>
                    <Input
                      value={formData.customerName}
                      onChange={(e) => handleInputChange('customerName', e.target.value)}
                      placeholder="Enter customer name"
                      error={errors.customerName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                      placeholder="customer@example.com"
                      error={errors.customerEmail}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone
                    </label>
                    <Input
                      value={formData.customerPhone}
                      onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      GSTIN
                    </label>
                    <Input
                      value={formData.customerGstin}
                      onChange={(e) => handleInputChange('customerGstin', e.target.value)}
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address
                    </label>
                    <textarea
                      value={formData.customerAddress}
                      onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                      placeholder="Enter customer address"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Invoice Items</h2>
                  <Button
                    variant="outline"
                    onClick={addItem}
                    iconName="Plus"
                    iconPosition="left"
                    size="sm"
                  >
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-4 items-start p-4 border border-border rounded-lg">
                      <div className="col-span-5">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Description *
                        </label>
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Item description"
                          error={errors[`item_${index}_description`]}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Quantity *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          error={errors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Rate (₹) *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                          error={errors[`item_${index}_rate`]}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          GST Rate
                        </label>
                        <Select
                          value={item.gstRate}
                          onChange={(e) => handleItemChange(index, 'gstRate', parseFloat(e.target.value))}
                        >
                          {gstRates.map(rate => (
                            <option key={rate.value} value={rate.value}>
                              {rate.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-end">
                        {formData.items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Icon name="Trash2" size={16} />
                          </Button>
                        )}
                      </div>
                      <div className="col-span-12">
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Amount: </span>
                          <span className="font-medium">₹{item.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Additional Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Additional notes or comments"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Terms & Conditions
                    </label>
                    <textarea
                      value={formData.terms}
                      onChange={(e) => handleInputChange('terms', e.target.value)}
                      placeholder="Payment terms and conditions"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Summary */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Invoice Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {totals.gstBreakdown.cgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST (9%):</span>
                      <span className="font-medium">₹{totals.gstBreakdown.cgst.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {totals.gstBreakdown.sgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST (9%):</span>
                      <span className="font-medium">₹{totals.gstBreakdown.sgst.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {totals.gstBreakdown.igst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IGST (18%):</span>
                      <span className="font-medium">₹{totals.gstBreakdown.igst.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total:</span>
                      <span>₹{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleSave}
                    loading={loading}
                    className="w-full"
                    iconName="Save"
                    iconPosition="left"
                  >
                    {isEditing ? 'Update Invoice' : 'Create Invoice'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvoiceCreation;
