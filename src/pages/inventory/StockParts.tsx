import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { availableEffect, formatShare, movementLabel, movementTone, pcs } from './stockDisplay';

// ================================================================
// STOCK PARTS — the stock strip (figures + proportion bar) and the
// movement cells shared by the inventory pages. Presentation only.
// ================================================================

export interface StockFigures {
  total: number;
  available: number;
  allocated: number;
  damaged: number;
  inRepair: number;
  lost: number;
}

type Bucket = { key: string; label: string; value: number; swatch: string; ink: string };

/**
 * A money-strip-style sheet of stock figures with a single stacked bar
 * underneath. The swatch beside each label is the bar's legend.
 * "In repair" appears only when there is something in repair.
 */
export function StockStrip({
  figures,
  loading,
  label = 'Stock figures',
  footer,
}: {
  figures: StockFigures | null;
  loading: boolean;
  label?: string;
  footer?: React.ReactNode;
}) {
  const f = figures;
  const buckets: Bucket[] = [
    { key: 'available', label: 'Available', value: f?.available ?? 0, swatch: 'bg-final', ink: 'text-final' },
    { key: 'allocated', label: 'Out with clients', value: f?.allocated ?? 0, swatch: 'bg-partial', ink: 'text-partial' },
    { key: 'damaged', label: 'Damaged', value: f?.damaged ?? 0, swatch: 'bg-overdue', ink: 'text-overdue' },
    ...((f?.inRepair ?? 0) > 0
      ? [{ key: 'repair', label: 'In repair', value: f?.inRepair ?? 0, swatch: 'bg-info', ink: 'text-info' }]
      : []),
    { key: 'lost', label: 'Lost', value: f?.lost ?? 0, swatch: 'bg-void', ink: 'text-void' },
  ];
  const onRecord = buckets.reduce((s, b) => s + b.value, 0);
  const share = (v: number) => formatShare(v, onRecord);
  const six = buckets.length === 5;
  const show = !loading && f !== null;

  return (
    <section aria-label={label} className="sheet mb-6 overflow-hidden">
      <div
        className={cn(
          'grid gap-px border-b border-rule bg-rule',
          six ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'
        )}
      >
        <Figure label="Total pieces" hint="Owned, lost excluded" loading={!show} className={six ? undefined : 'col-span-2 sm:col-span-1'}>
          {pcs(f?.total)}
        </Figure>
        {buckets.map((b) => (
          <Figure
            key={b.key}
            label={b.label}
            swatch={b.swatch}
            hint={onRecord > 0 ? `${share(b.value)} of pieces on record` : 'No pieces on record'}
            loading={!show}
          >
            <span className={b.value > 0 ? b.ink : 'text-ink-faint'}>{pcs(b.value)}</span>
          </Figure>
        ))}
      </div>

      <div className="px-5 py-4 sm:px-6">
        {!show ? (
          <Skeleton className="h-3 w-full rounded-full" />
        ) : onRecord === 0 ? (
          <p className="text-sm text-ink-muted">No pieces on record yet. Add stock to an item to start the count.</p>
        ) : (
          <>
            <div
              role="img"
              aria-label={`Share of pieces on record: ${buckets.map((b) => `${b.label.toLowerCase()} ${share(b.value)}`).join(', ')}`}
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-paper-sunk"
            >
              {buckets
                .filter((b) => b.value > 0)
                .map((b) => (
                  <div key={b.key} className={cn('h-full min-w-[4px]', b.swatch)} style={{ flex: `${b.value} 0 0` }} />
                ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              The bar splits every piece on record. Lost pieces are shown here but are not part of the total.
            </p>
          </>
        )}
        {footer}
      </div>
    </section>
  );
}

function Figure({
  label,
  hint,
  swatch,
  loading,
  className,
  children,
}: {
  label: string;
  hint: string;
  swatch?: string;
  loading: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 bg-white px-5 py-4 sm:px-6', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {swatch && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', swatch)} aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="amount mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{children}</div>
      )}
      <div className="mt-1 truncate text-xs text-ink-muted">{loading ? ' ' : hint}</div>
    </div>
  );
}

/** Movement type as a tinted badge, sentence case. */
export function MovementBadge({ type }: { type: string }) {
  return <Badge variant={movementTone(type)}>{movementLabel(type)}</Badge>;
}

/** Quantity signed by its effect on available stock: + final, − overdue, unsigned when it only moved between other buckets. */
export function SignedQty({
  movement,
}: {
  movement: { movement_type: string; movement_category?: string | null; reason_code?: string | null; reference_type?: string | null; quantity: number };
}) {
  const effect = availableEffect(movement);
  const n = pcs(Math.abs(movement.quantity));
  if (effect === 1) return <span className="amount font-semibold text-final">+{n}</span>;
  if (effect === -1) return <span className="amount font-semibold text-overdue">{'−'}{n}</span>;
  return <span className="amount font-semibold text-ink-muted">{pcs(movement.quantity)}</span>;
}

/** Subscription or event a movement belongs to, linked when it has an id. */
export function ReferenceCell({
  movement,
}: {
  movement: { reference_type: string; reference_id?: string | null; reference_name?: string | null };
}) {
  if (movement.reference_type === 'manual') return <span className="text-ink-muted">Manual</span>;
  const name = movement.reference_name || (movement.reference_type === 'event' ? 'Event' : 'Subscription');
  const to = movement.reference_id
    ? movement.reference_type === 'event'
      ? `/events/${movement.reference_id}`
      : `/subscriptions/${movement.reference_id}`
    : null;
  return (
    <div className="min-w-0">
      {to ? (
        <Link to={to} className="font-medium text-ink hover:text-brand-primary">
          {name}
        </Link>
      ) : (
        <span className="font-medium text-ink">{name}</span>
      )}
      <div className="text-xs capitalize text-ink-muted">{movement.reference_type}</div>
    </div>
  );
}
