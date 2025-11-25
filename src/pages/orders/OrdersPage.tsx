// ============================================================================
// ORDERS PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Order, OrderStatus, PaymentStatus, EventType } from '@/types';
import { OrderService } from '@/services/orderService';
import OrderDetailsModal from '@/components/ui/OrderDetailsModal';
import EditOrderModal from '@/components/ui/EditOrderModal';
import { exportData, formatDateForExport, formatCurrencyForExport } from '@/utils/exportUtils';

// Mock data
const mockOrders: Order[] = [
  {
    id: '1',
    order_number: 'ORD-001',
    customer_id: '1',
    customer_name: 'John Doe',
    event_date: '15-02-2024',
    event_type: 'wedding',
    event_duration: 8,
    guest_count: 150,
    location_type: 'outdoor',
    items: [
      { id: '1', item_id: '1', item_name: 'Plastic Chair', quantity: 150, rate: 150, amount: 22500 },
      { id: '2', item_id: '2', item_name: 'Round Table', quantity: 25, rate: 2500, amount: 62500 }
    ],
    status: 'confirmed',
    payment_status: 'partial',
    total_amount: 85000,
    notes: 'Outdoor wedding ceremony',
    created_at: '2024-01-15',
    updated_at: '2024-01-15'
  },
  {
    id: '2',
    order_number: 'ORD-002',
    customer_id: '2',
    customer_name: 'Jane Smith',
    event_date: '20-02-2024',
    event_type: 'corporate',
    event_duration: 4,
    guest_count: 50,
    location_type: 'indoor',
    items: [
      { id: '3', item_id: '3', item_name: 'Party Tent', quantity: 1, rate: 15000, amount: 15000 }
    ],
    status: 'items_dispatched',
    payment_status: 'paid',
    total_amount: 15000,
    notes: 'Corporate event',
    created_at: '2024-01-14',
    updated_at: '2024-01-14'
  },
  {
    id: '3',
    order_number: 'ORD-003',
    customer_id: '3',
    customer_name: 'Mike Johnson',
    event_date: '25-02-2024',
    event_type: 'birthday',
    event_duration: 6,
    guest_count: 75,
    location_type: 'both',
    items: [
      { id: '4', item_id: '1', item_name: 'Plastic Chair', quantity: 75, rate: 150, amount: 11250 }
    ],
    status: 'pending',
    payment_status: 'pending',
    total_amount: 11250,
    notes: 'Birthday party',
    created_at: '2024-01-13',
    updated_at: '2024-01-13'
  }
];

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentStatus | ''>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);

  // Load orders from database
  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading orders from database...');
      const ordersData = await OrderService.getOrders();
      console.log('Loaded orders:', ordersData);
      setOrders(ordersData);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
      console.log('Falling back to mock data');
      setOrders(mockOrders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowEditOrder(true);
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    // Update the order in the local state
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      )
    );
    setShowEditOrder(false);
    setSelectedOrder(null);
  };

  const handleCloseModals = () => {
    setShowOrderDetails(false);
    setShowEditOrder(false);
    setSelectedOrder(null);
  };

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'items_dispatched', label: 'Items Dispatched' },
    { value: 'items_returned', label: 'Items Returned' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const paymentStatusOptions = [
    { value: '', label: 'All Payment Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' }
  ];

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || order.status === selectedStatus;
    const matchesPaymentStatus = !selectedPaymentStatus || order.payment_status === selectedPaymentStatus;
    
    return matchesSearch && matchesStatus && matchesPaymentStatus;
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'items_dispatched': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'items_returned': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const handleExport = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export');
      return;
    }

    const headers = [
      'Order Number',
      'Customer Name',
      'Event Date',
      'Event Type',
      'Event Duration (hours)',
      'Guest Count',
      'Location Type',
      'Total Amount',
      'Status',
      'Payment Status',
      'Items Count',
      'Notes',
      'Created At',
      'Updated At'
    ];

    const rows = filteredOrders.map(order => [
      order.order_number,
      order.customer_name,
      order.event_date,
      order.event_type,
      order.event_duration || 0,
      order.guest_count || 0,
      order.location_type || '',
      formatCurrencyForExport(order.total_amount),
      order.status,
      order.payment_status,
      order.items?.length || 0,
      order.notes || '',
      formatDateForExport(order.created_at),
      formatDateForExport(order.updated_at)
    ]);

    exportData([headers, ...rows], 'excel', {
      filename: `orders_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Orders'
    });
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusActionButton = (order: Order) => {
    const handleStatusUpdate = async (newStatus: OrderStatus) => {
      try {
        await OrderService.updateOrderStatus(order.id, newStatus);
        // Reload orders to reflect the change
        loadOrders();
      } catch (error: any) {
        console.error('Error updating order status:', error);
        alert('Error updating order status: ' + (error.message || 'Unknown error'));
      }
    };

    const handleCancelOrder = async () => {
      if (confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
        await handleStatusUpdate('cancelled');
      }
    };

    switch (order.status) {
      case 'pending':
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('confirmed')}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Icon name="check-circle" size={16} className="mr-2" />
              Confirm
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCancelOrder}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Icon name="x" size={16} className="mr-2" />
              Cancel
            </Button>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('items_dispatched')}
              className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
            >
              <Icon name="truck" size={16} className="mr-2" />
              Dispatch
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('pending')}
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <Icon name="arrow-left" size={16} className="mr-2" />
              Back to Pending
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCancelOrder}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Icon name="x" size={16} className="mr-2" />
              Cancel
            </Button>
          </div>
        );
      case 'items_dispatched':
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('items_returned')}
              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              <Icon name="package" size={16} className="mr-2" />
              Return
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('confirmed')}
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <Icon name="arrow-left" size={16} className="mr-2" />
              Back to Confirmed
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCancelOrder}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Icon name="x" size={16} className="mr-2" />
              Cancel
            </Button>
          </div>
        );
      case 'items_returned':
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('completed')}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Icon name="check-circle" size={16} className="mr-2" />
              Complete
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('items_dispatched')}
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <Icon name="arrow-left" size={16} className="mr-2" />
              Back to Dispatched
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCancelOrder}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Icon name="x" size={16} className="mr-2" />
              Cancel
            </Button>
          </div>
        );
      case 'completed':
        return (
          <div className="flex space-x-2">
            <span className="text-sm text-green-600 font-medium">
              <Icon name="check-circle" size={16} className="mr-1" />
              Completed
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('items_returned')}
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              <Icon name="arrow-left" size={16} className="mr-2" />
              Mark Incomplete
            </Button>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex space-x-2">
            <span className="text-sm text-red-600 font-medium">
              <Icon name="x-circle" size={16} className="mr-1" />
              Cancelled
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleStatusUpdate('pending')}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Icon name="refresh-cw" size={16} className="mr-2" />
              Reactivate
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const getEventTypeIcon = (type: EventType) => {
    switch (type) {
      case 'wedding': return 'heart';
      case 'corporate': return 'building';
      case 'birthday': return 'gift';
      case 'anniversary': return 'star';
      default: return 'calendar';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Order Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage rental orders and track their progress
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadOrders} disabled={loading}>
            <Icon name="refresh-cw" size={20} className="mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/orders/new')}>
            <Icon name="plus" size={20} className="mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-destructive mr-2" />
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Input
              type="search"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value as OrderStatus | '')}
              placeholder="All Status"
            />
          </div>
          <div>
            <Select
              options={paymentStatusOptions}
              value={selectedPaymentStatus}
              onChange={(value) => setSelectedPaymentStatus(value as PaymentStatus | '')}
              placeholder="All Payment Status"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <Icon name="filter" size={16} className="mr-2" />
              Filters
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={filteredOrders.length === 0}>
              <Icon name="download" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icon name="loader-2" size={48} className="animate-spin mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icon name="package" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedStatus || selectedPaymentStatus
                  ? 'No orders match your current filters.'
                  : 'Get started by creating your first order.'
                }
              </p>
              <Button onClick={() => navigate('/orders/new')}>
                <Icon name="plus" size={20} className="mr-2" />
                Create New Order
              </Button>
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => (
          <div key={order.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Icon name={getEventTypeIcon(order.event_type)} size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{order.order_number}</h3>
                  <p className="text-muted-foreground">{order.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status.replace('_', ' ').charAt(0).toUpperCase() + order.status.replace('_', ' ').slice(1)}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                  {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Event Date</p>
                <p className="font-medium text-foreground">
                  {order.event_date}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Event Type</p>
                <p className="font-medium text-foreground capitalize">{order.event_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Guest Count</p>
                <p className="font-medium text-foreground">{order.guest_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-semibold text-foreground">₹{order.total_amount.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <p>Items: {order.items.length} • Duration: {order.event_duration} hours</p>
                {order.notes && <p className="mt-1">Note: {order.notes}</p>}
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewOrder(order)}
                >
                  <Icon name="eye" size={16} className="mr-2" />
                  View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEditOrder(order)}
                >
                  <Icon name="edit" size={16} className="mr-2" />
                  Edit
                </Button>
                {getStatusActionButton(order)}
                <Button variant="outline" size="sm">
                  <Icon name="file-text" size={16} className="mr-2" />
                  Invoice
                </Button>
              </div>
            </div>
          </div>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderDetails}
        onClose={handleCloseModals}
        order={selectedOrder}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditOrder}
        onClose={handleCloseModals}
        order={selectedOrder}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
};

export default OrdersPage;
