// ============================================================================
// NEW INVENTORY ITEM PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
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

interface ItemFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  location_id: string;
  condition: string;
  total_quantity: number;
  reorder_point: number;
  unit_price: number;
}

const NewItemPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, availableOutlets } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError } = useForm<ItemFormData>({
    initialData: {
      code: '',
      name: '',
      description: '',
      category: '',
      subcategory: '',
      location_id: '',
      condition: '',
      total_quantity: 0,
      reorder_point: 0,
      unit_price: 0,
    },
    validationRules: {
      code: [
        commonValidationRules.required('Item code is required'),
        commonValidationRules.minLength(2, 'Code must be at least 2 characters'),
      ],
      name: [
        commonValidationRules.required('Item name is required'),
        commonValidationRules.minLength(2, 'Name must be at least 2 characters'),
      ],
      category: [
        commonValidationRules.required('Category is required'),
      ],
      location_id: [
        commonValidationRules.required('Location is required'),
      ],
      condition: [
        commonValidationRules.required('Condition is required'),
      ],
      total_quantity: [
        commonValidationRules.required('Quantity is required'),
      ],
      reorder_point: [
        commonValidationRules.required('Reorder point is required'),
      ],
      unit_price: [
        commonValidationRules.required('Unit price is required'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsSubmitting(true);
        // TODO: Implement item creation API call
        console.log('Creating inventory item:', formData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to inventory page
        navigate('/inventory');
      } catch (error: any) {
        setError('name', error.message || 'Failed to create item');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const categoryOptions = [
    { value: '', label: 'Select category' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'decorations', label: 'Decorations' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'audio_visual', label: 'Audio/Visual' },
    { value: 'catering', label: 'Catering Equipment' },
    { value: 'tents', label: 'Tents & Canopies' },
    { value: 'other', label: 'Other' },
  ];

  const conditionOptions = [
    { value: '', label: 'Select condition' },
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  const locationOptions = availableOutlets.map(outlet => ({
    value: outlet.id,
    label: outlet.name
  }));

  if (!user || !hasPermission(user.role, 'inventory', 'create')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to create inventory items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Inventory Item</h1>
          <p className="text-muted-foreground">
            Add a new item to your inventory
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/inventory')}
        >
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Inventory
        </Button>
      </div>

      {/* Item Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Item Code"
                placeholder="Enter unique item code"
                value={data.code}
                onChange={handleChange('code')}
                error={errors.code}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Item Name"
                placeholder="Enter item name"
                value={data.name}
                onChange={handleChange('name')}
                error={errors.name}
                required
                disabled={isSubmitting}
              />
              <div className="md:col-span-2">
                <Input
                  multiline
                  rows={3}
                  label="Description"
                  placeholder="Enter item description"
                  value={data.description}
                  onChange={handleChange('description')}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Category & Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Category & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                options={categoryOptions}
                value={data.category}
                onChange={handleChange('category')}
                label="Category"
                error={errors.category}
                required
                disabled={isSubmitting}
              />
              <Input
                type="text"
                label="Subcategory"
                placeholder="Enter subcategory (optional)"
                value={data.subcategory}
                onChange={handleChange('subcategory')}
                disabled={isSubmitting}
              />
              <Select
                options={locationOptions}
                value={data.location_id}
                onChange={handleChange('location_id')}
                label="Location"
                error={errors.location_id}
                required
                disabled={isSubmitting}
              />
              <Select
                options={conditionOptions}
                value={data.condition}
                onChange={handleChange('condition')}
                label="Condition"
                error={errors.condition}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Inventory Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Inventory Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                type="number"
                label="Total Quantity"
                placeholder="Enter total quantity"
                value={data.total_quantity}
                onChange={handleChange('total_quantity')}
                error={errors.total_quantity}
                required
                min={0}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                label="Reorder Point"
                placeholder="Enter reorder point"
                value={data.reorder_point}
                onChange={handleChange('reorder_point')}
                error={errors.reorder_point}
                required
                min={0}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                label="Unit Price (₹)"
                placeholder="Enter unit price"
                value={data.unit_price}
                onChange={handleChange('unit_price')}
                error={errors.unit_price}
                required
                min={0}
                step={0.01}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/inventory')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Item...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewItemPage;
