// ============================================================================
// ADD USER PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import { hasPermission } from '@/utils/permissions';
import OutletService from '@/services/outletService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

interface UserFormData {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  role: string;
  phone: string;
  outlet_id: string;
  is_active: boolean;
}

const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, availableOutlets } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError } = useForm<UserFormData>({
    initialData: {
      email: '',
      password: '',
      confirm_password: '',
      full_name: '',
      role: '',
      phone: '',
      outlet_id: '',
      is_active: true,
    },
    validationRules: {
      email: [
        commonValidationRules.required('Email is required'),
        commonValidationRules.email('Please enter a valid email address'),
      ],
      password: [
        commonValidationRules.required('Password is required'),
        commonValidationRules.minLength(6, 'Password must be at least 6 characters'),
      ],
      confirm_password: [
        commonValidationRules.required('Please confirm your password'),
      ],
      full_name: [
        commonValidationRules.required('Full name is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
      ],
      role: [
        commonValidationRules.required('Role is required'),
      ],
      phone: [
        commonValidationRules.required('Phone number is required'),
        commonValidationRules.pattern(/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        
        // Validate password confirmation
        if (formData.password !== formData.confirm_password) {
          setError('confirm_password', 'Passwords do not match');
          return;
        }
        
        // TODO: Implement user creation API call
        console.log('Creating user:', formData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to users page
        navigate('/users');
      } catch (error: any) {
        setError('email', error.message || 'Failed to create user');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const roleOptions = [
    { value: '', label: 'Select role' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
  ];

  const statusOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  const outletOptions = availableOutlets.map(outlet => ({
    value: outlet.id,
    label: outlet.name
  }));

  // Add empty option for outlet selection
  const outletOptionsWithEmpty = [
    { value: '', label: 'Select outlet (required for managers)' },
    ...outletOptions
  ];

  if (!user || !hasPermission(user.role, 'users', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New User</h1>
          <p className="text-muted-foreground">
            Add a new user to your system
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/users')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Users
        </Button>
      </div>

      {/* User Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Full Name"
                placeholder="Enter full name"
                value={data.full_name}
                onChange={handleChange('full_name')}
                error={errors.full_name}
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
              <Select
                options={roleOptions}
                value={data.role}
                onChange={handleChange('role')}
                label="Role"
                error={errors.role}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Password Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="password"
                label="Password"
                placeholder="Enter password"
                value={data.password}
                onChange={handleChange('password')}
                error={errors.password}
                required
                disabled={isSubmitting}
              />
              <Input
                type="password"
                label="Confirm Password"
                placeholder="Confirm password"
                value={data.confirm_password}
                onChange={handleChange('confirm_password')}
                error={errors.confirm_password}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Role & Outlet Assignment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Role & Outlet Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                options={outletOptionsWithEmpty}
                value={data.outlet_id}
                onChange={handleChange('outlet_id')}
                label="Outlet Assignment"
                error={data.role === 'manager' && !data.outlet_id ? 'Outlet is required for managers' : undefined}
                required={data.role === 'manager'}
                disabled={isSubmitting}
              />
              <Select
                options={statusOptions}
                value={data.is_active.toString()}
                onChange={(value) => handleChange('is_active')({ target: { value: value === 'true' } } as any)}
                label="Status"
                disabled={isSubmitting}
              />
            </div>
            
            {/* Role Information */}
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium text-foreground mb-2">Role Information:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>Admin:</strong> Full system access across all outlets</li>
                <li><strong>Manager:</strong> Limited access to assigned outlet only</li>
              </ul>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/users')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating User...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserPage;
