import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEventById, completeEvent, cancelEvent } from '@/services/eventService';
import type { Event } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/utils/billingDate';

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

  useEffect(() => {
    loadEvent();
  }, [id]);

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
