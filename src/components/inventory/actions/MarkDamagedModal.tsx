import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { FactWell, ModalActions } from '../ModalParts';
import { writeOffInventoryV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// MARK DAMAGED (WAREHOUSE) MODAL
// ================================================================
// Calls: writeOffInventoryV2()
// Hardcodes: reason_code = 'handling_damage', reference_type = 'manual'
// Deducts from available_quantity, increases damaged_quantity
// Notes REQUIRED.
// ================================================================

interface MarkDamagedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    availableQuantity: number;
}

export default function MarkDamagedModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    availableQuantity,
}: MarkDamagedModalProps) {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
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

        if (qty > availableQuantity) {
            setError(`Quantity cannot exceed available stock (${availableQuantity})`);
            return;
        }

        if (!notes.trim()) {
            setError('Notes are required when marking items as damaged');
            return;
        }

        try {
            setLoading(true);

            await writeOffInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reason_code: 'handling_damage',
                reference_type: 'manual',
                notes: notes.trim(),
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark as damaged');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Mark damaged"
            description="For pieces damaged at the outlet. Client returns go through Receive back."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[{ label: 'Available', value: availableQuantity, tone: 'final' }]}
                />

                <Input
                    type="number"
                    inputMode="numeric"
                    label="Damaged pieces"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={availableQuantity}
                    required
                    placeholder={`Up to ${availableQuantity}`}
                    className="tabular"
                />

                <Textarea
                    label="What happened"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe how the damage occurred"
                    helperText="Required"
                    required
                    rows={3}
                />

                <Alert variant="warning">
                    These pieces move from available stock to damaged stock.
                </Alert>

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} variant="danger">
                        {loading ? 'Saving…' : 'Mark damaged'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
