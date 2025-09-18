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

interface Order {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
  eventDuration?: number;
  guestCount?: number;
  location?: string;
  items?: OrderItem[];
  totalAmount?: number;
  status?: string;
  notes?: string;
}

interface OrderItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface FormData {
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  eventDuration: number;
  guestCount: number;
  location: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  notes: string;
}

const OrderCreation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get order data from location state if editing
  const editingOrder: Order | null = (location.state as any)?.order || null;
  const isEditing = !!editingOrder;

  const [formData, setFormData] = useState<FormData>({
    orderNumber: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    eventType: '',
    eventDate: '',
    eventTime: '',
    eventDuration: 0,
    guestCount: 0,
    location: '',
    items: [],
    totalAmount: 0,
    status: 'pending',
    notes: ''
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form data if editing existing order
  useEffect(() => {
    if (editingOrder) {
      setFormData({
        orderNumber: editingOrder.orderNumber || '',
        customerId: editingOrder.customerId || '',
        customerName: editingOrder.customerName || '',
        customerEmail: editingOrder.customerEmail || '',
        customerPhone: editingOrder.customerPhone || '',
        customerAddress: editingOrder.customerAddress || '',
        eventType: editingOrder.eventType || '',
        eventDate: editingOrder.eventDate || '',
        eventTime: editingOrder.eventTime || '',
        eventDuration: editingOrder.eventDuration || 0,
        guestCount: editingOrder.guestCount || 0,
        location: editingOrder.location || '',
        items: editingOrder.items || [],
        totalAmount: editingOrder.totalAmount || 0,
        status: editingOrder.status || 'pending',
        notes: editingOrder.notes || ''
      });
    }
  }, [editingOrder]);

  const eventTypeOptions = [
    { value: 'wedding', label: 'Wedding' },
    { value: 'corporate', label: 'Corporate Event' },
    { value: 'birthday', label: 'Birthday Party' },
    { value: 'anniversary', label: 'Anniversary' },
    { value: 'festival', label: 'Festival' },
    { value: 'other', label: 'Other' }
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const locationOptions = [
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'mixed', label: 'Mixed' }
  ];

  const handleInputChange = (field: keyof FormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddItem = (): void => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      itemName: '',
      quantity: 1,
      rate: 0,
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
    calculateTotal();
  };

  const handleItemChange = (itemId: string, field: keyof OrderItem, value: string | number): void => {
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
    calculateTotal();
  };

  const calculateTotal = (): void => {
    const total = formData.items.reduce((sum, item) => sum + item.amount, 0);
    setFormData(prev => ({ ...prev, totalAmount: total }));
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

    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = 'Customer phone is required';
    }

    if (!formData.eventType) {
      newErrors.eventType = 'Event type is required';
    }

    if (!formData.eventDate) {
      newErrors.eventDate = 'Event date is required';
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
      
      console.log('Order data:', formData);
      
      // Navigate back to order management with success message
      navigate('/rental-order-management', {
        state: {
          message: isEditing 
            ? 'Order updated successfully!' 
            : 'Order created successfully!'
        }
      });
    } catch (error) {
      console.error('Error saving order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (): void => {
    navigate('/rental-order-management');
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
              {isEditing ? 'Edit Order' : 'Create New Order'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing 
                ? 'Update order information and details.' 
                : 'Create a new rental order with customer and event details.'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Customer Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="User" size={20} className="mr-2" />
                Customer Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Order Number"
                  value={formData.orderNumber}
                  onChange={(e) => handleInputChange('orderNumber', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
                <Input
                  label="Customer ID"
                  value={formData.customerId}
                  onChange={(e) => handleInputChange('customerId', e.target.value)}
                  placeholder="Customer ID (optional)"
                />
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
                  label="Customer Phone *"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                  error={errors.customerPhone}
                  required
                />
                <div className="md:col-span-2">
                  <Input
                    label="Customer Address"
                    value={formData.customerAddress}
                    onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                    placeholder="Complete address for delivery"
                  />
                </div>
              </div>
            </div>

            {/* Event Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="Calendar" size={20} className="mr-2" />
                Event Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Event Type *"
                  value={formData.eventType}
                  onChange={(value) => handleInputChange('eventType', value)}
                  options={eventTypeOptions}
                  error={errors.eventType}
                  required
                />
                <Input
                  label="Event Date *"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => handleInputChange('eventDate', e.target.value)}
                  error={errors.eventDate}
                  required
                />
                <Input
                  label="Event Time"
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) => handleInputChange('eventTime', e.target.value)}
                />
                <Input
                  label="Event Duration (hours)"
                  type="number"
                  value={formData.eventDuration}
                  onChange={(e) => handleInputChange('eventDuration', parseInt(e.target.value) || 0)}
                />
                <Input
                  label="Guest Count"
                  type="number"
                  value={formData.guestCount}
                  onChange={(e) => handleInputChange('guestCount', parseInt(e.target.value) || 0)}
                />
                <Select
                  label="Location Type"
                  value={formData.location}
                  onChange={(value) => handleInputChange('location', value)}
                  options={locationOptions}
                />
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center">
                  <Icon name="Package" size={20} className="mr-2" />
                  Order Items
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
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border border-border rounded-lg">
                      <Input
                        label="Item Name"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                        placeholder="Item name"
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
                  
                  <div className="flex justify-end pt-4 border-t border-border">
                    <div className="text-lg font-semibold text-foreground">
                      Total Amount: ₹{formData.totalAmount.toLocaleString()}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(value) => handleInputChange('status', value)}
                  options={statusOptions}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes or special instructions"
                    multiline
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEditing ? 'Update Order' : 'Create Order'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default OrderCreation;
