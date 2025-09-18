import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { LocationState } from '@/types';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Icon from '../../components/AppIcon.tsx';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: any[];
}

interface FormData {
  deliveryDate: string;
  deliveryTime: string;
  deliveryWindow: string;
  deliveryAddress: string;
  contactPerson: string;
  contactPhone: string;
  specialInstructions: string;
  deliveryType: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  estimatedDuration: number;
  notes: string;
}

const ScheduleDelivery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get order data from location state if scheduling for specific order
  const selectedOrder: Order | null = (location.state as any)?.order || null;
  const selectedOrders: Order[] = (location.state as any)?.orders || [];

  const [formData, setFormData] = useState<FormData>({
    deliveryDate: '',
    deliveryTime: '',
    deliveryWindow: 'morning', // morning, afternoon, evening, specific
    deliveryAddress: '',
    contactPerson: '',
    contactPhone: '',
    specialInstructions: '',
    deliveryType: 'standard', // standard, express, scheduled
    vehicleType: 'van', // van, truck, multiple
    driverName: '',
    driverPhone: '',
    estimatedDuration: 0,
    notes: ''
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Initialize form data if scheduling for specific order
  useEffect(() => {
    if (selectedOrder) {
      setFormData(prev => ({
        ...prev,
        deliveryAddress: selectedOrder.customerName || '',
        contactPerson: selectedOrder.customerName || '',
        contactPhone: selectedOrder.customerPhone || ''
      }));
    }
  }, [selectedOrder]);

  const deliveryWindowOptions = [
    { value: 'morning', label: 'Morning (9 AM - 12 PM)' },
    { value: 'afternoon', label: 'Afternoon (12 PM - 5 PM)' },
    { value: 'evening', label: 'Evening (5 PM - 8 PM)' },
    { value: 'specific', label: 'Specific Time' }
  ];

  const deliveryTypeOptions = [
    { value: 'standard', label: 'Standard Delivery' },
    { value: 'express', label: 'Express Delivery' },
    { value: 'scheduled', label: 'Scheduled Delivery' }
  ];

  const vehicleTypeOptions = [
    { value: 'van', label: 'Van' },
    { value: 'truck', label: 'Truck' },
    { value: 'multiple', label: 'Multiple Vehicles' }
  ];

  const handleInputChange = (field: keyof FormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.deliveryDate) {
      newErrors.deliveryDate = 'Delivery date is required';
    }

    if (formData.deliveryWindow === 'specific' && !formData.deliveryTime) {
      newErrors.deliveryTime = 'Delivery time is required for specific time window';
    }

    if (!formData.deliveryAddress.trim()) {
      newErrors.deliveryAddress = 'Delivery address is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }

    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = 'Contact phone is required';
    }

    if (!formData.driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    }

    if (!formData.driverPhone.trim()) {
      newErrors.driverPhone = 'Driver phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Delivery schedule data:', formData);
      console.log('Selected orders:', selectedOrder ? [selectedOrder] : selectedOrders);
      
      // Navigate back to order management with success message
      navigate('/rental-order-management', {
        state: {
          message: 'Delivery scheduled successfully!'
        }
      });
    } catch (error) {
      console.error('Error scheduling delivery:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (): void => {
    navigate('/rental-order-management');
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
        user={userProfile}
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
              Schedule Delivery
            </h1>
            <p className="text-muted-foreground">
              Schedule delivery for orders with driver assignment and logistics details.
            </p>
          </div>

          {/* Selected Orders Summary */}
          {(selectedOrder || selectedOrders.length > 0) && (
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="Package" size={20} className="mr-2" />
                Selected Orders
              </h2>
              <div className="space-y-2">
                {selectedOrder ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <span className="font-medium">{selectedOrder.orderNumber}</span>
                      <span className="text-muted-foreground ml-2">- {selectedOrder.customerName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {selectedOrder.items?.length || 0} items
                    </span>
                  </div>
                ) : (
                  selectedOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <span className="font-medium">{order.orderNumber}</span>
                        <span className="text-muted-foreground ml-2">- {order.customerName}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {order.items?.length || 0} items
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Delivery Schedule */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="Calendar" size={20} className="mr-2" />
                Delivery Schedule
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Delivery Date *"
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                  error={errors.deliveryDate}
                  required
                />
                <Select
                  label="Delivery Window"
                  value={formData.deliveryWindow}
                  onChange={(value) => handleInputChange('deliveryWindow', value)}
                  options={deliveryWindowOptions}
                />
                {formData.deliveryWindow === 'specific' && (
                  <Input
                    label="Delivery Time *"
                    type="time"
                    value={formData.deliveryTime}
                    onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                    error={errors.deliveryTime}
                    required
                  />
                )}
                <Select
                  label="Delivery Type"
                  value={formData.deliveryType}
                  onChange={(value) => handleInputChange('deliveryType', value)}
                  options={deliveryTypeOptions}
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="MapPin" size={20} className="mr-2" />
                Delivery Address
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Delivery Address *"
                  value={formData.deliveryAddress}
                  onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                  error={errors.deliveryAddress}
                  required
                  placeholder="Complete delivery address"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Contact Person *"
                    value={formData.contactPerson}
                    onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                    error={errors.contactPerson}
                    required
                  />
                  <Input
                    label="Contact Phone *"
                    value={formData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    error={errors.contactPhone}
                    required
                  />
                </div>
                <Input
                  label="Special Instructions"
                  value={formData.specialInstructions}
                  onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                  placeholder="Any special delivery instructions"
                  multiline
                  rows={3}
                />
              </div>
            </div>

            {/* Logistics Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="Truck" size={20} className="mr-2" />
                Logistics Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Vehicle Type"
                  value={formData.vehicleType}
                  onChange={(value) => handleInputChange('vehicleType', value)}
                  options={vehicleTypeOptions}
                />
                <Input
                  label="Estimated Duration (hours)"
                  type="number"
                  value={formData.estimatedDuration}
                  onChange={(e) => handleInputChange('estimatedDuration', parseInt(e.target.value) || 0)}
                />
                <Input
                  label="Driver Name *"
                  value={formData.driverName}
                  onChange={(e) => handleInputChange('driverName', e.target.value)}
                  error={errors.driverName}
                  required
                />
                <Input
                  label="Driver Phone *"
                  value={formData.driverPhone}
                  onChange={(e) => handleInputChange('driverPhone', e.target.value)}
                  error={errors.driverPhone}
                  required
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Icon name="FileText" size={20} className="mr-2" />
                Additional Information
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes about the delivery"
                  multiline
                  rows={4}
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Schedule Delivery
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ScheduleDelivery;
