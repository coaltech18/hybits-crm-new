// ============================================================================
// NEW CUSTOMER PAGE
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

interface CustomerFormData {
  code: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
  status: string;
}

const NewCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError } = useForm<CustomerFormData>({
    initialData: {
      code: '',
      name: '',
      email: '',
      phone: '',
      company: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      gstin: '',
      status: 'active',
    },
    validationRules: {
      code: [
        commonValidationRules.required('Customer code is required'),
        commonValidationRules.minLength(2, 'Code must be at least 2 characters'),
      ],
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
      street: [
        commonValidationRules.required('Street address is required'),
      ],
      city: [
        commonValidationRules.required('City is required'),
      ],
      state: [
        commonValidationRules.required('State is required'),
      ],
      pincode: [
        commonValidationRules.required('Pincode is required'),
        commonValidationRules.pattern(/^[0-9]{6}$/, 'Pincode must be 6 digits'),
      ],
      country: [
        commonValidationRules.required('Country is required'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        // TODO: Implement customer creation API call
        console.log('Creating customer:', formData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to customers page
        navigate('/customers');
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

  const stateOptions = [
    { value: '', label: 'Select state' },
    { value: 'Maharashtra', label: 'Maharashtra' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Karnataka', label: 'Karnataka' },
    { value: 'Tamil Nadu', label: 'Tamil Nadu' },
    { value: 'Gujarat', label: 'Gujarat' },
    { value: 'West Bengal', label: 'West Bengal' },
    { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
    { value: 'Rajasthan', label: 'Rajasthan' },
    { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
    { value: 'Telangana', label: 'Telangana' },
    { value: 'Kerala', label: 'Kerala' },
    { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
    { value: 'Punjab', label: 'Punjab' },
    { value: 'Haryana', label: 'Haryana' },
    { value: 'Other', label: 'Other' },
  ];

  if (!user || !hasPermission(user.role, 'customers', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Customer</h1>
          <p className="text-muted-foreground">
            Add a new customer to your database
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/customers')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Customers
        </Button>
      </div>

      {/* Customer Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Customer Code"
                placeholder="Enter unique customer code"
                value={data.code}
                onChange={handleChange('code')}
                error={errors.code}
                required
                disabled={isSubmitting}
              />
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
                value={data.company}
                onChange={handleChange('company')}
                disabled={isSubmitting}
              />
              <Select
                options={statusOptions}
                value={data.status}
                onChange={handleChange('status')}
                label="Status"
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
                  value={data.street}
                  onChange={handleChange('street')}
                  error={errors.street}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Input
                type="text"
                label="City"
                placeholder="Enter city"
                value={data.city}
                onChange={handleChange('city')}
                error={errors.city}
                required
                disabled={isSubmitting}
              />
              <Select
                options={stateOptions}
                value={data.state}
                onChange={handleChange('state')}
                label="State"
                error={errors.state}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Pincode"
                placeholder="Enter 6-digit pincode"
                value={data.pincode}
                onChange={handleChange('pincode')}
                error={errors.pincode}
                required
                maxLength={6}
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Country"
                placeholder="Enter country"
                value={data.country}
                onChange={handleChange('country')}
                error={errors.country}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Business Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="GSTIN (Optional)"
                placeholder="Enter GSTIN number"
                value={data.gstin}
                onChange={handleChange('gstin')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/customers')}
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

export default NewCustomerPage;
