import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createStockInV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// ADD STOCK MODAL
// ================================================================
// Calls: createStockInV2()
// Hardcodes: reason_code = 'new_purchase' (or 'opening_balance')
// No movement_category or reason_code exposed to user.
// ================================================================

interface AddStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    availableQuantity: number;
}

export default function AddStockModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    availableQuantity,
}: AddStockModalProps) {
    const [quantity, setQuantity] = useState('');
    const [isOpeningBalance, setIsOpeningBalance] = useState(false);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setIsOpeningBalance(false);
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

        try {
            setLoading(true);

            await createStockInV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reason_code: isOpeningBalance ? 'opening_balance' : 'new_purchase',
                notes: notes.trim() || undefined,
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add stock');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Stock">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                    <p className="text-sm text-muted-foreground mt-2">Current Available</p>
                    <p className="text-lg font-bold text-green-600">{availableQuantity}</p>
                </div>

                {/* Quantity */}
                <Input
                    type="number"
                    label="Quantity to Add"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    required
                    placeholder="Enter quantity"
                />

                {/* Opening Balance Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isOpeningBalance}
                        onChange={(e) => setIsOpeningBalance(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                        This is opening balance stock
                    </span>
                </label>

                {/* Notes */}
                <Input
                    label="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Purchase order #123"
                />

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Adding...' : 'Add Stock'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
