import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEventById, completeEvent, cancelEvent } from '@/services/eventService';
import { getAllocationsByReference } from '@/services/allocationService';
import type { Event, InventoryAllocation } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/utils/billingDate';
import { Package, Plus } from 'lucide-react';
import AllocateInventoryModal from '@/components/inventory/AllocateInventoryModal';
import ReturnDamageLossModal from '@/components/inventory/ReturnDamageLossModal';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Event Details');
  useDocumentTitle(pageTitle);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'complete' | 'cancel' | null>(null);

  // Inventory allocations
  const [allocations, setAllocations] = useState<InventoryAllocation[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [returnAllocation, setReturnAllocation] = useState<InventoryAllocation | null>(null);

  useEffect(() => {
    loadEvent();
  }, [id]);

  useEffect(() => {
    if (event && user?.id && event.status !== 'cancelled') {
      loadAllocations();
    }
  }, [event?.id, user?.id]);

  async function loadAllocations() {
    if (!user?.id || !id) return;
    try {
      setAllocationsLoading(true);
      const data = await getAllocationsByReference(user.id, 'event', id);
      setAllocations(data);
    } catch (err) {
      console.error('Failed to load allocations:', err);
    } finally {
      setAllocationsLoading(false);
    }
  }

  async function loadEvent() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getEventById(id);

      if (!data) {
        setError('Event not found or you do not have access');
        return;
      }

      setEvent(data);
      setPageTitle(data.event_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'complete' | 'cancel') {
    if (!user?.id || !id) return;

    try {
      setActionLoading(true);
      setError(null);

      if (action === 'complete') {
        await completeEvent(user.id, id);
        showToast('Event marked as completed', 'success');
      } else if (action === 'cancel') {
        await cancelEvent(user.id, id);
        showToast('Event cancelled', 'success');
      }

      setConfirmAction(null);
      await loadEvent();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} event`;
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

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">{error || 'Event not found'}</Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate('/events')}>
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const statusVariants = {
    planned: 'default' as const,
    completed: 'success' as const,
    cancelled: 'secondary' as const,
    archived: 'secondary' as const,
  };

  const canEdit = event.status === 'planned';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Event Details</h1>
          <p className="text-muted-foreground mt-1">View event information</p>
        </div>
        <div className="flex gap-2">
          {user?.role !== 'accountant' && event.status !== 'cancelled' && (
            <Link to={`/inventory/allocate?type=event&ref=${id}`}>
              <Button variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Allocate Inventory
              </Button>
            </Link>
          )}

          {user?.role !== 'accountant' && canEdit && (
            <>
              <Link to={`/events/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>

              <Button
                variant="outline"
                onClick={() => setConfirmAction('complete')}
                disabled={actionLoading}
              >
                Complete
              </Button>

              <Button
                variant="destructive"
                onClick={() => setConfirmAction('cancel')}
                disabled={actionLoading}
              >
                Cancel Event
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Main Details */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Event Information</h2>
          <Badge variant={statusVariants[event.status]}>
            {event.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Event Name
            </label>
            <p className="font-medium text-lg">{event.event_name}</p>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Event Type
            </label>
            <p className="font-medium">{event.event_type || '-'}</p>
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Client
            </label>
            <Link
              to={`/clients/${event.client_id}`}
              className="text-primary hover:underline font-medium"
            >
              {event.clients?.name}
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {event.clients?.phone}
            </p>
          </div>

          {/* Outlet */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Outlet
            </label>
            <p className="font-medium">{event.outlets?.name}</p>
            <p className="text-sm text-muted-foreground">
              {event.outlets?.code} • {event.outlets?.city}
            </p>
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Event Date
            </label>
            <p className="font-medium">{formatDate(event.event_date, 'long')}</p>
          </div>

          {/* Guest Count */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Expected Guests
            </label>
            <p className="font-medium">{event.guest_count || 'Not specified'}</p>
          </div>
        </div>
      </Card>

      {/* Event Inventory */}
      {event.status !== 'cancelled' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              Event Inventory
            </h2>
            {user?.role !== 'accountant' && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowAllocateModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Allocate Items
                </Button>
              </div>
            )}
          </div>

          {allocationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No items have been sent for this event yet</p>
              {user?.role !== 'accountant' && (
                <Button onClick={() => setShowAllocateModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Allocate Items
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-3 px-4">Item</th>
                    <th className="text-right py-3 px-4">Sent</th>
                    <th className="text-right py-3 px-4">Returned</th>
                    <th className="text-right py-3 px-4">Pending Return</th>
                    <th className="text-center py-3 px-4">Status</th>
                    {user?.role !== 'accountant' && (
                      <th className="text-center py-3 px-4">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => {
                    const sent = alloc.allocated_quantity;
                    const pending = alloc.outstanding_quantity || 0;
                    const returned = sent - pending;
                    return (
                      <tr key={alloc.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <p className="font-medium">{alloc.item_name}</p>
                          {alloc.item_category && (
                            <p className="text-xs text-muted-foreground">{alloc.item_category}</p>
                          )}
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">{sent}</td>
                        <td className="text-right py-3 px-4 text-green-600 font-semibold">{returned}</td>
                        <td className="text-right py-3 px-4 text-orange-600 font-semibold">{pending}</td>
                        <td className="text-center py-3 px-4">
                          {pending === 0 ? (
                            <Badge variant="success">Fully Returned</Badge>
                          ) : (
                            <Badge variant="default">In Use</Badge>
                          )}
                        </td>
                        {user?.role !== 'accountant' && (
                          <td className="text-center py-3 px-4">
                            {pending > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReturnAllocation(alloc)}
                              >
                                Process Return
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
          )}
        </Card>
      )}

      {/* Notes */}
      {event.notes && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Audit Trail</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Created:</span>{' '}
            <span className="font-medium">
              {new Date(event.created_at).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated:</span>{' '}
            <span className="font-medium">
              {new Date(event.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Future: Invoice will be shown here in Phase 5 */}
      {event.status === 'completed' && (
        <Card className="bg-muted">
          <h2 className="text-xl font-semibold mb-2">Invoice</h2>
          <p className="text-sm text-muted-foreground">
            Invoice generation will be available after Phase 5 (Invoices) is implemented.
          </p>
        </Card>
      )}

      {/* Allocate Inventory Modal */}
      {showAllocateModal && event.outlet_id && (
        <AllocateInventoryModal
          isOpen={showAllocateModal}
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => {
            loadAllocations();
            showToast('Inventory allocated successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={event.outlet_id}
          referenceType="event"
          referenceId={id || ''}
          referenceName={event.event_name}
        />
      )}

      {/* Process Return Modal */}
      {returnAllocation && event.outlet_id && (
        <ReturnDamageLossModal
          isOpen={!!returnAllocation}
          onClose={() => setReturnAllocation(null)}
          onSuccess={() => {
            loadAllocations();
            showToast('Return processed successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={event.outlet_id}
          inventoryItemId={returnAllocation.inventory_item_id}
          itemName={returnAllocation.item_name || ''}
          referenceType="event"
          referenceId={id || ''}
          outstandingQuantity={returnAllocation.outstanding_quantity || 0}
        />
      )}

      {/* Confirmation Dialog - Complete */}
      <ConfirmDialog
        isOpen={confirmAction === 'complete'}
        title="Complete Event?"
        message="Are you sure you want to mark this event as completed? The event will be ready for invoicing."
        confirmLabel="Yes, Complete"
        variant="info"
        isLoading={actionLoading}
        onConfirm={() => handleAction('complete')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation Dialog - Cancel */}
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Cancel Event?"
        message="Are you sure you want to cancel this event? This action cannot be undone. The event will be marked as cancelled."
        confirmLabel="Yes, Cancel Event"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={() => handleAction('cancel')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
