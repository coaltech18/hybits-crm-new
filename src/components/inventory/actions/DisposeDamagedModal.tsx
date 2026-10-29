import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { FactWell, ModalActions } from '../ModalParts';
import { writeOffInventoryV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// DISPOSE DAMAGED MODAL
// ================================================================
// Calls: writeOffInventoryV2()
// Hardcodes: reason_code = 'end_of_life', reference_type = 'manual'
// Only operates on damaged_quantity pool
// Notes REQUIRED.
// ================================================================

interface DisposeDamagedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    damagedQuantity: number;
}

export default function DisposeDamagedModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    damagedQuantity,
}: DisposeDamagedModalProps) {
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

        if (qty > damagedQuantity) {
            setError(`Quantity cannot exceed damaged stock (${damagedQuantity})`);
            return;
        }

        if (!notes.trim()) {
            setError('Notes are required when disposing damaged items');
            return;
        }

        try {
            setLoading(true);

            await writeOffInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reason_code: 'end_of_life',
                reference_type: 'manual',
                notes: notes.trim(),
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to dispose damaged items');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Dispose damaged pieces"
            description="Disposed pieces leave the books for good."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[{ label: 'Damaged', value: damagedQuantity, tone: 'partial' }]}
                />

                <Alert variant="warning">
                    Disposing reduces both damaged and total stock. This cannot be undone.
                </Alert>

                <Input
                    type="number"
                    inputMode="numeric"
                    label="Pieces to dispose"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={damagedQuantity}
                    required
                    placeholder={`Up to ${damagedQuantity}`}
                    className="tabular"
                />

                <Textarea
                    label="Reason"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Beyond repair, end of life"
                    helperText="Required"
                    required
                    rows={3}
                />

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} variant="danger">
                        {loading ? 'Disposing…' : 'Dispose pieces'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
