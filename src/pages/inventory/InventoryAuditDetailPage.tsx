import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Save, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
import { Button, LinkButton } from '@/components/ui/Button';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuditStatusStamp } from '@/components/inventory/AuditStatus';
import { ModalActions } from '@/components/inventory/ModalParts';
import { cn } from '@/utils/cn';

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

/** A reason counts only if it belongs to the variance's direction. */
function isReasonValid(variance: number, reasonCode: string | null | undefined): boolean {
    return !!reasonCode && getReasonCodesForVariance(variance).some((r) => r.code === reasonCode);
}

/** Run fn over items with at most `size` requests in flight. */
async function runInChunks<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
    for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn));
    }
}

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

    // Local edits (before saving). A key present in editedCounts with null = count cleared.
    const [editedCounts, setEditedCounts] = useState<Record<string, number | null>>({});
    const [editedReasons, setEditedReasons] = useState<Record<string, { reason_code: string; notes: string }>>({});

    // Submit / Approval state
    const [submitting, setSubmitting] = useState(false);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Presentational: the cancel confirmation, and pressing the stamp after a state change here.
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [stampPressed, setStampPressed] = useState(false);

    useDocumentTitle(audit ? `Stock audit ${audit.period}` : 'Stock audit');

    const userRole = user?.role || '';
    const isAdmin = userRole === 'admin';
    const isAccountant = userRole === 'accountant';

    // Computed
    const isEditable = audit && ['counting', 'review'].includes(audit.status);
    const canApprove = audit && audit.status === 'pending_approval' && isAdmin;

    const effectiveCount = useCallback(
        (item: AuditLineItem): number | null =>
            item.id in editedCounts ? editedCounts[item.id] : item.physical_quantity,
        [editedCounts]
    );

    const effectiveReason = useCallback(
        (item: AuditLineItem) => ({
            reason_code: editedReasons[item.id]?.reason_code ?? item.reason_code ?? '',
            notes: editedReasons[item.id]?.notes ?? item.notes ?? '',
        }),
        [editedReasons]
    );

    // Summary calculations
    const summary = useMemo(() => {
        let counted = 0;
        let positiveVariance = 0;
        let negativeVariance = 0;
        let noVariance = 0;
        let needsReason = 0;

        lineItems.forEach((item) => {
            const physicalQty = effectiveCount(item);

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

                // A variance needs a reason that matches its direction
                if (variance !== 0 && !isReasonValid(variance, effectiveReason(item).reason_code)) {
                    needsReason++;
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
            // An audit with no count lines has nothing counted: it must not be submittable
            allCounted: lineItems.length > 0 && counted === lineItems.length,
            allReasoned: needsReason === 0,
            hasNegative: negativeVariance < 0,
            hasPositive: positiveVariance > 0,
        };
    }, [lineItems, effectiveCount, effectiveReason]);

    const loadAuditData = useCallback(
        async (opts: { silent?: boolean } = {}) => {
            if (!user?.id || !auditId) return;

            try {
                // A silent refresh keeps the page on screen instead of the full-page spinner.
                if (!opts.silent) setLoading(true);
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
                if (!opts.silent) setLoading(false);
            }
        },
        [user?.id, auditId]
    );

    useEffect(() => {
        if (!isAuthReady || !auditId) return;
        loadAuditData();
    }, [isAuthReady, auditId, loadAuditData]);

    useEffect(
        () => () => {
            if (successTimer.current) clearTimeout(successTimer.current);
        },
        []
    );

    function showSuccess(message: string, autoHide = false) {
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = null;
        setSuccess(message);
        if (autoHide) {
            successTimer.current = setTimeout(() => setSuccess(null), 3000);
        }
    }

    function handleCountChange(item: AuditLineItem, value: string) {
        const numValue = value === '' ? null : parseInt(value, 10);
        if (numValue !== null && (isNaN(numValue) || numValue < 0)) return;

        setEditedCounts((prev) => ({
            ...prev,
            [item.id]: numValue,
        }));

        // If the variance changed direction, the old reason no longer applies.
        const reason = effectiveReason(item);
        if (numValue !== null && reason.reason_code) {
            const variance = numValue - item.system_quantity;
            if (variance !== 0 && !isReasonValid(variance, reason.reason_code)) {
                setEditedReasons((prev) => ({ ...prev, [item.id]: { ...reason, reason_code: '' } }));
            }
        }
    }

    function handleReasonChange(item: AuditLineItem, field: 'reason_code' | 'notes', value: string) {
        setEditedReasons((prev) => ({
            ...prev,
            [item.id]: {
                // Seed from the saved line so editing one field keeps the other
                reason_code: prev[item.id]?.reason_code ?? item.reason_code ?? '',
                notes: prev[item.id]?.notes ?? item.notes ?? '',
                [field]: value,
            },
        }));
    }

    /** Persist local edits. Throws on the first failure. */
    async function saveEdits(): Promise<void> {
        if (!user?.id) return;
        const userId = user.id;
        const byId = new Map(lineItems.map((li) => [li.id, li]));

        const countEdits = Object.entries(editedCounts).filter(
            ([itemId, count]) => byId.get(itemId)?.physical_quantity !== count
        );
        await runInChunks(countEdits, 10, ([itemId, count]) =>
            updateCount(userId, { line_item_id: itemId, physical_quantity: count })
        );

        const reasonEdits = Object.entries(editedReasons).filter(([itemId, reason]) => {
            const saved = byId.get(itemId);
            return (
                !!saved &&
                (reason.reason_code !== (saved.reason_code ?? '') || reason.notes !== (saved.notes ?? ''))
            );
        });
        await runInChunks(reasonEdits, 10, ([itemId, reason]) =>
            updateVarianceReason(userId, {
                line_item_id: itemId,
                reason_code: reason.reason_code,
                notes: reason.notes,
            })
        );

        // Clear local edits and refresh without unmounting the sheet
        setEditedCounts({});
        setEditedReasons({});
        await loadAuditData({ silent: true });
    }

    async function handleSaveCounts() {
        if (!user?.id || saving || submitting) return;

        try {
            setSaving(true);
            setError(null);
            await saveEdits();
            showSuccess('Counts saved successfully', true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save counts');
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit() {
        if (!user?.id || !audit || submitting || saving) return;

        try {
            setSubmitting(true);
            setError(null);

            // First save any pending edits; a failed save aborts the submit
            await saveEdits();

            const result = await submitAudit(user.id, audit.id);

            if (result.autoApproved) {
                showSuccess(`Audit approved. ${result.movementsCreated} adjustment movements created.`);
            } else {
                const { variance_positive: pos, variance_negative: neg } = result.audit;
                const found =
                    neg < 0 && pos > 0
                        ? 'it has shortages and surpluses'
                        : neg < 0
                          ? 'it contains shortages'
                          : pos > 0
                            ? 'it contains surpluses'
                            : 'it has variances';
                showSuccess(`Audit submitted for admin approval (${found}).`);
            }
            setStampPressed(true);

            await loadAuditData({ silent: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit audit');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleApprove(approved: boolean) {
        if (!user?.id || !audit || submitting) return;

        try {
            setSubmitting(true);
            setError(null);

            const result = await approveAudit(user.id, audit.id, {
                approved,
                rejection_reason: approved ? undefined : rejectionReason,
            });

            if (approved) {
                showSuccess(`Audit approved. ${result.movementsCreated} adjustment movements created.`);
            } else {
                showSuccess('Audit rejected.');
            }
            setStampPressed(true);

            setShowApprovalModal(false);
            await loadAuditData({ silent: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve/reject audit');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        if (!user?.id || !audit || submitting) return;

        // Confirmation happens in the ConfirmDialog that calls this.
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

    const periodLabel = (period: string) => {
        const [year, month] = period.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return isNaN(date.getTime()) ? period : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    };
    const fmtDate = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    if (loading) {
        return (
            <div aria-busy="true">
                <PageHeader
                    back={{ to: '/inventory/audit', label: 'All audits' }}
                    title={<span className="skeleton inline-block h-8 w-64 rounded-md align-middle" aria-hidden="true" />}
                />
                <div className="sheet mb-6 grid grid-cols-2 gap-px overflow-hidden bg-rule lg:grid-cols-5">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="bg-white px-5 py-4">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="mt-2 h-7 w-16" />
                        </div>
                    ))}
                </div>
                <div className="sheet overflow-hidden">
                    <TableSkeleton rows={8} cols={6} />
                </div>
            </div>
        );
    }

    if (!audit) {
        return (
            <div>
                <PageHeader back={{ to: '/inventory/audit', label: 'All audits' }} title="Audit not found" />
                {error && <Alert variant="error" className="mb-6">{error}</Alert>}
                <div className="sheet px-5 py-12 text-center">
                    <p className="text-base font-semibold text-ink">This audit could not be opened.</p>
                    <p className="mt-1 text-sm text-ink-muted">It may have been cancelled, or it belongs to an outlet you cannot see.</p>
                    <LinkButton to="/inventory/audit" variant="outline" className="mt-5">
                        Back to audits
                    </LinkButton>
                </div>
            </div>
        );
    }

    const canEdit = !!isEditable && !isAccountant;
    const remaining = summary.total - summary.counted;
    const stampDetail =
        audit.status === 'pending_approval'
            ? 'Awaiting approval'
            : (audit.status === 'approved' || audit.status === 'rejected') && audit.approved_at
              ? fmtDate(audit.approved_at)
              : undefined;

    return (
        <div>
            <PageHeader
                back={{ to: '/inventory/audit', label: 'All audits' }}
                title={
                    <>
                        Stock audit · <span className="serial">{audit.period}</span>
                    </>
                }
                meta={<AuditStatusStamp status={audit.status} detail={stampDetail} animate={stampPressed} />}
                description={
                    <>
                        {audit.outlet_name}
                        {audit.outlet_code && <span className="serial"> ({audit.outlet_code})</span>} · {periodLabel(audit.period)}
                        {audit.created_by_name && ` · started by ${audit.created_by_name} on ${fmtDate(audit.created_at)}`}
                    </>
                }
                actions={
                    canEdit ? (
                        <Button
                            variant="ghost"
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={submitting}
                            className="text-danger hover:bg-danger-tint hover:text-danger"
                        >
                            Cancel audit
                        </Button>
                    ) : undefined
                }
            />

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}
            {success && <Alert variant="success" className="mb-6">{success}</Alert>}

            {/* Rejected message */}
            {audit.status === 'rejected' && audit.rejection_reason && (
                <Alert variant="error" className="mb-6">
                    <p className="font-semibold">Rejected{audit.approved_by_name ? ` by ${audit.approved_by_name}` : ''}{audit.approved_at ? ` on ${fmtDate(audit.approved_at)}` : ''}</p>
                    <p className="mt-1">{audit.rejection_reason}</p>
                </Alert>
            )}

            {/* Variance strip */}
            <section aria-label="Count summary" className="sheet mb-6 grid grid-cols-2 gap-px overflow-hidden bg-rule lg:grid-cols-5">
                <Figure
                    label="Counted"
                    hint={summary.total === 0 ? 'No items to count' : remaining > 0 ? `${remaining} left to count` : 'Every item counted'}
                >
                    <span className={cn(summary.allCounted ? 'text-final' : 'text-ink')}>{summary.counted}</span>
                    <span className="text-base font-medium text-ink-muted"> / {summary.total}</span>
                </Figure>
                <Figure label="Matched" hint="items with no variance">
                    {summary.noVariance}
                </Figure>
                <Figure label="Surplus" hint="pieces more than system">
                    <span className={cn(summary.positiveVariance > 0 ? 'text-final' : 'text-ink-faint')}>
                        +{summary.positiveVariance}
                    </span>
                </Figure>
                <Figure label="Shortage" hint="pieces fewer than system">
                    <span className={cn(summary.negativeVariance < 0 ? 'text-overdue' : 'text-ink-faint')}>
                        {summary.negativeVariance < 0 ? `−${Math.abs(summary.negativeVariance)}` : '0'}
                    </span>
                </Figure>
                <Figure label="Need a reason" hint="variances to explain" className="col-span-2 lg:col-span-1">
                    <span className={cn(summary.needsReason > 0 ? 'text-draft' : 'text-ink-faint')}>{summary.needsReason}</span>
                </Figure>
            </section>

            {isEditable && (summary.hasNegative || (summary.hasPositive && !isAdmin)) && (
                <Alert variant="info" className="mb-6">
                    {summary.hasNegative
                        ? isAdmin
                            ? 'Shortages need an admin’s approval after you submit. Surpluses alone are approved automatically.'
                            : 'Variances need an admin’s approval after you submit.'
                        : 'Surpluses need an admin’s approval after you submit.'}
                </Alert>
            )}

            {/* Counting ledger */}
            <section className="sheet overflow-hidden" aria-labelledby="count-h">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4">
                    <h2 id="count-h" className="text-lg font-semibold text-ink">Count sheet</h2>
                    <p className="text-sm text-ink-muted">
                        {canEdit
                            ? 'Enter what is physically on the shelf. Explain every variance.'
                            : `${summary.total} item${summary.total === 1 ? '' : 's'}`}
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="ledger">
                        <thead>
                            <tr>
                                <th scope="col">Item</th>
                                <th scope="col" className="text-right">System</th>
                                <th scope="col" className="w-32 text-right">Counted</th>
                                <th scope="col" className="w-24 text-right">Variance</th>
                                <th scope="col" className="min-w-[12rem]">Reason</th>
                                <th scope="col" className="min-w-[12rem]">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item) => {
                                const physicalQty = effectiveCount(item);
                                const currentReason = effectiveReason(item);
                                const varianceValue = physicalQty !== null ? physicalQty - item.system_quantity : null;
                                const reasonCodes = varianceValue ? getReasonCodesForVariance(varianceValue) : [];
                                const needsReason =
                                    varianceValue !== null &&
                                    varianceValue !== 0 &&
                                    !isReasonValid(varianceValue, currentReason.reason_code);
                                const hasVariance = varianceValue !== null && varianceValue !== 0;

                                return (
                                    <tr key={item.id} className={cn(needsReason && 'row-draft')}>
                                        <td>
                                            <div className="inline-block max-w-full align-top">
                                                <span className="block font-semibold text-ink">{item.item_name}</span>
                                                <span className="block text-xs text-ink-muted">
                                                    {[item.item_category, item.item_unit].filter(Boolean).join(' · ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="tabular text-right font-semibold text-ink">{item.system_quantity}</td>
                                        <td className="text-right">
                                            {canEdit ? (
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="0"
                                                    value={physicalQty ?? ''}
                                                    onChange={(e) => handleCountChange(item, e.target.value)}
                                                    aria-label={`Counted quantity for ${item.item_name ?? 'item'}`}
                                                    placeholder="Count"
                                                    className="tabular h-9 w-28 text-right"
                                                />
                                            ) : (
                                                <span className="tabular font-semibold text-ink">{item.physical_quantity ?? '—'}</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <Variance value={varianceValue} />
                                        </td>
                                        <td>
                                            {hasVariance ? (
                                                canEdit ? (
                                                    <Select
                                                        value={currentReason.reason_code}
                                                        onChange={(e) => handleReasonChange(item, 'reason_code', e.target.value)}
                                                        aria-label={`Reason for the variance on ${item.item_name ?? 'item'}`}
                                                        aria-invalid={needsReason || undefined}
                                                        className={cn('h-9', needsReason && 'border-draft')}
                                                    >
                                                        <option value="">Select reason</option>
                                                        {reasonCodes.map((rc) => (
                                                            <option key={rc.code} value={rc.code}>
                                                                {rc.label}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                ) : (
                                                    <span className="text-ink">
                                                        {reasonCodes.find((r) => r.code === currentReason.reason_code)?.label || currentReason.reason_code || '—'}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-ink-faint">—</span>
                                            )}
                                        </td>
                                        <td>
                                            {hasVariance ? (
                                                canEdit ? (
                                                    <Input
                                                        type="text"
                                                        value={currentReason.notes}
                                                        onChange={(e) => handleReasonChange(item, 'notes', e.target.value)}
                                                        aria-label={`Notes for ${item.item_name ?? 'item'}`}
                                                        placeholder="Optional notes"
                                                        className="h-9"
                                                    />
                                                ) : (
                                                    <span className="text-ink">{currentReason.notes || '—'}</span>
                                                )
                                            ) : (
                                                <span className="text-ink-faint">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Sticky action bar */}
            {(canEdit || canApprove) && (
                <div className="sticky bottom-0 z-10 -mx-4 -mb-6 mt-6 border-t border-rule bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mb-8 lg:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-ink-muted" aria-live="polite">
                            {canEdit ? (
                                summary.allCounted && summary.allReasoned ? (
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-final">
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        Ready to submit
                                    </span>
                                ) : (
                                    [
                                        summary.total === 0 && 'This audit has no items to count',
                                        remaining > 0 && `${remaining} item${remaining === 1 ? '' : 's'} left to count`,
                                        summary.needsReason > 0 &&
                                            `${summary.needsReason} variance${summary.needsReason === 1 ? '' : 's'} need a reason`,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')
                                )
                            ) : (
                                `This audit contains ${
                                    summary.hasNegative && summary.hasPositive
                                        ? 'shortages and surpluses'
                                        : summary.hasNegative
                                          ? 'shortages'
                                          : 'surpluses'
                                } and needs your decision.`
                            )}
                        </p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            {canEdit && (
                                <>
                                    <Button variant="outline" onClick={handleSaveCounts} disabled={saving || submitting} isLoading={saving}>
                                        {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
                                        {saving ? 'Saving…' : 'Save counts'}
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={!summary.allCounted || !summary.allReasoned || submitting || saving}
                                        isLoading={submitting}
                                    >
                                        {!submitting && <Send className="h-4 w-4" aria-hidden="true" />}
                                        {submitting ? 'Submitting…' : 'Submit audit'}
                                    </Button>
                                </>
                            )}
                            {canApprove && (
                                <Button onClick={() => setShowApprovalModal(true)}>
                                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                    Review and approve
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Admin approval */}
            <Modal
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                title="Review audit"
                description={`${audit.outlet_name ?? ''} · ${periodLabel(audit.period)}`}
                dismissable={!submitting}
            >
                <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule">
                        <ModalFigure label="Items counted" value={`${summary.counted} / ${summary.total}`} />
                        <ModalFigure label="Matched" value={summary.noVariance} />
                        <ModalFigure label="Surplus" value={`+${summary.positiveVariance}`} tone="text-final" />
                        <ModalFigure
                            label="Shortage"
                            value={summary.negativeVariance < 0 ? `−${Math.abs(summary.negativeVariance)}` : '0'}
                            tone="text-overdue"
                        />
                    </dl>

                    {summary.hasNegative && (
                        <Alert variant="warning">
                            Approving writes adjustment movements that reduce stock by the shortage.
                        </Alert>
                    )}

                    <Textarea
                        label="Reason for rejecting"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        placeholder="Tell the outlet what to recount or explain"
                        helperText="Needed only if you reject."
                    />

                    <ModalActions>
                        <Button variant="outline" type="button" onClick={() => setShowApprovalModal(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => handleApprove(false)}
                            disabled={submitting || !rejectionReason.trim()}
                            className="text-danger"
                        >
                            Reject
                        </Button>
                        <Button type="button" onClick={() => handleApprove(true)} disabled={submitting} isLoading={submitting}>
                            {!submitting && <Check className="h-4 w-4" aria-hidden="true" />}
                            {submitting ? 'Working…' : 'Approve'}
                        </Button>
                    </ModalActions>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={showCancelConfirm}
                title="Cancel this audit?"
                message="The count sheet and every count entered so far are discarded. This cannot be undone."
                confirmLabel="Cancel audit"
                cancelLabel="Keep counting"
                variant="danger"
                isLoading={submitting}
                onCancel={() => setShowCancelConfirm(false)}
                onConfirm={async () => {
                    await handleCancel();
                    setShowCancelConfirm(false);
                }}
            />
        </div>
    );
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function Figure({
    label,
    hint,
    className,
    children,
}: {
    label: string;
    hint: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('min-w-0 bg-white px-5 py-4', className)}>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
            <div className="tabular mt-1 text-2xl font-bold tracking-tight text-ink">{children}</div>
            <div className="mt-0.5 truncate text-sm text-ink-muted">{hint}</div>
        </div>
    );
}

function ModalFigure({ label, value, tone = 'text-ink' }: { label: string; value: string | number; tone?: string }) {
    return (
        <div className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
            <dd className={cn('tabular mt-0.5 text-xl font-semibold', tone)}>{value}</dd>
        </div>
    );
}

/** Variance: + in green, − in red, a quiet tick when the count matches. */
function Variance({ value }: { value: number | null }) {
    if (value === null) return <span className="text-ink-faint">—</span>;
    if (value === 0) {
        return (
            <span className="inline-flex items-center gap-1 text-ink-muted">
                <Check className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">No variance</span>0
            </span>
        );
    }
    return (
        <span className={cn('tabular font-bold', value > 0 ? 'text-final' : 'text-overdue')}>
            {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
        </span>
    );
}
