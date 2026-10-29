import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getInventoryItems,
  getInventoryCategories,
  deactivateInventoryItem,
} from '@/services/inventoryService';
import type { InventoryItem, InventoryFilters as ItemFilters } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Package, Plus, Pencil, Ban } from 'lucide-react';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import AddEditInventoryItemModal from '@/components/inventory/AddEditInventoryItemModal';
import { LifecycleBadge } from '@/components/inventory/InventoryV2Components';
import { cn } from '@/utils/cn';
import { pcs } from './stockDisplay';

// ================================================================
// INVENTORY ITEMS PAGE
// ================================================================
// CRITICAL RULES:
// - All numbers from DB (inventory_items table)
// - NO inline editing of quantities
// - Deactivate = Discontinued (DB blocks it while units are still with clients)
// - Overview deep links: ?lifecycle_status=discontinued, ?has_damaged=true,
//   ?in_repair=true, ?opening_unlocked=true
// - Role-based actions (Admin/Manager can edit, Accountant read-only)
// ================================================================

export default function InventoryItemsPage() {
  useDocumentTitle('Dishware items');
  const { user, outlets, isAuthReady } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasDamaged = searchParams.get('has_damaged') === 'true';
  const inRepair = searchParams.get('in_repair') === 'true';
  const openingUnlocked = searchParams.get('opening_unlocked') === 'true';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from `error`, which every items reload clears
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Filters
  const [outletId, setOutletId] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(
    searchParams.get('lifecycle_status') === 'discontinued' ? 'false' : 'true'
  );

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

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: ItemFilters = {};
      if (outletId) filters.outlet_id = outletId;
      if (category) filters.category = category;
      filters.is_active = isActive === '' ? 'all' : isActive === 'true';
      if (hasDamaged) filters.has_damaged = true;
      if (inRepair) filters.in_repair = true;
      if (openingUnlocked) filters.opening_unlocked = true;

      const data = await getInventoryItems(user.id, filters);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [user?.id, outletId, category, isActive, hasDamaged, inRepair, openingUnlocked]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getInventoryCategories());
      setCategoriesError(null);
    } catch (err) {
      setCategoriesError(
        err instanceof Error ? `Failed to load categories: ${err.message}` : 'Failed to load categories'
      );
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    loadData();
  }, [isAuthReady, loadData]);

  useEffect(() => {
    if (!isAuthReady) return;
    loadCategories();
  }, [isAuthReady, loadCategories]);

  const quickFilterLabel = hasDamaged
    ? 'items with damaged stock'
    : inRepair
      ? 'items in repair'
      : openingUnlocked
        ? 'items with an unlocked opening balance'
        : null;

  async function handleDeactivate(item: InventoryItem) {
    if (!user?.id || deleteLoading) return;

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

  function cancelDeactivate() {
    setConfirmDelete(null);
    setDeleteError(null);
  }

  const firstLoad = loading && items.length === 0;
  const filtered = Boolean(outletId || category || isActive !== 'true' || quickFilterLabel);
  const sum = (key: 'total_quantity' | 'available_quantity' | 'allocated_quantity' | 'damaged_quantity') =>
    items.reduce((s, item) => s + (item[key] || 0), 0);

  return (
    <div>
      <PageHeader
        title="Dishware items"
        description="Each item’s stock by bucket. Open an item to add stock, send it out or write it off."
        actions={
          !isAccountant && (
            <Button type="button" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          )
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {categoriesError && <Alert variant="warning" className="mb-6">{categoriesError}</Alert>}

      {quickFilterLabel && (
        <Alert variant="info" className="mb-6">
          Showing only {quickFilterLabel}.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setSearchParams({})}>
            Show all items
          </button>
        </Alert>
      )}

      {/* Filters */}
      <Card padding="sm" className="mb-6">
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

      {/* Items ledger */}
      <section className="sheet overflow-hidden" aria-labelledby="items-h" aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-4">
          <h2 id="items-h" className="text-lg font-semibold text-ink">Items</h2>
          {!firstLoad && items.length > 0 && (
            <p className="tabular text-sm text-ink-muted">
              {pcs(items.length)} item{items.length === 1 ? '' : 's'} · {pcs(sum('total_quantity'))} pieces ·{' '}
              {pcs(sum('available_quantity'))} available · {pcs(sum('allocated_quantity'))} out
              {sum('damaged_quantity') > 0 && <> · {pcs(sum('damaged_quantity'))} damaged</>}
            </p>
          )}
        </div>

        {firstLoad ? (
          <TableSkeleton rows={6} cols={6} />
        ) : items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={Package}
              title="No items match these filters"
              description="Try another category or status, or clear the filters to see every item."
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No dishware items yet"
              description={
                isAccountant
                  ? 'Items appear here once a manager or admin adds them.'
                  : 'Add your first dishware item, then add its opening stock from the item’s page.'
              }
              action={!isAccountant ? { label: 'Add item', onClick: () => setShowAddModal(true) } : undefined}
            />
          )
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="text-right">Available</th>
                  <th scope="col" className="text-right">Out</th>
                  <th scope="col" className="text-right">Damaged</th>
                  <th scope="col" className="text-right">Lost</th>
                  <th scope="col" className="text-right">Total</th>
                  <th scope="col">Status</th>
                  {!isAccountant && (
                    <th scope="col" data-nolabel className="w-px">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={cn(!item.is_active && 'row-void')}>
                    <td className="min-w-[12rem] max-w-[22rem]">
                      <div className="inline-block max-w-full align-top">
                        <Link
                          to={`/inventory/items/${item.id}`}
                          className="font-semibold text-ink hover:text-brand-primary"
                        >
                          {item.name}
                        </Link>
                        <div className="text-xs text-ink-muted">
                          {[item.category, item.material, item.unit].filter(Boolean).join(' · ')}
                        </div>
                        {showOutletFilter && (
                          <div className="truncate text-xs text-ink-muted">{item.outlet_name || '—'}</div>
                        )}
                      </div>
                    </td>
                    <td className="amount cell-emph text-right font-semibold text-ink">{pcs(item.available_quantity)}</td>
                    <td className={cn('amount text-right', item.allocated_quantity > 0 ? 'font-semibold text-partial' : 'text-ink-faint')}>
                      {pcs(item.allocated_quantity)}
                    </td>
                    <td className={cn('amount text-right', item.damaged_quantity > 0 ? 'font-semibold text-overdue' : 'text-ink-faint')}>
                      {pcs(item.damaged_quantity)}
                    </td>
                    <td className={cn('amount text-right', item.lost_quantity > 0 ? 'text-void' : 'text-ink-faint')}>
                      {pcs(item.lost_quantity)}
                    </td>
                    <td className="amount text-right text-ink-muted">{pcs(item.total_quantity)}</td>
                    <td>
                      <LifecycleBadge status={item.lifecycle_status ?? ''} />
                    </td>
                    {!isAccountant && (
                      <td className="whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditItem(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          {/* Not offered for drafts: the DB keeps a draft's lifecycle unchanged,
                              so it would silently stay active. */}
                          {item.is_active && item.lifecycle_status !== 'draft' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDelete(item)}
                              aria-label={`Deactivate ${item.name}`}
                              title="Deactivate"
                              className="hover:bg-danger-tint hover:text-danger"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
          defaultOutletId={isManager && availableOutlets.length === 1 ? availableOutlets[0].id : undefined}
          editItem={editItem}
        />
      )}

      {/* Deactivate confirmation */}
      {confirmDelete && (
        <Modal
          isOpen={!!confirmDelete}
          onClose={cancelDeactivate}
          dismissable={!deleteLoading}
          title="Deactivate item"
          maxWidth="md"
        >
          {deleteError && <Alert variant="error" className="mb-4">{deleteError}</Alert>}

          <p className="text-sm text-ink">
            Deactivate <strong className="font-semibold">{confirmDelete.name}</strong>?
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            The item becomes discontinued: it can no longer be sent out or restocked, but returns and
            write-offs still work. This is blocked while any pieces are still with clients.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cancelDeactivate} disabled={deleteLoading} data-autofocus>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => handleDeactivate(confirmDelete)}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deactivating…' : 'Deactivate item'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
