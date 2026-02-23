import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
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

    useEffect(() => {
        if (searchQuery.trim() && referenceType) {
            const timer = setTimeout(() => searchReferences(), 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, referenceType]);

    async function searchReferences() {
        if (!searchQuery.trim() || !referenceType) return;

        try {
            setSearchLoading(true);

            if (referenceType === 'subscription') {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('id, client_id, outlet_id, status, clients(name)')
                    .eq('outlet_id', outletId)
                    .eq('is_active', true)
                    .not('clients', 'is', null)
                    .limit(10);

                const filtered = (data || []).filter(
                    (s: any) => s.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                );

                setSearchResults(
                    filtered.map((s: any) => ({
                        id: s.id,
                        name: s.clients?.name || 'Unknown',
                        status: s.status,
                    }))
                );
            } else if (referenceType === 'event') {
                const { data } = await supabase
                    .from('events')
                    .select('id, event_name, outlet_id, status')
                    .eq('outlet_id', outletId)
                    .ilike('event_name', `%${searchQuery}%`)
                    .eq('is_active', true)
                    .limit(10);

                setSearchResults(
                    (data || []).map((e: any) => ({
                        id: e.id,
                        name: e.event_name,
                        status: e.status,
                    }))
                );
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setSearchLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
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
        <Modal isOpen={isOpen} onClose={onClose} title="Allocate Items">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                    <p className="text-sm text-muted-foreground mt-2">Available Stock</p>
                    <p className="text-lg font-bold text-green-600">{availableQuantity}</p>
                </div>

                {/* Reference Type */}
                <Select
                    label="Allocate To"
                    value={referenceType}
                    onChange={(e) => {
                        setReferenceType(e.target.value as 'subscription' | 'event' | '');
                        setSelectedReference(null);
                        setSearchQuery('');
                        setSearchResults([]);
                    }}
                    required
                >
                    <option value="">Select Type</option>
                    <option value="subscription">Subscription</option>
                    <option value="event">Event</option>
                </Select>

                {/* Reference Search */}
                {referenceType && !selectedReference && (
                    <div>
                        <Input
                            label={referenceType === 'subscription' ? 'Search by client name' : 'Search by event name'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Type to search..."
                        />

                        {searchLoading && (
                            <div className="flex items-center justify-center py-4">
                                <Spinner />
                            </div>
                        )}

                        {searchResults.length > 0 && (
                            <div className="border rounded divide-y mt-2 max-h-48 overflow-y-auto">
                                {searchResults.map((result) => (
                                    <button
                                        type="button"
                                        key={result.id}
                                        onClick={() => {
                                            setSelectedReference(result);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                        className="w-full text-left p-3 hover:bg-muted transition-colors text-sm"
                                    >
                                        <p className="font-medium">{result.name}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{result.status}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Selected Reference */}
                {selectedReference && (
                    <div className="bg-brand-primary/10 p-3 rounded flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground capitalize">{referenceType}</p>
                            <p className="font-medium">{selectedReference.name}</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReference(null)}
                        >
                            Change
                        </Button>
                    </div>
                )}

                {/* Quantity */}
                <Input
                    type="number"
                    label="Quantity to Allocate"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={availableQuantity}
                    required
                    disabled={!selectedReference}
                    placeholder={selectedReference ? `Max: ${availableQuantity}` : 'Select a reference first'}
                />

                {/* Notes */}
                <Input
                    label="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                />

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !selectedReference}>
                        {loading ? 'Allocating...' : 'Allocate'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
