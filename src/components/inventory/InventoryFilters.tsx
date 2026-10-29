import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Outlet } from '@/types';

// ================================================================
// INVENTORY FILTERS
// ================================================================
// Role-aware filter component
// Outlet filter: Admin/Accountant only
// Category filter: All roles
// ================================================================

interface InventoryFiltersProps {
  // Role info
  userRole: string;
  showOutletFilter: boolean;

  // Outlets (for admin/accountant)
  outlets: Outlet[];

  // Filter values
  outletId: string;
  category: string;
  isActive: string;
  categories: string[];

  // Change handlers
  onOutletChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onIsActiveChange: (value: string) => void;
}

export default function InventoryFilters({
  showOutletFilter,
  outlets,
  outletId,
  category,
  isActive,
  categories,
  onOutletChange,
  onCategoryChange,
  onIsActiveChange,
}: InventoryFiltersProps) {
  const filtered = !!(outletId || category || isActive !== 'true');

  return (
    <div className="flex flex-wrap items-end gap-3">
      {showOutletFilter && (
        <div className="w-full sm:w-56">
          <Select label="Outlet" value={outletId} onChange={(e) => onOutletChange(e.target.value)}>
            <option value="">All outlets</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="w-full sm:w-52">
        <Select label="Category" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:w-40">
        <Select label="Status" value={isActive} onChange={(e) => onIsActiveChange(e.target.value)}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </Select>
      </div>

      {filtered && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onOutletChange('');
            onCategoryChange('');
            onIsActiveChange('true');
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
