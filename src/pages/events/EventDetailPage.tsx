import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FilePlus2, Package, Pencil, Send, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEventById, getEventInvoices, completeEvent, cancelEvent } from '@/services/eventService';
import { getAllocationHistoryByReference } from '@/services/allocationService';
import type { Event, InventoryAllocationHistory } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, StatusStamp } from '@/components/ui/StatusStamp';
import { AgingBar } from '@/components/ui/AgingBar';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/utils/billingDate';
import { daysSince, todayISO, toLocalISODate } from '@/utils/date';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import AllocateInventoryModal from '@/components/inventory/AllocateInventoryModal';
import ReturnDamageLossModal from '@/components/inventory/ReturnDamageLossModal';

// ================================================================
// EVENT DETAIL — a booking and every dish sent to it.
// Header: name + stamp, date · guests · client, the next action.
// Dishware strip (pieces still out is the loud figure), then the
// dishware ledger, then details beside the event's invoices.
// ================================================================

type EventInvoice = Awaited<ReturnType<typeof getEventInvoices>>[number];

const count = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  // Inventory sent to this event (including fully resolved allocations)
  const [allocations, setAllocations] = useState<InventoryAllocationHistory[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [allocationsError, setAllocationsError] = useState<string | null>(null);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [returnAllocation, setReturnAllocation] = useState<InventoryAllocationHistory | null>(null);

  // Invoices linked to this event
  const [invoices, setInvoices] = useState<EventInvoice[]>([]);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Status the event had when it was first shown (drives the stamp animation below)
  const [firstStatus, setFirstStatus] = useState<string | undefined>(undefined);

  // Only the latest request of each kind may write state (the :id can change mid-flight).
  const eventRequest = useRef(0);
  const allocationsRequest = useRef(0);
  const invoicesRequest = useRef(0);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    const req = ++eventRequest.current;

    try {
      setLoading(true);
      setError(null);
      const data = await getEventById(id);
      if (req !== eventRequest.current) return;

      if (!data) {
        setEvent(null);
        setError('Event not found or you do not have access');
        return;
      }

      setEvent(data);
      setPageTitle(data.event_name);
    } catch (err) {
      if (req === eventRequest.current) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      }
    } finally {
      if (req === eventRequest.current) setLoading(false);
    }
  }, [id]);

  const loadAllocations = useCallback(async () => {
    if (!id) return;
    const req = ++allocationsRequest.current;
    try {
      setAllocationsLoading(true);
      setAllocationsError(null);
      const data = await getAllocationHistoryByReference('event', id);
      if (req === allocationsRequest.current) setAllocations(data);
    } catch (err) {
      if (req === allocationsRequest.current) {
        setAllocationsError(err instanceof Error ? err.message : 'Failed to load event inventory');
      }
    } finally {
      if (req === allocationsRequest.current) setAllocationsLoading(false);
    }
  }, [id]);

  const loadInvoices = useCallback(async () => {
    if (!id) return;
    const req = ++invoicesRequest.current;
    try {
      setInvoicesError(null);
      const data = await getEventInvoices(id);
      if (req === invoicesRequest.current) setInvoices(data);
    } catch (err) {
      if (req === invoicesRequest.current) {
        setInvoicesError(err instanceof Error ? err.message : 'Failed to load invoices');
      }
    }
  }, [id]);

  // New :id: drop the previous event's data so it is never shown under the new route.
  useEffect(() => {
    setEvent(null);
    setAllocations([]);
    setAllocationsError(null);
    setInvoices([]);
    setInvoicesError(null);
    setFirstStatus(undefined);
    void loadEvent();
  }, [loadEvent]);

  // Child lists load only once the event for the current :id is on screen.
  const loadedEventId = event?.id === id ? id : undefined;
  const eventStatus = event?.status;

  useEffect(() => {
    if (loadedEventId) void loadAllocations();
  }, [loadedEventId, loadAllocations]);

  useEffect(() => {
    if (loadedEventId && eventStatus === 'completed') void loadInvoices();
  }, [loadedEventId, eventStatus, loadInvoices]);

  // Presentational only: press the stamp in when the status changes during this visit.
  useEffect(() => {
    if (eventStatus && firstStatus === undefined) setFirstStatus(eventStatus);
  }, [eventStatus, firstStatus]);
  const stampAnimate = firstStatus !== undefined && !!eventStatus && firstStatus !== eventStatus;

  async function handleAction(action: 'complete' | 'cancel') {
    if (!user?.id || !id || actionLoading) return;

    try {
      setActionLoading(true);

      if (action === 'complete') {
        await completeEvent(user.id, id);
        showToast('Event marked as completed', 'success');
      } else {
        await cancelEvent(user.id, id);
        showToast('Event cancelled', 'success');
      }

      setConfirmAction(null);
      await loadEvent();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} event`;
      showToast(errorMessage, 'error');
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !event) {
    return <DetailSkeleton />;
  }

  if (!event) {
    return (
      <div>
        <PageHeader title="Event not found" back={{ to: '/events', label: 'Events' }} />
        <Alert variant="error">{error || 'Event not found'}</Alert>
      </div>
    );
  }

  const isPlanned = event.status === 'planned';
  // The DB only accepts dispatches to a planned event (migration 042).
  const canAllocate = canManage && isPlanned;
  const totalOutstanding = allocations.reduce((sum, a) => sum + Math.max(a.outstanding_quantity, 0), 0);

  const completeMessage =
    'Mark this event as completed? The event will be ready for invoicing.' +
    (event.event_date > todayISO()
      ? ` Note: the event date (${formatDate(event.event_date)}) is in the future.`
      : '') +
    (totalOutstanding > 0
      ? ` ${totalOutstanding} item(s) are still out; record their return, damage or loss before invoicing.`
      : '');

  const cancelMessage =
    totalOutstanding > 0
      ? `This event still has ${totalOutstanding} item(s) out. Record their return, damage or loss before cancelling.`
      : 'Are you sure you want to cancel this event? This action cannot be undone. The event will be marked as cancelled.';

  const createInvoiceUrl =
    `/invoices/create?type=event` +
    `&outlet_id=${encodeURIComponent(event.outlet_id)}` +
    `&client_id=${encodeURIComponent(event.client_id)}` +
    `&event_id=${encodeURIComponent(event.id)}`;

  // Dishware totals (presentation of the loaded allocation rows)
  const sent = allocations.reduce((s, a) => s + a.allocated_quantity, 0);
  const returnedGood = allocations.reduce((s, a) => s + a.returned_good, 0);
  const notBackGood = allocations.reduce((s, a) => s + a.returned_damaged + a.lost + a.disposed, 0);

  const isCompleted = event.status === 'completed';

  return (
    <div>
      <PageHeader
        back={{ to: '/events', label: 'Events' }}
        title={event.event_name}
        meta={<StatusStamp kind="event" status={event.status} animate={stampAnimate} />}
        description={
          <>
            {formatDate(event.event_date, 'long')}
            {event.guest_count ? <> · {count(event.guest_count)} guests</> : null}
            {' · '}
            <Link to={`/clients/${event.client_id}`} className="font-semibold text-brand-primary hover:underline">
              {event.clients?.name || 'Client'}
            </Link>
          </>
        }
        actions={
          canManage && (
            <>
              {isPlanned && (
                <>
                  <Button type="button" onClick={() => setShowAllocateModal(true)}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send dishes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmAction('complete')}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Complete
                  </Button>
                  <LinkButton to={`/events/${id}/edit`} variant="outline">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </LinkButton>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setConfirmAction('cancel')}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Cancel event
                  </Button>
                </>
              )}
              {isCompleted && (
                <LinkButton to={createInvoiceUrl}>
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                  Create invoice
                </LinkButton>
              )}
            </>
          )
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Dishware strip: pieces still out is the loudest figure */}
      {allocations.length > 0 && !allocationsError && (
        <section
          aria-label="Dishware totals"
          className="sheet mb-6 grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule max-lg:[&>*:nth-child(-n+2)]:border-b lg:divide-x divide-rule"
        >
          <Figure label="Still out" big hint={totalOutstanding > 0 ? 'Waiting to come back' : 'Everything is accounted for'}>
            <span className={totalOutstanding > 0 ? 'text-partial' : 'text-final'}>{count(totalOutstanding)}</span>
            <span className="ml-1 text-base font-medium text-ink-muted">pcs</span>
          </Figure>
          <Figure label="Sent" hint={`${allocations.length} ${allocations.length === 1 ? 'item' : 'items'}`} className="max-lg:border-l">
            {count(sent)}
          </Figure>
          <Figure label="Returned good" hint="Back in stock">
            {count(returnedGood)}
          </Figure>
          <Figure label="Damaged or lost" hint="Not back in stock" className="max-lg:border-l">
            <span className={notBackGood > 0 ? 'text-overdue' : 'text-ink'}>{count(notBackGood)}</span>
          </Figure>
        </section>
      )}

      {/* Dishware ledger (shown for every status so nothing sent is ever hidden) */}
      <section className="sheet mb-6 overflow-hidden" aria-labelledby="dishware-h">
        <div className="border-b border-rule px-5 py-4">
          <h2 id="dishware-h" className="text-lg font-semibold text-ink">Dishware</h2>
          <p className="text-sm text-ink-muted">Every item sent to this event. Bar length is days since it was sent.</p>
        </div>

        {allocationsLoading && allocations.length === 0 ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-5" />)}
          </div>
        ) : allocationsError ? (
          <div className="space-y-3 p-5">
            <Alert variant="error">Could not load the event inventory: {allocationsError}</Alert>
            <Button type="button" variant="outline" size="sm" onClick={() => loadAllocations()}>
              Retry
            </Button>
          </div>
        ) : allocations.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <Package className="mb-3 h-8 w-8 text-ink-faint" aria-hidden="true" />
            <p className="text-base font-semibold text-ink">No dishware sent yet</p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              {canAllocate
                ? 'Record what leaves the outlet for this event, so every piece is tracked until it comes back.'
                : 'Nothing has been sent to this event.'}
            </p>
            {canAllocate && (
              <Button type="button" variant="outline" className="mt-5" onClick={() => setShowAllocateModal(true)}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send dishes
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto" aria-busy={allocationsLoading}>
            <table className={cn('ledger', allocationsLoading && 'opacity-60')}>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="text-right">Sent</th>
                  <th scope="col" className="text-right">Returned good</th>
                  <th scope="col" className="text-right">Damaged</th>
                  <th scope="col" className="text-right">Lost or disposed</th>
                  <th scope="col" className="text-right">Pending</th>
                  <th scope="col">Out for</th>
                  {canManage && (
                    <th scope="col" data-nolabel className="w-px text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => {
                  const pending = Math.max(alloc.outstanding_quantity, 0);
                  const lostOrDisposed = alloc.lost + alloc.disposed;
                  const resolved = pending === 0;
                  return (
                    <tr key={alloc.id} className={cn(resolved && 'text-ink-muted')}>
                      <td>
                        <div className="inline-block max-w-full align-top">
                          <div className={cn('font-semibold', resolved ? 'text-ink-muted' : 'text-ink')}>{alloc.item_name}</div>
                          {alloc.item_category && <div className="text-xs text-ink-muted">{alloc.item_category}</div>}
                        </div>
                      </td>
                      <td className="text-right font-semibold">{count(alloc.allocated_quantity)}</td>
                      <td className={cn('text-right', !resolved && alloc.returned_good > 0 && 'text-final')}>
                        {count(alloc.returned_good)}
                      </td>
                      <td className={cn('text-right', alloc.returned_damaged > 0 && 'font-semibold text-partial')}>
                        {count(alloc.returned_damaged)}
                      </td>
                      <td className={cn('text-right', lostOrDisposed > 0 && 'font-semibold text-overdue')}>
                        {count(lostOrDisposed)}
                      </td>
                      <td className="cell-emph text-right">
                        {resolved ? (
                          <span>0</span>
                        ) : (
                          <span className="inline-block rounded-md border border-partial-rule bg-partial-tint px-2 py-0.5 font-bold text-partial">
                            {count(pending)}
                          </span>
                        )}
                      </td>
                      <td>
                        {resolved ? (
                          <span className="text-sm text-ink-muted">Fully resolved</span>
                        ) : (
                          <AgingBar days={daysSince(toLocalISODate(new Date(alloc.created_at)))} pxPerDay={1} />
                        )}
                      </td>
                      {canManage && (
                        <td className="text-right">
                          {pending > 0 && alloc.is_active && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setReturnAllocation(alloc)}>
                              Record return
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
      </section>

      <div className={cn('grid items-start gap-6', isCompleted && 'lg:grid-cols-2')}>
        {/* Details */}
        <section className="sheet" aria-labelledby="details-h">
          <h2 id="details-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">Details</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
            <DetailRow label="Event type">{event.event_type || '—'}</DetailRow>
            <DetailRow label="Event date">{formatDate(event.event_date, 'long')}</DetailRow>
            <DetailRow label="Client">
              <Link to={`/clients/${event.client_id}`} className="text-brand-primary hover:underline">
                {event.clients?.name}
              </Link>
              {event.clients?.phone && <div className="text-sm font-normal text-ink-muted">{event.clients.phone}</div>}
            </DetailRow>
            <DetailRow label="Outlet">
              {event.outlets?.name}
              <div className="text-sm font-normal text-ink-muted">
                <span className="serial">{event.outlets?.code}</span> · {event.outlets?.city}
              </div>
            </DetailRow>
            <DetailRow label="Expected guests">
              {event.guest_count ? <span className="tabular">{count(event.guest_count)}</span> : 'Not specified'}
            </DetailRow>
            <DetailRow label="Created">{formatDateTime(event.created_at)}</DetailRow>
            <DetailRow label="Last updated">{formatDateTime(event.updated_at)}</DetailRow>
            {event.notes && (
              <DetailRow label="Notes" wide>
                <p className="whitespace-pre-wrap font-normal text-ink">{event.notes}</p>
              </DetailRow>
            )}
          </dl>
        </section>

        {/* Invoices (completed events only) */}
        {isCompleted && (
          <section className="sheet overflow-hidden self-start" aria-labelledby="invoices-h">
            <h2 id="invoices-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">Invoices</h2>
            {invoicesError ? (
              <div className="space-y-3 p-5">
                <Alert variant="error">Could not load invoices: {invoicesError}</Alert>
                <Button type="button" variant="outline" size="sm" onClick={() => loadInvoices()}>
                  Retry
                </Button>
              </div>
            ) : invoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                No invoices have been created for this event yet.
                {canManage && ' Use Create invoice to bill it.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th scope="col">Invoice</th>
                      <th scope="col">Date</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className={cn(inv.status === 'draft' && 'row-draft', inv.status === 'cancelled' && 'row-void')}>
                        <td>
                          <Link
                            to={`/invoices/${inv.id}`}
                            className={cn('font-semibold text-ink hover:text-brand-primary', inv.invoice_number && 'serial')}
                          >
                            {inv.invoice_number || 'Draft invoice'}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-ink-muted">{formatDate(inv.issued_at || inv.created_at)}</td>
                        <td><StatusBadge kind="invoice" status={inv.status} /></td>
                        <td className="amount text-right font-semibold">{formatCurrency(inv.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Send dishes modal */}
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

      {/* Record return modal */}
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
          outstandingQuantity={Math.max(returnAllocation.outstanding_quantity, 0)}
        />
      )}

      {/* Confirmation dialog: complete */}
      <ConfirmDialog
        isOpen={confirmAction === 'complete'}
        title="Complete event?"
        message={completeMessage}
        confirmLabel="Complete event"
        variant={totalOutstanding > 0 || event.event_date > todayISO() ? 'warning' : 'info'}
        isLoading={actionLoading}
        onConfirm={() => handleAction('complete')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation dialog: cancel */}
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Cancel event?"
        message={cancelMessage}
        confirmLabel="Cancel event"
        cancelLabel="Keep event"
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
      <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}>
        {children}
      </div>
      <div className="mt-1 truncate text-sm text-ink-muted">{hint}</div>
    </div>
  );
}

function DetailRow({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading event">
      <Skeleton className="mb-4 h-4 w-20" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 mb-8 h-4 w-80 max-w-full" />
      <div className="sheet mb-6 grid grid-cols-2 gap-6 p-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="sheet space-y-3 p-5">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5" />)}
      </div>
    </div>
  );
}
