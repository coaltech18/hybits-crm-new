// ===================================================================
// HYBITS CRM — Tax Export Helper
// Utilities for exporting invoice data with tax breakdown for reports
// ===================================================================

import { Invoice } from '@/services/invoiceService';

export interface TaxExportRow {
  invoice_number: string;
  invoice_date: string; // DD-MM-YYYY format
  customer_name: string;
  customer_gstin?: string;
  item_description: string;
  hsn_code?: string;
  quantity: number;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
}

/**
 * Convert invoice to per-item export rows for GST reporting
 * Each invoice item becomes a separate row with tax breakdown
 */
export function convertInvoiceToExportRows(invoice: Invoice, customerGstin?: string): TaxExportRow[] {
  if (!invoice.items || invoice.items.length === 0) {
    return [];
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return invoice.items.map(item => {
    // Calculate per-item tax breakdown
    const itemTaxable = item.quantity * item.rate;
    const itemTaxAmount = itemTaxable * (item.gst_rate / 100);
    const itemTotal = itemTaxable + itemTaxAmount;

    // Determine tax split based on invoice totals
    const totalTaxableValue = invoice.taxable_value || invoice.subtotal;
    const taxRatio = totalTaxableValue > 0 ? itemTaxable / totalTaxableValue : 0;

    const itemCgst = Math.round((invoice.cgst || 0) * taxRatio * 100) / 100;
    const itemSgst = Math.round((invoice.sgst || 0) * taxRatio * 100) / 100;
    const itemIgst = Math.round((invoice.igst || 0) * taxRatio * 100) / 100;

    return {
      invoice_number: invoice.invoice_number,
      invoice_date: formatDate(invoice.invoice_date),
      customer_name: invoice.customer_name || 'Unknown Customer',
      customer_gstin: customerGstin,
      item_description: item.description,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      rate: item.rate,
      taxable_value: Math.round(itemTaxable * 100) / 100,
      gst_rate: item.gst_rate,
      cgst: itemCgst,
      sgst: itemSgst,
      igst: itemIgst,
      total_amount: Math.round(itemTotal * 100) / 100
    };
  });
}

/**
 * Convert multiple invoices to export rows
 */
export function convertInvoicesToExportRows(invoices: Invoice[], customerGstinMap?: Map<string, string>): TaxExportRow[] {
  const allRows: TaxExportRow[] = [];

  for (const invoice of invoices) {
    const customerGstin = customerGstinMap?.get(invoice.customer_id);
    const rows = convertInvoiceToExportRows(invoice, customerGstin);
    allRows.push(...rows);
  }

  return allRows;
}

/**
 * Generate CSV content from export rows
 */
export function generateTaxExportCsv(rows: TaxExportRow[]): string {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Customer Name',
    'Customer GSTIN',
    'Item Description',
    'HSN/SAC Code',
    'Quantity',
    'Rate',
    'Taxable Value',
    'GST Rate (%)',
    'CGST',
    'SGST',
    'IGST',
    'Total Amount'
  ];

  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const csvRow = [
      `"${row.invoice_number}"`,
      `"${row.invoice_date}"`,
      `"${row.customer_name}"`,
      `"${row.customer_gstin || ''}"`,
      `"${row.item_description}"`,
      `"${row.hsn_code || ''}"`,
      row.quantity.toString(),
      row.rate.toFixed(2),
      row.taxable_value.toFixed(2),
      row.gst_rate.toFixed(2),
      row.cgst.toFixed(2),
      row.sgst.toFixed(2),
      row.igst.toFixed(2),
      row.total_amount.toFixed(2)
    ];
    csvRows.push(csvRow.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Generate summary statistics from export rows
 */
export function generateTaxSummary(rows: TaxExportRow[]) {
  const summary = {
    totalInvoices: new Set(rows.map(r => r.invoice_number)).size,
    totalItems: rows.length,
    totalTaxableValue: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalAmount: 0,
    gstRateBreakdown: new Map<number, { count: number; taxableValue: number; taxAmount: number }>(),
    hsnBreakdown: new Map<string, { count: number; taxableValue: number; taxAmount: number }>()
  };

  for (const row of rows) {
    summary.totalTaxableValue += row.taxable_value;
    summary.totalCgst += row.cgst;
    summary.totalSgst += row.sgst;
    summary.totalIgst += row.igst;
    summary.totalAmount += row.total_amount;

    // GST rate breakdown
    const gstRateKey = row.gst_rate;
    if (!summary.gstRateBreakdown.has(gstRateKey)) {
      summary.gstRateBreakdown.set(gstRateKey, { count: 0, taxableValue: 0, taxAmount: 0 });
    }
    const gstRateData = summary.gstRateBreakdown.get(gstRateKey)!;
    gstRateData.count += 1;
    gstRateData.taxableValue += row.taxable_value;
    gstRateData.taxAmount += row.cgst + row.sgst + row.igst;

    // HSN breakdown
    const hsnKey = row.hsn_code || 'No HSN';
    if (!summary.hsnBreakdown.has(hsnKey)) {
      summary.hsnBreakdown.set(hsnKey, { count: 0, taxableValue: 0, taxAmount: 0 });
    }
    const hsnData = summary.hsnBreakdown.get(hsnKey)!;
    hsnData.count += 1;
    hsnData.taxableValue += row.taxable_value;
    hsnData.taxAmount += row.cgst + row.sgst + row.igst;
  }

  // Round summary totals
  summary.totalTaxableValue = Math.round(summary.totalTaxableValue * 100) / 100;
  summary.totalCgst = Math.round(summary.totalCgst * 100) / 100;
  summary.totalSgst = Math.round(summary.totalSgst * 100) / 100;
  summary.totalIgst = Math.round(summary.totalIgst * 100) / 100;
  summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

  return summary;
}
