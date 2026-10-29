import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInventoryItemByIdV2, type InventoryItemV2 } from '@/services/inventoryServiceV2';
import { getInventoryMovements } from '@/services/inventoryMovementService';
import type { InventoryMovement } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/PageHeader';
import { LifecycleBadge } from '@/components/inventory/InventoryV2Components';
import { ArrowRight, Plus, Send, RotateCcw, AlertTriangle, SearchX, Trash2, SlidersHorizontal } from 'lucide-react';
import { StockStrip, MovementBadge, SignedQty, ReferenceCell } from './StockParts';
import { istWhen, pcs } from './stockDisplay';

// Action Modals
import AddStockModal from '@/components/inventory/actions/AddStockModal';
import AllocateItemModal from '@/components/inventory/actions/AllocateItemModal';
import ReceiveBackModal from '@/components/inventory/actions/ReceiveBackModal';
import MarkDamagedModal from '@/components/inventory/actions/MarkDamagedModal';
import MarkLostModal from '@/components/inventory/actions/MarkLostModal';
import DisposeDamagedModal from '@/components/inventory/actions/DisposeDamagedModal';
import AdjustStockModal from '@/components/inventory/actions/AdjustStockModal';

// ================================================================
// INVENTORY ITEM DETAIL PAGE
// ================================================================
// Item name + lifecycle → stock strip → write-off / correction
// actions → movement history ledger. Every action opens a modal;
// buttons are shown only to roles and states that can use them.
// ================================================================

const BACK = { to: '/inventory/items', label: 'Dishware items' };

export default function InventoryItemDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [item, setItem] = useState<InventoryItemV2 | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [movementsError, setMovementsError] = useState<string | null>(null);

    // Modal states
    const [showAddStock, setShowAddStock] = useState(false);
    const [showAllocate, setShowAllocate] = useState(false);
    const [showReceiveBack, setShowReceiveBack] = useState(false);
    const [showMarkDamaged, setShowMarkDamaged] = useState(false);
    const [showMarkLost, setShowMarkLost] = useState(false);
    const [showDisposeDamaged, setShowDisposeDamaged] = useState(false);
    const [showAdjustStock, setShowAdjustStock] = useState(false);

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const canAct = userRole === 'admin' || userRole === 'manager';

    useDocumentTitle(item?.name ?? 'Dishware item');

    // Only the latest request of each kind may write state (the :id can change mid-flight).
    const itemRequest = useRef(0);
    const movementsRequest = useRef(0);

    const loadItem = useCallback(async () => {
        if (!user?.id || !id) return;
        const req = ++itemRequest.current;

        try {
            setLoading(true);
            setError(null);
            const data = await getInventoryItemByIdV2(user.id, id);
            if (req === itemRequest.current) setItem(data);
        } catch (err) {
            if (req === itemRequest.current) {
                setError(err instanceof Error ? err.message : 'Failed to load item');
            }
        } finally {
            if (req === itemRequest.current) setLoading(false);
        }
    }, [user?.id, id]);

    const loadMovements = useCallback(async () => {
        if (!user?.id || !id) return;
        const req = ++movementsRequest.current;

        try {
            setMovementsLoading(true);
            const data = await getInventoryMovements(user.id, {
                inventory_item_id: id,
            });
            if (req !== movementsRequest.current) return;
            setMovements(data);
            setMovementsError(null);
        } catch (err) {
            if (req === movementsRequest.current) {
                setMovementsError(err instanceof Error ? err.message : 'Failed to load movement history');
            }
        } finally {
            if (req === movementsRequest.current) setMovementsLoading(false);
        }
    }, [user?.id, id]);

    // New :id: never show the previous item's movement history under it.
    useEffect(() => {
        setMovements([]);
        setMovementsError(null);
    }, [id]);

    useEffect(() => {
        if (user?.id && id) {
            void loadItem();
            void loadMovements();
        }
    }, [user?.id, id, loadItem, loadMovements]);

    function handleActionSuccess() {
        loadItem();
        loadMovements();
    }

    // First load (or a different item): skeleton in place of the page.
    // A refetch after an action keeps the page on screen.
    if (loading && (!item || item.id !== id)) {
        return (
            <div aria-busy="true">
                {/* Spans, not Skeleton divs: PageHeader puts these inside <h1> and <p> */}
                <PageHeader
                    back={BACK}
                    title={<span className="skeleton inline-block h-8 w-56 rounded-md align-middle" aria-hidden="true" />}
                    description={<span className="skeleton inline-block h-4 w-72 rounded-md align-middle" aria-hidden="true" />}
                />
                <StockStrip figures={null} loading label="Item stock" />
                <div className="sheet space-y-3 p-5">
                    {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5" />)}
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div>
                <PageHeader back={BACK} title="Item not available" />
                <Alert variant="error">{error || 'This item could not be found. It may belong to an outlet you can’t see.'}</Alert>
            </div>
        );
    }

    const life = item.lifecycle_status;
    const writable = canAct && life !== 'archived';
    const canAddStock = writable && (life === 'draft' || life === 'active');
    const canAllocate = writable && life === 'active' && item.available_quantity > 0;
    const canReceive = writable && item.allocated_quantity > 0;
    const canMarkDamaged = writable && item.available_quantity > 0;
    const canMarkLost = writable && (item.available_quantity > 0 || item.allocated_quantity > 0);
    const canDispose = writable && item.damaged_quantity > 0;
    // The DB accepts only returns and write-offs on discontinued items (042)
    const canAdjust = writable && isAdmin && life !== 'discontinued';
    const hasCorrections = canMarkDamaged || canMarkLost || canDispose || canAdjust;

    return (
        <div>
            <PageHeader
                back={BACK}
                title={item.name}
                meta={<LifecycleBadge status={life} />}
                description={[item.category, item.material, item.unit && `Unit: ${item.unit}`, item.outlet_name]
                    .filter(Boolean)
                    .join(' · ')}
                actions={
                    writable && (canAddStock || canAllocate || canReceive) ? (
                        <>
                            {canAddStock && (
                                <Button type="button" onClick={() => setShowAddStock(true)}>
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    Add stock
                                </Button>
                            )}
                            {canAllocate && (
                                <Button type="button" variant="outline" onClick={() => setShowAllocate(true)}>
                                    <Send className="h-4 w-4" aria-hidden="true" />
                                    Send out
                                </Button>
                            )}
                            {canReceive && (
                                <Button type="button" variant="outline" onClick={() => setShowReceiveBack(true)}>
                                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                    Record return
                                </Button>
                            )}
                        </>
                    ) : undefined
                }
            />

            {life === 'archived' && (
                <Alert variant="warning" className="mb-6">
                    This item is archived. No stock operations are permitted.
                </Alert>
            )}

            <StockStrip
                label="Item stock"
                loading={false}
                figures={{
                    total: item.total_quantity,
                    available: item.available_quantity,
                    allocated: item.allocated_quantity,
                    damaged: item.damaged_quantity,
                    inRepair: item.in_repair_quantity,
                    lost: item.lost_quantity,
                }}
                footer={
                    hasCorrections ? (
                        <div className="mt-4 flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center">
                            <span className="text-sm font-semibold text-ink-muted">Write off or correct</span>
                            <div className="flex flex-wrap gap-2">
                                {canMarkDamaged && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMarkDamaged(true)}>
                                        <AlertTriangle className="h-4 w-4 text-overdue" aria-hidden="true" />
                                        Mark damaged
                                    </Button>
                                )}
                                {canMarkLost && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMarkLost(true)}>
                                        <SearchX className="h-4 w-4 text-void" aria-hidden="true" />
                                        Mark lost
                                    </Button>
                                )}
                                {canDispose && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setShowDisposeDamaged(true)}>
                                        <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                                        Dispose damaged
                                    </Button>
                                )}
                                {canAdjust && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAdjustStock(true)}>
                                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                                        Adjust stock
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null
                }
            />

            {/* Movement history */}
            <section className="sheet overflow-hidden" aria-labelledby="history-h" aria-busy={movementsLoading || undefined}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-rule px-5 py-4">
                    <div className="min-w-0">
                        <h2 id="history-h" className="text-lg font-semibold text-ink">
                            Movement history
                            {!movementsLoading && movements.length > 0 && (
                                <span className="tabular ml-2 text-sm font-normal text-ink-muted">{pcs(movements.length)}</span>
                            )}
                        </h2>
                        <p className="text-sm text-ink-muted">
                            Newest first. + and − show the change to available stock; unsigned rows moved pieces between other buckets.
                        </p>
                    </div>
                    <Link
                        to={`/inventory/movements?item=${item.id}`}
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
                    >
                        Open in movements <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>

                {movementsError && (
                    <div className="px-5 pt-4">
                        <Alert variant="error">{movementsError}</Alert>
                    </div>
                )}

                {movementsLoading && movements.length === 0 ? (
                    <div className="space-y-3 p-5">
                        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5" />)}
                    </div>
                ) : movements.length === 0 ? (
                    !movementsError && (
                        <div className="px-5 py-12 text-center">
                            <p className="text-base font-semibold text-ink">No movements recorded yet.</p>
                            <p className="mt-1 text-sm text-ink-muted">
                                {canAddStock ? 'Add stock to record this item’s opening count.' : 'Stock added, sent out, returned or written off will appear here.'}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="ledger">
                            <thead>
                                <tr>
                                    <th scope="col">When · by</th>
                                    <th scope="col">Movement</th>
                                    <th scope="col" className="text-right">Qty</th>
                                    <th scope="col">Reference</th>
                                    <th scope="col">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((movement) => {
                                    const when = istWhen(movement.created_at);
                                    return (
                                        <tr key={movement.id}>
                                            <td className="whitespace-nowrap">
                                                <div className="inline-block max-w-full align-top">
                                                    <div className="text-ink">
                                                        {when.date} <span className="tabular text-ink-muted">{when.time}</span>
                                                    </div>
                                                    <div className="text-xs text-ink-muted">{movement.created_by_name || '—'}</div>
                                                </div>
                                            </td>
                                            <td><MovementBadge type={movement.movement_type} /></td>
                                            <td className="cell-emph text-right"><SignedQty movement={movement} /></td>
                                            <td className="min-w-[10rem]"><ReferenceCell movement={movement} /></td>
                                            <td className="max-w-[16rem] truncate text-ink-muted" title={movement.notes || undefined}>
                                                {movement.notes || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ================================================================
          ACTION MODALS
          ================================================================ */}

            {showAddStock && (
                <AddStockModal
                    isOpen={showAddStock}
                    onClose={() => setShowAddStock(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    availableQuantity={item.available_quantity}
                />
            )}

            {showAllocate && (
                <AllocateItemModal
                    isOpen={showAllocate}
                    onClose={() => setShowAllocate(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    availableQuantity={item.available_quantity}
                />
            )}

            {showReceiveBack && (
                <ReceiveBackModal
                    isOpen={showReceiveBack}
                    onClose={() => setShowReceiveBack(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                />
            )}

            {showMarkDamaged && (
                <MarkDamagedModal
                    isOpen={showMarkDamaged}
                    onClose={() => setShowMarkDamaged(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    availableQuantity={item.available_quantity}
                />
            )}

            {showMarkLost && (
                <MarkLostModal
                    isOpen={showMarkLost}
                    onClose={() => setShowMarkLost(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    availableQuantity={item.available_quantity}
                    allocatedQuantity={item.allocated_quantity}
                />
            )}

            {showDisposeDamaged && (
                <DisposeDamagedModal
                    isOpen={showDisposeDamaged}
                    onClose={() => setShowDisposeDamaged(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    damagedQuantity={item.damaged_quantity}
                />
            )}

            {showAdjustStock && (
                <AdjustStockModal
                    isOpen={showAdjustStock}
                    onClose={() => setShowAdjustStock(false)}
                    onSuccess={handleActionSuccess}
                    userId={user?.id || ''}
                    outletId={item.outlet_id}
                    itemId={item.id}
                    itemName={item.name}
                    availableQuantity={item.available_quantity}
                    totalQuantity={item.total_quantity}
                />
            )}
        </div>
    );
}
