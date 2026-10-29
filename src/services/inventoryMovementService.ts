import { supabase } from '@/lib/supabase';
import { addDaysISO, parseLocalISODate } from '@/utils/date';
import type { InventoryMovement, MovementFilters } from '@/types';

// ================================================================
// INVENTORY MOVEMENT READS
// ================================================================
// Stock changes are written only through inventoryMovementServiceV2
// (INSERT into inventory_movements; DB triggers update the buckets).
// This file holds the read side of the ledger.
//
// The V1 writers (createStockIn, allocateInventory, returnInventory,
// markDamage, markLoss, adjustInventory) were removed: they had no
// callers and bypassed reason_code.
// ================================================================

/** Rows PostgREST returns per request (supabase/config.toml max_rows). */
export const PAGE_SIZE_MAX = 1000;

/**
 * Start of a calendar day in IST as a UTC timestamp, for timestamptz filters.
 * A bare 'YYYY-MM-DD' would be read as UTC midnight.
 */
export function istDayStartISO(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00+05:30`).toISOString();
}

/** Start of the IST day AFTER `isoDate`, for an inclusive 'to' date used with .lt(). */
export function istNextDayStartISO(isoDate: string): string {
  return istDayStartISO(addDaysISO(1, parseLocalISODate(isoDate)));
}

const IST_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Locale-independent IST date and time of a timestamp: { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export function istDateTimeParts(ts: string): { date: string; time: string } {
  const p = Object.fromEntries(IST_PARTS.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** 'YYYY-MM-DD HH:mm' in IST, for CSV exports. */
export function formatISTDateTime(ts: string): string {
  const { date, time } = istDateTimeParts(ts);
  return `${date} ${time}`;
}

interface PagedResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Fetch every row of a query in PAGE_SIZE_MAX chunks, so exports and totals are
 * not silently truncated at max_rows. `build(from, to)` must apply a stable order.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PagedResult<T>>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE_MAX) {
    const { data, error } = await build(from, from + PAGE_SIZE_MAX - 1);
    if (error) throw new Error(error.message);
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE_MAX) return all;
  }
}

type MovementRow = InventoryMovement & { movement_id?: string };

/** The view exposes movement_id (and id from migration 042); normalise to id. */
function normaliseMovement(row: MovementRow): InventoryMovement {
  return { ...row, id: row.id ?? (row.movement_id as string) };
}

function buildMovementQuery(filters: MovementFilters, withCount = false) {
  let query = supabase
    .from('inventory_movements_with_details')
    .select('*', withCount ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false })
    .order('movement_id', { ascending: false });

  if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
  if (filters.inventory_item_id) query = query.eq('inventory_item_id', filters.inventory_item_id);
  if (filters.movement_type) query = query.eq('movement_type', filters.movement_type);
  if (filters.reference_type) query = query.eq('reference_type', filters.reference_type);
  if (filters.reference_id) query = query.eq('reference_id', filters.reference_id);
  if (filters.date_from) query = query.gte('created_at', istDayStartISO(filters.date_from));
  if (filters.date_to) query = query.lt('created_at', istNextDayStartISO(filters.date_to));

  return query;
}

/**
 * Get ALL inventory movements matching the filters (paged internally).
 *
 * @param _userId - Current user ID (RLS scopes rows)
 * @param filters - Optional filters; dates are IST calendar days, both inclusive
 */
export async function getInventoryMovements(
  _userId: string,
  filters: MovementFilters = {}
): Promise<InventoryMovement[]> {
  const rows = await fetchAllRows<MovementRow>((from, to) =>
    buildMovementQuery(filters).range(from, to)
  );
  return rows.map(normaliseMovement);
}

/**
 * Get one page of movements plus the total match count, for on-screen lists.
 *
 * @param page - zero-based page index
 */
export async function getInventoryMovementsPage(
  filters: MovementFilters,
  page: number,
  pageSize: number
): Promise<{ rows: InventoryMovement[]; total: number }> {
  const from = page * pageSize;
  const { data, error, count } = await buildMovementQuery(filters, true).range(
    from,
    from + pageSize - 1
  );
  if (error) throw new Error(error.message);
  return {
    rows: ((data || []) as MovementRow[]).map(normaliseMovement),
    total: count ?? 0,
  };
}
