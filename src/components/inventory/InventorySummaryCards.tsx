import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types';

// ================================================================
// INVENTORY SUMMARY CARDS
// ================================================================
// Displays aggregate inventory metrics
// ALL VALUES from DB (passed from parent)
// NO calculations in component
// ================================================================

interface InventorySummaryCardsProps {
  items: InventoryItem[];
}

export default function InventorySummaryCards({ items }: InventorySummaryCardsProps) {
  // CRITICAL: All values come from DB via items prop
  // Component does NOT calculate - only sums what DB provides
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.total_quantity, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.available_quantity, 0);
  const totalAllocated = items.reduce((sum, item) => sum + item.allocated_quantity, 0);
  const totalDamaged = items.reduce((sum, item) => sum + item.damaged_quantity, 0);
  const totalLost = items.reduce((sum, item) => sum + item.lost_quantity, 0);

  return (
    <section
      aria-label="Stock totals"
      className="sheet grid grid-cols-2 gap-px overflow-hidden bg-rule sm:grid-cols-3 lg:grid-cols-6"
    >
      <Figure label="Items" value={totalItems} />
      <Figure label="Total pieces" value={totalQuantity} />
      <Figure label="Available" value={totalAvailable} tone="text-final" />
      <Figure label="Allocated" value={totalAllocated} tone="text-info" />
      <Figure label="Damaged" value={totalDamaged} tone="text-partial" />
      <Figure label="Lost" value={totalLost} tone="text-overdue" />
    </section>
  );
}

function Figure({ label, value, tone = 'text-ink' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cn('tabular mt-1 text-2xl font-bold tracking-tight', value === 0 ? 'text-ink-faint' : tone)}>
        {new Intl.NumberFormat('en-IN').format(value)}
      </div>
    </div>
  );
}
