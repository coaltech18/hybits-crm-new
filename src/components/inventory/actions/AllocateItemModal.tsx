import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { FactWell, ModalActions, PickList, PickRow, PickedReference } from '../ModalParts';
import { supabase } from '@/lib/supabase';
import { ilikePattern } from '@/utils/query';
import { allocateInventoryV2 } from '@/services/inventoryMovementServiceV2';

// ================================================================
// ALLOCATE ITEM MODAL
// ================================================================
// Calls: allocateInventoryV2()
// Requires: subscription or event reference
// Hardcodes: reason_code based on reference type
// ================================================================

interface AllocateItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    outletId: string;
    itemId: string;
    itemName: string;
    availableQuantity: number;
}

interface ReferenceResult {
    id: string;
    name: string;
    status: string;
}

export default function AllocateItemModal({
    isOpen,
    onClose,
    onSuccess,
    userId,
    outletId,
    itemId,
    itemName,
    availableQuantity,
}: AllocateItemModalProps) {
    const [referenceType, setReferenceType] = useState<'subscription' | 'event' | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ReferenceResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedReference, setSelectedReference] = useState<ReferenceResult | null>(null);
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setReferenceType('');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedReference(null);
            setQuantity('');
            setNotes('');
            setError(null);
        }
    }, [isOpen]);

    // Debounced search; a stale response (older keystroke) is ignored.
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query || !referenceType) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        let stale = false;
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                let results: ReferenceResult[] = [];
                if (referenceType === 'subscription') {
                    const { data, error: fetchError } = await supabase
                        .from('subscriptions')
                        .select('id, status, clients!inner(name)')
                        .eq('outlet_id', outletId)
                        .eq('status', 'active')
                        .ilike('clients.name', ilikePattern(query))
                        .limit(10);
                    if (fetchError) throw fetchError;
                    results = (data || []).map((s) => {
                        const client = s.clients as { name?: string } | { name?: string }[] | null;
                        const name = Array.isArray(client) ? client[0]?.name : client?.name;
                        return { id: s.id, name: name || 'Unknown', status: s.status };
                    });
                } else {
                    const { data, error: fetchError } = await supabase
                        .from('events')
                        .select('id, event_name, status')
                        .eq('outlet_id', outletId)
                        .eq('status', 'planned')
                        .ilike('event_name', ilikePattern(query))
                        .limit(10);
                    if (fetchError) throw fetchError;
                    results = (data || []).map((e) => ({ id: e.id, name: e.event_name, status: e.status }));
                }
                if (!stale) setSearchResults(results);
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
    }, [searchQuery, referenceType, outletId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError(null);

        if (!referenceType) {
            setError('Please select a reference type');
            return;
        }

        if (!selectedReference) {
            setError('Please select a subscription or event');
            return;
        }

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            return;
        }

        if (qty > availableQuantity) {
            setError(`Quantity cannot exceed available stock (${availableQuantity})`);
            return;
        }

        try {
            setLoading(true);

            await allocateInventoryV2(userId, {
                outlet_id: outletId,
                inventory_item_id: itemId,
                quantity: qty,
                reference_type: referenceType,
                reference_id: selectedReference.id,
                reason_code: referenceType === 'subscription' ? 'subscription_start' : 'event_dispatch',
                notes: notes.trim() || undefined,
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to allocate');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Send dishes"
            description="Pieces move from available stock to a subscription or event."
            dismissable={!loading}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                <FactWell
                    eyebrow="Item"
                    title={itemName}
                    facts={[{ label: 'Available', value: availableQuantity, tone: 'final' }]}
                />

                <Select
                    label="Send to"
                    value={referenceType}
                    onChange={(e) => {
                        setReferenceType(e.target.value as 'subscription' | 'event' | '');
                        setSelectedReference(null);
                        setSearchQuery('');
                        setSearchResults([]);
                    }}
                    required
                >
                    <option value="">Select subscription or event</option>
                    <option value="subscription">Subscription</option>
                    <option value="event">Event</option>
                </Select>

                {referenceType && !selectedReference && (
                    <div>
                        <Input
                            type="search"
                            label={referenceType === 'subscription' ? 'Find by client name' : 'Find by event name'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Start typing…"
                            helperText={
                                referenceType === 'subscription'
                                    ? 'Active subscriptions at this outlet.'
                                    : 'Planned events at this outlet.'
                            }
                            autoComplete="off"
                        />

                        {searchLoading && (
                            <div className="mt-2 space-y-2" aria-busy="true">
                                <Skeleton className="h-9" />
                                <Skeleton className="h-9" />
                            </div>
                        )}

                        {searchResults.length > 0 && (
                            <PickList label="Matching references">
                                {searchResults.map((result) => (
                                    <PickRow
                                        key={result.id}
                                        title={result.name}
                                        meta={result.status}
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
                        kind={referenceType}
                        name={selectedReference.name}
                        onChange={() => setSelectedReference(null)}
                    />
                )}

                <Input
                    type="number"
                    inputMode="numeric"
                    label="Pieces to send"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={availableQuantity}
                    required
                    disabled={!selectedReference}
                    placeholder={selectedReference ? `Up to ${availableQuantity}` : 'Pick a subscription or event first'}
                    className="tabular"
                />

                <Input
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    helperText="Optional"
                />

                <ModalActions>
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={!selectedReference}>
                        {loading ? 'Sending…' : 'Send dishes'}
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
}
