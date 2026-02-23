import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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

    useEffect(() => {
        if (isOpen) {
            setSelectedAllocationId('');
            setCondition('good');
            setQuantity('');
            setNotes('');
            setError(null);
            loadAllocations();
        }
    }, [isOpen]);

    async function loadAllocations() {
        try {
            setAllocationsLoading(true);

            // Fetch active allocations for this item with outstanding > 0
            const { data, error: fetchError } = await supabase
                .from('inventory_allocations')
                .select(`
          id,
          outlet_id,
          inventory_item_id,
          reference_type,
          reference_id,
          allocated_quantity,
          outstanding_quantity,
          is_active,
          created_at,
          updated_at
        `)
                .eq('inventory_item_id', itemId)
                .eq('outlet_id', outletId)
                .eq('is_active', true)
                .gt('outstanding_quantity', 0);

            if (fetchError) throw new Error(fetchError.message);

            // Fetch reference names
            const allocsWithNames: InventoryAllocation[] = [];
            for (const alloc of data || []) {
                let refName = 'Unknown';

                if (alloc.reference_type === 'subscription') {
                    const { data: sub } = await supabase
                        .from('subscriptions')
                        .select('client_id, clients(name)')
                        .eq('id', alloc.reference_id)
                        .maybeSingle();
                    refName = (sub as any)?.clients?.name || 'Unknown Client';
                } else if (alloc.reference_type === 'event') {
                    const { data: evt } = await supabase
                        .from('events')
                        .select('event_name')
                        .eq('id', alloc.reference_id)
                        .maybeSingle();
                    refName = evt?.event_name || 'Unknown Event';
                }

                allocsWithNames.push({
                    ...alloc,
                    reference_name: refName,
                });
            }

            setAllocations(allocsWithNames);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load allocations');
        } finally {
            setAllocationsLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
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
            setError(`Quantity cannot exceed outstanding (${outstandingQty})`);
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
        <Modal isOpen={isOpen} onClose={onClose} title="Receive Back">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                </div>

                {allocationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner />
                    </div>
                ) : allocations.length === 0 ? (
                    <Alert variant="warning">
                        No outstanding allocations found for this item. Items can only be received back against existing allocations.
                    </Alert>
                ) : (
                    <>
                        {/* Select Allocation */}
                        <Select
                            label="Return Against"
                            value={selectedAllocationId}
                            onChange={(e) => setSelectedAllocationId(e.target.value)}
                            required
                        >
                            <option value="">Select Allocation</option>
                            {allocations.map((alloc) => (
                                <option key={alloc.id} value={alloc.id}>
                                    {alloc.reference_type === 'subscription' ? '📋' : '🎉'}{' '}
                                    {alloc.reference_name} — Outstanding: {alloc.outstanding_quantity}
                                </option>
                            ))}
                        </Select>

                        {/* Outstanding Info */}
                        {selectedAllocation && (
                            <div className="bg-orange-50 p-3 rounded">
                                <p className="text-sm text-muted-foreground">Outstanding Quantity</p>
                                <p className="text-lg font-bold text-orange-600">{outstandingQty}</p>
                            </div>
                        )}

                        {/* Condition */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Condition</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="condition"
                                        value="good"
                                        checked={condition === 'good'}
                                        onChange={() => setCondition('good')}
                                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Good Condition
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="condition"
                                        value="damaged"
                                        checked={condition === 'damaged'}
                                        onChange={() => setCondition('damaged')}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                                        Damaged
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Quantity */}
                        <Input
                            type="number"
                            label="Quantity"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min="1"
                            max={outstandingQty}
                            required
                            disabled={!selectedAllocation}
                            placeholder={selectedAllocation ? `Max: ${outstandingQty}` : 'Select an allocation first'}
                        />

                        {/* Notes */}
                        <Textarea
                            label={condition === 'damaged' ? 'Notes (required)' : 'Notes (optional)'}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={
                                condition === 'damaged'
                                    ? 'Describe the damage...'
                                    : 'Optional notes'
                            }
                            required={condition === 'damaged'}
                            rows={3}
                        />

                        {condition === 'damaged' && (
                            <Alert variant="warning">
                                Damaged items will be added to the damaged stock count and reduce allocated quantity.
                            </Alert>
                        )}
                    </>
                )}

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || allocations.length === 0}>
                        {loading ? 'Processing...' : 'Receive Back'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
