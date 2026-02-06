// ================================================================
// CURRENCY & NUMBER FORMATTING (INR ONLY)
// ================================================================
// Currency is FIXED to INR. This is NOT a business variable.
// ================================================================

/**
 * Round a number to exactly 2 decimal places for currency safety.
 * Uses integer math to avoid floating-point precision errors.
 */
export const roundCurrency = (amount: number | null | undefined): number => {
  const safeAmount = Number(amount ?? 0);
  return Math.round(safeAmount * 100) / 100;
};

/**
 * Format number as Indian currency (INR).
 * Always shows exactly 2 decimal places.
 * 
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  const safeAmount = Number(amount ?? 0);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
};

// ================================================================
// SETTLEMENT UTILITIES
// ================================================================

/**
 * Settlement tolerance for payment calculations.
 * Balances within this threshold are treated as fully paid.
 */
export const SETTLEMENT_TOLERANCE = 0.05;

/**
 * Check if an invoice is settled (balance within tolerance).
 */
export function isSettled(balance: number): boolean {
  return Math.abs(balance) <= SETTLEMENT_TOLERANCE;
}

/**
 * Apply settlement rounding to a balance amount.
 * If balance is within SETTLEMENT_TOLERANCE, returns 0.
 */
export function settleBalance(balance: number): number {
  const rounded = roundCurrency(balance);
  return isSettled(rounded) ? 0 : rounded;
}

/**
 * Format a balance amount for display, hiding tiny rounding remainders.
 */
export function formatBalanceAmount(balance: number): string {
  const settled = settleBalance(balance);
  return formatCurrency(settled);
}

/**
 * Get display status text for a balance.
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

// ================================================================
// OTHER FORMATTING UTILITIES
// ================================================================

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format file size for display
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
 */
export function capitalize(text: string): string {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
