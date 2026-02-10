// ================================================================
// GST CONSTANTS
// ================================================================
// Single source of truth for GST-related display constants.
// These are DISPLAY-ONLY and do NOT affect tax calculations.
// ================================================================

/**
 * Default HSN/SAC code for all Hybits services.
 *
 * SAC 9985 = "Support Services" under GST classification.
 * Applies to: Outdoor catering, event services, subscription services,
 *             transportation & missing item charges.
 *
 * Business Rule (LOCKED):
 * - ALL invoice line items use this single HSN code.
 * - HSN is NOT item-specific and NOT user-editable.
 * - This is a display/reporting field only — no tax logic depends on it.
 */
export const DEFAULT_HSN_CODE = '9985';
