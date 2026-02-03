import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
    getGSTDomesticReport,
    getGSTDomesticTotals,
    getGSTSEZReport,
    getGSTSEZTotals,
    getGSTExportReport,
    getGSTExportTotals,
    exportGSTDomesticCSV,
    exportGSTSEZCSV,
    exportGSTExportCSV,
} from '@/services/gstReportService';
import type {
    GSTWorkingReportRow,
    GSTWorkingExportRow,
    GSTWorkingTotalsRow,
    Outlet,
} from '@/types';
import { formatCurrency } from '@/utils/format';

type GSTTabType = 'domestic' | 'sez' | 'export';

export default function GSTWorkingReportsPage() {
    const { user, outlets } = useAuth();
    const [activeTab, setActiveTab] = useState<GSTTabType>('domestic');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Common filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [outletId, setOutletId] = useState('');

    // Available outlets for dropdown
    const availableOutlets: Outlet[] = outlets || [];
    const showOutletFilter = user?.role === 'admin' || user?.role === 'accountant';

    const tabs = [
        { id: 'domestic' as const, label: 'Domestic' },
        { id: 'sez' as const, label: 'SEZ' },
        { id: 'export' as const, label: 'Export' },
    ];

    function downloadCSV(content: string, filename: string) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-brand-primary" />
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">GST Working Reports</h1>
                    <p className="text-sm text-brand-text/60">
                        Download GST reports matching accountant's Excel format
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <Alert variant="error">
                    <div className="flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                            Dismiss
                        </button>
                    </div>
                </Alert>
            )}

            {/* Tabs */}
            <div className="border-b border-brand-border">
                <nav className="flex gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-brand-primary text-brand-primary'
                                : 'border-transparent text-brand-text/60 hover:text-brand-text'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Common Filters */}
            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                        type="date"
                        label="From Date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <Input
                        type="date"
                        label="To Date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                    {showOutletFilter && (
                        <Select
                            label="Outlet"
                            value={outletId}
                            onChange={(e) => setOutletId(e.target.value)}
                        >
                            <option value="">All Outlets</option>
                            {availableOutlets.map((outlet) => (
                                <option key={outlet.id} value={outlet.id}>
                                    {outlet.name}
                                </option>
                            ))}
                        </Select>
                    )}
                </div>
            </Card>

            {/* Tab Content */}
            {activeTab === 'domestic' && (
                <GSTDomesticTab
                    userId={user?.id || ''}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    outletId={outletId}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    downloadCSV={downloadCSV}
                />
            )}

            {activeTab === 'sez' && (
                <GSTSEZTab
                    userId={user?.id || ''}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    outletId={outletId}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    downloadCSV={downloadCSV}
                />
            )}

            {activeTab === 'export' && (
                <GSTExportTab
                    userId={user?.id || ''}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    outletId={outletId}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    downloadCSV={downloadCSV}
                />
            )}
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
    loading: boolean;
    setLoading: (v: boolean) => void;
    setError: (v: string | null) => void;
    downloadCSV: (content: string, filename: string) => void;
}

// ================================================================
// DOMESTIC GST TAB
// ================================================================

function GSTDomesticTab({
    userId,
    dateFrom,
    dateTo,
    outletId,
    loading,
    setLoading,
    setError,
    downloadCSV,
}: GSTTabProps) {
    const [data, setData] = useState<GSTWorkingReportRow[]>([]);
    const [totals, setTotals] = useState<GSTWorkingTotalsRow | null>(null);

    const filters = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        outlet_id: outletId || undefined,
    };

    useEffect(() => {
        loadData();
    }, [dateFrom, dateTo, outletId]);

    async function loadData() {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const [reportData, totalsData] = await Promise.all([
                getGSTDomesticReport(userId, filters),
                getGSTDomesticTotals(userId, filters),
            ]);
            setData(reportData);
            setTotals(totalsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load domestic GST report');
        } finally {
            setLoading(false);
        }
    }

    function handleExport() {
        const csv = exportGSTDomesticCSV(data, totals);
        const dateStr = new Date().toISOString().split('T')[0];
        downloadCSV(csv, `gst_working_domestic_${dateStr}.csv`);
    }

    return (
        <>
            {/* Export Button */}
            <div className="flex justify-end">
                <Button onClick={handleExport} disabled={loading || data.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                </Button>
            </div>

            {/* Data Table */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Domestic GST Working</h3>
                {loading ? (
                    <p className="text-center py-8">Loading...</p>
                ) : data.length === 0 ? (
                    <p className="text-center text-brand-text/60 py-8">
                        No domestic GST data found. Ensure clients have GST Type set to "Domestic".
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-brand-surface">
                                <tr>
                                    <th className="text-left py-2 px-2">Invoice Date</th>
                                    <th className="text-left py-2 px-2">Invoice Number</th>
                                    <th className="text-left py-2 px-2">Party Name</th>
                                    <th className="text-left py-2 px-2">GST NUMBER</th>
                                    <th className="text-left py-2 px-2">HSN/SAC CODE</th>
                                    <th className="text-right py-2 px-2">As per your Invoice</th>
                                    <th className="text-right py-2 px-2">Taxable Value</th>
                                    <th className="text-right py-2 px-2">RATE</th>
                                    <th className="text-right py-2 px-2">IGST</th>
                                    <th className="text-right py-2 px-2">CGST</th>
                                    <th className="text-right py-2 px-2">SGST</th>
                                    <th className="text-right py-2 px-2">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.invoice_id} className="border-b hover:bg-brand-surface/50">
                                        <td className="py-2 px-2">{row.invoice_date}</td>
                                        <td className="py-2 px-2 font-medium">{row.invoice_number}</td>
                                        <td className="py-2 px-2">{row.party_name}</td>
                                        <td className="py-2 px-2">{row.gst_number || '-'}</td>
                                        <td className="py-2 px-2">{row.hsn_sac_code || '-'}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.as_per_your_invoice)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.taxable_value)}</td>
                                        <td className="text-right py-2 px-2">{row.rate}%</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.sgst)}</td>
                                        <td className="text-right py-2 px-2 font-semibold">{formatCurrency(row.total)}</td>
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                {totals && (
                                    <tr className="bg-brand-primary/10 font-semibold">
                                        <td colSpan={6} className="py-2 px-2 text-right">Total</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_taxable_value)}</td>
                                        <td className="py-2 px-2"></td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_sgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.grand_total)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </>
    );
}

// ================================================================
// SEZ GST TAB
// ================================================================

function GSTSEZTab({
    userId,
    dateFrom,
    dateTo,
    outletId,
    loading,
    setLoading,
    setError,
    downloadCSV,
}: GSTTabProps) {
    const [data, setData] = useState<GSTWorkingReportRow[]>([]);
    const [totals, setTotals] = useState<GSTWorkingTotalsRow | null>(null);

    const filters = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        outlet_id: outletId || undefined,
    };

    useEffect(() => {
        loadData();
    }, [dateFrom, dateTo, outletId]);

    async function loadData() {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const [reportData, totalsData] = await Promise.all([
                getGSTSEZReport(userId, filters),
                getGSTSEZTotals(userId, filters),
            ]);
            setData(reportData);
            setTotals(totalsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load SEZ GST report');
        } finally {
            setLoading(false);
        }
    }

    function handleExport() {
        const csv = exportGSTSEZCSV(data, totals);
        const dateStr = new Date().toISOString().split('T')[0];
        downloadCSV(csv, `gst_working_sez_${dateStr}.csv`);
    }

    return (
        <>
            {/* Export Button */}
            <div className="flex justify-end">
                <Button onClick={handleExport} disabled={loading || data.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                </Button>
            </div>

            {/* Data Table */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">SEZ GST Working</h3>
                {loading ? (
                    <p className="text-center py-8">Loading...</p>
                ) : data.length === 0 ? (
                    <p className="text-center text-brand-text/60 py-8">
                        No SEZ GST data found. Ensure clients have GST Type set to "SEZ".
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-brand-surface">
                                <tr>
                                    <th className="text-left py-2 px-2">Invoice Date</th>
                                    <th className="text-left py-2 px-2">Invoice Number</th>
                                    <th className="text-left py-2 px-2">Party Name</th>
                                    <th className="text-left py-2 px-2">GST NUMBER</th>
                                    <th className="text-left py-2 px-2">HSN CODE</th>
                                    <th className="text-right py-2 px-2">As per your Invoice</th>
                                    <th className="text-right py-2 px-2">Taxable Value</th>
                                    <th className="text-right py-2 px-2">RATE</th>
                                    <th className="text-right py-2 px-2">IGST</th>
                                    <th className="text-right py-2 px-2">CGST</th>
                                    <th className="text-right py-2 px-2">SGST</th>
                                    <th className="text-right py-2 px-2">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.invoice_id} className="border-b hover:bg-brand-surface/50">
                                        <td className="py-2 px-2">{row.invoice_date}</td>
                                        <td className="py-2 px-2 font-medium">{row.invoice_number}</td>
                                        <td className="py-2 px-2">{row.party_name}</td>
                                        <td className="py-2 px-2">{row.gst_number || '-'}</td>
                                        <td className="py-2 px-2">{row.hsn_sac_code || '-'}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.as_per_your_invoice)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.taxable_value)}</td>
                                        <td className="text-right py-2 px-2">{row.rate}%</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.sgst)}</td>
                                        <td className="text-right py-2 px-2 font-semibold">{formatCurrency(row.total)}</td>
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                {totals && (
                                    <tr className="bg-brand-primary/10 font-semibold">
                                        <td colSpan={6} className="py-2 px-2 text-right">Total</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_taxable_value)}</td>
                                        <td className="py-2 px-2"></td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_sgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.grand_total)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </>
    );
}

// ================================================================
// EXPORT GST TAB
// ================================================================

function GSTExportTab({
    userId,
    dateFrom,
    dateTo,
    outletId,
    loading,
    setLoading,
    setError,
    downloadCSV,
}: GSTTabProps) {
    const [data, setData] = useState<GSTWorkingExportRow[]>([]);
    const [totals, setTotals] = useState<GSTWorkingTotalsRow | null>(null);

    const filters = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        outlet_id: outletId || undefined,
    };

    useEffect(() => {
        loadData();
    }, [dateFrom, dateTo, outletId]);

    async function loadData() {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const [reportData, totalsData] = await Promise.all([
                getGSTExportReport(userId, filters),
                getGSTExportTotals(userId, filters),
            ]);
            setData(reportData);
            setTotals(totalsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load export GST report');
        } finally {
            setLoading(false);
        }
    }

    function handleExport() {
        const csv = exportGSTExportCSV(data, totals);
        const dateStr = new Date().toISOString().split('T')[0];
        downloadCSV(csv, `gst_working_export_${dateStr}.csv`);
    }

    return (
        <>
            {/* Export Button */}
            <div className="flex justify-end">
                <Button onClick={handleExport} disabled={loading || data.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                </Button>
            </div>

            {/* Data Table */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Export GST Working</h3>
                {loading ? (
                    <p className="text-center py-8">Loading...</p>
                ) : data.length === 0 ? (
                    <p className="text-center text-brand-text/60 py-8">
                        No export GST data found. Ensure clients have GST Type set to "Export".
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-brand-surface">
                                <tr>
                                    <th className="text-left py-2 px-2">Invoice Date</th>
                                    <th className="text-left py-2 px-2">Invoice Number</th>
                                    <th className="text-left py-2 px-2">Party Name</th>
                                    <th className="text-left py-2 px-2">GST NUMBER</th>
                                    <th className="text-left py-2 px-2">HSN CODE</th>
                                    <th className="text-right py-2 px-2">As per your Invoice</th>
                                    <th className="text-right py-2 px-2">Taxable Value</th>
                                    <th className="text-right py-2 px-2">RATE</th>
                                    <th className="text-right py-2 px-2">IGST</th>
                                    <th className="text-right py-2 px-2">CGST</th>
                                    <th className="text-right py-2 px-2">SGST</th>
                                    <th className="text-right py-2 px-2">TOTAL</th>
                                    <th className="text-left py-2 px-2">Currency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.invoice_id} className="border-b hover:bg-brand-surface/50">
                                        <td className="py-2 px-2">{row.invoice_date}</td>
                                        <td className="py-2 px-2 font-medium">{row.invoice_number}</td>
                                        <td className="py-2 px-2">{row.party_name}</td>
                                        <td className="py-2 px-2">{row.gst_number || '-'}</td>
                                        <td className="py-2 px-2">{row.hsn_sac_code || '-'}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.as_per_your_invoice)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.taxable_value)}</td>
                                        <td className="text-right py-2 px-2">{row.rate}%</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(row.sgst)}</td>
                                        <td className="text-right py-2 px-2 font-semibold">{formatCurrency(row.total)}</td>
                                        <td className="py-2 px-2">{row.currency}</td>
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                {totals && (
                                    <tr className="bg-brand-primary/10 font-semibold">
                                        <td colSpan={6} className="py-2 px-2 text-right">Total</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_taxable_value)}</td>
                                        <td className="py-2 px-2"></td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_igst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_cgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.total_sgst)}</td>
                                        <td className="text-right py-2 px-2">{formatCurrency(totals.grand_total)}</td>
                                        <td className="py-2 px-2"></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </>
    );
}
