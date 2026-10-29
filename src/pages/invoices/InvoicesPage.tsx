import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Download, FilePlus2, FileText, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInvoices, finalizeInvoice, INVOICE_PAGE_SIZE, type InvoiceListRow } from '@/services/invoiceService';
import { downloadInvoicePDF } from '@/utils/invoicePdfGenerator';
import type { InvoiceType, InvoiceStatus, InvoiceFilters } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { AgingBar } from '@/components/ui/AgingBar';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/billingDate';
import { daysSince, toLocalISODate } from '@/utils/date';
import { cn } from '@/utils/cn';
import { INVOICE_TYPE_LABEL } from './invoiceDisplay';

export default function InvoicesPage() {
  useDocumentTitle('Invoices');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  // Filters
  const [selectedType, setSelectedType] = useState<InvoiceType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');

  // Action states. Cancelling lives on the invoice page; the list only finalizes drafts.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState<{
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  // `silent` refreshes the rows in place after an action (no skeleton).
  const loadData = useCallback(async (silent = false) => {
    if (!user?.id) return;
    // Only the latest request may write state, so a slow earlier
    // response can't overwrite the current filter's results.
    const seq = ++requestSeq.current;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const filters: InvoiceFilters = {};
      if (selectedType) filters.invoice_type = selectedType;
      if (selectedStatus) filters.status = selectedStatus;

      const result = await getInvoices(user.id, filters, { page, pageSize: INVOICE_PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      if (result.invoices.length === 0 && page > 0 && result.total > 0) {
        // The current page emptied (e.g. after a status change); step back
        setPage(Math.ceil(result.total / INVOICE_PAGE_SIZE) - 1);
        return;
      }
      setInvoices(result.invoices);
      setTotalCount(result.total);
      setOutstanding(result.outstanding);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (!silent) {
        setInvoices([]);
        setTotalCount(0);
        setOutstanding(null);
      }
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [user?.id, selectedType, selectedStatus, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pageCount = Math.max(1, Math.ceil(totalCount / INVOICE_PAGE_SIZE));

  async function handleDownload(invoice: InvoiceListRow) {
    if (downloadingId) return;
    try {
      setDownloadingId(invoice.id);
      await downloadInvoicePDF(invoice);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download the PDF', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleFinalize(invoiceId: string) {
    if (!user?.id || finalizing) return;

    try {
      setFinalizing(true);
      await finalizeInvoice(user.id, invoiceId);
      showToast('Invoice finalized successfully', 'success');
      setConfirmFinalize(null);
      await loadData(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to finalize invoice';
      showToast(errorMessage, 'error');
    } finally {
      setFinalizing(false);
    }
  }

  const filtered = Boolean(selectedType || selectedStatus);
  const showingFrom = page * INVOICE_PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * INVOICE_PAGE_SIZE, totalCount);

  function clearFilters() {
    setSelectedType('');
    setSelectedStatus('');
    setPage(0);
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="GST tax invoices for subscriptions and events, newest first."
        actions={
          canEdit && (
            <LinkButton to="/invoices/create">
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              New invoice
            </LinkButton>
          )
        }
      />

      {/* Filters stay mounted while results load */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-52">
            <Select
              label="Type"
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value as InvoiceType | ''); setPage(0); }}
            >
              <option value="">All types</option>
              <option value="subscription">Subscription</option>
              <option value="event">Event</option>
            </Select>
          </div>
          <div className="w-full sm:w-52">
            <Select
              label="Status"
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as InvoiceStatus | ''); setPage(0); }}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
              <option value="partially_paid">Part paid</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          {filtered && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <Alert variant="error" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {/* Count line */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {loading ? (
            'Loading invoices…'
          ) : (
            <>
              <span className="tabular font-semibold text-ink">{new Intl.NumberFormat('en-IN').format(totalCount)}</span>{' '}
              invoice{totalCount === 1 ? '' : 's'}
              {filtered ? ' match these filters' : ''}
              {totalCount > INVOICE_PAGE_SIZE && ` · showing ${showingFrom}–${showingTo}`}
              {outstanding !== null && outstanding > 0 && (
                <>
                  {' · '}
                  <span className="amount font-semibold text-ink">{formatCurrency(outstanding)}</span> outstanding
                </>
              )}
            </>
          )}
        </p>
        <Link to="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">
          Outstanding and aging <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : invoices.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={FileText}
              title="No invoices match these filters"
              description="Try another type or status, or clear the filters to see every invoice."
              action={{ label: 'Clear filters', onClick: clearFilters }}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description={
                canEdit
                  ? 'Create the first invoice to start billing. It is saved as a draft until you finalize it.'
                  : 'Invoices raised by the outlets will appear here.'
              }
              action={canEdit ? { label: 'New invoice', onClick: () => navigate('/invoices/create') } : undefined}
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Client</th>
                    <th scope="col">Date · type</th>
                    <th scope="col" className="text-right">Total</th>
                    <th scope="col" className="text-right">Balance due</th>
                    <th scope="col">Status</th>
                    <th scope="col" data-nolabel className="w-px"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const busy = downloadingId === invoice.id;
                    const rowState =
                      invoice.status === 'draft'
                        ? 'row-draft'
                        : invoice.status === 'cancelled'
                          ? 'row-void'
                          : isOverdue(invoice)
                            ? 'row-overdue'
                            : undefined;
                    return (
                      <tr key={invoice.id} className={rowState}>
                        <td className="whitespace-nowrap">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="serial font-semibold text-ink hover:text-brand-primary"
                          >
                            {invoice.invoice_number || 'Draft'}
                          </Link>
                          {/* Phones hide the date column; keep the date on every card. */}
                          {invoice.issued_at && (
                            <span className="block text-sm font-normal text-ink-muted sm:hidden">
                              {formatDate(invoice.issued_at, 'short')}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[15rem]">
                          <div className="min-w-0">
                            <span className="block truncate text-ink">{invoice.clients?.name || 'Unknown client'}</span>
                            {invoice.events?.event_name && (
                              <span className="block truncate text-sm text-ink-muted">{invoice.events.event_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="cell-hide-sm whitespace-nowrap">
                          <span className="block text-ink">{invoice.issued_at ? formatDate(invoice.issued_at, 'short') : '—'}</span>
                          <span className="block text-sm text-ink-muted">{INVOICE_TYPE_LABEL[invoice.invoice_type] ?? invoice.invoice_type}</span>
                        </td>
                        <td className="amount cell-hide-sm text-right font-semibold text-ink">{formatCurrency(invoice.grand_total)}</td>
                        <td className="amount cell-emph text-right">
                          <BalanceCell invoice={invoice} />
                        </td>
                        <td><StatusBadge kind="invoice" status={invoice.status} /></td>
                        <td className="text-right">
                          {canEdit && invoice.status === 'draft' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={finalizing}
                              onClick={() =>
                                setConfirmFinalize({
                                  invoiceId: invoice.id,
                                  invoiceNumber: invoice.invoice_number,
                                })
                              }
                            >
                              Finalize
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={busy}
                              onClick={() => void handleDownload(invoice)}
                              aria-label={`Download ${invoice.invoice_number || 'invoice'} as PDF`}
                            >
                              {!busy && <Download className="h-4 w-4" aria-hidden="true" />}
                              PDF
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalCount > INVOICE_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule px-4 py-3">
                <nav className="flex items-center gap-3" aria-label="Pages">
                  <span className="tabular text-sm text-ink-muted">
                    {showingFrom}–{showingTo} of {totalCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                  >
                    Next
                  </Button>
                </nav>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Confirmation Dialog - Finalize */}
      <ConfirmDialog
        isOpen={!!confirmFinalize}
        title="Finalize this invoice?"
        message={`After finalizing, invoice ${confirmFinalize?.invoiceNumber} can no longer be edited.`}
        confirmLabel="Finalize invoice"
        variant="info"
        isLoading={finalizing}
        onConfirm={() => confirmFinalize && handleFinalize(confirmFinalize.invoiceId)}
        onCancel={() => setConfirmFinalize(null)}
      />

    </div>
  );
}

/**
 * Balance due from invoices_with_payment_status (merged into each row by
 * getInvoices). Drafts and cancelled invoices owe nothing. If the balance
 * lookup failed, a finalized invoice (no payments yet) falls back to its
 * total and a part-paid one points to the invoice.
 */
function BalanceCell({ invoice }: { invoice: InvoiceListRow }) {
  if (invoice.status === 'paid') return <span className="text-stamp">{formatCurrency(0)}</span>;
  if (invoice.status === 'finalized' || invoice.status === 'partially_paid') {
    const due = invoice.balance_due ?? (invoice.status === 'finalized' ? invoice.grand_total : null);
    if (due === null) {
      return (
        <span className="text-ink-muted">
          —<span className="sr-only">balance shown on the invoice</span>
        </span>
      );
    }
    const days = issuedDays(invoice);
    const late = days !== null && days > 30;
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <span className={cn('font-semibold', due > 0 && late ? 'text-overdue' : 'text-ink')}>
          {formatCurrency(due)}
        </span>
        {due > 0 && days !== null && <AgingBar days={days} />}
      </div>
    );
  }
  if (invoice.status === 'draft') {
    // Desktop already shows the total in its own column. Phones hide that
    // column, so the card shows the draft's total here, captioned so it
    // isn't read as money owed.
    return (
      <span>
        <span className="hidden text-ink-faint sm:inline">—</span>
        <span className="inline-flex flex-col items-end sm:hidden">
          <span className="text-ink">{formatCurrency(invoice.grand_total)}</span>
          <span className="text-xs font-normal text-ink-muted">draft total</span>
        </span>
      </span>
    );
  }
  return <span className="text-ink-faint">—</span>;
}

/** Whole days since the invoice date (issued_at), local calendar; null for undated rows. */
function issuedDays(invoice: InvoiceListRow): number | null {
  return invoice.issued_at ? daysSince(toLocalISODate(new Date(invoice.issued_at))) : null;
}

/** Issued, still owing, and dated more than 30 days ago (the aging report's 31+ bucket). */
function isOverdue(invoice: InvoiceListRow): boolean {
  if (invoice.status !== 'finalized' && invoice.status !== 'partially_paid') return false;
  if (invoice.balance_due !== null && invoice.balance_due !== undefined && invoice.balance_due <= 0) return false;
  const days = issuedDays(invoice);
  return days !== null && days > 30;
}
