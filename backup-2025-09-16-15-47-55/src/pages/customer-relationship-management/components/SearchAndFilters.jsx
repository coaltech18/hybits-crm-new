import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ImportExport from '../../../components/ui/ImportExport';

const SearchAndFilters = ({ onSearch, onFilterChange, searchQuery, activeFilters, onAddCustomer, customers = [] }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  const mockSuggestions = [
    { type: 'customer', value: 'Rajesh Kumar', icon: 'User' },
    { type: 'customer', value: 'Priya Sharma', icon: 'User' },
    { type: 'email', value: 'rajesh@example.com', icon: 'Mail' },
    { type: 'phone', value: '+91 98765 43210', icon: 'Phone' },
    { type: 'location', value: 'Bangalore', icon: 'MapPin' },
    { type: 'status', value: 'Active Customers', icon: 'CheckCircle' },
    { type: 'order', value: 'Recent Orders', icon: 'ShoppingCart' }
  ];

  const filterOptions = [
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'prospect', label: 'Prospect' }
      ]
    },
    {
      id: 'location',
      label: 'Location',
      options: [
        { value: 'bangalore', label: 'Bangalore' },
        { value: 'mumbai', label: 'Mumbai' },
        { value: 'delhi', label: 'Delhi' },
        { value: 'chennai', label: 'Chennai' }
      ]
    },
    {
      id: 'orderValue',
      label: 'Order Value',
      options: [
        { value: 'high', label: 'High Value (₹50,000+)' },
        { value: 'medium', label: 'Medium Value (₹20,000-₹50,000)' },
        { value: 'low', label: 'Low Value (<₹20,000)' }
      ]
    },
    {
      id: 'lastOrder',
      label: 'Last Order',
      options: [
        { value: 'recent', label: 'Last 30 days' },
        { value: 'moderate', label: 'Last 90 days' },
        { value: 'old', label: 'More than 90 days' }
      ]
    }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef?.current && !searchRef?.current?.contains(event.target) &&
          suggestionsRef?.current && !suggestionsRef?.current?.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (isFilterOpen && !event.target?.closest('.filter-dropdown')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  const handleSearchChange = (e) => {
    const value = e?.target?.value;
    onSearch(value);
    
    if (value?.length > 0) {
      const filtered = mockSuggestions?.filter(suggestion =>
        suggestion?.value?.toLowerCase()?.includes(value?.toLowerCase())
      );
      setSearchSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onSearch(suggestion?.value);
    setShowSuggestions(false);
  };

  const handleFilterToggle = (filterId, optionValue) => {
    onFilterChange(filterId, optionValue);
  };

  const clearAllFilters = () => {
    onFilterChange('clear', null);
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters)?.flat()?.length;
  };

  return (
    <div className="bg-surface border-b border-border p-4">
      <div className="flex items-center space-x-4">
        {/* Search Bar */}
        <div className="flex-1 relative" ref={searchRef}>
          <div className="relative">
            <Icon 
              name="Search" 
              size={18} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              type="search"
              placeholder="Search customers by name, email, phone, or order ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery?.length > 0 && setShowSuggestions(true)}
              className="pl-10 pr-4 py-2 w-full"
            />
          </div>

          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions?.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-pronounced z-50 max-h-64 overflow-y-auto"
            >
              {searchSuggestions?.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <Icon name={suggestion?.icon} size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-popover-foreground truncate">
                      {suggestion?.value}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {suggestion?.type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Button */}
        <div className="relative filter-dropdown">
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            iconName="Filter"
            iconPosition="left"
            className="relative"
          >
            Filters
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {getActiveFilterCount()}
              </span>
            )}
          </Button>

          {/* Filter Dropdown */}
          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-pronounced z-50">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-popover-foreground">Filters</h3>
                  {getActiveFilterCount() > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-error hover:text-error"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {filterOptions?.map((filter) => (
                  <div key={filter?.id}>
                    <h4 className="text-sm font-medium text-popover-foreground mb-2">
                      {filter?.label}
                    </h4>
                    <div className="space-y-1">
                      {filter?.options?.map((option) => (
                        <label
                          key={option?.value}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={activeFilters?.[filter?.id]?.includes(option?.value) || false}
                            onChange={() => handleFilterToggle(filter?.id, option?.value)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-popover-foreground">
                            {option?.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Button */}
        <ImportExport
          data={customers}
          dataType="customers"
          onExport={(result) => {
            console.log('Customer export completed:', result);
          }}
          onImport={(result) => {
            console.log('Customer import completed:', result);
          }}
          requiredFields={['name', 'email']}
          showImport={false}
        />

        {/* Add Customer Button */}
        <Button
          variant="default"
          iconName="Plus"
          iconPosition="left"
          onClick={onAddCustomer}
        >
          Add Customer
        </Button>
      </div>
      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <div className="flex items-center space-x-2 mt-4">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeFilters)?.map(([filterId, values]) =>
              values?.map((value) => {
                const filter = filterOptions?.find(f => f?.id === filterId);
                const option = filter?.options?.find(o => o?.value === value);
                return (
                  <span
                    key={`${filterId}-${value}`}
                    className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                  >
                    <span>{option?.label || value}</span>
                    <button
                      onClick={() => handleFilterToggle(filterId, value)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAndFilters;