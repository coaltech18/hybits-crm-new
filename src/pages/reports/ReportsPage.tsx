import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Download } from 'lucide-react';
import {
  getRevenueReport,
  getRevenueChartData,
  getPaymentsReport,
  getPaymentsChartData,
  getOutstandingAgingReport,
  getOutstandingAgingChartData,
  getSubscriptionPerformanceReport,
  getSubscriptionPerformanceChartData,
  getEventsRevenueReport,
  getEventsRevenueChartData,
  getClientRevenueReport,
  getOutletPerformanceReport,
  exportRevenueReportCSV,
  exportPaymentsReportCSV,
  exportOutstandingAgingReportCSV,
  exportSubscriptionPerformanceReportCSV,
  exportEventsRevenueReportCSV,
  exportClientRevenueReportCSV,
  exportOutletPerformanceReportCSV,
} from '@/services/reportService';
import type {
  RevenueReportRow,
  PaymentsReportRow,
  OutstandingAgingRow,
  SubscriptionMRRRow,
  ClientRevenueRow,
  OutletPerformanceRow,
  InvoiceType,
  PaymentMethod,
  AgingBucket,
  Outlet,
} from '@/types';
import { formatCurrency, roundCurrency } from '@/utils/format';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type TabType =
  | 'revenue'
  | 'payments'
  | 'outstanding'
  | 'subscriptions'
  | 'events'
  | 'clients'
  | 'outlets';

const COLORS = ['#58B692', '#348D74', '#1A382E', '#11241E', '#58B692', '#348D74'];

export default function ReportsPage() {
  const { user, outlets } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('revenue');
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
    { id: 'revenue' as const, label: 'Revenue' },
    { id: 'payments' as const, label: 'Payments' },
    { id: 'outstanding' as const, label: 'Outstanding & Aging' },
    { id: 'subscriptions' as const, label: 'Subscriptions' },
    { id: 'events' as const, label: 'Events' },
    { id: 'clients' as const, label: 'Client Revenue' },
    { id: 'outlets' as const, label: 'Outlet Performance' },
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-primary">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Production-ready reporting and analytics
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === tab.id
                ? 'bg-brand-primary text-white'
                : 'bg-brand-bg text-brand-text hover:bg-brand-border/50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Common Filters */}
      <Card>
        <h3 className="font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To Date"
            type="date"
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
          {(dateFrom || dateTo || outletId) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setOutletId('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Report Content */}
      {activeTab === 'revenue' && (
        <RevenueReportTab
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

      {activeTab === 'payments' && (
        <PaymentsReportTab
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

      {activeTab === 'outstanding' && (
        <OutstandingReportTab
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

      {activeTab === 'subscriptions' && (
        <SubscriptionsReportTab
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

      {activeTab === 'events' && (
        <EventsReportTab
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

      {activeTab === 'clients' && (
        <ClientsReportTab
          userId={user?.id || ''}
          outletId={outletId}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
          downloadCSV={downloadCSV}
        />
      )}

      {activeTab === 'outlets' && (
        <OutletsReportTab
          userId={user?.id || ''}
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
// REVENUE REPORT TAB
// ================================================================

interface ReportTabProps {
  userId: string;
  dateFrom?: string;
  dateTo?: string;
  outletId?: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  downloadCSV: (content: string, filename: string) => void;
}

function RevenueReportTab({ userId, dateFrom, dateTo, outletId, setLoading, setError, downloadCSV }: ReportTabProps) {
  const [data, setData] = useState<RevenueReportRow[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceType | ''>('');

  useEffect(() => {
    loadData();
  }, [userId, dateFrom, dateTo, outletId, invoiceTypeFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = { date_from: dateFrom, date_to: dateTo, outlet_id: outletId };
      if (invoiceTypeFilter) filters.invoice_type = invoiceTypeFilter;

      const [reportData, charts] = await Promise.all([
        getRevenueReport(userId, filters),
        getRevenueChartData(userId, { date_from: dateFrom, date_to: dateTo, outlet_id: outletId }),
      ]);

      setData(reportData);
      setChartData(charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const totalInvoiced = roundCurrency(data.reduce((sum, row) => sum + row.total_invoiced, 0));
  const totalCollected = roundCurrency(data.reduce((sum, row) => sum + row.total_collected, 0));
  const totalOutstanding = roundCurrency(data.reduce((sum, row) => sum + row.outstanding, 0));

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Invoiced</p>
          <p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
        </Card>
      </div>

      {/* Additional Filters */}
      <Card>
        <div className="flex items-center justify-between">
          <Select
            label="Invoice Type"
            value={invoiceTypeFilter}
            onChange={(e) => setInvoiceTypeFilter(e.target.value as InvoiceType | '')}
            className="max-w-xs"
          >
            <option value="">All Types</option>
            <option value="subscription">Subscription</option>
            <option value="event">Event</option>
          </Select>
          <Button
            onClick={() => downloadCSV(exportRevenueReportCSV(data), 'revenue-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
                <Legend />
                <Line type="monotone" dataKey="invoiced" stroke="#8884d8" name="Invoiced" />
                <Line type="monotone" dataKey="collected" stroke="#82ca9d" name="Collected" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4">Outlet-wise Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.outletData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
                <Legend />
                <Bar dataKey="invoiced" fill="#8884d8" name="Invoiced" />
                <Bar dataKey="collected" fill="#82ca9d" name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Revenue Details</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No data found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Count</th>
                  <th className="text-right py-2 px-2">Invoiced</th>
                  <th className="text-right py-2 px-2">Collected</th>
                  <th className="text-right py-2 px-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 text-sm">{row.report_date}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="py-2 px-2 text-sm capitalize">{row.invoice_type}</td>
                    <td className="text-right py-2 px-2">{row.invoice_count}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.total_invoiced)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(row.total_collected)}</td>
                    <td className="text-right py-2 px-2 text-orange-600">{formatCurrency(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// PAYMENTS REPORT TAB
// ================================================================

function PaymentsReportTab({ userId, dateFrom, dateTo, outletId, setLoading, setError, downloadCSV }: ReportTabProps) {
  const [data, setData] = useState<PaymentsReportRow[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | ''>('');

  useEffect(() => {
    loadData();
  }, [userId, dateFrom, dateTo, outletId, paymentMethodFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = { date_from: dateFrom, date_to: dateTo, outlet_id: outletId };
      if (paymentMethodFilter) filters.payment_method = paymentMethodFilter;

      const [reportData, charts] = await Promise.all([
        getPaymentsReport(userId, filters),
        getPaymentsChartData(userId, { date_from: dateFrom, date_to: dateTo, outlet_id: outletId }),
      ]);

      setData(reportData);
      setChartData(charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = roundCurrency(data.reduce((sum, row) => sum + row.total_amount, 0));
  const totalCount = data.reduce((sum, row) => sum + row.payment_count, 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Payments</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Payment Count</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </Card>
      </div>

      {/* Additional Filters */}
      <Card>
        <div className="flex items-center justify-between">
          <Select
            label="Payment Method"
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethod | '')}
            className="max-w-xs"
          >
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </Select>
          <Button
            onClick={() => downloadCSV(exportPaymentsReportCSV(data), 'payments-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-4">Payment Method Split</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.methodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.methodData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4">Daily Collections</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
                <Bar dataKey="value" fill="#82ca9d" name="Collections" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Payment Details</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No data found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-left py-2 px-2">Method</th>
                  <th className="text-right py-2 px-2">Count</th>
                  <th className="text-right py-2 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 text-sm">{row.report_date}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="py-2 px-2 text-sm capitalize">{row.payment_method.replace('_', ' ')}</td>
                    <td className="text-right py-2 px-2">{row.payment_count}</td>
                    <td className="text-right py-2 px-2 text-green-600 font-semibold">{formatCurrency(row.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// OUTSTANDING & AGING REPORT TAB
// ================================================================

function OutstandingReportTab({ userId, dateFrom, dateTo, outletId, setLoading, setError, downloadCSV }: ReportTabProps) {
  const [data, setData] = useState<OutstandingAgingRow[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [agingBucketFilter, setAgingBucketFilter] = useState<AgingBucket | ''>('');

  useEffect(() => {
    loadData();
  }, [userId, dateFrom, dateTo, outletId, agingBucketFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters: any = { date_from: dateFrom, date_to: dateTo, outlet_id: outletId };
      if (agingBucketFilter) filters.aging_bucket = agingBucketFilter;

      const [reportData, charts] = await Promise.all([
        getOutstandingAgingReport(userId, filters),
        getOutstandingAgingChartData(userId, { date_from: dateFrom, date_to: dateTo, outlet_id: outletId }),
      ]);

      setData(reportData);
      setChartData(charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const totalOutstanding = roundCurrency(data.reduce((sum, row) => sum + row.balance_due, 0));

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">0-30 Days</p>
          <p className="text-xl font-bold">{data.filter(r => r.aging_bucket === '0-30').length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">31-60 Days</p>
          <p className="text-xl font-bold">{data.filter(r => r.aging_bucket === '31-60').length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">90+ Days</p>
          <p className="text-xl font-bold text-red-600">{data.filter(r => r.aging_bucket === '90+').length}</p>
        </Card>
      </div>

      {/* Additional Filters */}
      <Card>
        <div className="flex items-center justify-between">
          <Select
            label="Aging Bucket"
            value={agingBucketFilter}
            onChange={(e) => setAgingBucketFilter(e.target.value as AgingBucket | '')}
            className="max-w-xs"
          >
            <option value="">All Buckets</option>
            <option value="0-30">0-30 Days</option>
            <option value="31-60">31-60 Days</option>
            <option value="61-90">61-90 Days</option>
            <option value="90+">90+ Days</option>
          </Select>
          <Button
            onClick={() => downloadCSV(exportOutstandingAgingReportCSV(data), 'outstanding-aging-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Chart */}
      {chartData && (
        <Card>
          <h3 className="font-semibold mb-4">Aging Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.bucketData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
              <Bar dataKey="value" fill="#FF8042" name="Outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Outstanding Invoices</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No outstanding invoices</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Invoice #</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Client</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Paid</th>
                  <th className="text-right py-2 px-2">Balance</th>
                  <th className="text-center py-2 px-2">Days</th>
                  <th className="text-center py-2 px-2">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.invoice_id} className="border-b">
                    <td className="py-2 px-2 text-sm font-medium">{row.invoice_number}</td>
                    <td className="py-2 px-2 text-sm">{row.invoice_date}</td>
                    <td className="py-2 px-2 text-sm">{row.client_name}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.grand_total)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(row.amount_paid)}</td>
                    <td className="text-right py-2 px-2 font-semibold text-orange-600">{formatCurrency(row.balance_due)}</td>
                    <td className="text-center py-2 px-2">{row.days_outstanding}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${row.aging_bucket === '90+' ? 'bg-red-100 text-red-800' :
                        row.aging_bucket === '61-90' ? 'bg-orange-100 text-orange-800' :
                          row.aging_bucket === '31-60' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                        {row.aging_bucket}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// SUBSCRIPTIONS REPORT TAB
// ================================================================

function SubscriptionsReportTab({ userId, dateFrom, dateTo, outletId, setLoading, setError, downloadCSV }: ReportTabProps) {
  const [data, setData] = useState<SubscriptionMRRRow[]>([]);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [userId, dateFrom, dateTo, outletId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters = { date_from: dateFrom, date_to: dateTo, outlet_id: outletId };

      const [reportData, charts] = await Promise.all([
        getSubscriptionPerformanceReport(userId, filters),
        getSubscriptionPerformanceChartData(userId, filters),
      ]);

      setData(reportData);
      setChartData(charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const totalMRR = roundCurrency(data.reduce((sum, row) => sum + row.mrr, 0));
  const totalAnnual = roundCurrency(data.reduce((sum, row) => sum + row.annual_value, 0));

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Active Subscriptions</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Monthly Recurring Revenue (MRR)</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalMRR)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Annual Value</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAnnual)}</p>
        </Card>
      </div>

      {/* Export Button */}
      <Card>
        <div className="flex justify-end">
          <Button
            onClick={() => downloadCSV(exportSubscriptionPerformanceReportCSV(data), 'subscriptions-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Chart */}
      {chartData && (
        <Card>
          <h3 className="font-semibold mb-4">Outlet-wise MRR</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.outletData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
              <Bar dataKey="value" fill="#8884d8" name="MRR" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Subscription Details</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No active subscriptions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Client</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-left py-2 px-2">Cycle</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Price/Unit</th>
                  <th className="text-right py-2 px-2">Cycle Amount</th>
                  <th className="text-right py-2 px-2">MRR</th>
                  <th className="text-left py-2 px-2">Next Billing</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.subscription_id} className="border-b">
                    <td className="py-2 px-2 text-sm">{row.client_name}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="py-2 px-2 text-sm capitalize">{row.billing_cycle}</td>
                    <td className="text-right py-2 px-2">{row.quantity}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.price_per_unit)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.cycle_amount)}</td>
                    <td className="text-right py-2 px-2 font-semibold text-green-600">{formatCurrency(row.mrr)}</td>
                    <td className="py-2 px-2 text-sm">{row.next_billing_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// EVENTS REPORT TAB
// ================================================================

function EventsReportTab({ userId, dateFrom, dateTo, outletId, setLoading, setError, downloadCSV }: ReportTabProps) {
  const [data, setData] = useState<RevenueReportRow[]>([]);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [userId, dateFrom, dateTo, outletId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const filters = { date_from: dateFrom, date_to: dateTo, outlet_id: outletId };

      const [reportData, charts] = await Promise.all([
        getEventsRevenueReport(userId, filters),
        getEventsRevenueChartData(userId, filters),
      ]);

      setData(reportData);
      setChartData(charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = data.reduce((sum, row) => sum + row.total_invoiced, 0);
  const totalCollected = data.reduce((sum, row) => sum + row.total_collected, 0);
  const eventsCount = data.reduce((sum, row) => sum + row.invoice_count, 0);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Event Invoices</p>
          <p className="text-2xl font-bold">{eventsCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Event Revenue</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
        </Card>
      </div>

      {/* Export Button */}
      <Card>
        <div className="flex justify-end">
          <Button
            onClick={() => downloadCSV(exportEventsRevenueReportCSV(data), 'events-revenue-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Chart */}
      {chartData && (
        <Card>
          <h3 className="font-semibold mb-4">Event Revenue by Outlet</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.outletData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '-'} />
              <Bar dataKey="value" fill="#FFBB28" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Event Revenue Details</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No event revenue data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-right py-2 px-2">Events</th>
                  <th className="text-right py-2 px-2">Revenue</th>
                  <th className="text-right py-2 px-2">Collected</th>
                  <th className="text-right py-2 px-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 text-sm">{row.report_date}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="text-right py-2 px-2">{row.invoice_count}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.total_invoiced)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(row.total_collected)}</td>
                    <td className="text-right py-2 px-2 text-orange-600">{formatCurrency(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// CLIENTS REPORT TAB
// ================================================================

function ClientsReportTab({ userId, outletId, setLoading, setError, downloadCSV }: Omit<ReportTabProps, 'dateFrom' | 'dateTo'>) {
  const [data, setData] = useState<ClientRevenueRow[]>([]);

  useEffect(() => {
    loadData();
  }, [userId, outletId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const reportData = await getClientRevenueReport(userId, { outlet_id: outletId });
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const topClients = data.slice(0, 10);

  return (
    <>
      {/* Export Button */}
      <Card>
        <div className="flex justify-end">
          <Button
            onClick={() => downloadCSV(exportClientRevenueReportCSV(data), 'client-revenue-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Top Clients */}
      <Card>
        <h3 className="font-semibold mb-4">Top 10 Clients by Revenue</h3>
        {topClients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No client data</p>
        ) : (
          <div className="space-y-2">
            {topClients.map((client, idx) => (
              <div key={client.client_id} className="flex items-center justify-between p-3 bg-muted rounded">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted-foreground">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold">{client.client_name}</p>
                    <p className="text-sm text-muted-foreground">{client.outlet_name} · {client.client_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{formatCurrency(client.total_invoiced)}</p>
                  <p className="text-sm text-muted-foreground">{client.invoice_count} invoices</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">All Clients</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No client data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Client</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-right py-2 px-2">Invoices</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Collected</th>
                  <th className="text-right py-2 px-2">Outstanding</th>
                  <th className="text-right py-2 px-2">Subscription</th>
                  <th className="text-right py-2 px-2">Event</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.client_id} className="border-b">
                    <td className="py-2 px-2 text-sm font-medium">{row.client_name}</td>
                    <td className="py-2 px-2 text-sm capitalize">{row.client_type}</td>
                    <td className="py-2 px-2 text-sm">{row.outlet_name}</td>
                    <td className="text-right py-2 px-2">{row.invoice_count}</td>
                    <td className="text-right py-2 px-2 font-semibold">{formatCurrency(row.total_invoiced)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(row.total_collected)}</td>
                    <td className="text-right py-2 px-2 text-orange-600">{formatCurrency(row.outstanding)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.subscription_revenue)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(row.event_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ================================================================
// OUTLETS REPORT TAB
// ================================================================

function OutletsReportTab({ userId, outletId, setLoading, setError, downloadCSV }: Omit<ReportTabProps, 'dateFrom' | 'dateTo'>) {
  const [data, setData] = useState<OutletPerformanceRow[]>([]);

  useEffect(() => {
    loadData();
  }, [userId, outletId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const reportData = await getOutletPerformanceReport(userId, { outlet_id: outletId });
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Export Button */}
      <Card>
        <div className="flex justify-end">
          <Button
            onClick={() => downloadCSV(exportOutletPerformanceReportCSV(data), 'outlet-performance-report.csv')}
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <h3 className="font-semibold mb-4">Outlet Performance Comparison</h3>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No outlet data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Outlet</th>
                  <th className="text-right py-2 px-2">Clients</th>
                  <th className="text-right py-2 px-2">Invoices</th>
                  <th className="text-right py-2 px-2">Invoiced</th>
                  <th className="text-right py-2 px-2">Collected</th>
                  <th className="text-right py-2 px-2">Outstanding</th>
                  <th className="text-right py-2 px-2">Collection %</th>
                  <th className="text-right py-2 px-2">Subs</th>
                  <th className="text-right py-2 px-2">MRR</th>
                  <th className="text-right py-2 px-2">Events</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.outlet_id} className="border-b">
                    <td className="py-2 px-2 font-medium">
                      <div>
                        <p>{row.outlet_name}</p>
                        <p className="text-xs text-muted-foreground">{row.outlet_code} · {row.city}</p>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2">{row.active_clients}</td>
                    <td className="text-right py-2 px-2">{row.total_invoices}</td>
                    <td className="text-right py-2 px-2 font-semibold">{formatCurrency(row.total_invoiced)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(row.total_collected)}</td>
                    <td className="text-right py-2 px-2 text-orange-600">{formatCurrency(row.outstanding)}</td>
                    <td className="text-right py-2 px-2">{row.collection_rate_percent}%</td>
                    <td className="text-right py-2 px-2">{row.active_subscriptions}</td>
                    <td className="text-right py-2 px-2 font-semibold text-green-600">{formatCurrency(row.mrr)}</td>
                    <td className="text-right py-2 px-2">{row.completed_events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
