import { useState, useEffect } from 'react';
import { Settings, Edit, Lock, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSettings,
  updateSetting,
  type SystemSetting,
} from '@/services/systemSettingsService';
import { SettingEditModal } from '@/components/admin/SettingEditModal';

// ================================================================
// SYSTEM SETTINGS PAGE (ADMIN ONLY)
// ================================================================
// Manage system configuration with audit logging
// ================================================================

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null);

  useEffect(() => {
    loadSettings();
  }, [user]);

  async function loadSettings() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getSettings(user.id);
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSetting(key: string, value: any) {
    if (!user?.id) return;

    await updateSetting(user.id, key, value);
    await loadSettings();
  }

  function openEditModal(setting: SystemSetting) {
    setSelectedSetting(setting);
    setIsEditModalOpen(true);
  }

  const isLockedSetting = (key: string) => {
    return key === 'inventory_negative_stock_tolerance';
  };

  const formatValue = (value: any) => {
    if (typeof value === 'string') {
      if (value === 'true') return 'Enabled';
      if (value === 'false') return 'Disabled';
      return value;
    }
    return JSON.stringify(value);
  };

  const getSettingCategory = (key: string) => {
    if (key.startsWith('inventory_')) return 'Inventory';
    if (key.startsWith('payment_')) return 'Payments';
    if (key.startsWith('invoice_')) return 'Invoices';
    if (key.startsWith('subscription_')) return 'Subscriptions';
    return 'General';
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    const category = getSettingCategory(setting.key);
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-text/70">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="w-8 h-8" />
          System Settings
        </h1>
        <p className="text-brand-text/70 mt-1">
          Manage system configuration and feature toggles
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Warning Banner */}
      <div className="p-4 bg-brand-primary/10 border border-brand-border rounded">
        <p className="text-sm text-brand-text">
          <strong>⚠️ Warning:</strong> Changing system settings may affect application behavior.
          All changes are logged and can be audited. Locked settings cannot be modified for
          production safety.
        </p>
      </div>

      {/* Settings by Category */}
      {Object.entries(groupedSettings).map(([category, categorySettings]) => (
        <div
          key={category}
          className="bg-white rounded-lg border border-brand-border overflow-hidden"
        >
          {/* Category Header */}
          <div className="p-4 bg-brand-bg border-b border-brand-border">
            <h2 className="text-lg font-semibold">{category}</h2>
          </div>

          {/* Settings Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-bg border-b border-brand-border">
                <tr>
                  <th className="text-left py-3 px-4 font-medium w-1/4">Setting</th>
                  <th className="text-left py-3 px-4 font-medium w-1/3">Description</th>
                  <th className="text-left py-3 px-4 font-medium w-1/6">Current Value</th>
                  <th className="text-left py-3 px-4 font-medium w-1/6">Last Updated</th>
                  <th className="text-right py-3 px-4 font-medium w-1/12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {categorySettings.map((setting) => {
                  const locked = isLockedSetting(setting.key);

                  return (
                    <tr
                      key={setting.key}
                      className={`hover:bg-brand-primary/5 ${locked ? 'bg-brand-bg' : ''
                        }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{setting.key}</span>
                          {locked && (
                            <span title="Locked setting">
                              <Lock className="w-4 h-4 text-brand-text/60" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-brand-text/70">
                        {setting.description || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-primary/20 text-brand-primary">
                          {formatValue(setting.value)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-brand-text/70">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(setting.updated_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => openEditModal(setting)}
                            disabled={locked}
                            className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title={locked ? 'Setting is locked' : 'Edit setting'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Info Box */}
      <div className="bg-brand-primary/10 border border-brand-primary/30 rounded p-4">
        <h3 className="font-semibold text-brand-text mb-2">
          ℹ️ About System Settings
        </h3>
        <ul className="text-sm text-brand-text space-y-1 list-disc list-inside">
          <li>
            <strong>Locked Settings:</strong> Cannot be modified for production safety and data
            integrity
          </li>
          <li>
            <strong>Audit Trail:</strong> All changes are logged with user ID and timestamp
          </li>
          <li>
            <strong>Boolean Values:</strong> Use "true" or "false" for enable/disable toggles
          </li>
          <li>
            <strong>Numeric Values:</strong> Ensure values are within acceptable ranges
          </li>
        </ul>
      </div>

      {/* Edit Setting Modal */}
      <SettingEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedSetting(null);
        }}
        onSubmit={handleUpdateSetting}
        setting={selectedSetting}
      />
    </div>
  );
}
