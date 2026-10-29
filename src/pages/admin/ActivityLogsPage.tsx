import { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, ChevronDown, Download, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { downloadCsv } from '@/utils/csv';
import { todayISO } from '@/utils/date';
import {
  getActivityLogs,
  activityLogsToCSV,
  getActivityActionTypes,
  ACTIVITY_MODULES,
  ACTIVITY_LOG_PAGE_SIZE,
  type ActivityLogEntry,
  type ActivityLogFilters,
} from '@/services/activityLogService';
import { getOutletOptions } from '@/services/adminOutletService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Skeleton, Spinner, TableSkeleton } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ================================================================
// ACTIVITY LOGS PAGE (ADMIN ONLY: route is admin-only in AppRoutes)
// ================================================================
// Unified audit trail across modules
// ================================================================

const EMPTY_FILTERS: ActivityLogFilters = {
  outlet_id: '',
  user_id: '',
  module: '',
  action_type: '',
  date_from: '',
  date_to: '',
};

const MODULE_VARIANT: Record<string, BadgeVariant> = {
  invoice: 'draft',
  payment: 'paid',
  subscription: 'final',
  event: 'info',
  inventory: 'partial',
};

/** "stock_adjusted" -> "Stock adjusted" */
const sentence = (raw: string) => {
  const t = raw.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Descriptions longer than this collapse behind a disclosure button. */
const DESCRIPTION_CLAMP = 110;

export default function ActivityLogsPage() {
  useDocumentTitle('Activity log');

  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role || '';
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [filters, setFiltersState] = useState<ActivityLogFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  // Any filter change starts again from the newest page
  const setFilters = (next: ActivityLogFilters) => {
    setPage(0);
    setFiltersState(next);
  };
  const [outletOptions, setOutletOptions] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const requestSeq = useRef(0);
  // Presentational: which long descriptions are expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const actionTypes = useMemo(() => getActivityActionTypes(filters.module), [filters.module]);
  const dateRangeInvalid =
    !!filters.date_from && !!filters.date_to && filters.date_from > filters.date_to;

  // Outlet filter options: every outlet, including inactive ones, so the
  // history of a closed outlet can still be isolated. Loaded once.
  useEffect(() => {
    if (!userId || userRole !== 'admin') return;
    getOutletOptions(userId)
      .then(setOutletOptions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load outlets');
      });
  }, [userId, userRole]);

  // Keyed on the user id (not the user object) so token refreshes don't
  // refetch. Only the latest request may update state.
  useEffect(() => {
    if (!userId) return;
    const seq = ++requestSeq.current;

    // From after To: no query. Drop the old results (and any late response)
    // so they are not mistaken for this range.
    if (dateRangeInvalid) {
      setLogs([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    getActivityLogs(userId, filters, { page, pageSize: ACTIVITY_LOG_PAGE_SIZE })
      .then((result) => {
        if (seq !== requestSeq.current) return;
        setLogs(result.rows);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (seq !== requestSeq.current) return;
        setLogs([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [userId, filters, page, dateRangeInvalid]);

  // Stats from the rows on screen; total from the exact count
  const uniqueUsers = useMemo(
    () => new Set(logs.map((row) => row.user_id).filter(Boolean)).size,
    [logs]
  );
  const modulesActive = useMemo(() => new Set(logs.map((row) => row.module)).size, [logs]);
  const truncated = total > logs.length;
  const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE));
  const firstRow = total === 0 ? 0 : page * ACTIVITY_LOG_PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * ACTIVITY_LOG_PAGE_SIZE + logs.length);

  function handleExportCSV() {
    if (exporting || logs.length === 0) return;
    try {
      setExporting(true);
      downloadCsv(`activity-logs-${todayISO()}.csv`, activityLogsToCSV(logs));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const first = loading && logs.length === 0;
  const hasFilters = Object.values(filters).some(Boolean);
  const n = (v: number) => v.toLocaleString('en-IN');

  return (
    <div>
      <PageHeader
        title="Activity log"
        description="Who did what, and when, across invoices, payments, subscriptions, events and stock."
        actions={
          <Button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0 || loading}
            isLoading={exporting}
          >
            {!exporting && <Download className="h-4 w-4" aria-hidden="true" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Filter bar: stays mounted while results reload */}
      <Card padding="sm" className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
          {/* Outlet Filter (Admin/Accountant only) */}
          {showOutletFilter && (
            <Select
              label="Outlet"
              value={filters.outlet_id}
              onChange={(e) => setFilters({ ...filters, outlet_id: e.target.value })}
            >
              <option value="">All outlets</option>
              {outletOptions.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}{outlet.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Module"
            value={filters.module}
            // Reset the action: the old one may not exist in the new module
            onChange={(e) => setFilters({ ...filters, module: e.target.value, action_type: '' })}
          >
            <option value="">All modules</option>
            {ACTIVITY_MODULES.map((mod) => (
              <option key={mod} value={mod}>
                {sentence(mod)}
              </option>
            ))}
          </Select>

          <Select
            label="Action"
            value={filters.action_type}
            onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
          >
            <option value="">All actions</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {sentence(action)}
              </option>
            ))}
          </Select>

          <DateInput
            label="From"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            error={dateRangeInvalid ? 'Must be on or before the To date.' : undefined}
          />

          <DateInput
            label="To"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />

          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
            className={cn('justify-self-start', dateRangeInvalid && 'lg:mb-7')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        </div>
      </Card>

      <section className="sheet overflow-hidden" aria-labelledby="log-h" aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-4">
          <div className="min-w-0">
            <h2 id="log-h" className="text-lg font-semibold text-ink">Entries</h2>
            {first ? (
              <Skeleton className="mt-1.5 h-4 w-64 max-w-full" />
            ) : (
              <p className="tabular text-sm text-ink-muted">
                {n(total)} entr{total === 1 ? 'y' : 'ies'} · {n(uniqueUsers)} {uniqueUsers === 1 ? 'person' : 'people'} ·{' '}
                {n(modulesActive)} module{modulesActive === 1 ? '' : 's'}
                {truncated ? ' (people and modules counted on this page)' : ''}
              </p>
            )}
          </div>
          {loading && !first && (
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status">
              <Spinner size="sm" label="Updating" />
              Updating…
            </span>
          )}
        </div>

        {first ? (
          <TableSkeleton rows={8} cols={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={
              dateRangeInvalid
                ? 'Check the date range'
                : hasFilters
                  ? 'No activity matches these filters'
                  : 'No activity recorded yet'
            }
            description={
              dateRangeInvalid
                ? 'The From date is after the To date. Fix the range to see entries.'
                : hasFilters
                  ? 'Widen the date range or clear a filter to see more entries.'
                  : 'Entries appear here as invoices, payments, subscriptions, events and stock movements are recorded.'
            }
            action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Module</th>
                  <th scope="col">{showOutletFilter ? 'By · outlet' : 'By'}</th>
                  <th scope="col">What happened</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const key = `${log.module}-${log.action_type}-${log.entity_id}-${log.occurred_at}-${idx}`;
                  const d = new Date(log.occurred_at);
                  return (
                    <tr key={key} className="align-top">
                      <td className="whitespace-nowrap align-top">
                        <div className="inline-block max-w-full align-top">
                          <div className="tabular text-ink">
                            {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="tabular text-xs text-ink-muted">
                            {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td className="align-top">
                        <div>
                          <Badge variant={MODULE_VARIANT[log.module] ?? 'default'}>{sentence(log.module)}</Badge>
                          <div className="mt-1 whitespace-nowrap text-xs text-ink-muted">{sentence(log.action_type)}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap align-top">
                        <div>
                          <div className="text-ink">{log.user_name || <span className="text-ink-muted">System</span>}</div>
                          {showOutletFilter && log.outlet_name && (
                            <div className="text-xs text-ink-muted">{log.outlet_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="min-w-[18rem] max-w-xl align-top">
                        <Description
                          text={log.description}
                          expanded={expanded.has(key)}
                          onToggle={() => toggleExpanded(key)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!first && logs.length > 0 && (
          <nav
            aria-label="Activity log pages"
            className="flex flex-col gap-3 border-t border-rule px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-ink-muted">
              Showing <span className="tabular font-semibold text-ink">{n(firstRow)}–{n(lastRow)}</span> of{' '}
              <span className="tabular font-semibold text-ink">{n(total)}</span>
              {pageCount > 1 ? ' · The CSV export contains this page.' : ''}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={loading || page === 0}
                >
                  Previous
                </Button>
                <span className="tabular px-1 text-ink-muted">
                  Page {n(page + 1)} of {n(pageCount)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={loading || page >= pageCount - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

/** Long descriptions collapse to two lines; a disclosure button reveals the rest. */
function Description({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  if (!text || text.length <= DESCRIPTION_CLAMP) {
    return <p className="text-ink">{text || '—'}</p>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="group block w-full rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-logo"
    >
      <span className={cn('block break-words text-ink', !expanded && 'line-clamp-2')}>{text}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary group-hover:underline">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        {expanded ? 'Show less' : 'Show all'}
      </span>
    </button>
  );
}
