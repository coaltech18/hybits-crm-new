import { useState, useEffect } from 'react';
import type { UserSummary } from '@/services/adminUserService';
import type { Outlet } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

// ================================================================
// ADD / EDIT USER MODAL
// ================================================================
// Modal for creating or editing user profiles
// ================================================================

interface AddEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  user?: UserSummary | null;
  outlets: Outlet[];
  mode: 'create' | 'edit';
}

export interface UserFormData {
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'accountant';
  outlet_ids?: string[];
}

export function AddEditUserModal({
  isOpen,
  onClose,
  onSubmit,
  user,
  outlets,
  mode,
}: AddEditUserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    phone: '',
    role: 'accountant',
    outlet_ids: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user && mode === 'edit') {
      setFormData({
        email: user.email,
        full_name: user.full_name,
        phone: '',
        role: user.role as 'admin' | 'manager' | 'accountant',
        outlet_ids: [],
      });
    } else if (isOpen && mode === 'create') {
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        role: 'accountant',
        outlet_ids: [],
      });
    }
    setError(null);
  }, [isOpen, user, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email || !formData.full_name) {
      setError('Email and full name are required');
      return;
    }

    if (formData.role === 'manager' && (!formData.outlet_ids || formData.outlet_ids.length === 0)) {
      setError('Managers must be assigned to at least one outlet');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add user' : 'Edit user'}
      maxWidth="2xl"
      dismissable={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* User creation is not possible from the browser (needs the service role) */}
        {mode === 'create' && (
          <Alert variant="warning">
            <h3 className="font-semibold">This form cannot create users yet</h3>
            <p className="mt-1">
              Creating a login needs a secure server step the app does not have, so the button below
              stays disabled. Nothing you type here is saved. To add a user:
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>
                In the Supabase Dashboard, open Authentication → Users → Add user, enter their email, and
                copy the new user's UID.
              </li>
              <li>
                In Table Editor → <code className="serial">user_profiles</code>, insert a row with{' '}
                <code className="serial">id</code> = that UID, the same <code className="serial">email</code>,{' '}
                <code className="serial">full_name</code>, <code className="serial">role</code> (admin, manager
                or accountant) and <code className="serial">is_active</code> = true.
              </li>
              <li>Reload this page. For a manager, use Assign outlets on their row.</li>
            </ol>
          </Alert>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={mode === 'edit' || isSubmitting}
            helperText={mode === 'edit' ? 'Email cannot be changed.' : undefined}
            required
          />

          <Input
            label="Full name"
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={isSubmitting}
          />

          <Select
            label="Role"
            value={formData.role}
            onChange={(e) =>
              setFormData({
                ...formData,
                role: e.target.value as 'admin' | 'manager' | 'accountant',
                outlet_ids: e.target.value !== 'manager' ? [] : formData.outlet_ids,
              })
            }
            disabled={isSubmitting}
            required
          >
            <option value="accountant">Accountant</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </div>

        {/* Outlet Assignment (Managers only) */}
        {formData.role === 'manager' && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">
              Assigned outlets<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </legend>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-rule-strong p-2">
              {outlets.filter((o) => o.is_active).map((outlet) => (
                <label
                  key={outlet.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-paper"
                >
                  <input
                    type="checkbox"
                    checked={formData.outlet_ids?.includes(outlet.id) || false}
                    onChange={(e) => {
                      const newOutletIds = e.target.checked
                        ? [...(formData.outlet_ids || []), outlet.id]
                        : (formData.outlet_ids || []).filter((id) => id !== outlet.id);
                      setFormData({ ...formData, outlet_ids: newOutletIds });
                    }}
                    disabled={isSubmitting}
                    className="h-4 w-4 shrink-0 rounded accent-brand-primary"
                  />
                  <span className="min-w-0 flex-1">{outlet.name}</span>
                  <span className="serial text-ink-muted">{outlet.code}</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-ink-muted">Managers can only see the outlets they are assigned.</p>
          </fieldset>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-rule pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={mode === 'create'}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Not available in the app' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
