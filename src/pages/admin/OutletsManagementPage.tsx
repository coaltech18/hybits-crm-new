import { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Plus, Pencil, Power, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getOutlets,
  getOutletDetails,
  createOutlet,
  updateOutlet,
  deactivateOutlet,
  activateOutlet,
  canDeactivateOutlet,
  type OutletSummary,
  type OutletDetails,
  type CreateOutletInput,
  type UpdateOutletInput,
} from '@/services/adminOutletService';
import { AddEditOutletModal, type OutletFormData } from '@/components/admin/AddEditOutletModal';
import { ConfirmationModal } from '@/components/admin/ConfirmationModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ================================================================
// OUTLETS MANAGEMENT PAGE (ADMIN ONLY)
// ================================================================
// Manage outlets with operational metrics.
// Outlets are never deleted (DB trigger blocks it); deactivate instead.
// ================================================================

export default function OutletsManagementPage() {
  useDocumentTitle('Outlets');

  // refreshProfile reloads AuthContext.outlets (the list every outlet picker reads).
  const { user, refreshProfile } = useAuth();
  const userId = user?.id;
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OutletDetails | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletSummary | null>(null);
  const [toggleAction, setToggleAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [deactivateWarning, setDeactivateWarning] = useState<string>('');
  const [checkingDeactivate, setCheckingDeactivate] = useState(false);
  const toggleCheckSeq = useRef(0);

  const loadOutlets = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getOutlets(userId);
      setOutlets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outlets');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Keyed on the user id, not the user object: token refreshes rebuild the
  // object and must not refetch (or unmount open modals).
  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  async function handleRefresh() {
    if (!userId || refreshing) return;
    try {
      setRefreshing(true);
      setError(null);
      const data = await getOutlets(userId);
      setOutlets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh outlets');
    } finally {
      setRefreshing(false);
    }
  }

  /** Outlet pickers elsewhere read AuthContext.outlets; reload them. */
  async function syncAuthOutlets() {
    try {
      await refreshProfile();
    } catch (err) {
      console.error('Failed to refresh outlet list after change:', err);
      showToast('Saved, but other pages may show the old outlet list until you reload.', 'warning');
    }
  }

  async function handleCreateOutlet(formData: OutletFormData) {
    if (!userId) return;

    const input: CreateOutletInput = {
      name: formData.name,
      code: formData.code,
      city: formData.city,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
    };

    // Errors propagate to the modal, which shows them inline
    await createOutlet(userId, input);
    showToast('Outlet created successfully', 'success');
    await loadOutlets();
    await syncAuthOutlets();
  }

  async function handleEditOutlet(formData: OutletFormData) {
    if (!userId || !editingOutlet) return;

    const input: UpdateOutletInput = {
      name: formData.name,
      city: formData.city,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
    };

    await updateOutlet(userId, editingOutlet.id, input);
    showToast('Outlet updated successfully', 'success');
    await loadOutlets();
    await syncAuthOutlets();
  }

  async function openEditModal(outlet: OutletSummary) {
    if (!userId || loadingEditId) return;
    try {
      setLoadingEditId(outlet.outlet_id);
      // The summary view has no phone/email; load the full row so the
      // form shows (and keeps) the stored values.
      const details = await getOutletDetails(userId, outlet.outlet_id);
      setEditingOutlet(details);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load outlet', 'error');
    } finally {
      setLoadingEditId(null);
    }
  }

  function closeToggleModal() {
    toggleCheckSeq.current++; // ignore any in-flight check
    setIsToggleModalOpen(false);
    setSelectedOutlet(null);
    setDeactivateWarning('');
    setCheckingDeactivate(false);
  }

  async function handleToggleStatus() {
    if (!userId || !selectedOutlet) return;

    // A failure is thrown to ConfirmationModal, which stays open and shows it inline.
    try {
      if (toggleAction === 'deactivate') {
        await deactivateOutlet(userId, selectedOutlet.outlet_id);
        showToast('Outlet deactivated', 'success');
      } else {
        await activateOutlet(userId, selectedOutlet.outlet_id);
        showToast('Outlet activated', 'success');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(`Failed to ${toggleAction} outlet`);
    }

    closeToggleModal();
    await loadOutlets();
    await syncAuthOutlets();
  }

  async function openToggleModal(outlet: OutletSummary, action: 'activate' | 'deactivate') {
    const seq = ++toggleCheckSeq.current;
    setSelectedOutlet(outlet);
    setToggleAction(action);
    setDeactivateWarning('');
    setIsToggleModalOpen(true);

    if (action !== 'deactivate' || !userId) {
      setCheckingDeactivate(false);
      return;
    }

    // Check if outlet can be deactivated; ignore results for a stale outlet
    setCheckingDeactivate(true);
    let warning = '';
    try {
      const validation = await canDeactivateOutlet(userId, outlet.outlet_id);
      if (!validation.canDeactivate) {
        warning = validation.reason || 'Cannot deactivate outlet';
      }
    } catch (err) {
      warning = err instanceof Error ? err.message : 'Failed to validate outlet';
    }
    if (seq !== toggleCheckSeq.current) return;
    setDeactivateWarning(warning);
    setCheckingDeactivate(false);
  }

  // user_count is per outlet, so a manager with several outlets is counted
  // once per outlet: this is a count of assignments, not of people.
  const totalAssignments = outlets.reduce((sum, o) => sum + o.user_count, 0);
  const totalClients = outlets.reduce((sum, o) => sum + o.client_count, 0);
  const totalSubscriptions = outlets.reduce((sum, o) => sum + o.active_subscription_count, 0);
  const totalAllocations = outlets.reduce((sum, o) => sum + o.allocated_inventory_count, 0);

  const toggleMessage =
    toggleAction === 'activate'
      ? `Are you sure you want to activate ${selectedOutlet?.outlet_name}?`
      : checkingDeactivate
        ? `Checking whether ${selectedOutlet?.outlet_name} can be deactivated…`
        : deactivateWarning
          ? `${deactivateWarning}\n\nPlease resolve these issues before deactivating.`
          : `Are you sure you want to deactivate ${selectedOutlet?.outlet_name}?\n\nIt will be removed from outlet lists across the app. Existing clients, invoices and reports are kept, and managers keep their assignment so the outlet can be reactivated later.`;

  const first = loading && outlets.length === 0;
  const n = (v: number) => new Intl.NumberFormat('en-IN').format(v);

  return (
    <div>
      <PageHeader
        title="Outlets"
        description="Branches, with live counts of users, clients, subscriptions and dishware out. Outlets are deactivated, never deleted."
        actions={
          <>
            <Button type="button" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add outlet
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh outlets"
              title="Refresh from database"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            </Button>
          </>
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <section className="sheet overflow-hidden" aria-labelledby="outlets-h">
        <div className="border-b border-rule px-5 py-4">
          <h2 id="outlets-h" className="text-lg font-semibold text-ink">All outlets</h2>
          {first ? (
            <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
          ) : (
            <p className="tabular text-sm text-ink-muted">
              {n(outlets.length)} outlet{outlets.length === 1 ? '' : 's'} · {n(totalAssignments)} user assignment
              {totalAssignments === 1 ? '' : 's'} · {n(totalClients)} clients · {n(totalSubscriptions)} active
              subscriptions · {n(totalAllocations)} active allocations
            </p>
          )}
        </div>

        {first ? (
          <TableSkeleton rows={5} cols={6} />
        ) : outlets.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No outlets yet"
            description="Add the first outlet. Every client, invoice and stock item belongs to one."
            action={{ label: 'Add outlet', onClick: () => setIsAddModalOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Outlet</th>
                  <th scope="col" className="text-right" title="Counted per outlet: a manager on two outlets counts in both">
                    Users
                  </th>
                  <th scope="col" className="text-right">Clients</th>
                  <th scope="col" className="text-right">Subscriptions</th>
                  <th scope="col" className="text-right">Allocations</th>
                  <th scope="col">Status</th>
                  <th scope="col" data-nolabel className="w-px text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((outlet) => (
                  <tr key={outlet.outlet_id} className={cn(!outlet.is_active && 'row-void')}>
                    <td>
                      <div className="inline-block max-w-full align-top">
                        <span className={cn('block font-semibold', outlet.is_active ? 'text-ink' : 'text-void')}>
                          {outlet.outlet_name}
                        </span>
                        <span className="block text-sm text-ink-muted">
                          <span className="serial">{outlet.outlet_code}</span>
                          {outlet.city ? ` · ${outlet.city}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="tabular text-right">{n(outlet.user_count)}</td>
                    <td className="tabular text-right">{n(outlet.client_count)}</td>
                    <td className="tabular text-right">{n(outlet.active_subscription_count)}</td>
                    <td className="tabular text-right">{n(outlet.allocated_inventory_count)}</td>
                    <td>
                      {outlet.is_active ? <Badge variant="final">Active</Badge> : <Badge variant="void">Inactive</Badge>}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(outlet)}
                          disabled={loadingEditId !== null}
                          isLoading={loadingEditId === outlet.outlet_id}
                          aria-label={`Edit ${outlet.outlet_name}`}
                        >
                          {loadingEditId !== outlet.outlet_id && <Pencil className="h-4 w-4" aria-hidden="true" />}
                          Edit
                        </Button>
                        {outlet.is_active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openToggleModal(outlet, 'deactivate')}
                            className="text-danger hover:bg-danger-tint hover:text-danger"
                            aria-label={`Deactivate ${outlet.outlet_name}`}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openToggleModal(outlet, 'activate')}
                            className="text-brand-primary hover:text-brand-primaryDark"
                            aria-label={`Activate ${outlet.outlet_name}`}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Outlet Modal */}
      <AddEditOutletModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateOutlet}
        mode="create"
      />

      {/* Edit Outlet Modal */}
      <AddEditOutletModal
        isOpen={editingOutlet !== null}
        onClose={() => setEditingOutlet(null)}
        onSubmit={handleEditOutlet}
        outlet={editingOutlet}
        mode="edit"
      />

      {/* Toggle Status Confirmation */}
      <ConfirmationModal
        isOpen={isToggleModalOpen}
        onClose={closeToggleModal}
        onConfirm={handleToggleStatus}
        title={toggleAction === 'activate' ? 'Activate outlet?' : 'Deactivate outlet?'}
        message={toggleMessage}
        confirmText={toggleAction === 'activate' ? 'Activate' : 'Deactivate'}
        variant={deactivateWarning ? 'warning' : toggleAction === 'activate' ? 'info' : 'danger'}
        confirmDisabled={toggleAction === 'deactivate' && (checkingDeactivate || !!deactivateWarning)}
      />
    </div>
  );
}
