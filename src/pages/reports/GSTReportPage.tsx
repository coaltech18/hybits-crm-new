// ============================================================================
// GST REPORT PAGE
// ============================================================================

import React, { useMemo, useState } from 'react';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';
import { GSTReportService, GSTReportGroupedResult } from '@/services/gstReportService';
import { exportGSTExcel } from '@/utils/exportGSTExcel';

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const yearOptions = Array.from({ length: 7 }).map((_, idx) => {
  const y = new Date().getFullYear() - 3 + idx;
  return { value: y, label: String(y) };
});

const Section: React.FC<{ title: string; rows: any[] }>
  = ({ title, rows }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="text-sm text-muted-foreground">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Invoice Date</th>
              <th className="px-3 py-2 text-left">Invoice No</th>
              <th className="px-3 py-2 text-left">Party Name</th>
              <th className="px-3 py-2 text-left">GST No</th>
              <th className="px-3 py-2 text-left">HSN Code</th>
              <th className="px-3 py-2 text-right">As per Invoice</th>
              <th className="px-3 py-2 text-right">Taxable Value</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">IGST</th>
              <th className="px-3 py-2 text-right">CGST</th>
              <th className="px-3 py-2 text-right">SGST</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.invoice_id + r.invoice_number}>
                <td className="px-3 py-2">{new Date(r.invoice_date).toLocaleDateString('en-IN')}</td>
                <td className="px-3 py-2">{r.invoice_number}</td>
                <td className="px-3 py-2">{r.customer_name}</td>
                <td className="px-3 py-2">{r.gst_number || ''}</td>
                <td className="px-3 py-2">{r.hsn_code || ''}</td>
                <td className="px-3 py-2 text-right">₹{r.total_amount.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">₹{r.taxable_value.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">{r.tax_rate}%</td>
                <td className="px-3 py-2 text-right">₹{r.igst.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">₹{r.cgst.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">₹{r.sgst.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">₹{r.total_amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GSTReportPage: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GSTReportGroupedResult | null>(null);

  const canExport = useMemo(() => !!data && !loading, [data, loading]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await GSTReportService.getGSTReport(month, year);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    exportGSTExcel(month, year, data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">GST Summary</h1>
          <p className="text-muted-foreground mt-2">Export monthly GST summary (Domestic / SEZ / Export)</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerate} loading={loading}>
            <Icon name="refresh-cw" size={18} className="mr-2" />
            Generate Report
          </Button>
          <Button onClick={handleExport} disabled={!canExport}>
            <Icon name="download" size={18} className="mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Month"
            options={monthOptions}
            value={month}
            onChange={(v) => setMonth(Number(v))}
          />
          <Select
            label="Year"
            options={yearOptions}
            value={year}
            onChange={(v) => setYear(Number(v))}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <Section title="Domestic" rows={data.Domestic.filter(r => r.invoice_type === 'invoice')} />
          <Section title="Domestic - Credit Notes" rows={data.Domestic.filter(r => r.invoice_type === 'credit_note')} />
          <Section title="SEZ" rows={data.SEZ.filter(r => r.invoice_type === 'invoice')} />
          <Section title="SEZ - Credit Notes" rows={data.SEZ.filter(r => r.invoice_type === 'credit_note')} />
          <Section title="Export" rows={data.Export.filter(r => r.invoice_type === 'invoice')} />
          <Section title="Export - Credit Notes" rows={data.Export.filter(r => r.invoice_type === 'credit_note')} />
        </div>
      )}
    </div>
  );
};

export default GSTReportPage;


