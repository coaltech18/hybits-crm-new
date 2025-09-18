import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { LocationState } from '@/types';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Icon from '../../components/AppIcon.tsx';

interface InventoryItem {
  id?: string;
  itemCode?: string;
  itemName?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  reorderPoint?: number;
  maxStock?: number;
  location?: string;
  condition?: string;
  supplier?: string;
  notes?: string;
}

interface FormData {
  itemCode: string;
  itemName: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  reorderPoint: number;
  maxStock: number;
  location: string;
  condition: string;
  supplier: string;
  notes: string;
}

const InventoryItemCreation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get item data from location state if editing
  const editingItem: InventoryItem | null = (location.state as any)?.item || null;
  const isEditing = !!editingItem;

  const [formData, setFormData] = useState<FormData>({
    itemCode: '',
    itemName: '',
    description: '',
    category: '',
    subcategory: '',
    brand: '',
    model: '',
    unit: 'pcs',
    costPrice: 0,
    sellingPrice: 0,
    reorderPoint: 0,
    maxStock: 0,
    location: '',
    condition: 'new',
    supplier: '',
    notes: ''
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form data if editing existing item
  useEffect(() => {
    if (editingItem) {
      setFormData({
        itemCode: editingItem.itemCode || '',
        itemName: editingItem.itemName || '',
        description: editingItem.description || '',
        category: editingItem.category || '',
        subcategory: editingItem.subcategory || '',
        brand: editingItem.brand || '',
        model: editingItem.model || '',
        unit: editingItem.unit || 'pcs',
        costPrice: editingItem.costPrice || 0,
        sellingPrice: editingItem.sellingPrice || 0,
        reorderPoint: editingItem.reorderPoint || 0,
        maxStock: editingItem.maxStock || 0,
        location: editingItem.location || '',
        condition: editingItem.condition || 'new',
        supplier: editingItem.supplier || '',
        notes: editingItem.notes || ''
      });
    }
  }, [editingItem]);

  const unitOptions = [
    { value: 'pcs', label: 'Pieces' },
    { value: 'kg', label: 'Kilograms' },
    { value: 'g', label: 'Grams' },
    { value: 'l', label: 'Liters' },
    { value: 'ml', label: 'Milliliters' },
    { value: 'm', label: 'Meters' },
    { value: 'cm', label: 'Centimeters' },
    { value: 'box', label: 'Box' },
    { value: 'set', label: 'Set' }
  ];

  const conditionOptions = [
    { value: 'new', label: 'New' },
    { value: 'used', label: 'Used' },
    { value: 'refurbished', label: 'Refurbished' },
    { value: 'damaged', label: 'Damaged' }
  ];

  const categoryOptions = [
    { value: 'kitchenware', label: 'Kitchenware' },
    { value: 'tableware', label: 'Tableware' },
    { value: 'glassware', label: 'Glassware' },
    { value: 'cutlery', label: 'Cutlery' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'decorations', label: 'Decorations' },
    { value: 'linens', label: 'Linens' },
    { value: 'equipment', label: 'Equipment' }
  ];

  const locationOptions = [
    { value: 'warehouse-a', label: 'Warehouse A' },
    { value: 'warehouse-b', label: 'Warehouse B' },
    { value: 'warehouse-c', label: 'Warehouse C' },
    { value: 'showroom', label: 'Showroom' },
    { value: 'storage', label: 'Storage' }
  ];

  const handleInputChange = (field: keyof FormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.itemName.trim()) {
      newErrors.itemName = 'Item name is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.costPrice <= 0) {
      newErrors.costPrice = 'Cost price must be greater than 0';
    }

    if (formData.sellingPrice <= 0) {
      newErrors.sellingPrice = 'Selling price must be greater than 0';
    }

    if (formData.reorderPoint < 0) {
      newErrors.reorderPoint = 'Reorder point cannot be negative';
    }

    if (formData.maxStock <= 0) {
      newErrors.maxStock = 'Max stock must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Inventory item data:', formData);
      
      // Navigate back to inventory management with success message
      navigate('/inventory-management-system', {
        state: {
          message: isEditing 
            ? 'Item updated successfully!' 
            : 'Item created successfully!',
          newItem: isEditing ? null : formData
        }
      });
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (): void => {
    navigate('/inventory-management-system');
  };

  const handleLogout = (): void => {
    navigate('/authentication-role-selection');
  };

  const handleRoleSwitch = (): void => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query: string): void => {
    console.log('Global search:', query);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={userProfile}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onSearch={handleSearchAction}
      />
      
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />

      <main className={`pt-16 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      }`}>
        <div className="p-6">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isEditing ? 'Edit Inventory Item' : 'Create New Inventory Item'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing 
                ? 'Update item information and inventory details.' 
                : 'Add a new item to the inventory system with complete details.'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="Package" size={20} className="mr-2" />
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Item Code"
                  value={formData.itemCode}
                  onChange={(e) => handleInputChange('itemCode', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
                <Input
                  label="Item Name *"
                  value={formData.itemName}
                  onChange={(e) => handleInputChange('itemName', e.target.value)}
                  error={errors.itemName}
                  required
                />
                <div className="md:col-span-2">
                  <Input
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of the item"
                    multiline
                    rows={3}
                  />
                </div>
                <Select
                  label="Category *"
                  value={formData.category}
                  onChange={(value) => handleInputChange('category', value)}
                  options={categoryOptions}
                  error={errors.category}
                  required
                />
                <Input
                  label="Subcategory"
                  value={formData.subcategory}
                  onChange={(e) => handleInputChange('subcategory', e.target.value)}
                />
                <Input
                  label="Brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                />
                <Input
                  label="Model"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                />
              </div>
            </div>

            {/* Pricing & Stock Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="DollarSign" size={20} className="mr-2" />
                Pricing & Stock Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Unit"
                  value={formData.unit}
                  onChange={(value) => handleInputChange('unit', value)}
                  options={unitOptions}
                />
                <Input
                  label="Cost Price *"
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => handleInputChange('costPrice', parseFloat(e.target.value) || 0)}
                  error={errors.costPrice}
                  required
                />
                <Input
                  label="Selling Price *"
                  type="number"
                  value={formData.sellingPrice}
                  onChange={(e) => handleInputChange('sellingPrice', parseFloat(e.target.value) || 0)}
                  error={errors.sellingPrice}
                  required
                />
                <Input
                  label="Reorder Point"
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => handleInputChange('reorderPoint', parseInt(e.target.value) || 0)}
                  error={errors.reorderPoint}
                />
                <Input
                  label="Max Stock *"
                  type="number"
                  value={formData.maxStock}
                  onChange={(e) => handleInputChange('maxStock', parseInt(e.target.value) || 0)}
                  error={errors.maxStock}
                  required
                />
              </div>
            </div>

            {/* Location & Condition */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="MapPin" size={20} className="mr-2" />
                Location & Condition
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Location"
                  value={formData.location}
                  onChange={(value) => handleInputChange('location', value)}
                  options={locationOptions}
                />
                <Select
                  label="Condition"
                  value={formData.condition}
                  onChange={(value) => handleInputChange('condition', value)}
                  options={conditionOptions}
                />
                <Input
                  label="Supplier"
                  value={formData.supplier}
                  onChange={(e) => handleInputChange('supplier', e.target.value)}
                  placeholder="Supplier name or company"
                />
                <div className="md:col-span-2">
                  <Input
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about the item"
                    multiline
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEditing ? 'Update Item' : 'Create Item'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default InventoryItemCreation;
