import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { ChoiceGroup, FactWell, ModalActions } from '../ModalParts';
import { supabase } from '@/lib/supabase';
import { returnInventoryV2 } from '@/services/inventoryMovementServiceV2';
import type { InventoryAllocation } from '@/types';

// ================================================================
// RECEIVE BACK MODAL
// ================================================================
// Calls: returnInventoryV2()
// User selects: Good or Damaged condition
// Requires: subscription/event allocation to return against
// ================================================================

interface ReceiveBackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
}

export default function ReceiveBackModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
}: ReceiveBackModalProps) {
    const [allocations, setAllocations] = useState<InventoryAllocation[]>([]);
    const [allocationsLoading, setAllocationsLoading] = useState(false);
    const [selectedAllocationId, setSelectedAllocationId] = useState('');
    const [condition, setCondition] = useState<'good' | 'damaged'>('good');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedAllocation = allocations.find((a) => a.id === selectedAllocationId);
    const outstandingQty = selectedAllocation?.outstanding_quantity || 0;

    const loadAllocations = useCallback(async () => {
        try {
            setAllocationsLoading(true);

            // outstanding_quantity is derived and only exists on the view, which also
            // resolves reference_name (and only returns active allocations).
            const { data, error: fetchError } = await supabase
                .from('inventory_allocations_with_details')
                .select(
                    'allocation_id, outlet_id, inventory_item_id, reference_type, reference_id, reference_name, allocated_quantity, outstanding_quantity, is_active, created_at, updated_at'
                )
                .eq('inventory_item_id', itemId)
                .eq('outlet_id', outletId)
                .gt('outstanding_quantity', 0);

            if (fetchError) throw new Error(fetchError.message);

            setAllocations(
                ((data || []) as Omit<InventoryAllocation, 'id'>[]).map((row) => ({
                    ...row,
                    id: row.allocation_id as string,
                    reference_name: row.reference_name || 'Unknown',
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load allocations');
        } finally {
            setAllocationsLoading(false);
        }
    }, [itemId, outletId]);

    useEffect(() => {
        if (isOpen) {
            setSelectedAllocationId('');
            setCondition('good');
            setQuantity('');
            setNotes('');
            setError(null);
            loadAllocations();
        }
    }, [isOpen, loadAllocations]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError(null);

        if (!selectedAllocation) {
            setError('Please select an allocation to return against');
            return;
        }

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            return;
        }

        if (qty > outstandingQty) {
            setError(`Quantity cannot exceed pending return (${outstandingQty})`);
            return;
        }

        if (condition === 'damaged' && !notes.trim()) {
            setError('Notes are required when returning damaged items');
            return;
        }

        try {
            setLoading(true);

            await returnInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reference_type: selectedAllocation.reference_type as 'subscription' | 'event',
                reference_id: selectedAllocation.reference_id,
                is_damaged: condition === 'damaged',
                reason_code: condition === 'damaged' ? 'client_damage' : 'normal_return',
                notes: notes.trim() || undefined,
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process return');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Receive back"
            description="Record pieces coming back from a subscription or event."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={selectedAllocation ? [{ label: 'Still out', value: outstandingQty, tone: 'partial' }] : []}
                />

                {allocationsLoading ? (
                    <div className="space-y-3 py-2" aria-busy="true">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                    </div>
                ) : allocations.length === 0 ? (
                    <Alert variant="info">
                        None of this item is out with a client right now. Pieces can only be received back against a booking that holds them.
                    </Alert>
                ) : (
                    <>
                        <Select
                            label="Coming back from"
                            value={selectedAllocationId}
                            onChange={(e) => setSelectedAllocationId(e.target.value)}
                            required
                        >
                            <option value="">Select booking</option>
                            {allocations.map((alloc) => (
                                <option key={alloc.id} value={alloc.id}>
                                    {alloc.reference_type === 'subscription' ? 'Subscription' : 'Event'} · {alloc.reference_name} ({alloc.outstanding_quantity} out)
                                </option>
                            ))}
                        </Select>

                        <ChoiceGroup<'good' | 'damaged'>
                            legend="Condition"
                            name="return-condition"
                            value={condition}
                            onChange={setCondition}
                            options={[
                                { value: 'good', label: 'Good', hint: 'Back to available stock', tone: 'final' },
                                { value: 'damaged', label: 'Damaged', hint: 'Into damaged stock', tone: 'partial' },
                            ]}
                        />

                        <Input
                            type="number"
                            inputMode="numeric"
                            label="Pieces"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min="1"
                            max={outstandingQty}
                            required
                            disabled={!selectedAllocation}
                            placeholder={selectedAllocation ? `Up to ${outstandingQty}` : 'Select a booking first'}
                            className="tabular"
                        />

                        <Textarea
                            label="Notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={condition === 'damaged' ? 'Describe the damage' : undefined}
                            helperText={condition === 'damaged' ? 'Required for damaged pieces' : 'Optional'}
                            required={condition === 'damaged'}
                            rows={3}
                        />

                        {condition === 'damaged' && (
                            <Alert variant="warning">
                                Damaged pieces come off the booking and are added to damaged stock.
                            </Alert>
                        )}
                    </>
                )}

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={allocations.length === 0}>
                        {loading ? 'Saving…' : 'Receive back'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
