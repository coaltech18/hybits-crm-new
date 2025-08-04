import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import OrderFilters from './components/OrderFilters';
import OrderGrid from './components/OrderGrid';
import OrderForm from './components/OrderForm';
import QuickActions from './components/QuickActions';
import OrderStats from './components/OrderStats';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

const RentalOrderManagement = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Mock user data
  const mockUser = {
    name: 'John Smith',
    email: 'john.smith@hybits.com',
    role: 'Operations Manager',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
  };

  // Mock orders data
  const mockOrders = [
    {
      id: 'ORD001',
      orderId: 'RO-2024-001',
      customerId: 'CUST001',
      customerName: 'Rajesh Kumar',
      customerPhone: '+91 9876543210',
      customerEmail: 'rajesh.kumar@email.com',
      location: 'Mumbai',
      startDate: '2024-08-05',
      endDate: '2024-08-07',
      duration: 3,
      orderDate: '2024-08-04',
      status: 'confirmed',
      paymentStatus: 'paid',
      deliveryStatus: 'scheduled',
      deliveryDate: '2024-08-05',
      totalItems: 150,
      itemTypes: ['Dinner Plates', 'Bowls', 'Cutlery'],
      totalAmount: 15000,
      securityDeposit: 3000,
      profitMargin: 25,
      deliveryAddress: '123 MG Road, Andheri West, Mumbai - 400058',
      items: [
        { id: 1, itemId: 'PLT001', name: 'Standard Dinner Plate', quantity: 100, price: 5, total: 1500 },
        { id: 2, itemId: 'BWL001', name: 'Serving Bowl Large', quantity: 30, price: 12, total: 1080 },
        { id: 3, itemId: 'CUT001', name: 'Cutlery Set (5 pieces)', quantity: 20, price: 15, total: 900 }
      ],
      pricing: {
        subtotal: 3480,
        discount: 5,
        gst: 626.4,
        total: 3932.4,
        securityDeposit: 786.48
      },
      delivery: {
        type: 'standard',
        date: '2024-08-05',
        timeSlot: '9-12',
        instructions: 'Call before delivery'
      },
      payment: {
        terms: 'advance',
        method: 'online',
        dueDate: '2024-08-04'
      },
      specialInstructions: 'Handle with care, premium event'
    },
    {
      id: 'ORD002',
      orderId: 'RO-2024-002',
      customerId: 'CUST002',
      customerName: 'Priya Sharma',
      customerPhone: '+91 9876543211',
      customerEmail: 'priya.sharma@email.com',
      location: 'Delhi',
      startDate: '2024-08-06',
      endDate: '2024-08-08',
      duration: 3,
      orderDate: '2024-08-04',
      status: 'in-progress',
      paymentStatus: 'partial',
      deliveryStatus: 'in-transit',
      deliveryDate: '2024-08-06',
      totalItems: 200,
      itemTypes: ['Dinner Plates', 'Cups', 'Serving Dishes'],
      totalAmount: 18500,
      securityDeposit: 3700,
      profitMargin: 22,
      deliveryAddress: '456 CP Market, Connaught Place, New Delhi - 110001',
      items: [],
      pricing: { subtotal: 0, discount: 0, gst: 0, total: 0, securityDeposit: 0 },
      delivery: { type: 'express', date: '2024-08-06', timeSlot: '12-15', instructions: '' },
      payment: { terms: 'partial', method: 'cash', dueDate: '2024-08-06' },
      specialInstructions: ''
    },
    {
      id: 'ORD003',
      orderId: 'RO-2024-003',
      customerId: 'CUST003',
      customerName: 'Amit Patel',
      customerPhone: '+91 9876543212',
      customerEmail: 'amit.patel@email.com',
      location: 'Bangalore',
      startDate: '2024-08-07',
      endDate: '2024-08-10',
      duration: 4,
      orderDate: '2024-08-04',
      status: 'draft',
      paymentStatus: 'pending',
      deliveryStatus: 'scheduled',
      deliveryDate: '2024-08-07',
      totalItems: 120,
      itemTypes: ['Bowls', 'Glasses', 'Cutlery'],
      totalAmount: 12000,
      securityDeposit: 2400,
      profitMargin: 30,
      deliveryAddress: '789 Brigade Road, Bangalore - 560025',
      items: [],
      pricing: { subtotal: 0, discount: 0, gst: 0, total: 0, securityDeposit: 0 },
      delivery: { type: 'standard', date: '2024-08-07', timeSlot: '15-18', instructions: '' },
      payment: { terms: 'delivery', method: 'online', dueDate: '2024-08-07' },
      specialInstructions: ''
    },
    {
      id: 'ORD004',
      orderId: 'RO-2024-004',
      customerId: 'CUST004',
      customerName: 'Sunita Gupta',
      customerPhone: '+91 9876543213',
      customerEmail: 'sunita.gupta@email.com',
      location: 'Pune',
      startDate: '2024-08-08',
      endDate: '2024-08-11',
      duration: 4,
      orderDate: '2024-08-04',
      status: 'delivered',
      paymentStatus: 'paid',
      deliveryStatus: 'delivered',
      deliveryDate: '2024-08-08',
      totalItems: 180,
      itemTypes: ['Dinner Plates', 'Bowls', 'Cups', 'Cutlery'],
      totalAmount: 16800,
      securityDeposit: 3360,
      profitMargin: 28,
      deliveryAddress: '321 FC Road, Pune - 411005',
      items: [],
      pricing: { subtotal: 0, discount: 0, gst: 0, total: 0, securityDeposit: 0 },
      delivery: { type: 'standard', date: '2024-08-08', timeSlot: '9-12', instructions: '' },
      payment: { terms: 'advance', method: 'bank-transfer', dueDate: '2024-08-04' },
      specialInstructions: ''
    },
    {
      id: 'ORD005',
      orderId: 'RO-2024-005',
      customerId: 'CUST005',
      customerName: 'Vikram Singh',
      customerPhone: '+91 9876543214',
      customerEmail: 'vikram.singh@email.com',
      location: 'Hyderabad',
      startDate: '2024-08-09',
      endDate: '2024-08-12',
      duration: 4,
      orderDate: '2024-08-04',
      status: 'cancelled',
      paymentStatus: 'overdue',
      deliveryStatus: 'cancelled',
      deliveryDate: null,
      totalItems: 90,
      itemTypes: ['Cups', 'Glasses'],
      totalAmount: 8500,
      securityDeposit: 1700,
      profitMargin: 15,
      deliveryAddress: '654 Banjara Hills, Hyderabad - 500034',
      items: [],
      pricing: { subtotal: 0, discount: 0, gst: 0, total: 0, securityDeposit: 0 },
      delivery: { type: 'standard', date: '2024-08-09', timeSlot: '18-21', instructions: '' },
      payment: { terms: 'credit', method: 'cheque', dueDate: '2024-09-03' },
      specialInstructions: ''
    }
  ];

  const mockSavedFilters = [
    { name: 'Today\'s Deliveries', filters: { deliveryStatus: 'scheduled', dateRange: { start: '2024-08-04', end: '2024-08-04' } } },
    { name: 'Pending Payments', filters: { paymentStatus: 'pending' } },
    { name: 'Active Rentals', filters: { status: ['confirmed', 'in-progress', 'delivered'] } },
    { name: 'Mumbai Orders', filters: { location: 'mumbai' } }
  ];

  const mockNotifications = [
    { id: 1, title: 'New rental order received', message: 'Order #RO-2024-006 requires approval', time: '2 min ago', read: false, type: 'info' },
    { id: 2, title: 'Delivery completed', message: 'Order #RO-2024-001 successfully delivered', time: '15 min ago', read: false, type: 'success' },
    { id: 3, title: 'Payment overdue', message: 'Order #RO-2024-005 payment is 3 days overdue', time: '1 hour ago', read: true, type: 'warning' }
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e?.ctrlKey) {
        switch (e?.key) {
          case 'n':
            e?.preventDefault();
            handleQuickAction('new-order');
            break;
          case 'i':
            e?.preventDefault();
            handleQuickAction('bulk-invoice');
            break;
          case 'd':
            e?.preventDefault();
            handleQuickAction('delivery-schedule');
            break;
          case 'r':
            e?.preventDefault();
            handleQuickAction('payment-reminder');
            break;
          case 'k':
            e?.preventDefault();
            handleQuickAction('inventory-check');
            break;
          case 'e':
            e?.preventDefault();
            handleQuickAction('export-data');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleLogout = () => {
    console.log('Logging out...');
  };

  const handleRoleSwitch = () => {
    console.log('Switching role...');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    console.log('Searching for:', query);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    console.log('Filters changed:', newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
    console.log('Filters cleared');
  };

  const handleOrderSelect = (orderIds) => {
    setSelectedOrders(orderIds);
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setShowOrderForm(true);
  };

  const handleBulkAction = (action) => {
    console.log('Bulk action:', action, 'for orders:', selectedOrders);
    
    switch (action) {
      case 'update-status': console.log('Updating status for selected orders');
        break;
      case 'generate-invoice': console.log('Generating invoices for selected orders');
        break;
      case 'schedule-delivery': console.log('Scheduling delivery for selected orders');
        break;
      default:
        break;
    }
  };

  const handleQuickAction = (actionId) => {
    console.log('Quick action:', actionId);
    
    switch (actionId) {
      case 'new-order':
        setSelectedOrder(null);
        setShowOrderForm(true);
        break;
      case 'bulk-invoice': console.log('Opening bulk invoice generator');
        break;
      case 'delivery-schedule': console.log('Opening delivery scheduler');
        break;
      case 'payment-reminder': console.log('Sending payment reminders');
        break;
      case 'inventory-check': console.log('Checking inventory availability');
        break;
      case 'export-data':
        console.log('Exporting order data');
        break;
      default:
        break;
    }
  };

  const handleOrderSave = (orderData) => {
    console.log('Saving order:', orderData);
    setShowOrderForm(false);
    setSelectedOrder(null);
  };

  const handleOrderCancel = () => {
    setShowOrderForm(false);
    setSelectedOrder(null);
  };

  const filteredOrders = mockOrders?.filter(order => {
    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery?.toLowerCase();
      const matchesSearch = 
        order?.orderId?.toLowerCase()?.includes(searchLower) ||
        order?.customerName?.toLowerCase()?.includes(searchLower) ||
        order?.customerPhone?.includes(searchQuery) ||
        order?.customerEmail?.toLowerCase()?.includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Apply other filters
    if (filters?.status && filters?.status?.length > 0 && !filters?.status?.includes(order?.status)) {
      return false;
    }

    if (filters?.location && order?.location?.toLowerCase() !== filters?.location?.toLowerCase()) {
      return false;
    }

    if (filters?.paymentStatus && order?.paymentStatus !== filters?.paymentStatus) {
      return false;
    }

    if (filters?.deliveryStatus && order?.deliveryStatus !== filters?.deliveryStatus) {
      return false;
    }

    if (filters?.dateRange?.start && order?.orderDate < filters?.dateRange?.start) {
      return false;
    }

    if (filters?.dateRange?.end && order?.orderDate > filters?.dateRange?.end) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={mockUser}
        notifications={mockNotifications}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onSearch={handleSearch}
      />
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        user={mockUser}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Rental Order Management</h1>
                <p className="text-muted-foreground mt-1">
                  Manage rental orders from quotation through return with integrated inventory allocation
                </p>
              </div>
              <Button
                variant="default"
                onClick={() => handleQuickAction('new-order')}
                iconName="Plus"
                iconPosition="left"
                className="hidden md:flex"
              >
                New Order
              </Button>
            </div>
          </div>

          <OrderStats />
          <QuickActions onAction={handleQuickAction} />

          {!showOrderForm ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Left Panel - Order List */}
              <div className="xl:col-span-2">
                <OrderFilters
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  savedFilters={mockSavedFilters}
                />
                
                <div className="bg-surface border border-border rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Orders ({filteredOrders?.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Filter"
                        iconPosition="left"
                      >
                        Filter
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="ArrowUpDown"
                        iconPosition="left"
                      >
                        Sort
                      </Button>
                    </div>
                  </div>
                </div>

                <OrderGrid
                  orders={filteredOrders}
                  selectedOrders={selectedOrders}
                  onOrderSelect={handleOrderSelect}
                  onOrderClick={handleOrderClick}
                  onBulkAction={handleBulkAction}
                />
              </div>

              {/* Right Panel - Order Details */}
              <div className="xl:col-span-3">
                {selectedOrder ? (
                  <OrderForm
                    order={selectedOrder}
                    onSave={handleOrderSave}
                    onCancel={handleOrderCancel}
                    isEditing={true}
                  />
                ) : (
                  <div className="bg-surface border border-border rounded-lg p-8 text-center">
                    <Icon name="FileText" size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Select an Order</h3>
                    <p className="text-muted-foreground mb-6">
                      Click on an order from the list to view and edit its details
                    </p>
                    <Button
                      variant="default"
                      onClick={() => handleQuickAction('new-order')}
                      iconName="Plus"
                      iconPosition="left"
                    >
                      Create New Order
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <OrderForm
              order={selectedOrder}
              onSave={handleOrderSave}
              onCancel={handleOrderCancel}
              isEditing={!!selectedOrder}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default RentalOrderManagement;