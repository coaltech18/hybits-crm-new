import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSubscriptionById, pauseSubscription, resumeSubscription, cancelSubscription, getSubscriptionPriceHistory } from '@/services/subscriptionService';
import type { Subscription } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate, formatBillingCycle } from '@/utils/billingDate';
import { formatCurrency } from '@/utils/format';

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Subscription Details');
  useDocumentTitle(pageTitle);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pause' | 'resume' | 'cancel' | null>(null);

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

  useEffect(() => {
    loadSubscription();
  }, [id]);

  async function loadSubscription() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getSubscriptionById(id);

      if (!data) {
        setError('Subscription not found or you do not have access');
        return;
      }

      setSubscription(data);
      setPageTitle(`Subscription - ${data.clients?.name || 'Details'}`);

      // V1: Load price history
      try {
        const history = await getSubscriptionPriceHistory(id);
        setPriceHistory(history);
      } catch {
        // Price history is optional, don't block on errors
        console.warn('Could not load price history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'pause' | 'resume' | 'cancel') {
    if (!user?.id || !id) return;

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
      await loadSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} subscription`;
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">{error || 'Subscription not found'}</Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate('/subscriptions')}>
            Back to Subscriptions
          </Button>
        </div>
      </div>
    );
  }

  const statusVariants = {
    active: 'success' as const,
    paused: 'warning' as const,
    cancelled: 'secondary' as const,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Details</h1>
          <p className="text-muted-foreground mt-1">View subscription information</p>
        </div>
        <div className="flex gap-2">
          {user?.role !== 'accountant' && subscription.status !== 'cancelled' && (
            <>
              <Link to={`/subscriptions/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>

              {subscription.status === 'active' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('pause')}
                    disabled={actionLoading}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmAction('cancel')}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                </>
              )}

              {subscription.status === 'paused' && (
                <Button
                  onClick={() => setConfirmAction('resume')}
                  disabled={actionLoading}
                >
                  Resume
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Main Details */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Subscription Information</h2>
          <Badge variant={statusVariants[subscription.status]}>
            {subscription.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Client
            </label>
            <Link
              to={`/clients/${subscription.client_id}`}
              className="text-primary hover:underline font-medium"
            >
              {subscription.clients?.name}
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {subscription.clients?.phone}
            </p>
          </div>

          {/* Outlet */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Outlet
            </label>
            <p className="font-medium">{subscription.outlets?.name}</p>
            <p className="text-sm text-muted-foreground">
              {subscription.outlets?.code} • {subscription.outlets?.city}
            </p>
          </div>

          {/* Billing Cycle */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Billing Cycle
            </label>
            <p className="font-medium">
              {formatBillingCycle(subscription.billing_cycle, subscription.billing_day)}
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Start Date
            </label>
            <p className="font-medium">{formatDate(subscription.start_date, 'long')}</p>
          </div>

          {/* End Date */}
          {subscription.end_date && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                End Date
              </label>
              <p className="font-medium">{formatDate(subscription.end_date, 'long')}</p>
            </div>
          )}

          {/* Next Billing Date */}
          {subscription.status === 'active' && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Next Billing Date
              </label>
              <p className="font-medium">{formatDate(subscription.next_billing_date, 'long')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Pricing Details */}
      <Card>
        <h2 className="text-xl font-semibold mb-6">Pricing</h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-medium">{subscription.quantity}</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Price per Unit</span>
            <span className="font-medium">{formatCurrency(subscription.price_per_unit)}</span>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total per Billing Cycle</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(subscription.quantity * subscription.price_per_unit)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* V1: Price History - Audit Trail */}
      {priceHistory.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Price Change History</h2>
          </div>

          <div className="space-y-3">
            {priceHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-3 bg-muted rounded-lg border-l-4 border-amber-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground line-through">
                      {formatCurrency(entry.old_price)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(entry.new_price)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong>Reason:</strong> {entry.reason}
                </p>
                {entry.changed_by_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Changed by: {entry.changed_by_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      {subscription.notes && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Pricing Notes / Justification</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{subscription.notes}</p>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Audit Trail</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Created:</span>{' '}
            <span className="font-medium">
              {new Date(subscription.created_at).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated:</span>{' '}
            <span className="font-medium">
              {new Date(subscription.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Future: Related Invoices will be shown here in Phase 5 */}
      <Card className="bg-muted">
        <h2 className="text-xl font-semibold mb-2">Related Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Invoice history will be available after Phase 5 (Invoices) is implemented.
        </p>
      </Card>

      {/* Confirmation Dialog - Pause */}
      <ConfirmDialog
        isOpen={confirmAction === 'pause'}
        title="Pause Subscription?"
        message="Are you sure you want to pause this subscription? Billing will stop until resumed."
        confirmLabel="Yes, Pause"
        variant="warning"
        isLoading={actionLoading}
        onConfirm={() => handleAction('pause')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation Dialog - Resume */}
      <ConfirmDialog
        isOpen={confirmAction === 'resume'}
        title="Resume Subscription?"
        message="Are you sure you want to resume this subscription? Billing will resume from today with a new billing cycle."
        confirmLabel="Yes, Resume"
        variant="info"
        isLoading={actionLoading}
        onConfirm={() => handleAction('resume')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation Dialog - Cancel */}
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Cancel Subscription?"
        message="Are you sure you want to cancel this subscription? This action cannot be undone. The subscription will be permanently cancelled."
        confirmLabel="Yes, Cancel Subscription"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={() => handleAction('cancel')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
