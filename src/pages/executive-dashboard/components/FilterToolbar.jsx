import React, { useState, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const FilterToolbar = ({ onFilterChange, onExport, onRefresh }) => {
  const [dateRange, setDateRange] = useState('30d');
  const [location, setLocation] = useState('all');
  const [metric, setMetric] = useState('revenue');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
    { value: 'custom', label: 'Custom range' }
  ];

  const locationOptions = [
    { value: 'all', label: 'All Locations' },
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'pune', label: 'Pune' },
    { value: 'nashik', label: 'Nashik' },
    { value: 'thane', label: 'Thane' }
  ];

  const metricOptions = [
    { value: 'revenue', label: 'Revenue Focus' },
    { value: 'orders', label: 'Orders Focus' },
    { value: 'inventory', label: 'Inventory Focus' },
    { value: 'customers', label: 'Customer Focus' }
  ];

  const handleFilterChange = () => {
    const filters = {
      dateRange,
      location,
      metric,
      customDateFrom: dateRange === 'custom' ? customDateFrom : null,
      customDateTo: dateRange === 'custom' ? customDateTo : null
    };
    
    if (onFilterChange) {
      onFilterChange(filters);
    }
  };

  const handleExport = (format) => {
    if (onExport) {
      onExport(format);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  React.useEffect(() => {
    handleFilterChange();
  }, [dateRange, location, metric, customDateFrom, customDateTo]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Left side - Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Icon name="Calendar" size={16} className="text-muted-foreground" />
            <Select
              options={dateRangeOptions}
              value={dateRange}
              onChange={setDateRange}
              className="min-w-[140px]"
            />
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center space-x-2">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e?.target?.value)}
                className="w-auto"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e?.target?.value)}
                className="w-auto"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Icon name="MapPin" size={16} className="text-muted-foreground" />
            <Select
              options={locationOptions}
              value={location}
              onChange={setLocation}
              className="min-w-[120px]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Icon name="BarChart3" size={16} className="text-muted-foreground" />
            <Select
              options={metricOptions}
              value={metric}
              onChange={setMetric}
              className="min-w-[140px]"
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            iconName="RefreshCw"
            iconPosition="left"
          >
            Refresh
          </Button>

          <div className="relative group">
            <Button
              variant="outline"
              size="sm"
              iconName="Download"
              iconPosition="left"
            >
              Export
            </Button>
            
            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-pronounced opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-50">
              <div className="p-2">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-colors flex items-center space-x-2"
                >
                  <Icon name="FileText" size={16} />
                  <span>Export as PDF</span>
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-colors flex items-center space-x-2"
                >
                  <Icon name="FileSpreadsheet" size={16} />
                  <span>Export as Excel</span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-colors flex items-center space-x-2"
                >
                  <Icon name="FileDown" size={16} />
                  <span>Export as CSV</span>
                </button>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            iconName="Settings"
            iconPosition="left"
          >
            Customize
          </Button>
        </div>
      </div>
      {/* Active filters display */}
      <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">Active filters:</span>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
            {dateRangeOptions?.find(opt => opt?.value === dateRange)?.label}
          </span>
          {location !== 'all' && (
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
              {locationOptions?.find(opt => opt?.value === location)?.label}
            </span>
          )}
          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
            {metricOptions?.find(opt => opt?.value === metric)?.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FilterToolbar;