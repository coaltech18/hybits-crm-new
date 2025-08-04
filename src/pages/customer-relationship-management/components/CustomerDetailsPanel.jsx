import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const CustomerDetailsPanel = ({ customer, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);

  if (!customer) {
    return (
      <div className="w-full h-full bg-surface border-l border-border flex items-center justify-center">
        <div className="text-center">
          <Icon name="Users" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Customer Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a customer from the grid to view details
          </p>
        </div>
      </div>
    );
  }

  const communicationHistory = [
    {
      id: 1,
      type: 'email',
      subject: 'Order confirmation for wedding event',
      date: '2025-01-03T10:30:00',
      status: 'sent',
      content: 'Confirmed order for 200 dinner plates and cutlery sets for January 15th wedding reception.'
    },
    {
      id: 2,
      type: 'call',
      subject: 'Follow-up call regarding payment',
      date: '2025-01-02T14:15:00',
      status: 'completed',
      duration: '12 minutes',
      content: 'Discussed payment terms and confirmed delivery schedule. Customer requested invoice copy.'
    },
    {
      id: 3,
      type: 'meeting',
      subject: 'Site visit for event planning',
      date: '2024-12-28T11:00:00',
      status: 'completed',
      location: 'Customer venue - MG Road',
      content: 'Visited venue to assess requirements. Recommended additional glassware for cocktail service.'
    },
    {
      id: 4,
      type: 'email',
      subject: 'New year discount offer',
      date: '2024-12-25T09:00:00',
      status: 'opened',
      content: 'Sent promotional email with 15% discount on bulk orders. Customer opened but no response yet.'
    }
  ];

  const orderHistory = [
    {
      id: 'ORD-2025-001',
      date: '2025-01-03',
      items: 'Dinner Plates (200), Cutlery Sets (200)',
      amount: 45000,
      status: 'Confirmed',
      deliveryDate: '2025-01-15'
    },
    {
      id: 'ORD-2024-156',
      date: '2024-12-20',
      items: 'Glasses (150), Bowls (100)',
      amount: 28500,
      status: 'Completed',
      deliveryDate: '2024-12-22'
    },
    {
      id: 'ORD-2024-134',
      date: '2024-11-15',
      items: 'Complete Dinner Set (100)',
      amount: 35000,
      status: 'Completed',
      deliveryDate: '2024-11-18'
    }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'User' },
    { id: 'communication', label: 'Communication', icon: 'MessageSquare' },
    { id: 'orders', label: 'Order History', icon: 'ShoppingCart' },
    { id: 'notes', label: 'Notes', icon: 'FileText' }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const formatDate = (date) => {
    return new Date(date)?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date)?.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return 'text-primary bg-primary/10';
      case 'completed': return 'text-success bg-success/10';
      case 'pending': return 'text-warning bg-warning/10';
      case 'cancelled': return 'text-error bg-error/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getCommunicationIcon = (type) => {
    switch (type) {
      case 'email': return 'Mail';
      case 'call': return 'Phone';
      case 'meeting': return 'Calendar';
      case 'sms': return 'MessageSquare';
      default: return 'MessageCircle';
    }
  };

  return (
    <div className="w-full h-full bg-surface border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-primary-foreground">
                {customer?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{customer?.name}</h2>
              <p className="text-sm text-muted-foreground">Customer ID: {customer?.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconName="Edit"
              iconPosition="left"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Save' : 'Edit'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <Icon name="X" size={20} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          {tabs?.map((tab) => (
            <Button
              key={tab?.id}
              variant={activeTab === tab?.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab?.id)}
              className="flex-1"
              iconName={tab?.icon}
              iconPosition="left"
            >
              {tab?.label}
            </Button>
          ))}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Contact Information</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    label="Email"
                    type="email"
                    value={customer?.email}
                    disabled={!isEditing}
                    className={!isEditing ? 'bg-muted' : ''}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    value={customer?.phone}
                    disabled={!isEditing}
                    className={!isEditing ? 'bg-muted' : ''}
                  />
                  <Input
                    label="Address"
                    type="text"
                    value={customer?.address || 'MG Road, Bangalore, Karnataka 560001'}
                    disabled={!isEditing}
                    className={!isEditing ? 'bg-muted' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Customer Metrics */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Customer Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{formatCurrency(customer?.totalValue)}</div>
                  <div className="text-xs text-muted-foreground">Total Value</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{customer?.orderCount || 12}</div>
                  <div className="text-xs text-muted-foreground">Total Orders</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{customer?.healthScore}%</div>
                  <div className="text-xs text-muted-foreground">Health Score</div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{formatDate(customer?.lastOrder)}</div>
                  <div className="text-xs text-muted-foreground">Last Order</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" iconName="Phone" iconPosition="left">
                  Call Customer
                </Button>
                <Button variant="outline" size="sm" iconName="Mail" iconPosition="left">
                  Send Email
                </Button>
                <Button variant="outline" size="sm" iconName="Plus" iconPosition="left">
                  New Order
                </Button>
                <Button variant="outline" size="sm" iconName="Calendar" iconPosition="left">
                  Schedule Meeting
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'communication' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Communication History</h3>
              <Button variant="outline" size="sm" iconName="Plus" iconPosition="left">
                Log Communication
              </Button>
            </div>
            
            <div className="space-y-3">
              {communicationHistory?.map((comm) => (
                <div key={comm?.id} className="bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon name={getCommunicationIcon(comm?.type)} size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">{comm?.subject}</h4>
                        <span className="text-xs text-muted-foreground">{formatDateTime(comm?.date)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{comm?.content}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span className="capitalize">{comm?.type}</span>
                        {comm?.duration && <span>Duration: {comm?.duration}</span>}
                        {comm?.location && <span>Location: {comm?.location}</span>}
                        <span className={`px-2 py-1 rounded-full ${
                          comm?.status === 'completed' ? 'bg-success/10 text-success' :
                          comm?.status === 'sent'? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {comm?.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Order History</h3>
              <Button variant="outline" size="sm" iconName="Plus" iconPosition="left">
                New Order
              </Button>
            </div>
            
            <div className="space-y-3">
              {orderHistory?.map((order) => (
                <div key={order?.id} className="bg-muted/30 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-medium text-foreground">{order?.id}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order?.status)}`}>
                        {order?.status}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-foreground">{formatCurrency(order?.amount)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{order?.items}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Order Date: {formatDate(order?.date)}</span>
                    <span>Delivery: {formatDate(order?.deliveryDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Customer Notes</h3>
              <Button variant="outline" size="sm" iconName="Plus" iconPosition="left">
                Add Note
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Payment Terms</span>
                  <span className="text-xs text-muted-foreground">Added on 02/01/2025</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Customer prefers 30-day payment terms. Always requires advance notice for large orders (200+ items). 
                  Preferred delivery time is morning between 9-11 AM.
                </p>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Special Requirements</span>
                  <span className="text-xs text-muted-foreground">Added on 28/12/2024</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Venue has limited storage space. Requires items to be delivered in batches. 
                  Contact venue manager Mr. Raj (+91 98765 43210) for coordination.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailsPanel;