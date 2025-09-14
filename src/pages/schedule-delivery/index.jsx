import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

const ScheduleDelivery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get order data from location state if scheduling for specific order
  const selectedOrder = location.state?.order || null;
  const selectedOrders = location.state?.orders || [];

  const [formData, setFormData] = useState({
    deliveryDate: '',
    deliveryTime: '',
    deliveryWindow: 'morning', // morning, afternoon, evening, specific
    deliveryAddress: '',
    contactPerson: '',
    contactPhone: '',
    specialInstructions: '',
    deliveryType: 'standard', // standard, express, scheduled
    vehicleType: 'van', // van, truck, multiple
    driverId: '',
    assistantId: '',
    estimatedDuration: 2,
    deliveryStatus: 'scheduled',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedOrdersForDelivery, setSelectedOrdersForDelivery] = useState([]);

  // Mock data for dropdowns
  const deliveryWindows = [
    { value: 'morning', label: 'Morning (8:00 AM - 12:00 PM)' },
    { value: 'afternoon', label: 'Afternoon (12:00 PM - 5:00 PM)' },
    { value: 'evening', label: 'Evening (5:00 PM - 8:00 PM)' },
    { value: 'specific', label: 'Specific Time' }
  ];

  const deliveryTypes = [
    { value: 'standard', label: 'Standard Delivery' },
    { value: 'express', label: 'Express Delivery' },
    { value: 'scheduled', label: 'Scheduled Delivery' }
  ];

  const vehicleTypes = [
    { value: 'van', label: 'Van' },
    { value: 'truck', label: 'Truck' },
    { value: 'multiple', label: 'Multiple Vehicles' }
  ];

  const drivers = [
    { id: 1, name: 'Rajesh Kumar', phone: '+91 98765 43210', vehicle: 'Van - MH01AB1234' },
    { id: 2, name: 'Suresh Patel', phone: '+91 87654 32109', vehicle: 'Truck - MH02CD5678' },
    { id: 3, name: 'Amit Singh', phone: '+91 76543 21098', vehicle: 'Van - MH03EF9012' },
    { id: 4, name: 'Vikram Sharma', phone: '+91 65432 10987', vehicle: 'Truck - MH04GH3456' }
  ];

  const assistants = [
    { id: 1, name: 'Ravi Kumar', phone: '+91 54321 09876' },
    { id: 2, name: 'Manoj Singh', phone: '+91 43210 98765' },
    { id: 3, name: 'Deepak Patel', phone: '+91 32109 87654' },
    { id: 4, name: 'Sunil Gupta', phone: '+91 21098 76543' }
  ];

  const deliveryStatuses = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'failed', label: 'Delivery Failed' },
    { value: 'rescheduled', label: 'Rescheduled' }
  ];

  // Mock orders data for selection
  const availableOrders = [
    {
      id: 1,
      orderNumber: 'ORD-2024-001',
      customerName: 'Rajesh Enterprises',
      eventDate: '2024-08-15',
      eventType: 'Wedding',
      totalAmount: 25000,
      items: ['Dinner Plates (50)', 'Chairs (100)', 'Tables (10)'],
      status: 'confirmed',
      deliveryAddress: '123 Wedding Hall, Mumbai'
    },
    {
      id: 2,
      orderNumber: 'ORD-2024-002',
      customerName: 'Mumbai Caterers Ltd',
      eventDate: '2024-08-16',
      eventType: 'Corporate Event',
      totalAmount: 18000,
      items: ['Sound System', 'Projector', 'Chairs (50)'],
      status: 'confirmed',
      deliveryAddress: '456 Business Center, Mumbai'
    },
    {
      id: 3,
      orderNumber: 'ORD-2024-003',
      customerName: 'Golden Events',
      eventDate: '2024-08-17',
      eventType: 'Birthday Party',
      totalAmount: 12000,
      items: ['Party Decorations', 'Tables (5)', 'Chairs (25)'],
      status: 'confirmed',
      deliveryAddress: '789 Party Venue, Mumbai'
    }
  ];

  useEffect(() => {
    // Set default delivery date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData(prev => ({
      ...prev,
      deliveryDate: tomorrow.toISOString().split('T')[0]
    }));

    // If specific order is selected, pre-fill some data
    if (selectedOrder) {
      setSelectedOrdersForDelivery([selectedOrder]);
      setFormData(prev => ({
        ...prev,
        deliveryAddress: selectedOrder.deliveryAddress || '',
        contactPerson: selectedOrder.customerName || '',
        contactPhone: selectedOrder.customerPhone || ''
      }));
    } else if (selectedOrders.length > 0) {
      setSelectedOrdersForDelivery(selectedOrders);
    }
  }, [selectedOrder, selectedOrders]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleOrderSelection = (orderId, isSelected) => {
    if (isSelected) {
      const order = availableOrders.find(o => o.id === orderId);
      if (order && !selectedOrdersForDelivery.find(o => o.id === orderId)) {
        setSelectedOrdersForDelivery(prev => [...prev, order]);
      }
    } else {
      setSelectedOrdersForDelivery(prev => prev.filter(o => o.id !== orderId));
    }
  };

  const handleDriverSelect = (driverId) => {
    const driver = drivers.find(d => d.id === parseInt(driverId));
    if (driver) {
      setFormData(prev => ({
        ...prev,
        driverId: driver.id,
        vehicleType: driver.vehicle.includes('Truck') ? 'truck' : 'van'
      }));
    }
  };

  const handleAssistantSelect = (assistantId) => {
    setFormData(prev => ({
      ...prev,
      assistantId: parseInt(assistantId)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.deliveryDate) newErrors.deliveryDate = 'Delivery date is required';
    if (!formData.deliveryTime && formData.deliveryWindow === 'specific') newErrors.deliveryTime = 'Delivery time is required';
    if (!formData.deliveryAddress.trim()) newErrors.deliveryAddress = 'Delivery address is required';
    if (!formData.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!formData.contactPhone.trim()) newErrors.contactPhone = 'Contact phone is required';
    if (!formData.driverId) newErrors.driverId = 'Driver selection is required';
    if (selectedOrdersForDelivery.length === 0) newErrors.orders = 'At least one order must be selected';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const deliveryData = {
        ...formData,
        orders: selectedOrdersForDelivery,
        scheduledBy: userProfile?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In a real app, you'd save to database here
      console.log('Saving delivery schedule:', deliveryData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate back to order management
      navigate('/rental-order-management', { 
        state: { 
          message: 'Delivery scheduled successfully',
          newDelivery: deliveryData
        }
      });
    } catch (error) {
      console.error('Error scheduling delivery:', error);
      setErrors({ general: 'Failed to schedule delivery. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/rental-order-management');
  };

  const calculateTotalItems = () => {
    return selectedOrdersForDelivery.reduce((total, order) => {
      return total + order.items.length;
    }, 0);
  };

  const calculateTotalValue = () => {
    return selectedOrdersForDelivery.reduce((total, order) => {
      return total + order.totalAmount;
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={() => navigate('/')}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Schedule Delivery</h1>
              <p className="text-muted-foreground mt-1">
                Plan and schedule delivery for rental orders
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={loading}
                iconName="Calendar"
                iconPosition="left"
              >
                Schedule Delivery
              </Button>
            </div>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{errors.general}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="xl:col-span-2 space-y-6">
              {/* Order Selection */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Select Orders for Delivery</h2>
                {errors.orders && (
                  <p className="text-destructive text-sm mb-4">{errors.orders}</p>
                )}
                
                <div className="space-y-3">
                  {availableOrders.map((order) => {
                    const isSelected = selectedOrdersForDelivery.find(o => o.id === order.id);
                    return (
                      <div
                        key={order.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleOrderSelection(order.id, !isSelected)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                            />
                            <div>
                              <h3 className="font-medium text-foreground">{order.orderNumber}</h3>
                              <p className="text-sm text-muted-foreground">{order.customerName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">₹{order.totalAmount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{order.eventDate}</p>
                          </div>
                        </div>
                        <div className="mt-2 ml-7">
                          <p className="text-xs text-muted-foreground">
                            <strong>Event:</strong> {order.eventType} | 
                            <strong> Items:</strong> {order.items.join(', ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <strong>Address:</strong> {order.deliveryAddress}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Schedule */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Delivery Schedule</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.deliveryDate}
                      onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                      error={errors.deliveryDate}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Window
                    </label>
                    <Select
                      value={formData.deliveryWindow}
                      onChange={(e) => handleInputChange('deliveryWindow', e.target.value)}
                    >
                      {deliveryWindows.map(window => (
                        <option key={window.value} value={window.value}>
                          {window.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {formData.deliveryWindow === 'specific' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Specific Time *
                      </label>
                      <Input
                        type="time"
                        value={formData.deliveryTime}
                        onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                        error={errors.deliveryTime}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Type
                    </label>
                    <Select
                      value={formData.deliveryType}
                      onChange={(e) => handleInputChange('deliveryType', e.target.value)}
                    >
                      {deliveryTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Estimated Duration (hours)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={formData.estimatedDuration}
                      onChange={(e) => handleInputChange('estimatedDuration', parseInt(e.target.value) || 2)}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address & Contact */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Delivery Address & Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Address *
                    </label>
                    <textarea
                      value={formData.deliveryAddress}
                      onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                      placeholder="Enter complete delivery address"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                      error={errors.deliveryAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Contact Person *
                    </label>
                    <Input
                      value={formData.contactPerson}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      placeholder="Contact person name"
                      error={errors.contactPerson}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Contact Phone *
                    </label>
                    <Input
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="+91 98765 43210"
                      error={errors.contactPhone}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Team */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Delivery Team</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Driver *
                    </label>
                    <Select
                      value=""
                      onChange={handleDriverSelect}
                      error={errors.driverId}
                    >
                      <option value="">Select Driver</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} - {driver.vehicle}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Assistant
                    </label>
                    <Select
                      value=""
                      onChange={handleAssistantSelect}
                    >
                      <option value="">Select Assistant</option>
                      {assistants.map(assistant => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Vehicle Type
                    </label>
                    <Select
                      value={formData.vehicleType}
                      onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                    >
                      {vehicleTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Status
                    </label>
                    <Select
                      value={formData.deliveryStatus}
                      onChange={(e) => handleInputChange('deliveryStatus', e.target.value)}
                    >
                      {deliveryStatuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Special Instructions */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Special Instructions</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Delivery Instructions
                    </label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                      placeholder="Special delivery instructions, access codes, parking details, etc."
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Any additional notes or requirements"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Summary */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Delivery Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selected Orders:</span>
                    <span className="font-medium">{selectedOrdersForDelivery.length}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-medium">{calculateTotalItems()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Value:</span>
                    <span className="font-medium">₹{calculateTotalValue().toLocaleString()}</span>
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Date:</span>
                      <span className="font-medium">{formData.deliveryDate || 'Not set'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Window:</span>
                      <span className="font-medium">
                        {deliveryWindows.find(w => w.value === formData.deliveryWindow)?.label || 'Not set'}
                      </span>
                    </div>
                    
                    {formData.deliveryTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Specific Time:</span>
                        <span className="font-medium">{formData.deliveryTime}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Driver:</span>
                      <span className="font-medium">
                        {drivers.find(d => d.id === formData.driverId)?.name || 'Not selected'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle:</span>
                      <span className="font-medium">
                        {vehicleTypes.find(v => v.value === formData.vehicleType)?.label || 'Not selected'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{formData.estimatedDuration} hours</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleSave}
                    loading={loading}
                    className="w-full"
                    iconName="Calendar"
                    iconPosition="left"
                  >
                    Schedule Delivery
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ScheduleDelivery;
