import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Textarea } from '@/components/ui/Textarea';
import { ChoiceGroup, FactWell, ModalActions } from './ModalParts';
import {
  returnInventoryV2,
  writeOffInventoryV2,
} from '@/services/inventoryMovementServiceV2';
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
    if (loading) return;
    setError(null);

    // Validation
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    // Client-side check (DB will also validate)
    if (qty > outstandingQuantity) {
      setError(`Quantity cannot exceed pending return (${outstandingQuantity})`);
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
        reference_type: referenceType as 'subscription' | 'event',
        reference_id: referenceId,
      };

      if (actionType === 'return') {
        // Good return: allocated → available
        await returnInventoryV2(userId, {
          ...input,
          is_damaged: false,
          reason_code: 'normal_return',
          notes: notes.trim() || undefined,
        });
      } else if (actionType === 'damage') {
        // Damaged return: allocated → damaged
        await returnInventoryV2(userId, {
          ...input,
          is_damaged: true,
          reason_code: 'client_damage',
          notes: notes.trim(),
        });
      } else if (actionType === 'loss') {
        // Loss: allocated ↓, total ↓, lost ↑
        await writeOffInventoryV2(userId, {
          ...input,
          reason_code: 'client_lost',
          notes: notes.trim(),
        });
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

  const actionLabel =
    actionType === 'return' ? 'Receive back' : actionType === 'damage' ? 'Mark damaged' : 'Mark lost';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive back"
      description="Record what came back in good condition, what came back damaged, and what was lost."
      dismissable={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <FactWell
          eyebrow="Item"
          title={itemName}
          facts={[{ label: 'Still out', value: outstandingQuantity, tone: 'partial' }]}
        />

        <ChoiceGroup<'return' | 'damage' | 'loss'>
          legend="What happened"
          name="return-action"
          value={actionType}
          onChange={setActionType}
          options={[
            { value: 'return', label: 'Returned', hint: 'Good condition', tone: 'final' },
            { value: 'damage', label: 'Damaged', hint: 'Back, not usable', tone: 'partial' },
            { value: 'loss', label: 'Lost', hint: 'Not coming back', tone: 'overdue' },
          ]}
        />

        <Input
          type="number"
          inputMode="numeric"
          label="Pieces"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          max={outstandingQuantity}
          required
          placeholder={`Up to ${outstandingQuantity}`}
          className="tabular"
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            actionType === 'return'
              ? 'Anything worth recording about the return'
              : 'Explain what happened'
          }
          helperText={actionType === 'return' ? 'Optional' : 'Required for damage and loss'}
          required={actionType !== 'return'}
          rows={3}
        />

        {actionType !== 'return' && (
          <Alert variant="warning">
            {actionType === 'damage'
              ? "Damaged pieces come off this client's outstanding count and move to damaged stock."
              : "Lost pieces come off this client's outstanding count and are removed from total stock."}
          </Alert>
        )}

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} variant={actionType === 'loss' ? 'danger' : 'primary'}>
            {loading ? 'Saving…' : actionLabel}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
