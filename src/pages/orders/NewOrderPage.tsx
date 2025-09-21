// ============================================================================
// NEW ORDER PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules, indianDateValidation } from '@/utils/validation';
import { parseIndianDate } from '@/utils/format';
import { hasPermission } from '@/utils/permissions';
import { Customer } from '@/types';
import { OrderService } from '@/services/orderService';
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

const NewOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

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
        
        // Create order using OrderService
        const orderData = {
          customer_id: formData.customer_id,
          event_date: eventDate.toISOString(), // Convert to ISO format for database
          event_type: formData.event_type as 'wedding' | 'corporate' | 'birthday' | 'anniversary' | 'other',
          event_duration: formData.event_duration,
          guest_count: formData.guest_count,
          location_type: formData.location_type as 'indoor' | 'outdoor' | 'both',
          items: [], // TODO: Add inventory items selection
          status: 'pending' as const,
          notes: formData.notes
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
