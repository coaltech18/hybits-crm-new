import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

const InventoryItemCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get item data from location state if editing
  const editingItem = location.state?.item || null;
  const isEditing = !!editingItem;

  const [formData, setFormData] = useState({
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
    mrp: 0,
    location: '',
    currentStock: 0,
    minStockLevel: 0,
    maxStockLevel: 0,
    reorderPoint: 0,
    condition: 'new',
    status: 'active',
    dimensions: {
      length: 0,
      width: 0,
      height: 0,
      weight: 0
    },
    supplier: '',
    supplierContact: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    warrantyPeriod: 0,
    warrantyUnit: 'months',
    notes: '',
    tags: '',
    barcode: '',
    sku: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Mock data for dropdowns
  const categories = [
    { value: 'crockery', label: 'Crockery & Tableware' },
    { value: 'furniture', label: 'Furniture & Decor' },
    { value: 'lighting', label: 'Lighting & Electrical' },
    { value: 'linens', label: 'Linens & Textiles' },
    { value: 'kitchen', label: 'Kitchen Equipment' },
    { value: 'audio-visual', label: 'Audio Visual Equipment' },
    { value: 'tents', label: 'Tents & Marquees' },
    { value: 'miscellaneous', label: 'Miscellaneous' }
  ];

  const subcategories = {
    crockery: [
      { value: 'plates', label: 'Plates' },
      { value: 'bowls', label: 'Bowls' },
      { value: 'cups', label: 'Cups & Mugs' },
      { value: 'glasses', label: 'Glasses' },
      { value: 'cutlery', label: 'Cutlery' }
    ],
    furniture: [
      { value: 'chairs', label: 'Chairs' },
      { value: 'tables', label: 'Tables' },
      { value: 'decor', label: 'Decorative Items' },
      { value: 'centerpieces', label: 'Centerpieces' }
    ],
    lighting: [
      { value: 'chandeliers', label: 'Chandeliers' },
      { value: 'led-lights', label: 'LED Lights' },
      { value: 'candles', label: 'Candles' },
      { value: 'lamps', label: 'Lamps' }
    ],
    linens: [
      { value: 'tablecloths', label: 'Tablecloths' },
      { value: 'napkins', label: 'Napkins' },
      { value: 'chair-covers', label: 'Chair Covers' },
      { value: 'curtains', label: 'Curtains' }
    ],
    kitchen: [
      { value: 'serving-ware', label: 'Serving Ware' },
      { value: 'cooking-utensils', label: 'Cooking Utensils' },
      { value: 'appliances', label: 'Kitchen Appliances' }
    ],
    'audio-visual': [
      { value: 'speakers', label: 'Speakers' },
      { value: 'microphones', label: 'Microphones' },
      { value: 'projectors', label: 'Projectors' },
      { value: 'screens', label: 'Screens' }
    ],
    tents: [
      { value: 'marquees', label: 'Marquees' },
      { value: 'canopies', label: 'Canopies' },
      { value: 'tent-accessories', label: 'Tent Accessories' }
    ],
    miscellaneous: [
      { value: 'decorations', label: 'Decorations' },
      { value: 'signage', label: 'Signage' },
      { value: 'safety', label: 'Safety Equipment' }
    ]
  };

  const units = [
    { value: 'pcs', label: 'Pieces' },
    { value: 'sets', label: 'Sets' },
    { value: 'kg', label: 'Kilograms' },
    { value: 'meters', label: 'Meters' },
    { value: 'liters', label: 'Liters' },
    { value: 'boxes', label: 'Boxes' },
    { value: 'pairs', label: 'Pairs' }
  ];

  const locations = [
    { value: 'warehouse-main', label: 'Main Warehouse - Mumbai' },
    { value: 'warehouse-delhi', label: 'Delhi Branch' },
    { value: 'warehouse-bangalore', label: 'Bangalore Hub' },
    { value: 'warehouse-pune', label: 'Pune Center' },
    { value: 'showroom-mumbai', label: 'Mumbai Showroom' },
    { value: 'showroom-delhi', label: 'Delhi Showroom' }
  ];

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'damaged', label: 'Damaged' }
  ];

  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Under Maintenance' },
    { value: 'retired', label: 'Retired' }
  ];

  const warrantyUnits = [
    { value: 'days', label: 'Days' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' }
  ];

  const suppliers = [
    { value: 'supplier-1', label: 'Premium Crockery Co.' },
    { value: 'supplier-2', label: 'Elegant Furniture Ltd.' },
    { value: 'supplier-3', label: 'Lighting Solutions Inc.' },
    { value: 'supplier-4', label: 'Textile World' },
    { value: 'supplier-5', label: 'Kitchen Equipment Hub' }
  ];

  useEffect(() => {
    if (isEditing && editingItem) {
      setFormData({
        ...editingItem,
        purchaseDate: editingItem.purchaseDate || new Date().toISOString().split('T')[0]
      });
    } else {
      // Generate new item code
      const newItemCode = `ITEM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      setFormData(prev => ({
        ...prev,
        itemCode: newItemCode
      }));
    }
  }, [isEditing, editingItem]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleDimensionChange = (dimension, value) => {
    setFormData(prev => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [dimension]: parseFloat(value) || 0
      }
    }));
  };

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.value === supplierId);
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplier: supplier.label
      }));
    }
  };

  const generateBarcode = () => {
    // Generate a random barcode (in real app, this would be more sophisticated)
    const barcode = Math.random().toString().slice(2, 15);
    setFormData(prev => ({
      ...prev,
      barcode: barcode
    }));
  };

  const generateSKU = () => {
    if (formData.category && formData.brand) {
      const categoryCode = formData.category.substring(0, 3).toUpperCase();
      const brandCode = formData.brand.substring(0, 3).toUpperCase();
      const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const sku = `${categoryCode}-${brandCode}-${randomCode}`;
      setFormData(prev => ({
        ...prev,
        sku: sku
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.itemName.trim()) newErrors.itemName = 'Item name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.location) newErrors.location = 'Location is required';
    if (!formData.costPrice || formData.costPrice <= 0) newErrors.costPrice = 'Valid cost price is required';
    if (!formData.sellingPrice || formData.sellingPrice <= 0) newErrors.sellingPrice = 'Valid selling price is required';
    if (formData.currentStock < 0) newErrors.currentStock = 'Stock cannot be negative';
    if (formData.minStockLevel < 0) newErrors.minStockLevel = 'Minimum stock level cannot be negative';
    if (formData.maxStockLevel < 0) newErrors.maxStockLevel = 'Maximum stock level cannot be negative';
    if (formData.reorderPoint < 0) newErrors.reorderPoint = 'Reorder point cannot be negative';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const itemData = {
        ...formData,
        createdBy: userProfile?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In a real app, you'd save to database here
      console.log('Saving inventory item:', itemData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate back to inventory system
      navigate('/inventory-management-system', { 
        state: { 
          message: isEditing ? 'Item updated successfully' : 'Item added successfully',
          newItem: !isEditing ? itemData : null
        }
      });
    } catch (error) {
      console.error('Error saving item:', error);
      setErrors({ general: 'Failed to save item. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/inventory-management-system');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={() => navigate('/')}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditing ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing ? 'Update item details and specifications' : 'Add a new item to the inventory system'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={loading}
                iconName="Save"
                iconPosition="left"
              >
                {isEditing ? 'Update Item' : 'Add Item'}
              </Button>
            </div>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{errors.general}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="xl:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Item Code
                    </label>
                    <Input
                      value={formData.itemCode}
                      onChange={(e) => handleInputChange('itemCode', e.target.value)}
                      placeholder="ITEM-2024-001"
                      disabled={isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Item Name *
                    </label>
                    <Input
                      value={formData.itemName}
                      onChange={(e) => handleInputChange('itemName', e.target.value)}
                      placeholder="Enter item name"
                      error={errors.itemName}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Detailed description of the item"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Category *
                    </label>
                    <Select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      error={errors.category}
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Subcategory
                    </label>
                    <Select
                      value={formData.subcategory}
                      onChange={(e) => handleInputChange('subcategory', e.target.value)}
                      disabled={!formData.category}
                    >
                      <option value="">Select Subcategory</option>
                      {formData.category && subcategories[formData.category]?.map(sub => (
                        <option key={sub.value} value={sub.value}>
                          {sub.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Brand
                    </label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => handleInputChange('brand', e.target.value)}
                      placeholder="Enter brand name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Model
                    </label>
                    <Input
                      value={formData.model}
                      onChange={(e) => handleInputChange('model', e.target.value)}
                      placeholder="Enter model number"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Pricing & Stock</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Cost Price (₹) *
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => handleInputChange('costPrice', parseFloat(e.target.value) || 0)}
                      error={errors.costPrice}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Selling Price (₹) *
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => handleInputChange('sellingPrice', parseFloat(e.target.value) || 0)}
                      error={errors.sellingPrice}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      MRP (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) => handleInputChange('mrp', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Unit
                    </label>
                    <Select
                      value={formData.unit}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                    >
                      {units.map(unit => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Current Stock
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.currentStock}
                      onChange={(e) => handleInputChange('currentStock', parseInt(e.target.value) || 0)}
                      error={errors.currentStock}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Location *
                    </label>
                    <Select
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      error={errors.location}
                    >
                      <option value="">Select Location</option>
                      {locations.map(location => (
                        <option key={location.value} value={location.value}>
                          {location.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Stock Management */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Stock Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Minimum Stock Level
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.minStockLevel}
                      onChange={(e) => handleInputChange('minStockLevel', parseInt(e.target.value) || 0)}
                      error={errors.minStockLevel}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Maximum Stock Level
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.maxStockLevel}
                      onChange={(e) => handleInputChange('maxStockLevel', parseInt(e.target.value) || 0)}
                      error={errors.maxStockLevel}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Reorder Point
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.reorderPoint}
                      onChange={(e) => handleInputChange('reorderPoint', parseInt(e.target.value) || 0)}
                      error={errors.reorderPoint}
                    />
                  </div>
                </div>
              </div>

              {/* Physical Specifications */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Physical Specifications</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Length (cm)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.dimensions.length}
                      onChange={(e) => handleDimensionChange('length', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Width (cm)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.dimensions.width}
                      onChange={(e) => handleDimensionChange('width', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Height (cm)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.dimensions.height}
                      onChange={(e) => handleDimensionChange('height', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Weight (kg)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.dimensions.weight}
                      onChange={(e) => handleDimensionChange('weight', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Supplier & Purchase Info */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Supplier & Purchase Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Supplier
                    </label>
                    <Select
                      value=""
                      onChange={handleSupplierSelect}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.value} value={supplier.value}>
                          {supplier.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Supplier Contact
                    </label>
                    <Input
                      value={formData.supplierContact}
                      onChange={(e) => handleInputChange('supplierContact', e.target.value)}
                      placeholder="Contact information"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Purchase Date
                    </label>
                    <Input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Condition
                    </label>
                    <Select
                      value={formData.condition}
                      onChange={(e) => handleInputChange('condition', e.target.value)}
                    >
                      {conditions.map(condition => (
                        <option key={condition.value} value={condition.value}>
                          {condition.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Warranty Period
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        min="0"
                        value={formData.warrantyPeriod}
                        onChange={(e) => handleInputChange('warrantyPeriod', parseInt(e.target.value) || 0)}
                        className="flex-1"
                      />
                      <Select
                        value={formData.warrantyUnit}
                        onChange={(e) => handleInputChange('warrantyUnit', e.target.value)}
                        className="w-24"
                      >
                        {warrantyUnits.map(unit => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Status
                    </label>
                    <Select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                    >
                      {statuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Identification & Tracking */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Identification & Tracking</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Barcode
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        value={formData.barcode}
                        onChange={(e) => handleInputChange('barcode', e.target.value)}
                        placeholder="Enter or generate barcode"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={generateBarcode}
                        size="sm"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      SKU
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        value={formData.sku}
                        onChange={(e) => handleInputChange('sku', e.target.value)}
                        placeholder="Enter or generate SKU"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={generateSKU}
                        size="sm"
                        disabled={!formData.category || !formData.brand}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tags
                    </label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      placeholder="Enter tags separated by commas"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Additional Information</h2>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes or special instructions"
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Summary Panel */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Item Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item Code:</span>
                    <span className="font-medium">{formData.itemCode || 'Auto-generated'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">
                      {categories.find(c => c.value === formData.category)?.label || 'Not selected'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">
                      {locations.find(l => l.value === formData.location)?.label || 'Not selected'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Stock:</span>
                    <span className="font-medium">{formData.currentStock} {formData.unit}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost Price:</span>
                    <span className="font-medium">₹{formData.costPrice.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selling Price:</span>
                    <span className="font-medium">₹{formData.sellingPrice.toFixed(2)}</span>
                  </div>
                  
                  {formData.costPrice > 0 && formData.sellingPrice > 0 && (
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Profit Margin:</span>
                        <span className={`font-medium ${
                          formData.sellingPrice > formData.costPrice ? 'text-success' : 'text-destructive'
                        }`}>
                          {((formData.sellingPrice - formData.costPrice) / formData.costPrice * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleSave}
                    loading={loading}
                    className="w-full"
                    iconName="Save"
                    iconPosition="left"
                  >
                    {isEditing ? 'Update Item' : 'Add Item'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InventoryItemCreation;
