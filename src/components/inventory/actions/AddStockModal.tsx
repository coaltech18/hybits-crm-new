import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { FactWell, ModalActions } from '../ModalParts';
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
        if (loading) return;
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add stock"
            description="New pieces go straight into available stock."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[{ label: 'Available now', value: availableQuantity, tone: 'final' }]}
                />

                <Input
                    type="number"
                    inputMode="numeric"
                    label="Pieces to add"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    required
                    className="tabular"
                />

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-rule px-3 py-2.5 hover:border-ink-faint">
                    <input
                        type="checkbox"
                        checked={isOpeningBalance}
                        onChange={(e) => setIsOpeningBalance(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-rule-strong text-brand-primary focus:ring-brand-logo"
                    />
                    <span>
                        <span className="block text-sm font-semibold text-ink">Opening balance</span>
                        <span className="block text-sm text-ink-muted">
                            Stock that was already on the shelf, not a new purchase.
                        </span>
                    </span>
                </label>

                <Input
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Purchase order #123"
                    helperText="Optional"
                />

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading}>
                        {loading ? 'Adding…' : 'Add stock'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
