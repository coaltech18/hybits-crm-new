import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

// ================================================================
// LIFECYCLE BADGE (V2)
// ================================================================
// draft → draft tint, active → final, discontinued → partial,
// archived → void. Same carbon-copy vocabulary as every status.
// ================================================================

interface LifecycleBadgeProps {
    status: 'draft' | 'active' | 'discontinued' | 'archived' | string;
    size?: 'sm' | 'md';
}

const LIFECYCLE: Record<string, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'Draft', variant: 'draft' },
    active: { label: 'Active', variant: 'final' },
    discontinued: { label: 'Discontinued', variant: 'partial' },
    archived: { label: 'Archived', variant: 'void' },
};

export function LifecycleBadge({ status, size = 'md' }: LifecycleBadgeProps) {
    const config = LIFECYCLE[status] ?? {
        label: status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'Unknown',
        variant: 'default' as BadgeVariant,
    };

    return (
        <Badge variant={config.variant} className={cn(size === 'sm' && 'px-1.5 py-0')}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {config.label}
        </Badge>
    );
}

// ================================================================
// STOCK BREAKDOWN
// ================================================================
// The six stock buckets as one hairline-ruled strip of figures
// (or one dense line when `compact`). Zero buckets read quiet.
// ================================================================

interface StockBreakdownProps {
    total: number;
    available: number;
    allocated: number;
    damaged: number;
    inRepair: number;
    lost: number;
    compact?: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export function StockBreakdown({
    total,
    available,
    allocated,
    damaged,
    inRepair,
    lost,
    compact = false,
}: StockBreakdownProps) {
    if (compact) {
        return (
            <div className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-ink">{fmt(total)}</span>
                <span className="text-final">{fmt(available)} available</span>
                <span className="text-info">{fmt(allocated)} allocated</span>
                {damaged > 0 && <span className="text-partial">{fmt(damaged)} damaged</span>}
                {inRepair > 0 && <span className="text-void">{fmt(inRepair)} in repair</span>}
                {lost > 0 && <span className="text-overdue">{fmt(lost)} lost</span>}
            </div>
        );
    }

    return (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-6">
            <QuantityCard label="Total" value={total} color="text-ink" />
            <QuantityCard label="Available" value={available} color="text-final" />
            <QuantityCard label="Allocated" value={allocated} color="text-info" />
            <QuantityCard label="Damaged" value={damaged} color="text-partial" />
            <QuantityCard label="In repair" value={inRepair} color="text-void" />
            <QuantityCard label="Lost" value={lost} color="text-overdue" />
        </dl>
    );
}

function QuantityCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="min-w-0 bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
            <dd className={cn('tabular mt-1 text-2xl font-semibold', value === 0 ? 'text-ink-faint' : color)}>
                {fmt(value)}
            </dd>
        </div>
    );
}

// MovementTypeIcon, DaysOutstandingBadge, AuditLockWarning and OpeningLockIndicator
// were removed: nothing rendered them.
