import { useState, useEffect } from 'react';
import { Users, Plus, Power, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsers,
  createUser,
  toggleUserActive,
  assignUserOutlets,
  type UserSummary,
  type CreateUserInput,
} from '@/services/adminUserService';
import { AddEditUserModal, type UserFormData } from '@/components/admin/AddEditUserModal';
import { ConfirmationModal } from '@/components/admin/ConfirmationModal';

// ================================================================
// USERS MANAGEMENT PAGE (ADMIN ONLY)
// ================================================================
// Manage all users, roles, and outlet assignments
// ================================================================

export default function UsersManagementPage() {
  const { user, outlets } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [toggleAction, setToggleAction] = useState<'activate' | 'deactivate'>('deactivate');

  useEffect(() => {
    loadUsers();
  }, [user]);

  async function loadUsers() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getUsers(user.id);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(formData: UserFormData) {
    if (!user?.id) return;

    const input: CreateUserInput = {
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
      outlet_ids: formData.outlet_ids,
    };

    await createUser(user.id, input);
    await loadUsers();
  }

  async function handleToggleStatus() {
    if (!user?.id || !selectedUser) return;

    const newStatus = toggleAction === 'activate';
    await toggleUserActive(user.id, selectedUser.user_id, newStatus);
    await loadUsers();
    setIsToggleModalOpen(false);
    setSelectedUser(null);
  }

  async function handleAssignOutlets(outletIds: string[]) {
    if (!user?.id || !selectedUser) return;

    await assignUserOutlets(user.id, selectedUser.user_id, outletIds);
    await loadUsers();
    setIsAssignModalOpen(false);
    setSelectedUser(null);
  }

  function openToggleModal(targetUser: UserSummary, action: 'activate' | 'deactivate') {
    setSelectedUser(targetUser);
    setToggleAction(action);
    setIsToggleModalOpen(true);
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-brand-deep/20 text-brand-deep';
      case 'manager':
        return 'bg-brand-primary/20 text-brand-primary';
      case 'accountant':
        return 'bg-brand-primary/20 text-brand-primary';
      default:
        return 'bg-brand-border/50 text-brand-text';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-text/70">Loading users...</p>
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
            <Users className="w-8 h-8" />
            User Management
          </h1>
          <p className="text-brand-text/70 mt-1">
            Manage users, roles, and outlet assignments
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Total Users</p>
          <p className="text-2xl font-bold text-brand-text">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Active Users</p>
          <p className="text-2xl font-bold text-brand-primary">
            {users.filter((u) => u.is_active).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Admins</p>
          <p className="text-2xl font-bold text-brand-text">
            {users.filter((u) => u.role === 'admin' && u.is_active).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-brand-border">
          <p className="text-sm text-brand-text/70">Managers</p>
          <p className="text-2xl font-bold text-brand-primary">
            {users.filter((u) => u.role === 'manager' && u.is_active).length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-bg border-b border-brand-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Name</th>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Email</th>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Role</th>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Outlets</th>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Status</th>
                <th className="text-left py-3 px-4 font-medium text-brand-text">Last Login</th>
                <th className="text-right py-3 px-4 font-medium text-brand-text">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-brand-primary/5">
                  <td className="py-3 px-4 font-medium">{u.full_name}</td>
                  <td className="py-3 px-4 text-sm text-brand-text/80">
                    {u.email}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        u.role
                      )}`}
                    >
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {u.role === 'manager' ? (
                      u.assigned_outlets.length > 0 ? (
                        <span className="text-brand-text/80">
                          {u.assigned_outlets.length} outlet(s)
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">No outlets</span>
                      )
                    ) : (
                      <span className="text-brand-text/60">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary/20 text-brand-primary">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-brand-text/80">
                    {u.last_login
                      ? new Date(u.last_login).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'manager' && (
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setIsAssignModalOpen(true);
                          }}
                          className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded"
                          title="Assign Outlets"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      )}
                      {u.is_active ? (
                        <button
                          onClick={() => openToggleModal(u, 'deactivate')}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Deactivate User"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openToggleModal(u, 'activate')}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Activate User"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AddEditUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateUser}
        outlets={outlets || []}
        mode="create"
      />

      {/* Toggle Status Confirmation */}
      <ConfirmationModal
        isOpen={isToggleModalOpen}
        onClose={() => {
          setIsToggleModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleToggleStatus}
        title={toggleAction === 'activate' ? 'Activate User' : 'Deactivate User'}
        message={
          toggleAction === 'activate'
            ? `Are you sure you want to activate ${selectedUser?.full_name}?`
            : `Are you sure you want to deactivate ${selectedUser?.full_name}?\n\nThis user will lose access to the system.`
        }
        confirmText={toggleAction === 'activate' ? 'Activate' : 'Deactivate'}
        variant={toggleAction === 'activate' ? 'info' : 'danger'}
      />

      {/* Assign Outlets Modal */}
      {isAssignModalOpen && selectedUser && (
        <AssignOutletsModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedUser(null);
          }}
          onSubmit={handleAssignOutlets}
          user={selectedUser}
          outlets={outlets || []}
        />
      )}
    </div>
  );
}

// ================================================================
// ASSIGN OUTLETS MODAL (INLINE)
// ================================================================

interface AssignOutletsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (outletIds: string[]) => Promise<void>;
  user: UserSummary;
  outlets: any[];
}

function AssignOutletsModal({
  isOpen,
  onClose,
  onSubmit,
  user,
  outlets,
}: AssignOutletsModalProps) {
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize with current outlet assignments
      // Note: user.assigned_outlets is string[] of outlet names, need to map to IDs
      setSelectedOutlets([]);
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedOutlets.length === 0) {
      alert('Please select at least one outlet for this manager');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(selectedOutlets);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">Assign Outlets</h2>
          <button onClick={onClose} className="text-brand-text/60 hover:text-brand-text">
            <Users className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-brand-text/70 mb-4">
            Assign outlets to <strong>{user.full_name}</strong>
          </p>

          <div className="border border-brand-border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
            {outlets
              .filter((o) => o.is_active)
              .map((outlet) => (
                <label key={outlet.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOutlets.includes(outlet.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOutlets([...selectedOutlets, outlet.id]);
                      } else {
                        setSelectedOutlets(selectedOutlets.filter((id) => id !== outlet.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {outlet.name} ({outlet.code})
                  </span>
                </label>
              ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-brand-border rounded-md hover:bg-brand-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
