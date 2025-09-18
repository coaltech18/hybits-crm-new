// ============================================================================
// ADD OUTLET PAGE
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

interface OutletFormData {
  code: string;
  name: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  manager_id: string;
  is_active: boolean;
}

const AddOutletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError } = useForm<OutletFormData>({
    initialData: {
      code: '',
      name: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      manager_id: '',
      is_active: true,
    },
    validationRules: {
      code: [
        commonValidationRules.required('Outlet code is required'),
        commonValidationRules.minLength(2, 'Code must be at least 2 characters'),
      ],
      name: [
        commonValidationRules.required('Outlet name is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
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
      contact_person: [
        commonValidationRules.required('Contact person is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
      ],
      contact_phone: [
        commonValidationRules.required('Contact phone is required'),
        commonValidationRules.pattern(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'),
      ],
      contact_email: [
        commonValidationRules.required('Contact email is required'),
        commonValidationRules.email('Please enter a valid email address'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        // TODO: Implement outlet creation API call
        console.log('Creating outlet:', formData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to outlets page
        navigate('/outlets');
      } catch (error: any) {
        setError('name', error.message || 'Failed to create outlet');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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

  const statusOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  // Mock manager options - in real app, this would come from API
  const managerOptions = [
    { value: '', label: 'Select manager (optional)' },
    { value: '2', label: 'Priya Sharma' },
    { value: '3', label: 'Amit Patel' },
    { value: '4', label: 'Sneha Reddy' },
  ];

  if (!user || !hasPermission(user.role, 'outlets', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create outlets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Outlet</h1>
          <p className="text-muted-foreground">
            Add a new Hybits outlet to your system
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/outlets')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Outlets
        </Button>
      </div>

      {/* Outlet Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Outlet Code"
                placeholder="Enter unique outlet code (e.g., HYB004)"
                value={data.code}
                onChange={handleChange('code')}
                error={errors.code}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Outlet Name"
                placeholder="Enter outlet name"
                value={data.name}
                onChange={handleChange('name')}
                error={errors.name}
                required
                disabled={isSubmitting}
              />
              <Select
                options={statusOptions}
                value={data.is_active.toString()}
                onChange={(value) => handleChange('is_active')({ target: { value: value === 'true' } } as any)}
                label="Status"
                disabled={isSubmitting}
              />
              <Select
                options={managerOptions}
                value={data.manager_id}
                onChange={handleChange('manager_id')}
                label="Manager"
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

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Contact Person"
                placeholder="Enter contact person name"
                value={data.contact_person}
                onChange={handleChange('contact_person')}
                error={errors.contact_person}
                required
                disabled={isSubmitting}
              />
              <Input
                type="tel"
                label="Contact Phone"
                placeholder="Enter contact phone number"
                value={data.contact_phone}
                onChange={handleChange('contact_phone')}
                error={errors.contact_phone}
                required
                disabled={isSubmitting}
              />
              <div className="md:col-span-2">
                <Input
                  type="email"
                  label="Contact Email"
                  placeholder="Enter contact email address"
                  value={data.contact_email}
                  onChange={handleChange('contact_email')}
                  error={errors.contact_email}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/outlets')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Outlet...' : 'Create Outlet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOutletPage;
