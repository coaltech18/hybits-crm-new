import { cn } from '@/utils/cn';
import { Badge, type BadgeVariant } from './Badge';

// ================================================================
// STATUS — one vocabulary for every record's state.
// <StatusBadge kind="invoice" status="paid" />  in tables
// <StatusStamp kind="invoice" status="paid" />  on record headers
// ================================================================

type Kind = 'invoice' | 'subscription' | 'event' | 'audit' | 'payment';

const MAP: Record<Kind, Record<string, { label: string; variant: BadgeVariant }>> = {
  invoice: {
    draft: { label: 'Draft', variant: 'draft' },
    finalized: { label: 'Finalized', variant: 'final' },
    partially_paid: { label: 'Part paid', variant: 'partial' },
    paid: { label: 'Paid', variant: 'paid' },
    cancelled: { label: 'Cancelled', variant: 'void' },
    overdue: { label: 'Overdue', variant: 'overdue' },
  },
  subscription: {
    active: { label: 'Active', variant: 'final' },
    paused: { label: 'Paused', variant: 'draft' },
    cancelled: { label: 'Cancelled', variant: 'void' },
  },
  event: {
    planned: { label: 'Planned', variant: 'info' },
    completed: { label: 'Completed', variant: 'final' },
    cancelled: { label: 'Cancelled', variant: 'void' },
    archived: { label: 'Archived', variant: 'default' },
  },
  audit: {
    draft: { label: 'Draft', variant: 'draft' },
    submitted: { label: 'Submitted', variant: 'info' },
    approved: { label: 'Approved', variant: 'final' },
    rejected: { label: 'Rejected', variant: 'overdue' },
  },
  payment: {
    unpaid: { label: 'Unpaid', variant: 'overdue' },
    partially_paid: { label: 'Part paid', variant: 'partial' },
    paid: { label: 'Paid', variant: 'paid' },
    active: { label: 'Recorded', variant: 'final' },
    voided: { label: 'Voided', variant: 'void' },
  },
};

function resolve(kind: Kind, status: string) {
  return MAP[kind][status] ?? { label: status.replace(/_/g, ' '), variant: 'default' as BadgeVariant };
}

export function StatusBadge({ kind, status, className }: { kind: Kind; status: string; className?: string }) {
  const s = resolve(kind, status);
  return <Badge variant={s.variant} className={className}>{s.label}</Badge>;
}

const STAMP_INK: Partial<Record<BadgeVariant, string>> = {
  draft: 'text-draft border-draft',
  final: 'text-final border-final',
  partial: 'text-partial border-partial',
  paid: 'text-stamp border-stamp',
  overdue: 'text-overdue border-overdue',
  void: 'text-void border-void',
  info: 'text-info border-info',
};

/** The Bill Book signature: a rubber-stamp impression. `animate` presses it in (use after a state change). */
export function StatusStamp({
  kind, status, detail, animate = false, className,
}: { kind: Kind; status: string; detail?: string; animate?: boolean; className?: string }) {
  const s = resolve(kind, status);
  return (
    <span
      role="status"
      aria-label={`Status: ${s.label}${detail ? `, ${detail}` : ''}`}
      className={cn(
        'inline-flex flex-col items-center justify-center rounded-md border-[2.5px] px-3 py-1 -rotate-[4deg]',
        'outline outline-1 outline-offset-2 bg-white/60',
        'font-mono font-semibold uppercase tracking-[0.14em] leading-none select-none',
        STAMP_INK[s.variant] ?? 'text-ink-muted border-ink-muted',
        animate && 'animate-stamp',
        className
      )}
      style={{ outlineColor: 'currentColor' }}
    >
      <span className="text-sm">{s.label}</span>
      {detail && <span className="mt-1 text-xs tracking-[0.06em] opacity-90">{detail}</span>}
    </span>
  );
}
