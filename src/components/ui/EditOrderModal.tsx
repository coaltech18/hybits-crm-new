import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '@/types';
import { OrderService } from '@/services/orderService';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules, indianDateValidation } from '@/utils/validation';
import { formatIndianDate, parseIndianDate } from '@/utils/format';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import Icon from '../AppIcon';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onOrderUpdated: (updatedOrder: Order) => void;
}

interface EditOrderFormData {
  event_date: string;
  event_type: string;
  event_duration: number;
  guest_count: number;
  location_type: string;
  status: string;
  notes: string;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ isOpen, onClose, order, onOrderUpdated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError, setData, reset } = useForm<EditOrderFormData>({
    initialData: {
      event_date: '',
      event_type: '',
      event_duration: 0,
      guest_count: 0,
      location_type: '',
      status: '',
      notes: '',
    },
    validationRules: {
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
      status: [
        commonValidationRules.required('Status is required'),
      ],
    },
    onSubmit: async (formData) => {
      if (!order) return;

      try {
        setIsSubmitting(true);

        // Convert Indian date format to ISO string for database storage
        const eventDate = parseIndianDate(formData.event_date);
        if (!eventDate) {
          setError('event_date', 'Invalid date format');
          return;
        }

        // Update order using OrderService
        const updatedOrder = await OrderService.updateOrderStatus(order.id, formData.status as OrderStatus);
        
        // Update other fields (we'll need to add this to OrderService)
        // For now, we'll just update the status and refresh
        onOrderUpdated(updatedOrder);
        onClose();
      } catch (error: any) {
        setError('event_date', error.message || 'Failed to update order');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Initialize form data when order changes
  useEffect(() => {
    if (order) {
      setData({
        event_date: formatIndianDate(order.event_date),
        event_type: order.event_type,
        event_duration: order.event_duration,
        guest_count: order.guest_count,
        location_type: order.location_type,
        status: order.status,
        notes: order.notes || '',
      });
    }
  }, [order, setData]);

  const eventTypeOptions = [
    { value: 'wedding', label: 'Wedding' },
    { value: 'corporate', label: 'Corporate Event' },
    { value: 'birthday', label: 'Birthday Party' },
    { value: 'anniversary', label: 'Anniversary' },
    { value: 'other', label: 'Other' },
  ];

  const locationTypeOptions = [
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'both', label: 'Both' },
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'items_dispatched', label: 'Items Dispatched' },
    { value: 'items_returned', label: 'Items Returned' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Edit Order - {order.order_number}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update order information
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
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
              onChange={(value) => setData({ event_type: value })}
              label="Event Type"
              error={errors.event_type}
              required
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Event Duration (Days)"
              placeholder="Enter duration"
              value={data.event_duration}
              onChange={handleChange('event_duration')}
              error={errors.event_duration}
              required
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Guest Count"
              placeholder="Enter guest count"
              value={data.guest_count}
              onChange={handleChange('guest_count')}
              error={errors.guest_count}
              required
              disabled={isSubmitting}
            />
            <Select
              options={locationTypeOptions}
              value={data.location_type}
              onChange={(value) => setData({ location_type: value })}
              label="Location Type"
              error={errors.location_type}
              required
              disabled={isSubmitting}
            />
            <Select
              options={statusOptions}
              value={data.status}
              onChange={(value) => setData({ status: value })}
              label="Order Status"
              error={errors.status}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
          <Input
            multiline
            rows={3}
            label="Notes"
            placeholder="Enter any additional notes"
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
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating Order...' : 'Update Order'}
          </Button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

export default EditOrderModal;
