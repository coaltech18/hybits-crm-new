import type { CSSProperties } from 'react';
import { formatCurrency, roundCurrency } from '@/utils/format';
import { parseLocalISODate } from '@/utils/date';

// ================================================================
// Report presentation helpers (formatting + chart theme).
// Pure display: nothing here changes a figure, only how it reads.
// ================================================================

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** YYYY-MM-DD → "05 Oct 2026". Anything else is shown as it came. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  if (!ISO_DATE.test(iso)) return iso;
  return parseLocalISODate(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Chart tick: YYYY-MM-DD → "05 Oct"; non-dates (outlet names) pass through. */
export function fmtTickDate(value: unknown): string {
  const s = String(value ?? '');
  if (!ISO_DATE.test(s)) return s;
  return parseLocalISODate(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const COUNT = new Intl.NumberFormat('en-IN');
export const fmtCount = (n: number) => COUNT.format(n);

const COMPACT_INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
/** Axis ticks only: ₹1.2L, ₹45K. Exact figures live in the tooltip and the ledger. */
export const fmtCompactInr = (value: unknown) => COMPACT_INR.format(Number(value) || 0);

/** Tooltip values: exact INR. */
export const fmtTooltipInr = (value: unknown) =>
  value === undefined || value === null ? '—' : formatCurrency(Number(value));

/** Sum a money column for a totals row, rounded like the strip totals. */
export const sumMoney = <T,>(rows: T[], pick: (row: T) => number) =>
  roundCurrency(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0));

export const sumCount = <T,>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);

// ---------------- chart theme (token values) ----------------

export const CHART = {
  primary: '#1B7F65',
  compare: '#1E5AA8', // info blue: stamp violet is reserved for PAID
  rule: '#D5DFDA',
  text: '#4A5E57',
  ink: '#14231E',
  sunk: '#EBF0ED',
  sheet: '#FFFFFF',
  partial: '#9A4A00',
  overdue: '#8A1C33',
};

/** Categorical order for part-to-whole (payment methods). */
export const CHART_CATEGORICAL = ['#1B7F65', '#1E5AA8', '#9A4A00', '#6B5200', '#8A1C33', '#5D6763'];

export const axisTick = { fill: CHART.text, fontSize: 13 };

export const xAxisProps = {
  stroke: CHART.rule,
  tick: axisTick,
  tickLine: false,
  tickMargin: 8,
  minTickGap: 16,
};

export const yAxisProps = {
  stroke: CHART.rule,
  tick: axisTick,
  tickLine: false,
  axisLine: false,
  width: 72,
  tickFormatter: fmtCompactInr,
};

export const gridProps = { stroke: CHART.rule, vertical: false };

const tooltipContent: CSSProperties = {
  border: `1px solid ${CHART.rule}`,
  borderRadius: 8,
  boxShadow: '0 8px 24px -6px rgba(15, 61, 49, 0.18)',
  fontSize: 13,
  padding: '8px 12px',
};

export const tooltipProps = {
  formatter: fmtTooltipInr,
  contentStyle: tooltipContent,
  labelStyle: { color: CHART.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { fontVariantNumeric: 'tabular-nums', padding: 0 } as CSSProperties,
  cursor: { fill: CHART.sunk },
};

export const legendProps = {
  iconType: 'square' as const,
  iconSize: 10,
  wrapperStyle: { fontSize: 13, color: CHART.text, paddingTop: 8 },
};

/** Totals row cell for a ledger's <tfoot>. */
export const TFOOT_CELL = 'border-t-2 border-rule-strong bg-paper-sunk px-4 py-3 font-bold text-ink';
