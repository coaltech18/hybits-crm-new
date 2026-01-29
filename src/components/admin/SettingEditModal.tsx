import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { SystemSetting } from '@/services/systemSettingsService';

// ================================================================
// SETTING EDIT MODAL
// ================================================================
// Modal for editing system settings
// ================================================================

interface SettingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: any) => Promise<void>;
  setting: SystemSetting | null;
}

export function SettingEditModal({
  isOpen,
  onClose,
  onSubmit,
  setting,
}: SettingEditModalProps) {
  const [newValue, setNewValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && setting) {
      // Convert JSONB value to string for editing
      const currentValue = typeof setting.value === 'string' 
        ? setting.value 
        : JSON.stringify(setting.value);
      setNewValue(currentValue);
    }
    setError(null);
  }, [isOpen, setting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setting) return;

    setError(null);

    if (!newValue) {
      setError('Value cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(setting.key, newValue);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !setting) return null;

  const isLockedSetting = setting.key === 'inventory_negative_stock_tolerance';
  const isBooleanSetting = ['invoice_auto_number', 'subscription_auto_renewal'].includes(setting.key);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white  rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b ">
          <h2 className="text-lg font-semibold">Edit Setting</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-brand-text/60 hover:text-brand-text dark:hover:text-gray-300"
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

          {isLockedSetting && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Locked Setting:</strong> This setting is locked for production safety and cannot be modified.
              </div>
            </div>
          )}

          {/* Setting Key (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-1">Setting Key</label>
            <input
              type="text"
              value={setting.key}
              disabled
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-brand-bg text-brand-text/80"
            />
          </div>

          {/* Description */}
          {setting.description && (
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <p className="text-sm text-brand-text/70 p-3 bg-brand-bg rounded">
                {setting.description}
              </p>
            </div>
          )}

          {/* Current Value (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-1">Current Value</label>
            <input
              type="text"
              value={typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)}
              disabled
              className="w-full px-3 py-2 border border-brand-border rounded-md bg-brand-bg text-brand-text/80"
            />
          </div>

          {/* New Value */}
          <div>
            <label className="block text-sm font-medium mb-1">
              New Value <span className="text-red-500">*</span>
            </label>
            {isBooleanSetting ? (
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                disabled={isSubmitting || isLockedSetting}
                className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50 disabled:bg-brand-bg"
                required
              >
                <option value="true">True (Enabled)</option>
                <option value="false">False (Disabled)</option>
              </select>
            ) : (
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                disabled={isSubmitting || isLockedSetting}
                className="w-full px-3 py-2 border border-brand-border rounded-md bg-white disabled:opacity-50 disabled:bg-brand-bg"
                required
              />
            )}
          </div>

          {/* Warning */}
          {!isLockedSetting && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <strong>Warning:</strong> Changing system settings may affect application behavior. Proceed with caution.
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
              disabled={isSubmitting || isLockedSetting}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primaryDark disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Setting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
