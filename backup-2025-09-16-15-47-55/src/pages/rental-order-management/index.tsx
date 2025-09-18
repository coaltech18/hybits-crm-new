import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import OrderFilters from './components/OrderFilters';
import OrderGrid from './components/OrderGrid';
import OrderForm from './components/OrderForm';
import QuickActions from './components/QuickActions';
import OrderStats from './components/OrderStats';
import Button from '../../components/ui/Button.tsx';
// import Icon from '../../components/AppIcon.tsx';

interface Order {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  location: string;
  startDate: string;
  endDate: string;
  duration: number;
  orderDate: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  deliveryDate: string;
  returnDate: string;
  totalAmount: number;
  items: any[];
}

interface User {
  name: string;
  email: string;
  role: string;
  avatar: string;
}

interface Filters {
  [key: string]: any;
}

const RentalOrderManagement: React.FC = () => {
  const navigate = useNavigate();
  // const _location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderForm, setShowOrderForm] = useState<boolean>(false);
  const [_filters, setFilters] = useState<Filters>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mock user data
  const mockUser: User = {
    name: 'John Smith',
    email: 'john.smith@hybits.com',
    role: 'Operations Manager',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
  };

  // Mock orders data
  const mockOrders: Order[] = [
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
      returnDate: '2024-08-07',
      totalAmount: 15000,
      items: []
    }
    // Add more mock orders as needed
  ];

  const handleOrderSelect = (order: Order): void => {
    setSelectedOrder(order);
  };

  const handleOrderToggle = (orderId: string): void => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleFilterChange = (newFilters: Filters): void => {
    setFilters(newFilters);
  };

  const handleSearch = (query: string): void => {
    setSearchQuery(query);
  };

  const handleCreateOrder = (): void => {
    setShowOrderForm(true);
  };

  const handleEditOrder = (order: Order): void => {
    setSelectedOrder(order);
    setShowOrderForm(true);
  };

  const handleOrderFormSubmit = (orderData: any): void => {
    console.log('Order submitted:', orderData);
    setShowOrderForm(false);
    setSelectedOrder(null);
  };

  const handleOrderFormCancel = (): void => {
    setShowOrderForm(false);
    setSelectedOrder(null);
  };

  const handleBulkAction = (action: string): void => {
    console.log('Bulk action:', action, selectedOrders);
  };

  const handleLogout = (): void => {
    navigate('/authentication-role-selection');
  };

  const handleRoleSwitch = (): void => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query: string): void => {
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
              Rental Order Management
            </h1>
            <p className="text-muted-foreground">
              Comprehensive order tracking and management system for rental operations.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-280px)]">
            {/* Left Sidebar - Filters and Stats */}
            <div className="col-span-12 lg:col-span-3">
              <div className="space-y-6">
                <OrderFilters
                  onFilterChange={handleFilterChange}
                  onSearch={handleSearch}
                  searchQuery={searchQuery}
                />
                <OrderStats orders={mockOrders} />
              </div>
            </div>

            {/* Center Panel - Order Grid */}
            <div className="col-span-12 lg:col-span-6">
              <div className="bg-card border border-border rounded-lg p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Orders</h2>
                  <Button onClick={handleCreateOrder} iconName="Plus">
                    New Order
                  </Button>
                </div>
                <OrderGrid
                  orders={mockOrders}
                  selectedOrders={selectedOrders}
                  onOrderSelect={handleOrderSelect}
                  onOrderToggle={handleOrderToggle}
                  onEditOrder={handleEditOrder}
                  onBulkAction={handleBulkAction}
                />
              </div>
            </div>

            {/* Right Panel - Order Details or Quick Actions */}
            <div className="col-span-12 lg:col-span-3">
              {selectedOrder ? (
                <div className="bg-card border border-border rounded-lg p-6 h-full">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Order Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Order ID:</span>
                      <p className="font-medium">{selectedOrder.orderId}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Customer:</span>
                      <p className="font-medium">{selectedOrder.customerName}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <p className="font-medium capitalize">{selectedOrder.status}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Amount:</span>
                      <p className="font-medium">₹{selectedOrder.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg p-6 h-full">
                  <QuickActions onActionClick={handleBulkAction} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Order Form Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <OrderForm
              order={selectedOrder}
              onSubmit={handleOrderFormSubmit}
              onCancel={handleOrderFormCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RentalOrderManagement;
