import { supabase } from '@/lib/supabase';

// ================================================================
// SYSTEM SETTINGS SERVICE
// ================================================================
// CRITICAL RULES:
// - Admin-only operations
// - All changes logged
// - JSONB values only
// - No destructive settings
// - Validate key exists before update
// ================================================================

export interface SystemSetting {
  key: string;
  value: any; // JSONB value (parsed)
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface UpdateSettingInput {
  key: string;
  value: any;
}

/**
 * Verify user is admin
 */
async function verifyAdminRole(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .single();

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

  return data || [];
}

/**
 * Get single setting by key (admin only)
 */
export async function getSettingByKey(
  adminUserId: string,
  key: string
): Promise<SystemSetting | null> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch setting: ${error.message}`);
  }

  return data;
}

/**
 * Update system setting (admin only)
 * CRITICAL: Logs old vs new value for audit trail
 */
export async function updateSetting(
  adminUserId: string,
  key: string,
  newValue: any
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
  const lockedSettings = ['inventory_negative_stock_tolerance'];
  if (lockedSettings.includes(key)) {
    throw new Error(`Setting '${key}' is locked and cannot be modified`);
  }

  // Log the change (for audit trail)
  const oldValue = existing.value;
  console.log(`[SYSTEM SETTINGS] User ${adminUserId} changing '${key}' from`, oldValue, 'to', newValue);

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
 * Create new system setting (admin only)
 * WARNING: Use with caution. Settings should be predefined.
 */
export async function createSetting(
  adminUserId: string,
  input: {
    key: string;
    value: any;
    description?: string;
  }
): Promise<void> {
  await verifyAdminRole(adminUserId);

  // Check if key already exists
  const { data: existing } = await supabase
    .from('system_settings')
    .select('key')
    .eq('key', input.key)
    .maybeSingle();

  if (existing) {
    throw new Error(`Setting '${input.key}' already exists. Use updateSetting instead.`);
  }

  // Insert new setting
  const { error } = await supabase
    .from('system_settings')
    .insert({
      key: input.key,
      value: input.value,
      description: input.description || null,
      updated_by: adminUserId,
    });

  if (error) {
    throw new Error(`Failed to create setting: ${error.message}`);
  }
}

/**
 * Get setting change history (for audit purposes)
 * Note: This would require a separate audit log table for full history.
 * For now, we can only see the current state.
 */
export async function getSettingHistory(
  adminUserId: string,
  key: string
): Promise<{
  key: string;
  current_value: any;
  last_updated: string;
  last_updated_by: string | null;
}> {
  await verifyAdminRole(adminUserId);

  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', key)
    .single();

  if (error) {
    throw new Error(`Failed to fetch setting history: ${error.message}`);
  }

  return {
    key: data.key,
    current_value: data.value,
    last_updated: data.updated_at,
    last_updated_by: data.updated_by,
  };
}

/**
 * Validate setting value (optional helper for UI)
 */
export function validateSettingValue(key: string, value: any): {
  valid: boolean;
  error?: string;
} {
  // Validate based on setting key
  switch (key) {
    case 'inventory_negative_stock_tolerance':
      if (typeof value !== 'string' || parseInt(value) < 0) {
        return { valid: false, error: 'Value must be a non-negative number' };
      }
      break;

    case 'payment_edit_window_days':
      if (typeof value !== 'string' || parseInt(value) < 0 || parseInt(value) > 365) {
        return { valid: false, error: 'Value must be between 0 and 365 days' };
      }
      break;

    case 'invoice_auto_number':
    case 'subscription_auto_renewal':
      if (typeof value !== 'string' || !['true', 'false'].includes(value)) {
        return { valid: false, error: 'Value must be "true" or "false"' };
      }
      break;

    default:
      // Unknown setting, allow any value
      break;
  }

  return { valid: true };
}

// PHASE 9 STEP 2 COMPLETE (systemSettingsService.ts)
