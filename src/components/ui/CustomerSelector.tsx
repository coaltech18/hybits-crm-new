// ============================================================================
// CUSTOMER SELECTOR COMPONENT
// Hotfix: Added outlet_id filtering for multi-tenant isolation
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '@/types';
import { CustomerService } from '@/services/customerService';
import { useAuth } from '@/contexts/AuthContext';
import Input from './Input';
import Button from './Button';
import Icon from '../AppIcon';

interface CustomerSelectorProps {
  value?: Customer | null;
  onChange: (customer: Customer | null) => void;
  error?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  onAddNewCustomer?: (() => void) | undefined;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  onAddNewCustomer
}) => {
  const { getCurrentOutletId, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current outlet ID from auth context
  const outletId = getCurrentOutletId();

  // Load customers on component mount or when outlet changes
  useEffect(() => {
    loadCustomers();
  }, [outletId]);

  // Filter customers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(recentCustomers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers, recentCustomers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      
      // CRITICAL: Pass outletId for multi-tenant filtering
      // Admin can see all customers if no outlet selected
      const allCustomers = await CustomerService.getCustomers(outletId);
      setCustomers(allCustomers);
      
      // Set recent customers (last 5 active customers)
      const recent = allCustomers
        .filter(c => c.status === 'active')
        .slice(0, 5);
      setRecentCustomers(recent);
      setFilteredCustomers(recent);
    } catch (error: any) {
      console.error('Error loading customers:', error);
      setLoadError(error.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    
    // If input is cleared, clear selection
    if (!term.trim() && value) {
      onChange(null);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    onChange(customer);
    setSearchTerm(customer.name);
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onChange(null);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const displayValue = value ? value.name : searchTerm;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          label="Customer"
          placeholder="Search customers by name, company, phone, or email..."
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          error={error}
          required={required}
          disabled={disabled}
          className="pr-20"
        />
        
        {/* Action buttons */}
        <div className="absolute right-2 top-8 flex items-center space-x-1">
          {value && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              disabled={disabled}
            >
              <Icon name="x" size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            disabled={disabled}
          >
            <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              <Icon name="loader-2" size={20} className="animate-spin mx-auto mb-2" />
              Loading customers...
            </div>
          ) : loadError ? (
            <div className="p-4 text-center">
              <Icon name="alert-triangle" size={20} className="text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadCustomers}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <>
              {/* Recent customers section */}
              {!searchTerm && recentCustomers.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Recent Customers
                  </div>
                  {recentCustomers.map((customer) => (
                    <CustomerOption
                      key={customer.id}
                      customer={customer}
                      onSelect={handleCustomerSelect}
                      isSelected={value?.id === customer.id}
                    />
                  ))}
                </div>
              )}

              {/* Search results section */}
              {searchTerm && (
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Search Results ({filteredCustomers.length})
                  </div>
                  {filteredCustomers.map((customer) => (
                    <CustomerOption
                      key={customer.id}
                      customer={customer}
                      onSelect={handleCustomerSelect}
                      isSelected={value?.id === customer.id}
                    />
                  ))}
                </div>
              )}

              {/* Add new customer option */}
              {onAddNewCustomer && (
                <div className="border-t border-border p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAddNewCustomer}
                    className="w-full justify-center"
                  >
                    <Icon name="plus" size={16} className="mr-2" />
                    Add New Customer
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <Icon name="users" size={20} className="mx-auto mb-2" />
              {searchTerm ? 'No customers found' : 'No customers available'}
              {onAddNewCustomer && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAddNewCustomer}
                  >
                    <Icon name="plus" size={16} className="mr-2" />
                    Add New Customer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Customer option component
interface CustomerOptionProps {
  customer: Customer;
  onSelect: (customer: Customer) => void;
  isSelected: boolean;
}

const CustomerOption: React.FC<CustomerOptionProps> = ({
  customer,
  onSelect,
  isSelected
}) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(customer)}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{customer.name}</div>
          {customer.company && (
            <div className={`text-sm truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {customer.company}
            </div>
          )}
          <div className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {customer.phone} • {customer.email}
          </div>
        </div>
        <div className={`ml-2 text-xs font-mono ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {customer.code}
        </div>
      </div>
    </button>
  );
};

export default CustomerSelector;
