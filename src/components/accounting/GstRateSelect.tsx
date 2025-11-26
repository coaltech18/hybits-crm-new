// ===================================================================
// HYBITS CRM — GST Rate Selection Component
// Dropdown for selecting standard and custom GST rates
// ===================================================================

import React, { useState, useEffect } from 'react';
import { ALLOWED_GST_RATES, getGstRateDisplayName } from '@/lib/invoiceTax';

interface GstRateSelectProps {
  value: number;
  onChange: (rate: number) => void;
  disabled?: boolean;
  className?: string;
  showTooltip?: boolean;
}

const GstRateSelect: React.FC<GstRateSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  showTooltip = true
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    const isStandardRate = ALLOWED_GST_RATES.includes(value);
    setIsCustom(!isStandardRate && value > 0);
    if (!isStandardRate && value > 0) {
      setCustomValue(value.toString());
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === 'custom') {
      setIsCustom(true);
      setCustomValue('');
    } else {
      setIsCustom(false);
      const rate = parseFloat(selectedValue);
      onChange(rate);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomValue(inputValue);
    
    // Validate and update rate
    const rate = parseFloat(inputValue);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      onChange(rate);
    }
  };

  const handleCustomInputBlur = () => {
    const rate = parseFloat(customValue);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      // Reset to 18% if invalid
      setIsCustom(false);
      onChange(18);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2">
        <select
          value={isCustom ? 'custom' : value.toString()}
          onChange={handleSelectChange}
          disabled={disabled}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {ALLOWED_GST_RATES.map(rate => (
            <option key={rate} value={rate.toString()}>
              {getGstRateDisplayName(rate)}
            </option>
          ))}
          <option value="custom">Custom Rate</option>
        </select>
        
        {isCustom && (
          <input
            type="number"
            value={customValue}
            onChange={handleCustomInputChange}
            onBlur={handleCustomInputBlur}
            placeholder="Enter rate"
            min="0"
            max="100"
            step="0.01"
            disabled={disabled}
            className="block w-24 px-2 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        )}
      </div>
      
      {showTooltip && !disabled && (
        <div className="mt-1 text-xs text-gray-500">
          Standard rates: {ALLOWED_GST_RATES.join('%, ')}%
        </div>
      )}
      
      {disabled && (
        <div className="mt-1 text-xs text-gray-400">
          GST disabled for SEZ/Export transactions
        </div>
      )}
    </div>
  );
};

export default GstRateSelect;
