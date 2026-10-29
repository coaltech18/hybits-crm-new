import { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getSettings,
  updateSetting,
  LOCKED_SETTINGS,
  type SystemSetting,
  type SettingValue,
} from '@/services/systemSettingsService';
import { SettingEditModal } from '@/components/admin/SettingEditModal';
import { settingLabel, formatSettingValue } from '@/components/admin/settingLabel';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

// ================================================================
// SYSTEM SETTINGS PAGE (ADMIN ONLY)
// ================================================================
// Stored configuration values. Informational only: nothing in the app or
// the database reads these yet, and changes are not history-logged.
// ================================================================

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function SystemSettingsPage() {
  useDocumentTitle('System settings');

  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null);

  // Only the latest load may write state
  const requestId = useRef(0);

  const loadSettings = useCallback(async () => {
    if (!userId) return;
    const req = ++requestId.current;

    try {
      setLoading(true);
      setError(null);
      const data = await getSettings(userId);
      if (req === requestId.current) setSettings(data);
    } catch (err) {
      if (req === requestId.current) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      }
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [userId]);

  // Keyed on the user id so token refreshes don't refetch or reset the modal
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleUpdateSetting(key: string, value: SettingValue) {
    if (!userId) return;

    await updateSetting(userId, key, value);
    await loadSettings();
  }

  function openEditModal(setting: SystemSetting) {
    setSelectedSetting(setting);
    setIsEditModalOpen(true);
  }

  const isLockedSetting = (key: string) => LOCKED_SETTINGS.includes(key);

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

  const first = loading && settings.length === 0;

  return (
    <div>
      <PageHeader
        title="System settings"
        description="Stored configuration values. Informational for now: nothing reads them yet."
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <Alert variant="info" className="mb-6">
        <strong>Not yet enforced.</strong> No part of the app reads these values today, so changing them
        does not change how invoices, payments or subscriptions behave. Only the last change (time and
        user) is kept; there is no change history. Locked settings cannot be changed.
      </Alert>

      <div className="space-y-6">
        {first ? (
          <section className="sheet overflow-hidden" aria-label="Loading settings">
            <TableSkeleton rows={5} cols={4} />
          </section>
        ) : settings.length === 0 && !error ? (
          <section className="sheet">
            <EmptyState
              title="No settings stored"
              description="The system_settings table is empty. Settings are added by database migrations."
            />
          </section>
        ) : (
          Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <section key={category} className="sheet overflow-hidden" aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">
                {category}
              </h2>
              <div className="overflow-x-auto">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[30%]">Setting</th>
                      <th scope="col">Description</th>
                      <th scope="col">Value</th>
                      <th scope="col">Last updated</th>
                      <th scope="col" data-nolabel className="w-px text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorySettings.map((setting) => {
                      const locked = isLockedSetting(setting.key);
                      const label = settingLabel(setting.key);
                      return (
                        <tr key={setting.key}>
                          <td>
                            <div className="inline-block max-w-full align-top">
                              <div className="font-semibold text-ink">{label}</div>
                              <div className="serial mt-0.5 text-xs text-ink-muted">{setting.key}</div>
                            </div>
                          </td>
                          <td className="min-w-[14rem] text-ink-muted">{setting.description || '—'}</td>
                          <td className="tabular whitespace-nowrap font-semibold text-ink">
                            {formatSettingValue(setting.value)}
                          </td>
                          <td className="whitespace-nowrap text-ink-muted">
                            <div>
                              <div className="tabular">{fmtDate(setting.updated_at)}</div>
                              {setting.updated_by && (
                                <div className="mt-0.5 text-sm">
                                  by {setting.updated_by_name || 'an unknown user'}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-right">
                            {locked ? (
                              <Badge variant="void">
                                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                Locked
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(setting)}
                                aria-label={`Edit ${label}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <section className="sheet px-5 py-4" aria-labelledby="about-settings">
          <h2 id="about-settings" className="text-lg font-semibold text-ink">About these settings</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-ink">Locked settings</dt>
              <dd className="text-ink-muted">Cannot be changed, for production safety and data integrity.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Last change only</dt>
              <dd className="text-ink-muted">Each setting records when it was last updated and by whom; earlier values are not kept.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">On/off values</dt>
              <dd className="text-ink-muted">Choose Enabled or Disabled.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Numeric values</dt>
              <dd className="text-ink-muted">Whole numbers only (days: 0 to 365).</dd>
            </div>
          </dl>
        </section>
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
