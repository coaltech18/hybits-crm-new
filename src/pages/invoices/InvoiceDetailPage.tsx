import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInvoiceById, finalizeInvoice, cancelInvoice } from '@/services/invoiceService';
import { getPaymentSummary } from '@/services/paymentService';
import { downloadInvoicePDF } from '@/utils/invoicePdfGenerator';
import type { Invoice, Payment, PaymentStatus } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, StatusStamp } from '@/components/ui/StatusStamp';
import { AgingBar } from '@/components/ui/AgingBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDateTime, roundCurrency, settleBalance, isSettled } from '@/utils/format';
import { formatDate } from '@/utils/billingDate';
import { daysSince, toLocalISODate } from '@/utils/date';
import { cn } from '@/utils/cn';
import AddPaymentModal from '@/components/payments/AddPaymentModal';
import { ChevronDown, Copy, Download, IndianRupee, Pencil, Stamp, XCircle } from 'lucide-react';
import { COMPANY_PROFILE } from '@/config/companyProfile';
import { DEFAULT_HSN_CODE } from '@/config/gstConstants';
import { BILLED_STATUSES, INVOICE_TYPE_LABEL, PAYMENT_METHOD_LABEL, gstBreakup, gstTypeLabel } from './invoiceDisplay';

// ================================================================
// INVOICE DETAIL — one page of the bill book.
// Serial + stamp → money strip (balance due loudest) → the printed
// bill (parties, particulars, line items, GST totals, bank & terms)
// → payments ledger with the running balance.
// ================================================================

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Invoice Details');
  useDocumentTitle(pageTitle);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'cancel' | null>(null);

  // Payment state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{
    amount_paid: number;
    balance_due: number;
    payment_status: PaymentStatus;
  } | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Presentational only: press the status stamp in when THIS session changed
  // the status (finalize, or a payment that moved it). Holds the status
  // before the change until the refreshed invoice arrives.
  const stampFrom = useRef<string | null>(null);
  const [stampPressed, setStampPressed] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  /** Load the invoice. `silent` refreshes in place without the full-page spinner. */
  const loadInvoice = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!id) return;

    try {
      if (!options.silent) setLoading(true);
      const data = await getInvoiceById(id);

      if (!data) {
        setInvoice(null);
        setError('Invoice not found or you do not have access');
        return;
      }

      setInvoice(data);
      setPageTitle(`Invoice ${data.invoice_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [id]);

  const loadPayments = useCallback(async () => {
    if (!id) return;

    try {
      const summary = await getPaymentSummary(id);
      setPayments(summary.payments);
      setPaymentSummary({
        amount_paid: summary.amount_paid,
        balance_due: summary.balance_due,
        payment_status: summary.payment_status,
      });
      setPaymentsError(null);
    } catch (err) {
      console.error('Failed to load payments:', err);
      setPaymentsError(err instanceof Error ? err.message : 'Failed to load payments');
    }
  }, [id]);

  useEffect(() => {
    void loadInvoice();
    void loadPayments();
  }, [loadInvoice, loadPayments]);

  useEffect(() => {
    if (!invoice || stampFrom.current === null) return;
    if (invoice.status !== stampFrom.current) setStampPressed(true);
    stampFrom.current = null;
  }, [invoice]);

  async function handleDownload() {
    if (!invoice || downloading) return;
    try {
      setDownloading(true);
      await downloadInvoicePDF(invoice);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download the PDF', 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleAction(action: 'finalize' | 'cancel') {
    if (!user?.id || !id || actionLoading) return;

    try {
      setActionLoading(true);
      setError(null);

      if (action === 'finalize') {
        await finalizeInvoice(user.id, id);
        stampFrom.current = invoice?.status ?? null;
        showToast('Invoice finalized successfully', 'success');
      } else if (action === 'cancel') {
        await cancelInvoice(user.id, id);
        showToast('Invoice cancelled', 'success');
      }

      setConfirmAction(null);
      await Promise.all([loadInvoice({ silent: true }), loadPayments()]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} invoice`;
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePaymentAdded() {
    // AddPaymentModal shows its own success toast
    stampFrom.current = invoice?.status ?? null;
    setShowAddPayment(false);
    // The DB moved the invoice status with the payment, so refresh both cards
    await Promise.all([loadInvoice({ silent: true }), loadPayments()]);
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!invoice) {
    return (
      <div>
        <PageHeader back={{ to: '/invoices', label: 'Invoices' }} title="Invoice" />
        <Alert variant="error">{error || 'Invoice not found'}</Alert>
      </div>
    );
  }

  // Issued invoices print the party as it was at finalization (042 snapshot), not live client data
  const billTo = {
    name: invoice.client_name_snap ?? invoice.clients?.name,
    gstin: invoice.client_gstin_snap ?? invoice.clients?.gstin,
    address: invoice.client_address_snap ?? invoice.clients?.billing_address,
    gstType: invoice.client_gst_type_snap ?? invoice.clients?.gst_type,
  };

  // ---- Presentation-only derivations ----
  const billed = BILLED_STATUSES.includes(invoice.status);
  const isDraftEditable = canEdit && invoice.status === 'draft';
  const canRecordPayment = canEdit && billed && !!paymentSummary && !isSettled(paymentSummary.balance_due);
  const downloadIsPrimary = !isDraftEditable && !canRecordPayment && invoice.status !== 'cancelled';
  const downloadLabel = downloading
    ? 'Preparing PDF…'
    : invoice.status === 'draft'
      ? 'Download draft'
      : invoice.status === 'cancelled'
        ? 'Download (cancelled)'
        : 'Download PDF';

  const isDraft = invoice.status === 'draft';
  const isCancelled = invoice.status === 'cancelled';
  const balance = paymentSummary ? settleBalance(paymentSummary.balance_due) : null;
  const ageDays = invoice.issued_at ? daysSince(toLocalISODate(new Date(invoice.issued_at))) : 0;
  const lastPaymentDate = payments.reduce<string | null>(
    (latest, p) => (!latest || p.payment_date > latest ? p.payment_date : latest),
    null
  );
  const stampDetail = invoice.status === 'paid' && lastPaymentDate ? formatDate(lastPaymentDate, 'short') : undefined;
  const gst = gstBreakup(invoice.tax_total, billTo.gstType);
  const items = invoice.invoice_items ?? [];

  const balanceTone =
    billed && balance !== null
      ? balance === 0
        ? 'text-stamp'
        : balance > 0 && ageDays > 30
          ? 'text-overdue'
          : 'text-ink'
      : 'text-ink-muted';

  const moreItems: MenuItem[] = [];
  if (canEdit) {
    moreItems.push({
      label: 'Duplicate as new draft',
      icon: Copy,
      onSelect: () => navigate(`/invoices/create?duplicate=${encodeURIComponent(invoice.id)}`),
    });
  }
  if (isDraftEditable) {
    moreItems.push({
      label: 'Cancel invoice',
      icon: XCircle,
      tone: 'danger',
      disabled: actionLoading,
      onSelect: () => setConfirmAction('cancel'),
    });
  }

  const description = [
    `${INVOICE_TYPE_LABEL[invoice.invoice_type] ?? invoice.invoice_type} invoice`,
    billTo.name,
    invoice.issued_at ? `Dated ${formatDate(invoice.issued_at, 'short')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <PageHeader
        back={{ to: '/invoices', label: 'Invoices' }}
        title={
          invoice.invoice_number ? (
            <span className={cn('serial text-[1em]', isCancelled && 'text-void line-through decoration-void/70')}>
              {invoice.invoice_number}
            </span>
          ) : (
            'Draft invoice'
          )
        }
        meta={
          <StatusStamp
            key={invoice.status}
            kind="invoice"
            status={invoice.status}
            detail={stampDetail}
            animate={stampPressed}
          />
        }
        description={description}
        actions={
          <>
            {isDraftEditable && (
              <Button onClick={() => setConfirmAction('finalize')} disabled={actionLoading}>
                <Stamp className="h-4 w-4" aria-hidden="true" />
                Finalize invoice
              </Button>
            )}
            {canRecordPayment && (
              <Button onClick={() => setShowAddPayment(true)}>
                <IndianRupee className="h-4 w-4" aria-hidden="true" />
                Record payment
              </Button>
            )}
            {isDraftEditable && (
              <LinkButton to={`/invoices/${id}/edit`} variant="outline">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </LinkButton>
            )}
            <Button variant={downloadIsPrimary ? 'primary' : 'outline'} onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloadLabel}
            </Button>
            {moreItems.length > 0 && <MoreMenu items={moreItems} />}
          </>
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Money strip: balance due is the loudest figure. */}
      <section
        aria-label="Invoice amounts"
        className="sheet mb-6 grid grid-cols-1 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <Figure label="Invoice total" hint={`${formatCurrency(invoice.subtotal)} + ${formatCurrency(invoice.tax_total)} GST`}>
          {formatCurrency(invoice.grand_total)}
        </Figure>
        <Figure
          label="Paid"
          hint={
            !billed
              ? 'Payments start once the invoice is finalized'
              : paymentsError
                ? 'Could not load payments'
                : `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded`
          }
        >
          {billed && paymentSummary ? formatCurrency(paymentSummary.amount_paid) : '—'}
        </Figure>
        <Figure
          big
          label="Balance due"
          hint={
            invoice.status === 'draft' ? (
              'Not billed until finalized'
            ) : invoice.status === 'cancelled' ? (
              'Nothing is due on a cancelled invoice'
            ) : balance === null ? (
              'Could not load the balance'
            ) : balance === 0 ? (
              'Settled in full'
            ) : invoice.issued_at ? (
              <span className="inline-flex items-center gap-2">
                <AgingBar days={ageDays} pxPerDay={0.9} />
                <span>since the invoice date</span>
              </span>
            ) : (
              'Outstanding'
            )
          }
        >
          <span className={balanceTone}>{billed && balance !== null ? formatCurrency(balance) : '—'}</span>
        </Figure>
      </section>

      {/* The printed bill */}
      <article
        className={cn('sheet mb-6 overflow-hidden', isDraft && 'border-draft-rule bg-draft-tint/40')}
        aria-labelledby="bill-h"
      >
        <h2 id="bill-h" className="sr-only">{isDraft ? 'Draft invoice' : 'Tax invoice'}</h2>
        {isDraft && (
          <p className="border-b border-draft-rule px-5 py-2 text-sm font-medium text-draft sm:px-6">
            Draft — not a tax invoice until finalized
          </p>
        )}

        {/* Parties */}
        <div className="grid gap-6 border-b border-rule px-5 py-5 sm:px-6 md:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">From</p>
            <p className="mt-1.5 text-base font-semibold text-ink">{COMPANY_PROFILE.legalName}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              GSTIN <span className="serial text-ink">{invoice.supplier_gstin_snap || COMPANY_PROFILE.gstin}</span>
            </p>
            {invoice.outlets && (
              <div className="mt-3 space-y-0.5 text-sm text-ink-muted">
                <p>
                  <span className="font-medium text-ink">{invoice.outlets.name}</span>{' '}
                  <span className="serial">({invoice.outlets.code})</span>
                </p>
                {invoice.outlets.address && (
                  <p>
                    {invoice.outlets.address}, {invoice.outlets.city}, {invoice.outlets.state}
                  </p>
                )}
                {invoice.outlets.phone && <p>{invoice.outlets.phone}</p>}
                {invoice.outlets.email && <p className="break-all">{invoice.outlets.email}</p>}
              </div>
            )}
          </div>

          <div className="min-w-0 md:border-l md:border-rule md:pl-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Bill to</p>
            <p className="mt-1.5 text-base font-semibold text-ink">{billTo.name ?? '—'}</p>
            {billTo.gstin && (
              <p className="mt-0.5 text-sm text-ink-muted">
                GSTIN <span className="serial text-ink">{billTo.gstin}</span>
              </p>
            )}
            <div className="mt-3 space-y-0.5 text-sm text-ink-muted">
              {billTo.address && <p className="whitespace-pre-line">{billTo.address}</p>}
              {invoice.clients?.phone && <p>{invoice.clients.phone}</p>}
              {invoice.clients?.email && <p className="break-all">{invoice.clients.email}</p>}
            </div>
          </div>
        </div>

        {/* Particulars */}
        <dl
          className={cn(
            'grid grid-cols-2 gap-x-6 gap-y-4 border-b border-rule px-5 py-4 sm:px-6 md:grid-cols-4',
            isDraft ? 'bg-draft-tint/40' : 'bg-paper'
          )}
        >
          <Particular label="Invoice no.">
            <span className="serial">{invoice.invoice_number || '—'}</span>
          </Particular>
          <Particular label="Invoice date">{invoice.issued_at ? formatDate(invoice.issued_at, 'short') : '—'}</Particular>
          <Particular label="Invoice type">{INVOICE_TYPE_LABEL[invoice.invoice_type] ?? invoice.invoice_type}</Particular>
          <Particular label="Supply">{gstTypeLabel(billTo.gstType)}</Particular>
          {invoice.invoice_type === 'event' && invoice.events && (
            <>
              <Particular label="Event">{invoice.events.event_name}</Particular>
              <Particular label="Event date">{formatDate(invoice.events.event_date, 'short')}</Particular>
              {invoice.events.event_type && <Particular label="Event type">{invoice.events.event_type}</Particular>}
            </>
          )}
        </dl>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col" className="w-10">#</th>
                <th scope="col">Description</th>
                <th scope="col">HSN/SAC</th>
                <th scope="col" className="text-right">Qty</th>
                <th scope="col" className="text-right">Unit price</th>
                <th scope="col" className="text-right">Taxable value</th>
                <th scope="col" className="text-right">GST %</th>
                <th scope="col" className="text-right">Tax</th>
                <th scope="col" className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-ink-muted">
                    No line items on this invoice.
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="text-ink-muted">{i + 1}</td>
                    <td className="min-w-[14rem] text-ink">{item.description}</td>
                    <td className="serial text-ink-muted">{DEFAULT_HSN_CODE}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="amount text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="amount text-right">{formatCurrency(item.line_total)}</td>
                    <td className="text-right">{item.tax_rate}%</td>
                    <td className="amount text-right">{formatCurrency(item.tax_amount)}</td>
                    <td className="amount text-right font-semibold text-ink">
                      {formatCurrency(item.line_total + item.tax_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-rule px-5 py-4 sm:px-6">
          <dl className="ml-auto w-full max-w-sm space-y-2 text-sm">
            <TotalRow label="Subtotal">{formatCurrency(invoice.subtotal)}</TotalRow>
            {gst.igst ? (
              <TotalRow label="IGST">{formatCurrency(gst.igstAmount)}</TotalRow>
            ) : (
              <>
                <TotalRow label="CGST">{formatCurrency(gst.cgst)}</TotalRow>
                <TotalRow label="SGST">{formatCurrency(gst.sgst)}</TotalRow>
              </>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3">
              <dt className="font-bold text-ink">Grand total</dt>
              <dd
                className={cn(
                  'amount text-2xl font-bold',
                  isCancelled ? 'text-void line-through decoration-void/70' : 'text-ink'
                )}
              >
                {formatCurrency(invoice.grand_total)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Bank details & terms, as at the foot of the printed bill */}
        {(COMPANY_PROFILE.bankDetails || invoice.terms_and_conditions) && (
          <div className="grid gap-6 border-t border-rule bg-paper px-5 py-5 sm:px-6 md:grid-cols-2">
            {COMPANY_PROFILE.bankDetails && (
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Bank details for payment</h3>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-ink-muted">Account name</dt>
                  <dd className="font-medium text-ink">{COMPANY_PROFILE.bankDetails.accountName}</dd>
                  <dt className="text-ink-muted">Bank</dt>
                  <dd className="font-medium text-ink">{COMPANY_PROFILE.bankDetails.bankName}</dd>
                  <dt className="text-ink-muted">Account no.</dt>
                  <dd className="serial font-medium text-ink">{COMPANY_PROFILE.bankDetails.accountNumber}</dd>
                  <dt className="text-ink-muted">IFSC</dt>
                  <dd className="serial font-medium text-ink">{COMPANY_PROFILE.bankDetails.ifscCode}</dd>
                  {COMPANY_PROFILE.bankDetails.branch && (
                    <>
                      <dt className="text-ink-muted">Branch</dt>
                      <dd className="font-medium text-ink">{COMPANY_PROFILE.bankDetails.branch}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}
            {invoice.terms_and_conditions && (
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Terms and conditions</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{invoice.terms_and_conditions}</p>
              </div>
            )}
          </div>
        )}
      </article>

      {/* Payments ledger */}
      {billed && (
        <section className="sheet mb-6 overflow-hidden" aria-labelledby="payments-h">
          <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-4 sm:px-6">
            <h2 id="payments-h" className="text-lg font-semibold text-ink">Payments</h2>
            {paymentSummary && <StatusBadge kind="payment" status={paymentSummary.payment_status} />}
          </div>

          {paymentsError ? (
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <Alert variant="error">Could not load payments: {paymentsError}</Alert>
              <Button variant="outline" size="sm" onClick={() => void loadPayments()}>
                Try again
              </Button>
            </div>
          ) : payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Method</th>
                    <th scope="col">Reference</th>
                    <th scope="col" className="text-right">Amount</th>
                    <th scope="col" className="text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => {
                    // Calculate running balance - use roundCurrency to prevent drift
                    const paymentsUpTo = payments.slice(index);
                    const amountPaid = roundCurrency(paymentsUpTo.reduce((sum, p) => sum + p.amount, 0));
                    const balanceAfter = roundCurrency(invoice.grand_total - amountPaid);
                    const after = settleBalance(balanceAfter);

                    return (
                      <tr key={payment.id}>
                        <td className="whitespace-nowrap">{formatDate(payment.payment_date, 'short')}</td>
                        <td>{PAYMENT_METHOD_LABEL[payment.payment_method] ?? payment.payment_method.replace('_', ' ')}</td>
                        <td className={cn(payment.reference_number ? 'serial text-ink' : 'text-ink-muted')}>
                          {payment.reference_number || '—'}
                        </td>
                        <td className="amount text-right font-semibold text-ink">{formatCurrency(payment.amount)}</td>
                        <td className={cn('amount text-right font-medium', after === 0 ? 'text-stamp' : 'text-ink')}>
                          {formatCurrency(after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              No payments recorded yet.
              {canRecordPayment && ' Use “Record payment” when the client pays.'}
            </p>
          )}
        </section>
      )}

      {/* Record trail */}
      <p className="text-sm text-ink-muted">
        Created {formatDateTime(invoice.created_at)} · Last updated {formatDateTime(invoice.updated_at)}
      </p>

      {/* Add Payment Modal */}
      {showAddPayment && invoice && (
        <AddPaymentModal
          invoice={invoice}
          maxAmount={paymentSummary?.balance_due || 0}
          onClose={() => setShowAddPayment(false)}
          onSuccess={handlePaymentAdded}
        />
      )}

      {/* Confirmation Dialog - Finalize */}
      <ConfirmDialog
        isOpen={confirmAction === 'finalize'}
        title="Finalize this invoice?"
        message="After finalizing, this invoice can no longer be edited."
        confirmLabel="Finalize invoice"
        variant="info"
        isLoading={actionLoading}
        onConfirm={() => handleAction('finalize')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation Dialog - Cancel */}
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Cancel this invoice?"
        message="The invoice will be marked as cancelled. This cannot be undone."
        confirmLabel="Cancel invoice"
        cancelLabel="Keep invoice"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={() => handleAction('cancel')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// Local pieces
// ----------------------------------------------------------------

function Figure({
  label, hint, big, children,
}: { label: string; hint: React.ReactNode; big?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6 sm:py-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-4xl' : 'text-2xl')}>
        {children}
      </div>
      <div className="mt-1 text-sm text-ink-muted">{hint}</div>
    </div>
  );
}

function Particular({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function TotalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="amount font-medium text-ink">{children}</dd>
    </div>
  );
}

interface MenuItem {
  label: string;
  icon: typeof Copy;
  onSelect: () => void;
  tone?: 'danger';
  disabled?: boolean;
}

/**
 * Accessible "More" menu: a button with aria-haspopup/expanded, a role="menu"
 * list, arrow keys / Home / End to move, Escape or Tab to close, and focus
 * returned to the button.
 */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  // Open towards whichever side has room (the header actions wrap on phones).
  const [alignRight, setAlignRight] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const trigger = () => wrapRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]') ?? null;
  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) trigger()?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const els = menuItems();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          const rect = trigger()?.getBoundingClientRect();
          if (rect) setAlignRight(rect.right - 240 >= 8);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            const rect = trigger()?.getBoundingClientRect();
            if (rect) setAlignRight(rect.right - 240 >= 8);
            setOpen(true);
          }
        }}
      >
        More
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="More invoice actions"
          onKeyDown={onMenuKey}
          className={cn(
            'absolute top-full z-20 mt-1.5 w-60 rounded-lg border border-rule bg-white py-1 shadow-lift animate-fade-in',
            alignRight ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50',
                'focus:outline-none focus-visible:bg-paper-sunk',
                item.tone === 'danger' ? 'text-danger hover:bg-danger-tint' : 'text-ink hover:bg-paper-sunk'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading invoice">
      <div className="mb-6 lg:mb-8">
        <Skeleton className="mb-3 h-4 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="sheet mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <div className="sheet space-y-3 p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    </div>
  );
}
