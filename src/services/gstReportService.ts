import { supabase } from '@/lib/supabase';
import { toCsv } from '@/utils/csv';
import { roundCurrency } from '@/utils/format';
import { applyOutletFilter, fetchAllRows, getUserRoleAndOutlets } from '@/services/reportService';
import type {
    GSTWorkingReportRow,
    GSTWorkingExportRow,
    GSTWorkingTotalsRow,
    GSTReportFilters,
} from '@/types';

// ================================================================
// GST REPORT SERVICE (PHASE 10)
// ================================================================
// GST Working Reports for Accountants
// Matches accountant's Excel format exactly
// Sheets: Domestic, SEZ, Export
// ================================================================

type GSTView = 'gst_working_domestic' | 'gst_working_sez' | 'gst_working_export';

/**
 * The SEZ and Export views alias the HSN column as `hsn_code`, Domestic as
 * `hsn_sac_code`. Normalise so every sheet reads `hsn_sac_code`.
 */
function normalizeHsn<T extends GSTWorkingReportRow>(row: T & { hsn_code?: string | null }): T {
    return { ...row, hsn_sac_code: row.hsn_sac_code ?? row.hsn_code ?? '' };
}

async function getGSTSheet<T extends GSTWorkingReportRow>(
    view: GSTView,
    userId: string,
    filters: GSTReportFilters
): Promise<T[]> {
    const roleData = await getUserRoleAndOutlets(userId);

    const rows = await fetchAllRows<T & { hsn_code?: string | null }>(() => {
        let query = applyOutletFilter(
            supabase
                .from(view)
                .select('*')
                .order('invoice_date', { ascending: false })
                .order('invoice_id'),
            roleData,
            filters
        );
        if (query === null) return null;

        // Apply date filters
        if (filters.date_from) {
            query = query.gte('invoice_date', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('invoice_date', filters.date_to);
        }

        return query;
    });

    return rows.map(row => normalizeHsn<T>(row));
}

// ================================================================
// SHEETS
// ================================================================

export function getGSTDomesticReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingReportRow[]> {
    return getGSTSheet<GSTWorkingReportRow>('gst_working_domestic', userId, filters);
}

export function getGSTSEZReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingReportRow[]> {
    return getGSTSheet<GSTWorkingReportRow>('gst_working_sez', userId, filters);
}

export function getGSTExportReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingExportRow[]> {
    return getGSTSheet<GSTWorkingExportRow>('gst_working_export', userId, filters);
}

// ================================================================
// TOTALS (computed from the fetched sheet; no second round trip)
// ================================================================

const sum = (rows: GSTWorkingReportRow[], pick: (row: GSTWorkingReportRow) => number) =>
    roundCurrency(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0));

export function computeGSTTotals(
    data: GSTWorkingReportRow[],
    outletId?: string
): GSTWorkingTotalsRow | null {
    if (data.length === 0) return null;

    return {
        outlet_id: outletId || 'all',
        total_taxable_value: sum(data, row => row.taxable_value),
        total_igst: sum(data, row => row.igst),
        total_cgst: sum(data, row => row.cgst),
        total_sgst: sum(data, row => row.sgst),
        grand_total: sum(data, row => row.total),
    };
}

/** RATE cell: the per-invoice label when the view provides one (mixed rates), else the single rate. */
export function formatGSTRate(row: GSTWorkingReportRow): string {
    return row.rate_label || `${row.rate}%`;
}

// ================================================================
// CSV EXPORT FUNCTIONS
// ================================================================
// Match accountant's Excel format EXACTLY. Every cell goes through
// @/utils/csv (quoting + formula-injection neutralising).

/** Amount cell with 2 decimals; negative amounts stay numeric (not neutralised as text). */
const amt = (value: number): string | number => {
    const n = Number(value) || 0;
    return n < 0 ? roundCurrency(n) : n.toFixed(2);
};

function buildGSTCsv<T extends GSTWorkingReportRow>(
    headers: string[],
    data: T[],
    totals: GSTWorkingTotalsRow | null,
    extra?: (row: T) => string
): string {
    const rows: (string | number)[][] = data.map(row => {
        const cells: (string | number)[] = [
            row.invoice_date,
            row.invoice_number,
            row.party_name,
            row.gst_number,
            row.hsn_sac_code,
            amt(row.as_per_your_invoice),
            amt(row.taxable_value),
            formatGSTRate(row),
            amt(row.igst),
            amt(row.cgst),
            amt(row.sgst),
            amt(row.total),
        ];
        if (extra) cells.push(extra(row));
        return cells;
    });

    // Total row
    if (totals) {
        const totalRow: (string | number)[] = [
            '',
            '',
            'Total',
            '',
            '',
            '',
            amt(totals.total_taxable_value),
            '',
            amt(totals.total_igst),
            amt(totals.total_cgst),
            amt(totals.total_sgst),
            amt(totals.grand_total),
        ];
        if (extra) totalRow.push('');
        rows.push(totalRow);
    }

    return toCsv(headers, rows);
}

/**
 * Export Domestic GST Report to CSV
 * Columns: Invoice Date, Invoice Number, Party Name, GST NUMBER,
 *          HSN/SAC CODE, As per your Invoice, Taxable Value, RATE,
 *          IGST, CGST, SGST, TOTAL
 */
export function exportGSTDomesticCSV(
    data: GSTWorkingReportRow[],
    totals: GSTWorkingTotalsRow | null
): string {
    return buildGSTCsv(
        [
            'Invoice Date',
            'Invoice Number',
            'Party Name',
            'GST NUMBER',
            'HSN/SAC CODE',
            'As per your Invoice',
            'Taxable Value',
            'RATE',
            'IGST',
            'CGST',
            'SGST',
            'TOTAL',
        ],
        data,
        totals
    );
}

/**
 * Export SEZ GST Report to CSV
 * Same columns as Domestic
 */
export function exportGSTSEZCSV(
    data: GSTWorkingReportRow[],
    totals: GSTWorkingTotalsRow | null
): string {
    return buildGSTCsv(
        [
            'Invoice Date',
            'Invoice Number',
            'Party Name',
            'GST NUMBER',
            'HSN CODE',
            'As per your Invoice',
            'Taxable Value',
            'RATE',
            'IGST',
            'CGST',
            'SGST',
            'TOTAL',
        ],
        data,
        totals
    );
}

/**
 * Export Export GST Report to CSV
 * Same columns + Currency
 */
export function exportGSTExportCSV(
    data: GSTWorkingExportRow[],
    totals: GSTWorkingTotalsRow | null
): string {
    return buildGSTCsv(
        [
            'Invoice Date',
            'Invoice Number',
            'Party Name',
            'GST NUMBER',
            'HSN CODE',
            'As per your Invoice',
            'Taxable Value',
            'RATE',
            'IGST',
            'CGST',
            'SGST',
            'TOTAL',
            'Currency',
        ],
        data,
        totals,
        row => row.currency
    );
}
