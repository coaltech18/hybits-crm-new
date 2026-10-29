import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { ChoiceGroup, FactWell, ModalActions, PickList, PickRow, PickedReference } from '../ModalParts';
import { supabase } from '@/lib/supabase';
import { ilikePattern } from '@/utils/query';
import { writeOffInventoryV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// MARK LOST MODAL
// ================================================================
// Calls: writeOffInventoryV2()
// Two modes:
//   Warehouse: reason_code = 'missing_stock', reference_type = 'manual'
//   Client: reason_code = 'client_lost', requires subscription/event ref
// Notes REQUIRED.
// ================================================================

interface MarkLostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    availableQuantity: number;
    allocatedQuantity: number;
}

interface ReferenceResult {
    id: string;
    name: string;
    refType: 'subscription' | 'event';
    outstanding: number; // outstanding_quantity of THIS item with this reference
}

export default function MarkLostModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    availableQuantity,
    allocatedQuantity,
}: MarkLostModalProps) {
    const [lostWhere, setLostWhere] = useState<'warehouse' | 'client'>('warehouse');
    const [referenceType, setReferenceType] = useState<'subscription' | 'event'>('subscription');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ReferenceResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedReference, setSelectedReference] = useState<ReferenceResult | null>(null);
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const maxQty =
        lostWhere === 'warehouse'
            ? availableQuantity
            : selectedReference
              ? selectedReference.outstanding
              : allocatedQuantity;

    useEffect(() => {
        if (isOpen) {
            setLostWhere('warehouse');
            setReferenceType('subscription');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedReference(null);
            setQuantity('');
            setNotes('');
            setError(null);
        }
    }, [isOpen]);

    // Only references that still hold this item (outstanding > 0) are listed.
    useEffect(() => {
        const query = searchQuery.trim();
        if (lostWhere !== 'client' || !query) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        let stale = false;
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('inventory_allocations_with_details')
                    .select('reference_id, reference_name, outstanding_quantity')
                    .eq('inventory_item_id', itemId)
                    .eq('outlet_id', outletId)
                    .eq('reference_type', referenceType)
                    .gt('outstanding_quantity', 0)
                    .ilike('reference_name', ilikePattern(query))
                    .limit(10);
                if (fetchError) throw fetchError;
                if (!stale) {
                    setSearchResults(
                        (data || []).map((row) => ({
                            id: row.reference_id as string,
                            name: (row.reference_name as string | null) || 'Unknown',
                            refType: referenceType,
                            outstanding: Number(row.outstanding_quantity) || 0,
                        }))
                    );
                }
            } catch (err) {
                if (!stale) {
                    setSearchResults([]);
                    setError(err instanceof Error ? err.message : 'Search failed');
                }
            } finally {
                if (!stale) setSearchLoading(false);
            }
        }, 300);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [searchQuery, referenceType, lostWhere, itemId, outletId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError(null);

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            return;
        }

        if (qty > maxQty) {
            setError(`Quantity cannot exceed ${lostWhere === 'warehouse' ? 'available stock' : 'what this client still holds'} (${maxQty})`);
            return;
        }

        if (!notes.trim()) {
            setError('Notes are required when marking items as lost');
            return;
        }

        if (lostWhere === 'client' && !selectedReference) {
            setError('Please select the subscription or event where the loss occurred');
            return;
        }

        try {
            setLoading(true);

            await writeOffInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reason_code: lostWhere === 'warehouse' ? 'missing_stock' : 'client_lost',
                reference_type: lostWhere === 'warehouse' ? 'manual' : selectedReference!.refType,
                reference_id: lostWhere === 'warehouse' ? undefined : selectedReference!.id,
                notes: notes.trim(),
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark as lost');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Mark lost"
            description="Lost pieces are removed from total stock."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[
                        {
                            label:
                                lostWhere === 'warehouse'
                                    ? 'Available'
                                    : selectedReference
                                      ? 'With this client'
                                      : 'Out (all clients)',
                            value: maxQty,
                            tone: lostWhere === 'warehouse' ? 'final' : 'info',
                        },
                    ]}
                />

                <ChoiceGroup<'warehouse' | 'client'>
                    legend="Where was it lost?"
                    name="lost-where"
                    value={lostWhere}
                    onChange={(v) => {
                        if (v === 'warehouse') {
                            setLostWhere('warehouse');
                            setSelectedReference(null);
                        } else {
                            setLostWhere('client');
                        }
                    }}
                    options={[
                        { value: 'warehouse', label: 'At the outlet', hint: 'From available stock', tone: 'overdue' },
                        { value: 'client', label: 'By a client', hint: 'From a subscription or event', tone: 'overdue' },
                    ]}
                />

                {lostWhere === 'client' && (
                    <>
                        <Select
                            label="Booking type"
                            value={referenceType}
                            onChange={(e) => {
                                setReferenceType(e.target.value as 'subscription' | 'event');
                                setSelectedReference(null);
                                setSearchQuery('');
                            }}
                        >
                            <option value="subscription">Subscription</option>
                            <option value="event">Event</option>
                        </Select>

                        {!selectedReference && (
                            <div>
                                <Input
                                    type="search"
                                    label={referenceType === 'subscription' ? 'Find by client name' : 'Find by event name'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Start typing…"
                                    helperText="Only bookings still holding this item are listed."
                                    autoComplete="off"
                                />

                                {searchLoading && (
                                    <div className="mt-2 space-y-2" aria-busy="true">
                                        <Skeleton className="h-9" />
                                        <Skeleton className="h-9" />
                                    </div>
                                )}

                                {searchResults.length > 0 && (
                                    <PickList label="Matching bookings">
                                        {searchResults.map((result) => (
                                            <PickRow
                                                key={result.id}
                                                title={result.name}
                                                meta={`${result.outstanding} still out`}
                                                onPick={() => {
                                                    setSelectedReference(result);
                                                    setSearchQuery('');
                                                    setSearchResults([]);
                                                }}
                                            />
                                        ))}
                                    </PickList>
                                )}
                            </div>
                        )}

                        {selectedReference && (
                            <PickedReference
                                kind={selectedReference.refType}
                                name={selectedReference.name}
                                onChange={() => setSelectedReference(null)}
                            />
                        )}
                    </>
                )}

                <Input
                    type="number"
                    inputMode="numeric"
                    label="Lost pieces"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={maxQty}
                    required
                    placeholder={`Up to ${maxQty}`}
                    className="tabular"
                />

                <Textarea
                    label="What happened"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe the circumstances of the loss"
                    helperText="Required"
                    required
                    rows={3}
                />

                <Alert variant="warning">
                    Lost pieces are removed from total stock for good.
                </Alert>

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} variant="danger">
                        {loading ? 'Saving…' : 'Mark lost'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
