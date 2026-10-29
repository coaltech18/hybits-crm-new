import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, PackageCheck, Search, Send, Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import { ilikePattern } from '@/utils/query';
import { daysSince, toLocalISODate } from '@/utils/date';
import { cn } from '@/utils/cn';
import { getAllocationsByReference, summarizeAllocations } from '@/services/allocationService';
import type { InventoryAllocation, ReferenceType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { AgingBar } from '@/components/ui/AgingBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TabList, TabPanel } from '@/components/inventory/Tabs';
import AllocateInventoryModal from '@/components/inventory/AllocateInventoryModal';
import ReturnDamageLossModal from '@/components/inventory/ReturnDamageLossModal';

// ================================================================
// INVENTORY ALLOCATION PAGE
// ================================================================
// CRITICAL RULES:
// - Allocate dishware to subscriptions or events
// - Outstanding quantity is DERIVED from DB (not calculated in UI)
// - Accountants are read-only
// ================================================================

interface ReferenceOption {
  id: string;
  name: string;
  outlet_id: string;
  status: string;
}

type ClientEmbed = { name?: string } | { name?: string }[] | null;

function embeddedClientName(client: unknown): string {
  const c = client as ClientEmbed;
  const name = Array.isArray(c) ? c[0]?.name : c?.name;
  return name || 'Unknown';
}

type Task = 'send' | 'receive';

const count = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const daysOut = (iso: string) => daysSince(toLocalISODate(new Date(iso)));
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const rowKey = (a: InventoryAllocation) => a.allocation_id ?? `${a.inventory_item_id}-${a.reference_id}`;

export default function InventoryAllocationPage() {
  useDocumentTitle('Send and receive dishes');
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  // URL params for deep linking from Event/Subscription detail pages
  const paramType = searchParams.get('type');
  const paramRef = searchParams.get('ref');

  const [referenceType, setReferenceType] = useState<ReferenceType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReference, setSelectedReference] = useState<ReferenceOption | null>(null);

  // Reference search results
  const [searchResults, setSearchResults] = useState<ReferenceOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRequestId = useRef(0);

  // Allocations
  const [allocations, setAllocations] = useState<InventoryAllocation[]>([]);
  const [summary, setSummary] = useState<{
    totalAllocated: number;
    totalOutstanding: number;
    itemCount: number;
  } | null>(null);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [returnAllocation, setReturnAllocation] = useState<InventoryAllocation | null>(null);

  const isAccountant = user?.role === 'accountant';

  // Presentational: which of the two tasks is in front.
  const [task, setTask] = useState<Task>('send');

  // Auto-select reference from URL params (deep link from Event/Subscription detail pages).
  // No status filter: a cancelled subscription/event with outstanding dishes must stay reachable.
  useEffect(() => {
    if ((paramType !== 'subscription' && paramType !== 'event') || !paramRef) return;
    let cancelled = false;

    async function autoSelectReference(type: ReferenceType, refId: string) {
      setReferenceType(type);
      try {
        if (type === 'subscription') {
          const { data, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, outlet_id, status, clients(name)')
            .eq('id', refId)
            .maybeSingle();
          if (fetchError) throw fetchError;
          if (data && !cancelled) {
            setSelectedReference({
              id: data.id,
              name: embeddedClientName(data.clients),
              outlet_id: data.outlet_id,
              status: data.status,
            });
          }
        } else if (type === 'event') {
          const { data, error: fetchError } = await supabase
            .from('events')
            .select('id, event_name, outlet_id, status')
            .eq('id', refId)
            .maybeSingle();
          if (fetchError) throw fetchError;
          if (data && !cancelled) {
            setSelectedReference({
              id: data.id,
              name: data.event_name,
              outlet_id: data.outlet_id,
              status: data.status,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Could not open the linked ${type}: ${
              err instanceof Error ? err.message : 'unknown error'
            }. Search for it below.`
          );
        }
      }
    }

    autoSelectReference(paramType, paramRef);
    return () => {
      cancelled = true;
    };
  }, [paramType, paramRef]);

  // Debounced reference search; only the latest response is applied.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !referenceType) {
      searchRequestId.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestId.current;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        let results: ReferenceOption[] = [];
        if (referenceType === 'subscription') {
          // Cancelled subscriptions are included so their outstanding dishes can still be received back.
          const { data, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, outlet_id, status, clients!inner(name)')
            .ilike('clients.name', ilikePattern(query))
            .limit(10);
          if (fetchError) throw fetchError;
          results = (data || []).map((s) => ({
            id: s.id,
            name: embeddedClientName(s.clients),
            outlet_id: s.outlet_id,
            status: s.status,
          }));
        } else if (referenceType === 'event') {
          // Cancelled events are included so their outstanding dishes can still be received back.
          const { data, error: fetchError } = await supabase
            .from('events')
            .select('id, event_name, outlet_id, status')
            .ilike('event_name', ilikePattern(query))
            .limit(10);
          if (fetchError) throw fetchError;
          results = (data || []).map((e) => ({
            id: e.id,
            name: e.event_name,
            outlet_id: e.outlet_id,
            status: e.status,
          }));
        }
        if (requestId === searchRequestId.current) setSearchResults(results);
      } catch (err) {
        if (requestId === searchRequestId.current) {
          setSearchResults([]);
          setError(err instanceof Error ? err.message : 'Search failed');
        }
      } finally {
        if (requestId === searchRequestId.current) setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, referenceType]);

  // Only the latest allocations request may write state (the booking can change mid-flight).
  const allocationsRequestId = useRef(0);

  const loadAllocations = useCallback(async () => {
    if (!user?.id || !selectedReference || !referenceType) return;
    const req = ++allocationsRequestId.current;

    try {
      setAllocationsLoading(true);
      setError(null);

      // One query; the summary is derived from the same rows.
      const allocationsData = await getAllocationsByReference(
        user.id,
        referenceType as ReferenceType,
        selectedReference.id
      );
      if (req !== allocationsRequestId.current) return;

      setAllocations(allocationsData);
      setSummary(summarizeAllocations(allocationsData));
    } catch (err) {
      if (req === allocationsRequestId.current) {
        setError(err instanceof Error ? err.message : 'Failed to load allocations');
      }
    } finally {
      if (req === allocationsRequestId.current) setAllocationsLoading(false);
    }
  }, [user?.id, selectedReference, referenceType]);

  useEffect(() => {
    if (selectedReference && referenceType) {
      loadAllocations();
    }
  }, [selectedReference, referenceType, loadAllocations]);

  function handleSelectReference(ref: ReferenceOption) {
    setError(null);
    setSelectedReference(ref);
    setSearchQuery('');
    setSearchResults([]);
  }

  function handleBack() {
    allocationsRequestId.current += 1; // drop any in-flight load for the old booking
    setAllocationsLoading(false);
    setSelectedReference(null);
    setAllocations([]);
    setSummary(null);
  }

  const outstandingRows = allocations.filter((a) => (a.outstanding_quantity || 0) > 0);
  const oldestOut = outstandingRows.reduce<string | null>(
    (min, a) => (a.created_at && (!min || a.created_at < min) ? a.created_at : min),
    null
  );
  const refKind = referenceType === 'event' ? 'Event' : 'Subscription';
  const refLink =
    selectedReference && referenceType
      ? referenceType === 'event'
        ? `/events/${selectedReference.id}`
        : `/subscriptions/${selectedReference.id}`
      : null;
  // Dishes can only be dispatched to an active subscription or a planned event
  // (the DB rejects anything else); receiving back is allowed for any booking.
  const sendableStatus = referenceType === 'event' ? 'planned' : 'active';
  const canSend = !isAccountant && !!selectedReference && selectedReference.status === sendableStatus;
  // Summary and rows arrive together; until the first load lands (or fails) show skeletons.
  const firstLoad = !summary && !error;
  const sum = (n: number | undefined) => (summary ? count(n ?? 0) : '—');

  return (
    <div>
      <PageHeader
        title="Send and receive dishes"
        description="Dispatch dishware to a subscription or event, and record what comes back."
        actions={
          canSend ? (
            task === 'send' ? (
              <Button onClick={() => setShowAllocateModal(true)}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send dishes
              </Button>
            ) : undefined
          ) : undefined
        }
      />

      <TabList<Task>
        idPrefix="dishes"
        label="Task"
        variant="segmented"
        active={task}
        onChange={setTask}
        className="mb-6"
        tabs={[
          { id: 'send', label: 'Send dishes', icon: Send },
          {
            id: 'receive',
            label: 'Receive back',
            icon: Undo2,
            count: selectedReference && !firstLoad ? outstandingRows.length : undefined,
          },
        ]}
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <TabPanel idPrefix="dishes" id={task}>
        {!selectedReference ? (
          <ReferenceSearch
            task={task}
            referenceType={referenceType}
            onTypeChange={(t) => setReferenceType(t)}
            searchQuery={searchQuery}
            onQueryChange={setSearchQuery}
            loading={searchLoading}
            results={searchResults}
            onSelect={handleSelectReference}
          />
        ) : (
          <div className="space-y-6">
            {/* The booking: who holds the dishes, and how much is still out */}
            <section className="sheet overflow-hidden" aria-labelledby="ref-h">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{refKind}</p>
                  <h2 id="ref-h" className="truncate text-xl font-semibold text-ink">
                    {refLink ? (
                      <Link to={refLink} className="hover:text-brand-primary">
                        {selectedReference.name}
                      </Link>
                    ) : (
                      selectedReference.name
                    )}
                  </h2>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  Change booking
                </Button>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-rule lg:grid-cols-4">
                <Figure label="Sent" loading={firstLoad}>
                  {sum(summary?.totalAllocated)} <span className="text-base font-medium text-ink-muted">pcs</span>
                </Figure>
                <Figure label="Still out" loading={firstLoad}>
                  <span className={cn((summary?.totalOutstanding ?? 0) > 0 ? 'text-partial' : 'text-final')}>
                    {sum(summary?.totalOutstanding)}
                  </span>{' '}
                  <span className="text-base font-medium text-ink-muted">pcs</span>
                </Figure>
                <Figure label="Items" loading={firstLoad}>
                  {sum(summary?.itemCount)}
                </Figure>
                <Figure label="Out since" loading={firstLoad}>
                  {oldestOut ? (
                    <span className="flex flex-col gap-1.5">
                      <span className="text-base font-semibold text-ink">{fmtDate(oldestOut)}</span>
                      <AgingBar days={daysOut(oldestOut)} pxPerDay={1} />
                    </span>
                  ) : (
                    <span className="text-base font-semibold text-final">Nothing out</span>
                  )}
                </Figure>
              </dl>
            </section>

            {!summary && error ? null : task === 'send' ? (
              <>
                {!isAccountant && !canSend && (
                  <Alert variant="info">
                    Dishes can only be sent to {referenceType === 'event' ? 'a planned event' : 'an active subscription'}.
                    This {refKind.toLowerCase()} is {selectedReference.status}. You can still receive dishes back.
                  </Alert>
                )}
                <SentLedger
                  rows={allocations}
                  loading={allocationsLoading || firstLoad}
                  canWrite={canSend}
                  onSend={() => setShowAllocateModal(true)}
                />
              </>
            ) : (
              <ReceiveLedger
                rows={outstandingRows}
                anySent={allocations.length > 0}
                loading={allocationsLoading || firstLoad}
                canWrite={!isAccountant}
                onReceive={setReturnAllocation}
              />
            )}
          </div>
        )}
      </TabPanel>

      {/* Allocate Modal */}
      {showAllocateModal && canSend && selectedReference && selectedReference.outlet_id && referenceType && (
        <AllocateInventoryModal
          isOpen={showAllocateModal}
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => {
            loadAllocations();
            showToast('Inventory allocated successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={selectedReference.outlet_id}
          referenceType={referenceType as ReferenceType}
          referenceId={selectedReference.id}
          referenceName={selectedReference.name}
        />
      )}

      {/* Return/Damage/Loss Modal */}
      {returnAllocation && selectedReference && selectedReference.outlet_id && referenceType && (
        <ReturnDamageLossModal
          isOpen={!!returnAllocation}
          onClose={() => setReturnAllocation(null)}
          onSuccess={() => {
            loadAllocations();
            showToast('Return processed successfully', 'success');
          }}
          userId={user?.id || ''}
          outletId={selectedReference.outlet_id}
          inventoryItemId={returnAllocation.inventory_item_id}
          itemName={returnAllocation.item_name || ''}
          referenceType={referenceType as ReferenceType}
          referenceId={selectedReference.id}
          outstandingQuantity={returnAllocation.outstanding_quantity || 0}
        />
      )}
    </div>
  );
}

// ================================================================
// SUB-COMPONENTS (presentational)
// ================================================================

function Figure({ label, loading, children }: { label: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="amount mt-1 text-2xl font-bold tracking-tight text-ink">
        {loading ? <Skeleton className="mt-1 h-7 w-24" /> : children}
      </dd>
    </div>
  );
}

function ReferenceSearch({
  task,
  referenceType,
  onTypeChange,
  searchQuery,
  onQueryChange,
  loading,
  results,
  onSelect,
}: {
  task: Task;
  referenceType: ReferenceType | '';
  onTypeChange: (t: ReferenceType | '') => void;
  searchQuery: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  results: ReferenceOption[];
  onSelect: (r: ReferenceOption) => void;
}) {
  const kind = referenceType === 'event' ? 'event' : 'subscription';
  return (
    <section className="sheet" aria-labelledby="find-h">
      <div className="border-b border-rule px-5 py-4">
        <h2 id="find-h" className="text-lg font-semibold text-ink">
          {task === 'send' ? 'Who are the dishes going to?' : 'Who is returning dishes?'}
        </h2>
        <p className="text-sm text-ink-muted">
          Find the subscription or event first. You can switch between sending and receiving at any time.
        </p>
      </div>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <Select
          label="Booking type"
          value={referenceType}
          onChange={(e) => onTypeChange(e.target.value as ReferenceType | '')}
        >
          <option value="">Select type</option>
          <option value="subscription">Subscription</option>
          <option value="event">Event</option>
        </Select>
        <Input
          type="search"
          label={referenceType === 'event' ? 'Event name' : 'Client name'}
          value={searchQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={referenceType ? 'Start typing…' : 'Choose a booking type first'}
          disabled={!referenceType}
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="space-y-3 border-t border-rule px-5 py-4" aria-busy="true">
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : results.length > 0 ? (
        <ul className="divide-y divide-rule border-t border-rule" aria-label="Matching bookings">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-final-tint/40 focus-visible:bg-final-tint/40 focus-visible:outline-none"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{result.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <StatusBadge kind={kind} status={result.status} />
                  <span className="text-sm font-semibold text-brand-primary">Open</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 border-t border-rule px-5 py-6 text-sm text-ink-muted">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          {searchQuery.trim() && referenceType
            ? `Matching ${kind}s appear here. Check the spelling if nothing shows.`
            : task === 'send'
              ? 'Pick who the dishes are for, then add each item and its quantity.'
              : 'Pick the booking that holds the dishes, then record each item that came back.'}
        </div>
      )}
    </section>
  );
}

function SentLedger({
  rows,
  loading,
  canWrite,
  onSend,
}: {
  rows: InventoryAllocation[];
  loading: boolean;
  canWrite: boolean;
  onSend: () => void;
}) {
  const totalSent = rows.reduce((n, a) => n + a.allocated_quantity, 0);
  return (
    <section className="sheet overflow-hidden" aria-labelledby="sent-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4">
        <h2 id="sent-h" className="text-lg font-semibold text-ink">Dishes sent</h2>
        {!loading && rows.length > 0 && (
          <p className="text-sm text-ink-muted">
            {rows.length} item{rows.length === 1 ? '' : 's'} · {count(totalSent)} pcs
          </p>
        )}
      </div>
      {loading && rows.length === 0 ? (
        <TableSkeleton rows={4} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Nothing sent yet"
          description={
            canWrite
              ? 'Send dishes to start the record. Each item you send appears here with what is still out.'
              : 'No dishware has been sent to this booking.'
          }
          action={canWrite ? { label: 'Send dishes', onClick: onSend } : undefined}
        />
      ) : (
        <div className={cn('overflow-x-auto', loading && 'opacity-60 transition-opacity')} aria-busy={loading || undefined}>
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Category</th>
                <th scope="col">Sent on</th>
                <th scope="col" className="text-right">Sent</th>
                <th scope="col" className="text-right">Still out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const out = a.outstanding_quantity || 0;
                return (
                  <tr key={rowKey(a)}>
                    <td className="font-semibold text-ink">{a.item_name}</td>
                    <td className="text-ink-muted">{a.item_category}</td>
                    <td className="whitespace-nowrap text-ink-muted">{a.created_at ? fmtDate(a.created_at) : '—'}</td>
                    <td className="tabular text-right font-semibold">{count(a.allocated_quantity)}</td>
                    <td className={cn('tabular text-right font-semibold', out > 0 ? 'text-partial' : 'text-final')}>
                      {out > 0 ? count(out) : 'All back'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReceiveLedger({
  rows,
  anySent,
  loading,
  canWrite,
  onReceive,
}: {
  rows: InventoryAllocation[];
  anySent: boolean;
  loading: boolean;
  canWrite: boolean;
  onReceive: (a: InventoryAllocation) => void;
}) {
  return (
    <section className="sheet overflow-hidden" aria-labelledby="out-h">
      <div className="border-b border-rule px-5 py-4">
        <h2 id="out-h" className="text-lg font-semibold text-ink">Still out</h2>
        <p className="text-sm text-ink-muted">Bar length is days since the item was sent. Record returns, damage or loss per item.</p>
      </div>
      {loading && rows.length === 0 && !anySent ? (
        <TableSkeleton rows={4} cols={4} />
      ) : rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <PackageCheck className="mx-auto mb-3 h-8 w-8 text-final" aria-hidden="true" />
          <p className="text-base font-semibold text-final">
            {anySent ? 'Everything sent here has come back.' : 'Nothing has been sent to this booking.'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {anySent ? 'Returned, damaged and lost pieces are already recorded.' : 'Switch to Send dishes to dispatch dishware.'}
          </p>
        </div>
      ) : (
        <div className={cn('overflow-x-auto', loading && 'opacity-60 transition-opacity')} aria-busy={loading || undefined}>
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="text-right">Sent</th>
                <th scope="col" className="text-right">Still out</th>
                <th scope="col">Out for</th>
                {canWrite && <th scope="col" data-nolabel className="w-px"><span className="sr-only">Action</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={rowKey(a)}>
                  <td>
                    <div className="inline-block max-w-full align-top">
                      <span className="block font-semibold text-ink">{a.item_name}</span>
                      <span className="block text-xs text-ink-muted">{a.item_category}</span>
                    </div>
                  </td>
                  <td className="tabular text-right text-ink-muted">{count(a.allocated_quantity)}</td>
                  <td className="tabular text-right text-base font-bold text-partial">{count(a.outstanding_quantity || 0)}</td>
                  <td>{a.created_at ? <AgingBar days={daysOut(a.created_at)} /> : '—'}</td>
                  {canWrite && (
                    <td className="text-right">
                      {a.is_active && (
                        <Button variant="outline" size="sm" onClick={() => onReceive(a)}>
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                          Receive back
                          <span className="sr-only"> {a.item_name}</span>
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
    </section>
  );
}
