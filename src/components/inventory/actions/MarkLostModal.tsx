import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
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

    const maxQty = lostWhere === 'warehouse' ? availableQuantity : allocatedQuantity;

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

    useEffect(() => {
        if (lostWhere === 'client' && searchQuery.trim()) {
            const timer = setTimeout(() => searchReferences(), 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, referenceType, lostWhere]);

    async function searchReferences() {
        if (!searchQuery.trim()) return;

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
                        refType: 'subscription' as const,
                    }))
                );
            } else {
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
                        refType: 'event' as const,
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

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            return;
        }

        if (qty > maxQty) {
            setError(`Quantity cannot exceed ${lostWhere === 'warehouse' ? 'available' : 'allocated'} stock (${maxQty})`);
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
        <Modal isOpen={isOpen} onClose={onClose} title="Mark Lost">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {/* Item Info */}
                <div className="bg-muted p-4 rounded">
                    <p className="text-sm text-muted-foreground">Item</p>
                    <p className="font-semibold">{itemName}</p>
                </div>

                {/* Where Lost */}
                <div>
                    <label className="block text-sm font-medium mb-2">Where was it lost?</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="lostWhere"
                                value="warehouse"
                                checked={lostWhere === 'warehouse'}
                                onChange={() => {
                                    setLostWhere('warehouse');
                                    setSelectedReference(null);
                                }}
                                className="w-4 h-4"
                            />
                            <span>Lost in Warehouse</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="lostWhere"
                                value="client"
                                checked={lostWhere === 'client'}
                                onChange={() => setLostWhere('client')}
                                className="w-4 h-4"
                            />
                            <span>Lost by Client</span>
                        </label>
                    </div>
                </div>

                {/* Max available info */}
                <div className={`p-3 rounded ${lostWhere === 'warehouse' ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <p className="text-sm text-muted-foreground">
                        {lostWhere === 'warehouse' ? 'Available Stock' : 'Allocated Stock'}
                    </p>
                    <p className={`text-lg font-bold ${lostWhere === 'warehouse' ? 'text-green-600' : 'text-brand-primary'}`}>
                        {maxQty}
                    </p>
                </div>

                {/* Client Loss - Reference Search */}
                {lostWhere === 'client' && (
                    <>
                        <Select
                            label="Reference Type"
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
                                    <div className="border rounded divide-y mt-2 max-h-36 overflow-y-auto">
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
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedReference && (
                            <div className="bg-brand-primary/10 p-3 rounded flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground capitalize">{selectedReference.refType}</p>
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
                    </>
                )}

                {/* Quantity */}
                <Input
                    type="number"
                    label="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    max={maxQty}
                    required
                    placeholder={`Max: ${maxQty}`}
                />

                {/* Notes (REQUIRED) */}
                <Textarea
                    label="Notes (required)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe the circumstances of the loss..."
                    required
                    rows={3}
                />

                <Alert variant="warning">
                    Lost items will be permanently removed from total stock count.
                </Alert>

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading} variant="destructive">
                        {loading ? 'Processing...' : 'Mark as Lost'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
