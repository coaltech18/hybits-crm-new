// ================================================================
// CURRENCY & NUMBER FORMATTING (INR ONLY)
// ================================================================
// Currency is FIXED to INR. This is NOT a business variable.
// ================================================================

/**
 * Convert an amount to whole paise, rounding half away from zero.
 *
 * `x * 100` on binary floats lands just below the half (0.035 * 100 is
 * 3.4999999999999996), so plain Math.round rounds the wrong way. Taking
 * 15 significant digits first recovers the decimal the user typed, which
 * matches how Postgres NUMERIC and ROUND(numeric, 2) see the same value.
 */
export function toPaise(amount: number | null | undefined): number {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  const scaled = Number((Math.abs(n) * 100).toPrecision(15));
  return Math.sign(n) * Math.round(scaled);
}

/**
 * Round a number to exactly 2 decimal places, half away from zero,
 * the same way Postgres ROUND(numeric, 2) does.
 */
export const roundCurrency = (amount: number | null | undefined): number => {
  return toPaise(amount) / 100;
};

/** Integer division of BigInts, rounding half away from zero. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const neg = numerator < BigInt(0);
  const abs = neg ? -numerator : numerator;
  const q = (abs * BigInt(2) + denominator) / (denominator * BigInt(2));
  return neg ? -q : q;
}

export interface LineAmounts {
  line_total: number;
  tax_amount: number;
  linePaise: bigint;
  taxPaise: bigint;
}

/**
 * Exact invoice line maths, identical to the DB CHECKs:
 *   line_total = ROUND(quantity * unit_price, 2)
 *   tax_amount = ROUND(line_total * tax_rate / 100.0, 2)
 * Quantity, price and rate are first rounded to 2 decimals, as the
 * NUMERIC(…,2) columns store them.
 */
export function calcLineAmounts(quantity: number, unitPrice: number, taxRate: number): LineAmounts {
  const q = BigInt(toPaise(quantity));
  const p = BigInt(toPaise(unitPrice));
  const r = BigInt(toPaise(taxRate)); // rate in hundredths of a percent
  const linePaise = divRound(q * p, BigInt(100));
  const taxPaise = divRound(linePaise * r, BigInt(10000));
  return {
    line_total: Number(linePaise) / 100,
    tax_amount: Number(taxPaise) / 100,
    linePaise,
    taxPaise,
  };
}

/**
 * Invoice totals from line items, summed in paise so the result always
 * satisfies grand_total = subtotal + tax_total exactly.
 */
export function calcInvoiceTotals<T extends { quantity: number; unit_price: number; tax_rate: number }>(
  items: T[]
): {
  subtotal: number;
  tax_total: number;
  grand_total: number;
  items: (T & { line_total: number; tax_amount: number })[];
} {
  let subPaise = BigInt(0);
  let taxPaise = BigInt(0);
  const calculated = items.map((item) => {
    const amounts = calcLineAmounts(item.quantity, item.unit_price, item.tax_rate);
    subPaise += amounts.linePaise;
    taxPaise += amounts.taxPaise;
    return { ...item, line_total: amounts.line_total, tax_amount: amounts.tax_amount };
  });
  return {
    subtotal: Number(subPaise) / 100,
    tax_total: Number(taxPaise) / 100,
    grand_total: Number(subPaise + taxPaise) / 100,
    items: calculated,
  };
}

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format number as Indian currency (INR).
 * Always shows exactly 2 decimal places.
 *
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  const safeAmount = Number(amount ?? 0);
  return INR_FORMATTER.format(safeAmount);
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/**
 * Format a timestamp the same way everywhere: "5 Sept 2026, 1:00 pm".
 * Returns '—' for empty or unparseable input.
 */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_TIME_FORMATTER.format(d);
}

/**
 * One-line void trail for a voided payment:
 * "Voided by Asha · 5 Sept 2026, 1:00 pm — duplicate entry".
 * Parts that are missing are left out.
 */
export function formatVoidTrail(p: {
  voided_by_name?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
}): string {
  let text = p.voided_by_name ? `Voided by ${p.voided_by_name}` : 'Voided';
  if (p.voided_at) text += ` · ${formatDateTime(p.voided_at)}`;
  const reason = p.void_reason?.trim();
  if (reason) text += ` — ${reason}`;
  return text;
}

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

if (import.meta.env?.DEV) {
  // Values where float rounding used to disagree with Postgres ROUND(numeric, 2)
  console.assert(roundCurrency(1.005) === 1.01, 'roundCurrency rounds 1.005 half up');
  console.assert(roundCurrency(-1.005) === -1.01, 'roundCurrency rounds half away from zero');
  console.assert(roundCurrency(0.035) === 0.04, 'roundCurrency(0.035)');
  console.assert(calcLineAmounts(1, 5.75, 18).tax_amount === 1.04, 'tax on 5.75 @18% is 1.04');
  console.assert(calcLineAmounts(5, 0.25, 18).tax_amount === 0.23, 'tax on 1.25 @18% is 0.23');
  console.assert(calcLineAmounts(1, 0.7, 5).tax_amount === 0.04, 'tax on 0.70 @5% is 0.04');
  console.assert(calcLineAmounts(0.05, 0.7, 5).line_total === 0.04, 'line 0.05 x 0.70 is 0.04');
  console.assert(calcInvoiceTotals([{ quantity: 3, unit_price: 0.1, tax_rate: 18 }]).grand_total === 0.35, 'calcInvoiceTotals sums in paise');
}
