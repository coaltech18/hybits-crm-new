import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Location } from '@/types';
import { LocationService } from '../../services/locationService';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Icon from '../../components/AppIcon.tsx';

// Using Location from @/types

interface FormData {
  location_code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  manager_id: string;
}

const LocationManagement: React.FC = () => {
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<FormData>({
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

  const loadLocations = async (): Promise<void> => {
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

  const handleCreateLocation = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      console.log('Creating location:', formData);
      setShowCreateModal(false);
      resetForm();
      loadLocations();
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  const handleEditLocation = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      console.log('Updating location:', editingLocation?.id, formData);
      setEditingLocation(null);
      resetForm();
      loadLocations();
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const handleDeleteLocation = async (locationId: string): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        console.log('Deleting location:', locationId);
        loadLocations();
      } catch (error) {
        console.error('Error deleting location:', error);
      }
    }
  };

  const resetForm = (): void => {
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

  const openCreateModal = (): void => {
    resetForm();
    setEditingLocation(null);
    setShowCreateModal(true);
  };

  const openEditModal = (location: Location): void => {
    setFormData({
      location_code: location.location_code,
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      phone: location.phone,
      email: location.email,
      manager_id: location.manager_id
    });
    setEditingLocation(location);
    setShowCreateModal(true);
  };

  const closeModal = (): void => {
    setShowCreateModal(false);
    setEditingLocation(null);
    resetForm();
  };

  const handleLogout = async (): Promise<void> => {
    try {
      // await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const _handleRoleSwitch = (): void => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query: string): void => {
    console.log('Global search:', query);
  };

  const stateOptions = [
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'tamil-nadu', label: 'Tamil Nadu' },
    { value: 'kerala', label: 'Kerala' },
    { value: 'andhra-pradesh', label: 'Andhra Pradesh' },
    { value: 'telangana', label: 'Telangana' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'rajasthan', label: 'Rajasthan' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'other', label: 'Other' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={userProfile}
        onLogout={handleLogout}
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
              Location Management
            </h1>
            <p className="text-muted-foreground">
              Manage warehouse locations, branches, and operational sites for the Hybits CRM system.
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-foreground">
                Locations ({locations.length})
              </h2>
            </div>
            <Button onClick={openCreateModal} iconName="Plus">
              Add Location
            </Button>
          </div>

          {/* Locations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div key={location.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon name="MapPin" size={24} className="text-primary" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {location.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {location.location_code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(location)}
                    >
                      <Icon name="Edit" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLocation(location.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Icon name="MapPin" size={14} className="mr-2" />
                    <span>{location.address}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Icon name="Building" size={14} className="mr-2" />
                    <span>{location.city}, {location.state} - {location.pincode}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Icon name="Phone" size={14} className="mr-2" />
                    <span>{location.phone}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Icon name="Mail" size={14} className="mr-2" />
                    <span>{location.email}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Created: {new Date(location.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {}}
                    >
                      Switch to
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {locations.length === 0 && (
            <div className="text-center py-12">
              <Icon name="MapPin" size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No locations found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first location.
              </p>
              <Button onClick={openCreateModal} iconName="Plus">
                Add Location
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Location Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {editingLocation ? 'Edit Location' : 'Create New Location'}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <Icon name="X" size={16} />
              </Button>
            </div>

            <form onSubmit={editingLocation ? handleEditLocation : handleCreateLocation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Location Code"
                  value={formData.location_code}
                  onChange={(e) => setFormData({ ...formData, location_code: e.target.value })}
                  placeholder="e.g., WH-001"
                />
                <Input
                  label="Location Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse"
                  required
                />
              </div>

              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Street address, building, etc."
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
                <Select
                  label="State"
                  value={formData.state}
                  onChange={(value) => setFormData({ ...formData, state: value })}
                  options={stateOptions}
                  required
                />
                <Input
                  label="Pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Manager ID"
                value={formData.manager_id}
                onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                placeholder="User ID of the location manager"
              />

              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingLocation ? 'Update Location' : 'Create Location'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;
