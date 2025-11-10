// ============================================================================
// GST REPORT SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export type RegionType = 'Domestic' | 'SEZ' | 'Export';
export type RowType = 'invoice' | 'credit_note';

export interface GSTReportRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string; // ISO date
  customer_name: string;
  gst_number: string | null;
  hsn_code: string | null;
  taxable_value: number;
  tax_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  invoice_type: RowType;
  region_type: RegionType;
}

export interface GSTReportGroupedResult {
  Domestic: GSTReportRow[];
  SEZ: GSTReportRow[];
  Export: GSTReportRow[];
}

function to2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export class GSTReportService {
  static async getGSTReport(month: number, year: number): Promise<GSTReportGroupedResult> {
    // Read from final view (amounts already signed for credit notes)
    const { data, error } = await supabase
      .from('gst_reports_final')
      .select('*')
      .order('invoice_date', { ascending: true });

    if (error) {
      console.error('Error fetching GST report:', error);
      throw new Error(error.message || 'Failed to fetch GST report');
    }

    const rows: GSTReportRow[] = (data || [])
      .filter((r: any) => {
        if (!r.invoice_date) return false;
        const d = new Date(r.invoice_date);
        return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month;
      })
      .map((r: any) => {
        const documentType = (r.document_type || '').toLowerCase();
        const invoiceType: RowType = documentType.includes('credit') ? 'credit_note' : 'invoice';
        // Normalize region bucket to three groups as per accountant format
        const rawRegion: string = r.region_type || 'Domestic';
        const normalizedRegion: RegionType = (rawRegion === 'SEZ') ? 'SEZ' : (rawRegion === 'Export' || rawRegion === 'Interstate') ? 'Export' : 'Domestic';
        return {
          invoice_id: r.invoice_id,
          invoice_number: r.invoice_number,
          invoice_date: r.invoice_date,
          customer_name: r.customer_name,
          gst_number: r.gst_number ?? null,
          hsn_code: r.hsn_code ?? null,
          taxable_value: to2(Number(r.taxable_value || 0)),
          tax_rate: to2(Number(r.tax_rate || 0)),
          cgst: to2(Number(r.cgst || 0)),
          sgst: to2(Number(r.sgst || 0)),
          igst: to2(Number(r.igst || 0)),
          total_amount: to2(Number(r.grand_total || 0)),
          invoice_type: invoiceType,
          region_type: normalizedRegion,
        } as GSTReportRow;
      });

    return {
      Domestic: rows.filter(r => r.region_type === 'Domestic'),
      SEZ: rows.filter(r => r.region_type === 'SEZ'),
      Export: rows.filter(r => r.region_type === 'Export'),
    };
  }
}


