import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Power, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import {
  getUsers,
  getAllOutletAssignments,
  getUserOutletIds,
  createUser,
  toggleUserActive,
  assignUserOutlets,
  type UserSummary,
  type CreateUserInput,
} from '@/services/adminUserService';
import { AddEditUserModal, type UserFormData } from '@/components/admin/AddEditUserModal';
import { ConfirmationModal } from '@/components/admin/ConfirmationModal';
import type { Outlet } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

// ================================================================
// USERS MANAGEMENT PAGE (ADMIN ONLY)
// ================================================================
// Manage all users, roles, and outlet assignments
// ================================================================

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', accountant: 'Accountant' };
const ROLE_VARIANT: Record<string, BadgeVariant> = { admin: 'paid', manager: 'final', accountant: 'info' };

export default function UsersManagementPage() {
  useDocumentTitle('Users');

  const { user } = useAuth();
  const userId = user?.id;
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [assignmentsByUser, setAssignmentsByUser] = useState<Record<string, string[]>>({});
  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [toggleAction, setToggleAction] = useState<'activate' | 'deactivate'>('deactivate');

  const loadUsers = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const [data, assignments] = await Promise.all([
        getUsers(userId),
        getAllOutletAssignments(userId),
      ]);
      setUsers(data);
      setAssignmentsByUser(assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadOutlets = useCallback(async () => {
    const { data, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .order('name');

    if (outletsError) {
      showToast(`Failed to load outlets: ${outletsError.message}`, 'error');
      return;
    }

    setAllOutlets(data || []);
  }, [showToast]);

  // Keyed on the user id, not the user object, so token refreshes don't
  // refetch and unmount open modals.
  useEffect(() => {
    if (!userId) return;
    loadUsers();
    loadOutlets();
  }, [userId, loadUsers, loadOutlets]);

  async function handleCreateUser(formData: UserFormData) {
    if (!userId) return;

    const input: CreateUserInput = {
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
      outlet_ids: formData.outlet_ids,
    };

    await createUser(userId, input);
    await loadUsers();
  }

  async function handleToggleStatus() {
    if (!userId || !selectedUser) return;

    const newStatus = toggleAction === 'activate';
    // A failure is thrown to ConfirmationModal, which stays open and shows it inline.
    try {
      await toggleUserActive(userId, selectedUser.user_id, newStatus);
    } catch (err) {
      throw err instanceof Error ? err : new Error(`Failed to ${toggleAction} user`);
    }

    showToast(
      `${selectedUser.full_name} ${newStatus ? 'activated' : 'deactivated'}`,
      'success'
    );
    setIsToggleModalOpen(false);
    setSelectedUser(null);
    await loadUsers();
  }

  // Errors propagate to AssignOutletsModal, which shows them inline
  async function handleAssignOutlets(outletIds: string[]) {
    if (!userId || !selectedUser) return;

    await assignUserOutlets(userId, selectedUser.user_id, outletIds);
    showToast(`Outlets updated for ${selectedUser.full_name}`, 'success');
    setIsAssignModalOpen(false);
    setSelectedUser(null);
    await loadUsers();
  }

  function openToggleModal(targetUser: UserSummary, action: 'activate' | 'deactivate') {
    setSelectedUser(targetUser);
    setToggleAction(action);
    setIsToggleModalOpen(true);
  }

  const outletActive = (outletId: string) =>
    allOutlets.find((o) => o.id === outletId)?.is_active ?? true;

  const outletName = (outletId: string) => allOutlets.find((o) => o.id === outletId);

  const first = loading && users.length === 0;
  const n = (v: number) => new Intl.NumberFormat('en-IN').format(v);
  const activeCount = users.filter((u) => u.is_active).length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.is_active).length;
  const managerCount = users.filter((u) => u.role === 'manager' && u.is_active).length;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone who can sign in, their role, and which outlets each manager can see."
        actions={
          <Button type="button" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add user
          </Button>
        }
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <section className="sheet overflow-hidden" aria-labelledby="users-h">
        <div className="border-b border-rule px-5 py-4">
          <h2 id="users-h" className="text-lg font-semibold text-ink">All users</h2>
          {first ? (
            <Skeleton className="mt-1.5 h-4 w-64 max-w-full" />
          ) : (
            <p className="tabular text-sm text-ink-muted">
              {n(users.length)} user{users.length === 1 ? '' : 's'} · {n(activeCount)} active · {n(adminCount)} admin
              {adminCount === 1 ? '' : 's'} · {n(managerCount)} manager{managerCount === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {first ? (
          <TableSkeleton rows={6} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Users are added in Supabase. Add user shows the steps."
            action={{ label: 'Add user', onClick: () => setIsAddModalOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Outlets</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last login</th>
                  <th scope="col" data-nolabel className="w-px text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const assigned = assignmentsByUser[u.user_id] ?? [];
                  const inactiveCount = assigned.filter((id) => !outletActive(id)).length;
                  const isSelf = u.user_id === userId;
                  const names = assigned.map((id) => outletName(id)?.name).filter(Boolean) as string[];

                  return (
                    <tr key={u.user_id} className={cn(!u.is_active && 'row-void')}>
                      <td className="min-w-[14rem]">
                        <div className="inline-block max-w-full align-top">
                          <div className={cn('font-semibold', u.is_active ? 'text-ink' : 'text-void')}>
                            {u.full_name}
                            {isSelf && <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>}
                          </div>
                          <div className="break-all text-sm text-ink-muted">{u.email}</div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={ROLE_VARIANT[u.role] ?? 'default'}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                      </td>
                      <td className="min-w-[10rem]">
                        {u.role === 'manager' ? (
                          assigned.length > 0 ? (
                            <span className="text-ink">
                              {names.length === assigned.length && names.length <= 2
                                ? names.join(', ')
                                : `${n(assigned.length)} outlet${assigned.length === 1 ? '' : 's'}`}
                              {inactiveCount > 0 && (
                                <span className="text-ink-muted"> ({inactiveCount} inactive)</span>
                              )}
                            </span>
                          ) : (
                            <span className="font-semibold text-danger">No outlets</span>
                          )
                        ) : (
                          <span className="text-ink-muted">All outlets</span>
                        )}
                      </td>
                      <td>
                        {u.is_active ? <Badge variant="final">Active</Badge> : <Badge variant="void">Inactive</Badge>}
                      </td>
                      <td className="whitespace-nowrap text-ink-muted">
                        {u.last_login
                          ? formatDateTime(u.last_login)
                          : 'Never'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {u.role === 'manager' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u);
                                setIsAssignModalOpen(true);
                              }}
                              aria-label={`Assign outlets to ${u.full_name}`}
                            >
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                              Outlets
                            </Button>
                          )}
                          {/* You cannot deactivate your own account */}
                          {u.is_active && !isSelf && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openToggleModal(u, 'deactivate')}
                              className="text-danger hover:bg-danger-tint hover:text-danger"
                              aria-label={`Deactivate ${u.full_name}`}
                            >
                              <Power className="h-4 w-4" aria-hidden="true" />
                              Deactivate
                            </Button>
                          )}
                          {!u.is_active && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openToggleModal(u, 'activate')}
                              className="text-brand-primary hover:text-brand-primaryDark"
                              aria-label={`Activate ${u.full_name}`}
                            >
                              <Power className="h-4 w-4" aria-hidden="true" />
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add User Modal */}
      <AddEditUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateUser}
        outlets={allOutlets}
      />

      {/* Toggle Status Confirmation */}
      <ConfirmationModal
        isOpen={isToggleModalOpen}
        onClose={() => {
          setIsToggleModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleToggleStatus}
        title={toggleAction === 'activate' ? 'Activate user?' : 'Deactivate user?'}
        message={
          toggleAction === 'activate'
            ? `Are you sure you want to activate ${selectedUser?.full_name}?`
            : `Are you sure you want to deactivate ${selectedUser?.full_name}?\n\nThis user will lose access to the system.`
        }
        confirmText={toggleAction === 'activate' ? 'Activate' : 'Deactivate'}
        variant={toggleAction === 'activate' ? 'info' : 'danger'}
      />

      {/* Assign Outlets Modal */}
      {isAssignModalOpen && selectedUser && userId && (
        <AssignOutletsModal
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedUser(null);
          }}
          onSubmit={handleAssignOutlets}
          adminUserId={userId}
          user={selectedUser}
          outlets={allOutlets}
        />
      )}
    </div>
  );
}

// ================================================================
// ASSIGN OUTLETS MODAL (INLINE)
// ================================================================
// Loads and pre-selects the manager's current assignments, because saving
// replaces the whole set.
// ================================================================

interface AssignOutletsModalProps {
  onClose: () => void;
  onSubmit: (outletIds: string[]) => Promise<void>;
  adminUserId: string;
  user: UserSummary;
  outlets: Outlet[];
}

function AssignOutletsModal({
  onClose,
  onSubmit,
  adminUserId,
  user,
  outlets,
}: AssignOutletsModalProps) {
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetUserId = user.user_id;

  useEffect(() => {
    let cancelled = false;
    setLoadingCurrent(true);
    setLoadError(null);
    getUserOutletIds(adminUserId, targetUserId)
      .then((ids) => {
        if (!cancelled) setSelectedOutlets(ids);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load current assignments');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCurrent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminUserId, targetUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || loadingCurrent || loadError) return;
    setError(null);

    if (selectedOutlets.length === 0) {
      setError('Select at least one outlet. A manager needs an outlet to see any data; to remove all access, deactivate the user instead.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(selectedOutlets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Active outlets, plus any inactive outlet the manager is still assigned to
  const visibleOutlets = outlets.filter(
    (o) => o.is_active || selectedOutlets.includes(o.id)
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Assign outlets"
      description={`Outlets ${user.full_name} can see. Saving replaces the current list.`}
      maxWidth="md"
      dismissable={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {loadError && (
          <Alert variant="error">
            {loadError}. Close and try again; saving is disabled so existing assignments are not lost.
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}

        <fieldset disabled={isSubmitting || !!loadError}>
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            Outlets<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            <span className="ml-2 font-normal text-ink-muted">at least one</span>
          </legend>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-rule-strong p-2" aria-busy={loadingCurrent || undefined}>
            {loadingCurrent ? (
              <div className="space-y-3 p-2" role="status" aria-label="Loading current assignments">
                {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5" />)}
              </div>
            ) : visibleOutlets.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-muted">No active outlets to assign.</p>
            ) : (
              visibleOutlets.map((outlet) => (
                <label
                  key={outlet.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-paper"
                >
                  <input
                    type="checkbox"
                    checked={selectedOutlets.includes(outlet.id)}
                    disabled={isSubmitting || !!loadError}
                    onChange={(e) => {
                      setError(null);
                      if (e.target.checked) {
                        setSelectedOutlets([...selectedOutlets, outlet.id]);
                      } else {
                        setSelectedOutlets(selectedOutlets.filter((id) => id !== outlet.id));
                      }
                    }}
                    className="h-4 w-4 shrink-0 rounded accent-brand-primary"
                  />
                  <span className="min-w-0 flex-1">
                    {outlet.name}
                    {!outlet.is_active && <span className="text-ink-muted"> (inactive)</span>}
                  </span>
                  <span className="serial text-ink-muted">{outlet.code}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-rule pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={loadingCurrent || !!loadError}>
            {isSubmitting ? 'Saving…' : 'Save outlets'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
