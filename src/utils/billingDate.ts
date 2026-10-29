import type { BillingCycle } from '@/types';
import { todayISO, toLocalISODate, parseLocalISODate } from '@/utils/date';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ================================================================
// BILLING DATE CALCULATION UTILITIES
// ================================================================
// Production-grade date calculations for subscription billing
// ================================================================

/**
 * Calculate next billing date based on start date and billing cycle
 * 
 * LOCKED RULES:
 * - For daily: adds 1 day
 * - For weekly: adds 7 days
 * - For monthly: adds 1 month, adjusts to billing_day (1-28)
 * 
 * @param startDate - The reference date (ISO string or Date)
 * @param billingCycle - daily, weekly, or monthly
 * @param billingDay - Day of month (1-28), required for monthly
 * @returns ISO date string
 */
export function calculateNextBillingDate(
  startDate: string | Date,
  billingCycle: BillingCycle,
  billingDay?: number
): string {
  // Local calendar arithmetic only; never round-trip through UTC.
  const date =
    typeof startDate === 'string' ? parseLocalISODate(startDate) : new Date(startDate.getTime());

  switch (billingCycle) {
    case 'daily':
      return toLocalISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));

    case 'weekly':
      return toLocalISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7));

    case 'monthly':
      if (!billingDay || billingDay < 1 || billingDay > 28) {
        throw new Error('Billing day must be between 1 and 28 for monthly billing');
      }
      // Build from parts so Jan 31 + 1 month is never rolled into March.
      // billingDay <= 28 cannot overflow; the constructor handles year rollover.
      return toLocalISODate(new Date(date.getFullYear(), date.getMonth() + 1, billingDay));

    default:
      throw new Error(`Invalid billing cycle: ${billingCycle}`);
  }
}

/**
 * Calculate next billing date from today (for resume)
 * 
 * LOCKED RULE: Used when resuming a paused subscription
 * - Starts fresh billing cycle from today
 * 
 * @param billingCycle - daily, weekly, or monthly
 * @param billingDay - Day of month (1-28), required for monthly
 * @returns ISO date string
 */
export function calculateNextBillingDateFromToday(
  billingCycle: BillingCycle,
  billingDay?: number
): string {
  return calculateNextBillingDate(getTodayISO(), billingCycle, billingDay);
}

/**
 * Validate billing day for monthly cycles
 * 
 * @param billingDay - Day to validate
 * @returns true if valid, false otherwise
 */
export function isValidBillingDay(billingDay: number): boolean {
  return Number.isInteger(billingDay) && billingDay >= 1 && billingDay <= 28;
}

/**
 * Format billing cycle for display
 * 
 * @param billingCycle - Billing cycle enum value
 * @param billingDay - Optional billing day for monthly
 * @returns Human-readable string
 */
export function formatBillingCycle(
  billingCycle: BillingCycle,
  billingDay?: number | null
): string {
  switch (billingCycle) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return billingDay ? `Monthly (Day ${billingDay})` : 'Monthly';
    default:
      return billingCycle;
  }
}

/**
 * Check if a date is in the past
 * 
 * @param date - Date to check (ISO string or Date)
 * @returns true if date is before today
 */
export function isDateInPast(date: string | Date): boolean {
  // YYYY-MM-DD strings compare correctly as text. Never mutates the input.
  const iso = typeof date === 'string' ? date.slice(0, 10) : toLocalISODate(date);
  return iso < getTodayISO();
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 * 
 * @returns Local (not UTC) date string
 */
export function getTodayISO(): string {
  return todayISO();
}

/**
 * Format date for display
 * 
 * @param date - Date to format (ISO string or Date)
 * @param format - 'short' | 'long'
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d =
    typeof date === 'string'
      ? ISO_DATE_RE.test(date)
        ? parseLocalISODate(date)
        : new Date(date)
      : date;

  if (format === 'long') {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
