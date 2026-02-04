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
 * Format number as Indian currency (INR)
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
