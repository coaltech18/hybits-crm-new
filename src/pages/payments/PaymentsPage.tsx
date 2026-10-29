import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getPayments,
  getPaymentsSummary,
  deactivatePayment,
  PAYMENTS_PAGE_SIZE,
  type PaymentsSummary,
} from '@/services/paymentService';
import type { Payment, PaymentFilters, PaymentMethod } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { formatCurrency, formatVoidTrail } from '@/utils/format';
import { formatDate } from '@/utils/billingDate';
import { cn } from '@/utils/cn';

// ================================================================
// PAYMENTS — the receipts side of the bill book.
// Money strip (what came in) → filter bar → ledger of every payment,
// newest first, with voids kept visible on request for the audit trail.
// ================================================================

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
};

const methodLabel = (m: string) => METHOD_LABELS[m] ?? m.replace(/_/g, ' ');
const count = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

export default function PaymentsPage() {
  useDocumentTitle('Payments');

  const { user } = useAuth();
  const { showToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(0);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    amount: number;
    invoiceNumber: string;
  } | null>(null);
  // Optional reason kept with the voided payment (payments.void_reason)
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  // Only the latest request may write state (fast filter changes).
  const requestId = useRef(0);

  const canVoid = user?.role === 'admin' || user?.role === 'manager';

  const filters = useMemo<PaymentFilters>(() => {
    const f: PaymentFilters = { include_inactive: showDeleted };
    if (paymentMethod) f.payment_method = paymentMethod;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [paymentMethod, dateFrom, dateTo, showDeleted]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const id = ++requestId.current;

    setLoading(true);
    setError(null);

    const [listResult, summaryResult] = await Promise.allSettled([
      getPayments(filters, { page, pageSize: PAYMENTS_PAGE_SIZE }),
      getPaymentsSummary(filters),
    ]);

    if (id !== requestId.current) return;

    if (listResult.status === 'fulfilled') {
      setPayments(listResult.value.rows);
      setTotalCount(listResult.value.count);
    } else {
      const reason: unknown = listResult.reason;
      setPayments([]);
      setTotalCount(0);
      setError(reason instanceof Error ? reason.message : 'Failed to load payments');
    }

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
      setSummaryError(null);
    } else {
      const reason: unknown = summaryResult.reason;
      setSummary(null);
      setSummaryError(reason instanceof Error ? reason.message : 'Failed to load totals');
    }

    setLoading(false);
    setHasLoaded(true);
  }, [user?.id, filters, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleDelete(paymentId: string) {
    if (!user?.id || actionLoading) return;

    try {
      setActionLoading(paymentId);
      setVoidError(null);

      // The DB reverts the invoice status itself (migration 043)
      await deactivatePayment(user.id, paymentId, voidReason);
      showToast('Payment voided', 'success');
      closeVoidDialog();
      // Voiding the only row on a later page would leave that page empty.
      if (!showDeleted && payments.length === 1 && page > 0) {
        setPage(page - 1); // triggers a reload
      } else {
        await loadData();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to void payment';
      setVoidError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function closeVoidDialog() {
    setConfirmDelete(null);
    setVoidReason('');
    setVoidError(null);
  }

  function clearFilters() {
    setPaymentMethod('');
    setDateFrom('');
    setDateTo('');
    setShowDeleted(false);
    setPage(0);
  }

  const first = loading && !hasLoaded;
  const filtersActive = Boolean(paymentMethod || dateFrom || dateTo || showDeleted);
  const rangeActive = Boolean(dateFrom || dateTo);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAYMENTS_PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : page * PAYMENTS_PAGE_SIZE + 1;
  const lastRow = Math.min(totalCount, (page + 1) * PAYMENTS_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment recorded against an invoice. To record a new one, open the invoice and choose Record payment."
        actions={
          canVoid && (
            <LinkButton to="/invoices" variant="outline">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Open invoices
            </LinkButton>
          )
        }
      />

      {/* Money strip: what came in for the current filters. */}
      <section
        aria-label="Payment totals"
        className="sheet mb-6 grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule max-lg:[&>*:nth-child(-n+2)]:border-b lg:divide-x divide-rule"
      >
        <Figure
          label={rangeActive ? 'Collected in range' : 'Collected'}
          hint={rangeActive ? 'Recorded payments in the date range' : 'All recorded payments'}
          loading={first}
          big
        >
          <span className={cn(summary && summary.total_amount > 0 ? 'text-final' : 'text-ink')}>
            {summary ? formatCurrency(summary.total_amount) : '—'}
          </span>
        </Figure>
        <Figure label="Payments" hint="Recorded, not voided" loading={first} className="max-lg:border-l">
          {summary ? count(summary.total_count) : '—'}
        </Figure>
        <Figure
          label="Today"
          hint={summary ? `${plural(summary.today_count, 'payment')} dated today` : 'Payments dated today'}
          loading={first}
        >
          {summary ? formatCurrency(summary.today_amount) : '—'}
        </Figure>
        <Figure label="Voided" hint="Kept for the record, not counted" loading={first} className="max-lg:border-l">
          <span className={cn(summary && summary.voided_count > 0 ? 'text-void' : 'text-ink')}>
            {summary ? count(summary.voided_count) : '—'}
          </span>
        </Figure>
      </section>

      {summaryError && (
        <Alert variant="warning" className="mb-6">
          Totals could not be loaded: {summaryError}. They show as “—”.
        </Alert>
      )}

      {/* Filter bar: stays mounted while the ledger refetches. */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <Select
              label="Method"
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value as PaymentMethod | '');
                setPage(0);
              }}
            >
              <option value="">All methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
            </Select>
          </div>

          <div className="w-[calc(50%-0.5rem)] sm:w-44">
            <DateInput
              label="From"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div className="w-[calc(50%-0.5rem)] sm:w-44">
            <DateInput
              label="To"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => {
                setShowDeleted(e.target.checked);
                setPage(0);
              }}
              className="h-4 w-4 cursor-pointer rounded border-rule-strong accent-brand-primary"
            />
            Show voided
          </label>

          {filtersActive && (
            <Button type="button" variant="ghost" onClick={clearFilters} className="sm:ml-auto">
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Ledger */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {first ? (
              'Loading payments…'
            ) : (
              <>
                <span className="font-semibold text-ink">{plural(totalCount, 'payment')}</span>
                {showDeleted ? ' including voided' : ''}
                {summary ? ` · ${formatCurrency(summary.total_amount)} collected` : ''}
              </>
            )}
          </p>
        </div>

        {first ? (
          <TableSkeleton rows={8} cols={5} />
        ) : payments.length === 0 ? (
          loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : error ? (
            <p className="px-5 py-12 text-center text-sm text-ink-muted">
              Payments could not be loaded. Check the message above and try again.
            </p>
          ) : filtersActive ? (
            <EmptyState
              icon={Wallet}
              title="No payments match these filters"
              description="Try a wider date range or another method."
              action={{ label: 'Clear filters', onClick: clearFilters }}
            />
          ) : (
            <EmptyState
              icon={Wallet}
              title="No payments recorded yet"
              description="Payments appear here once you record them on an invoice. Open an issued invoice and choose Record payment."
            />
          )
        ) : (
          <>
            <div
              className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}
              aria-busy={loading}
            >
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Invoice · client</th>
                    <th scope="col">Date</th>
                    <th scope="col">Method · ref.</th>
                    <th scope="col" className="text-right">Amount</th>
                    <th scope="col">Status</th>
                    {canVoid && (
                      <th scope="col" data-nolabel className="w-px">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const voided = !payment.is_active;
                    return (
                      <tr key={payment.id} className={cn(voided && 'row-void')}>
                        <td className="max-w-[20rem]">
                          <div className="inline-block max-w-full align-top">
                            <Link
                              to={`/invoices/${payment.invoice_id}`}
                              className="serial block whitespace-nowrap font-semibold text-ink hover:text-brand-primary"
                            >
                              {payment.invoice_number || 'Unnumbered'}
                            </Link>
                            <span className="block truncate text-ink-muted">{payment.client_name || '—'}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-ink-muted">
                          {formatDate(payment.payment_date, 'short')}
                        </td>
                        <td className="max-w-[14rem]">
                          <div className="min-w-0">
                            <span className="block whitespace-nowrap">{methodLabel(payment.payment_method)}</span>
                            {payment.reference_number && (
                              <span className="serial block truncate text-ink-muted">{payment.reference_number}</span>
                            )}
                          </div>
                        </td>
                        <td className="amount cell-emph text-right font-semibold text-ink">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td>
                          <div>
                            <StatusBadge kind="payment" status={voided ? 'voided' : 'active'} />
                            {voided && (payment.voided_at || payment.void_reason) && (
                              <p className="mt-1 max-w-[16rem] text-xs text-ink-muted">
                                {formatVoidTrail(payment)}
                              </p>
                            )}
                          </div>
                        </td>
                        {canVoid && (
                          <td className="text-right">
                            {payment.is_active && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setConfirmDelete({
                                    id: payment.id,
                                    amount: payment.amount,
                                    invoiceNumber: payment.invoice_number || 'Unknown',
                                  })
                                }
                                disabled={!!actionLoading}
                                aria-label={`Void payment of ${formatCurrency(payment.amount)} on ${payment.invoice_number || 'invoice'}`}
                                className="px-2 hover:text-danger"
                              >
                                Void
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <nav
              aria-label="Payments pages"
              className="flex flex-col gap-3 border-t border-rule px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-ink-muted">
                Showing <span className="tabular font-semibold text-ink">{count(firstRow)}–{count(lastRow)}</span> of{' '}
                <span className="tabular font-semibold text-ink">{count(totalCount)}</span>
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={loading || page === 0}
                  >
                    Previous
                  </Button>
                  <span className="tabular px-1 text-ink-muted">
                    Page {page + 1} of {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={loading || page >= pageCount - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </nav>
          </>
        )}
      </Card>

      {/* Void payment confirmation, with an optional reason */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={closeVoidDialog}
        dismissable={!actionLoading}
        title="Void this payment?"
        maxWidth="md"
      >
        <p className="text-sm text-ink-muted">
          The payment of{' '}
          <span className="amount font-semibold text-ink">{confirmDelete ? formatCurrency(confirmDelete.amount) : ''}</span>{' '}
          on invoice <span className="serial font-semibold text-ink">{confirmDelete?.invoiceNumber ?? ''}</span> will be
          voided and the invoice balance recalculated. The voided entry stays on record.
        </p>
        {voidError && <Alert variant="error" className="mt-4">{voidError}</Alert>}
        <div className="mt-4">
          <Textarea
            label="Reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Entered twice, wrong invoice, cheque bounced…"
            helperText="Optional. Kept with the voided payment."
            disabled={!!actionLoading}
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={closeVoidDialog} disabled={!!actionLoading} data-autofocus>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={!!actionLoading}
            onClick={() => confirmDelete && void handleDelete(confirmDelete.id)}
          >
            {actionLoading ? 'Voiding…' : 'Void payment'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Figure({
  label, hint, loading, big, className, children,
}: { label: string; hint: string; loading: boolean; big?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 px-5 py-4 sm:px-6 sm:py-5', className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      {loading ? (
        <Skeleton className={cn('mt-2', big ? 'h-9 w-40' : 'h-8 w-24')} />
      ) : (
        <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}>
          {children}
        </div>
      )}
      <div className="mt-1 truncate text-sm text-ink-muted">{hint}</div>
    </div>
  );
}
