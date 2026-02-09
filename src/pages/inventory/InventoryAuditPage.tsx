import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAudits,
    canCreateAudit,
    createAudit,
    type Audit,
    type AuditStatus,
} from '@/services/inventoryAuditService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
    ClipboardCheck,
    Plus,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    FileText,
    Calendar,
} from 'lucide-react';

// ================================================================
// INVENTORY AUDIT PAGE
// ================================================================
// Main audit hub showing:
// - List of audits
// - Create new audit
// - Navigate to audit detail
// ================================================================

export default function InventoryAuditPage() {
    const { user, outlets, isAuthReady } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [audits, setAudits] = useState<Audit[]>([]);

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createOutletId, setCreateOutletId] = useState('');
    const [createPeriod, setCreatePeriod] = useState(getCurrentPeriod());
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [canCreate, setCanCreate] = useState(true);
    const [canCreateReason, setCanCreateReason] = useState<string | null>(null);

    // Filters
    const [filterOutletId, setFilterOutletId] = useState('');
    const [filterStatus, setFilterStatus] = useState<AuditStatus | ''>('');

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const isAccountant = userRole === 'accountant';
    const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
    const availableOutlets = outlets || [];

    useEffect(() => {
        if (!isAuthReady) return;
        loadAudits();
    }, [isAuthReady, filterOutletId, filterStatus]);

    useEffect(() => {
        if (createOutletId && createPeriod) {
            checkCanCreate();
        }
    }, [createOutletId, createPeriod]);

    function getCurrentPeriod(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    async function loadAudits() {
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
    }

    async function checkCanCreate() {
        if (!user?.id || !createOutletId || !createPeriod) return;

        try {
            const result = await canCreateAudit(user.id, createOutletId, createPeriod);
            setCanCreate(result.canCreate);
            setCanCreateReason(result.reason || null);
        } catch (err) {
            setCanCreate(false);
            setCanCreateReason('Failed to check eligibility');
        }
    }

    async function handleCreateAudit() {
        if (!user?.id || !createOutletId || !createPeriod) return;

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

    function getStatusBadge(status: AuditStatus) {
        switch (status) {
            case 'draft':
                return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Draft</Badge>;
            case 'counting':
                return <Badge variant="default" className="bg-blue-500"><Clock className="w-3 h-3 mr-1" /> Counting</Badge>;
            case 'review':
                return <Badge variant="default" className="bg-purple-500"><Eye className="w-3 h-3 mr-1" /> Review</Badge>;
            case 'pending_approval':
                return <Badge variant="default" className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" /> Pending Approval</Badge>;
            case 'approved':
                return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
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

    if (loading && audits.length === 0) {
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
                        <ClipboardCheck className="w-8 h-8" />
                        Monthly Audit
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Physical count reconciliation and stock adjustments
                    </p>
                </div>

                {!isAccountant && (
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Audit
                    </Button>
                )}
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            {/* Pending Approvals Alert (Admin) */}
            {isAdmin && audits.filter((a) => a.status === 'pending_approval').length > 0 && (
                <Alert variant="warning" className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>
                        <strong>{audits.filter((a) => a.status === 'pending_approval').length}</strong> audit(s)
                        pending your approval with negative variances.
                    </span>
                </Alert>
            )}

            {/* Filters */}
            <Card>
                <h3 className="font-semibold mb-4">Filters</h3>
                <div className="flex flex-wrap gap-4">
                    {showOutletFilter && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Outlet</label>
                            <select
                                value={filterOutletId}
                                onChange={(e) => setFilterOutletId(e.target.value)}
                                className="px-3 py-2 border rounded-lg min-w-[200px]"
                            >
                                <option value="">All Outlets</option>
                                {availableOutlets.map((outlet) => (
                                    <option key={outlet.id} value={outlet.id}>
                                        {outlet.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as AuditStatus | '')}
                            className="px-3 py-2 border rounded-lg min-w-[200px]"
                        >
                            <option value="">All Statuses</option>
                            <option value="counting">Counting</option>
                            <option value="review">Review</option>
                            <option value="pending_approval">Pending Approval</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Audits List */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Audits</h3>
                    <p className="text-sm text-muted-foreground">{audits.length} audit(s)</p>
                </div>

                {audits.length === 0 ? (
                    <div className="text-center py-12">
                        <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No audits found</p>
                        {!isAccountant && (
                            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                                <Plus className="w-4 h-4 mr-2" />
                                Start First Audit
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b">
                                <tr>
                                    <th className="text-left py-3 px-4">Period</th>
                                    {showOutletFilter && <th className="text-left py-3 px-4">Outlet</th>}
                                    <th className="text-center py-3 px-4">Status</th>
                                    <th className="text-center py-3 px-4">Progress</th>
                                    <th className="text-right py-3 px-4">Variance (+/-)</th>
                                    <th className="text-left py-3 px-4">Created</th>
                                    <th className="text-center py-3 px-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {audits.map((audit) => (
                                    <tr key={audit.id} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                                <span className="font-medium">{getPeriodLabel(audit.period)}</span>
                                            </div>
                                        </td>
                                        {showOutletFilter && (
                                            <td className="py-3 px-4 text-sm">{audit.outlet_name}</td>
                                        )}
                                        <td className="py-3 px-4 text-center">
                                            {getStatusBadge(audit.status)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                                                    <div
                                                        className="h-full bg-brand-primary transition-all"
                                                        style={{ width: `${audit.progress_percentage || 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {audit.items_counted}/{audit.items_total}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            {audit.status === 'approved' || audit.status === 'pending_approval' ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    {audit.variance_positive > 0 && (
                                                        <span className="text-green-600">+{audit.variance_positive}</span>
                                                    )}
                                                    {audit.variance_negative < 0 && (
                                                        <span className="text-red-600">{audit.variance_negative}</span>
                                                    )}
                                                    {audit.variance_positive === 0 && audit.variance_negative === 0 && (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            <div>
                                                <p>{formatDate(audit.created_at)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    by {audit.created_by_name}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <Link to={`/inventory/audit/${audit.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    {audit.status === 'counting' || audit.status === 'review' ? 'Continue' : 'View'}
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Create Audit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5" />
                            Start New Audit
                        </h3>

                        {createError && <Alert variant="error" className="mb-4">{createError}</Alert>}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Outlet <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={createOutletId}
                                    onChange={(e) => setCreateOutletId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    required
                                >
                                    <option value="">Select Outlet</option>
                                    {availableOutlets.map((outlet) => (
                                        <option key={outlet.id} value={outlet.id}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Period <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={createPeriod}
                                    onChange={(e) => setCreatePeriod(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    required
                                >
                                    {getAvailablePeriods().map((period) => (
                                        <option key={period} value={period}>
                                            {getPeriodLabel(period)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {!canCreate && canCreateReason && (
                                <Alert variant="warning" className="text-sm">
                                    {canCreateReason}
                                </Alert>
                            )}

                            <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                <p className="font-medium mb-1">What happens:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                    <li>A count sheet is generated for all active items</li>
                                    <li>System quantities are snapshotted</li>
                                    <li>You can enter physical counts and review variances</li>
                                    <li>Adjustments are created only after approval</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setCreateError(null);
                                }}
                                disabled={createLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateAudit}
                                disabled={!createOutletId || !createPeriod || !canCreate || createLoading}
                            >
                                {createLoading ? 'Creating...' : 'Start Audit'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
