import type { ClientGstType, InvoiceStatus } from '@/types';
import { roundCurrency } from '@/utils/format';

// ================================================================
// DISPLAY HELPERS for the invoice pages. Presentation only: the
// stored invoice values stay authoritative.
// ================================================================

/** SEZ and export supplies carry IGST; everything else splits CGST + SGST. */
export function isIgstSupply(gstType: ClientGstType | null | undefined): boolean {
  return gstType === 'sez' || gstType === 'export';
}

/**
 * GST split of a stored tax total, mirroring invoicePdfGenerator so the
 * screen and the PDF always agree: CGST is half, SGST is the remainder.
 */
export function gstBreakup(taxTotal: number, gstType: ClientGstType | null | undefined) {
  if (isIgstSupply(gstType)) return { igst: true as const, cgst: 0, sgst: 0, igstAmount: taxTotal };
  const cgst = roundCurrency(taxTotal / 2);
  return { igst: false as const, cgst, sgst: roundCurrency(taxTotal - cgst), igstAmount: 0 };
}

export function gstTypeLabel(gstType: ClientGstType | null | undefined): string {
  if (gstType === 'sez') return 'SEZ supply';
  if (gstType === 'export') return 'Export';
  return 'Domestic';
}

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  subscription: 'Subscription',
  event: 'Event',
};

/** Statuses where the invoice is a bill the client owes against. */
export const BILLED_STATUSES: InvoiceStatus[] = ['finalized', 'partially_paid', 'paid'];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
};

/** Shown in place of the sequence number, which the database assigns on save. */
export const INVOICE_SEQUENCE_PLACEHOLDER = '····';

/**
 * Number preview for an unsaved invoice. Mirrors the database's
 * invoice_number_prefix (042_bug_fixes.sql): the date and financial year
 * follow the invoice's own date (FY starts in April), the outlet code
 * comes from the chosen outlet, and the sequence is left as a placeholder
 * because only the database can allocate it. Presentation only.
 */
export function invoiceNumberPrefixPreview(
  format: string | null | undefined,
  outletCode: string | null | undefined,
  invoiceDateISO: string
): string {
  const [y, m, d] = invoiceDateISO.slice(0, 10).split('-').map(Number);
  const year = y || new Date().getFullYear();
  const month = m || 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
  const code = outletCode || 'OUTLET';
  switch (format || 'default') {
    case 'outlet_fy':
      return `INV/${code}/${fy}/`;
    case 'outlet_short':
      return `INV-${code}-`;
    case 'fy_only':
      return `INV/${fy}/`;
    default:
      return `INV-${year}${String(month).padStart(2, '0')}${String(d || 1).padStart(2, '0')}-`;
  }
}
