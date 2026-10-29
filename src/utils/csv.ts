// ================================================================
// SAFE CSV
// ================================================================
// Every export goes through here: RFC 4180 quoting, plus formula-injection
// neutralising (a cell starting with = + - @ tab or CR gets a leading ').
// Numbers stay numbers; only strings are neutralised, so negative amounts
// exported as numbers are untouched.
// ================================================================

type Cell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Rows of objects → CSV using the given column order. */
export function objectsToCsv<T extends Record<string, Cell>>(rows: T[], columns?: (keyof T & string)[]): string {
  const cols = columns ?? (rows[0] ? (Object.keys(rows[0]) as (keyof T & string)[]) : []);
  return toCsv(cols, rows.map((r) => cols.map((c) => r[c])));
}

/** Trigger a download; BOM so Excel reads ₹ and Indian names as UTF-8. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (import.meta.env?.DEV) {
  console.assert(csvCell('=HYPERLINK("x")') === `"'=HYPERLINK(""x"")"`, 'formula neutralised + quoted');
  console.assert(csvCell('Acme, Pvt') === '"Acme, Pvt"', 'comma quoted');
  console.assert(csvCell(-120.5) === '-120.5', 'numbers untouched');
  console.assert(csvCell('-5 plates') === "'-5 plates", 'leading minus string neutralised');
}
