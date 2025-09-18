// ============================================================================
// ORDERS PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Order, OrderStatus, PaymentStatus, EventType } from '@/types';

// Mock data
const mockOrders: Order[] = [
  {
    id: '1',
    order_number: 'ORD-001',
    customer_id: '1',
    customer_name: 'John Doe',
    event_date: '2024-02-15',
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
    event_date: '2024-02-20',
    event_type: 'corporate',
    event_duration: 4,
    guest_count: 50,
    location_type: 'indoor',
    items: [
      { id: '3', item_id: '3', item_name: 'Party Tent', quantity: 1, rate: 15000, amount: 15000 }
    ],
    status: 'in_progress',
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
    event_date: '2024-02-25',
    event_type: 'birthday',
    event_duration: 6,
    guest_count: 75,
    location_type: 'both',
    items: [
      { id: '4', item_id: '1', item_name: 'Plastic Chair', quantity: 75, rate: 150, amount: 11250 }
    ],
    status: 'draft',
    payment_status: 'pending',
    total_amount: 11250,
    notes: 'Birthday party',
    created_at: '2024-01-13',
    updated_at: '2024-01-13'
  }
];

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders] = useState<Order[]>(mockOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentStatus | ''>('');

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
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
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
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
        <Button onClick={() => navigate('/orders/new')}>
          <Icon name="plus" size={20} className="mr-2" />
          New Order
        </Button>
      </div>

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
            <Button variant="outline">
              <Icon name="download" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
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
                  {new Date(order.event_date).toLocaleDateString()}
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
                <Button variant="outline" size="sm">
                  <Icon name="eye" size={16} className="mr-2" />
                  View
                </Button>
                <Button variant="outline" size="sm">
                  <Icon name="edit" size={16} className="mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Icon name="file-text" size={16} className="mr-2" />
                  Invoice
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <Icon name="shopping-cart" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search criteria or create new orders.
          </p>
          <Button>
            <Icon name="plus" size={20} className="mr-2" />
            Create First Order
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
