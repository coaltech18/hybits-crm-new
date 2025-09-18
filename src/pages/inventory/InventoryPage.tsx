// ============================================================================
// INVENTORY PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { InventoryItem, ItemCondition } from '@/types';

// Mock data
const mockInventoryItems: InventoryItem[] = [
  {
    id: '1',
    code: 'CHAIR-001',
    name: 'Plastic Chair',
    description: 'White plastic chair for events',
    category: 'Furniture',
    subcategory: 'Chairs',
    location_id: 'loc-1',
    condition: 'good',
    total_quantity: 100,
    available_quantity: 85,
    reserved_quantity: 15,
    reorder_point: 20,
    unit_price: 150,
    last_movement: '2024-01-15',
    created_at: '2024-01-01',
    updated_at: '2024-01-15'
  },
  {
    id: '2',
    code: 'TABLE-001',
    name: 'Round Table',
    description: '6-seater round table',
    category: 'Furniture',
    subcategory: 'Tables',
    location_id: 'loc-1',
    condition: 'new',
    total_quantity: 50,
    available_quantity: 45,
    reserved_quantity: 5,
    reorder_point: 10,
    unit_price: 2500,
    last_movement: '2024-01-14',
    created_at: '2024-01-01',
    updated_at: '2024-01-14'
  },
  {
    id: '3',
    code: 'TENT-001',
    name: 'Party Tent',
    description: '20x30 feet party tent',
    category: 'Tents',
    subcategory: 'Party Tents',
    location_id: 'loc-2',
    condition: 'good',
    total_quantity: 25,
    available_quantity: 20,
    reserved_quantity: 5,
    reorder_point: 5,
    unit_price: 15000,
    last_movement: '2024-01-13',
    created_at: '2024-01-01',
    updated_at: '2024-01-13'
  }
];

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [items] = useState<InventoryItem[]>(mockInventoryItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ItemCondition | ''>('');

  const categories = ['All', 'Furniture', 'Tents', 'Decorations', 'Lighting', 'Audio/Video'];
  const conditions: { value: ItemCondition | ''; label: string }[] = [
    { value: '', label: 'All Conditions' },
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' }
  ];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || item.category === selectedCategory;
    const matchesCondition = !selectedCondition || item.condition === selectedCondition;
    
    return matchesSearch && matchesCategory && matchesCondition;
  });

  const getConditionColor = (condition: ItemCondition) => {
    switch (condition) {
      case 'new': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'fair': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'poor': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.available_quantity === 0) {
      return { status: 'Out of Stock', color: 'text-red-600' };
    } else if (item.available_quantity <= item.reorder_point) {
      return { status: 'Low Stock', color: 'text-orange-600' };
    } else {
      return { status: 'In Stock', color: 'text-green-600' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your rental inventory items and track stock levels
          </p>
        </div>
        <Button onClick={() => navigate('/inventory/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              options={categories.map(cat => ({ value: cat, label: cat }))}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="All Categories"
            />
          </div>
          <div>
            <Select
              options={conditions}
              value={selectedCondition}
              onChange={(value) => setSelectedCondition(value as ItemCondition | '')}
              placeholder="All Conditions"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <Icon name="filter" size={16} className="mr-2" />
              Filters
            </Button>
            <Button variant="outline">
              <Icon name="download" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const stockStatus = getStockStatus(item);
          
          return (
            <div key={item.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.code}</p>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm">
                    <Icon name="edit" size={16} />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Icon name="eye" size={16} />
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">{item.description}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <span className="text-sm font-medium text-foreground">{item.category}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Condition:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConditionColor(item.condition)}`}>
                    {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stock Status:</span>
                  <span className={`text-sm font-medium ${stockStatus.color}`}>
                    {stockStatus.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available:</span>
                  <span className="text-sm font-medium text-foreground">
                    {item.available_quantity} / {item.total_quantity}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unit Price:</span>
                  <span className="text-sm font-medium text-foreground">
                    ₹{item.unit_price.toLocaleString()}
                  </span>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Value:</span>
                    <span className="font-semibold text-foreground">
                      ₹{(item.total_quantity * item.unit_price).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Icon name="package" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search criteria or add new inventory items.
          </p>
          <Button onClick={() => navigate('/inventory/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Add First Item
          </Button>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
