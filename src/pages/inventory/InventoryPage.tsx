// ============================================================================
// INVENTORY PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { InventoryItem, ItemCondition } from '@/types';
import AppImage from '@/components/AppImage';
import InventoryService from '@/services/inventoryService';

// Mock data - Based on actual inventory items
const mockInventoryItems: InventoryItem[] = [
  {
    id: '1',
    code: 'MD-PLATE-001',
    name: 'MD PLATES',
    description: 'Medium dinner plates for events',
    category: 'plates',
    subcategory: 'Dinner Plates',
    location_id: 'loc-1',
    condition: 'good',
    total_quantity: 200,
    available_quantity: 180,
    reserved_quantity: 20,
    reorder_point: 30,
    unit_price: 25,
    last_movement: '2024-01-15',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Medium dinner plates for events',
    created_at: '2024-01-01',
    updated_at: '2024-01-15'
  },
  {
    id: '2',
    code: 'CHAT-PLATE-7',
    name: 'CHAT PLATE 7',
    description: 'Chat plate size 7 for appetizers',
    category: 'plates',
    location_id: 'loc-1',
    condition: 'excellent',
    total_quantity: 150,
    available_quantity: 140,
    reserved_quantity: 10,
    reorder_point: 20,
    unit_price: 15,
    last_movement: '2024-01-14',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Chat plate size 7 for appetizers',
    created_at: '2024-01-01',
    updated_at: '2024-01-14'
  },
  {
    id: '3',
    code: 'SOUP-BOWL-001',
    name: 'SOUP BOWLS',
    description: 'Ceramic soup bowls for serving',
    category: 'bowls',
    subcategory: 'Soup Bowls',
    location_id: 'loc-1',
    condition: 'good',
    total_quantity: 100,
    available_quantity: 85,
    reserved_quantity: 15,
    reorder_point: 15,
    unit_price: 35,
    last_movement: '2024-01-13',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Ceramic soup bowls for serving',
    created_at: '2024-01-01',
    updated_at: '2024-01-13'
  },
  {
    id: '4',
    code: 'AP-SPOON-001',
    name: 'AP SPOONS',
    description: 'Appetizer spoons for small servings',
    category: 'cutlery',
    subcategory: 'Spoons',
    location_id: 'loc-1',
    condition: 'good',
    total_quantity: 300,
    available_quantity: 280,
    reserved_quantity: 20,
    reorder_point: 40,
    unit_price: 8,
    last_movement: '2024-01-12',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Appetizer spoons for small servings',
    created_at: '2024-01-01',
    updated_at: '2024-01-12'
  },
  {
    id: '5',
    code: 'PC-JUICE-GLASS',
    name: 'PC JUICE GLASS',
    description: 'Plastic coated juice glasses',
    category: 'glassware',
    location_id: 'loc-1',
    condition: 'excellent',
    total_quantity: 250,
    available_quantity: 230,
    reserved_quantity: 20,
    reorder_point: 30,
    unit_price: 12,
    last_movement: '2024-01-11',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Plastic coated juice glasses',
    created_at: '2024-01-01',
    updated_at: '2024-01-11'
  },
  {
    id: '6',
    code: 'WINE-GLASS-001',
    name: 'WINE GLASS',
    description: 'Elegant wine glasses for events',
    category: 'glassware',
    subcategory: 'Wine Glasses',
    location_id: 'loc-1',
    condition: 'good',
    total_quantity: 80,
    available_quantity: 70,
    reserved_quantity: 10,
    reorder_point: 15,
    unit_price: 45,
    last_movement: '2024-01-10',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    image_alt_text: 'Elegant wine glasses for events',
    created_at: '2024-01-01',
    updated_at: '2024-01-10'
  }
];

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ItemCondition | ''>('');

  // Load inventory items from database
  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading inventory items...');
      const inventoryItems = await InventoryService.getInventoryItems();
      console.log('Loaded items:', inventoryItems);
      setItems(inventoryItems);
    } catch (err: any) {
      console.error('Error loading inventory items:', err);
      setError(err.message || 'Failed to load inventory items');
      // Fallback to mock data if database fails
      console.log('Falling back to mock data');
      setItems(mockInventoryItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const categories = ['All', 'Plates', 'Cups', 'Glasses', 'Cutlery', 'Bowls', 'Serving Dishes'];
  const conditions: { value: ItemCondition | ''; label: string }[] = [
    { value: '', label: 'All Conditions' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'out_of_service', label: 'Out of Service' }
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
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'fair': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'damaged': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'out_of_service': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    const available = item.available_quantity || 0;
    const reorderPoint = item.reorder_point || 0;
    
    if (available === 0) {
      return { status: 'Out of Stock', color: 'text-red-600' };
    } else if (available <= reorderPoint) {
      return { status: 'Low Stock', color: 'text-orange-600' };
    } else {
      return { status: 'In Stock', color: 'text-green-600' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Inventory</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

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
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadItems} disabled={loading}>
            <Icon name="refresh-cw" size={20} className="mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/inventory/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Add Item
          </Button>
        </div>
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
            <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Item Image */}
              <div className="aspect-[4/3] bg-muted">
                <AppImage
                  src={item.thumbnail_url || item.image_url || ''}
                  alt={item.image_alt_text || item.name}
                  className="w-full h-full object-cover"
                  fallbackSrc="/assets/images/no_image.png"
                />
              </div>
              
              <div className="p-6">
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
                    {item.available_quantity || 0} / {item.total_quantity || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unit Price:</span>
                  <span className="text-sm font-medium text-foreground">
                    ₹{(item.unit_price || 0).toLocaleString()}
                  </span>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Value:</span>
                    <span className="font-semibold text-foreground">
                      ₹{((item.total_quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                    </span>
                  </div>
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
