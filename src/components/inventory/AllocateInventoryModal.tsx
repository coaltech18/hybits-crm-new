import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { FactWell, ModalActions } from './ModalParts';
import { getItemsForAllocation } from '@/services/inventoryServiceV2';
import { allocateInventoryV2 } from '@/services/inventoryMovementServiceV2';
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

  const loadItems = useCallback(async () => {
    try {
      setLoadingItems(true);
      // Fetch ACTIVE items for this outlet (only active items can be allocated)
      const data = await getItemsForAllocation(userId, outletId);
      // Filter items with available stock
      const availableItems = data.filter(item => item.available_quantity > 0);
      setItems(availableItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  }, [userId, outletId]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSelectedItemId('');
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [isOpen, loadItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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
      await allocateInventoryV2(userId, {
        outlet_id: outletId,
        inventory_item_id: selectedItemId,
        quantity: qty,
        reference_type: referenceType as 'subscription' | 'event',
        reference_id: referenceId,
        reason_code: referenceType === 'event' ? 'event_dispatch' : 'subscription_start',
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
      title="Send dishes"
      description="Pieces move from available stock to this booking."
      dismissable={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <FactWell
          eyebrow={referenceType === 'event' ? 'Sending to event' : 'Sending to subscription'}
          title={referenceName}
          facts={selectedItem ? [{ label: 'Available', value: availableQuantity, tone: 'final' }] : []}
        />

        {loadingItems ? (
          <div className="space-y-3 py-2" aria-busy="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : items.length === 0 ? (
          <Alert variant="warning">
            No dishware with available stock at this outlet. Add stock to an item first.
          </Alert>
        ) : (
          <>
            <Select
              label="Item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.category} ({item.available_quantity} available)
                </option>
              ))}
            </Select>

            <Input
              type="number"
              inputMode="numeric"
              label="Pieces to send"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={availableQuantity}
              required
              disabled={!selectedItemId}
              placeholder={selectedItem ? `Up to ${availableQuantity}` : 'Select an item first'}
              className="tabular"
            />

            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Vehicle number, delivery note"
              helperText="Optional"
            />
          </>
        )}

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} disabled={items.length === 0}>
            {loading ? 'Sending…' : 'Send dishes'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
