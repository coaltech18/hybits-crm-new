// ================================================================
// FORMATTING UTILITIES
// ================================================================
// Currency, phone, date, and other display formatting utilities
// ================================================================

/**
 * Round a number to exactly 2 decimal places for currency safety.
 * Uses integer math to avoid floating-point precision errors.
 * 
 * CRITICAL: Use this for ALL currency calculations to prevent drift.
 * 
 * @example
 * roundCurrency(23599.9999999) => 23600.00
 * roundCurrency(0.1 + 0.2)     => 0.30 (not 0.30000000000000004)
 * 
 * @param amount - The amount to round
 * @returns Amount rounded to exactly 2 decimal places
 */
export function roundCurrency(amount: number): number {
  // Multiply by 100, round to integer, divide back
  // This avoids floating-point accumulation errors
  return Math.round(amount * 100) / 100;
}

/**
 * Settlement tolerance for payment calculations.
 * Balances within this threshold are treated as fully paid.
 * 
 * This prevents UI confusion from tiny remainders like ₹0.01 or ₹0.02
 * caused by floating-point arithmetic errors.
 */
export const SETTLEMENT_TOLERANCE = 0.05;

/**
 * Check if an invoice is settled (balance within tolerance).
 * 
 * @param balance - The balance due amount
 * @returns true if the invoice should be considered fully paid
 */
export function isSettled(balance: number): boolean {
  return Math.abs(balance) <= SETTLEMENT_TOLERANCE;
}

/**
 * Apply settlement rounding to a balance amount.
 * If balance is within SETTLEMENT_TOLERANCE, returns 0.
 * 
 * @param balance - The raw balance due amount
 * @returns 0 if within tolerance, otherwise the rounded balance
 */
export function settleBalance(balance: number): number {
  const rounded = roundCurrency(balance);
  return isSettled(rounded) ? 0 : rounded;
}

// ================================================================
// UI MONEY DISPLAY RULES
// ================================================================
// 1. Always format using fixed 2 decimals (₹xx.xx)
// 2. Never show fractional paise beyond 2 decimals
// 3. If balance_due is 0 → show "Paid in Full"
// 4. Hide tiny rounding balances from UI (< ₹0.05)
// ================================================================

/**
 * Default currency code for the application
 */
export const DEFAULT_CURRENCY = 'INR';

/**
 * Supported currency codes and their locales
 */
const CURRENCY_CONFIG: Record<string, { locale: string; symbol: string }> = {
  INR: { locale: 'en-IN', symbol: '₹' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  AED: { locale: 'ar-AE', symbol: 'AED' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
};

/**
 * Format number as currency with a specific currency code.
 * Always shows exactly 2 decimal places.
 * 
 * @param amount - Amount to format
 * @param currencyCode - ISO 4217 currency code (default: INR)
 * @returns Formatted currency string (e.g., "₹1,234.56" or "$1,234.56")
 */
export function formatCurrencyWithCode(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  // First round to 2 decimals to avoid floating-point display issues
  const rounded = roundCurrency(amount);

  // Get currency config, fallback to INR if unknown
  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.INR;

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currencyCode in CURRENCY_CONFIG ? currencyCode : 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Format number as Indian currency (INR)
 * Always shows exactly 2 decimal places.
 * 
 * NOTE: This is a convenience wrapper that defaults to INR.
 * For dynamic currency, use formatCurrencyWithCode().
 * 
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export function formatCurrency(amount: number): string {
  return formatCurrencyWithCode(amount, 'INR');
}

/**
 * Get the symbol for a currency code.
 * 
 * @param currencyCode - ISO 4217 currency code
 * @returns Currency symbol (e.g., '₹', '$', '€')
 */
export function getCurrencySymbol(currencyCode: string = DEFAULT_CURRENCY): string {
  return CURRENCY_CONFIG[currencyCode]?.symbol || currencyCode;
}

/**
 * Format a balance amount for display, hiding tiny rounding remainders.
 * 
 * UI RULE: If balance is within settlement tolerance (₹0.05),
 * return "₹0.00" instead of showing confusing paise amounts.
 * 
 * @param balance - The raw balance amount
 * @returns Formatted currency string with tiny balances hidden
 */
export function formatBalanceAmount(balance: number): string {
  const settled = settleBalance(balance);
  return formatCurrency(settled);
}

/**
 * Get display status text for a balance.
 * 
 * UI RULE: If balance is 0 (or within tolerance), show "Paid in Full"
 * Otherwise show the formatted balance amount.
 * 
 * @param balance - The raw balance due amount
 * @param showCurrency - If true, show "₹xx.xx" for positive balances; if false, show just the status text
 * @returns Status text ("Paid in Full") or formatted balance
 */
export function formatBalanceStatus(balance: number, showCurrency = true): string {
  const settled = settleBalance(balance);

  if (settled === 0) {
    return 'Paid in Full';
  }

  if (showCurrency) {
    return formatCurrency(settled);
  }

  return settled.toFixed(2);
}

/**
 * Get CSS class name for balance display styling.
 * 
 * @param balance - The balance amount
 * @returns CSS class name suggestion
 */
export function getBalanceStatusClass(balance: number): 'success' | 'warning' | 'danger' {
  const settled = settleBalance(balance);

  if (settled === 0) {
    return 'success'; // Paid in full - green
  } else if (settled > 0) {
    return 'warning'; // Outstanding - yellow/amber
  } else {
    return 'danger'; // Overpaid (should not happen) - red
  }
}

/**
 * Format phone number for display
 * @param phone - Phone number string
 * @returns Formatted phone number
 */
export function formatPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Format as +91 XXXXX XXXXX for 10-digit numbers
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // Format as +91 XXXXX XXXXX for 12-digit numbers (with country code)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // Return as-is if format doesn't match
  return phone;
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Human-readable size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Capitalize first letter of each word
 * @param text - Text to capitalize
 * @returns Capitalized text
 */
export function capitalize(text: string): string {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
