// ============================================================================
// NEW ORDER PAGE
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

interface OrderFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
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

  const { data, errors, handleChange, handleSubmit, setError } = useForm<OrderFormData>({
    initialData: {
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      event_date: '',
      event_type: '',
      event_duration: 0,
      guest_count: 0,
      location_type: '',
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
      event_date: [
        commonValidationRules.required('Event date is required'),
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
        // TODO: Implement order creation API call
        console.log('Creating order:', formData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to orders page
        navigate('/orders');
      } catch (error: any) {
        setError('customer_name', error.message || 'Failed to create order');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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
            </div>
          </div>

          {/* Event Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Event Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Event Date"
                placeholder="YYYY-MM-DD"
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
    </div>
  );
};

export default NewOrderPage;
