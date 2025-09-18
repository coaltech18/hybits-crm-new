import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import CustomerSegmentSidebar from './components/CustomerSegmentSidebar';
import CustomerGrid from './components/CustomerGrid';
import CustomerDetailsPanel from './components/CustomerDetailsPanel';
import SearchAndFilters from './components/SearchAndFilters';

const CustomerRelationshipManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  // Mock user data
  const mockUser = {
    name: 'John Smith',
    email: 'john.smith@hybits.com',
    role: 'Operations Manager',
    avatar: null
  };

  // Mock customer data
  const mockCustomers = [
    {
      id: 'CUST-001',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '+91 98765 43210',
      address: 'MG Road, Bangalore, Karnataka 560001',
      status: 'Active',
      lastOrder: '2025-01-03',
      totalValue: 125000,
      healthScore: 85,
      orderCount: 12,
      leadSource: 'website',
      segment: 'premium'
    },
    {
      id: 'CUST-002',
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 87654 32109',
      address: 'Koramangala, Bangalore, Karnataka 560034',
      status: 'Active',
      lastOrder: '2025-01-02',
      totalValue: 89000,
      healthScore: 92,
      orderCount: 8,
      leadSource: 'referral',
      segment: 'regular'
    },
    {
      id: 'CUST-003',
      name: 'Amit Patel',
      email: 'amit.patel@example.com',
      phone: '+91 76543 21098',
      address: 'Whitefield, Bangalore, Karnataka 560066',
      status: 'Prospect',
      lastOrder: null,
      totalValue: 0,
      healthScore: 45,
      orderCount: 0,
      leadSource: 'social',
      segment: 'prospects'
    },
    {
      id: 'CUST-004',
      name: 'Sneha Reddy',
      email: 'sneha.reddy@example.com',
      phone: '+91 65432 10987',
      address: 'Indiranagar, Bangalore, Karnataka 560038',
      status: 'Active',
      lastOrder: '2024-12-28',
      totalValue: 156000,
      healthScore: 78,
      orderCount: 15,
      leadSource: 'events',
      segment: 'premium'
    },
    {
      id: 'CUST-005',
      name: 'Vikram Singh',
      email: 'vikram.singh@example.com',
      phone: '+91 54321 09876',
      address: 'HSR Layout, Bangalore, Karnataka 560102',
      status: 'Inactive',
      lastOrder: '2024-10-15',
      totalValue: 45000,
      healthScore: 32,
      orderCount: 6,
      leadSource: 'advertising',
      segment: 'inactive'
    },
    {
      id: 'CUST-006',
      name: 'Meera Nair',
      email: 'meera.nair@example.com',
      phone: '+91 43210 98765',
      address: 'Jayanagar, Bangalore, Karnataka 560011',
      status: 'Active',
      lastOrder: '2025-01-01',
      totalValue: 67000,
      healthScore: 88,
      orderCount: 9,
      leadSource: 'referral',
      segment: 'regular'
    },
    {
      id: 'CUST-007',
      name: 'Arjun Gupta',
      email: 'arjun.gupta@example.com',
      phone: '+91 32109 87654',
      address: 'Electronic City, Bangalore, Karnataka 560100',
      status: 'Active',
      lastOrder: '2024-12-30',
      totalValue: 234000,
      healthScore: 95,
      orderCount: 18,
      leadSource: 'website',
      segment: 'premium'
    },
    {
      id: 'CUST-008',
      name: 'Kavya Iyer',
      email: 'kavya.iyer@example.com',
      phone: '+91 21098 76543',
      address: 'Malleshwaram, Bangalore, Karnataka 560003',
      status: 'Prospect',
      lastOrder: null,
      totalValue: 0,
      healthScore: 52,
      orderCount: 0,
      leadSource: 'cold-call',
      segment: 'prospects'
    },
    {
      id: 'CUST-009',
      name: 'Rohit Joshi',
      email: 'rohit.joshi@example.com',
      phone: '+91 10987 65432',
      address: 'Banashankari, Bangalore, Karnataka 560070',
      status: 'Active',
      lastOrder: '2024-12-25',
      totalValue: 78000,
      healthScore: 71,
      orderCount: 11,
      leadSource: 'social',
      segment: 'regular'
    },
    {
      id: 'CUST-010',
      name: 'Anita Desai',
      email: 'anita.desai@example.com',
      phone: '+91 09876 54321',
      address: 'RT Nagar, Bangalore, Karnataka 560032',
      status: 'Active',
      lastOrder: '2024-12-20',
      totalValue: 112000,
      healthScore: 83,
      orderCount: 14,
      leadSource: 'events',
      segment: 'premium'
    }
  ];

  // Filter customers based on segment, search, and filters
  useEffect(() => {
    let filtered = [...mockCustomers];

    // Apply segment filter
    if (selectedSegment !== 'all') {
      filtered = filtered?.filter(customer => customer?.segment === selectedSegment);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery?.toLowerCase();
      filtered = filtered?.filter(customer =>
        customer?.name?.toLowerCase()?.includes(query) ||
        customer?.email?.toLowerCase()?.includes(query) ||
        customer?.phone?.includes(query) ||
        customer?.id?.toLowerCase()?.includes(query)
      );
    }

    // Apply active filters
    Object.entries(activeFilters)?.forEach(([filterId, values]) => {
      if (values?.length > 0) {
        filtered = filtered?.filter(customer => {
          switch (filterId) {
            case 'status':
              return values?.includes(customer?.status?.toLowerCase());
            case 'location':
              return values?.some(location => 
                customer?.address?.toLowerCase()?.includes(location)
              );
            case 'orderValue':
              return values?.some(value => {
                if (value === 'high') return customer?.totalValue >= 50000;
                if (value === 'medium') return customer?.totalValue >= 20000 && customer?.totalValue < 50000;
                if (value === 'low') return customer?.totalValue < 20000;
                return false;
              });
            case 'lastOrder':
              return values?.some(value => {
                if (!customer?.lastOrder) return false;
                const orderDate = new Date(customer.lastOrder);
                const now = new Date();
                const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
                
                if (value === 'recent') return daysDiff <= 30;
                if (value === 'moderate') return daysDiff <= 90;
                if (value === 'old') return daysDiff > 90;
                return false;
              });
            default:
              return true;
          }
        });
      }
    });

    setFilteredCustomers(filtered);
  }, [selectedSegment, searchQuery, activeFilters]);

  const handleSegmentSelect = (segmentId) => {
    setSelectedSegment(segmentId);
    setSelectedCustomer(null);
    setSelectedCustomers([]);
  };

  const handleFilterSelect = (type, value) => {
    // Handle different filter types
    console.log('Filter selected:', type, value);
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleCustomerToggle = (customerId) => {
    setSelectedCustomers(prev => {
      if (prev?.includes(customerId)) {
        return prev?.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const handleBulkAction = (action) => {
    switch (action) {
      case 'selectAll':
        setSelectedCustomers(filteredCustomers?.map(c => c?.id));
        break;
      case 'deselectAll':
        setSelectedCustomers([]);
        break;
      case 'email': console.log('Sending email to:', selectedCustomers);
        break;
      case 'export':
        console.log('Exporting customers:', selectedCustomers);
        break;
      case 'bulkEdit': console.log('Bulk editing customers:', selectedCustomers);
        break;
      default:
        break;
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (filterId, optionValue) => {
    if (filterId === 'clear') {
      setActiveFilters({});
      return;
    }

    setActiveFilters(prev => {
      const currentValues = prev?.[filterId] || [];
      const newValues = currentValues?.includes(optionValue)
        ? currentValues?.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      
      return {
        ...prev,
        [filterId]: newValues
      };
    });
  };

  // Navigation functions
  const handleAddCustomer = () => {
    navigate('/customer-creation');
  };

  const handleEditCustomer = (customer) => {
    navigate('/customer-creation', { state: { customer } });
  };

  // Handle success messages and new customers
  useEffect(() => {
    if (location.state?.message) {
      // Show success message (you can implement toast notification here)
      console.log(location.state.message);
      
      // Clear the message from location state
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  const handleLogout = () => {
    navigate('/authentication-role-selection');
  };

  const handleRoleSwitch = () => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query) => {
    console.log('Global search:', query);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={mockUser}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onSearch={handleSearchAction}
      />
      
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />

      <main className={`pt-16 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      }`}>
        <div className="p-6">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Customer Relationship Management
            </h1>
            <p className="text-muted-foreground">
              Centralized customer database and interaction management system optimizing sales processes and relationship tracking.
            </p>
          </div>

          <SearchAndFilters
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onAddCustomer={handleAddCustomer}
          />

          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-280px)]">
            {/* Left Sidebar - Customer Segments */}
            <div className="col-span-12 lg:col-span-3">
              <CustomerSegmentSidebar
                onSegmentSelect={handleSegmentSelect}
                onFilterSelect={handleFilterSelect}
                selectedSegment={selectedSegment}
                selectedFilters={activeFilters}
                onAddCustomer={handleAddCustomer}
              />
            </div>

            {/* Center Panel - Customer Grid */}
            <div className="col-span-12 lg:col-span-6">
              <CustomerGrid
                customers={filteredCustomers}
                onCustomerSelect={handleCustomerSelect}
                selectedCustomer={selectedCustomer}
                selectedCustomers={selectedCustomers}
                onCustomerToggle={handleCustomerToggle}
                onBulkAction={handleBulkAction}
                onEditCustomer={handleEditCustomer}
              />
            </div>

            {/* Right Panel - Customer Details */}
            <div className="col-span-12 lg:col-span-3">
              <CustomerDetailsPanel
                customer={selectedCustomer}
                onClose={() => setSelectedCustomer(null)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerRelationshipManagement;