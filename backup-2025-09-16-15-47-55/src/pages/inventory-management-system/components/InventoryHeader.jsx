import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import ImportExport from '../../../components/ui/ImportExport';

const InventoryHeader = ({ 
  selectedLocation, 
  onLocationChange, 
  stockAlerts, 
  onBulkAction, 
  onAddItem,
  searchQuery, 
  onSearchChange,
  onBarcodeScan,
  inventoryItems = [],
  sidebarOpen,
  onToggleSidebar
}) => {
  const [showBulkActions, setShowBulkActions] = useState(false);

  const locations = [
    { value: 'all', label: 'All Locations' },
    { value: 'warehouse-main', label: 'Main Warehouse - Mumbai' },
    { value: 'warehouse-delhi', label: 'Delhi Branch' },
    { value: 'warehouse-bangalore', label: 'Bangalore Hub' },
    { value: 'warehouse-pune', label: 'Pune Center' }
  ];

  const bulkActions = [
    { id: 'stock-adjustment', label: 'Stock Adjustment', icon: 'Edit3' },
    { id: 'condition-update', label: 'Update Condition', icon: 'RefreshCw' },
    { id: 'location-transfer', label: 'Location Transfer', icon: 'Move' },
    { id: 'reorder-points', label: 'Set Reorder Points', icon: 'Target' },
    { id: 'export-data', label: 'Export Selected', icon: 'Download' }
  ];

  return (
    <div className="bg-surface border-b border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-foreground">Inventory Management</h1>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-sm text-muted-foreground">System Online</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Sidebar Toggle */}
          <div className="flex items-center space-x-2">
            <Icon name="Menu" size={14} className="text-muted-foreground" />
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              title={`${sidebarOpen ? 'Hide' : 'Show'} Filters Sidebar (Ctrl+F)`}
            >
              {sidebarOpen ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          {/* Stock Alerts */}
          <div className="relative">
            <Button variant="outline" className="relative">
              <Icon name="AlertTriangle" size={18} className="mr-2 text-warning" />
              <span className="text-sm font-medium">{stockAlerts} Alerts</span>
              {stockAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-error text-error-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {stockAlerts > 9 ? '9+' : stockAlerts}
                </span>
              )}
            </Button>
          </div>

          {/* Bulk Actions */}
          <div className="relative">
            <Button
              variant="default"
              onClick={() => setShowBulkActions(!showBulkActions)}
              iconName="Settings"
              iconPosition="left"
            >
              Bulk Actions
            </Button>

            {showBulkActions && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-lg shadow-pronounced z-50">
                <div className="p-2">
                  {bulkActions?.map((action) => (
                    <Button
                      key={action?.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onBulkAction(action?.id);
                        setShowBulkActions(false);
                      }}
                      className="w-full justify-start"
                      iconName={action?.icon}
                      iconPosition="left"
                    >
                      {action?.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add Item */}
          <Button 
            variant="default" 
            iconName="Plus" 
            iconPosition="left"
            onClick={onAddItem}
          >
            Add Item
          </Button>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {/* Location Selector */}
        <div className="w-64">
          <Select
            options={locations}
            value={selectedLocation}
            onChange={onLocationChange}
            placeholder="Select location"
          />
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative">
          <div className="relative">
            <Icon 
              name="Search" 
              size={18} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              type="search"
              placeholder="Search by item code, description, or barcode..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e?.target?.value)}
              className="pl-10 pr-12"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onBarcodeScan}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
            >
              <Icon name="Scan" size={16} />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" iconName="RefreshCw" iconPosition="left">
            Sync
          </Button>
          <ImportExport
            data={inventoryItems}
            dataType="inventory"
            onExport={(result) => {
              console.log('Inventory export completed:', result);
            }}
            onImport={(result) => {
              console.log('Inventory import completed:', result);
            }}
            requiredFields={['item_code', 'name', 'category']}
          />
        </div>
      </div>
    </div>
  );
};

export default InventoryHeader;