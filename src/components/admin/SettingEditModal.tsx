import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import {
  parseSettingInput,
  BOOLEAN_SETTINGS,
  LOCKED_SETTINGS,
  type SystemSetting,
  type SettingValue,
} from '@/services/systemSettingsService';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { settingLabel, formatSettingValue } from './settingLabel';

// ================================================================
// SETTING EDIT MODAL
// ================================================================
// Modal for editing system settings
// ================================================================

interface SettingEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: SettingValue) => Promise<void>;
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

    if (isSubmitting) return;
    setError(null);

    // Keep the JSON type: numbers stay numbers, booleans stay booleans
    const parsed = parseSettingInput(setting.key, newValue);
    if (parsed.error !== undefined) {
      setError(parsed.error);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(setting.key, parsed.value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const open = isOpen && !!setting;
  const isLockedSetting = setting ? LOCKED_SETTINGS.includes(setting.key) : false;
  const isBooleanSetting = setting ? BOOLEAN_SETTINGS.includes(setting.key) : false;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={setting ? `Edit: ${settingLabel(setting.key)}` : 'Edit setting'}
      description={setting?.description ?? undefined}
      maxWidth="lg"
      dismissable={!isSubmitting}
    >
      {setting && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}

          {isLockedSetting && (
            <Alert variant="warning">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Locked setting.
              </span>{' '}
              It is locked for production safety and cannot be changed.
            </Alert>
          )}

          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-rule bg-paper-sunk px-4 py-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Key</dt>
              <dd className="serial mt-0.5 break-all text-sm text-ink">{setting.key}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Current value</dt>
              <dd className="tabular mt-0.5 break-all text-sm font-semibold text-ink">{formatSettingValue(setting.value)}</dd>
            </div>
          </dl>

          {isBooleanSetting ? (
            <Select
              label="New value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={isSubmitting || isLockedSetting}
              required
            >
              <option value="true">Enabled (true)</option>
              <option value="false">Disabled (false)</option>
            </Select>
          ) : (
            <Input
              label="New value"
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={isSubmitting || isLockedSetting}
              className="tabular"
              required
            />
          )}

          {!isLockedSetting && (
            <Alert variant="info">
              <strong>Not yet enforced.</strong> This value is stored for future use. No part of the app
              reads it yet, so changing it has no effect today.
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-rule pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isLockedSetting}>
              {isSubmitting ? 'Saving…' : 'Save setting'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
