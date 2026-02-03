import { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Power, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOutlets,
  createOutlet,
  updateOutlet,
  deactivateOutlet,
  activateOutlet,
  canDeactivateOutlet,
  deleteOutlet,
  canDeleteOutlet,
  type OutletSummary,
  type CreateOutletInput,
  type UpdateOutletInput,
} from '@/services/adminOutletService';
import { AddEditOutletModal, type OutletFormData } from '@/components/admin/AddEditOutletModal';
import { ConfirmationModal } from '@/components/admin/ConfirmationModal';

// ================================================================
// OUTLETS MANAGEMENT PAGE (ADMIN ONLY)
// ================================================================
// Manage outlets with operational metrics
// ================================================================

export default function OutletsManagementPage() {
  const { user } = useAuth();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletSummary | null>(null);
  const [toggleAction, setToggleAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [deactivateWarning, setDeactivateWarning] = useState<string>('');
  const [deleteWarning, setDeleteWarning] = useState<string>('');

  useEffect(() => {
    loadOutlets();
  }, [user]);

  async function loadOutlets() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getOutlets(user.id);
      setOutlets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outlets');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!user?.id) return;
    try {
      setRefreshing(true);
      setError(null);
      const data = await getOutlets(user.id);
      setOutlets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh outlets');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateOutlet(formData: OutletFormData) {
    if (!user?.id) return;

    const input: CreateOutletInput = {
      name: formData.name,
      code: formData.code,
      city: formData.city,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
    };

    await createOutlet(user.id, input);
    await loadOutlets();
  }

  async function handleEditOutlet(formData: OutletFormData) {
    if (!user?.id || !selectedOutlet) return;

    const input: UpdateOutletInput = {
      name: formData.name,
      city: formData.city,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
    };

    await updateOutlet(user.id, selectedOutlet.outlet_id, input);
    await loadOutlets();
  }

  async function handleToggleStatus() {
    if (!user?.id || !selectedOutlet) return;

    if (toggleAction === 'deactivate') {
      await deactivateOutlet(user.id, selectedOutlet.outlet_id);
    } else {
      await activateOutlet(user.id, selectedOutlet.outlet_id);
    }

    await loadOutlets();
    setIsToggleModalOpen(false);
    setSelectedOutlet(null);
    setDeactivateWarning('');
  }

  async function handleDeleteOutlet() {
    if (!user?.id || !selectedOutlet) return;

    try {
      await deleteOutlet(user.id, selectedOutlet.outlet_id);
      await loadOutlets();
      setIsDeleteModalOpen(false);
      setSelectedOutlet(null);
      setDeleteWarning('');
    } catch (err) {
      setDeleteWarning(err instanceof Error ? err.message : 'Failed to delete outlet');
    }
  }

  async function openToggleModal(outlet: OutletSummary, action: 'activate' | 'deactivate') {
    setSelectedOutlet(outlet);
    setToggleAction(action);

    // Check if outlet can be deactivated
    if (action === 'deactivate' && user?.id) {
      try {
        const validation = await canDeactivateOutlet(user.id, outlet.outlet_id);
        if (!validation.canDeactivate) {
          setDeactivateWarning(validation.reason || 'Cannot deactivate outlet');
        } else {
          setDeactivateWarning('');
        }
      } catch (err) {
        setDeactivateWarning(
          err instanceof Error ? err.message : 'Failed to validate outlet'
        );
      }
    }

    setIsToggleModalOpen(true);
  }

  async function openDeleteModal(outlet: OutletSummary) {
    setSelectedOutlet(outlet);
    setDeleteWarning('');

    // Check if outlet can be deleted
    if (user?.id) {
      try {
        const validation = await canDeleteOutlet(user.id, outlet.outlet_id);
        if (!validation.canDelete) {
          setDeleteWarning(validation.reason || 'Cannot delete outlet');
        }
      } catch (err) {
        setDeleteWarning(err instanceof Error ? err.message : 'Failed to validate');
      }
    }

    setIsDeleteModalOpen(true);
  }

  const totalUsers = outlets.reduce((sum, o) => sum + o.user_count, 0);
  const totalClients = outlets.reduce((sum, o) => sum + o.client_count, 0);
  const totalSubscriptions = outlets.reduce((sum, o) => sum + o.active_subscription_count, 0);
  const totalInventory = outlets.reduce((sum, o) => sum + o.allocated_inventory_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-text/70">Loading outlets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Outlet Management
          </h1>
          <p className="text-brand-text/70 mt-1">
            Manage outlets and operational metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-text rounded-md hover:bg-brand-bg disabled:opacity-50"
            title="Refresh from database"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark"
          >
            <Plus className="w-5 h-5" />
            Add Outlet
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Total Outlets</p>
          <p className="text-2xl font-bold">{outlets.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Total Users</p>
          <p className="text-2xl font-bold text-brand-primary">{totalUsers}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Total Clients</p>
          <p className="text-2xl font-bold text-brand-text">{totalClients}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Active Subscriptions</p>
          <p className="text-2xl font-bold text-brand-primary">{totalSubscriptions}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Allocated Inventory</p>
          <p className="text-2xl font-bold text-brand-text">{totalInventory}</p>
        </div>
      </div>

      {/* Outlets Table */}
      <div className="bg-white rounded-lg border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-bg border-b border-brand-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Outlet</th>
                <th className="text-left py-3 px-4 font-medium">Code</th>
                <th className="text-left py-3 px-4 font-medium">City</th>
                <th className="text-center py-3 px-4 font-medium">Users</th>
                <th className="text-center py-3 px-4 font-medium">Clients</th>
                <th className="text-center py-3 px-4 font-medium">Subscriptions</th>
                <th className="text-center py-3 px-4 font-medium">Inventory</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {outlets.map((outlet) => (
                <tr key={outlet.outlet_id} className="hover:bg-brand-primary/5">
                  <td className="py-3 px-4 font-medium">{outlet.outlet_name}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm bg-brand-bg px-2 py-1 rounded text-brand-text">
                      {outlet.outlet_code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-brand-text/70">
                    {outlet.city}
                  </td>
                  <td className="py-3 px-4 text-center text-sm">{outlet.user_count}</td>
                  <td className="py-3 px-4 text-center text-sm">{outlet.client_count}</td>
                  <td className="py-3 px-4 text-center text-sm">
                    {outlet.active_subscription_count}
                  </td>
                  <td className="py-3 px-4 text-center text-sm">
                    {outlet.allocated_inventory_count}
                  </td>
                  <td className="py-3 px-4">
                    {outlet.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary/20 text-brand-primary">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedOutlet(outlet);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded"
                        title="Edit Outlet"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {outlet.is_active ? (
                        <button
                          onClick={() => openToggleModal(outlet, 'deactivate')}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Deactivate Outlet"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openToggleModal(outlet, 'activate')}
                          className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded"
                          title="Activate Outlet"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(outlet)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete Outlet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Outlet Modal */}
      <AddEditOutletModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateOutlet}
        mode="create"
      />

      {/* Edit Outlet Modal */}
      <AddEditOutletModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedOutlet(null);
        }}
        onSubmit={handleEditOutlet}
        outlet={selectedOutlet}
        mode="edit"
      />

      {/* Toggle Status Confirmation */}
      <ConfirmationModal
        isOpen={isToggleModalOpen}
        onClose={() => {
          setIsToggleModalOpen(false);
          setSelectedOutlet(null);
          setDeactivateWarning('');
        }}
        onConfirm={handleToggleStatus}
        title={toggleAction === 'activate' ? 'Activate Outlet' : 'Deactivate Outlet'}
        message={
          toggleAction === 'activate'
            ? `Are you sure you want to activate ${selectedOutlet?.outlet_name}?`
            : deactivateWarning
              ? `${deactivateWarning}\n\nPlease resolve these issues before deactivating.`
              : `Are you sure you want to deactivate ${selectedOutlet?.outlet_name}?\n\nThis outlet will no longer be accessible.`
        }
        confirmText={toggleAction === 'activate' ? 'Activate' : 'Deactivate'}
        variant={deactivateWarning ? 'warning' : toggleAction === 'activate' ? 'info' : 'danger'}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedOutlet(null);
          setDeleteWarning('');
        }}
        onConfirm={handleDeleteOutlet}
        title="Delete Outlet Permanently"
        message={
          deleteWarning
            ? `${deleteWarning}\n\nPlease remove all linked data before deleting.`
            : `Are you sure you want to permanently delete ${selectedOutlet?.outlet_name}?\n\nThis action cannot be undone.`
        }
        confirmText="Delete"
        variant={deleteWarning ? 'warning' : 'danger'}
      />
    </div>
  );
}
