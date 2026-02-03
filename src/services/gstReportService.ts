import { supabase } from '@/lib/supabase';
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

/**
 * Get user role and assigned outlets (for managers)
 */
async function getUserRoleAndOutlets(userId: string): Promise<{
    role: string;
    outletIds: string[] | null;
}> {
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (!profile) {
        throw new Error('User profile not found');
    }

    // Managers: Get assigned outlets
    if (profile.role === 'manager') {
        const { data: assignments } = await supabase
            .from('user_outlet_assignments')
            .select('outlet_id')
            .eq('user_id', userId);

        const outletIds = assignments?.map(a => a.outlet_id) || [];
        return { role: profile.role, outletIds };
    }

    // Admin/Accountant: All outlets
    return { role: profile.role, outletIds: null };
}

/**
 * Apply outlet filter based on role
 */
function applyOutletFilter(
    query: any,
    roleData: { role: string; outletIds: string[] | null },
    filters: GSTReportFilters
) {
    // Manager: Filter by assigned outlets
    if (roleData.role === 'manager' && roleData.outletIds) {
        if (roleData.outletIds.length > 0) {
            query = query.in('outlet_id', roleData.outletIds);
        } else {
            // No outlets assigned, return empty result
            return null;
        }
    }

    // Admin/Accountant with outlet filter
    if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
        query = query.eq('outlet_id', filters.outlet_id);
    }

    return query;
}

// ================================================================
// DOMESTIC GST REPORT
// ================================================================

export async function getGSTDomesticReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingReportRow[]> {
    const roleData = await getUserRoleAndOutlets(userId);

    let query = supabase
        .from('gst_working_domestic')
        .select('*')
        .order('invoice_date', { ascending: false });

    // Apply outlet filter
    query = applyOutletFilter(query, roleData, filters);
    if (query === null) return [];

    // Apply date filters
    if (filters.date_from) {
        query = query.gte('invoice_date', filters.date_from);
    }
    if (filters.date_to) {
        query = query.lte('invoice_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as GSTWorkingReportRow[];
}

export async function getGSTDomesticTotals(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingTotalsRow | null> {
    const data = await getGSTDomesticReport(userId, filters);

    if (data.length === 0) return null;

    return {
        outlet_id: filters.outlet_id || 'all',
        total_taxable_value: data.reduce((sum, row) => sum + row.taxable_value, 0),
        total_igst: data.reduce((sum, row) => sum + row.igst, 0),
        total_cgst: data.reduce((sum, row) => sum + row.cgst, 0),
        total_sgst: data.reduce((sum, row) => sum + row.sgst, 0),
        grand_total: data.reduce((sum, row) => sum + row.total, 0),
    };
}

// ================================================================
// SEZ GST REPORT
// ================================================================

export async function getGSTSEZReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingReportRow[]> {
    const roleData = await getUserRoleAndOutlets(userId);

    let query = supabase
        .from('gst_working_sez')
        .select('*')
        .order('invoice_date', { ascending: false });

    // Apply outlet filter
    query = applyOutletFilter(query, roleData, filters);
    if (query === null) return [];

    // Apply date filters
    if (filters.date_from) {
        query = query.gte('invoice_date', filters.date_from);
    }
    if (filters.date_to) {
        query = query.lte('invoice_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as GSTWorkingReportRow[];
}

export async function getGSTSEZTotals(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingTotalsRow | null> {
    const data = await getGSTSEZReport(userId, filters);

    if (data.length === 0) return null;

    return {
        outlet_id: filters.outlet_id || 'all',
        total_taxable_value: data.reduce((sum, row) => sum + row.taxable_value, 0),
        total_igst: data.reduce((sum, row) => sum + row.igst, 0),
        total_cgst: data.reduce((sum, row) => sum + row.cgst, 0),
        total_sgst: data.reduce((sum, row) => sum + row.sgst, 0),
        grand_total: data.reduce((sum, row) => sum + row.total, 0),
    };
}

// ================================================================
// EXPORT GST REPORT
// ================================================================

export async function getGSTExportReport(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingExportRow[]> {
    const roleData = await getUserRoleAndOutlets(userId);

    let query = supabase
        .from('gst_working_export')
        .select('*')
        .order('invoice_date', { ascending: false });

    // Apply outlet filter
    query = applyOutletFilter(query, roleData, filters);
    if (query === null) return [];

    // Apply date filters
    if (filters.date_from) {
        query = query.gte('invoice_date', filters.date_from);
    }
    if (filters.date_to) {
        query = query.lte('invoice_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return (data || []) as GSTWorkingExportRow[];
}

export async function getGSTExportTotals(
    userId: string,
    filters: GSTReportFilters
): Promise<GSTWorkingTotalsRow | null> {
    const data = await getGSTExportReport(userId, filters);

    if (data.length === 0) return null;

    return {
        outlet_id: filters.outlet_id || 'all',
        total_taxable_value: data.reduce((sum, row) => sum + row.taxable_value, 0),
        total_igst: data.reduce((sum, row) => sum + row.igst, 0),
        total_cgst: data.reduce((sum, row) => sum + row.cgst, 0),
        total_sgst: data.reduce((sum, row) => sum + row.sgst, 0),
        grand_total: data.reduce((sum, row) => sum + row.total, 0),
    };
}

// ================================================================
// CSV EXPORT FUNCTIONS
// ================================================================
// Match accountant's Excel format EXACTLY

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
    // Headers matching Excel exactly
    const headers = [
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
    ];

    // Data rows
    const rows = data.map(row => [
        row.invoice_date,
        row.invoice_number,
        `"${row.party_name.replace(/"/g, '""')}"`, // Escape quotes
        row.gst_number,
        row.hsn_sac_code,
        row.as_per_your_invoice.toFixed(2),
        row.taxable_value.toFixed(2),
        `${row.rate}%`,
        row.igst.toFixed(2),
        row.cgst.toFixed(2),
        row.sgst.toFixed(2),
        row.total.toFixed(2),
    ]);

    // Total row
    if (totals) {
        rows.push([
            '',
            '',
            'Total',
            '',
            '',
            '',
            totals.total_taxable_value.toFixed(2),
            '',
            totals.total_igst.toFixed(2),
            totals.total_cgst.toFixed(2),
            totals.total_sgst.toFixed(2),
            totals.grand_total.toFixed(2),
        ]);
    }

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Export SEZ GST Report to CSV
 * Same columns as Domestic
 */
export function exportGSTSEZCSV(
    data: GSTWorkingReportRow[],
    totals: GSTWorkingTotalsRow | null
): string {
    // Headers matching Excel exactly
    const headers = [
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
    ];

    // Data rows
    const rows = data.map(row => [
        row.invoice_date,
        row.invoice_number,
        `"${row.party_name.replace(/"/g, '""')}"`,
        row.gst_number,
        row.hsn_sac_code,
        row.as_per_your_invoice.toFixed(2),
        row.taxable_value.toFixed(2),
        `${row.rate}%`,
        row.igst.toFixed(2),
        row.cgst.toFixed(2),
        row.sgst.toFixed(2),
        row.total.toFixed(2),
    ]);

    // Total row
    if (totals) {
        rows.push([
            '',
            '',
            'Total',
            '',
            '',
            '',
            totals.total_taxable_value.toFixed(2),
            '',
            totals.total_igst.toFixed(2),
            totals.total_cgst.toFixed(2),
            totals.total_sgst.toFixed(2),
            totals.grand_total.toFixed(2),
        ]);
    }

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Export Export GST Report to CSV
 * Same columns + Currency
 */
export function exportGSTExportCSV(
    data: GSTWorkingExportRow[],
    totals: GSTWorkingTotalsRow | null
): string {
    // Headers matching Excel exactly
    const headers = [
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
    ];

    // Data rows
    const rows = data.map(row => [
        row.invoice_date,
        row.invoice_number,
        `"${row.party_name.replace(/"/g, '""')}"`,
        row.gst_number,
        row.hsn_sac_code,
        row.as_per_your_invoice.toFixed(2),
        row.taxable_value.toFixed(2),
        `${row.rate}%`,
        row.igst.toFixed(2),
        row.cgst.toFixed(2),
        row.sgst.toFixed(2),
        row.total.toFixed(2),
        row.currency,
    ]);

    // Total row
    if (totals) {
        rows.push([
            '',
            '',
            'Total',
            '',
            '',
            '',
            totals.total_taxable_value.toFixed(2),
            '',
            totals.total_igst.toFixed(2),
            totals.total_cgst.toFixed(2),
            totals.total_sgst.toFixed(2),
            totals.grand_total.toFixed(2),
            '',
        ]);
    }

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
