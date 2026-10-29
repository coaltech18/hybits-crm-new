import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEvents, completeEvent } from '@/services/eventService';
import { getClients } from '@/services/clientService';
import type { Event, EventStatus, EventFilters, Client } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/utils/billingDate';
import { todayISO } from '@/utils/date';
import { cn } from '@/utils/cn';

// ================================================================
// EVENTS — one-off bookings. Ledger split (presentation only) into
// upcoming and past at today's date, in the order the service
// returned them. One visible action per row: complete a planned
// event once its date has arrived; everything else lives on detail.
// ================================================================

const count = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function EventsPage() {
  useDocumentTitle('Events');

  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Filters
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | ''>('');
  const hasFilters = !!(selectedClient || selectedStatus);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Cancelling lives on the event detail page; the list only offers Complete.
  const [confirmAction, setConfirmAction] = useState<{
    eventId: string;
    eventName: string;
    eventDate: string;
  } | null>(null);

  // Only the latest events request may write state
  const requestIdRef = useRef(0);
  const userId = user?.id;

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);

      const filters: EventFilters = {};
      if (selectedClient) filters.client_id = selectedClient;
      if (selectedStatus) filters.status = selectedStatus;

      const eventsData = await getEvents(userId, filters);
      if (requestId === requestIdRef.current) setEvents(eventsData);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [userId, selectedClient, selectedStatus]);

  useEffect(() => {
    if (!isAuthReady) return;
    loadEvents();
  }, [isAuthReady, loadEvents]);

  // Client filter options: load once per user
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    let stale = false;
    getClients(userId, { client_type: 'event' })
      .then((data) => {
        if (!stale) setClients(data);
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : 'Failed to load clients');
      });
    return () => {
      stale = true;
    };
  }, [isAuthReady, userId]);

  async function handleComplete(eventId: string) {
    if (!user?.id || actionLoading) return;

    try {
      setActionLoading(eventId);
      await completeEvent(user.id, eventId);
      showToast('Event marked as completed', 'success');

      setConfirmAction(null);
      await loadEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete event';
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const today = todayISO();

  const completeMessage = confirmAction
    ? `Mark "${confirmAction.eventName}" as completed? The event will be ready for invoicing.` +
      (confirmAction.eventDate > today
        ? ` Note: this event is dated ${formatDate(confirmAction.eventDate)}, which is in the future.`
        : '')
    : '';

  // Presentation only: split the loaded rows at today's date, keeping their order.
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);
  const first = loading && events.length === 0;

  function renderRow(event: Event) {
    const quiet = event.status === 'cancelled';
    const showComplete = canManage && event.status === 'planned' && event.event_date <= today;
    return (
      <tr key={event.id} className={cn(quiet && 'row-void')}>
        <td className="max-w-[18rem]">
          <div className="inline-block max-w-full align-top">
            <Link
              to={`/events/${event.id}`}
              className={cn('font-semibold hover:text-brand-primary', quiet ? 'text-void' : 'text-ink')}
            >
              {event.event_name}
            </Link>
            {event.event_type && <div className="truncate text-xs text-ink-muted">{event.event_type}</div>}
          </div>
        </td>
        <td className="whitespace-nowrap">{formatDate(event.event_date)}</td>
        <td className="max-w-[16rem]">
          <div className="min-w-0">
            <div className="truncate">{event.clients?.name || 'Unknown client'}</div>
            <div className="truncate text-xs text-ink-muted">{event.outlets?.name || 'Unknown outlet'}</div>
          </div>
        </td>
        <td className="text-right">{event.guest_count ? count(event.guest_count) : <span className="text-ink-faint">—</span>}</td>
        <td><StatusBadge kind="event" status={event.status} /></td>
        {canManage && (
          <td className="text-right">
            {showComplete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    eventId: event.id,
                    eventName: event.event_name,
                    eventDate: event.event_date,
                  })
                }
                disabled={actionLoading === event.id}
              >
                Complete
              </Button>
            )}
          </td>
        )}
      </tr>
    );
  }

  function groupRow(label: string, n: number) {
    return (
      <tr className="hover:!bg-transparent">
        <th
          scope="colgroup"
          colSpan={canManage ? 6 : 5}
          className="border-b border-rule bg-paper px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          {label} <span className="tabular font-medium normal-case tracking-normal">· {count(n)}</span>
        </th>
      </tr>
    );
  }

  return (
    <div>
      <PageHeader
        title="Events"
        description="One-off bookings such as weddings and functions, with the dishware sent to each."
        actions={
          canManage && (
            <LinkButton to="/events/add">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              New event
            </LinkButton>
          )
        }
      />

      {/* Filters stay mounted while the ledger reloads */}
      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
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
              onChange={(e) => setSelectedStatus(e.target.value as EventStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedClient('');
                setSelectedStatus('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {!first && events.length > 0 && (
        <p className="mb-3 text-sm text-ink-muted">
          <span className="tabular font-semibold text-ink">{count(events.length)}</span>{' '}
          {events.length === 1 ? 'event' : 'events'}
          {' · '}
          <span className="tabular font-semibold text-ink">{count(upcoming.length)}</span> upcoming
        </p>
      )}

      {first ? (
        <Card padding="none">
          <TableSkeleton rows={6} cols={5} />
        </Card>
      ) : events.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={CalendarDays}
            title={hasFilters ? 'No events match these filters' : 'No events yet'}
            description={
              hasFilters
                ? 'Try another client or status, or clear the filters.'
                : canManage
                  ? 'Book an event for an event client, then send dishware to it from the event page.'
                  : 'No events have been booked yet.'
            }
            action={canManage && !hasFilters ? { label: 'New event', onClick: () => navigate('/events/add') } : undefined}
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className={cn('ledger', loading && 'opacity-60')}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col">Client</th>
                  <th scope="col" className="text-right">Guests</th>
                  <th scope="col">Status</th>
                  {canManage && (
                    <th scope="col" data-nolabel className="w-px text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  )}
                </tr>
              </thead>
              {upcoming.length > 0 && (
                <tbody>
                  {groupRow('Upcoming', upcoming.length)}
                  {upcoming.map(renderRow)}
                </tbody>
              )}
              {past.length > 0 && (
                <tbody>
                  {groupRow('Past', past.length)}
                  {past.map(renderRow)}
                </tbody>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation dialog: complete */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title="Complete event?"
        message={completeMessage}
        confirmLabel="Complete event"
        variant="info"
        isLoading={!!actionLoading}
        onConfirm={() => confirmAction && handleComplete(confirmAction.eventId)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
