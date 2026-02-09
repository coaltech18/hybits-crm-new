// No React import required with modern JSX transform

// ================================================================
// LIFECYCLE BADGE COMPONENT (V2)
// ================================================================
// Displays a badge for the item's lifecycle status:
// - draft: Gray
// - active: Green
// - discontinued: Yellow
// - archived: Red
// ================================================================

interface LifecycleBadgeProps {
    status: 'draft' | 'active' | 'discontinued' | 'archived' | string;
    size?: 'sm' | 'md';
}

export function LifecycleBadge({ status, size = 'md' }: LifecycleBadgeProps) {
    const config = getStatusConfig(status);

    const sizeClasses = size === 'sm'
        ? 'text-xs px-1.5 py-0.5'
        : 'text-xs px-2 py-1';

    return (
        <span
            className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${config.bgColor} ${config.textColor}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotColor}`} />
            {config.label}
        </span>
    );
}

function getStatusConfig(status: string): {
    label: string;
    bgColor: string;
    textColor: string;
    dotColor: string;
} {
    switch (status) {
        case 'draft':
            return {
                label: 'Draft',
                bgColor: 'bg-gray-100',
                textColor: 'text-gray-700',
                dotColor: 'bg-gray-500',
            };
        case 'active':
            return {
                label: 'Active',
                bgColor: 'bg-green-100',
                textColor: 'text-green-700',
                dotColor: 'bg-green-500',
            };
        case 'discontinued':
            return {
                label: 'Discontinued',
                bgColor: 'bg-yellow-100',
                textColor: 'text-yellow-700',
                dotColor: 'bg-yellow-500',
            };
        case 'archived':
            return {
                label: 'Archived',
                bgColor: 'bg-red-100',
                textColor: 'text-red-700',
                dotColor: 'bg-red-500',
            };
        default:
            return {
                label: status || 'Unknown',
                bgColor: 'bg-gray-100',
                textColor: 'text-gray-700',
                dotColor: 'bg-gray-500',
            };
    }
}

// ================================================================
// OPENING BALANCE LOCK INDICATOR
// ================================================================
// Shows if the opening balance is locked or unlocked:
// - Locked: 🔒 (can't adjust without admin)
// - Unlocked: 🔓 (needs confirmation)
// ================================================================

interface OpeningLockIndicatorProps {
    locked: boolean;
    showLabel?: boolean;
}

export function OpeningLockIndicator({
    locked,
    showLabel = false,
}: OpeningLockIndicatorProps) {
    if (locked) {
        return (
            <span
                className="inline-flex items-center text-green-600"
                title="Opening balance confirmed and locked"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                </svg>
                {showLabel && <span className="ml-1 text-xs">Locked</span>}
            </span>
        );
    }

    return (
        <span
            className="inline-flex items-center text-yellow-600"
            title="Opening balance not confirmed - click to view"
        >
            <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
            </svg>
            {showLabel && <span className="ml-1 text-xs">Unlocked</span>}
        </span>
    );
}

// ================================================================
// STOCK BREAKDOWN CARDS
// ================================================================
// Shows a mini card grid with quantity breakdown:
// - Total, Available, Allocated, Damaged, In Repair, Lost
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
            <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold">{total}</span>
                <span className="text-green-600">{available} avail</span>
                <span className="text-blue-600">{allocated} alloc</span>
                {damaged > 0 && <span className="text-orange-600">{damaged} dmg</span>}
                {inRepair > 0 && <span className="text-purple-600">{inRepair} repair</span>}
                {lost > 0 && <span className="text-red-600">{lost} lost</span>}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <QuantityCard label="Total" value={total} />
            <QuantityCard label="Available" value={available} color="text-green-600" />
            <QuantityCard label="Allocated" value={allocated} color="text-blue-600" />
            <QuantityCard label="Damaged" value={damaged} color="text-orange-600" />
            <QuantityCard label="In Repair" value={inRepair} color="text-purple-600" />
            <QuantityCard label="Lost" value={lost} color="text-red-600" />
        </div>
    );
}

function QuantityCard({
    label,
    value,
    color = 'text-gray-900',
}: {
    label: string;
    value: number;
    color?: string;
}) {
    return (
        <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

// ================================================================
// MOVEMENT TYPE ICON
// ================================================================
// Icons for different movement categories
// ================================================================

interface MovementTypeIconProps {
    category: string;
    className?: string;
}

export function MovementTypeIcon({ category, className = 'w-4 h-4' }: MovementTypeIconProps) {
    const iconProps = { className, strokeWidth: 2 };

    switch (category) {
        case 'inflow':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8l-8 8-8-8" />
                </svg>
            );
        case 'outflow':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m8 8l-8-8-8 8" />
                </svg>
            );
        case 'return':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
            );
        case 'writeoff':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            );
        case 'adjustment':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            );
        case 'repair':
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            );
        default:
            return (
                <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            );
    }
}

// ================================================================
// DAYS OUTSTANDING BADGE
// ================================================================
// Shows how many days an allocation has been outstanding
// ================================================================

interface DaysOutstandingBadgeProps {
    days: number;
}

export function DaysOutstandingBadge({ days }: DaysOutstandingBadgeProps) {
    let color = 'bg-gray-100 text-gray-700';

    if (days > 90) {
        color = 'bg-red-100 text-red-700';
    } else if (days > 60) {
        color = 'bg-orange-100 text-orange-700';
    } else if (days > 30) {
        color = 'bg-yellow-100 text-yellow-700';
    }

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
            {days}d
        </span>
    );
}

// ================================================================
// AUDIT LOCK WARNING
// ================================================================
// Shows a warning banner when an audit is in progress
// ================================================================

interface AuditLockWarningProps {
    outletName?: string;
    period?: string;
    onViewAudit?: () => void;
}

export function AuditLockWarning({
    outletName,
    period,
    onViewAudit,
}: AuditLockWarningProps) {
    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <svg
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
            </svg>
            <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800">
                    Audit in Progress
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                    Stock changes during an active audit may cause discrepancies.
                    {outletName && ` (${outletName}`}
                    {period && ` - ${period}`}
                    {outletName && ')'}.
                </p>
                {onViewAudit && (
                    <button
                        onClick={onViewAudit}
                        className="text-sm font-medium text-yellow-800 underline mt-2"
                    >
                        View Audit Details
                    </button>
                )}
            </div>
        </div>
    );
}
