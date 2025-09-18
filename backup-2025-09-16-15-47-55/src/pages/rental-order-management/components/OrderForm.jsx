import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const OrderForm = ({ order, onSave, onCancel, isEditing = false }) => {
  const [activeTab, setActiveTab] = useState('items');
  const [formData, setFormData] = useState({
    customerId: order?.customerId || '',
    customerName: order?.customerName || '',
    customerPhone: order?.customerPhone || '',
    customerEmail: order?.customerEmail || '',
    startDate: order?.startDate || '',
    endDate: order?.endDate || '',
    deliveryAddress: order?.deliveryAddress || '',
    items: order?.items || [],
    pricing: order?.pricing || {
      subtotal: 0,
      discount: 0,
      gst: 0,
      total: 0,
      securityDeposit: 0
    },
    delivery: order?.delivery || {
      type: 'standard',
      date: '',
      timeSlot: '',
      instructions: ''
    },
    payment: order?.payment || {
      terms: 'advance',
      method: 'online',
      dueDate: ''
    },
    specialInstructions: order?.specialInstructions || ''
  });

  const [availabilityCheck, setAvailabilityCheck] = useState({});

  const tabs = [
    { id: 'items', label: 'Items & Quantities', icon: 'Package' },
    { id: 'pricing', label: 'Pricing & Discounts', icon: 'Calculator' },
    { id: 'delivery', label: 'Delivery Logistics', icon: 'Truck' },
    { id: 'payment', label: 'Payment Terms', icon: 'CreditCard' },
    { id: 'notes', label: 'Special Instructions', icon: 'FileText' }
  ];

  const customerOptions = [
    { value: 'CUST001', label: 'Rajesh Kumar - 9876543210' },
    { value: 'CUST002', label: 'Priya Sharma - 9876543211' },
    { value: 'CUST003', label: 'Amit Patel - 9876543212' },
    { value: 'CUST004', label: 'Sunita Gupta - 9876543213' },
    { value: 'CUST005', label: 'Vikram Singh - 9876543214' }
  ];

  const itemCategories = [
    { value: 'plates', label: 'Dinner Plates' },
    { value: 'bowls', label: 'Bowls' },
    { value: 'cups', label: 'Cups & Glasses' },
    { value: 'cutlery', label: 'Cutlery Sets' },
    { value: 'serving', label: 'Serving Dishes' }
  ];

  const deliveryTimeSlots = [
    { value: '9-12', label: '9:00 AM - 12:00 PM' },
    { value: '12-15', label: '12:00 PM - 3:00 PM' },
    { value: '15-18', label: '3:00 PM - 6:00 PM' },
    { value: '18-21', label: '6:00 PM - 9:00 PM' }
  ];

  const paymentTermsOptions = [
    { value: 'advance', label: '100% Advance' },
    { value: 'partial', label: '50% Advance, 50% on Delivery' },
    { value: 'delivery', label: 'Payment on Delivery' },
    { value: 'credit', label: '30 Days Credit' }
  ];

  const paymentMethodOptions = [
    { value: 'online', label: 'Online Payment' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'bank-transfer', label: 'Bank Transfer' }
  ];

  const mockInventoryItems = [
    { id: 'PLT001', name: 'Standard Dinner Plate', category: 'plates', available: 150, price: 5 },
    { id: 'PLT002', name: 'Premium Dinner Plate', category: 'plates', available: 80, price: 8 },
    { id: 'BWL001', name: 'Serving Bowl Large', category: 'bowls', available: 60, price: 12 },
    { id: 'BWL002', name: 'Serving Bowl Medium', category: 'bowls', available: 90, price: 8 },
    { id: 'CUP001', name: 'Tea Cup with Saucer', category: 'cups', available: 120, price: 6 },
    { id: 'GLS001', name: 'Water Glass', category: 'cups', available: 200, price: 4 },
    { id: 'CUT001', name: 'Cutlery Set (5 pieces)', category: 'cutlery', available: 50, price: 15 }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev?.[section],
        [field]: value
      }
    }));
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      itemId: '',
      name: '',
      category: '',
      quantity: 1,
      price: 0,
      total: 0,
      available: 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev?.items, newItem]
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData?.items];
    updatedItems[index] = { ...updatedItems?.[index], [field]: value };

    if (field === 'itemId') {
      const selectedItem = mockInventoryItems?.find(item => item?.id === value);
      if (selectedItem) {
        updatedItems[index] = {
          ...updatedItems?.[index],
          name: selectedItem?.name,
          category: selectedItem?.category,
          price: selectedItem?.price,
          available: selectedItem?.available,
          total: selectedItem?.price * updatedItems?.[index]?.quantity
        };
      }
    }

    if (field === 'quantity') {
      updatedItems[index].total = updatedItems?.[index]?.price * value;
    }

    setFormData(prev => ({ ...prev, items: updatedItems }));
    calculatePricing(updatedItems);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = formData?.items?.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
    calculatePricing(updatedItems);
  };

  const calculatePricing = (items) => {
    const subtotal = items?.reduce((sum, item) => sum + item?.total, 0);
    const discount = formData?.pricing?.discount || 0;
    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const gst = taxableAmount * 0.18; // 18% GST
    const total = taxableAmount + gst;
    const securityDeposit = total * 0.2; // 20% security deposit

    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev?.pricing,
        subtotal,
        gst,
        total,
        securityDeposit
      }
    }));
  };

  const checkAvailability = () => {
    const availability = {};
    formData?.items?.forEach(item => {
      if (item?.itemId && item?.quantity > 0) {
        const inventoryItem = mockInventoryItems?.find(inv => inv?.id === item?.itemId);
        availability[item.id] = {
          available: inventoryItem?.available || 0,
          requested: item?.quantity,
          status: item?.quantity <= (inventoryItem?.available || 0) ? 'available' : 'insufficient'
        };
      }
    });
    setAvailabilityCheck(availability);
  };

  const handleSave = () => {
    onSave(formData);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'items':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Customer"
                options={customerOptions}
                value={formData?.customerId}
                onChange={(value) => handleInputChange('customerId', value)}
                searchable
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={formData?.startDate}
                  onChange={(e) => handleInputChange('startDate', e?.target?.value)}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData?.endDate}
                  onChange={(e) => handleInputChange('endDate', e?.target?.value)}
                  required
                />
              </div>
            </div>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-foreground">Rental Items</h4>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkAvailability}
                    iconName="Search"
                    iconPosition="left"
                  >
                    Check Availability
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddItem}
                    iconName="Plus"
                    iconPosition="left"
                  >
                    Add Item
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {formData?.items?.map((item, index) => (
                  <div key={item?.id} className="grid grid-cols-12 gap-3 items-end p-3 bg-muted/30 rounded-lg">
                    <div className="col-span-4">
                      <Select
                        label="Item"
                        options={mockInventoryItems?.map(inv => ({
                          value: inv?.id,
                          label: `${inv?.name} (₹${inv?.price}/day)`
                        }))}
                        value={item?.itemId}
                        onChange={(value) => handleItemChange(index, 'itemId', value)}
                        searchable
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        value={item?.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e?.target?.value) || 1)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label="Price/Day"
                        type="number"
                        value={item?.price}
                        disabled
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label="Total"
                        value={formatCurrency(item?.total)}
                        disabled
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                    {availabilityCheck?.[item?.id] && (
                      <div className="col-span-12 mt-2">
                        <div className={`text-xs p-2 rounded ${
                          availabilityCheck?.[item?.id]?.status === 'available' ?'bg-green-100 text-green-800' :'bg-red-100 text-red-800'
                        }`}>
                          {availabilityCheck?.[item?.id]?.status === 'available' 
                            ? `✓ Available (${availabilityCheck?.[item?.id]?.available} in stock)`
                            : `⚠ Insufficient stock (${availabilityCheck?.[item?.id]?.available} available, ${availabilityCheck?.[item?.id]?.requested} requested)`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {formData?.items?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Item" to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label="Discount (%)"
                  type="number"
                  min="0"
                  max="100"
                  value={formData?.pricing?.discount}
                  onChange={(e) => {
                    const discount = parseFloat(e?.target?.value) || 0;
                    handleNestedInputChange('pricing', 'discount', discount);
                    calculatePricing(formData?.items);
                  }}
                />
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="font-semibold text-foreground mb-3">Pricing Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(formData?.pricing?.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount ({formData?.pricing?.discount}%):</span>
                    <span>-{formatCurrency((formData?.pricing?.subtotal * formData?.pricing?.discount) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18%):</span>
                    <span>{formatCurrency(formData?.pricing?.gst)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-semibold">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(formData?.pricing?.total)}</span>
                  </div>
                  <div className="flex justify-between text-warning">
                    <span>Security Deposit:</span>
                    <span>{formatCurrency(formData?.pricing?.securityDeposit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'delivery':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Delivery Type"
                options={[
                  { value: 'standard', label: 'Standard Delivery' },
                  { value: 'express', label: 'Express Delivery (+₹200)' },
                  { value: 'pickup', label: 'Customer Pickup' }
                ]}
                value={formData?.delivery?.type}
                onChange={(value) => handleNestedInputChange('delivery', 'type', value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Delivery Date"
                  type="date"
                  value={formData?.delivery?.date}
                  onChange={(e) => handleNestedInputChange('delivery', 'date', e?.target?.value)}
                />
                <Select
                  label="Time Slot"
                  options={deliveryTimeSlots}
                  value={formData?.delivery?.timeSlot}
                  onChange={(value) => handleNestedInputChange('delivery', 'timeSlot', value)}
                />
              </div>
            </div>
            <Input
              label="Delivery Address"
              value={formData?.deliveryAddress}
              onChange={(e) => handleInputChange('deliveryAddress', e?.target?.value)}
              placeholder="Enter complete delivery address..."
            />
            <Input
              label="Delivery Instructions"
              value={formData?.delivery?.instructions}
              onChange={(e) => handleNestedInputChange('delivery', 'instructions', e?.target?.value)}
              placeholder="Special instructions for delivery team..."
            />
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Payment Terms"
                options={paymentTermsOptions}
                value={formData?.payment?.terms}
                onChange={(value) => handleNestedInputChange('payment', 'terms', value)}
              />
              <Select
                label="Payment Method"
                options={paymentMethodOptions}
                value={formData?.payment?.method}
                onChange={(value) => handleNestedInputChange('payment', 'method', value)}
              />
            </div>
            <Input
              label="Payment Due Date"
              type="date"
              value={formData?.payment?.dueDate}
              onChange={(e) => handleNestedInputChange('payment', 'dueDate', e?.target?.value)}
            />
          </div>
        );

      case 'notes':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Special Instructions
              </label>
              <textarea
                className="w-full h-32 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                value={formData?.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e?.target?.value)}
                placeholder="Enter any special instructions, requirements, or notes for this order..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEditing ? `Edit Order ${order?.orderId}` : 'Create New Order'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing ? 'Modify order details and save changes' : 'Fill in the details to create a new rental order'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSave}>
              {isEditing ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8 px-6">
          {tabs?.map((tab) => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab?.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon name={tab?.icon} size={16} />
              <span>{tab?.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default OrderForm;