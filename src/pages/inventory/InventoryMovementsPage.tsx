import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getInventoryMovements,
  getInventoryMovementsPage,
  istDateTimeParts,
} from '@/services/inventoryMovementService';
import { getInventoryItems } from '@/services/inventoryService';
import type { InventoryMovement, InventoryItem, MovementType, MovementFilters } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { History, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { objectsToCsv, downloadCsv } from '@/utils/csv';
import { todayISO } from '@/utils/date';
import { cn } from '@/utils/cn';
import { movementTypeLabel } from '@/components/inventory/movementLabels';
import { MovementBadge, SignedQty, ReferenceCell } from './StockParts';
import { MOVEMENT_FILTER_OPTIONS, istWhen, pcs } from './stockDisplay';

// ================================================================
// INVENTORY MOVEMENTS PAGE
// ================================================================
// CRITICAL RULES:
// - Read-only for all roles
// - All data from DB (inventory_movements_with_details view)
// - On-screen list is paged; CSV export fetches every matching row
// - Manager sees assigned outlets only (RLS enforced)
// ================================================================

const PAGE_SIZE = 50;

export default function InventoryMovementsPage() {
  useDocumentTitle('Stock movements');
  const { user, outlets } = useAuth();
  const [searchParams] = useSearchParams();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [outletId, setOutletId] = useState('');
  const [itemId, setItemId] = useState(searchParams.get('item') || '');
  const [movementType, setMovementType] = useState<MovementType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const userRole = user?.role || '';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets = outlets || [];

  const buildFilters = useCallback((): MovementFilters => {
    const filters: MovementFilters = {};
    if (outletId) filters.outlet_id = outletId;
    if (itemId) filters.inventory_item_id = itemId;
    if (movementType) filters.movement_type = movementType;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    return filters;
  }, [outletId, itemId, movementType, dateFrom, dateTo]);

  useEffect(() => {
    if (!user?.id) return;
    getInventoryItems(user.id, { is_active: 'all' })
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? `Failed to load items: ${err.message}` : 'Failed to load items')
      );
  }, [user?.id]);

  // Back to the first page whenever a filter changes.
  useEffect(() => {
    setPage(0);
  }, [outletId, itemId, movementType, dateFrom, dateTo]);

  useEffect(() => {
    if (!user?.id) return;
    let stale = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getInventoryMovementsPage(buildFilters(), page, PAGE_SIZE);
        if (!stale) {
          setMovements(result.rows);
          setTotal(result.total);
        }
      } catch (err) {
        if (!stale) setError(err instanceof Error ? err.message : 'Failed to load movements');
      } finally {
        if (!stale) setLoading(false);
      }
    })();

    return () => {
      stale = true;
    };
  }, [user?.id, buildFilters, page]);

  async function exportToCSV() {
    if (!user?.id || exporting) return;
    try {
      setExporting(true);
      const all = await getInventoryMovements(user.id, buildFilters());
      const rows = all.map((m) => {
        const { date, time } = istDateTimeParts(m.created_at);
        return {
          Date: date,
          Time: time,
          Item: m.item_name || '',
          Category: m.item_category || '',
          Outlet: m.outlet_name || '',
          'Movement Type': movementTypeLabel(m.movement_type),
          Quantity: m.quantity,
          'Reference Type': m.reference_type,
          'Reference Name': m.reference_name || '',
          Notes: m.notes || '',
          'Created By': m.created_by_name || '',
        };
      });
      downloadCsv(`inventory-movements-${todayISO()}.csv`, objectsToCsv(rows));
    } catch (err) {
      setError(err instanceof Error ? `Export failed: ${err.message}` : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && movements.length === 0;
  const hasFilters = Boolean(outletId || itemId || movementType || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Stock movements"
        description="Every piece added, sent out, returned or written off. The ledger can’t be edited."
        actions={
          total > 0 && (
            <Button type="button" variant="outline" onClick={exportToCSV} disabled={exporting}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          )
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Filters */}
      <Card padding="sm" className="mb-6">
        <div
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2',
            showOutletFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          )}
        >
          {showOutletFilter && (
            <Select label="Outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">All outlets</option>
              {availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          )}

          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.category})
              </option>
            ))}
          </Select>

          <Select
            label="Movement"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as MovementType | '')}
          >
            <option value="">All movements</option>
            {MOVEMENT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />

          <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end border-t border-rule pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOutletId('');
                setItemId('');
                setMovementType('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {/* Movements ledger */}
      <section className="sheet overflow-hidden" aria-labelledby="movements-h" aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-4">
          <div className="min-w-0">
            <h2 id="movements-h" className="text-lg font-semibold text-ink">Ledger</h2>
            <p className="text-sm text-ink-muted">
              Newest first. + and − show the change to available stock; unsigned rows moved pieces between other buckets.
            </p>
          </div>
          {!firstLoad && total > 0 && (
            <p className="tabular shrink-0 text-sm text-ink-muted">
              {pcs(page * PAGE_SIZE + 1)}–{pcs(page * PAGE_SIZE + movements.length)} of {pcs(total)} movements
            </p>
          )}
        </div>

        {firstLoad ? (
          <TableSkeleton rows={8} cols={6} />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={History}
            title={hasFilters ? 'No movements match these filters' : 'No movements recorded yet'}
            description={
              hasFilters
                ? 'Widen the date range or clear the filters.'
                : 'Stock added, sent out, returned or written off will appear here.'
            }
          />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">When · by</th>
                  <th scope="col">Movement</th>
                  <th scope="col" className="text-right">Qty</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const when = istWhen(movement.created_at);
                  return (
                    <tr key={movement.id}>
                      <td className="min-w-[10rem]">
                        <div className="inline-block max-w-full align-top">
                          <div className="font-semibold text-ink">{movement.item_name}</div>
                          <div className="text-xs text-ink-muted">
                            {[movement.item_category, showOutletFilter ? movement.outlet_name : null].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div>
                          <div className="text-ink">
                            {when.date} <span className="tabular text-ink-muted">{when.time}</span>
                          </div>
                          <div className="text-xs text-ink-muted">{movement.created_by_name || '—'}</div>
                        </div>
                      </td>
                      <td><MovementBadge type={movement.movement_type} /></td>
                      <td className="cell-emph text-right"><SignedQty movement={movement} /></td>
                      <td className="min-w-[10rem]"><ReferenceCell movement={movement} /></td>
                      <td className="max-w-[16rem] truncate text-ink-muted" title={movement.notes || undefined}>
                        {movement.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3"
          >
            <span className="tabular text-sm text-ink-muted">
              Page {page + 1} of {pcs(pageCount)}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
