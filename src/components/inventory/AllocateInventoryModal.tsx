import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { getInventoryItems } from '@/services/inventoryService';
import { allocateInventory } from '@/services/inventoryMovementService';
import type { InventoryItem, ReferenceType } from '@/types';

// ================================================================
// ALLOCATE INVENTORY MODAL
// ================================================================
// CRITICAL RULES:
// - Quantity ≤ available_quantity (DB enforces, UI shows limit)
// - UI shows available but does NOT calculate
// - Errors shown from DB
// - Transaction: allocation movement + allocation record
// ================================================================

interface AllocateInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  outletId: string;
  referenceType: ReferenceType;
  referenceId: string;
  referenceName: string;
}

export default function AllocateInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  outletId,
  referenceType,
  referenceId,
  referenceName,
}: AllocateInventoryModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Form state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected item details
  const selectedItem = items.find(i => i.id === selectedItemId);
  const availableQuantity = selectedItem?.available_quantity || 0;

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSelectedItemId('');
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  async function loadItems() {
    try {
      setLoadingItems(true);
      // Fetch items for this outlet with available stock
      const data = await getInventoryItems(userId, {
        outlet_id: outletId,
        is_active: true,
      });
      // Filter items with available stock
      const availableItems = data.filter(item => item.available_quantity > 0);
      setItems(availableItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    // Client-side check (DB will also validate)
    if (qty > availableQuantity) {
      setError(`Quantity cannot exceed available stock (${availableQuantity})`);
      return;
    }

    try {
      setLoading(true);

      // Create allocation movement (DB trigger updates quantities AND creates allocation record)
      // NOTE: sync_allocation_on_movement trigger automatically creates/updates inventory_allocations
      await allocateInventory(userId, {
        outlet_id: outletId,
        inventory_item_id: selectedItemId,
        quantity: qty,
        reference_type: referenceType as 'subscription' | 'event',
        reference_id: referenceId,
        notes: notes.trim() || undefined,
      });

      // No need to call createAllocation - DB trigger handles it

      onSuccess();
      onClose();
    } catch (err) {
      // Surface DB error directly (e.g., "Insufficient stock available")
      setError(err instanceof Error ? err.message : 'Failed to allocate inventory');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Allocate Inventory"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Reference Info */}
        <div className="bg-muted p-4 rounded">
          <p className="text-sm text-muted-foreground">Allocating To</p>
          <p className="font-semibold capitalize">{referenceType}</p>
          <p className="text-sm">{referenceName}</p>
        </div>

        {loadingItems ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <Alert variant="warning">
            No inventory items with available stock found for this outlet.
          </Alert>
        ) : (
          <>
            {/* Select Item */}
            <Select
              label="Inventory Item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required
            >
              <option value="">Select Item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.category} (Available: {item.available_quantity})
                </option>
              ))}
            </Select>

            {/* Show available quantity for selected item */}
            {selectedItem && (
              <div className="bg-brand-primary/10 p-3 rounded">
                <p className="text-sm text-muted-foreground">Available Stock</p>
                <p className="text-lg font-bold text-brand-primary">{availableQuantity} {selectedItem.unit}</p>
              </div>
            )}

            {/* Quantity */}
            <Input
              type="number"
              label="Quantity to Allocate"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={availableQuantity}
              required
              disabled={!selectedItemId}
              placeholder={selectedItem ? `Max: ${availableQuantity}` : 'Select an item first'}
            />

            {/* Notes */}
            <Input
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this allocation"
            />
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || items.length === 0}>
            {loading ? 'Allocating...' : 'Allocate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
