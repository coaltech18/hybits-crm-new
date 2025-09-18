import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const BulkActionModal = ({ isOpen, onClose, actionType, selectedItems, onExecute }) => {
  const [formData, setFormData] = useState({
    stockAdjustment: 0,
    adjustmentType: 'add',
    condition: 'good',
    targetLocation: '',
    reorderPoint: 0,
    reason: '',
    notes: ''
  });

  const locations = [
    { value: 'warehouse-main', label: 'Main Warehouse - Mumbai' },
    { value: 'warehouse-delhi', label: 'Delhi Branch' },
    { value: 'warehouse-bangalore', label: 'Bangalore Hub' },
    { value: 'warehouse-pune', label: 'Pune Center' }
  ];

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'maintenance', label: 'Under Maintenance' }
  ];

  const adjustmentTypes = [
    { value: 'add', label: 'Add Stock' },
    { value: 'subtract', label: 'Subtract Stock' },
    { value: 'set', label: 'Set Exact Amount' }
  ];

  const handleSubmit = (e) => {
    e?.preventDefault();
    onExecute(actionType, selectedItems, formData);
    onClose();
  };

  const getModalTitle = () => {
    switch (actionType) {
      case 'stock-adjustment': return 'Bulk Stock Adjustment';
      case 'condition-update': return 'Update Item Condition';
      case 'location-transfer': return 'Transfer Items';
      case 'reorder-points': return 'Set Reorder Points';
      case 'export-data': return 'Export Data';
      default: return 'Bulk Action';
    }
  };

  const renderFormContent = () => {
    switch (actionType) {
      case 'stock-adjustment':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Adjustment Type"
                options={adjustmentTypes}
                value={formData?.adjustmentType}
                onChange={(value) => setFormData(prev => ({ ...prev, adjustmentType: value }))}
                required
              />
              <Input
                label="Quantity"
                type="number"
                value={formData?.stockAdjustment}
                onChange={(e) => setFormData(prev => ({ ...prev, stockAdjustment: parseInt(e?.target?.value) || 0 }))}
                required
              />
            </div>
            <Input
              label="Reason for Adjustment"
              value={formData?.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e?.target?.value }))}
              placeholder="e.g., Physical count correction, Damage, Return"
              required
            />
          </>
        );

      case 'condition-update':
        return (
          <Select
            label="New Condition"
            options={conditions}
            value={formData?.condition}
            onChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
            required
          />
        );

      case 'location-transfer':
        return (
          <Select
            label="Target Location"
            options={locations}
            value={formData?.targetLocation}
            onChange={(value) => setFormData(prev => ({ ...prev, targetLocation: value }))}
            required
          />
        );

      case 'reorder-points':
        return (
          <Input
            label="New Reorder Point"
            type="number"
            value={formData?.reorderPoint}
            onChange={(e) => setFormData(prev => ({ ...prev, reorderPoint: parseInt(e?.target?.value) || 0 }))}
            description="Minimum stock level before reorder alert"
            required
          />
        );

      case 'export-data':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export selected items data to CSV format for external use.
            </p>
            <div className="bg-muted p-3 rounded">
              <p className="text-sm font-medium text-foreground mb-1">Export will include:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Item codes and descriptions</li>
                <li>• Current stock levels</li>
                <li>• Condition and location data</li>
                <li>• Last movement dates</li>
                <li>• Reorder points</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-surface border border-border rounded-lg shadow-pronounced w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{getModalTitle()}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-muted p-3 rounded">
            <p className="text-sm font-medium text-foreground mb-1">
              Selected Items: {selectedItems?.length}
            </p>
            <p className="text-xs text-muted-foreground">
              This action will be applied to all selected items.
            </p>
          </div>

          {renderFormContent()}

          <Input
            label="Additional Notes (Optional)"
            value={formData?.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e?.target?.value }))}
            placeholder="Any additional information..."
          />

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {actionType === 'export-data' ? 'Export' : 'Apply Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkActionModal;