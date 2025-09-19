// ============================================================================
// CUSTOMERS PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Customer, CustomerStatus } from '@/types';
import { CustomerService } from '@/services/customerService';

// Mock data
const mockCustomers: Customer[] = [
  {
    id: '1',
    code: 'CUST-001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+91 98765 43210',
    company: 'ABC Events',
    address: {
      street: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India'
    },
    gstin: '27ABCDE1234F1Z5',
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-15'
  },
  {
    id: '2',
    code: 'CUST-002',
    name: 'Jane Smith',
    email: 'jane.smith@email.com',
    phone: '+91 87654 32109',
    company: 'XYZ Celebrations',
    address: {
      street: '456 Park Avenue',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India'
    },
    gstin: '07FGHIJ5678K2L6',
    status: 'active',
    created_at: '2024-01-02',
    updated_at: '2024-01-14'
  },
  {
    id: '3',
    code: 'CUST-003',
    name: 'Mike Johnson',
    email: 'mike.johnson@email.com',
    phone: '+91 76543 21098',
    address: {
      street: '789 Garden Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India'
    },
    status: 'inactive',
    created_at: '2024-01-03',
    updated_at: '2024-01-13'
  }
];

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<CustomerStatus | ''>('');

  // Load customers from database
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const customersData = await CustomerService.getCustomers();
        setCustomers(customersData);
      } catch (err: any) {
        console.error('Error loading customers:', err);
        setError(err.message || 'Failed to load customers');
        // Fallback to mock data if database fails
        setCustomers(mockCustomers);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' }
  ];

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         customer.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || customer.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: CustomerStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your customer database and relationships
          </p>
        </div>
        <Button onClick={() => navigate('/customers/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value as CustomerStatus | '')}
              placeholder="All Status"
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

      {/* Loading State */}
      {loading && (
        <div className="bg-card border border-border rounded-lg p-12">
          <div className="text-center">
            <Icon name="loader" size={48} className="mx-auto text-muted-foreground mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Loading Customers</h3>
            <p className="text-muted-foreground">Please wait while we fetch your customers...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-card border border-border rounded-lg p-12">
          <div className="text-center">
            <Icon name="alert-triangle" size={48} className="mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Customers</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} className="mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Customers List */}
      {!loading && !error && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {customer.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {customer.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-foreground">{customer.email}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {customer.company || 'Individual'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {customer.address.city}, {customer.address.state}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {customer.address.pincode}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                        {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Icon name="eye" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Icon name="edit" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Icon name="mail" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Icon name="users" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No customers found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search criteria or add new customers.
          </p>
          <Button onClick={() => navigate('/customers/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            Add First Customer
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
