import { Card } from '@/components/ui/Card';
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
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <p className="text-sm text-muted-foreground">Total Items</p>
        <p className="text-2xl font-bold">{totalItems}</p>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Total Quantity</p>
        <p className="text-2xl font-bold">{totalQuantity}</p>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Available</p>
        <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Allocated</p>
        <p className="text-2xl font-bold text-brand-primary">{totalAllocated}</p>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Damaged</p>
        <p className="text-2xl font-bold text-orange-600">{totalDamaged}</p>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Lost</p>
        <p className="text-2xl font-bold text-red-600">{totalLost}</p>
      </Card>
    </div>
  );
}
