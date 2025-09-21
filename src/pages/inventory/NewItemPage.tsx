// ============================================================================
// NEW INVENTORY ITEM PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import { hasPermission } from '@/utils/permissions';
import InventoryService from '@/services/inventoryService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ImageUpload from '@/components/ui/ImageUpload';
import Icon from '@/components/AppIcon';

interface ItemFormData {
  name: string;
  description: string;
  category: string;
  location_id: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged' | 'out_of_service';
  total_quantity: number;
  available_quantity: number;
  reorder_point: number;
  unit_price: number;
  image_url?: string;
  thumbnail_url?: string;
  image_alt_text?: string;
}

const NewItemPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, availableOutlets } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError, setData } = useForm<ItemFormData>({
    initialData: {
      name: '',
      description: '',
      category: '',
      location_id: '',
      condition: 'excellent',
      total_quantity: 0,
      available_quantity: 0,
      reorder_point: 0,
      unit_price: 0,
      image_url: '',
      thumbnail_url: '',
      image_alt_text: '',
    },
    validationRules: {
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
        console.log('Creating inventory item:', formData);
        
        // Create item in database
        const newItem = await InventoryService.createInventoryItem(formData);
        console.log('Item created successfully:', newItem);
        
        // Redirect to inventory page
        navigate('/inventory');
      } catch (error: any) {
        console.error('Error creating item:', error);
        setError('name', error.message || 'Failed to create item');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const categoryOptions = [
    { value: '', label: 'Select category' },
    { value: 'plates', label: 'Plates' },
    { value: 'cups', label: 'Cups' },
    { value: 'glasses', label: 'Glasses' },
    { value: 'cutlery', label: 'Cutlery' },
    { value: 'bowls', label: 'Bowls' },
    { value: 'serving_dishes', label: 'Serving Dishes' },
  ];

  const conditionOptions = [
    { value: '', label: 'Select condition' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'out_of_service', label: 'Out of Service' },
  ];

  // Default location options if outlets are not loaded
  const defaultLocationOptions = [
    { value: 'main-warehouse', label: 'Main Warehouse' },
    { value: 'storage-room-1', label: 'Storage Room 1' },
    { value: 'storage-room-2', label: 'Storage Room 2' },
    { value: 'showroom', label: 'Showroom' },
    { value: 'delivery-vehicle', label: 'Delivery Vehicle' }
  ];

  // Debug logging
  console.log('Available outlets:', availableOutlets);
  console.log('Available outlets length:', availableOutlets.length);

  const locationOptions = availableOutlets.length > 0 
    ? availableOutlets.map(outlet => ({
        value: outlet.id,
        label: outlet.name
      }))
    : defaultLocationOptions;

  console.log('Location options:', locationOptions);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                options={categoryOptions}
                value={data.category}
                onChange={(value) => setData({ category: value })}
                label="Category"
                error={errors.category}
                required
                disabled={isSubmitting}
              />
              <Select
                options={locationOptions}
                value={data.location_id}
                onChange={(value) => setData({ location_id: value })}
                label="Location"
                error={errors.location_id}
                required
                disabled={isSubmitting}
              />
              <Select
                options={conditionOptions}
                value={data.condition}
                onChange={(value) => setData({ condition: value as 'excellent' | 'good' | 'fair' | 'damaged' | 'out_of_service' })}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                label="Available Quantity"
                placeholder="Enter available quantity"
                value={data.available_quantity}
                onChange={handleChange('available_quantity')}
                error={errors.available_quantity}
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

          {/* Item Image */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Item Image</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUpload
                value={data.image_url || ''}
                onChange={(url) => {
                  // Update both image_url and thumbnail_url (in real implementation, thumbnail would be generated)
                  setData({
                    image_url: url,
                    thumbnail_url: url
                  });
                }}
                onError={(error) => setError('image_url', error)}
                label="Item Image"
                error={errors.image_url || ''}
                disabled={isSubmitting}
                maxSize={5}
                aspectRatio="4:3"
                showPreview={true}
              />
              <div className="space-y-4">
                <Input
                  type="text"
                  label="Image Alt Text"
                  placeholder="Describe the item for accessibility"
                  value={data.image_alt_text || ''}
                  onChange={handleChange('image_alt_text')}
                  error={errors.image_alt_text}
                  disabled={isSubmitting}
                />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Image Guidelines:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Use high-quality images (JPG, PNG, WebP)</li>
                    <li>• Maximum file size: 5MB</li>
                    <li>• Recommended size: 800x600px or similar 4:3 ratio</li>
                    <li>• Show the item clearly against a clean background</li>
                  </ul>
                </div>
              </div>
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
