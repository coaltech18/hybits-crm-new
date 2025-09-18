import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LocationService } from '../../services/locationService';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

const LocationManagement = () => {
  const { userProfile, userLocations, currentLocation, signOut, hasPermission, switchLocation, sidebarCollapsed, toggleSidebar } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({
    location_code: '',
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    manager_id: ''
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await LocationService.getAllLocations();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    try {
      await LocationService.createLocation(formData);
      setShowCreateModal(false);
      resetForm();
      loadLocations();
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    try {
      await LocationService.updateLocation(editingLocation.id, formData);
      setEditingLocation(null);
      resetForm();
      loadLocations();
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const handleDeactivateLocation = async (locationId) => {
    if (window.confirm('Are you sure you want to deactivate this location?')) {
      try {
        await LocationService.deactivateLocation(locationId);
        loadLocations();
      } catch (error) {
        console.error('Error deactivating location:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      location_code: '',
      name: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      manager_id: ''
    });
  };

  const openEditModal = (location) => {
    setEditingLocation(location);
    setFormData({
      location_code: location.location_code,
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      phone: location.phone,
      email: location.email,
      manager_id: location.manager_id || ''
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSearch = (query) => {
    console.log('Search query:', query);
  };

  if (!hasPermission('admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Icon name="Shield" size={32} color="red" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You need admin permissions to access location management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        userLocations={userLocations}
        currentLocation={currentLocation}
        onLocationSwitch={switchLocation}
        onLogout={handleLogout}
        onSearch={handleSearch}
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Location Management</h1>
              <p className="text-muted-foreground">
                Manage warehouse locations and access permissions
              </p>
            </div>
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                iconName="Plus"
                iconPosition="left"
              >
                Add Location
              </Button>
            </div>
          </div>

          {/* Locations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div key={location.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <Icon name="MapPin" size={20} color="white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">{location.location_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(location)}
                      className="h-8 w-8"
                    >
                      <Icon name="Edit" size={16} />
                    </Button>
                    {hasPermission('admin') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeactivateLocation(location.id)}
                        className="h-8 w-8 text-error hover:text-error"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Icon name="MapPin" size={14} />
                    <span>{location.address}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Icon name="Building" size={14} />
                    <span>{location.city}, {location.state}</span>
                  </div>
                  {location.phone && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Icon name="Phone" size={14} />
                      <span>{location.phone}</span>
                    </div>
                  )}
                  {location.email && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Icon name="Mail" size={14} />
                      <span>{location.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    location.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {location.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(location)}
                  >
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Create/Edit Modal */}
          {(showCreateModal || editingLocation) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-foreground">
                    {editingLocation ? 'Edit Location' : 'Create New Location'}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingLocation(null);
                      resetForm();
                    }}
                  >
                    <Icon name="X" size={20} />
                  </Button>
                </div>

                <form onSubmit={editingLocation ? handleUpdateLocation : handleCreateLocation}>
                  <div className="space-y-4">
                    <Input
                      label="Location Code"
                      value={formData.location_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, location_code: e.target.value }))}
                      placeholder="LOC-001"
                      required
                    />
                    
                    <Input
                      label="Location Name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Main Warehouse"
                      required
                    />
                    
                    <Input
                      label="Address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="123 Industrial Area"
                      required
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="City"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Mumbai"
                        required
                      />
                      
                      <Input
                        label="State"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="Maharashtra"
                        required
                      />
                    </div>
                    
                    <Input
                      label="Pincode"
                      value={formData.pincode}
                      onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                      placeholder="400069"
                    />
                    
                    <Input
                      label="Phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91-22-12345678"
                    />
                    
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="mumbai@hybits.in"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingLocation(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                    >
                      {editingLocation ? 'Update Location' : 'Create Location'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LocationManagement;
