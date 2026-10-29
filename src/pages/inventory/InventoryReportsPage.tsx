import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getInventoryItems } from '@/services/inventoryService';
import {
  getStockSummaryReport,
  exportStockSummaryCSV,
  getAllocationReport,
  exportAllocationReportCSV,
  getDamageLossReport,
  exportDamageLossCSV,
  getMovementHistoryReport,
  exportMovementHistoryCSV,
} from '@/services/inventoryReportService';
import type {
  StockSummaryFilters,
  StockSummaryRow,
  AllocationReportFilters,
  AllocationReportRow,
  DamageLossReportFilters,
  DamageLossRow,
  MovementHistoryReportFilters,
} from '@/services/inventoryReportService';
import { istDateTimeParts } from '@/services/inventoryMovementService';
import type { InventoryItem, InventoryMovement, MovementType, Outlet } from '@/types';
import { TableSkeleton } from '@/components/ui/Spinner';
import { downloadCsv } from '@/utils/csv';
import { parseLocalISODate, todayISO } from '@/utils/date';
import { cn } from '@/utils/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MOVEMENT_TYPE_COLORS, MOVEMENT_TYPE_OPTIONS, movementTypeLabel } from '@/components/inventory/movementLabels';
import { TabList, TabPanel } from '@/components/inventory/Tabs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Download } from 'lucide-react';

// ================================================================
// INVENTORY REPORTS PAGE
// ================================================================
// CRITICAL RULES:
// - Reports are READ-ONLY
// - Data from DB views ONLY (no UI calculations)
// - CSV export mandatory for all reports
// - Role-based outlet filtering
// ================================================================

type ReportTab = 'stock' | 'allocation' | 'damage' | 'movements';
const REPORT_TABS: ReportTab[] = ['stock', 'allocation', 'damage', 'movements'];

export default function InventoryReportsPage() {
  useDocumentTitle('Inventory reports');
  const { user, outlets } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as ReportTab | null;
  // ?tab= deep link (e.g. "Pending returns" on the Overview opens the Allocation tab)
  const [activeTab, setActiveTab] = useState<ReportTab>(
    tabParam && REPORT_TABS.includes(tabParam) ? tabParam : 'stock'
  );
  // A later ?tab= change (link clicked while already on this page) switches the tab too.
  const [seenTabParam, setSeenTabParam] = useState(tabParam);
  if (tabParam !== seenTabParam) {
    setSeenTabParam(tabParam);
    if (tabParam && REPORT_TABS.includes(tabParam)) setActiveTab(tabParam);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role || '';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets: Outlet[] = outlets || [];

  const tabs = [
    { id: 'stock' as const, label: 'Stock summary' },
    { id: 'allocation' as const, label: 'Dishes out' },
    { id: 'damage' as const, label: 'Damage and loss' },
    { id: 'movements' as const, label: 'Movements' },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory reports"
        description="Read-only views of stock, dishes out, damage and every movement. Each one exports to CSV."
      />

      <TabList<ReportTab>
        idPrefix="report"
        label="Report"
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <TabPanel idPrefix="report" id={activeTab} className="space-y-4">
      {/* Report Content */}      {/* Report Content */}
      {activeTab === 'stock' && (
        <StockSummaryReport
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'allocation' && (
        <AllocationReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'damage' && (
        <DamageLossReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}

      {activeTab === 'movements' && (
        <MovementHistoryReportTab
          userId={user?.id || ''}
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />
      )}
      </TabPanel>
    </div>
  );
}

// ================================================================
// STOCK SUMMARY REPORT TAB
// ================================================================

interface ReportTabProps {
  userId: string;
  userRole: string;
  showOutletFilter: boolean;
  outlets: Outlet[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/** Items for the filter dropdowns (all lifecycle states, so discontinued items can be reported on). */
function useReportItems(userId: string, setError: (error: string | null) => void): InventoryItem[] {
  const [items, setItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    getInventoryItems(userId, { is_active: 'all' })
      .then((data) => {
        if (!stale) setItems(data);
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? `Failed to load items: ${err.message}` : 'Failed to load items');
      });
    return () => {
      stale = true;
    };
  }, [userId, setError]);
  return items;
}

/**
 * Load report rows whenever the filters change. Only the latest response is applied;
 * a short debounce keeps free-text filters from firing a query per keystroke.
 */
function useReportData<T, F>(
  userId: string,
  filters: F,
  load: (userId: string, filters: F) => Promise<T[]>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): T[] {
  const [data, setData] = useState<T[]>([]);
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await load(userId, filters);
        if (!stale) setData(rows);
      } catch (err) {
        if (stale) return;
        // Never leave the previous filters' rows under a failed load
        setData([]);
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        if (!stale) setLoading(false);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [userId, filters, load, setLoading, setError]);
  return data;
}

async function runExport(
  build: () => Promise<string>,
  filename: string,
  setError: (error: string | null) => void
) {
  try {
    downloadCsv(`${filename}-${todayISO()}.csv`, await build());
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to export CSV');
  }
}

const num = (n: number | null | undefined) => new Intl.NumberFormat('en-IN').format(Number(n) || 0);
const fmtDay = (iso: string | null | undefined) =>
  iso ? parseLocalISODate(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Hairline-ruled strip of report totals. */
function Totals({ children, cols }: { children: React.ReactNode; cols: string }) {
  return (
    <section aria-label="Report totals" className={cn('sheet grid gap-px overflow-hidden bg-rule', cols)}>
      {children}
    </section>
  );
}

function Total({ label, value, tone = 'text-ink', hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cn('tabular mt-1 text-2xl font-bold tracking-tight', value === 0 ? 'text-ink-faint' : tone)}>{num(value)}</div>
      {hint && <div className="mt-0.5 truncate text-sm text-ink-muted">{hint}</div>}
    </div>
  );
}

/** Filter bar: fields wrap, export sits at the end of the row. */
function FilterBar({ children, onExport, canExport }: { children: React.ReactNode; onExport: () => void; canExport: boolean }) {
  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <Button variant="outline" onClick={onExport} disabled={!canExport} className="sm:ml-auto">
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>
    </Card>
  );
}

function Field({ children, width = 'sm:w-52' }: { children: React.ReactNode; width?: string }) {
  return <div className={cn('w-full', width)}>{children}</div>;
}

function OutletSelect({ outlets, value, onChange }: { outlets: Outlet[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field width="sm:w-56">
      <Select label="Outlet" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All outlets</option>
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Ledger sheet: title + count line, skeleton on first load, dimmed while refetching. */
function Ledger({
  title,
  countLine,
  loading,
  empty,
  rows,
  cols,
  children,
}: {
  title: string;
  countLine: string;
  loading: boolean;
  empty: string;
  rows: number;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {rows > 0 && <p className="text-sm text-ink-muted">{countLine}</p>}
      </div>
      {loading && rows === 0 ? (
        <TableSkeleton rows={6} cols={cols} />
      ) : rows === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className={cn('max-h-[70vh] overflow-auto', loading && 'opacity-60 transition-opacity')} aria-busy={loading || undefined}>
          {children}
        </div>
      )}
    </Card>
  );
}

function RefCell({ type, name }: { type: string; name?: string | null }) {
  return (
    <>
      <span className="block text-ink">{name || (type === 'manual' ? 'At the outlet' : '—')}</span>
      <span className="block text-xs capitalize text-ink-muted">{type}</span>
    </>
  );
}

function StockSummaryReport({
  userId,
  showOutletFilter,
  outlets,
  loading,
  setLoading,
  setError,
}: ReportTabProps) {
  const [outletId, setOutletId] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('true');

  const filters = useMemo<StockSummaryFilters>(() => {
    const f: StockSummaryFilters = {};
    if (outletId) f.outlet_id = outletId;
    if (category.trim()) f.category = category.trim();
    if (isActive !== '') f.is_active = isActive === 'true';
    return f;
  }, [outletId, category, isActive]);

  const data = useReportData<StockSummaryRow, StockSummaryFilters>(
    userId,
    filters,
    getStockSummaryReport,
    setLoading,
    setError
  );

  function handleExport() {
    return runExport(() => exportStockSummaryCSV(userId, filters), 'stock-summary', setError);
  }

  const totalItems = data.length;
  const totalAvailable = data.reduce((sum, row) => sum + (row.available_quantity || 0), 0);
  const totalAllocated = data.reduce((sum, row) => sum + (row.allocated_quantity || 0), 0);
  const totalDamaged = data.reduce((sum, row) => sum + (row.damaged_quantity || 0), 0);
  const totalLost = data.reduce((sum, row) => sum + (row.lost_quantity || 0), 0);
  const totalInRepair = data.reduce((sum, row) => sum + (row.in_repair_quantity || 0), 0);

  return (
    <>
      <Totals cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Total label="Items" value={totalItems} />
        <Total label="Available" value={totalAvailable} tone="text-final" />
        <Total label="Allocated" value={totalAllocated} tone="text-info" />
        <Total label="Damaged" value={totalDamaged} tone="text-partial" />
        <Total label="In repair" value={totalInRepair} tone="text-void" />
        <Total label="Lost (lifetime)" value={totalLost} tone="text-overdue" />
      </Totals>

      <FilterBar onExport={handleExport} canExport={data.length > 0}>
        {showOutletFilter && <OutletSelect outlets={outlets} value={outletId} onChange={setOutletId} />}
        <Field>
          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Any category"
          />
        </Field>
        <Field width="sm:w-40">
          <Select label="Status" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="">All</option>
          </Select>
        </Field>
      </FilterBar>

      <Ledger
        title="Stock summary"
        countLine={`${num(data.length)} item${data.length === 1 ? '' : 's'}`}
        loading={loading}
        empty="No items match these filters."
        rows={data.length}
        cols={showOutletFilter ? 9 : 8}
      >
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Item</th>
              {showOutletFilter && <th scope="col">Outlet</th>}
              <th scope="col" className="text-right">Total</th>
              <th scope="col" className="text-right">Available</th>
              <th scope="col" className="text-right">Allocated</th>
              <th scope="col" className="text-right">Damaged</th>
              <th scope="col" className="text-right">In repair</th>
              <th scope="col" className="text-right">Lost (lifetime)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.item_id}>
                <td>
                  <span className="block font-semibold text-ink">{row.item_name}</span>
                  <span className="block text-xs text-ink-muted">{row.category}</span>
                </td>
                {showOutletFilter && (
                  <td className="whitespace-nowrap">
                    {row.outlet_name}
                    {row.outlet_code && <span className="serial ml-1.5 text-xs text-ink-muted">{row.outlet_code}</span>}
                  </td>
                )}
                <td className="tabular text-right font-semibold">{num(row.total_quantity)}</td>
                <td className="tabular text-right font-semibold text-final">{num(row.available_quantity)}</td>
                <td className={cn('tabular text-right', row.allocated_quantity ? 'text-info' : 'text-ink-faint')}>{num(row.allocated_quantity)}</td>
                <td className={cn('tabular text-right', row.damaged_quantity ? 'text-partial' : 'text-ink-faint')}>{num(row.damaged_quantity)}</td>
                <td className={cn('tabular text-right', row.in_repair_quantity ? 'text-void' : 'text-ink-faint')}>{num(row.in_repair_quantity ?? 0)}</td>
                <td className={cn('tabular text-right', row.lost_quantity ? 'text-overdue' : 'text-ink-faint')}>{num(row.lost_quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Ledger>
    </>
  );
}

// ================================================================
// ALLOCATION REPORT TAB
// ================================================================

function AllocationReportTab({ userId, showOutletFilter, outlets, loading, setLoading, setError }: ReportTabProps) {
  const items = useReportItems(userId, setError);
  const [outletId, setOutletId] = useState('');
  const [referenceType, setReferenceType] = useState<'' | 'subscription' | 'event'>('');
  const [itemId, setItemId] = useState('');

  const filters = useMemo<AllocationReportFilters>(() => {
    const f: AllocationReportFilters = {};
    if (outletId) f.outlet_id = outletId;
    if (referenceType) f.reference_type = referenceType;
    if (itemId) f.inventory_item_id = itemId;
    return f;
  }, [outletId, referenceType, itemId]);

  const data = useReportData<AllocationReportRow, AllocationReportFilters>(
    userId,
    filters,
    getAllocationReport,
    setLoading,
    setError
  );

  function handleExport() {
    return runExport(() => exportAllocationReportCSV(userId, filters), 'allocation-report', setError);
  }

  const totalAllocated = data.reduce((sum, row) => sum + (row.allocated_quantity || 0), 0);
  const totalOutstanding = data.reduce((sum, row) => sum + (row.outstanding_quantity || 0), 0);

  return (
    <>
      <Totals cols="grid-cols-3">
        <Total label="Active allocations" value={data.length} />
        <Total label="Sent" value={totalAllocated} tone="text-info" />
        <Total label="Still out" value={totalOutstanding} tone="text-partial" />
      </Totals>

      <FilterBar onExport={handleExport} canExport={data.length > 0}>
        {showOutletFilter && <OutletSelect outlets={outlets} value={outletId} onChange={setOutletId} />}
        <Field width="sm:w-44">
          <Select
            label="Booking type"
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value as '' | 'subscription' | 'event')}
          >
            <option value="">All types</option>
            <option value="subscription">Subscription</option>
            <option value="event">Event</option>
          </Select>
        </Field>
        <Field width="sm:w-64">
          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <Ledger
        title="Dishes out"
        countLine={`${num(data.length)} allocation${data.length === 1 ? '' : 's'} · ${num(totalOutstanding)} pcs still out`}
        loading={loading}
        empty="No dishware is out for these filters."
        rows={data.length}
        cols={showOutletFilter ? 6 : 5}
      >
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Item</th>
              {showOutletFilter && <th scope="col">Outlet</th>}
              <th scope="col">Booking</th>
              <th scope="col" className="text-right">Sent</th>
              <th scope="col" className="text-right">Still out</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.allocation_id}>
                <td>
                  <span className="block font-semibold text-ink">{row.item_name}</span>
                  <span className="block text-xs text-ink-muted">{row.item_category}</span>
                </td>
                {showOutletFilter && <td className="whitespace-nowrap">{row.outlet_name}</td>}
                <td>
                  <RefCell type={row.reference_type} name={row.reference_name} />
                </td>
                <td className="tabular text-right">{num(row.allocated_quantity)}</td>
                <td className={cn('tabular text-right font-semibold', row.outstanding_quantity ? 'text-partial' : 'text-final')}>
                  {num(row.outstanding_quantity)}
                </td>
                <td>
                  {row.is_active ? <Badge variant="final">Active</Badge> : <Badge variant="void">Closed</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Ledger>
    </>
  );
}

// ================================================================
// DAMAGE & LOSS REPORT TAB
// ================================================================

function DamageLossReportTab({ userId, showOutletFilter, outlets, loading, setLoading, setError }: ReportTabProps) {
  const items = useReportItems(userId, setError);
  const [outletId, setOutletId] = useState('');
  const [movementType, setMovementType] = useState<'' | 'damage' | 'loss'>('');
  const [itemId, setItemId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = useMemo<DamageLossReportFilters>(() => {
    const f: DamageLossReportFilters = {};
    if (outletId) f.outlet_id = outletId;
    if (movementType) f.movement_type = movementType;
    if (itemId) f.inventory_item_id = itemId;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [outletId, movementType, itemId, dateFrom, dateTo]);

  const data = useReportData<DamageLossRow, DamageLossReportFilters>(
    userId,
    filters,
    getDamageLossReport,
    setLoading,
    setError
  );

  function handleExport() {
    return runExport(() => exportDamageLossCSV(userId, filters), 'damage-loss-report', setError);
  }

  const totalIncidents = data.reduce((sum, row) => sum + (Number(row.incident_count) || 0), 0);
  const totalQuantity = data.reduce((sum, row) => sum + (Number(row.total_quantity) || 0), 0);

  return (
    <>
      <Totals cols="grid-cols-2">
        <Total label="Incidents" value={totalIncidents} />
        <Total label="Pieces affected" value={totalQuantity} tone="text-overdue" />
      </Totals>

      <FilterBar onExport={handleExport} canExport={data.length > 0}>
        {showOutletFilter && <OutletSelect outlets={outlets} value={outletId} onChange={setOutletId} />}
        <Field width="sm:w-36">
          <Select
            label="Type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as '' | 'damage' | 'loss')}
          >
            <option value="">All types</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
          </Select>
        </Field>
        <Field width="sm:w-64">
          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>
        </Field>
        <Field width="sm:w-44">
          <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field width="sm:w-44">
          <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
      </FilterBar>

      <Ledger
        title="Damage and loss"
        countLine={`${num(data.length)} row${data.length === 1 ? '' : 's'} · ${num(totalQuantity)} pcs`}
        loading={loading}
        empty="No damage or loss recorded for these filters."
        rows={data.length}
        cols={showOutletFilter ? 7 : 6}
      >
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Item</th>
              {showOutletFilter && <th scope="col">Outlet</th>}
              <th scope="col">Type</th>
              <th scope="col" className="text-right">Incidents</th>
              <th scope="col" className="text-right">Pieces</th>
              <th scope="col">Booking</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.report_date}-${row.inventory_item_id}-${row.movement_type}-${row.reference_type}-${row.reference_id ?? ''}`}>
                <td className="whitespace-nowrap text-ink-muted">{fmtDay(row.report_date)}</td>
                <td>
                  <span className="block font-semibold text-ink">{row.item_name}</span>
                  <span className="block text-xs text-ink-muted">{row.item_category}</span>
                </td>
                {showOutletFilter && <td className="whitespace-nowrap">{row.outlet_name}</td>}
                <td>
                  <Badge variant={row.movement_type === 'loss' ? 'overdue' : 'partial'}>
                    {row.movement_type === 'loss' ? 'Loss' : 'Damage'}
                  </Badge>
                </td>
                <td className="tabular text-right">{num(row.incident_count)}</td>
                <td className="tabular text-right font-semibold text-overdue">{num(row.total_quantity)}</td>
                <td>
                  <RefCell type={row.reference_type} name={row.reference_name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Ledger>
    </>
  );
}

// ================================================================
// MOVEMENT HISTORY REPORT TAB
// ================================================================

function MovementHistoryReportTab({ userId, showOutletFilter, outlets, loading, setLoading, setError }: ReportTabProps) {
  const items = useReportItems(userId, setError);
  const [outletId, setOutletId] = useState('');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [itemId, setItemId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = useMemo<MovementHistoryReportFilters>(() => {
    const f: MovementHistoryReportFilters = {};
    if (outletId) f.outlet_id = outletId;
    if (movementType) f.movement_type = movementType;
    if (itemId) f.inventory_item_id = itemId;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [outletId, movementType, itemId, dateFrom, dateTo]);

  const data = useReportData<InventoryMovement, MovementHistoryReportFilters>(
    userId,
    filters,
    getMovementHistoryReport,
    setLoading,
    setError
  );

  function handleExport() {
    return runExport(() => exportMovementHistoryCSV(userId, filters), 'movement-history', setError);
  }

  return (
    <>
      <FilterBar onExport={handleExport} canExport={data.length > 0}>
        {showOutletFilter && <OutletSelect outlets={outlets} value={outletId} onChange={setOutletId} />}
        <Field width="sm:w-48">
          <Select
            label="Movement type"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as MovementType | '')}
          >
            <option value="">All types</option>
            {MOVEMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field width="sm:w-64">
          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>
        </Field>
        <Field width="sm:w-44">
          <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field width="sm:w-44">
          <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
      </FilterBar>

      <Ledger
        title="Movement history"
        countLine={`${num(data.length)} movement${data.length === 1 ? '' : 's'} · the ledger is append-only`}
        loading={loading}
        empty="No movements for these filters."
        rows={data.length}
        cols={showOutletFilter ? 8 : 7}
      >
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Date (IST)</th>
              <th scope="col">Item</th>
              {showOutletFilter && <th scope="col">Outlet</th>}
              <th scope="col">Type</th>
              <th scope="col" className="text-right">Pieces</th>
              <th scope="col">Booking</th>
              <th scope="col">Notes</th>
              <th scope="col">By</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const when = istDateTimeParts(row.created_at);
              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">
                    <span className="block text-ink">{fmtDay(when.date)}</span>
                    <span className="tabular block text-xs text-ink-muted">{when.time}</span>
                  </td>
                  <td>
                    <span className="block font-semibold text-ink">{row.item_name}</span>
                    <span className="block text-xs text-ink-muted">{row.item_category}</span>
                  </td>
                  {showOutletFilter && <td className="whitespace-nowrap">{row.outlet_name}</td>}
                  <td>
                    <span
                      className={cn(
                        'inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold',
                        MOVEMENT_TYPE_COLORS[row.movement_type as MovementType] ?? 'border-rule bg-paper-sunk text-ink-muted'
                      )}
                    >
                      {movementTypeLabel(row.movement_type)}
                    </span>
                  </td>
                  <td className="tabular text-right font-semibold">{num(row.quantity)}</td>
                  <td>
                    <RefCell type={row.reference_type} name={row.reference_name} />
                  </td>
                  <td className="max-w-xs truncate text-ink-muted" title={row.notes || undefined}>
                    {row.notes || '—'}
                  </td>
                  <td className="whitespace-nowrap text-ink-muted">{row.created_by_name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Ledger>
    </>
  );
}
