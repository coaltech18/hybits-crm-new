import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { OutletSummary } from '@/services/adminOutletService';

// ================================================================
// ADD / EDIT OUTLET MODAL
// ================================================================
// Modal for creating or editing outlets
// ================================================================

interface AddEditOutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OutletFormData) => Promise<void>;
  outlet?: OutletSummary | null;
  mode: 'create' | 'edit';
}

export interface OutletFormData {
  name: string;
  code: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function AddEditOutletModal({
  isOpen,
  onClose,
  onSubmit,
  outlet,
  mode,
}: AddEditOutletModalProps) {
  const [formData, setFormData] = useState<OutletFormData>({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && outlet && mode === 'edit') {
      setFormData({
        name: outlet.outlet_name,
        code: outlet.outlet_code,
        city: outlet.city,
        address: outlet.address || '',
        phone: '',
        email: '',
      });
    } else if (isOpen && mode === 'create') {
      setFormData({
        name: '',
        code: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
    }
    setError(null);
  }, [isOpen, outlet, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.code || !formData.city) {
      setError('Name, code, and city are required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white  rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b ">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Add New Outlet' : 'Edit Outlet'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-brand-text/60 hover:text-brand-text "
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Outlet Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
              required
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Outlet Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              disabled={mode === 'edit' || isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50 disabled:bg-brand-bg uppercase"
              placeholder="e.g., MUM01, DEL01"
              required
            />
            {mode === 'edit' && (
              <p className="text-xs text-brand-text/60 mt-1">Code cannot be changed</p>
            )}
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={isSubmitting}
              rows={3}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50"
            />
          </div>

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
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Outlet' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
