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

const OrderCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get order data from location state if editing
  const editingOrder = location.state?.order || null;
  const isEditing = !!editingOrder;

  const [formData, setFormData] = useState({
    orderNumber: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    eventType: '',
    eventDate: '',
    eventTime: '',
    eventDuration: 8,
    eventLocation: '',
    deliveryAddress: '',
    deliveryDate: '',
    deliveryTime: '',
    pickupDate: '',
    pickupTime: '',
    items: [
      {
        id: 1,
        itemCode: '',
        itemName: '',
        category: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        condition: 'new'
      }
    ],
    subtotal: 0,
    discount: 0,
    discountType: 'percentage', // percentage or fixed
    tax: 0,
    total: 0,
    advancePayment: 0,
    balanceAmount: 0,
    paymentStatus: 'pending',
    orderStatus: 'draft',
    notes: '',
    specialInstructions: '',
    deliveryInstructions: '',
    pickupInstructions: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Mock data for dropdowns
  const customers = [
    { id: 1, name: 'Rajesh Enterprises', email: 'rajesh@enterprises.com', phone: '+91 98765 43210' },
    { id: 2, name: 'Mumbai Caterers Ltd', email: 'info@mumbaicaterers.com', phone: '+91 87654 32109' },
    { id: 3, name: 'Golden Events', email: 'contact@goldenevents.com', phone: '+91 76543 21098' },
    { id: 4, name: 'Royal Wedding Planners', email: 'info@royalwedding.com', phone: '+91 65432 10987' },
    { id: 5, name: 'Celebration Hub', email: 'events@celebrationhub.com', phone: '+91 54321 09876' }
  ];

  const eventTypes = [
    { value: 'wedding', label: 'Wedding' },
    { value: 'corporate', label: 'Corporate Event' },
    { value: 'birthday', label: 'Birthday Party' },
    { value: 'anniversary', label: 'Anniversary' },
    { value: 'conference', label: 'Conference' },
    { value: 'exhibition', label: 'Exhibition' },
    { value: 'festival', label: 'Festival' },
    { value: 'other', label: 'Other' }
  ];

  const inventoryItems = [
    { code: 'ITEM-001', name: 'Dinner Plates (Set of 50)', category: 'crockery', price: 500, condition: 'new' },
    { code: 'ITEM-002', name: 'Serving Bowls (Set of 20)', category: 'crockery', price: 300, condition: 'new' },
    { code: 'ITEM-003', name: 'Chairs (White)', category: 'furniture', price: 50, condition: 'excellent' },
    { code: 'ITEM-004', name: 'Round Tables (6ft)', category: 'furniture', price: 200, condition: 'good' },
    { code: 'ITEM-005', name: 'Chandelier (Crystal)', category: 'lighting', price: 800, condition: 'excellent' },
    { code: 'ITEM-006', name: 'Tablecloths (White)', category: 'linens', price: 150, condition: 'new' },
    { code: 'ITEM-007', name: 'Sound System', category: 'audio-visual', price: 1200, condition: 'good' },
    { code: 'ITEM-008', name: 'Marquee (20x30ft)', category: 'tents', price: 2000, condition: 'excellent' }
  ];

  const orderStatuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'ready-for-delivery', label: 'Ready for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const paymentStatuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' }
  ];

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' }
  ];

  useEffect(() => {
    if (isEditing && editingOrder) {
      setFormData({
        ...editingOrder,
        eventDate: editingOrder.eventDate || '',
        deliveryDate: editingOrder.deliveryDate || '',
        pickupDate: editingOrder.pickupDate || ''
      });
    } else {
      // Generate new order number
      const newOrderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      setFormData(prev => ({
        ...prev,
        orderNumber: newOrderNumber,
        eventDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 2 days from now
      }));
    }
  }, [isEditing, editingOrder]);

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
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Calculate total price
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? parseInt(value) || 0 : newItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : newItems[index].unitPrice;
      newItems[index].totalPrice = quantity * unitPrice;
    }

    // Auto-fill item details when item code is selected
    if (field === 'itemCode') {
      const item = inventoryItems.find(i => i.code === value);
      if (item) {
        newItems[index] = {
          ...newItems[index],
          itemName: item.name,
          category: item.category,
          unitPrice: item.price,
          condition: item.condition,
          totalPrice: newItems[index].quantity * item.price
        };
      }
    }

    setFormData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      itemCode: '',
      itemName: '',
      category: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      condition: 'new'
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
    const subtotal = formData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    
    let discountAmount = 0;
    if (formData.discount > 0) {
      if (formData.discountType === 'percentage') {
        discountAmount = (subtotal * formData.discount) / 100;
      } else {
        discountAmount = formData.discount;
      }
    }
    
    const afterDiscount = subtotal - discountAmount;
    const tax = (afterDiscount * 18) / 100; // 18% GST
    const total = afterDiscount + tax;
    const balanceAmount = total - formData.advancePayment;
    
    return { subtotal, discountAmount, afterDiscount, tax, total, balanceAmount };
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!formData.customerEmail.trim()) newErrors.customerEmail = 'Customer email is required';
    if (!formData.eventType) newErrors.eventType = 'Event type is required';
    if (!formData.eventDate) newErrors.eventDate = 'Event date is required';
    if (!formData.eventLocation.trim()) newErrors.eventLocation = 'Event location is required';
    if (!formData.deliveryDate) newErrors.deliveryDate = 'Delivery date is required';
    if (!formData.pickupDate) newErrors.pickupDate = 'Pickup date is required';
    
    formData.items.forEach((item, index) => {
      if (!item.itemCode.trim()) {
        newErrors[`item_${index}_code`] = 'Item code is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Valid quantity is required';
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
      const orderData = {
        ...formData,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        tax: totals.tax,
        total: totals.total,
        balanceAmount: totals.balanceAmount,
        createdBy: userProfile?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In a real app, you'd save to database here
      console.log('Saving order:', orderData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate back to order management
      navigate('/rental-order-management', { 
        state: { 
          message: isEditing ? 'Order updated successfully' : 'Order created successfully',
          newOrder: !isEditing ? orderData : null
        }
      });
    } catch (error) {
      console.error('Error saving order:', error);
      setErrors({ general: 'Failed to save order. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/rental-order-management');
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
                {isEditing ? 'Edit Rental Order' : 'Create New Rental Order'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing ? 'Update order details and items' : 'Create a new rental order for events and occasions'}
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
                {isEditing ? 'Update Order' : 'Create Order'}
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
              {/* Order Details */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Order Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Order Number
                    </label>
                    <Input
                      value={formData.orderNumber}
                      onChange={(e) => handleInputChange('orderNumber', e.target.value)}
                      placeholder="ORD-2024-001"
                      disabled={isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Order Status
                    </label>
                    <Select
                      value={formData.orderStatus}
                      onChange={(e) => handleInputChange('orderStatus', e.target.value)}
                    >
                      {orderStatuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Customer Information</h2>
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
                          {customer.name} - {customer.email}
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

              {/* Event Details */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Event Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Event Type *
                    </label>
                    <Select
                      value={formData.eventType}
                      onChange={(e) => handleInputChange('eventType', e.target.value)}
                      error={errors.eventType}
                    >
                      <option value="">Select Event Type</option>
                      {eventTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Event Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) => handleInputChange('eventDate', e.target.value)}
                      error={errors.eventDate}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Event Time
                    </label>
                    <Input
                      type="time"
                      value={formData.eventTime}
                      onChange={(e) => handleInputChange('eventTime', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Duration (hours)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.eventDuration}
                      onChange={(e) => handleInputChange('eventDuration', parseInt(e.target.value) || 8)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Event Location *
                    </label>
                    <Input
                      value={formData.eventLocation}
                      onChange={(e) => handleInputChange('eventLocation', e.target.value)}
                      placeholder="Enter event venue address"
                      error={errors.eventLocation}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery & Pickup Schedule */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Delivery & Pickup Schedule</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3">Delivery</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Delivery Date *
                        </label>
                        <Input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                          error={errors.deliveryDate}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Delivery Time
                        </label>
                        <Input
                          type="time"
                          value={formData.deliveryTime}
                          onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Delivery Address
                        </label>
                        <textarea
                          value={formData.deliveryAddress}
                          onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                          placeholder="Enter delivery address (if different from event location)"
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3">Pickup</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Pickup Date *
                        </label>
                        <Input
                          type="date"
                          value={formData.pickupDate}
                          onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                          error={errors.pickupDate}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Pickup Time
                        </label>
                        <Input
                          type="time"
                          value={formData.pickupTime}
                          onChange={(e) => handleInputChange('pickupTime', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Pickup Instructions
                        </label>
                        <textarea
                          value={formData.pickupInstructions}
                          onChange={(e) => handleInputChange('pickupInstructions', e.target.value)}
                          placeholder="Special pickup instructions"
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Order Items</h2>
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
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Item Code *
                        </label>
                        <Select
                          value={item.itemCode}
                          onChange={(e) => handleItemChange(index, 'itemCode', e.target.value)}
                          error={errors[`item_${index}_code`]}
                        >
                          <option value="">Select Item</option>
                          {inventoryItems.map(invItem => (
                            <option key={invItem.code} value={invItem.code}>
                              {invItem.code} - {invItem.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Item Name
                        </label>
                        <Input
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          placeholder="Item name"
                          disabled
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Quantity *
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          error={errors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Unit Price (₹)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
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
                          <span className="text-sm text-muted-foreground">Total: </span>
                          <span className="font-medium">₹{item.totalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Additional Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Special Instructions
                    </label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                      placeholder="Any special requirements or instructions"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Instructions
                    </label>
                    <textarea
                      value={formData.deliveryInstructions}
                      onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                      placeholder="Special delivery instructions"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
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
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Order Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Number:</span>
                    <span className="font-medium">{formData.orderNumber || 'Auto-generated'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Type:</span>
                    <span className="font-medium">
                      {eventTypes.find(e => e.value === formData.eventType)?.label || 'Not selected'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Date:</span>
                    <span className="font-medium">{formData.eventDate || 'Not set'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-medium">{formData.items.length} items</span>
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
                    </div>
                    
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-medium text-success">-₹{totals.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax (18%):</span>
                      <span className="font-medium">₹{totals.tax.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total:</span>
                        <span>₹{totals.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Advance Payment:</span>
                      <span className="font-medium">₹{formData.advancePayment.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance Amount:</span>
                      <span className={`font-medium ${
                        totals.balanceAmount > 0 ? 'text-warning' : 'text-success'
                      }`}>
                        ₹{totals.balanceAmount.toFixed(2)}
                      </span>
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
                    {isEditing ? 'Update Order' : 'Create Order'}
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

export default OrderCreation;
