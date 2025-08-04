import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CategorySidebar = ({ categories, selectedCategory, onCategorySelect, filters, onFilterChange }) => {
  const [expandedCategories, setExpandedCategories] = useState(['all']);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => 
      prev?.includes(categoryId) 
        ? prev?.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getStockLevelColor = (level) => {
    if (level === 'critical') return 'text-error';
    if (level === 'low') return 'text-warning';
    if (level === 'good') return 'text-success';
    return 'text-muted-foreground';
  };

  const getStockLevelIcon = (level) => {
    if (level === 'critical') return 'AlertTriangle';
    if (level === 'low') return 'AlertCircle';
    if (level === 'good') return 'CheckCircle';
    return 'Circle';
  };

  return (
    <div className="w-80 bg-surface border-r border-border h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-4">Categories & Filters</h3>
        
        {/* Quick Filters */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Condition</label>
            <div className="space-y-1">
              {['all', 'new', 'good', 'damaged', 'maintenance']?.map((condition) => (
                <label key={condition} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="condition"
                    value={condition}
                    checked={filters?.condition === condition}
                    onChange={(e) => onFilterChange('condition', e?.target?.value)}
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground capitalize">{condition}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Availability</label>
            <div className="space-y-1">
              {['all', 'available', 'reserved', 'out-of-stock']?.map((status) => (
                <label key={status} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="availability"
                    value={status}
                    checked={filters?.availability === status}
                    onChange={(e) => onFilterChange('availability', e?.target?.value)}
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground capitalize">{status.replace('-', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Stock Level</label>
            <div className="space-y-1">
              {['all', 'critical', 'low', 'good']?.map((level) => (
                <label key={level} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="stockLevel"
                    value={level}
                    checked={filters?.stockLevel === level}
                    onChange={(e) => onFilterChange('stockLevel', e?.target?.value)}
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-foreground capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Categories Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="font-medium text-foreground mb-3">Categories</h4>
        <div className="space-y-1">
          {categories?.map((category) => (
            <div key={category?.id}>
              <Button
                variant={selectedCategory === category?.id ? "default" : "ghost"}
                onClick={() => {
                  onCategorySelect(category?.id);
                  if (category?.subcategories?.length > 0) {
                    toggleCategory(category?.id);
                  }
                }}
                className="w-full justify-between h-auto py-2 px-3"
              >
                <div className="flex items-center space-x-2">
                  {category?.subcategories?.length > 0 && (
                    <Icon 
                      name={expandedCategories?.includes(category?.id) ? "ChevronDown" : "ChevronRight"} 
                      size={16} 
                    />
                  )}
                  <span className="text-sm font-medium">{category?.name}</span>
                  <span className="text-xs text-muted-foreground">({category?.itemCount})</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Icon 
                    name={getStockLevelIcon(category?.stockLevel)} 
                    size={12} 
                    className={getStockLevelColor(category?.stockLevel)}
                  />
                </div>
              </Button>

              {/* Subcategories */}
              {category?.subcategories?.length > 0 && expandedCategories?.includes(category?.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {category?.subcategories?.map((subcategory) => (
                    <Button
                      key={subcategory?.id}
                      variant={selectedCategory === subcategory?.id ? "default" : "ghost"}
                      onClick={() => onCategorySelect(subcategory?.id)}
                      className="w-full justify-between h-auto py-1.5 px-3"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{subcategory?.name}</span>
                        <span className="text-xs text-muted-foreground">({subcategory?.itemCount})</span>
                      </div>
                      <Icon 
                        name={getStockLevelIcon(subcategory?.stockLevel)} 
                        size={10} 
                        className={getStockLevelColor(subcategory?.stockLevel)}
                      />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Clear Filters */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => onFilterChange('clear')}
          className="w-full"
          iconName="RotateCcw"
          iconPosition="left"
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  );
};

export default CategorySidebar;