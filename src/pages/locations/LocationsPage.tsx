// ============================================================================
// LOCATIONS PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Location } from '@/types';
import LocationService from '@/services/locationService';

const LocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch locations on component mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const data = await LocationService.getLocations();
        setLocations(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Failed to load locations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.address.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.contact_person.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Location Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your business locations and warehouses
          </p>
        </div>
        <Button>
          <Icon name="plus" size={20} className="mr-2" />
          Add Location
        </Button>
      </div>

      {/* Search */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="max-w-md">
          <Input
            type="search"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Loading locations...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Icon name="alert-circle" className="h-5 w-5 text-destructive" />
            <span className="text-destructive font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Locations Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => (
          <div key={location.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">{location.name}</h3>
                <p className="text-sm text-muted-foreground">{location.code}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  location.is_active 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                }`}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm">
                    <Icon name="edit" size={16} />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Icon name="eye" size={16} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Icon name="map-pin" size={16} className="text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p className="text-foreground">{location.address.street}</p>
                  <p className="text-muted-foreground">
                    {location.address.city}, {location.address.state} - {location.address.pincode}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="user" size={16} className="text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-foreground">{location.contact_person}</p>
                  <p className="text-muted-foreground">Manager</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="phone" size={16} className="text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-foreground">{location.contact_phone}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="mail" size={16} className="text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-foreground">{location.contact_email}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">
                  {new Date(location.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* No Locations Found */}
      {!loading && !error && filteredLocations.length === 0 && (
        <div className="text-center py-12">
          <Icon name="map-pin" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No locations found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'No locations match your search criteria.' : 'Get started by adding your first location.'}
          </p>
          <Button>
            <Icon name="plus" size={20} className="mr-2" />
            Add First Location
          </Button>
        </div>
      )}
    </div>
  );
};

export default LocationsPage;
