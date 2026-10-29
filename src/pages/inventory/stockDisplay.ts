import type { BadgeVariant } from '@/components/ui/Badge';
import type { MovementType } from '@/types';
import { MOVEMENT_TYPE_OPTIONS, movementTypeLabel } from '@/components/inventory/movementLabels';
import { istDateTimeParts } from '@/services/inventoryMovementService';

// ================================================================
// STOCK DISPLAY — presentation helpers shared by the inventory
// overview, items, item detail and movements pages. Nothing here
// reads or writes data; it only decides how a figure or a movement
// is shown.
// ================================================================

export const pcs = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n);

/** Sentence-case label for a movement type ("Sent Out" → "Sent out"). */
export function movementLabel(type: string): string {
  const label = movementTypeLabel(type);
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export const MOVEMENT_FILTER_OPTIONS = MOVEMENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: movementLabel(o.value),
}));

/** Badge tint per movement type. Same tokens as the stock buckets. */
const MOVEMENT_TONE: Record<MovementType, BadgeVariant> = {
  stock_in: 'final',
  allocation: 'partial',
  return: 'final',
  return_damaged: 'overdue',
  damage: 'overdue',
  loss: 'void',
  disposal: 'void',
  send_to_repair: 'info',
  return_from_repair: 'info',
  adjustment: 'draft',
};

export function movementTone(type: string): BadgeVariant {
  return MOVEMENT_TONE[type as MovementType] ?? 'default';
}

const NEGATIVE_ADJUSTMENT = ['audit_shortage', 'missing_stock', 'count_correction_negative', 'unrecorded_damage', 'unrecorded_loss'];

interface MovementLike {
  movement_type: string;
  movement_category?: string | null;
  reason_code?: string | null;
  reference_type?: string | null;
}

/**
 * The change a movement made to AVAILABLE stock (the shelf): +1, -1, 0 when
 * pieces only moved between other buckets (e.g. client → damaged), or null
 * when the row does not carry enough to tell (reason_code not fetched).
 * Mirrors update_inventory_quantities_v2 (migration 042) for display only.
 */
export function availableEffect(m: MovementLike): 1 | -1 | 0 | null {
  const t = m.movement_type;
  const r = m.reason_code;
  switch (m.movement_category) {
    case 'inflow':
      return 1;
    case 'outflow':
      return -1;
    case 'return':
      if (t === 'return_damaged' || r === 'client_damage' || r === 'transit_damage') return 0;
      return 1;
    case 'writeoff':
      // Write-offs against a client/event come out of "out with clients";
      // warehouse write-offs (damage, loss) come off the shelf; disposals
      // come out of damaged stock.
      if (t === 'disposal') return 0;
      if (t === 'damage' || t === 'loss') {
        return m.reference_type === 'subscription' || m.reference_type === 'event' ? 0 : -1;
      }
      return null;
    case 'adjustment':
      if (r === undefined) return null;
      return r !== null && (NEGATIVE_ADJUSTMENT.includes(r) || r.includes('negative')) ? -1 : 1;
    case 'repair':
      if (t === 'send_to_repair') return 0;
      if (r === undefined) return null;
      return r === 'repaired' ? 1 : 0;
    default:
      // Rows from before the V2 categories.
      if (t === 'stock_in' || t === 'return' || t === 'adjustment') return 1;
      if (t === 'allocation') return -1;
      if (t === 'damage' || t === 'loss') return 0;
      return null;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** IST date as "29 Oct 2026" plus "14:05". */
export function istWhen(ts: string): { date: string; time: string } {
  const { date, time } = istDateTimeParts(ts);
  const [y, m, d] = date.split('-');
  const month = MONTHS[Number(m) - 1];
  return { date: month ? `${d} ${month} ${y}` : date, time };
}

/**
 * Share of a whole as a percent label. Whole percents, except that a
 * non-zero share never reads "0%" ("<1%") and a share short of the
 * whole never reads "100%" (">99%").
 */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return '0%';
  const pct = (part / whole) * 100;
  if (pct < 1) return '<1%';
  if (pct > 99 && part < whole) return '>99%';
  return `${Math.round(pct)}%`;
}
