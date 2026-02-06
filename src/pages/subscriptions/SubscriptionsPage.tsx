import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptions, pauseSubscription, resumeSubscription, cancelSubscription } from '@/services/subscriptionService';
import { getClients } from '@/services/clientService';
import type { Subscription, SubscriptionStatus, Client } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { formatDate, formatBillingCycle } from '@/utils/billingDate';
import { formatCurrency } from '@/utils/format';

export default function SubscriptionsPage() {
  const { user, isAuthReady } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | ''>('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'pause' | 'resume' | 'cancel';
    subscriptionId: string;
    subscriptionName: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    loadData();
  }, [isAuthReady, selectedClient, selectedStatus]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (selectedClient) filters.client_id = selectedClient;
      if (selectedStatus) filters.status = selectedStatus;

      const [subsData, clientsData] = await Promise.all([
        getSubscriptions(user.id, filters),
        getClients(user.id, { client_type: 'corporate' }),
      ]);

      setSubscriptions(subsData);
      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'pause' | 'resume' | 'cancel', subscriptionId: string) {
    if (!user?.id) return;

    try {
      setActionLoading(subscriptionId);
      setActionError(null);

      if (action === 'pause') {
        await pauseSubscription(user.id, subscriptionId);
      } else if (action === 'resume') {
        await resumeSubscription(user.id, subscriptionId);
      } else if (action === 'cancel') {
        await cancelSubscription(user.id, subscriptionId);
      }

      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} subscription`);
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: SubscriptionStatus) {
    const variants = {
      active: 'success' as const,
      paused: 'warning' as const,
      cancelled: 'secondary' as const,
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  }

  if (loading && subscriptions.length === 0) {
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
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage corporate client subscriptions
          </p>
        </div>
        {user?.role !== 'accountant' && (
          <Link to="/subscriptions/add">
            <Button>+ Add Subscription</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Client"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>

          <Select
            label="Status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as SubscriptionStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          {(selectedClient || selectedStatus) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedClient('');
                  setSelectedStatus('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && <Alert variant="error">{error}</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      {/* Subscriptions Table */}
      <Card>
        {subscriptions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No subscriptions found</p>
            {user?.role !== 'accountant' && (
              <Link to="/subscriptions/add">
                <Button variant="outline" className="mt-4">
                  Create First Subscription
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Outlet</th>
                  <th className="text-left py-3 px-4">Billing Cycle</th>
                  <th className="text-right py-3 px-4">Quantity</th>
                  <th className="text-right py-3 px-4">Price/Unit</th>
                  <th className="text-right py-3 px-4">Total</th>
                  <th className="text-left py-3 px-4">Next Billing</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/subscriptions/${subscription.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {subscription.clients?.name || 'Unknown Client'}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {subscription.outlets?.name || 'Unknown Outlet'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatBillingCycle(subscription.billing_cycle, subscription.billing_day)}
                    </td>
                    <td className="py-3 px-4 text-right">{subscription.quantity}</td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(subscription.price_per_unit)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatCurrency(subscription.quantity * subscription.price_per_unit)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {subscription.status === 'active'
                        ? formatDate(subscription.next_billing_date)
                        : '-'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(subscription.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {user?.role !== 'accountant' && (
                          <>
                            <Link to={`/subscriptions/${subscription.id}/edit`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>

                            {subscription.status === 'active' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'pause',
                                      subscriptionId: subscription.id,
                                      subscriptionName:
                                        subscription.clients?.name || 'Unknown',
                                    })
                                  }
                                  disabled={actionLoading === subscription.id}
                                >
                                  Pause
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'cancel',
                                      subscriptionId: subscription.id,
                                      subscriptionName:
                                        subscription.clients?.name || 'Unknown',
                                    })
                                  }
                                  disabled={actionLoading === subscription.id}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}

                            {subscription.status === 'paused' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'resume',
                                    subscriptionId: subscription.id,
                                    subscriptionName:
                                      subscription.clients?.name || 'Unknown',
                                  })
                                }
                                disabled={actionLoading === subscription.id}
                              >
                                Resume
                              </Button>
                            )}
                          </>
                        )}
                        <Link to={`/subscriptions/${subscription.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">
              Confirm {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to {confirmAction.type} the subscription for{' '}
              <strong>{confirmAction.subscriptionName}</strong>?
              {confirmAction.type === 'cancel' && (
                <span className="block mt-2 text-destructive">
                  This action cannot be undone. The subscription will be permanently cancelled.
                </span>
              )}
              {confirmAction.type === 'resume' && (
                <span className="block mt-2 text-muted-foreground">
                  Billing will resume from today with a new billing cycle.
                </span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={!!actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === 'cancel' ? 'destructive' : 'default'}
                onClick={() => handleAction(confirmAction.type, confirmAction.subscriptionId)}
                disabled={!!actionLoading}
              >
                {actionLoading ? 'Processing...' : `Yes, ${confirmAction.type}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
