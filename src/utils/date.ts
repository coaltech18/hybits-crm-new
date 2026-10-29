// ================================================================
// LOCAL CALENDAR DATES
// ================================================================
// `new Date().toISOString().split('T')[0]` gives the UTC date, which is
// yesterday in India before 05:30 IST. Use these for every YYYY-MM-DD.
// ================================================================

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toLocalISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as YYYY-MM-DD. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}

/** Parse YYYY-MM-DD as a LOCAL date (new Date('2026-10-23') would be UTC midnight). */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** First day of the current local month as YYYY-MM-DD. */
export function startOfMonthISO(d: Date = new Date()): string {
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Local date `days` from `from` (negative for past) as YYYY-MM-DD. */
export function addDaysISO(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return toLocalISODate(d);
}

/** Whole days from `iso` (YYYY-MM-DD or timestamp) until today, local. */
export function daysSince(iso: string): number {
  const then = parseLocalISODate(iso);
  const now = parseLocalISODate(todayISO());
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

if (import.meta.env?.DEV) {
  const d = new Date(2026, 0, 5, 0, 30); // 00:30 local
  console.assert(toLocalISODate(d) === '2026-01-05', 'toLocalISODate uses local calendar');
  console.assert(parseLocalISODate('2026-01-05').getDate() === 5, 'parseLocalISODate is local');
  console.assert(addDaysISO(-5, d) === '2025-12-31', 'addDaysISO crosses year');
}
