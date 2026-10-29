// ================================================================
// SETTING LABELS — human-readable names for system_settings keys.
// "payment_edit_window_days" → "Payment edit window (days)".
// A trailing unit word becomes a parenthetical; the rest is sentence case.
// ================================================================

const UNITS = new Set(['days', 'hours', 'minutes', 'percent', 'pct', 'count', 'inr', 'rupees']);
const ACRONYMS: Record<string, string> = { gst: 'GST', id: 'ID', pdf: 'PDF', sac: 'SAC', hsn: 'HSN', inr: 'INR' };

export function settingLabel(key: string): string {
  const words = key.split(/[_\s]+/).filter(Boolean).map((w) => w.toLowerCase());
  if (words.length === 0) return key;

  let unit: string | null = null;
  if (words.length > 1 && UNITS.has(words[words.length - 1])) {
    unit = words.pop() as string;
  }

  const text = words
    .map((w, i) => ACRONYMS[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

  return unit ? `${text} (${ACRONYMS[unit] ?? unit})` : text;
}

/** Display form of a stored setting value. */
export function formatSettingValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'string') {
    if (value === 'true') return 'Enabled';
    if (value === 'false') return 'Disabled';
    return value;
  }
  return JSON.stringify(value);
}
