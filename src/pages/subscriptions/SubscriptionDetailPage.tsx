import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FilePlus2, Package, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  getSubscriptionPriceHistory,
} from '@/services/subscriptionService';
import type { Subscription } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { StatusStamp } from '@/components/ui/StatusStamp';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate, formatBillingCycle } from '@/utils/billingDate';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { PlannedKit, QuestionnaireAnswers } from './SubscriptionReference';

// ================================================================
// SUBSCRIPTION DETAIL — one corporate subscription as a bill-book page.
// Header (client · cycle, stamped status, New invoice) → money strip
// → details + planning notes → price history ledger.
// Nothing here raises invoices automatically; the next billing date is
// a plan the manager acts on with "New invoice".
// ================================================================

const CYCLE_LABEL: Record<Subscription['billing_cycle'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const fmtCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const fmtDateTime = formatDateTime;

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Subscription');
  useDocumentTitle(pageTitle);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  // Presentational: press the status stamp in after a state change made here.
  const [stampAnimate, setStampAnimate] = useState(false);

  // V1: Price history for audit trail
  const [priceHistory, setPriceHistory] = useState<Array<{
    id: string;
    subscription_id: string;
    old_price: number;
    new_price: number;
    changed_by: string | null;
    reason: string;
    created_at: string;
    changed_by_name?: string;
  }>>([]);

  const [historyError, setHistoryError] = useState<string | null>(null);

  // Only the latest load may write state (the :id can change while a load is in flight).
  const requestId = useRef(0);

  const loadSubscription = useCallback(async () => {
    if (!id) return;
    const req = ++requestId.current;

    try {
      setLoading(true);
      const data = await getSubscriptionById(id);
      if (req !== requestId.current) return;

      if (!data) {
        setSubscription(null);
        setError('Subscription not found or you do not have access');
        return;
      }

      setSubscription(data);
      setPageTitle(`${data.clients?.name || 'Subscription'} · Subscription`);

      // V1: Load price history (optional; failure is shown, not hidden)
      try {
        const history = await getSubscriptionPriceHistory(id);
        if (req !== requestId.current) return;
        setPriceHistory(history);
        setHistoryError(null);
      } catch (historyErr) {
        if (req !== requestId.current) return;
        setHistoryError(historyErr instanceof Error ? historyErr.message : 'Could not load price history');
      }
    } catch (err) {
      if (req === requestId.current) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
      }
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [id]);

  // New :id: start clean so the previous subscription (or its error) is never shown.
  useEffect(() => {
    setSubscription(null);
    setError(null);
    setPriceHistory([]);
    setHistoryError(null);
    setStampAnimate(false);
    void loadSubscription();
  }, [loadSubscription]);

  async function handleAction(action: 'pause' | 'resume' | 'cancel') {
    if (!user?.id || !id || actionLoading) return;

    try {
      setActionLoading(true);
      setError(null);

      if (action === 'pause') {
        await pauseSubscription(user.id, id);
        showToast('Subscription paused', 'success');
      } else if (action === 'resume') {
        await resumeSubscription(user.id, id);
        showToast('Subscription resumed', 'success');
      } else if (action === 'cancel') {
        await cancelSubscription(user.id, id);
        showToast('Subscription cancelled', 'success');
      }

      setConfirmAction(null);
      setStampAnimate(true);
      await loadSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} subscription`;
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // First load only: keep the page on refetch after an action.
  if (loading && !subscription) {
    return <DetailSkeleton />;
  }

  if (!subscription) {
    return (
      <div className="max-w-3xl">
        <PageHeader back={{ to: '/subscriptions', label: 'Subscriptions' }} title="Subscription not found" />
        <Alert variant="error">{error || 'Subscription not found'}</Alert>
        <LinkButton to="/subscriptions" variant="outline" className="mt-4">
          Back to subscriptions
        </LinkButton>
      </div>
    );
  }

  const clientName = subscription.clients?.name || 'Unknown client';
  const isOpen = subscription.status === 'active' || subscription.status === 'paused';
  const value = subscription.quantity * subscription.price_per_unit;

  return (
    <div>
      <PageHeader
        back={{ to: '/subscriptions', label: 'Subscriptions' }}
        title={
          <>
            {clientName} <span className="font-semibold text-ink-muted">· {CYCLE_LABEL[subscription.billing_cycle] ?? subscription.billing_cycle}</span>
          </>
        }
        meta={
          <StatusStamp
            kind="subscription"
            status={subscription.status}
            detail={subscription.status === 'cancelled' && subscription.end_date ? `Ended ${formatDate(subscription.end_date)}` : undefined}
            animate={stampAnimate}
          />
        }
        description={['Corporate subscription', subscription.outlets?.name].filter(Boolean).join(' · ')}
        actions={
          canEdit && (
            <>
              <LinkButton to={`/invoices/create?subscription_id=${subscription.id}`}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New invoice
              </LinkButton>
              {/* The DB only accepts dispatches to an active subscription (migration 042). */}
              {subscription.status === 'active' && (
                <LinkButton to={`/inventory/allocate?type=subscription&ref=${id}`} variant="outline">
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Allocate dishware
                </LinkButton>
              )}
              {subscription.status !== 'cancelled' && (
                <>
                  <LinkButton to={`/subscriptions/${id}/edit`} variant="outline">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </LinkButton>
                </>
              )}
              {subscription.status === 'active' && (
                <Button type="button" variant="outline" onClick={() => setConfirmAction('pause')} disabled={actionLoading}>
                  Pause
                </Button>
              )}
              {subscription.status === 'paused' && (
                <Button type="button" variant="outline" onClick={() => setConfirmAction('resume')} disabled={actionLoading}>
                  Resume
                </Button>
              )}
              {isOpen && (
                <Button type="button" variant="danger" onClick={() => setConfirmAction('cancel')} disabled={actionLoading}>
                  Cancel subscription
                </Button>
              )}
            </>
          )
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Money strip: what one cycle is worth, the loudest figure. */}
      <section
        aria-label="Billing figures"
        className="sheet mb-6 grid sm:grid-cols-2 lg:grid-cols-4 [&>*]:border-rule"
      >
        <Figure label="Quantity" hint="Units billed each cycle" className="max-lg:border-b">
          {fmtCount(subscription.quantity)}
        </Figure>
        <Figure label="Price per unit" hint="Agreed rate" className="max-lg:border-b sm:border-l">
          {formatCurrency(subscription.price_per_unit)}
        </Figure>
        <Figure
          label="Value per cycle"
          hint={`${fmtCount(subscription.quantity)} × ${formatCurrency(subscription.price_per_unit)}, ${formatBillingCycle(subscription.billing_cycle, subscription.billing_day).toLowerCase()}`}
          big
          className="max-sm:border-b lg:border-l"
        >
          <span className={cn(subscription.status === 'cancelled' ? 'text-ink-muted' : 'text-ink')}>{formatCurrency(value)}</span>
        </Figure>
        <Figure
          label="Next billing date (planned)"
          hint={
            subscription.status === 'active'
              ? 'Raise the invoice by hand on this date'
              : subscription.status === 'paused'
                ? 'Not planned while paused'
                : 'No further billing'
          }
          className="sm:border-l"
        >
          {subscription.status === 'active' ? (
            <span className="whitespace-nowrap">{formatDate(subscription.next_billing_date)}</span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Figure>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Details */}
        <section className="sheet" aria-labelledby="details-h">
          <h2 id="details-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">
            Details
          </h2>
          <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
            <DetailItem label="Client">
              <Link to={`/clients/${subscription.client_id}`} className="font-semibold text-ink hover:text-brand-primary">
                {clientName}
              </Link>
              {subscription.clients?.phone && (
                <span className="block text-sm font-normal text-ink-muted">{subscription.clients.phone}</span>
              )}
            </DetailItem>
            <DetailItem label="Outlet">
              {subscription.outlets?.name || '—'}
              {(subscription.outlets?.code || subscription.outlets?.city) && (
                <span className="block text-sm font-normal text-ink-muted">
                  {subscription.outlets?.code && <span className="serial">{subscription.outlets.code}</span>}
                  {subscription.outlets?.code && subscription.outlets?.city && ' · '}
                  {subscription.outlets?.city}
                </span>
              )}
            </DetailItem>
            <DetailItem label="Billing cycle">
              {formatBillingCycle(subscription.billing_cycle, subscription.billing_day)}
            </DetailItem>
            <DetailItem label="Start date">{formatDate(subscription.start_date, 'long')}</DetailItem>
            {subscription.end_date && <DetailItem label="End date">{formatDate(subscription.end_date, 'long')}</DetailItem>}
            <DetailItem label="Created">{fmtDateTime(subscription.created_at)}</DetailItem>
            <DetailItem label="Last updated">{fmtDateTime(subscription.updated_at)}</DetailItem>
          </dl>
          <div className="border-t border-rule px-5 py-5">
            <h3 className="text-sm font-semibold text-ink">Pricing notes</h3>
            {subscription.notes ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">{subscription.notes}</p>
            ) : (
              <p className="mt-1 text-sm text-ink-faint">No pricing notes recorded.</p>
            )}
          </div>
        </section>

        {/* Planning notes: kit + questionnaire (reference only) */}
        <div className="space-y-6">
          <section className="sheet" aria-labelledby="kit-h">
            <div className="border-b border-rule px-5 py-4">
              <h2 id="kit-h" className="text-lg font-semibold text-ink">Planned dishware kit</h2>
              <p className="text-sm text-ink-muted">A plan only. Stock is not reserved or sent until it is allocated.</p>
            </div>
            <div className="px-5 py-4">
              <PlannedKit subscription={subscription} />
            </div>
          </section>

          <section className="sheet" aria-labelledby="questionnaire-h">
            <div className="border-b border-rule px-5 py-4">
              <h2 id="questionnaire-h" className="text-lg font-semibold text-ink">Questionnaire answers</h2>
              <p className="text-sm text-ink-muted">For operations planning and ESG reporting. Does not affect price.</p>
            </div>
            <div className="px-5 py-4">
              <QuestionnaireAnswers subscription={subscription} />
            </div>
          </section>
        </div>
      </div>

      {/* Price history ledger */}
      <section className="sheet mt-6 overflow-hidden" aria-labelledby="history-h">
        <div className="border-b border-rule px-5 py-4">
          <h2 id="history-h" className="text-lg font-semibold text-ink">Price history</h2>
          <p className="text-sm text-ink-muted">Every change to the price per unit, with the reason given.</p>
        </div>
        {historyError ? (
          <div className="p-5">
            <Alert variant="warning">Could not load price history: {historyError}</Alert>
          </div>
        ) : priceHistory.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">
            The price has not changed since this subscription was created.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Changed on</th>
                  <th scope="col" className="text-right">Old price</th>
                  <th scope="col" className="text-right">New price</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Changed by</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap text-ink-muted">{fmtDateTime(entry.created_at)}</td>
                    <td className="amount text-right text-ink-muted line-through decoration-ink-faint">
                      {formatCurrency(entry.old_price)}
                    </td>
                    <td className="amount text-right font-semibold text-ink">{formatCurrency(entry.new_price)}</td>
                    <td className="min-w-[14rem] max-w-md whitespace-pre-wrap break-words">{entry.reason}</td>
                    <td className="whitespace-nowrap text-ink-muted">{entry.changed_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirmAction === 'pause'}
        title="Pause this subscription?"
        message="It is marked paused for reference. Invoices are raised by hand, so nothing is generated automatically either way."
        confirmLabel="Pause subscription"
        variant="warning"
        isLoading={actionLoading}
        onConfirm={() => handleAction('pause')}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'resume'}
        title="Resume this subscription?"
        message="The next billing date will be recalculated from today."
        confirmLabel="Resume subscription"
        variant="info"
        isLoading={actionLoading}
        onConfirm={() => handleAction('resume')}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Cancel this subscription?"
        message={`The subscription for ${clientName} will be cancelled for good. This cannot be undone.`}
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={() => handleAction('cancel')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function Figure({
  label, hint, big, className, children,
}: { label: string; hint: string; big?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 px-5 py-4 sm:px-6 sm:py-5', className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-3xl sm:text-4xl' : 'text-2xl')}>{children}</div>
      <div className="mt-1 truncate text-sm text-ink-muted" title={hint}>{hint}</div>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading subscription">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-2 h-8 w-72 max-w-full" />
      <Skeleton className="mb-8 h-4 w-48" />
      <div className="sheet mb-6 grid grid-cols-2 gap-6 p-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="sheet space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
        <div className="sheet space-y-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
      </div>
    </div>
  );
}
