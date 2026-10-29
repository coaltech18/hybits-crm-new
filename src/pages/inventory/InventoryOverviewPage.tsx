import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import { countActiveAudits, getPendingApprovalsCount } from '@/services/inventoryAuditService';
import { fetchAllRows } from '@/services/inventoryMovementService';
import { LinkButton } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/utils/cn';
import {
    Package,
    ArrowRight,
    AlertTriangle,
    Wrench,
    AlertCircle,
    ClipboardCheck,
    BarChart3,
    Clock,
    History,
    Send,
    type LucideIcon,
} from 'lucide-react';
import { StockStrip, MovementBadge, SignedQty } from './StockParts';
import { pcs } from './stockDisplay';
import { formatDateTime } from '@/utils/format';
import { countErrorMessage } from '@/utils/query';

// ================================================================
// INVENTORY OVERVIEW — dishware stock at a glance.
// Stock strip (where every piece is) → what needs attention
// → the latest movements. Every figure comes from the DB.
// ================================================================

interface StockSummary {
    total_quantity: number;
    available_quantity: number;
    allocated_quantity: number;
    damaged_quantity: number;
    in_repair_quantity: number;
    lost_quantity: number;
}

type Tone = 'draft' | 'partial' | 'overdue' | 'info';

interface AttentionItem {
    type: string;
    label: string;
    count: number;
    link: string;
    icon: LucideIcon;
    tone: Tone;
}

interface RecentMovement {
    id: string;
    created_at: string;
    item_name: string;
    movement_category: string;
    movement_type: string;
    quantity: number;
    reference_type: string;
    reason_code: string | null;
}

// One line of guidance per attention row (presentation only).
const ATTENTION_DETAIL: Record<string, string> = {
    unlocked_balance: 'The opening count locks on the first dispatch. Check it before stock goes out.',
    outstanding: 'Allocations with pieces still at a client or event. Opens the allocation report.',
    damaged: 'Dispose of damaged pieces from each item’s page.',
    in_repair: 'Pieces out for repair still count in total stock.',
};

export default function InventoryOverviewPage() {
    useDocumentTitle('Dishware stock');
    const { user, outlets, isAuthReady } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [summary, setSummary] = useState<StockSummary | null>(null);
    const [discontinuedSummary, setDiscontinuedSummary] = useState<StockSummary | null>(null);
    const [attention, setAttention] = useState<AttentionItem[]>([]);
    const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
    const [hasAudit, setHasAudit] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState(0);

    // Filters
    const [outletId, setOutletId] = useState('');

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const canSendReceive = userRole === 'admin' || userRole === 'manager';
    const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
    const availableOutlets = outlets || [];

    // Only the latest load may write state (fast outlet switching).
    const requestId = useRef(0);

    const loadOverviewData = useCallback(async () => {
        if (!user?.id) return;
        const req = ++requestId.current;

        const emptyTotals = (): StockSummary => ({
            total_quantity: 0,
            available_quantity: 0,
            allocated_quantity: 0,
            damaged_quantity: 0,
            in_repair_quantity: 0,
            lost_quantity: 0,
        });

        async function sumStock(lifecycle: string[]): Promise<StockSummary> {
            const rows = await fetchAllRows<StockSummary>((from, to) => {
                let query = supabase
                    .from('inventory_stock_summary')
                    .select('total_quantity, available_quantity, allocated_quantity, damaged_quantity, in_repair_quantity, lost_quantity')
                    .in('lifecycle_status', lifecycle)
                    .order('item_id');
                if (outletId) query = query.eq('outlet_id', outletId);
                return query.range(from, to);
            });
            return rows.reduce(
                (acc, item) => ({
                    total_quantity: acc.total_quantity + (item.total_quantity || 0),
                    available_quantity: acc.available_quantity + (item.available_quantity || 0),
                    allocated_quantity: acc.allocated_quantity + (item.allocated_quantity || 0),
                    damaged_quantity: acc.damaged_quantity + (item.damaged_quantity || 0),
                    in_repair_quantity: acc.in_repair_quantity + (item.in_repair_quantity || 0),
                    lost_quantity: acc.lost_quantity + (item.lost_quantity || 0),
                }),
                emptyTotals()
            );
        }

        async function loadSummary() {
            return sumStock(['active', 'draft']); // Only count active/draft items
        }

        async function loadDiscontinuedSummary() {
            const totals = await sumStock(['discontinued']);
            return totals.total_quantity > 0 ? totals : null;
        }

        async function countOf(
            query: PromiseLike<{ count: number | null; error: { message: string } | null; status: number }>,
            thing: string
        ): Promise<number> {
            const { count, error: countError, status } = await query;
            if (countError) throw new Error(countErrorMessage(countError, status, thing));
            return count ?? 0;
        }

        async function loadAttentionItems() {
            const itemCount = () => {
                let q = supabase
                    .from('inventory_items')
                    .select('id', { count: 'exact', head: true })
                    .in('lifecycle_status', ['draft', 'active']); // same scope as the summary tiles
                if (outletId) q = q.eq('outlet_id', outletId);
                return q;
            };

            let outstandingQuery = supabase
                .from('inventory_allocations_with_details')
                .select('allocation_id', { count: 'exact', head: true })
                .gt('outstanding_quantity', 0)
                .eq('is_active', true);
            if (outletId) outstandingQuery = outstandingQuery.eq('outlet_id', outletId);

            const [unlockedCount, outstandingCount, damagedCount, repairCount] = await Promise.all([
                countOf(itemCount().eq('opening_balance_confirmed', false), 'unlocked items'),
                countOf(outstandingQuery, 'outstanding allocations'),
                countOf(itemCount().gt('damaged_quantity', 0), 'damaged items'),
                countOf(itemCount().gt('in_repair_quantity', 0), 'items in repair'),
            ]);

            const items: AttentionItem[] = [];
            if (unlockedCount > 0) {
                items.push({
                    type: 'unlocked_balance',
                    label: unlockedCount === 1 ? 'item with an unlocked opening balance' : 'items with an unlocked opening balance',
                    count: unlockedCount,
                    link: '/inventory/items?opening_unlocked=true',
                    icon: AlertCircle,
                    tone: 'draft',
                });
            }
            if (outstandingCount > 0) {
                items.push({
                    type: 'outstanding',
                    label: outstandingCount === 1 ? 'pending return' : 'pending returns',
                    count: outstandingCount,
                    // The Allocation report lists every outstanding allocation and is open to all roles.
                    link: '/inventory/reports?tab=allocation',
                    icon: Clock,
                    tone: 'partial',
                });
            }
            if (damagedCount > 0) {
                items.push({
                    type: 'damaged',
                    label: damagedCount === 1 ? 'item with damaged stock' : 'items with damaged stock',
                    count: damagedCount,
                    link: '/inventory/items?has_damaged=true',
                    icon: AlertTriangle,
                    tone: 'overdue',
                });
            }
            if (repairCount > 0) {
                items.push({
                    type: 'in_repair',
                    label: repairCount === 1 ? 'item in repair' : 'items in repair',
                    count: repairCount,
                    link: '/inventory/items?in_repair=true',
                    icon: Wrench,
                    tone: 'info',
                });
            }
            return items;
        }

        async function loadRecentMovements() {
            // Inner-join filter on the item's lifecycle instead of a huge .in() id list.
            let query = supabase
                .from('inventory_movements')
                .select(`
        id,
        created_at,
        movement_category,
        movement_type,
        quantity,
        reference_type,
        reason_code,
        inventory_items!inner (name, lifecycle_status)
      `)
                .in('inventory_items.lifecycle_status', ['active', 'draft'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (outletId) {
                query = query.eq('outlet_id', outletId);
            }

            const { data, error: fetchError } = await query;
            if (fetchError) throw new Error(fetchError.message);

            type Row = {
                id: string;
                created_at: string;
                movement_category: string;
                movement_type: string;
                quantity: number;
                reference_type: string;
                reason_code: string | null;
                inventory_items: { name?: string } | { name?: string }[] | null;
            };
            return ((data || []) as Row[]).map((m): RecentMovement => {
                const item = Array.isArray(m.inventory_items) ? m.inventory_items[0] : m.inventory_items;
                return {
                    id: m.id,
                    created_at: m.created_at,
                    item_name: item?.name || 'Unknown',
                    movement_category: m.movement_category,
                    movement_type: m.movement_type,
                    quantity: m.quantity,
                    reference_type: m.reference_type,
                    reason_code: m.reason_code ?? null,
                };
            });
        }

        async function loadAuditStatus() {
            // RLS scopes managers to their outlets, so this also works with no outlet selected.
            const [activeAudits, approvals] = await Promise.all([
                countActiveAudits(outletId || undefined),
                // Pending approvals (admin only), for the same outlet scope as the rest of the page
                isAdmin ? getPendingApprovalsCount(outletId || undefined) : Promise.resolve(0),
            ]);
            return { hasAudit: activeAudits > 0, pendingApprovals: approvals };
        }

        try {
            setLoading(true);
            setError(null);

            const [summaryTotals, discontinued, attentionItems, movements, audit] = await Promise.all([
                loadSummary(),
                loadDiscontinuedSummary(),
                loadAttentionItems(),
                loadRecentMovements(),
                loadAuditStatus(),
            ]);
            if (req !== requestId.current) return;

            setSummary(summaryTotals);
            setDiscontinuedSummary(discontinued);
            setAttention(attentionItems);
            setRecentMovements(movements);
            setHasAudit(audit.hasAudit);
            setPendingApprovals(audit.pendingApprovals);
        } catch (err) {
            if (req !== requestId.current) return;
            // Never leave the previous outlet's figures under a failed load
            setSummary(null);
            setDiscontinuedSummary(null);
            setAttention([]);
            setRecentMovements([]);
            setHasAudit(false);
            setPendingApprovals(0);
            setError(err instanceof Error ? err.message : 'Failed to load overview data');
        } finally {
            if (req === requestId.current) setLoading(false);
        }
    }, [user?.id, outletId, isAdmin]);

    useEffect(() => {
        if (!isAuthReady) return;
        loadOverviewData();
    }, [isAuthReady, loadOverviewData]);

    function formatTimeAgo(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    }

    const showApprovals = isAdmin && pendingApprovals > 0;
    const scope = outletId
        ? availableOutlets.find((o) => o.id === outletId)?.name ?? 'One outlet'
        : userRole === 'manager'
            ? availableOutlets.length === 1
                ? availableOutlets[0].name
                : `${availableOutlets.length} outlets`
            : 'All outlets';

    return (
        <div>
            <PageHeader
                title="Dishware stock"
                description={`Where every piece is right now · ${scope}`}
                actions={
                    <>
                        {canSendReceive && (
                            <LinkButton to="/inventory/allocate">
                                <Send className="h-4 w-4" aria-hidden="true" />
                                Send dishes
                            </LinkButton>
                        )}
                        <LinkButton to="/inventory/items" variant="outline">
                            <Package className="h-4 w-4" aria-hidden="true" />
                            Items
                        </LinkButton>
                        {showOutletFilter && availableOutlets.length > 0 && (
                            <div className="w-full sm:w-52">
                                <Select
                                    aria-label="Outlet"
                                    value={outletId}
                                    onChange={(e) => setOutletId(e.target.value)}
                                >
                                    <option value="">All outlets</option>
                                    {availableOutlets.map((outlet) => (
                                        <option key={outlet.id} value={outlet.id}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </>
                }
            />

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            {hasAudit && (
                <Alert variant="warning" className="mb-6">
                    <strong className="font-semibold">An audit is in progress.</strong> Stock changes now may affect its count.{' '}
                    <Link to="/inventory/audit" className="font-semibold underline">
                        View audit
                    </Link>
                </Alert>
            )}

            <StockStrip
                label="Stock figures"
                loading={loading}
                figures={
                    summary && {
                        total: summary.total_quantity,
                        available: summary.available_quantity,
                        allocated: summary.allocated_quantity,
                        damaged: summary.damaged_quantity,
                        inRepair: summary.in_repair_quantity,
                        lost: summary.lost_quantity,
                    }
                }
                footer={
                    !loading && discontinuedSummary ? (
                        <p className="mt-3 border-t border-rule pt-3 text-sm text-ink-muted">
                            Not counted above:{' '}
                            <span className="tabular font-semibold text-ink">{pcs(discontinuedSummary.total_quantity)} pieces</span> of
                            discontinued items. They can’t be sent out but may still be coming back.{' '}
                            <Link
                                to="/inventory/items?lifecycle_status=discontinued"
                                className="whitespace-nowrap font-semibold text-brand-primary hover:underline"
                            >
                                View discontinued items
                            </Link>
                        </p>
                    ) : null
                }
            />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                {/* Recent movements ledger */}
                <section className="sheet overflow-hidden" aria-labelledby="recent-h">
                    <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4">
                        <div>
                            <h2 id="recent-h" className="text-lg font-semibold text-ink">Recent movements</h2>
                            <p className="text-sm text-ink-muted">The last 10. + and − show the change to available stock.</p>
                        </div>
                        <Link
                            to="/inventory/movements"
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
                        >
                            All movements <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="space-y-3 p-5">
                            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5" />)}
                        </div>
                    ) : recentMovements.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <p className="text-base font-semibold text-ink">No movements recorded yet.</p>
                            <p className="mt-1 text-sm text-ink-muted">
                                Stock added, sent out, returned or written off will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="ledger">
                                <thead>
                                    <tr>
                                        <th scope="col">Item</th>
                                        <th scope="col">Movement</th>
                                        <th scope="col" className="text-right">Qty</th>
                                        <th scope="col" className="text-right">When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentMovements.map((movement) => (
                                        <tr key={movement.id}>
                                            <td className="max-w-[16rem] truncate font-semibold text-ink">{movement.item_name}</td>
                                            <td><MovementBadge type={movement.movement_type} /></td>
                                            <td className="text-right"><SignedQty movement={movement} /></td>
                                            <td className="whitespace-nowrap text-right text-ink-muted">
                                                <time dateTime={movement.created_at} title={formatDateTime(movement.created_at)}>
                                                    {formatTimeAgo(movement.created_at)}
                                                </time>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className="space-y-6">
                    {/* Needs attention */}
                    <section className="sheet" aria-labelledby="attention-h">
                        <h2 id="attention-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">
                            Needs attention
                        </h2>
                        {loading ? (
                            <div className="space-y-3 p-5">
                                {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-5" />)}
                            </div>
                        ) : attention.length === 0 && !showApprovals ? (
                            <div className="px-5 py-8 text-center">
                                <p className="text-sm font-semibold text-final">Nothing needs attention.</p>
                                <p className="mt-1 text-sm text-ink-muted">
                                    Pending returns, damaged stock and unlocked opening balances show up here.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-rule">
                                {showApprovals && (
                                    <NextItem
                                        to="/inventory/audit?status=pending_approval"
                                        icon={ClipboardCheck}
                                        title={`${pcs(pendingApprovals)} audit${pendingApprovals > 1 ? 's' : ''} waiting for your approval`}
                                        detail="Review the counts, then approve or reject."
                                        tone="draft"
                                    />
                                )}
                                {attention.map((item) => (
                                    <NextItem
                                        key={item.type}
                                        to={item.link}
                                        icon={item.icon}
                                        title={`${pcs(item.count)} ${item.label}`}
                                        detail={ATTENTION_DETAIL[item.type] ?? ''}
                                        tone={item.tone}
                                    />
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Stock books */}
                    <nav className="sheet" aria-labelledby="books-h">
                        <h2 id="books-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">
                            Stock books
                        </h2>
                        <ul className="divide-y divide-rule">
                            <BookLink to="/inventory/items" icon={Package} title="Items" detail="Every dishware item and its stock" />
                            {canSendReceive && (
                                <BookLink to="/inventory/allocate" icon={Send} title="Send and receive" detail="Send dishes out and record returns" />
                            )}
                            <BookLink to="/inventory/movements" icon={History} title="Movements" detail="The full stock ledger" />
                            <BookLink to="/inventory/audit" icon={ClipboardCheck} title="Monthly audit" detail="Physical count reconciliation" />
                            <BookLink to="/inventory/reports" icon={BarChart3} title="Reports" detail="Stock, allocation and loss reports" />
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    );
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function NextItem({
    to,
    icon: Icon,
    title,
    detail,
    tone,
}: {
    to: string;
    icon: LucideIcon;
    title: string;
    detail: string;
    tone: Tone;
}) {
    return (
        <li>
            <Link to={to} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper">
                <span
                    className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        tone === 'draft' && 'border-draft-rule bg-draft-tint text-draft',
                        tone === 'partial' && 'border-partial-rule bg-partial-tint text-partial',
                        tone === 'overdue' && 'border-overdue-rule bg-overdue-tint text-overdue',
                        tone === 'info' && 'border-info-rule bg-info-tint text-info'
                    )}
                >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    {detail && <span className="block text-sm text-ink-muted">{detail}</span>}
                </span>
                <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary"
                    aria-hidden="true"
                />
            </Link>
        </li>
    );
}

function BookLink({ to, icon: Icon, title, detail }: { to: string; icon: LucideIcon; title: string; detail: string }) {
    return (
        <li>
            <Link to={to} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper">
                <Icon className="h-[18px] w-[18px] shrink-0 text-ink-muted group-hover:text-brand-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink group-hover:text-brand-primary">{title}</span>
                    <span className="block truncate text-sm text-ink-muted">{detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </Link>
        </li>
    );
}
