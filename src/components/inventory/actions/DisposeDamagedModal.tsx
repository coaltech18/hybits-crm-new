import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
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
        <Modal isOpen={isOpen} onClose={onClose} title="Dispose Damaged Items">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                    <p className="text-sm text-muted-foreground mt-2">Damaged Stock</p>
                    <p className="text-lg font-bold text-orange-600">{damagedQuantity}</p>
                </div>

                <Alert variant="warning">
                    Disposed items will be permanently removed from inventory. This reduces both
                    damaged quantity and total quantity.
                </Alert>

                {/* Quantity */}
                <Input
                    type="number"
                    label="Quantity to Dispose"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={damagedQuantity}
                    required
                    placeholder={`Max: ${damagedQuantity}`}
                />

                {/* Notes (REQUIRED) */}
                <Textarea
                    label="Notes (required)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for disposal (e.g., beyond repair, end of life)..."
                    required
                    rows={3}
                />

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading} variant="destructive">
                        {loading ? 'Disposing...' : 'Dispose'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
