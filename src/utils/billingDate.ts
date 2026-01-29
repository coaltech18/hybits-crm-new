import type { BillingCycle } from '@/types';

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
  const date = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  
  switch (billingCycle) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
      
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
      
    case 'monthly':
      if (!billingDay || billingDay < 1 || billingDay > 28) {
        throw new Error('Billing day must be between 1 and 28 for monthly billing');
      }
      
      // Add one month
      date.setMonth(date.getMonth() + 1);
      
      // Set to billing day (safe 1-28 range works for all months)
      date.setDate(billingDay);
      break;
      
    default:
      throw new Error(`Invalid billing cycle: ${billingCycle}`);
  }
  
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
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
  const today = new Date();
  return calculateNextBillingDate(today, billingCycle, billingDay);
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
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 * 
 * @returns ISO date string
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format date for display
 * 
 * @param date - Date to format (ISO string or Date)
 * @param format - 'short' | 'long'
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
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
