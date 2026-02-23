import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getInventoryItemByIdV2, type InventoryItemV2 } from '@/services/inventoryServiceV2';
import { getInventoryMovements } from '@/services/inventoryMovementService';
import type { InventoryMovement } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { LifecycleBadge, StockBreakdown } from '@/components/inventory/InventoryV2Components';
import {
    ArrowLeft,
    Plus,
    Send,
    RotateCcw,
    AlertTriangle,
    Search,
    Trash2,
    SlidersHorizontal,
    History,
} from 'lucide-react';

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
// Phase 1 of UI simplification:
// - Shows item info, stock breakdown, and 7 action buttons
// - All actions via clean modals (no raw movement forms)
// - Movement history with friendly labels
// - Role-based button visibility
// ================================================================

// Movement category friendly labels
const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
    inflow: { label: 'Added', color: 'bg-green-100 text-green-800' },
    outflow: { label: 'Sent Out', color: 'bg-blue-100 text-blue-800' },
    return: { label: 'Returned', color: 'bg-purple-100 text-purple-800' },
    writeoff: { label: 'Written Off', color: 'bg-red-100 text-red-800' },
    adjustment: { label: 'Adjusted', color: 'bg-yellow-100 text-yellow-800' },
    repair: { label: 'Repair', color: 'bg-orange-100 text-orange-800' },
};

// Fallback for old movement_type labels
const MOVEMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    stock_in: { label: 'Added', color: 'bg-green-100 text-green-800' },
    allocation: { label: 'Sent Out', color: 'bg-blue-100 text-blue-800' },
    return: { label: 'Returned', color: 'bg-purple-100 text-purple-800' },
    damage: { label: 'Damaged', color: 'bg-orange-100 text-orange-800' },
    loss: { label: 'Lost', color: 'bg-red-100 text-red-800' },
    adjustment: { label: 'Adjusted', color: 'bg-yellow-100 text-yellow-800' },
};

export default function InventoryItemDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [item, setItem] = useState<InventoryItemV2 | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
    const isAccountant = userRole === 'accountant';
    const canAct = !isAccountant;

    useEffect(() => {
        if (user?.id && id) {
            loadItem();
            loadMovements();
        }
    }, [user?.id, id]);

    async function loadItem() {
        if (!user?.id || !id) return;

        try {
            setLoading(true);
            setError(null);
            const data = await getInventoryItemByIdV2(user.id, id);
            setItem(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load item');
        } finally {
            setLoading(false);
        }
    }

    async function loadMovements() {
        if (!user?.id || !id) return;

        try {
            setMovementsLoading(true);
            const data = await getInventoryMovements(user.id, {
                inventory_item_id: id,
            });
            setMovements(data);
        } catch (err) {
            console.error('Failed to load movements:', err);
        } finally {
            setMovementsLoading(false);
        }
    }

    function handleActionSuccess() {
        loadItem();
        loadMovements();
    }

    function getMovementLabel(movement: InventoryMovement) {
        // Try movement_category first (V2 field), fallback to movement_type
        const category = (movement as any).movement_category;
        if (category && MOVEMENT_LABELS[category]) {
            return MOVEMENT_LABELS[category];
        }
        return MOVEMENT_TYPE_LABELS[movement.movement_type] || { label: movement.movement_type, color: 'bg-gray-100 text-gray-800' };
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="space-y-4">
                <Link to="/inventory/items">
                    <Button variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Items
                    </Button>
                </Link>
                <Alert variant="error">{error || 'Item not found'}</Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back + Header */}
            <div>
                <Link to="/inventory/items" className="inline-block mb-4">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Items
                    </Button>
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">{item.name}</h1>
                            <LifecycleBadge status={item.lifecycle_status} />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                            <span>
                                <Badge variant="default">{item.category}</Badge>
                            </span>
                            {item.material && <span>Material: {item.material}</span>}
                            <span>Unit: {item.unit}</span>
                            {item.outlet_name && <span>Outlet: {item.outlet_name}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stock Summary */}
            <Card>
                <h3 className="font-semibold mb-4">Stock Summary</h3>
                <StockBreakdown
                    total={item.total_quantity}
                    available={item.available_quantity}
                    allocated={item.allocated_quantity}
                    damaged={item.damaged_quantity}
                    inRepair={item.in_repair_quantity}
                    lost={item.lost_quantity}
                />
            </Card>

            {/* Action Buttons */}
            {canAct && item.lifecycle_status !== 'archived' && (
                <Card>
                    <h3 className="font-semibold mb-4">Actions</h3>
                    <div className="flex flex-wrap gap-3">
                        {/* Add Stock */}
                        <Button
                            onClick={() => setShowAddStock(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Stock
                        </Button>

                        {/* Allocate - only for active items with available stock */}
                        {item.lifecycle_status === 'active' && item.available_quantity > 0 && (
                            <Button
                                onClick={() => setShowAllocate(true)}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Allocate
                            </Button>
                        )}

                        {/* Receive Back */}
                        {item.allocated_quantity > 0 && (
                            <Button
                                onClick={() => setShowReceiveBack(true)}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Receive Back
                            </Button>
                        )}

                        {/* Mark Damaged (Warehouse) */}
                        {item.available_quantity > 0 && (
                            <Button
                                onClick={() => setShowMarkDamaged(true)}
                                variant="outline"
                                className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                                <AlertTriangle className="w-4 h-4" />
                                Mark Damaged
                            </Button>
                        )}

                        {/* Mark Lost */}
                        {(item.available_quantity > 0 || item.allocated_quantity > 0) && (
                            <Button
                                onClick={() => setShowMarkLost(true)}
                                variant="outline"
                                className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                            >
                                <Search className="w-4 h-4" />
                                Mark Lost
                            </Button>
                        )}

                        {/* Dispose Damaged */}
                        {item.damaged_quantity > 0 && (
                            <Button
                                onClick={() => setShowDisposeDamaged(true)}
                                variant="outline"
                                className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Dispose Damaged
                            </Button>
                        )}

                        {/* Adjust Stock (Admin Only) */}
                        {isAdmin && (
                            <Button
                                onClick={() => setShowAdjustStock(true)}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                Adjust Stock
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            {/* Archived / Accountant Notice */}
            {item.lifecycle_status === 'archived' && (
                <Alert variant="warning">
                    This item is archived. No stock operations are permitted.
                </Alert>
            )}

            {isAccountant && (
                <Alert variant="info">
                    You have read-only access to inventory items.
                </Alert>
            )}

            {/* Movement History */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Movement History
                    </h3>
                    <p className="text-sm text-muted-foreground">{movements.length} movements</p>
                </div>

                {movementsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Spinner size="lg" />
                    </div>
                ) : movements.length === 0 ? (
                    <div className="text-center py-12">
                        <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No movements recorded yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b">
                                <tr>
                                    <th className="text-left py-3 px-4">Date/Time</th>
                                    <th className="text-left py-3 px-4">Action</th>
                                    <th className="text-right py-3 px-4">Quantity</th>
                                    <th className="text-left py-3 px-4">Reference</th>
                                    <th className="text-left py-3 px-4">Notes</th>
                                    <th className="text-left py-3 px-4">By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((movement) => {
                                    const label = getMovementLabel(movement);

                                    return (
                                        <tr key={movement.id} className="border-b hover:bg-muted/50">
                                            <td className="py-3 px-4 text-sm">
                                                <div>
                                                    <p>{new Date(movement.created_at).toLocaleDateString()}</p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {new Date(movement.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${label.color}`}
                                                >
                                                    {label.label}
                                                </span>
                                            </td>
                                            <td className="text-right py-3 px-4 font-semibold">{movement.quantity}</td>
                                            <td className="py-3 px-4 text-sm">
                                                {movement.reference_type !== 'manual' ? (
                                                    <div>
                                                        <Badge variant="default" className="capitalize">
                                                            {movement.reference_type}
                                                        </Badge>
                                                        {movement.reference_name && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {movement.reference_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm max-w-[200px] truncate">
                                                {movement.notes || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm">{movement.created_by_name || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

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
