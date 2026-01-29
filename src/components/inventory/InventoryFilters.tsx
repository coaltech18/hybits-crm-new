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
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {showOutletFilter && (
        <Select
          label="Outlet"
          value={outletId}
          onChange={(e) => onOutletChange(e.target.value)}
        >
          <option value="">All Outlets</option>
          {outlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))}
        </Select>
      )}

      <Select
        label="Category"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </Select>

      <Select
        label="Status"
        value={isActive}
        onChange={(e) => onIsActiveChange(e.target.value)}
      >
        <option value="true">Active</option>
        <option value="false">Inactive</option>
        <option value="">All</option>
      </Select>

      {(outletId || category || isActive !== 'true') && (
        <div className="flex items-end">
          <button
            onClick={() => {
              onOutletChange('');
              onCategoryChange('');
              onIsActiveChange('true');
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
