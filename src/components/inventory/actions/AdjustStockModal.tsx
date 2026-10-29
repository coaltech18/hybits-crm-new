import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ChoiceGroup, FactWell, ModalActions } from '../ModalParts';
import { adjustInventoryV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// ADJUST STOCK MODAL (ADMIN ONLY)
// ================================================================
// Calls: adjustInventoryV2()
// Direction toggle:
//   Increase → is_negative = false, reason_code = 'count_correction'
//   Decrease → is_negative = true, reason_code = 'audit_shortage'
// Notes REQUIRED.
// ================================================================

interface AdjustStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    availableQuantity: number;
    totalQuantity: number;
}

export default function AdjustStockModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    availableQuantity,
    totalQuantity,
}: AdjustStockModalProps) {
    const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDirection('increase');
            setQuantity('');
            setNotes('');
            setError(null);
        }
    }, [isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError(null);

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            return;
        }

        if (direction === 'decrease' && qty > availableQuantity) {
            setError(`Cannot decrease by more than available stock (${availableQuantity})`);
            return;
        }

        if (!notes.trim()) {
            setError('Notes are required for stock adjustments');
            return;
        }

        try {
            setLoading(true);

            await adjustInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                is_negative: direction === 'decrease',
                reason_code: direction === 'decrease' ? 'audit_shortage' : 'count_correction',
                notes: notes.trim(),
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to adjust stock');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Adjust stock"
            description="Admin correction. Every adjustment is logged with its reason."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[
                        { label: 'Total', value: totalQuantity },
                        { label: 'Available', value: availableQuantity, tone: 'final' },
                    ]}
                />

                <ChoiceGroup<'increase' | 'decrease'>
                    legend="Direction"
                    name="adjust-direction"
                    value={direction}
                    onChange={setDirection}
                    options={[
                        { value: 'increase', label: 'Increase', hint: 'Count found more', tone: 'final' },
                        { value: 'decrease', label: 'Decrease', hint: 'Count found fewer', tone: 'overdue' },
                    ]}
                />

                <Input
                    type="number"
                    inputMode="numeric"
                    label={direction === 'increase' ? 'Pieces to add' : 'Pieces to remove'}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={direction === 'decrease' ? availableQuantity : undefined}
                    required
                    placeholder={direction === 'decrease' ? `Up to ${availableQuantity}` : undefined}
                    className="tabular"
                />

                <Textarea
                    label="Reason"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Physical count mismatch, audit correction"
                    helperText="Required"
                    required
                    rows={3}
                />

                {direction === 'decrease' && (
                    <Alert variant="warning">
                        A decrease reduces available and total stock. It is logged and auditable.
                    </Alert>
                )}

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        isLoading={loading}
                        variant={direction === 'decrease' ? 'danger' : 'primary'}
                    >
                        {loading
                            ? 'Adjusting…'
                            : direction === 'increase'
                                ? 'Increase stock'
                                : 'Decrease stock'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
