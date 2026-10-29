import { supabase } from '@/lib/supabase';

// ================================================================
// SYSTEM SETTINGS SERVICE
// ================================================================
// CRITICAL RULES:
// - Admin-only operations
// - JSONB values only; values keep their JSON type (number/boolean)
// - No destructive settings
// - Validate key exists before update
// NOTE: No app code or DB function reads these settings yet, and there is
// no change-history table: updated_at/updated_by is the only record.
// ================================================================

export type SettingValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface SystemSetting {
  key: string;
  value: SettingValue; // JSONB value (parsed)
  description: string | null;
  updated_at: string;
  updated_by: string | null;
  /** Full name of `updated_by`, resolved for display (null when unknown). */
  updated_by_name?: string | null;
}

/** Settings that cannot be changed from the UI. */
export const LOCKED_SETTINGS = ['inventory_negative_stock_tolerance'];

/** Settings stored as JSON booleans. */
export const BOOLEAN_SETTINGS = ['invoice_auto_number', 'subscription_auto_renewal'];

/** Settings stored as JSON integers, with their allowed range. */
export const INTEGER_SETTINGS: Record<string, { min: number; max: number; label: string }> = {
  inventory_negative_stock_tolerance: { min: 0, max: 100000, label: 'a whole number of 0 or more' },
  payment_edit_window_days: { min: 0, max: 365, label: 'a whole number of days from 0 to 365' },
};

/**
 * Verify user is admin
 */
async function verifyAdminRole(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    throw new Error('User profile not found');
  }

  if (profile.role !== 'admin') {
    throw new Error('Permission denied: Admin access required');
  }

  if (!profile.is_active) {
    throw new Error('Permission denied: User account is inactive');
  }
}

/**
 * Get all system settings (admin only)
 */
export async function getSettings(adminUserId: string): Promise<SystemSetting[]> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  const settings = (data || []) as SystemSetting[];

  // Resolve who made the last change. A failed lookup only hides the names.
  const updaterIds = [...new Set(settings.map((s) => s.updated_by).filter((id): id is string => !!id))];
  let names = new Map<string, string>();
  if (updaterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', updaterIds);
    if (!profilesError) {
      names = new Map((profiles || []).map((p) => [p.id as string, p.full_name as string]));
    }
  }

  return settings.map((s) => ({
    ...s,
    updated_by_name: s.updated_by ? names.get(s.updated_by) ?? null : null,
  }));
}

/**
 * Update system setting (admin only).
 * `newValue` must already be the typed JSON value (see parseSettingInput).
 */
export async function updateSetting(
  adminUserId: string,
  key: string,
  newValue: SettingValue
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Validate key exists
  const { data: existing, error: checkError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check setting: ${checkError.message}`);
  }

  if (!existing) {
    throw new Error(`Setting '${key}' does not exist. Cannot update non-existent setting.`);
  }

  // Validate locked settings (cannot be changed)
  if (LOCKED_SETTINGS.includes(key)) {
    throw new Error(`Setting '${key}' is locked and cannot be modified`);
  }

  const validation = validateSettingValue(key, newValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Update setting
  const { error: updateError } = await supabase
    .from('system_settings')
    .update({
      value: newValue,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    })
    .eq('key', key);

  if (updateError) {
    throw new Error(`Failed to update setting: ${updateError.message}`);
  }
}

/**
 * Convert the text typed in the edit form into the setting's JSON type.
 * Returns an error message instead of a value when the input is invalid.
 */
export function parseSettingInput(
  key: string,
  input: string
): { value: SettingValue; error?: undefined } | { value?: undefined; error: string } {
  const text = input.trim();

  if (BOOLEAN_SETTINGS.includes(key)) {
    if (text !== 'true' && text !== 'false') {
      return { error: 'Value must be true or false' };
    }
    return { value: text === 'true' };
  }

  const range = INTEGER_SETTINGS[key];
  if (range) {
    if (!/^\d+$/.test(text)) {
      return { error: `Value must be ${range.label}` };
    }
    const n = Number(text);
    if (!Number.isInteger(n) || n < range.min || n > range.max) {
      return { error: `Value must be ${range.label}` };
    }
    return { value: n };
  }

  if (!text) {
    return { error: 'Value cannot be empty' };
  }
  return { value: text };
}

/**
 * Validate a typed setting value
 */
export function validateSettingValue(key: string, value: SettingValue): {
  valid: boolean;
  error?: string;
} {
  if (BOOLEAN_SETTINGS.includes(key) && typeof value !== 'boolean') {
    return { valid: false, error: 'Value must be true or false' };
  }

  const range = INTEGER_SETTINGS[key];
  if (range) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
      return { valid: false, error: `Value must be ${range.label}` };
    }
  }

  return { valid: true };
}

// PHASE 9 STEP 2 COMPLETE (systemSettingsService.ts)
