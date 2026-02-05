import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getEvents, completeEvent, cancelEvent } from '@/services/eventService';
import { getClients } from '@/services/clientService';
import type { Event, EventStatus, Client } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/utils/billingDate';

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | ''>('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'complete' | 'cancel';
    eventId: string;
    eventName: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id, selectedClient, selectedStatus]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (selectedClient) filters.client_id = selectedClient;
      if (selectedStatus) filters.status = selectedStatus;

      const [eventsData, clientsData] = await Promise.all([
        getEvents(user.id, filters),
        getClients(user.id, { client_type: 'event' }),
      ]);

      setEvents(eventsData);
      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'complete' | 'cancel', eventId: string) {
    if (!user?.id) return;

    try {
      setActionLoading(eventId);
      setActionError(null);

      if (action === 'complete') {
        await completeEvent(user.id, eventId);
      } else if (action === 'cancel') {
        await cancelEvent(user.id, eventId);
      }

      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} event`);
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: EventStatus) {
    const variants = {
      planned: 'default' as const,
      completed: 'success' as const,
      cancelled: 'secondary' as const,
      archived: 'secondary' as const,
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage one-time event bookings
          </p>
        </div>
        {user?.role !== 'accountant' && (
          <Link to="/events/add">
            <Button>+ Add Event</Button>
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
            onChange={(e) => setSelectedStatus(e.target.value as EventStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
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

      {/* Events Table */}
      <Card>
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events found</p>
            {user?.role !== 'accountant' && (
              <Link to="/events/add">
                <Button variant="outline" className="mt-4">
                  Create First Event
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Event Name</th>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Event Type</th>
                  <th className="text-left py-3 px-4">Event Date</th>
                  <th className="text-left py-3 px-4">Outlet</th>
                  <th className="text-right py-3 px-4">Guests</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/events/${event.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {event.event_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {event.clients?.name || 'Unknown Client'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {event.event_type || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatDate(event.event_date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {event.outlets?.name || 'Unknown Outlet'}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {event.guest_count || '-'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(event.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {user?.role !== 'accountant' && (
                          <>
                            {event.status === 'planned' && (
                              <>
                                <Link to={`/events/${event.id}/edit`}>
                                  <Button variant="outline" size="sm">
                                    Edit
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'complete',
                                      eventId: event.id,
                                      eventName: event.event_name,
                                    })
                                  }
                                  disabled={actionLoading === event.id}
                                >
                                  Complete
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'cancel',
                                      eventId: event.id,
                                      eventName: event.event_name,
                                    })
                                  }
                                  disabled={actionLoading === event.id}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        <Link to={`/events/${event.id}`}>
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
              Confirm {confirmAction.type === 'complete' ? 'Complete' : 'Cancel'}
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to {confirmAction.type} the event{' '}
              <strong>{confirmAction.eventName}</strong>?
              {confirmAction.type === 'cancel' && (
                <span className="block mt-2 text-destructive">
                  This action cannot be undone. The event will be marked as cancelled.
                </span>
              )}
              {confirmAction.type === 'complete' && (
                <span className="block mt-2 text-muted-foreground">
                  The event will be marked as completed and ready for invoicing.
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
                onClick={() => handleAction(confirmAction.type, confirmAction.eventId)}
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
