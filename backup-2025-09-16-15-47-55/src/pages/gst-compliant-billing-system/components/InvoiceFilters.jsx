import React, { useState } from 'react';

import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const InvoiceFilters = ({ onFilterChange, onClearFilters, savedPresets = [] }) => {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    gstRate: '',
    paymentStatus: '',
    customerSegment: '',
    invoiceNumber: '',
    amountRange: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const gstRateOptions = [
    { value: '', label: 'All GST Rates' },
    { value: '0', label: '0% GST' },
    { value: '5', label: '5% GST' },
    { value: '12', label: '12% GST' },
    { value: '18', label: '18% GST' },
    { value: '28', label: '28% GST' }
  ];

  const paymentStatusOptions = [
    { value: '', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partially Paid' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const customerSegmentOptions = [
    { value: '', label: 'All Segments' },
    { value: 'premium', label: 'Premium' },
    { value: 'regular', label: 'Regular' },
    { value: 'new', label: 'New Customer' },
    { value: 'corporate', label: 'Corporate' }
  ];

  const amountRangeOptions = [
    { value: '', label: 'All Amounts' },
    { value: '0-1000', label: '₹0 - ₹1,000' },
    { value: '1000-5000', label: '₹1,000 - ₹5,000' },
    { value: '5000-10000', label: '₹5,000 - ₹10,000' },
    { value: '10000-50000', label: '₹10,000 - ₹50,000' },
    { value: '50000+', label: '₹50,000+' }
  ];

  const handleFilterChange = (key, value) => {
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      dateFrom: '',
      dateTo: '',
      gstRate: '',
      paymentStatus: '',
      customerSegment: '',
      invoiceNumber: '',
      amountRange: ''
    };
    setFilters(clearedFilters);
    onClearFilters();
  };

  const handlePresetLoad = (preset) => {
    setFilters(preset?.filters);
    onFilterChange(preset?.filters);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Invoice Filters</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            iconName={showAdvanced ? "ChevronUp" : "ChevronDown"}
            iconPosition="right"
          >
            Advanced
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            iconName="X"
            iconPosition="left"
          >
            Clear All
          </Button>
        </div>
      </div>
      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Input
          label="Invoice Number"
          type="text"
          placeholder="Search by number..."
          value={filters?.invoiceNumber}
          onChange={(e) => handleFilterChange('invoiceNumber', e?.target?.value)}
        />

        <Select
          label="Payment Status"
          options={paymentStatusOptions}
          value={filters?.paymentStatus}
          onChange={(value) => handleFilterChange('paymentStatus', value)}
        />

        <Input
          label="From Date"
          type="date"
          value={filters?.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e?.target?.value)}
        />

        <Input
          label="To Date"
          type="date"
          value={filters?.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e?.target?.value)}
        />
      </div>
      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 pt-4 border-t border-border">
          <Select
            label="GST Rate"
            options={gstRateOptions}
            value={filters?.gstRate}
            onChange={(value) => handleFilterChange('gstRate', value)}
          />

          <Select
            label="Customer Segment"
            options={customerSegmentOptions}
            value={filters?.customerSegment}
            onChange={(value) => handleFilterChange('customerSegment', value)}
          />

          <Select
            label="Amount Range"
            options={amountRangeOptions}
            value={filters?.amountRange}
            onChange={(value) => handleFilterChange('amountRange', value)}
          />
        </div>
      )}
      {/* Saved Presets */}
      {savedPresets?.length > 0 && (
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium text-foreground mb-2">Saved Filter Presets:</p>
          <div className="flex flex-wrap gap-2">
            {savedPresets?.map((preset) => (
              <Button
                key={preset?.id}
                variant="outline"
                size="sm"
                onClick={() => handlePresetLoad(preset)}
                iconName="Filter"
                iconPosition="left"
              >
                {preset?.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      {/* Quick Stats */}
      <div className="pt-4 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-success">₹2,45,680</p>
            <p className="text-sm text-muted-foreground">Total Paid</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">₹45,320</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-error">₹12,450</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">₹38,920</p>
            <p className="text-sm text-muted-foreground">GST Collected</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceFilters;