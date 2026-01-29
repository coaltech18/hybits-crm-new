import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createInventoryItem, updateInventoryItem } from '@/services/inventoryService';
import type { InventoryItem, Outlet } from '@/types';

// ================================================================
// ADD / EDIT INVENTORY ITEM MODAL
// ================================================================
// CRITICAL RULES:
// - Initial stock ONLY on create (triggers stock_in movement)
// - Edit does NOT allow stock editing (metadata only)
// - Outlet: Admin = selectable, Manager = auto-filled
// ================================================================

interface AddEditInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userRole: string;
  outlets: Outlet[];
  defaultOutletId?: string; // For managers
  editItem?: InventoryItem | null; // If editing
}

export default function AddEditInventoryItemModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  userRole,
  outlets,
  defaultOutletId,
  editItem,
}: AddEditInventoryItemModalProps) {
  const isEdit = !!editItem;
  const isManager = userRole === 'manager';

  // Form state
  const [outletId, setOutletId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [material, setMaterial] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [initialStock, setInitialStock] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEdit && editItem) {
        // Edit mode: populate existing data
        setOutletId(editItem.outlet_id);
        setName(editItem.name);
        setCategory(editItem.category);
        setMaterial(editItem.material || '');
        setUnit(editItem.unit);
        setInitialStock(''); // Not editable
      } else {
        // Create mode: reset form
        setOutletId(defaultOutletId || '');
        setName('');
        setCategory('');
        setMaterial('');
        setUnit('pcs');
        setInitialStock('0');
      }
      setError(null);
    }
  }, [isOpen, isEdit, editItem, defaultOutletId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!outletId) {
      setError('Outlet is required');
      return;
    }

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    if (!category.trim()) {
      setError('Category is required');
      return;
    }

    if (!isEdit) {
      const stock = parseInt(initialStock);
      if (isNaN(stock) || stock < 0) {
        setError('Initial stock must be a non-negative number');
        return;
      }
    }

    try {
      setLoading(true);

      if (isEdit && editItem) {
        // Update item (metadata only, NO quantities)
        await updateInventoryItem(userId, editItem.id, {
          name: name.trim(),
          category: category.trim(),
          material: material.trim() || undefined,
          unit: unit || 'pcs',
        });
      } else {
        // Create item (includes initial stock_in movement)
        await createInventoryItem(userId, {
          outlet_id: outletId,
          name: name.trim(),
          category: category.trim(),
          material: material.trim() || undefined,
          unit: unit || 'pcs',
          initial_stock: parseInt(initialStock),
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Surface DB error directly
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Outlet (admin = selectable, manager = auto-filled/hidden) */}
        {!isManager ? (
          <Select
            label="Outlet"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            required
            disabled={isEdit} // Cannot change outlet when editing
          >
            <option value="">Select Outlet</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label="Outlet"
            value={outlets.find(o => o.id === outletId)?.name || 'Your Outlet'}
            disabled
          />
        )}

        {/* Item Details */}
        <Input
          label="Item Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Plate 10-inch"
          required
        />

        <Input
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Plate, Glass, Bowl"
          required
        />

        <Input
          label="Material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="e.g., Steel, Ceramic, Melamine (optional)"
        />

        <Input
          label="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g., pcs, dozen"
        />

        {/* Initial Stock (ONLY on create) */}
        {!isEdit && (
          <>
            <Input
              type="number"
              label="Initial Stock"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              min="0"
              required
            />
            <p className="text-sm text-muted-foreground">
              Initial stock will create a stock_in movement.
            </p>
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
