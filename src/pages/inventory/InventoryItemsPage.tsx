import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInventoryItems,
  getInventoryCategories,
  deactivateInventoryItem,
} from '@/services/inventoryService';
import type { InventoryItem } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Package, Plus, Edit, Trash2, History } from 'lucide-react';
import InventorySummaryCards from '@/components/inventory/InventorySummaryCards';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import AddEditInventoryItemModal from '@/components/inventory/AddEditInventoryItemModal';

// ================================================================
// INVENTORY ITEMS PAGE
// ================================================================
// CRITICAL RULES:
// - All numbers from DB (inventory_items table)
// - NO inline editing of quantities
// - Deactivate calls service (DB trigger prevents if movements exist)
// - Role-based actions (Admin/Manager can edit, Accountant read-only)
// ================================================================

export default function InventoryItemsPage() {
  const { user, outlets, isAuthReady } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [outletId, setOutletId] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('true');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const userRole = user?.role || '';
  const isAccountant = userRole === 'accountant';
  const isManager = userRole === 'manager';
  const showOutletFilter = userRole === 'admin' || userRole === 'accountant';
  const availableOutlets = outlets || [];

  useEffect(() => {
    if (!isAuthReady) return;
    loadData();
  }, [isAuthReady, outletId, category, isActive]);

  useEffect(() => {
    if (!isAuthReady) return;
    loadCategories();
  }, [isAuthReady]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (outletId) filters.outlet_id = outletId;
      if (category) filters.category = category;
      if (isActive !== '') filters.is_active = isActive === 'true';

      const data = await getInventoryItems(user.id, filters);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    if (!user?.id) return;

    try {
      const cats = await getInventoryCategories(user.id);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function handleDeactivate(item: InventoryItem) {
    if (!user?.id) return;

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      // Call service - DB trigger will prevent if movements exist
      await deactivateInventoryItem(user.id, item.id);

      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      // Surface DB error directly (e.g., "Cannot deactivate item with movement history")
      setDeleteError(err instanceof Error ? err.message : 'Failed to deactivate item');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-8 h-8" />
            Inventory Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Dishware inventory tracking and allocation
          </p>
        </div>

        {!isAccountant && (
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Summary Cards */}
      <InventorySummaryCards items={items} />

      {/* Filters */}
      <Card>
        <h3 className="font-semibold mb-4">Filters</h3>
        <InventoryFilters
          userRole={userRole}
          showOutletFilter={showOutletFilter}
          outlets={availableOutlets}
          outletId={outletId}
          category={category}
          isActive={isActive}
          categories={categories}
          onOutletChange={setOutletId}
          onCategoryChange={setCategory}
          onIsActiveChange={setIsActive}
        />
      </Card>

      {/* Items Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Inventory Items</h3>
          <p className="text-sm text-muted-foreground">{items.length} items</p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No inventory items found</p>
            {!isAccountant && (
              <Button onClick={() => setShowAddModal(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add First Item
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Item Name</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Material</th>
                  {showOutletFilter && <th className="text-left py-3 px-4">Outlet</th>}
                  <th className="text-right py-3 px-4">Total</th>
                  <th className="text-right py-3 px-4">Available</th>
                  <th className="text-right py-3 px-4">Allocated</th>
                  <th className="text-right py-3 px-4">Damaged</th>
                  <th className="text-right py-3 px-4">Lost</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Unit: {item.unit}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="default">{item.category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">{item.material || '-'}</td>
                    {showOutletFilter && (
                      <td className="py-3 px-4 text-sm">{item.outlet_name || '-'}</td>
                    )}
                    <td className="text-right py-3 px-4 font-semibold">{item.total_quantity}</td>
                    <td className="text-right py-3 px-4 text-green-600 font-semibold">
                      {item.available_quantity}
                    </td>
                    <td className="text-right py-3 px-4 text-brand-primary">{item.allocated_quantity}</td>
                    <td className="text-right py-3 px-4 text-orange-600">{item.damaged_quantity}</td>
                    <td className="text-right py-3 px-4 text-red-600">{item.lost_quantity}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Movements (all roles) */}
                        <Link to={`/inventory/movements?item=${item.id}`}>
                          <Button variant="ghost" size="sm" title="View Movement History">
                            <History className="w-4 h-4" />
                          </Button>
                        </Link>

                        {/* Edit (admin/manager only) */}
                        {!isAccountant && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditItem(item)}
                            title="Edit Item"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Deactivate (admin/manager only) */}
                        {!isAccountant && item.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(item)}
                            title="Deactivate Item"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}

                        {!item.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {(showAddModal || editItem) && (
        <AddEditInventoryItemModal
          isOpen={showAddModal || !!editItem}
          onClose={() => {
            setShowAddModal(false);
            setEditItem(null);
          }}
          onSuccess={() => {
            loadData();
            loadCategories();
          }}
          userId={user?.id || ''}
          userRole={userRole}
          outlets={availableOutlets}
          defaultOutletId={isManager && availableOutlets.length > 0 ? availableOutlets[0].id : undefined}
          editItem={editItem}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Deactivate Inventory Item</h3>

            {deleteError && <Alert variant="error" className="mb-4">{deleteError}</Alert>}

            <p className="text-muted-foreground mb-4">
              Are you sure you want to deactivate <strong>{confirmDelete.name}</strong>?
            </p>

            <p className="text-sm text-muted-foreground mb-4">
              Note: Items with movement history cannot be deactivated. If this item has been used
              in allocations, the system will prevent deactivation.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDelete(null);
                  setDeleteError(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeactivate(confirmDelete)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deactivating...' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
