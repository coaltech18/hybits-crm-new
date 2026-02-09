import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAuditById,
    getAuditLineItems,
    updateCount,
    updateVarianceReason,
    submitAudit,
    approveAudit,
    cancelAudit,
    getReasonCodesForVariance,
    type Audit,
    type AuditLineItem,
} from '@/services/inventoryAuditService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
    ClipboardCheck,
    ArrowLeft,
    Save,
    Send,
    CheckCircle,
    XCircle,
    AlertTriangle,
    AlertCircle,
    Minus,
    Plus,
    Eye,
    FileText,
} from 'lucide-react';

// ================================================================
// AUDIT DETAIL PAGE
// ================================================================
// Shows count sheet for a specific audit:
// - Enter physical counts
// - Review variances
// - Add reasons for variances
// - Submit for approval
// - Admin approval actions
// ================================================================

export default function InventoryAuditDetailPage() {
    const { id: auditId } = useParams<{ id: string }>();
    const { user, isAuthReady } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [audit, setAudit] = useState<Audit | null>(null);
    const [lineItems, setLineItems] = useState<AuditLineItem[]>([]);

    // Local edits (before saving)
    const [editedCounts, setEditedCounts] = useState<Record<string, number | null>>({});
    const [editedReasons, setEditedReasons] = useState<Record<string, { reason_code: string; notes: string }>>({});

    // Submit / Approval state
    const [submitting, setSubmitting] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const isAccountant = userRole === 'accountant';

    // Computed
    const isEditable = audit && ['counting', 'review'].includes(audit.status);
    const canApprove = audit && audit.status === 'pending_approval' && isAdmin;

    // Summary calculations
    const summary = useMemo(() => {
        let counted = 0;
        let positiveVariance = 0;
        let negativeVariance = 0;
        let noVariance = 0;
        let needsReason = 0;

        lineItems.forEach((item) => {
            const physicalQty = editedCounts[item.id] ?? item.physical_quantity;

            if (physicalQty !== null && physicalQty !== undefined) {
                counted++;
                const variance = physicalQty - item.system_quantity;

                if (variance > 0) {
                    positiveVariance += variance;
                } else if (variance < 0) {
                    negativeVariance += variance;
                } else {
                    noVariance++;
                }

                // Check if variance needs a reason
                if (variance !== 0) {
                    const reason = editedReasons[item.id] || { reason_code: item.reason_code || '', notes: item.notes || '' };
                    if (!reason.reason_code) {
                        needsReason++;
                    }
                }
            }
        });

        return {
            total: lineItems.length,
            counted,
            positiveVariance,
            negativeVariance,
            noVariance,
            needsReason,
            allCounted: counted === lineItems.length,
            allReasoned: needsReason === 0,
            hasNegative: negativeVariance < 0,
        };
    }, [lineItems, editedCounts, editedReasons]);

    useEffect(() => {
        if (!isAuthReady || !auditId) return;
        loadAuditData();
    }, [isAuthReady, auditId]);

    async function loadAuditData() {
        if (!user?.id || !auditId) return;

        try {
            setLoading(true);
            setError(null);

            const [auditData, lineItemsData] = await Promise.all([
                getAuditById(user.id, auditId),
                getAuditLineItems(user.id, auditId),
            ]);

            setAudit(auditData);
            setLineItems(lineItemsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit');
        } finally {
            setLoading(false);
        }
    }

    function handleCountChange(itemId: string, value: string) {
        const numValue = value === '' ? null : parseInt(value, 10);
        if (numValue !== null && (isNaN(numValue) || numValue < 0)) return;

        setEditedCounts((prev) => ({
            ...prev,
            [itemId]: numValue,
        }));
    }

    function handleReasonChange(itemId: string, field: 'reason_code' | 'notes', value: string) {
        setEditedReasons((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value,
            },
        }));
    }

    async function handleSaveCounts() {
        if (!user?.id) return;

        try {
            setSaving(true);
            setError(null);

            // Save edited counts
            for (const [itemId, count] of Object.entries(editedCounts)) {
                if (count !== null) {
                    await updateCount(user.id, {
                        line_item_id: itemId,
                        physical_quantity: count,
                    });
                }
            }

            // Save edited reasons
            for (const [itemId, reason] of Object.entries(editedReasons)) {
                if (reason.reason_code) {
                    await updateVarianceReason(user.id, {
                        line_item_id: itemId,
                        reason_code: reason.reason_code,
                        notes: reason.notes,
                    });
                }
            }

            // Clear local edits and reload
            setEditedCounts({});
            setEditedReasons({});
            await loadAuditData();

            setSuccess('Counts saved successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save counts');
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit() {
        if (!user?.id || !audit) return;

        try {
            setSubmitting(true);
            setError(null);

            // First save any pending edits
            await handleSaveCounts();

            const result = await submitAudit(user.id, audit.id);

            if (result.autoApproved) {
                setSuccess(`Audit approved! ${result.movementsCreated} adjustment movements created.`);
            } else {
                setSuccess('Audit submitted for admin approval (contains negative variances).');
            }

            await loadAuditData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit audit');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleApprove(approved: boolean) {
        if (!user?.id || !audit) return;

        try {
            setSubmitting(true);
            setError(null);

            const result = await approveAudit(user.id, audit.id, {
                approved,
                rejection_reason: approved ? undefined : rejectionReason,
            });

            if (approved) {
                setSuccess(`Audit approved! ${result.movementsCreated} adjustment movements created.`);
            } else {
                setSuccess('Audit rejected.');
            }

            setShowApprovalModal(false);
            await loadAuditData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve/reject audit');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        if (!user?.id || !audit) return;

        if (!confirm('Are you sure you want to cancel this audit? This cannot be undone.')) {
            return;
        }

        try {
            setSubmitting(true);
            await cancelAudit(user.id, audit.id);
            navigate('/inventory/audit');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel audit');
        } finally {
            setSubmitting(false);
        }
    }

    function getVarianceDisplay(item: AuditLineItem, editedCount: number | null | undefined) {
        const physicalQty = editedCount ?? item.physical_quantity;

        if (physicalQty === null || physicalQty === undefined) {
            return { value: null, color: 'text-muted-foreground', icon: null };
        }

        const variance = physicalQty - item.system_quantity;

        if (variance > 0) {
            return { value: `+${variance}`, color: 'text-green-600', icon: <Plus className="w-4 h-4" /> };
        } else if (variance < 0) {
            return { value: variance.toString(), color: 'text-red-600', icon: <Minus className="w-4 h-4" /> };
        } else {
            return { value: '0', color: 'text-muted-foreground', icon: <CheckCircle className="w-4 h-4" /> };
        }
    }

    function getStatusBadge() {
        if (!audit) return null;

        switch (audit.status) {
            case 'counting':
                return <Badge variant="default" className="bg-blue-500">Counting</Badge>;
            case 'review':
                return <Badge variant="default" className="bg-purple-500">Review</Badge>;
            case 'pending_approval':
                return <Badge variant="default" className="bg-yellow-500">Pending Approval</Badge>;
            case 'approved':
                return <Badge variant="default" className="bg-green-500">Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rejected</Badge>;
            default:
                return <Badge variant="secondary">{audit.status}</Badge>;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!audit) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <p className="text-lg font-medium">Audit not found</p>
                <Link to="/inventory/audit">
                    <Button className="mt-4">Back to Audits</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/inventory/audit">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ClipboardCheck className="w-6 h-6" />
                            Audit: {audit.outlet_name}
                        </h1>
                        <p className="text-muted-foreground">
                            Period: {audit.period} • {getStatusBadge()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isEditable && !isAccountant && (
                        <>
                            <Button variant="outline" onClick={handleCancel} disabled={submitting}>
                                Cancel Audit
                            </Button>
                            <Button variant="outline" onClick={handleSaveCounts} disabled={saving}>
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={!summary.allCounted || !summary.allReasoned || submitting}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                {submitting ? 'Submitting...' : 'Submit for Approval'}
                            </Button>
                        </>
                    )}
                    {canApprove && (
                        <Button onClick={() => setShowApprovalModal(true)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Review & Approve
                        </Button>
                    )}
                </div>
            </div>

            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            {/* Rejected message */}
            {audit.status === 'rejected' && audit.rejection_reason && (
                <Alert variant="error" className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Audit Rejected</p>
                        <p className="text-sm mt-1">{audit.rejection_reason}</p>
                        <p className="text-xs mt-2 text-muted-foreground">
                            By {audit.approved_by_name} on{' '}
                            {new Date(audit.approved_at || '').toLocaleDateString()}
                        </p>
                    </div>
                </Alert>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <SummaryCard
                    label="Items"
                    value={`${summary.counted}/${summary.total}`}
                    subtext="counted"
                    icon={<FileText className="w-5 h-5" />}
                />
                <SummaryCard
                    label="No Change"
                    value={summary.noVariance}
                    subtext="items"
                    color="text-gray-600"
                    icon={<CheckCircle className="w-5 h-5" />}
                />
                <SummaryCard
                    label="Surplus"
                    value={`+${summary.positiveVariance}`}
                    subtext="units"
                    color="text-green-600"
                    icon={<Plus className="w-5 h-5" />}
                />
                <SummaryCard
                    label="Shortage"
                    value={summary.negativeVariance}
                    subtext="units"
                    color="text-red-600"
                    icon={<Minus className="w-5 h-5" />}
                />
                <SummaryCard
                    label="Need Reason"
                    value={summary.needsReason}
                    subtext="items"
                    color={summary.needsReason > 0 ? 'text-yellow-600' : 'text-gray-600'}
                    icon={<AlertTriangle className="w-5 h-5" />}
                />
            </div>

            {/* Validation warnings */}
            {isEditable && (
                <div className="space-y-2">
                    {!summary.allCounted && (
                        <Alert variant="warning" className="text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 inline" />
                            Count all items before submitting ({summary.total - summary.counted} remaining)
                        </Alert>
                    )}
                    {summary.needsReason > 0 && (
                        <Alert variant="warning" className="text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2 inline" />
                            Add reasons for all variances ({summary.needsReason} remaining)
                        </Alert>
                    )}
                    {summary.hasNegative && (
                        <Alert variant="info" className="text-sm">
                            <AlertCircle className="w-4 h-4 mr-2 inline" />
                            Negative variances require admin approval after submission
                        </Alert>
                    )}
                </div>
            )}

            {/* Count Sheet */}
            <Card>
                <h3 className="font-semibold mb-4">Count Sheet</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="text-left py-3 px-4">Item</th>
                                <th className="text-left py-3 px-4">Category</th>
                                <th className="text-right py-3 px-4">System Qty</th>
                                <th className="text-right py-3 px-4 w-32">Physical Qty</th>
                                <th className="text-center py-3 px-4 w-24">Variance</th>
                                <th className="text-left py-3 px-4 w-48">Reason</th>
                                <th className="text-left py-3 px-4">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item) => {
                                const editedCount = editedCounts[item.id];
                                const variance = getVarianceDisplay(item, editedCount);
                                const currentReason = editedReasons[item.id] || {
                                    reason_code: item.reason_code || '',
                                    notes: item.notes || '',
                                };
                                const physicalQty = editedCount ?? item.physical_quantity;
                                const varianceValue = physicalQty !== null ? physicalQty - item.system_quantity : null;
                                const reasonCodes = varianceValue ? getReasonCodesForVariance(varianceValue) : [];
                                const needsReason = varianceValue !== null && varianceValue !== 0 && !currentReason.reason_code;

                                return (
                                    <tr
                                        key={item.id}
                                        className={`border-b ${needsReason ? 'bg-yellow-50' : 'hover:bg-muted/30'}`}
                                    >
                                        <td className="py-3 px-4">
                                            <p className="font-medium">{item.item_name}</p>
                                            <p className="text-xs text-muted-foreground">{item.item_unit}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge variant="secondary">{item.item_category}</Badge>
                                        </td>
                                        <td className="text-right py-3 px-4 font-semibold">
                                            {item.system_quantity}
                                        </td>
                                        <td className="text-right py-3 px-4">
                                            {isEditable && !isAccountant ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editedCount ?? item.physical_quantity ?? ''}
                                                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-right"
                                                    placeholder="Enter count"
                                                />
                                            ) : (
                                                <span className="font-semibold">
                                                    {item.physical_quantity ?? '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-center py-3 px-4">
                                            {variance.value !== null ? (
                                                <span className={`font-semibold flex items-center justify-center gap-1 ${variance.color}`}>
                                                    {variance.icon}
                                                    {variance.value}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {varianceValue !== null && varianceValue !== 0 ? (
                                                isEditable && !isAccountant ? (
                                                    <select
                                                        value={currentReason.reason_code}
                                                        onChange={(e) => handleReasonChange(item.id, 'reason_code', e.target.value)}
                                                        className={`w-full px-2 py-1 border rounded text-sm ${needsReason ? 'border-yellow-500' : ''}`}
                                                    >
                                                        <option value="">Select reason</option>
                                                        {reasonCodes.map((rc) => (
                                                            <option key={rc.code} value={rc.code}>
                                                                {rc.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm">
                                                        {reasonCodes.find((r) => r.code === currentReason.reason_code)?.label || currentReason.reason_code || '-'}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {varianceValue !== null && varianceValue !== 0 ? (
                                                isEditable && !isAccountant ? (
                                                    <input
                                                        type="text"
                                                        value={currentReason.notes}
                                                        onChange={(e) => handleReasonChange(item.id, 'notes', e.target.value)}
                                                        className="w-full px-2 py-1 border rounded text-sm"
                                                        placeholder="Add notes..."
                                                    />
                                                ) : (
                                                    <span className="text-sm">{currentReason.notes || '-'}</span>
                                                )
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Admin Approval Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Review Audit
                        </h3>

                        <div className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <p className="text-sm font-medium">Summary</p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                    <p>Total Items: {summary.total}</p>
                                    <p>Items Counted: {summary.counted}</p>
                                    <p className="text-green-600">Surplus: +{summary.positiveVariance}</p>
                                    <p className="text-red-600">Shortage: {summary.negativeVariance}</p>
                                </div>
                            </div>

                            {summary.hasNegative && (
                                <Alert variant="warning" className="text-sm">
                                    <AlertTriangle className="w-4 h-4 mr-2 inline" />
                                    This audit contains negative variances. Approving will create adjustment movements.
                                </Alert>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Rejection Reason (if rejecting)
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    rows={3}
                                    placeholder="Enter reason for rejection..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowApprovalModal(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => handleApprove(false)}
                                disabled={submitting || !rejectionReason.trim()}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </Button>
                            <Button
                                onClick={() => handleApprove(true)}
                                disabled={submitting}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {submitting ? 'Approving...' : 'Approve'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function SummaryCard({
    label,
    value,
    subtext,
    color = 'text-gray-800',
    icon,
}: {
    label: string;
    value: string | number;
    subtext: string;
    color?: string;
    icon: React.ReactNode;
}) {
    return (
        <Card className="text-center">
            <div className={`flex justify-center mb-2 ${color}`}>{icon}</div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{subtext}</p>
        </Card>
    );
}
