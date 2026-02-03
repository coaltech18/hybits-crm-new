import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Textarea } from '@/components/ui/Textarea';
import {
  returnInventory,
  markDamage,
  markLoss,
} from '@/services/inventoryMovementService';
import type { ReferenceType } from '@/types';

// ================================================================
// RETURN / DAMAGE / LOSS MODAL
// ================================================================
// CRITICAL RULES:
// - Quantity always positive
// - DB validates limits (cannot exceed outstanding)
// - Notes MANDATORY for damage/loss
// - UI never computes outstanding (passed from parent)
// ================================================================

interface ReturnDamageLossModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  outletId: string;
  inventoryItemId: string;
  itemName: string;
  referenceType: ReferenceType;
  referenceId: string;
  outstandingQuantity: number; // DERIVED from DB, passed from parent
}

export default function ReturnDamageLossModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  outletId,
  inventoryItemId,
  itemName,
  referenceType,
  referenceId,
  outstandingQuantity,
}: ReturnDamageLossModalProps) {
  // Form state
  const [actionType, setActionType] = useState<'return' | 'damage' | 'loss'>('return');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActionType('return');
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    // Client-side check (DB will also validate)
    if (qty > outstandingQuantity) {
      setError(`Quantity cannot exceed outstanding (${outstandingQuantity})`);
      return;
    }

    // Notes mandatory for damage/loss
    if ((actionType === 'damage' || actionType === 'loss') && !notes.trim()) {
      setError('Notes are required when marking damage or loss');
      return;
    }

    try {
      setLoading(true);

      const input = {
        outlet_id: outletId,
        inventory_item_id: inventoryItemId,
        quantity: qty,
        reference_type: referenceType,
        reference_id: referenceId,
        notes: notes.trim() || undefined,
      };

      if (actionType === 'return') {
        await returnInventory(userId, { ...input, reference_type: referenceType as 'subscription' | 'event' });
      } else if (actionType === 'damage') {
        await markDamage(userId, { ...input, reference_type: referenceType as 'subscription' | 'event', notes: notes.trim() });
      } else if (actionType === 'loss') {
        await markLoss(userId, { ...input, reference_type: referenceType as 'subscription' | 'event', notes: notes.trim() });
      }

      onSuccess();
      onClose();
    } catch (err) {
      // Surface DB error directly (e.g., "Cannot return more than outstanding")
      setError(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Return / Damage / Loss"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Item Info */}
        <div className="bg-muted p-4 rounded">
          <p className="text-sm text-muted-foreground">Item</p>
          <p className="font-semibold">{itemName}</p>
          <p className="text-sm text-muted-foreground mt-2">Outstanding Quantity</p>
          <p className="text-lg font-bold text-orange-600">{outstandingQuantity}</p>
        </div>

        {/* Action Type */}
        <Select
          label="Action"
          value={actionType}
          onChange={(e) => setActionType(e.target.value as 'return' | 'damage' | 'loss')}
          required
        >
          <option value="return">Return (Good Condition)</option>
          <option value="damage">Mark as Damaged</option>
          <option value="loss">Mark as Lost</option>
        </Select>

        {/* Quantity */}
        <Input
          type="number"
          label="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          max={outstandingQuantity}
          required
          placeholder={`Max: ${outstandingQuantity}`}
        />

        {/* Notes */}
        <Textarea
          label={actionType === 'return' ? 'Notes (optional)' : 'Notes (required)'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            actionType === 'return'
              ? 'Optional notes about the return'
              : 'Explain what happened (mandatory)'
          }
          required={actionType !== 'return'}
          rows={4}
        />

        {actionType !== 'return' && (
          <Alert variant="warning">
            <strong>Note:</strong> {actionType === 'damage' ? 'Damaged' : 'Lost'} items will be
            tracked separately and reduce available stock.
          </Alert>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Processing...' : actionType === 'return' ? 'Return' : `Mark as ${actionType}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
