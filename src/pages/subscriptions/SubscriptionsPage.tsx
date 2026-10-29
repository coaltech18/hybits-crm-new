import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, FilePlus2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSubscriptions, pauseSubscription, resumeSubscription, cancelSubscription } from '@/services/subscriptionService';
import { getClients } from '@/services/clientService';
import type { Subscription, SubscriptionStatus, SubscriptionFilters, Client } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate, formatBillingCycle } from '@/utils/billingDate';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

// ================================================================
// SUBSCRIPTIONS — the register of recurring corporate billing.
// Filter bar → count line → ledger (client, cycle, qty × price,
// value per cycle, next billing, status, one next action).
// Pause and cancel live on the detail page; a paused row offers Resume.
// ================================================================

const fmtCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function SubscriptionsPage() {
  useDocumentTitle('Subscriptions');

  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | ''>('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'pause' | 'resume' | 'cancel';
    subscriptionId: string;
    subscriptionName: string;
  } | null>(null);

  const userId = user?.id;

  // Client filter options: load once per user, not on every filter change
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    let stale = false;
    getClients(userId, { client_type: 'corporate' })
      .then((data) => {
        if (!stale) setClients(data);
      })
      .catch((err: unknown) => {
        if (!stale) {
          showToast(err instanceof Error ? err.message : 'Failed to load client filter', 'error');
        }
      });
    return () => {
      stale = true;
    };
  }, [isAuthReady, userId, showToast]);

  // Only the latest request may update the list (filters can change mid-flight)
  const requestSeq = useRef(0);

  const loadData = useCallback(async () => {
    if (!userId) return;
    const seq = ++requestSeq.current;

    try {
      setLoading(true);
      setError(null);

      const filters: SubscriptionFilters = {};
      if (selectedClient) filters.client_id = selectedClient;
      if (selectedStatus) filters.status = selectedStatus;

      const subsData = await getSubscriptions(userId, filters);
      if (seq === requestSeq.current) setSubscriptions(subsData);
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [userId, selectedClient, selectedStatus]);

  useEffect(() => {
    if (!isAuthReady) return;
    loadData();
  }, [isAuthReady, loadData]);

  async function handleAction(action: 'pause' | 'resume' | 'cancel', subscriptionId: string) {
    if (!user?.id || actionLoading) return;

    try {
      setActionLoading(subscriptionId);

      if (action === 'pause') {
        await pauseSubscription(user.id, subscriptionId);
        showToast('Subscription paused', 'success');
      } else if (action === 'resume') {
        await resumeSubscription(user.id, subscriptionId);
        showToast('Subscription resumed', 'success');
      } else if (action === 'cancel') {
        await cancelSubscription(user.id, subscriptionId);
        showToast('Subscription cancelled', 'success');
      }

      setConfirmAction(null);
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} subscription`;
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = Boolean(selectedClient || selectedStatus);
  const firstLoad = loading && subscriptions.length === 0;
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;

  function clearFilters() {
    setSelectedClient('');
    setSelectedStatus('');
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Recurring dishware billing for corporate clients. Invoices are raised by hand from each subscription."
        actions={
          canEdit && (
            <LinkButton to="/subscriptions/add">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New subscription
            </LinkButton>
          )
        }
      />

      {/* Filters stay mounted while the list reloads */}
      <Card padding="sm" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Select label="Client" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SubscriptionStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          {filtered && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {error && subscriptions.length === 0 && !loading ? null : (
        <>
          {!firstLoad && subscriptions.length > 0 && (
            <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
              <span className="font-semibold text-ink">
                {fmtCount(subscriptions.length)} subscription{subscriptions.length === 1 ? '' : 's'}
              </span>
              {' · '}
              {fmtCount(activeCount)} active
              {pausedCount > 0 && <> · {fmtCount(pausedCount)} paused</>}
            </p>
          )}

          <Card padding="none" className="overflow-hidden">
            {firstLoad ? (
              <TableSkeleton rows={6} cols={6} />
            ) : subscriptions.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No subscriptions match these filters"
                  description="Try another client or status, or clear the filters to see every subscription."
                  action={{ label: 'Clear filters', onClick: clearFilters }}
                />
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title="No subscriptions yet"
                  description={
                    canEdit
                      ? 'Add a subscription for a corporate client to record their cycle, quantity and price.'
                      : 'Subscriptions appear here once a manager adds them.'
                  }
                  action={canEdit ? { label: 'New subscription', onClick: () => navigate('/subscriptions/add') } : undefined}
                />
              )
            ) : (
              <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')} aria-busy={loading || undefined}>
                <table className="ledger">
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col">Cycle</th>
                      <th scope="col" className="text-right">Qty × price</th>
                      <th scope="col" className="text-right">Value per cycle</th>
                      <th scope="col">Next billing</th>
                      <th scope="col">Status</th>
                      {canEdit && (
                        <th scope="col" data-nolabel className="w-px">
                          <span className="sr-only">Action</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id} className={cn(subscription.status === 'cancelled' && 'row-void')}>
                        <td className="max-w-[18rem]">
                          <div className="inline-block max-w-full align-top">
                            <Link
                              to={`/subscriptions/${subscription.id}`}
                              className="block truncate font-semibold text-ink hover:text-brand-primary"
                            >
                              {subscription.clients?.name || 'Unknown client'}
                            </Link>
                            <span className="block truncate text-xs text-ink-muted">
                              {subscription.outlets?.name || 'Unknown outlet'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatBillingCycle(subscription.billing_cycle, subscription.billing_day)}
                        </td>
                        <td className="amount text-right text-ink-muted">
                          {fmtCount(subscription.quantity)} × {formatCurrency(subscription.price_per_unit)}
                        </td>
                        <td className="amount cell-emph text-right font-semibold text-ink">
                          {formatCurrency(subscription.quantity * subscription.price_per_unit)}
                        </td>
                        <td className="whitespace-nowrap text-ink-muted">
                          {subscription.status === 'active' ? formatDate(subscription.next_billing_date) : '—'}
                        </td>
                        <td>
                          <StatusBadge kind="subscription" status={subscription.status} />
                        </td>
                        {canEdit && (
                          <td className="whitespace-nowrap text-right">
                            {subscription.status === 'active' && (
                              <LinkButton
                                to={`/invoices/create?subscription_id=${subscription.id}`}
                                variant="outline"
                                size="sm"
                              >
                                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                                New invoice
                              </LinkButton>
                            )}
                            {subscription.status === 'paused' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'resume',
                                    subscriptionId: subscription.id,
                                    subscriptionName: subscription.clients?.name || 'Unknown',
                                  })
                                }
                                disabled={actionLoading === subscription.id}
                              >
                                Resume
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmAction?.type === 'resume'}
        title="Resume this subscription?"
        message={`Resume the subscription for ${confirmAction?.subscriptionName}? The next billing date will be recalculated from today.`}
        confirmLabel="Resume subscription"
        variant="info"
        isLoading={!!actionLoading}
        onConfirm={() => confirmAction && handleAction('resume', confirmAction.subscriptionId)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
