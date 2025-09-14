import React, { useState } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const LocationSelector = ({ userLocations = [], currentLocation, onLocationSwitch }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleLocationSelect = (location) => {
    onLocationSwitch(location.id);
    setIsOpen(false);
  };

  if (userLocations.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 min-w-0"
      >
        <Icon name="MapPin" size={16} />
        <span className="hidden md:block text-sm truncate max-w-32">
          {currentLocation?.name || 'Select Location'}
        </span>
        <Icon name="ChevronDown" size={14} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-pronounced z-50">
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold text-popover-foreground text-sm">Switch Location</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Select a location to view its data
            </p>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {userLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleLocationSelect(location)}
                className={`w-full p-3 text-left hover:bg-muted transition-colors ${
                  currentLocation?.id === location.id ? 'bg-accent/5' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    currentLocation?.id === location.id ? 'bg-primary' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-popover-foreground truncate">
                      {location.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {location.city}, {location.state}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        location.access_level === 'manager' ? 'bg-blue-100 text-blue-800' :
                        location.access_level === 'viewer' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {location.access_level}
                      </span>
                    </div>
                  </div>
                  {currentLocation?.id === location.id && (
                    <Icon name="Check" size={16} className="text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
          
          <div className="p-3 border-t border-border">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Icon name="Info" size={14} />
              <span>Access level determines your permissions for this location</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
