// ============================================================================
// OUTLET SELECTOR COMPONENT
// ============================================================================

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import Select from './Select';
import Icon from '../AppIcon';

const OutletSelector: React.FC = () => {
  const { user, currentOutlet, availableOutlets, switchOutlet } = useAuth();

  if (!user || !hasPermission(user.role, 'outlets', 'read')) {
    return null;
  }

  // If user only has access to one outlet, don't show selector
  if (availableOutlets.length <= 1) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Icon name="map-pin" size={16} />
        <span>{currentOutlet?.name || 'No outlet selected'}</span>
      </div>
    );
  }

  const outletOptions = availableOutlets.map(outlet => ({
    value: outlet.id,
    label: outlet.name
  }));

  const handleOutletChange = async (outletId: string) => {
    try {
      await switchOutlet(outletId);
    } catch (error) {
      console.error('Failed to switch outlet:', error);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Icon name="map-pin" size={16} className="text-muted-foreground" />
      <Select
        options={outletOptions}
        value={currentOutlet?.id || ''}
        onChange={handleOutletChange}
        placeholder="Select outlet"
        className="min-w-[200px]"
      />
    </div>
  );
};

export default OutletSelector;
