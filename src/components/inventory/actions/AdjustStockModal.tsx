import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
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
        <Modal isOpen={isOpen} onClose={onClose} title="Adjust Stock (Admin)">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-lg font-bold">{totalQuantity}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Available</p>
                            <p className="text-lg font-bold text-green-600">{availableQuantity}</p>
                        </div>
                    </div>
                </div>

                {/* Direction Toggle */}
                <div>
                    <label className="block text-sm font-medium mb-2">Adjustment Direction</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setDirection('increase')}
                            className={`flex-1 py-3 px-4 rounded-lg border-2 text-center font-medium transition-colors ${direction === 'increase'
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                        >
                            ↑ Increase
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('decrease')}
                            className={`flex-1 py-3 px-4 rounded-lg border-2 text-center font-medium transition-colors ${direction === 'decrease'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                        >
                            ↓ Decrease
                        </button>
                    </div>
                </div>

                {/* Quantity */}
                <Input
                    type="number"
                    label={`Quantity to ${direction === 'increase' ? 'Add' : 'Remove'}`}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={direction === 'decrease' ? availableQuantity : undefined}
                    required
                    placeholder={direction === 'decrease' ? `Max: ${availableQuantity}` : 'Enter quantity'}
                />

                {/* Notes (REQUIRED) */}
                <Textarea
                    label="Reason for Adjustment (required)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Physical count mismatch, audit correction..."
                    required
                    rows={3}
                />

                {direction === 'decrease' && (
                    <Alert variant="warning">
                        Negative adjustments reduce available and total stock. This action is logged and auditable.
                    </Alert>
                )}

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        variant={direction === 'decrease' ? 'destructive' : 'default'}
                    >
                        {loading
                            ? 'Adjusting...'
                            : direction === 'increase'
                                ? 'Increase Stock'
                                : 'Decrease Stock'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
