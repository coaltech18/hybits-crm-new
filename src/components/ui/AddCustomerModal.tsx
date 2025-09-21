// ============================================================================
// ADD CUSTOMER MODAL COMPONENT
// ============================================================================

import React, { useState } from 'react';
import { Customer, CustomerFormData } from '@/types';
import { CustomerService } from '@/services/customerService';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Icon from '../AppIcon';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: Customer) => void;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerAdded
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError, setData, reset } = useForm<CustomerFormData>({
    initialData: {
      name: '',
      email: '',
      phone: '',
      company: '',
      address: {
        street: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
      },
      gstin: '',
      status: 'active',
    },
    validationRules: {
      name: [
        commonValidationRules.required('Customer name is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
      ],
      email: [
        commonValidationRules.required('Email is required'),
        commonValidationRules.email('Please enter a valid email address'),
      ],
      phone: [
        commonValidationRules.required('Phone number is required'),
        commonValidationRules.pattern(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        const newCustomer = await CustomerService.createCustomer(formData);
        onCustomerAdded(newCustomer);
        reset();
        onClose();
      } catch (error: any) {
        setError('name', error.message || 'Failed to create customer');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add New Customer</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new customer that will be available for orders
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Customer Name"
                placeholder="Enter customer name"
                value={data.name}
                onChange={handleChange('name')}
                error={errors.name}
                required
                disabled={isSubmitting}
              />
              <Input
                type="email"
                label="Email"
                placeholder="Enter email address"
                value={data.email}
                onChange={handleChange('email')}
                error={errors.email}
                required
                disabled={isSubmitting}
              />
              <Input
                type="tel"
                label="Phone Number"
                placeholder="Enter phone number"
                value={data.phone}
                onChange={handleChange('phone')}
                error={errors.phone}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Company (Optional)"
                placeholder="Enter company name"
                value={data.company || ''}
                onChange={handleChange('company')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  type="text"
                  label="Street Address"
                  placeholder="Enter street address"
                  value={data.address.street}
                  onChange={(e) => setData({
                    address: { ...data.address, street: e.target.value }
                  })}
                  disabled={isSubmitting}
                />
              </div>
              <Input
                type="text"
                label="City"
                placeholder="Enter city"
                value={data.address.city}
                onChange={(e) => setData({
                  address: { ...data.address, city: e.target.value }
                })}
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="State"
                placeholder="Enter state"
                value={data.address.state}
                onChange={(e) => setData({
                  address: { ...data.address, state: e.target.value }
                })}
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Pincode"
                placeholder="Enter pincode"
                value={data.address.pincode}
                onChange={(e) => setData({
                  address: { ...data.address, pincode: e.target.value }
                })}
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Country"
                placeholder="Enter country"
                value={data.address.country}
                onChange={(e) => setData({
                  address: { ...data.address, country: e.target.value }
                })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="GSTIN (Optional)"
                placeholder="Enter GSTIN number"
                value={data.gstin || ''}
                onChange={handleChange('gstin')}
                disabled={isSubmitting}
              />
              <Select
                options={statusOptions}
                value={data.status}
                onChange={(value) => setData({ status: value as 'active' | 'inactive' | 'suspended' })}
                label="Status"
                disabled={isSubmitting}
              />
            </div>
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
              {isSubmitting ? 'Creating Customer...' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
