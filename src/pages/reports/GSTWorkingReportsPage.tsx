import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card } from '@/components/ui/Card';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Spinner';
import {
    getGSTDomesticReport,
    getGSTSEZReport,
    getGSTExportReport,
    computeGSTTotals,
    formatGSTRate,
    exportGSTDomesticCSV,
    exportGSTSEZCSV,
    exportGSTExportCSV,
} from '@/services/gstReportService';
import type {
    GSTWorkingReportRow,
    GSTWorkingExportRow,
    GSTWorkingTotalsRow,
    GSTReportFilters,
    Outlet,
} from '@/types';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { todayISO } from '@/utils/date';
import { cn } from '@/utils/cn';
import { useReportLoader } from './useReportLoader';
import { ReportTabs, TabPanel, FigureStrip, Figure, LedgerSheet, ExportButton, LedgerEmpty } from './ReportKit';
import { TFOOT_CELL, fmtCount, fmtDate } from './reportFormat';

// ================================================================
// GST WORKING — one sheet per GST type, in the accountant's Excel
// column order (the CSV matches it exactly). Totals strip above,
// dense ledger below with the totals row in the footer.
// ================================================================

type GSTTabType = 'domestic' | 'sez' | 'export';

const TAB_PREFIX = 'gst';

export default function GSTWorkingReportsPage() {
    useDocumentTitle('GST working');

    const { user, outlets } = useAuth();
    const [activeTab, setActiveTab] = useState<GSTTabType>('domestic');
    const [error, setError] = useState<string | null>(null);

    // Common filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [outletId, setOutletId] = useState('');

    // Available outlets for dropdown
    const availableOutlets: Outlet[] = outlets || [];
    const showOutletFilter = user?.role === 'admin' || user?.role === 'accountant';
    const userId = user?.id || '';
    const failed = Boolean(error);

    const tabs = [
        { id: 'domestic' as const, label: 'Domestic' },
        { id: 'sez' as const, label: 'SEZ' },
        { id: 'export' as const, label: 'Export' },
    ];

    return (
        <div>
            <PageHeader
                title="GST working"
                description="Finalized invoices laid out like the accountant's Excel sheet, one tab per GST type. The CSV matches the columns exactly."
            />

            <div className="space-y-6">
                <ReportTabs tabs={tabs} active={activeTab} onChange={setActiveTab} idPrefix={TAB_PREFIX} label="GST sheet" />

                {/* Common filters */}
                <Card padding="sm">
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                        <div className="w-full sm:w-44">
                            <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                        <div className="w-full sm:w-44">
                            <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                        {showOutletFilter && (
                            <div className="w-full sm:w-56">
                                <Select label="Outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
                                    <option value="">All outlets</option>
                                    {availableOutlets.map((outlet) => (
                                        <option key={outlet.id} value={outlet.id}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>
                </Card>

                {error && (
                    <Alert variant="error">
                        <div className="flex items-start justify-between gap-4">
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                className="shrink-0 rounded font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                            >
                                Dismiss
                            </button>
                        </div>
                    </Alert>
                )}

                {userId && (
                    <TabPanel idPrefix={TAB_PREFIX} active={activeTab}>
                        {activeTab === 'domestic' && (
                            <GSTDomesticTab
                                userId={userId}
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                                outletId={outletId}
                                setError={setError}
                                failed={failed}
                            />
                        )}

                        {activeTab === 'sez' && (
                            <GSTSEZTab
                                userId={userId}
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                                outletId={outletId}
                                setError={setError}
                                failed={failed}
                            />
                        )}

                        {activeTab === 'export' && (
                            <GSTExportTab
                                userId={userId}
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                                outletId={outletId}
                                setError={setError}
                                failed={failed}
                            />
                        )}
                    </TabPanel>
                )}
            </div>
        </div>
    );
}

// ================================================================
// TAB PROPS INTERFACE
// ================================================================

interface GSTTabProps {
    userId: string;
    dateFrom: string;
    dateTo: string;
    outletId: string;
    setError: (v: string | null) => void;
    /** Presentation only: lets the empty state say the sheet failed rather than "no data". */
    failed: boolean;
}

/** Loads one GST sheet with a stale-response guard, plus its totals row. */
function useGSTSheet<T extends GSTWorkingReportRow>(
    fetchSheet: (userId: string, filters: GSTReportFilters) => Promise<T[]>,
    { userId, dateFrom, dateTo, outletId, setError }: GSTTabProps
) {
    const loader = useCallback(
        () =>
            fetchSheet(userId, {
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                outlet_id: outletId || undefined,
            }),
        [fetchSheet, userId, dateFrom, dateTo, outletId]
    );
    const { data, loading } = useReportLoader<T[]>(loader, [], setError);
    const totals = useMemo(() => computeGSTTotals(data, outletId || undefined), [data, outletId]);
    return { data, loading, totals };
}

// ================================================================
// SHARED SHEET (strip + ledger), identical for all three GST types
// ================================================================

function GSTSheet<T extends GSTWorkingReportRow>({
    sheetId,
    title,
    hsnLabel,
    data,
    loading,
    totals,
    failed,
    emptyTitle,
    emptyDescription,
    onExport,
    currency,
}: {
    sheetId: string;
    title: string;
    hsnLabel: string;
    data: T[];
    loading: boolean;
    totals: GSTWorkingTotalsRow | null;
    failed: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onExport: () => void;
    /** Export sheet only: the trailing Currency column. */
    currency?: (row: T) => string;
}) {
    const withCurrency = Boolean(currency);
    const num = (n: number | undefined) => formatCurrency(n ?? 0);

    return (
        <>
            <FigureStrip label={`${title} totals`} className="grid-cols-2 lg:grid-cols-4">
                <Figure label="Taxable value" big loading={loading} className="col-span-2 lg:col-span-4">
                    {num(totals?.total_taxable_value)}
                </Figure>
                <Figure label="IGST" loading={loading}>
                    {num(totals?.total_igst)}
                </Figure>
                <Figure label="CGST" loading={loading}>
                    {num(totals?.total_cgst)}
                </Figure>
                <Figure label="SGST" loading={loading}>
                    {num(totals?.total_sgst)}
                </Figure>
                <Figure label="Total" loading={loading}>
                    {num(totals?.grand_total)}
                </Figure>
            </FigureStrip>

            <LedgerSheet
                id={`${sheetId}-ledger-h`}
                title={title}
                summary={loading ? 'Loading…' : `${fmtCount(data.length)} ${data.length === 1 ? 'invoice' : 'invoices'}`}
                tools={<ExportButton label="Download CSV" onClick={onExport} disabled={loading || data.length === 0} />}
            >
                {loading ? (
                    <TableSkeleton rows={6} cols={8} />
                ) : data.length === 0 ? (
                    <LedgerEmpty failed={failed} title={emptyTitle} description={emptyDescription} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="ledger">
                            <thead>
                                <tr>
                                    <th scope="col">Invoice date</th>
                                    <th scope="col">Invoice no.</th>
                                    <th scope="col">Party name</th>
                                    <th scope="col">GSTIN</th>
                                    <th scope="col">{hsnLabel}</th>
                                    <th scope="col" className="text-right">As per invoice</th>
                                    <th scope="col" className="text-right">Taxable value</th>
                                    <th scope="col" className="text-right">Rate</th>
                                    <th scope="col" className="text-right">IGST</th>
                                    <th scope="col" className="text-right">CGST</th>
                                    <th scope="col" className="text-right">SGST</th>
                                    <th scope="col" className="text-right">Total</th>
                                    {withCurrency && <th scope="col">Currency</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.invoice_id}>
                                        <td className="whitespace-nowrap text-ink-muted">{fmtDate(row.invoice_date)}</td>
                                        <td className="whitespace-nowrap">
                                            <Link
                                                to={`/invoices/${row.invoice_id}`}
                                                className="serial font-semibold text-ink hover:text-brand-primary"
                                            >
                                                {row.invoice_number}
                                            </Link>
                                        </td>
                                        <td className="max-w-[16rem] truncate">{row.party_name}</td>
                                        <td className="whitespace-nowrap">
                                            {row.gst_number ? <span className="serial">{row.gst_number}</span> : <span className="text-ink-faint">—</span>}
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {row.hsn_sac_code ? <span className="serial">{row.hsn_sac_code}</span> : <span className="text-ink-faint">—</span>}
                                        </td>
                                        <td className="amount text-right">{formatCurrency(row.as_per_your_invoice)}</td>
                                        <td className="amount text-right">{formatCurrency(row.taxable_value)}</td>
                                        <td className={cn('amount text-right', row.rate_label && 'font-semibold text-ink')}>
                                            {formatGSTRate(row)}
                                        </td>
                                        <td className="amount text-right">{formatCurrency(row.igst)}</td>
                                        <td className="amount text-right">{formatCurrency(row.cgst)}</td>
                                        <td className="amount text-right">{formatCurrency(row.sgst)}</td>
                                        <td className="amount text-right font-semibold">{formatCurrency(row.total)}</td>
                                        {currency && <td className="serial">{currency(row)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                            {totals && (
                                <tfoot>
                                    <tr>
                                        <th scope="row" colSpan={6} className={cn(TFOOT_CELL, 'text-left')}>
                                            Total
                                        </th>
                                        <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.total_taxable_value)}</td>
                                        <td className={TFOOT_CELL} />
                                        <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.total_igst)}</td>
                                        <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.total_cgst)}</td>
                                        <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.total_sgst)}</td>
                                        <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.grand_total)}</td>
                                        {withCurrency && <td className={TFOOT_CELL} />}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </LedgerSheet>
        </>
    );
}

// ================================================================
// DOMESTIC GST TAB
// ================================================================

function GSTDomesticTab(props: GSTTabProps) {
    const { data, loading, totals } = useGSTSheet<GSTWorkingReportRow>(getGSTDomesticReport, props);

    function handleExport() {
        downloadCsv(`gst_working_domestic_${todayISO()}.csv`, exportGSTDomesticCSV(data, totals));
    }

    return (
        <GSTSheet
            sheetId="gst-domestic"
            title="Domestic GST working"
            hsnLabel="HSN/SAC"
            data={data}
            loading={loading}
            totals={totals}
            failed={props.failed}
            emptyTitle="No domestic invoices in this period"
            emptyDescription="No finalized invoices for Domestic or blank-GST-type clients in this period."
            onExport={handleExport}
        />
    );
}

// ================================================================
// SEZ GST TAB
// ================================================================

function GSTSEZTab(props: GSTTabProps) {
    const { data, loading, totals } = useGSTSheet<GSTWorkingReportRow>(getGSTSEZReport, props);

    function handleExport() {
        downloadCsv(`gst_working_sez_${todayISO()}.csv`, exportGSTSEZCSV(data, totals));
    }

    return (
        <GSTSheet
            sheetId="gst-sez"
            title="SEZ GST working"
            hsnLabel="HSN"
            data={data}
            loading={loading}
            totals={totals}
            failed={props.failed}
            emptyTitle="No SEZ invoices in this period"
            emptyDescription="Only clients whose GST type is set to SEZ appear on this sheet."
            onExport={handleExport}
        />
    );
}

// ================================================================
// EXPORT GST TAB
// ================================================================

function GSTExportTab(props: GSTTabProps) {
    const { data, loading, totals } = useGSTSheet<GSTWorkingExportRow>(getGSTExportReport, props);

    function handleExport() {
        downloadCsv(`gst_working_export_${todayISO()}.csv`, exportGSTExportCSV(data, totals));
    }

    return (
        <GSTSheet
            sheetId="gst-export"
            title="Export GST working"
            hsnLabel="HSN"
            data={data}
            loading={loading}
            totals={totals}
            failed={props.failed}
            emptyTitle="No export invoices in this period"
            emptyDescription="Only clients whose GST type is set to Export appear on this sheet."
            onExport={handleExport}
            currency={(row) => row.currency}
        />
    );
}
