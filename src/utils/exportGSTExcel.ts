// ============================================================================
// GST REPORT EXCEL EXPORT
// ============================================================================

import * as XLSX from 'xlsx';

import { GSTReportGroupedResult, GSTReportRow } from '@/services/gstReportService';

function toINR(n: number): string {
  return typeof n === 'number' ? n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '0.00';
}

function sectionSheetRows(title: string, rows: GSTReportRow[]): any[][] {
  const header = [
    'Invoice Date', 'Invoice No', 'Party Name', 'GST No', 'HSN Code',
    'As per Invoice', 'Taxable Value', 'Rate', 'IGST', 'CGST', 'SGST', 'Total'
  ];

  const dataRows = rows.map(r => [
    r.invoice_date,
    r.invoice_number,
    r.customer_name,
    r.gst_number || '',
    r.hsn_code || '',
    toINR(r.total_amount),
    toINR(r.taxable_value),
    r.tax_rate,
    toINR(r.igst),
    toINR(r.cgst),
    toINR(r.sgst),
    toINR(r.total_amount),
  ]);

  const totals = rows.reduce((acc, r) => {
    acc.taxable += r.taxable_value;
    acc.igst += r.igst;
    acc.cgst += r.cgst;
    acc.sgst += r.sgst;
    acc.total += r.total_amount;
    return acc;
  }, { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0 });

  const totalRow = ['Totals', '', '', '', '', toINR(totals.total), toINR(totals.taxable), '', toINR(totals.igst), toINR(totals.cgst), toINR(totals.sgst), toINR(totals.total)];

  return [[title], header, ...dataRows, [], totalRow, []];
}

export function exportGSTExcel(month: number, year: number, grouped: GSTReportGroupedResult) {
  const wb = XLSX.utils.book_new();

  // One sheet with all three sections
  const wsRows: any[][] = [];
  wsRows.push(...sectionSheetRows('Domestic', grouped.Domestic.filter(r => r.invoice_type === 'invoice')));
  wsRows.push(...sectionSheetRows('Domestic - Credit Notes', grouped.Domestic.filter(r => r.invoice_type === 'credit_note')));

  wsRows.push(...sectionSheetRows('SEZ', grouped.SEZ.filter(r => r.invoice_type === 'invoice')));
  wsRows.push(...sectionSheetRows('SEZ - Credit Notes', grouped.SEZ.filter(r => r.invoice_type === 'credit_note')));

  wsRows.push(...sectionSheetRows('Export', grouped.Export.filter(r => r.invoice_type === 'invoice')));
  wsRows.push(...sectionSheetRows('Export - Credit Notes', grouped.Export.filter(r => r.invoice_type === 'credit_note')));

  const ws = XLSX.utils.aoa_to_sheet(wsRows);
  XLSX.utils.book_append_sheet(wb, ws, 'GST Summary');

  const fileName = `GST_Summary_${year}-${String(month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}


