import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CategorySidebar = ({ categories, selectedCategory, onCategorySelect, filters, onFilterChange, onApplyFilters, isFiltering = false }) => {
  const [expandedCategories, setExpandedCategories] = useState(['all']);
  const [expandedFilters, setExpandedFilters] = useState({
    condition: true,
    availability: true,
    stockLevel: true
  });
  const [expandedCategoriesSection, setExpandedCategoriesSection] = useState(true);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => 
      prev?.includes(categoryId) 
        ? prev?.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleFilter = (filterType) => {
    setExpandedFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }));
  };

  const toggleAllFilters = () => {
    const allExpanded = Object.values(expandedFilters).every(Boolean);
    setExpandedFilters({
      condition: !allExpanded,
      availability: !allExpanded,
      stockLevel: !allExpanded
    });
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
    <div className="w-64 bg-card border-r border-border h-full flex flex-col shadow-subtle">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-4">Categories & Filters</h3>
        
        {/* Quick Filters */}
        <div className="space-y-3">
          {/* Expand/Collapse All Filters */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Filters</span>
            <button
              onClick={toggleAllFilters}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {Object.values(expandedFilters).every(Boolean) ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
          <div>
            <button
              onClick={() => toggleFilter('condition')}
              className="flex items-center justify-between w-full text-sm font-medium text-foreground mb-2 hover:text-primary transition-colors"
            >
              <span>Condition</span>
              <Icon 
                name={expandedFilters.condition ? "ChevronUp" : "ChevronDown"} 
                size={16} 
                className="transition-transform duration-200" 
              />
            </button>
            {expandedFilters.condition && (
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
            )}
          </div>

          <div>
            <button
              onClick={() => toggleFilter('availability')}
              className="flex items-center justify-between w-full text-sm font-medium text-foreground mb-2 hover:text-primary transition-colors"
            >
              <span>Availability</span>
              <Icon 
                name={expandedFilters.availability ? "ChevronUp" : "ChevronDown"} 
                size={16} 
                className="transition-transform duration-200" 
              />
            </button>
            {expandedFilters.availability && (
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
            )}
          </div>

          <div>
            <button
              onClick={() => toggleFilter('stockLevel')}
              className="flex items-center justify-between w-full text-sm font-medium text-foreground mb-2 hover:text-primary transition-colors"
            >
              <span>Stock Level</span>
              <Icon 
                name={expandedFilters.stockLevel ? "ChevronUp" : "ChevronDown"} 
                size={16} 
                className="transition-transform duration-200" 
              />
            </button>
            {expandedFilters.stockLevel && (
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
            )}
          </div>
          
          {/* Apply Filters Button */}
          <div className="pt-3 border-t border-border">
            <Button
              onClick={onApplyFilters}
              disabled={isFiltering}
              className="w-full"
              size="sm"
            >
              {isFiltering ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Applying...
                </>
              ) : (
                <>
                  <Icon name="Filter" size={16} className="mr-2" />
                  Apply Filters
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {/* Categories Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        <button
          onClick={() => setExpandedCategoriesSection(!expandedCategoriesSection)}
          className="flex items-center justify-between w-full text-sm font-medium text-foreground mb-3 hover:text-primary transition-colors"
        >
          <span>Categories</span>
          <Icon 
            name={expandedCategoriesSection ? "ChevronUp" : "ChevronDown"} 
            size={16} 
            className="transition-transform duration-200" 
          />
        </button>
        {expandedCategoriesSection && (
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
        )}
      </div>
      {/* Clear Filters */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => {
            onFilterChange('clear');
            // Reset all filters to default state
            onFilterChange('condition', 'all');
            onFilterChange('availability', 'all');
            onFilterChange('stockLevel', 'all');
          }}
          className="w-full"
          iconName="RotateCcw"
          iconPosition="left"
          size="sm"
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  );
};

export default CategorySidebar;