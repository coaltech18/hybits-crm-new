import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { hasActiveAudit, getPendingApprovalsCount } from '@/services/inventoryAuditService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
    Package,
    ArrowRight,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Wrench,
    AlertCircle,
    ClipboardCheck,
    FileText,
    BarChart3,
    Clock,
    Check,
    XCircle,
} from 'lucide-react';

// ================================================================
// INVENTORY STOCK OVERVIEW (V2 DASHBOARD)
// ================================================================
// New dashboard showing:
// - Summary cards (total, available, allocated, damaged, in repair)
// - Attention alerts with deep links
// - Recent movements feed
// - Lifecycle breakdown
// ================================================================

interface StockSummary {
    total_quantity: number;
    available_quantity: number;
    allocated_quantity: number;
    damaged_quantity: number;
    in_repair_quantity: number;
    lost_quantity: number;
}

interface AttentionItem {
    type: string;
    label: string;
    count: number;
    link: string;
    icon: React.ReactNode;
    color: string;
}

interface RecentMovement {
    id: string;
    created_at: string;
    item_name: string;
    movement_category: string;
    movement_type: string;
    quantity: number;
    reference_type: string;
    reference_name: string | null;
}

interface LifecycleCount {
    status: string;
    count: number;
    label: string;
    color: string;
}

export default function InventoryOverviewPage() {
    const { user, outlets, isAuthReady } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [summary, setSummary] = useState<StockSummary | null>(null);
    const [discontinuedSummary, setDiscontinuedSummary] = useState<StockSummary | null>(null);
    const [attention, setAttention] = useState<AttentionItem[]>([]);
    const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
    const [lifecycleCounts, setLifecycleCounts] = useState<LifecycleCount[]>([]);
    const [hasAudit, setHasAudit] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState(0);

    // Filters
    const [outletId, setOutletId] = useState('');

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
    const availableOutlets = outlets || [];

    useEffect(() => {
        if (!isAuthReady) return;
        loadOverviewData();
    }, [isAuthReady, outletId]);

    async function loadOverviewData() {
        if (!user?.id) return;

        try {
            setLoading(true);
            setError(null);

            await Promise.all([
                loadSummary(),
                loadDiscontinuedSummary(),
                loadAttentionItems(),
                loadRecentMovements(),
                loadLifecycleCounts(),
                loadAuditStatus(),
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load overview data');
        } finally {
            setLoading(false);
        }
    }

    async function loadSummary() {
        let query = supabase
            .from('inventory_stock_summary')
            .select('total_quantity, available_quantity, allocated_quantity, damaged_quantity, in_repair_quantity, lost_quantity')
            .in('lifecycle_status', ['active', 'draft']); // Only count active/draft items

        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        // Aggregate
        const totals = (data || []).reduce(
            (acc, item) => ({
                total_quantity: acc.total_quantity + (item.total_quantity || 0),
                available_quantity: acc.available_quantity + (item.available_quantity || 0),
                allocated_quantity: acc.allocated_quantity + (item.allocated_quantity || 0),
                damaged_quantity: acc.damaged_quantity + (item.damaged_quantity || 0),
                in_repair_quantity: acc.in_repair_quantity + (item.in_repair_quantity || 0),
                lost_quantity: acc.lost_quantity + (item.lost_quantity || 0),
            }),
            {
                total_quantity: 0,
                available_quantity: 0,
                allocated_quantity: 0,
                damaged_quantity: 0,
                in_repair_quantity: 0,
                lost_quantity: 0,
            }
        );

        setSummary(totals);
    }

    async function loadDiscontinuedSummary() {
        let query = supabase
            .from('inventory_stock_summary')
            .select('total_quantity, available_quantity, allocated_quantity, damaged_quantity, in_repair_quantity, lost_quantity')
            .eq('lifecycle_status', 'discontinued');

        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        // Aggregate
        const totals = (data || []).reduce(
            (acc, item) => ({
                total_quantity: acc.total_quantity + (item.total_quantity || 0),
                available_quantity: acc.available_quantity + (item.available_quantity || 0),
                allocated_quantity: acc.allocated_quantity + (item.allocated_quantity || 0),
                damaged_quantity: acc.damaged_quantity + (item.damaged_quantity || 0),
                in_repair_quantity: acc.in_repair_quantity + (item.in_repair_quantity || 0),
                lost_quantity: acc.lost_quantity + (item.lost_quantity || 0),
            }),
            {
                total_quantity: 0,
                available_quantity: 0,
                allocated_quantity: 0,
                damaged_quantity: 0,
                in_repair_quantity: 0,
                lost_quantity: 0,
            }
        );

        setDiscontinuedSummary(totals.total_quantity > 0 ? totals : null);
    }

    async function loadAttentionItems() {
        const items: AttentionItem[] = [];

        // Unlocked opening balance
        let unlockedQuery = supabase
            .from('inventory_items')
            .select('id', { count: 'exact', head: true })
            .eq('opening_balance_confirmed', false)
            .in('lifecycle_status', ['draft', 'active']);

        if (outletId) {
            unlockedQuery = unlockedQuery.eq('outlet_id', outletId);
        }

        const { count: unlockedCount } = await unlockedQuery;
        if (unlockedCount && unlockedCount > 0) {
            items.push({
                type: 'unlocked_balance',
                label: 'Items with unlocked opening balance',
                count: unlockedCount,
                link: '/inventory/items?opening_unlocked=true',
                icon: <AlertCircle className="w-5 h-5" />,
                color: 'text-yellow-600',
            });
        }

        // Outstanding allocations
        let outstandingQuery = supabase
            .from('inventory_allocations_with_details')
            .select('allocation_id', { count: 'exact', head: true })
            .gt('outstanding_quantity', 0)
            .eq('is_active', true);

        if (outletId) {
            outstandingQuery = outstandingQuery.eq('outlet_id', outletId);
        }

        const { count: outstandingCount } = await outstandingQuery;
        if (outstandingCount && outstandingCount > 0) {
            items.push({
                type: 'outstanding',
                label: 'Outstanding allocations',
                count: outstandingCount,
                link: '/inventory/allocate?outstanding=true',
                icon: <Clock className="w-5 h-5" />,
                color: 'text-blue-600',
            });
        }

        // Damaged items
        let damagedQuery = supabase
            .from('inventory_items')
            .select('id', { count: 'exact', head: true })
            .gt('damaged_quantity', 0);

        if (outletId) {
            damagedQuery = damagedQuery.eq('outlet_id', outletId);
        }

        const { count: damagedCount } = await damagedQuery;
        if (damagedCount && damagedCount > 0) {
            items.push({
                type: 'damaged',
                label: 'Items with damaged stock',
                count: damagedCount,
                link: '/inventory/items?has_damaged=true',
                icon: <AlertTriangle className="w-5 h-5" />,
                color: 'text-orange-600',
            });
        }

        // Items in repair
        let repairQuery = supabase
            .from('inventory_items')
            .select('id', { count: 'exact', head: true })
            .gt('in_repair_quantity', 0);

        if (outletId) {
            repairQuery = repairQuery.eq('outlet_id', outletId);
        }

        const { count: repairCount } = await repairQuery;
        if (repairCount && repairCount > 0) {
            items.push({
                type: 'in_repair',
                label: 'Items in repair',
                count: repairCount,
                link: '/inventory/items?in_repair=true',
                icon: <Wrench className="w-5 h-5" />,
                color: 'text-purple-600',
            });
        }

        setAttention(items);
    }

    async function loadRecentMovements() {
        // First get active item IDs
        let activeItemsQuery = supabase
            .from('inventory_items')
            .select('id')
            .in('lifecycle_status', ['active', 'draft']);

        if (outletId) {
            activeItemsQuery = activeItemsQuery.eq('outlet_id', outletId);
        }

        const { data: activeItems } = await activeItemsQuery;
        const activeItemIds = (activeItems || []).map((item: any) => item.id);

        if (activeItemIds.length === 0) {
            setRecentMovements([]);
            return;
        }

        let query = supabase
            .from('inventory_movements')
            .select(`
        id,
        created_at,
        movement_category,
        movement_type,
        quantity,
        reference_type,
        inventory_items:inventory_item_id (name)
      `)
            .in('inventory_item_id', activeItemIds)
            .order('created_at', { ascending: false })
            .limit(10);

        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        setRecentMovements(
            (data || []).map((m: any) => ({
                id: m.id,
                created_at: m.created_at,
                item_name: m.inventory_items?.name || 'Unknown',
                movement_category: m.movement_category,
                movement_type: m.movement_type,
                quantity: m.quantity,
                reference_type: m.reference_type,
                reference_name: null,
            }))
        );
    }

    async function loadLifecycleCounts() {
        let query = supabase
            .from('inventory_items')
            .select('lifecycle_status');

        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const counts: Record<string, number> = {
            draft: 0,
            active: 0,
            discontinued: 0,
            archived: 0,
        };

        (data || []).forEach((item: any) => {
            const status = item.lifecycle_status || 'active';
            counts[status] = (counts[status] || 0) + 1;
        });

        setLifecycleCounts([
            { status: 'active', count: counts.active, label: 'Active', color: 'bg-green-500' },
            { status: 'draft', count: counts.draft, label: 'Draft', color: 'bg-gray-400' },
            { status: 'discontinued', count: counts.discontinued, label: 'Discontinued', color: 'bg-yellow-500' },
            { status: 'archived', count: counts.archived, label: 'Archived', color: 'bg-red-500' },
        ]);
    }

    async function loadAuditStatus() {
        if (!user?.id) return;

        // Check if there's an active audit
        if (outletId) {
            const active = await hasActiveAudit(outletId);
            setHasAudit(active);
        }

        // Get pending approvals count (admin only)
        if (isAdmin) {
            const count = await getPendingApprovalsCount(user.id);
            setPendingApprovals(count);
        }
    }

    function formatMovementCategory(category: string): { label: string; color: string; icon: React.ReactNode } {
        switch (category) {
            case 'inflow':
                return { label: 'Stock In', color: 'text-green-600', icon: <TrendingUp className="w-4 h-4" /> };
            case 'outflow':
                return { label: 'Allocated', color: 'text-blue-600', icon: <TrendingDown className="w-4 h-4" /> };
            case 'return':
                return { label: 'Returned', color: 'text-cyan-600', icon: <ArrowRight className="w-4 h-4 rotate-180" /> };
            case 'writeoff':
                return { label: 'Write-off', color: 'text-red-600', icon: <XCircle className="w-4 h-4" /> };
            case 'adjustment':
                return { label: 'Adjustment', color: 'text-purple-600', icon: <Check className="w-4 h-4" /> };
            case 'repair':
                return { label: 'Repair', color: 'text-orange-600', icon: <Wrench className="w-4 h-4" /> };
            default:
                return { label: category, color: 'text-gray-600', icon: <Package className="w-4 h-4" /> };
        }
    }

    function formatTimeAgo(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="w-8 h-8" />
                        Inventory Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Real-time stock summary and alerts
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Outlet Filter */}
                    {showOutletFilter && availableOutlets.length > 0 && (
                        <select
                            value={outletId}
                            onChange={(e) => setOutletId(e.target.value)}
                            className="px-3 py-2 border rounded-lg"
                        >
                            <option value="">All Outlets</option>
                            {availableOutlets.map((outlet) => (
                                <option key={outlet.id} value={outlet.id}>
                                    {outlet.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Quick Links */}
                    <Link to="/inventory/items">
                        <Button variant="outline">
                            <Package className="w-4 h-4 mr-2" />
                            Items
                        </Button>
                    </Link>
                    <Link to="/inventory/reports">
                        <Button variant="outline">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Reports
                        </Button>
                    </Link>
                </div>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            {/* Audit Warning */}
            {hasAudit && (
                <Alert variant="warning" className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5" />
                    <span>
                        <strong>Audit in Progress:</strong> Stock changes may affect the ongoing audit.
                        <Link to="/inventory/audit" className="ml-2 underline">
                            View Audit
                        </Link>
                    </span>
                </Alert>
            )}

            {/* Admin: Pending Approvals */}
            {isAdmin && pendingApprovals > 0 && (
                <Alert variant="info" className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>
                        <strong>{pendingApprovals} audit{pendingApprovals > 1 ? 's' : ''}</strong> pending your approval.
                        <Link to="/inventory/audit?status=pending_approval" className="ml-2 underline font-semibold">
                            Review Now
                        </Link>
                    </span>
                </Alert>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <SummaryCard
                        label="Total Stock"
                        value={summary.total_quantity}
                        icon={<Package className="w-6 h-6" />}
                        color="bg-gray-100 text-gray-800"
                    />
                    <SummaryCard
                        label="Available"
                        value={summary.available_quantity}
                        icon={<Check className="w-6 h-6" />}
                        color="bg-green-100 text-green-800"
                    />
                    <SummaryCard
                        label="Allocated"
                        value={summary.allocated_quantity}
                        icon={<TrendingDown className="w-6 h-6" />}
                        color="bg-blue-100 text-blue-800"
                    />
                    <SummaryCard
                        label="Damaged"
                        value={summary.damaged_quantity}
                        icon={<AlertTriangle className="w-6 h-6" />}
                        color="bg-orange-100 text-orange-800"
                    />
                    <SummaryCard
                        label="In Repair"
                        value={summary.in_repair_quantity}
                        icon={<Wrench className="w-6 h-6" />}
                        color="bg-purple-100 text-purple-800"
                    />
                    <SummaryCard
                        label="Lost (Cumulative)"
                        value={summary.lost_quantity}
                        icon={<XCircle className="w-6 h-6" />}
                        color="bg-red-100 text-red-800"
                    />
                </div>
            )}

            {/* Discontinued Items Section */}
            {discontinuedSummary && (
                <Card className="bg-amber-50 border-amber-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="w-5 h-5" />
                            Discontinued Items Stock
                        </h3>
                        <Link to="/inventory/items?lifecycle_status=discontinued">
                            <Badge variant="secondary" className="cursor-pointer hover:bg-amber-200">
                                View Items →
                            </Badge>
                        </Link>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                        Stock from discontinued items. These items can no longer be allocated but may have pending returns.
                    </p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.total_quantity}</p>
                            <p className="text-xs text-amber-600">Total</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.available_quantity}</p>
                            <p className="text-xs text-amber-600">Available</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.allocated_quantity}</p>
                            <p className="text-xs text-amber-600">Allocated</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.damaged_quantity}</p>
                            <p className="text-xs text-amber-600">Damaged</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.in_repair_quantity}</p>
                            <p className="text-xs text-amber-600">In Repair</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-800">{discontinuedSummary.lost_quantity}</p>
                            <p className="text-xs text-amber-600">Lost</p>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Attention Items */}
                <Card className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            Needs Attention
                        </h3>
                        <Badge variant="secondary">{attention.length}</Badge>
                    </div>

                    {attention.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
                            <p>All clear! No items need attention.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {attention.map((item, index) => (
                                <Link
                                    key={index}
                                    to={item.link}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={item.color}>{item.icon}</span>
                                        <div>
                                            <p className="text-sm font-medium">{item.count} {item.label}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Recent Movements */}
                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Recent Movements
                        </h3>
                        <Link to="/inventory/movements" className="text-sm text-brand-primary hover:underline">
                            View All →
                        </Link>
                    </div>

                    {recentMovements.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2" />
                            <p>No movements recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentMovements.map((movement) => {
                                const categoryInfo = formatMovementCategory(movement.movement_category);
                                return (
                                    <div
                                        key={movement.id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={categoryInfo.color}>{categoryInfo.icon}</span>
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {movement.item_name}{' '}
                                                    <span className="text-muted-foreground">({movement.quantity})</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {categoryInfo.label}
                                                    {movement.reference_name && ` → ${movement.reference_name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatTimeAgo(movement.created_at)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* Lifecycle Breakdown */}
            <Card>
                <h3 className="font-semibold mb-4">Item Lifecycle Status</h3>
                <div className="flex items-center gap-4">
                    {lifecycleCounts.map((lc) => (
                        <div key={lc.status} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${lc.color}`} />
                            <span className="text-sm">
                                {lc.label}: <strong>{lc.count}</strong>
                            </span>
                        </div>
                    ))}
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-4 rounded-full overflow-hidden flex bg-gray-200">
                    {lifecycleCounts.map((lc) => {
                        const total = lifecycleCounts.reduce((acc, c) => acc + c.count, 0);
                        const width = total > 0 ? (lc.count / total) * 100 : 0;
                        return (
                            <div
                                key={lc.status}
                                className={`${lc.color} transition-all`}
                                style={{ width: `${width}%` }}
                                title={`${lc.label}: ${lc.count}`}
                            />
                        );
                    })}
                </div>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionCard
                    title="Manage Items"
                    description="View and edit inventory items"
                    icon={<Package className="w-6 h-6" />}
                    link="/inventory/items"
                />
                <QuickActionCard
                    title="Allocations"
                    description="Process returns and allocations"
                    icon={<TrendingDown className="w-6 h-6" />}
                    link="/inventory/allocate"
                />
                <QuickActionCard
                    title="Monthly Audit"
                    description="Physical count reconciliation"
                    icon={<ClipboardCheck className="w-6 h-6" />}
                    link="/inventory/audit"
                />
                <QuickActionCard
                    title="Reports"
                    description="Stock and movement reports"
                    icon={<BarChart3 className="w-6 h-6" />}
                    link="/inventory/reports"
                />
            </div>
        </div>
    );
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function SummaryCard({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <Card className={`${color} border-0`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium opacity-80">{label}</p>
                    <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                </div>
                <div className="opacity-50">{icon}</div>
            </div>
        </Card>
    );
}

function QuickActionCard({
    title,
    description,
    icon,
    link,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    link: string;
}) {
    return (
        <Link to={link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                        {icon}
                    </div>
                    <div>
                        <h4 className="font-semibold">{title}</h4>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
