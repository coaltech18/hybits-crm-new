import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { UserSummary } from '@/services/adminUserService';
import type { Outlet } from '@/types';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-border sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Add New User' : 'Edit User'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-brand-text/60 hover:text-brand-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User creation disabled - use Supabase Dashboard */}
          {mode === 'create' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center">
                  <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                </div>
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">Create Users in Supabase</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    To create new users, go to Supabase Dashboard → Authentication → Users → Invite User.
                    After creating the auth user, add entries in user_profiles and user_outlet_assignments tables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={mode === 'edit' || isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50 disabled:bg-brand-bg"
              required
            />
            {mode === 'edit' && (
              <p className="text-xs text-brand-text/60 mt-1">Email cannot be changed</p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as 'admin' | 'manager' | 'accountant',
                  outlet_ids: e.target.value !== 'manager' ? [] : formData.outlet_ids,
                })
              }
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
              required
            >
              <option value="accountant">Accountant</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Outlet Assignment (Managers only) */}
          {formData.role === 'manager' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Assigned Outlets <span className="text-red-500">*</span>
              </label>
              <div className="border border-brand-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {outlets.filter(o => o.is_active).map((outlet) => (
                  <label key={outlet.id} className="flex items-center gap-2 cursor-pointer">
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
                      className="rounded"
                    />
                    <span className="text-sm">
                      {outlet.name} ({outlet.code})
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-brand-text/60 mt-1">
                Managers can only access assigned outlets
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t ">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-brand-border rounded-md hover:bg-brand-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mode === 'create'}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Use Supabase Dashboard' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
