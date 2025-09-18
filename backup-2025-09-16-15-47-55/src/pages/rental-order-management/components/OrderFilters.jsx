import React, { useState } from 'react';

import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const OrderFilters = ({ onFilterChange, onClearFilters, savedFilters = [] }) => {
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    status: [],
    location: '',
    customer: '',
    paymentStatus: '',
    deliveryStatus: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterPresetName, setFilterPresetName] = useState('');

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'returned', label: 'Returned' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const locationOptions = [
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'bangalore', label: 'Bangalore' },
    { value: 'pune', label: 'Pune' },
    { value: 'hyderabad', label: 'Hyderabad' }
  ];

  const paymentStatusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' }
  ];

  const deliveryStatusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'pickup-scheduled', label: 'Pickup Scheduled' },
    { value: 'returned', label: 'Returned' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateRangeChange = (type, value) => {
    const newDateRange = { ...filters?.dateRange, [type]: value };
    const newFilters = { ...filters, dateRange: newDateRange };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearAll = () => {
    const clearedFilters = {
      dateRange: { start: '', end: '' },
      status: [],
      location: '',
      customer: '',
      paymentStatus: '',
      deliveryStatus: ''
    };
    setFilters(clearedFilters);
    onClearFilters();
  };

  const handleSavePreset = () => {
    if (filterPresetName?.trim()) {
      // Mock save functionality
      console.log('Saving filter preset:', filterPresetName, filters);
      setFilterPresetName('');
    }
  };

  const handleLoadPreset = (preset) => {
    setFilters(preset?.filters);
    onFilterChange(preset?.filters);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Order Filters</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            iconName={showAdvanced ? "ChevronUp" : "ChevronDown"}
            iconPosition="right"
          >
            Advanced Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            iconName="X"
            iconPosition="left"
          >
            Clear All
          </Button>
        </div>
      </div>
      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Start Date</label>
          <Input
            type="date"
            value={filters?.dateRange?.start}
            onChange={(e) => handleDateRangeChange('start', e?.target?.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">End Date</label>
          <Input
            type="date"
            value={filters?.dateRange?.end}
            onChange={(e) => handleDateRangeChange('end', e?.target?.value)}
            className="w-full"
          />
        </div>
        <Select
          label="Order Status"
          options={statusOptions}
          value={filters?.status}
          onChange={(value) => handleFilterChange('status', value)}
          multiple
          searchable
          placeholder="Select status..."
        />
        <Input
          label="Customer Search"
          type="search"
          placeholder="Search by name, email, phone..."
          value={filters?.customer}
          onChange={(e) => handleFilterChange('customer', e?.target?.value)}
        />
      </div>
      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border-t border-border pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select
              label="Location"
              options={locationOptions}
              value={filters?.location}
              onChange={(value) => handleFilterChange('location', value)}
              placeholder="All locations"
              clearable
            />
            <Select
              label="Payment Status"
              options={paymentStatusOptions}
              value={filters?.paymentStatus}
              onChange={(value) => handleFilterChange('paymentStatus', value)}
              placeholder="All payment status"
              clearable
            />
            <Select
              label="Delivery Status"
              options={deliveryStatusOptions}
              value={filters?.deliveryStatus}
              onChange={(value) => handleFilterChange('deliveryStatus', value)}
              placeholder="All delivery status"
              clearable
            />
          </div>

          {/* Filter Presets */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Filter Presets</h4>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Preset name..."
                  value={filterPresetName}
                  onChange={(e) => setFilterPresetName(e?.target?.value)}
                  className="w-40"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSavePreset}
                  disabled={!filterPresetName?.trim()}
                  iconName="Save"
                  iconPosition="left"
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedFilters?.map((preset, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLoadPreset(preset)}
                  className="text-xs"
                >
                  {preset?.name}
                </Button>
              ))}
              {savedFilters?.length === 0 && (
                <p className="text-sm text-muted-foreground">No saved presets</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderFilters;