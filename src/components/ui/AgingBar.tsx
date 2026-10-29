import { cn } from '@/utils/cn';

// ================================================================
// AGING BAR — length is the exact number of days outstanding.
// Fixed scale (1 day = `pxPerDay`) so bars compare across rows and
// pages; capped at `capDays` with a "+" so one ancient row can't
// flatten the rest. Amber up to 30 days, overdue-red from day 31 (aging report buckets).
// ================================================================

interface AgingBarProps {
  days: number;
  capDays?: number;
  pxPerDay?: number;
  className?: string;
}

export function AgingBar({ days, capDays = 90, pxPerDay = 1.2, className }: AgingBarProps) {
  const d = Math.max(0, Math.floor(days));
  const shown = Math.min(d, capDays);
  const late = d > 30; // matches the aging report's 0–30 / 31+ buckets
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', className)} title={`${d} day${d === 1 ? '' : 's'} outstanding`}>
      <span className="relative block h-2 rounded-full bg-paper-sunk" style={{ width: capDays * pxPerDay }} aria-hidden="true">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', late ? 'bg-overdue' : 'bg-partial')}
          style={{ width: Math.max(shown * pxPerDay, d > 0 ? 3 : 0) }}
        />
      </span>
      <span className={cn('tabular text-xs font-semibold', late ? 'text-overdue' : 'text-ink-muted')}>
        {d > capDays ? `${capDays}+` : d}d
      </span>
    </span>
  );
}
