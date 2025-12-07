// ============================================================================
// NEW ORDER PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules, indianDateValidation } from '@/utils/validation';
import { parseIndianDate } from '@/utils/format';
import { hasPermission } from '@/utils/permissions';
import { Customer, InventoryItem } from '@/types';
import { OrderService } from '@/services/orderService';
import inventoryService from '@/services/inventoryService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomerSelector from '@/components/ui/CustomerSelector';
import AddCustomerModal from '@/components/ui/AddCustomerModal';
import Icon from '@/components/AppIcon';

interface OrderFormData {
  customer_id: string;
  event_date: string;
  event_type: string;
  event_duration: number;
  guest_count: number;
  location_type: string;
  notes: string;
}

interface OrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  rental_days: number;
  rate: number;
  gst_rate?: number; // Optional, defaults to 18%
}

const NewOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, getCurrentOutletId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const { data, errors, handleChange, handleSubmit, setError, setData } = useForm<OrderFormData>({
    initialData: {
      customer_id: '',
      event_date: '',
      event_type: '',
      event_duration: 0,
      guest_count: 0,
      location_type: '',
      notes: '',
    },
    validationRules: {
      customer_id: [
        commonValidationRules.required('Customer selection is required'),
      ],
      event_date: [
        commonValidationRules.required('Event date is required'),
        indianDateValidation,
      ],
      event_type: [
        commonValidationRules.required('Event type is required'),
      ],
      event_duration: [
        commonValidationRules.required('Event duration is required'),
      ],
      guest_count: [
        commonValidationRules.required('Guest count is required'),
      ],
      location_type: [
        commonValidationRules.required('Location type is required'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        
        // Convert Indian date format to ISO string for database storage
        const eventDate = parseIndianDate(formData.event_date);
        if (!eventDate) {
          setError('event_date', 'Invalid date format');
          return;
        }
        
        // Validate selected items
        const validItems = selectedItems.filter(item => item.item_id && item.quantity > 0);
        if (validItems.length === 0) {
          setError('customer_id', 'Please add at least one inventory item');
          return;
        }

        // Get current outlet ID
        const currentOutletId = getCurrentOutletId();
        if (!currentOutletId) {
          setError('customer_id', 'Outlet not selected');
          return;
        }

        // Create order using OrderService
        const orderData = {
          customer_id: formData.customer_id,
          event_date: eventDate.toISOString(), // Convert to ISO format for database
          event_type: formData.event_type as 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other',
          event_duration: formData.event_duration,
          guest_count: formData.guest_count,
          location_type: formData.location_type as 'indoor' | 'outdoor' | 'both',
          items: validItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            rate: item.rate,
            rental_days: item.rental_days,
            gst_rate: item.gst_rate !== undefined ? item.gst_rate : 18 // Default 18%
          })),
          status: 'pending' as const,
          notes: formData.notes,
          outlet_id: currentOutletId
        };

        console.log('Creating order with data:', orderData);
        const newOrder = await OrderService.createOrder(orderData);
        console.log('Order created successfully:', newOrder);
        
        // Redirect to orders page
        navigate('/orders');
      } catch (error: any) {
        setError('customer_id', error.message || 'Failed to create order');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setData({ customer_id: customer?.id || '' });
  };

  const handleCustomerAdded = (newCustomer: Customer) => {
    setSelectedCustomer(newCustomer);
    setData({ customer_id: newCustomer.id });
    setShowAddCustomerModal(false);
  };

  // Fetch inventory items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoadingItems(true);
        setItemsError(null);
        
        // For managers, filter by their outlet. For admins/accountants, show all items
        const currentOutletId = user?.role === 'manager' ? getCurrentOutletId() : undefined;
        
        // Fetch items with proper outlet filtering at service level
        const options: { outletId?: string; userRole?: 'admin' | 'manager' | 'accountant' } = {};
        if (currentOutletId) {
          options.outletId = currentOutletId;
        }
        if (user?.role && (user.role === 'admin' || user.role === 'manager' || user.role === 'accountant')) {
          options.userRole = user.role;
        }
        const items = await inventoryService.getInventoryItems(options);
        
        setInventoryItems(items);
        
        if (items.length === 0) {
          if (user?.role === 'manager') {
            setItemsError('No inventory items found for your outlet. Please add items to inventory first.');
          } else {
            setItemsError('No inventory items found. Please add items to inventory first.');
          }
        }
      } catch (error: any) {
        setItemsError(error.message || 'Failed to load inventory items. Please refresh the page.');
      } finally {
        setLoadingItems(false);
      }
    };
    
    if (user) {
      fetchItems();
    }
  }, [user]);

  const addOrderItem = () => {
    setSelectedItems([...selectedItems, {
      item_id: '',
      item_name: '',
      quantity: 1,
      rental_days: 1,
      rate: 0
    }]);
  };

  const removeOrderItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...selectedItems];
    const currentItem = updated[index];
    if (!currentItem) return;
    
    updated[index] = { ...currentItem, [field]: value };
    
    // If item_id changed, update item_name and rate
    if (field === 'item_id') {
      const item = inventoryItems.find(i => i.id === value);
      if (item) {
        updated[index] = {
          ...updated[index],
          item_name: item.name,
          rate: item.unit_price || 0
        };
      }
    }
    
    setSelectedItems(updated);
  };

  const eventTypeOptions = [
    { value: '', label: 'Select event type' },
    { value: 'wedding', label: 'Wedding' },
    { value: 'corporate', label: 'Corporate Event' },
    { value: 'birthday', label: 'Birthday Party' },
    { value: 'anniversary', label: 'Anniversary' },
    { value: 'other', label: 'Other' },
  ];

  const locationTypeOptions = [
    { value: '', label: 'Select location type' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'both', label: 'Both Indoor & Outdoor' },
  ];

  if (!user || !hasPermission(user.role, 'orders', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Order</h1>
          <p className="text-muted-foreground">
            Create a new rental order for your customer
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/orders')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Orders
        </Button>
      </div>

      {/* Order Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
            <div className="space-y-4">
              <CustomerSelector
                value={selectedCustomer}
                onChange={handleCustomerSelect}
                error={errors.customer_id || undefined}
                required
                disabled={isSubmitting}
                onAddNewCustomer={() => setShowAddCustomerModal(true)}
              />
              
              {/* Customer Details Preview */}
              {selectedCustomer && (
                <div className="bg-muted/30 border border-border rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">Selected Customer Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{selectedCustomer.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Company:</span>
                      <span className="ml-2 font-medium">{selectedCustomer.company || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="ml-2 font-medium">{selectedCustomer.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <span className="ml-2 font-medium">{selectedCustomer.email}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="ml-2 font-medium">
                        {selectedCustomer.address.street}, {selectedCustomer.address.city}, {selectedCustomer.address.state} - {selectedCustomer.address.pincode}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Event Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Event Date"
                placeholder="DD-MM-YYYY"
                value={data.event_date}
                onChange={handleChange('event_date')}
                error={errors.event_date}
                required
                disabled={isSubmitting}
              />
              <Select
                options={eventTypeOptions}
                value={data.event_type}
                onChange={(value) => handleChange('event_type')({ target: { value } } as any)}
                label="Event Type"
                error={errors.event_type}
                required
                disabled={isSubmitting}
              />
              <Input
                type="number"
                label="Event Duration (hours)"
                placeholder="Enter duration in hours"
                value={data.event_duration}
                onChange={handleChange('event_duration')}
                error={errors.event_duration}
                required
                min={1}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                label="Guest Count"
                placeholder="Enter number of guests"
                value={data.guest_count}
                onChange={handleChange('guest_count')}
                error={errors.guest_count}
                required
                min={1}
                disabled={isSubmitting}
              />
              <Select
                options={locationTypeOptions}
                value={data.location_type}
                onChange={(value) => handleChange('location_type')({ target: { value } } as any)}
                label="Location Type"
                error={errors.location_type}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Inventory Items Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Inventory Items</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addOrderItem}
                disabled={isSubmitting || loadingItems}
              >
                <Icon name="plus" size={16} className="mr-2" />
                Add Item
              </Button>
            </div>
            
            {loadingItems ? (
              <div className="text-center py-4 text-muted-foreground">
                <Icon name="loader" size={24} className="mx-auto mb-2 animate-spin" />
                Loading inventory items...
              </div>
            ) : itemsError ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center">
                  <Icon name="alert-triangle" size={20} className="text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{itemsError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/inventory/new')}
                      className="mt-2"
                    >
                      <Icon name="plus" size={14} className="mr-2" />
                      Add Inventory Item
                    </Button>
                  </div>
                </div>
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center">
                  <Icon name="alert-triangle" size={20} className="text-yellow-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      No inventory items found. Please add items to inventory first.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/inventory/new')}
                      className="mt-2"
                    >
                      <Icon name="plus" size={14} className="mr-2" />
                      Add Inventory Item
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-end p-4 border border-border rounded-lg">
                    <div className="col-span-4">
                      <Select
                        options={[
                          { value: '', label: 'Select item' },
                          ...inventoryItems.map(i => ({ 
                            value: i.id, 
                            label: `${i.name}${i.code ? ` (${i.code})` : ''}` 
                          }))
                        ]}
                        value={item.item_id}
                        onChange={(value) => updateOrderItem(index, 'item_id', value)}
                        label="Item"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        label="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min={1}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        label="Rental Days"
                        value={item.rental_days}
                        onChange={(e) => updateOrderItem(index, 'rental_days', parseInt(e.target.value) || 1)}
                        min={1}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        label="Rate (₹)"
                        value={item.rate}
                        onChange={(e) => updateOrderItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrderItem(index)}
                        disabled={isSubmitting}
                        className="text-destructive hover:text-destructive"
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </div>
                    <div className="col-span-12">
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">
                          Total: ₹{(item.quantity * item.rental_days * item.rate).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border border-border rounded-lg">
                    <Icon name="package" size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No items selected. Click "Add Item" to add inventory items to this order.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
            <Input
              multiline
              rows={4}
              label="Notes"
              placeholder="Enter any additional notes or special requirements..."
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
              onClick={() => navigate('/orders')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Order...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </div>
  );
};

export default NewOrderPage;
