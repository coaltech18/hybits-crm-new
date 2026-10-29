import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
    getAudits,
    canCreateAudit,
    createAudit,
    type Audit,
    type AuditStatus,
} from '@/services/inventoryAuditService';
import { Card } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuditStatusBadge } from '@/components/inventory/AuditStatus';
import { ModalActions } from '@/components/inventory/ModalParts';
import { cn } from '@/utils/cn';

// ================================================================
// INVENTORY AUDIT PAGE
// ================================================================
// Main audit hub showing:
// - List of audits
// - Create new audit
// - Navigate to audit detail
// ================================================================

const AUDIT_STATUSES: AuditStatus[] = ['draft', 'counting', 'review', 'pending_approval', 'approved', 'rejected'];

function getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function InventoryAuditPage() {
    useDocumentTitle('Stock audits');
    const { user, outlets, isAuthReady } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialStatus = searchParams.get('status') as AuditStatus | null;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [audits, setAudits] = useState<Audit[]>([]);

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createOutletId, setCreateOutletId] = useState('');
    const [createPeriod, setCreatePeriod] = useState(getCurrentPeriod());
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    // False until the eligibility check for the chosen outlet + period returns
    const [canCreate, setCanCreate] = useState(false);
    const [canCreateReason, setCanCreateReason] = useState<string | null>(null);

    // Filters
    const [filterOutletId, setFilterOutletId] = useState('');
    // ?status= deep link (e.g. "Review Now" from the Overview)
    const [filterStatus, setFilterStatus] = useState<AuditStatus | ''>(
        initialStatus && AUDIT_STATUSES.includes(initialStatus) ? initialStatus : ''
    );

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const isAccountant = userRole === 'accountant';
    const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
    const availableOutlets = outlets || [];

    const loadAudits = useCallback(async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            setError(null);

            const filters: { outlet_id?: string; status?: AuditStatus } = {};
            if (filterOutletId) filters.outlet_id = filterOutletId;
            if (filterStatus) filters.status = filterStatus;

            const data = await getAudits(user.id, filters);
            setAudits(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audits');
        } finally {
            setLoading(false);
        }
    }, [user?.id, filterOutletId, filterStatus]);

    useEffect(() => {
        if (!isAuthReady) return;
        loadAudits();
    }, [isAuthReady, loadAudits]);

    useEffect(() => {
        // A new outlet/period is not eligible until its own check says so
        setCanCreate(false);
        setCanCreateReason(null);
        if (!user?.id || !createOutletId || !createPeriod) return;
        let stale = false;
        canCreateAudit(user.id, createOutletId, createPeriod)
            .then((result) => {
                if (stale) return;
                setCanCreate(result.canCreate);
                setCanCreateReason(result.reason || null);
            })
            .catch((err: unknown) => {
                if (stale) return;
                setCanCreate(false);
                setCanCreateReason(
                    `Failed to check eligibility: ${err instanceof Error ? err.message : 'unknown error'}`
                );
            });
        return () => {
            stale = true;
        };
    }, [user?.id, createOutletId, createPeriod]);

    async function handleCreateAudit() {
        if (!user?.id || !createOutletId || !createPeriod || createLoading) return;

        try {
            setCreateLoading(true);
            setCreateError(null);

            const { audit } = await createAudit(user.id, {
                outlet_id: createOutletId,
                period: createPeriod,
            });

            setShowCreateModal(false);
            navigate(`/inventory/audit/${audit.id}`);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create audit');
        } finally {
            setCreateLoading(false);
        }
    }

    function formatDate(dateString: string | null | undefined): string {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    function getPeriodLabel(period: string): string {
        const [year, month] = period.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }

    // Get available periods for dropdown (current and past 12 months)
    function getAvailablePeriods(): string[] {
        const periods: string[] = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i);
            const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            periods.push(period);
        }
        return periods;
    }

    function closeCreateModal() {
        setShowCreateModal(false);
        setCreateError(null);
    }

    const pendingCount = audits.filter((a) => a.status === 'pending_approval').length;
    const filtered = !!(filterOutletId || filterStatus);
    const firstLoad = loading && audits.length === 0;

    return (
        <div>
            <PageHeader
                title="Stock audits"
                description="Monthly physical counts, reconciled against the system and approved before stock is adjusted."
                actions={
                    !isAccountant ? (
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            New audit
                        </Button>
                    ) : undefined
                }
            />

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            {/* Pending approvals (admin) */}
            {isAdmin && pendingCount > 0 && (
                <Alert variant="warning" className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                            <strong className="font-semibold">{pendingCount}</strong> audit{pendingCount === 1 ? ' is' : 's are'}{' '}
                            waiting for your approval.
                        </span>
                        {filterStatus !== 'pending_approval' && (
                            <button
                                type="button"
                                onClick={() => setFilterStatus('pending_approval')}
                                className="font-semibold underline underline-offset-2 hover:no-underline"
                            >
                                Show only these
                            </button>
                        )}
                    </div>
                </Alert>
            )}

            {/* Filters */}
            <Card padding="sm" className="mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    {showOutletFilter && (
                        <div className="w-full sm:w-56">
                            <Select
                                label="Outlet"
                                value={filterOutletId}
                                onChange={(e) => setFilterOutletId(e.target.value)}
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

                    <div className="w-full sm:w-56">
                        <Select
                            label="Status"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as AuditStatus | '')}
                        >
                            <option value="">All statuses</option>
                            <option value="counting">Counting</option>
                            <option value="review">In review</option>
                            <option value="pending_approval">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Count line */}
            {!firstLoad && audits.length > 0 && (
                <p className="mb-3 text-sm text-ink-muted">
                    {audits.length} audit{audits.length === 1 ? '' : 's'}
                    {pendingCount > 0 && ` · ${pendingCount} awaiting approval`}
                </p>
            )}

            {/* Audits ledger */}
            <Card padding="none" className="overflow-hidden">
                {firstLoad ? (
                    <TableSkeleton rows={6} cols={showOutletFilter ? 6 : 5} />
                ) : audits.length === 0 ? (
                    <EmptyState
                        icon={ClipboardCheck}
                        title={filtered ? 'No audits match these filters' : 'No audits yet'}
                        description={
                            filtered
                                ? 'Clear a filter to see more audits.'
                                : isAccountant
                                  ? 'Audits appear here once a manager starts a monthly count.'
                                  : 'Start an audit to generate a count sheet for every active item at an outlet.'
                        }
                        action={!isAccountant && !filtered ? { label: 'Start an audit', onClick: () => setShowCreateModal(true) } : undefined}
                    />
                ) : (
                    <div className={cn('overflow-x-auto', loading && 'opacity-60 transition-opacity')} aria-busy={loading || undefined}>
                        <table className="ledger">
                            <thead>
                                <tr>
                                    <th scope="col">Period</th>
                                    {showOutletFilter && <th scope="col">Outlet</th>}
                                    <th scope="col">Status</th>
                                    <th scope="col">Counted</th>
                                    <th scope="col" className="text-right">Variance</th>
                                    <th scope="col">Started</th>
                                    <th scope="col" data-nolabel className="w-px"><span className="sr-only">Action</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {audits.map((audit) => {
                                    const inProgress = audit.status === 'counting' || audit.status === 'review';
                                    const settled = audit.status === 'approved' || audit.status === 'pending_approval';
                                    const pct = Math.max(0, Math.min(100, audit.progress_percentage || 0));
                                    return (
                                        <tr key={audit.id}>
                                            <td>
                                                <div className="inline-block max-w-full align-top">
                                                    <Link
                                                        to={`/inventory/audit/${audit.id}`}
                                                        className="serial font-semibold text-ink hover:text-brand-primary"
                                                    >
                                                        {audit.period}
                                                    </Link>
                                                    <span className="block text-xs text-ink-muted">{getPeriodLabel(audit.period)}</span>
                                                </div>
                                            </td>
                                            {showOutletFilter && (
                                                <td>
                                                    <div>
                                                        <span className="block text-ink">{audit.outlet_name}</span>
                                                        {audit.outlet_code && (
                                                            <span className="serial block text-xs text-ink-muted">{audit.outlet_code}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td>
                                                <AuditStatusBadge status={audit.status} />
                                            </td>
                                            <td>
                                                <span className="flex items-center gap-2 whitespace-nowrap">
                                                    <span className="relative block h-2 w-20 rounded-full bg-paper-sunk" aria-hidden="true">
                                                        <span
                                                            className={cn(
                                                                'absolute inset-y-0 left-0 rounded-full',
                                                                pct >= 100 ? 'bg-final' : 'bg-brand-logo'
                                                            )}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </span>
                                                    <span className="tabular text-sm text-ink-muted">
                                                        {audit.items_counted}/{audit.items_total}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                {settled ? (
                                                    <VarianceSummary plus={audit.variance_positive} minus={audit.variance_negative} />
                                                ) : (
                                                    <span className="text-ink-faint">—</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap">
                                                <div>
                                                    <span className="block text-ink">{formatDate(audit.created_at)}</span>
                                                    {audit.created_by_name && (
                                                        <span className="block text-xs text-ink-muted">by {audit.created_by_name}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                {inProgress && !isAccountant ? (
                                                    <LinkButton to={`/inventory/audit/${audit.id}`} variant="outline" size="sm">
                                                        Continue counting
                                                    </LinkButton>
                                                ) : audit.status === 'pending_approval' && isAdmin ? (
                                                    <LinkButton to={`/inventory/audit/${audit.id}`} variant="outline" size="sm">
                                                        Review
                                                    </LinkButton>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Create audit */}
            <Modal
                isOpen={showCreateModal}
                onClose={closeCreateModal}
                title="Start a stock audit"
                description="Counts one outlet's dishware for one month."
                dismissable={!createLoading}
            >
                <div className="space-y-4">
                    {createError && <Alert variant="error">{createError}</Alert>}

                    <Select
                        label="Outlet"
                        value={createOutletId}
                        onChange={(e) => setCreateOutletId(e.target.value)}
                        required
                    >
                        <option value="">Select outlet</option>
                        {availableOutlets.map((outlet) => (
                            <option key={outlet.id} value={outlet.id}>
                                {outlet.name}
                            </option>
                        ))}
                    </Select>

                    <Select
                        label="Period"
                        value={createPeriod}
                        onChange={(e) => setCreatePeriod(e.target.value)}
                        required
                    >
                        {getAvailablePeriods().map((period) => (
                            <option key={period} value={period}>
                                {getPeriodLabel(period)}
                            </option>
                        ))}
                    </Select>

                    {!canCreate && canCreateReason && <Alert variant="warning">{canCreateReason}</Alert>}

                    <div className="rounded-lg border border-rule bg-paper px-4 py-3 text-sm">
                        <p className="font-semibold text-ink">What happens next</p>
                        <ol className="mt-1.5 list-inside list-decimal space-y-1 text-ink-muted">
                            <li>A count sheet is made for every active item.</li>
                            <li>System quantities are frozen as of now.</li>
                            <li>You enter physical counts and explain each variance.</li>
                            <li>Stock is adjusted only after approval.</li>
                        </ol>
                    </div>

                    <ModalActions>
                        <Button variant="outline" type="button" onClick={closeCreateModal} disabled={createLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCreateAudit}
                            isLoading={createLoading}
                            disabled={!createOutletId || !createPeriod || !canCreate || createLoading}
                        >
                            {createLoading ? 'Starting…' : 'Start audit'}
                        </Button>
                    </ModalActions>
                </div>
            </Modal>
        </div>
    );
}

/** Surplus in green, shortage in red, a quiet zero when the count matched. */
function VarianceSummary({ plus, minus }: { plus: number; minus: number }) {
    if (plus === 0 && minus === 0) return <span className="tabular text-ink-muted">0</span>;
    return (
        <span className="tabular inline-flex items-center justify-end gap-3 font-semibold">
            {plus > 0 && <span className="text-final">+{plus}</span>}
            {minus < 0 && <span className="text-overdue">−{Math.abs(minus)}</span>}
        </span>
    );
}
