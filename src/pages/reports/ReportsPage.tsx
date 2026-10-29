import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { AgingBar } from '@/components/ui/AgingBar';
import {
  getRevenueReport,
  buildRevenueCharts,
  getPaymentsReport,
  buildPaymentsCharts,
  getOutstandingAgingReport,
  buildAgingCharts,
  summarizeAgingBuckets,
  getSubscriptionPerformanceReport,
  buildSubscriptionCharts,
  getEventsRevenueReport,
  buildEventCharts,
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
import { downloadCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { useReportLoader } from './useReportLoader';
import {
  ReportTabs,
  TabPanel,
  FigureStrip,
  Figure,
  LedgerSheet,
  ExportButton,
  LedgerEmpty,
  ChartSheet,
} from './ReportKit';
import {
  CHART,
  CHART_CATEGORICAL,
  TFOOT_CELL,
  fmtCount,
  fmtDate,
  fmtTickDate,
  gridProps,
  legendProps,
  sumCount,
  sumMoney,
  tooltipProps,
  xAxisProps,
  yAxisProps,
} from './reportFormat';
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

// ================================================================
// REPORTS — the accountant's month-end desk.
// Tabs → shared filter bar → per tab: totals strip, the ledger
// (with its own filter + CSV export, totals in the footer), then
// the trend charts underneath. Figures are exact and right-aligned.
// ================================================================

type TabType =
  | 'revenue'
  | 'payments'
  | 'outstanding'
  | 'subscriptions'
  | 'events'
  | 'clients'
  | 'outlets';

// Tabs whose views have a date column; the others are all-time / snapshot figures
const DATE_RANGE_TABS: TabType[] = ['revenue', 'payments', 'outstanding', 'events'];

const TAB_PREFIX = 'reports';

/** Fixed pixel height (matches ChartSheet's 280px box) so ResponsiveContainer never measures -1 on first render. */
const CHART_HEIGHT = 280;

export default function ReportsPage() {
  useDocumentTitle('Reports');

  const { user, outlets } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('revenue');
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
    { id: 'outstanding' as const, label: 'Outstanding & aging' },
    { id: 'subscriptions' as const, label: 'Subscriptions' },
    { id: 'events' as const, label: 'Events' },
    { id: 'clients' as const, label: 'Client revenue' },
    { id: 'outlets' as const, label: 'Outlet performance' },
  ];

  const userId = user?.id || '';
  const usesDateRange = DATE_RANGE_TABS.includes(activeTab);
  const failed = Boolean(error);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Revenue, collections, aging and performance by outlet. Every ledger exports to CSV."
      />

      <div className="space-y-6">
        <ReportTabs tabs={tabs} active={activeTab} onChange={setActiveTab} idPrefix={TAB_PREFIX} label="Report" />

        {/* Common filters */}
        <Card padding="sm">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {usesDateRange ? (
              <>
                <div className="w-full sm:w-44">
                  <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="w-full sm:w-44">
                  <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </>
            ) : (
              <p className="w-full pb-2 text-sm text-ink-muted sm:w-auto sm:max-w-sm">
                {activeTab === 'subscriptions'
                  ? 'Current snapshot of active subscriptions; the date range does not apply.'
                  : 'All-time figures; the date range does not apply to this report.'}
              </p>
            )}
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
            {((usesDateRange && (dateFrom || dateTo)) || outletId) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setOutletId('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </Card>

        {error && <Alert variant="error">{error}</Alert>}

        {/* Report content */}
        {userId && (
          <TabPanel idPrefix={TAB_PREFIX} active={activeTab}>
            {activeTab === 'revenue' && (
              <RevenueReportTab
                userId={userId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                outletId={outletId}
                setError={setError}
                failed={failed}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsReportTab
                userId={userId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                outletId={outletId}
                setError={setError}
                failed={failed}
              />
            )}

            {activeTab === 'outstanding' && (
              <OutstandingReportTab
                userId={userId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                outletId={outletId}
                setError={setError}
                failed={failed}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionsReportTab userId={userId} outletId={outletId} setError={setError} failed={failed} />
            )}

            {activeTab === 'events' && (
              <EventsReportTab
                userId={userId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                outletId={outletId}
                setError={setError}
                failed={failed}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsReportTab userId={userId} outletId={outletId} setError={setError} failed={failed} />
            )}

            {activeTab === 'outlets' && (
              <OutletsReportTab userId={userId} outletId={outletId} setError={setError} failed={failed} />
            )}
          </TabPanel>
        )}
      </div>
    </div>
  );
}

// ================================================================
// SHARED BITS
// ================================================================

interface ReportTabProps {
  userId: string;
  dateFrom?: string;
  dateTo?: string;
  outletId?: string;
  setError: (error: string | null) => void;
  /** Presentation only: lets the empty state say the report failed rather than "no data". */
  failed: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${fmtCount(n)} ${n === 1 ? one : many}`;

const NO_MATCH = 'Nothing matches these filters. Try a wider date range or another outlet.';

function ChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{children}</div>;
}

// ================================================================
// REVENUE REPORT TAB
// ================================================================

function RevenueReportTab({ userId, dateFrom, dateTo, outletId, setError, failed }: ReportTabProps) {
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceType | ''>('');

  const loader = useCallback(
    () =>
      getRevenueReport(userId, {
        date_from: dateFrom,
        date_to: dateTo,
        outlet_id: outletId,
        invoice_type: invoiceTypeFilter || undefined,
      }),
    [userId, dateFrom, dateTo, outletId, invoiceTypeFilter]
  );
  const { data, loading } = useReportLoader<RevenueReportRow[]>(loader, [], setError);
  const chartData = useMemo(() => buildRevenueCharts(data), [data]);

  const totalInvoiced = roundCurrency(data.reduce((sum, row) => sum + row.total_invoiced, 0));
  const totalCollected = roundCurrency(data.reduce((sum, row) => sum + row.total_collected, 0));
  const totalOutstanding = roundCurrency(data.reduce((sum, row) => sum + row.outstanding, 0));
  const totalCount = sumCount(data, (row) => row.invoice_count);

  return (
    <>
      <FigureStrip label="Revenue totals" className="sm:grid-cols-3">
        <Figure label="Invoiced" big loading={loading} hint={plural(totalCount, 'invoice')}>
          {formatCurrency(totalInvoiced)}
        </Figure>
        <Figure label="Collected" loading={loading} hint="Received so far">
          <span className="text-final">{formatCurrency(totalCollected)}</span>
        </Figure>
        <Figure label="Outstanding" loading={loading} hint="Still to collect">
          <span className={cn(totalOutstanding > 0 ? 'text-partial' : 'text-ink')}>{formatCurrency(totalOutstanding)}</span>
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="revenue-ledger-h"
        title="Revenue by date"
        summary={loading ? 'Loading…' : `${plural(data.length, 'row')} · one per date, outlet and invoice type`}
        tools={
          <>
            <div className="w-full sm:w-44">
              <Select
                label="Invoice type"
                value={invoiceTypeFilter}
                onChange={(e) => setInvoiceTypeFilter(e.target.value as InvoiceType | '')}
              >
                <option value="">All types</option>
                <option value="subscription">Subscription</option>
                <option value="event">Event</option>
              </Select>
            </div>
            <ExportButton
              onClick={() => downloadCsv('revenue-report.csv', exportRevenueReportCSV(data))}
              disabled={loading || data.length === 0}
            />
          </>
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : data.length === 0 ? (
          <LedgerEmpty failed={failed} title="No revenue in this period" description={NO_MATCH} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">Invoices</th>
                  <th scope="col" className="text-right">Invoiced</th>
                  <th scope="col" className="text-right">Collected</th>
                  <th scope="col" className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap font-medium text-ink">{fmtDate(row.report_date)}</td>
                    <td>{row.outlet_name}</td>
                    <td className="capitalize text-ink-muted">{row.invoice_type}</td>
                    <td className="amount text-right">{fmtCount(row.invoice_count)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_invoiced)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_collected)}</td>
                    <td className="amount text-right">{formatCurrency(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3} className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totalCount)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalInvoiced)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalCollected)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {!loading && data.length > 0 && (
        <ChartGrid>
          <ChartSheet title="Revenue trend" description="Invoiced and collected per day">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={chartData.trendData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...xAxisProps} tickFormatter={fmtTickDate} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipProps} labelFormatter={fmtTickDate} cursor={{ stroke: CHART.rule }} />
                <Legend {...legendProps} />
                <Line type="monotone" dataKey="invoiced" stroke={CHART.primary} strokeWidth={2} dot={false} name="Invoiced" />
                <Line type="monotone" dataKey="collected" stroke={CHART.compare} strokeWidth={2} dot={false} name="Collected" />
              </LineChart>
            </ResponsiveContainer>
          </ChartSheet>

          <ChartSheet title="Revenue by outlet" description="Invoiced and collected">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={chartData.outletData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipProps} />
                <Legend {...legendProps} />
                <Bar dataKey="invoiced" fill={CHART.primary} name="Invoiced" maxBarSize={40} />
                <Bar dataKey="collected" fill={CHART.compare} name="Collected" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSheet>
        </ChartGrid>
      )}
    </>
  );
}

// ================================================================
// PAYMENTS REPORT TAB
// ================================================================

function PaymentsReportTab({ userId, dateFrom, dateTo, outletId, setError, failed }: ReportTabProps) {
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | ''>('');

  const loader = useCallback(
    () =>
      getPaymentsReport(userId, {
        date_from: dateFrom,
        date_to: dateTo,
        outlet_id: outletId,
        payment_method: paymentMethodFilter || undefined,
      }),
    [userId, dateFrom, dateTo, outletId, paymentMethodFilter]
  );
  const { data, loading } = useReportLoader<PaymentsReportRow[]>(loader, [], setError);
  const chartData = useMemo(() => buildPaymentsCharts(data), [data]);

  const totalAmount = roundCurrency(data.reduce((sum, row) => sum + row.total_amount, 0));
  const totalCount = data.reduce((sum, row) => sum + row.payment_count, 0);

  return (
    <>
      <FigureStrip label="Payment totals" className="sm:grid-cols-2">
        <Figure label="Collected" big loading={loading} hint="All payments recorded in this period">
          <span className="text-final">{formatCurrency(totalAmount)}</span>
        </Figure>
        <Figure label="Payments" loading={loading} hint="Number of payments recorded">
          {fmtCount(totalCount)}
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="payments-ledger-h"
        title="Payments by date"
        summary={loading ? 'Loading…' : `${plural(data.length, 'row')} · one per date, outlet and method`}
        tools={
          <>
            <div className="w-full sm:w-48">
              <Select
                label="Payment method"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethod | '')}
              >
                <option value="">All methods</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </Select>
            </div>
            <ExportButton
              onClick={() => downloadCsv('payments-report.csv', exportPaymentsReportCSV(data))}
              disabled={loading || data.length === 0}
            />
          </>
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : data.length === 0 ? (
          <LedgerEmpty failed={failed} title="No payments in this period" description={NO_MATCH} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">Method</th>
                  <th scope="col" className="text-right">Payments</th>
                  <th scope="col" className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap font-medium text-ink">{fmtDate(row.report_date)}</td>
                    <td>{row.outlet_name}</td>
                    <td className="capitalize text-ink-muted">{row.payment_method.replace(/_/g, ' ')}</td>
                    <td className="amount text-right">{fmtCount(row.payment_count)}</td>
                    <td className="amount text-right font-semibold">{formatCurrency(row.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3} className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totalCount)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {!loading && data.length > 0 && (
        <ChartGrid>
          <ChartSheet title="Payment method split" description="Share of the amount collected">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <PieChart>
                <Pie
                  data={chartData.methodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  outerRadius={80}
                  fill={CHART.primary}
                  stroke={CHART.sheet}
                  strokeWidth={2}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {chartData.methodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_CATEGORICAL[index % CHART_CATEGORICAL.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend {...legendProps} />
              </PieChart>
            </ResponsiveContainer>
          </ChartSheet>

          <ChartSheet title="Daily collections" description="Amount collected per day">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={chartData.dailyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...xAxisProps} tickFormatter={fmtTickDate} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipProps} labelFormatter={fmtTickDate} />
                <Bar dataKey="value" fill={CHART.primary} name="Collections" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSheet>
        </ChartGrid>
      )}
    </>
  );
}

// ================================================================
// OUTSTANDING & AGING REPORT TAB
// ================================================================

const BUCKET_BADGE: Record<AgingBucket, 'partial' | 'overdue'> = {
  '0-30': 'partial',
  '31-60': 'overdue',
  '61-90': 'overdue',
  '90+': 'overdue',
};

function OutstandingReportTab({ userId, dateFrom, dateTo, outletId, setError, failed }: ReportTabProps) {
  const [agingBucketFilter, setAgingBucketFilter] = useState<AgingBucket | ''>('');

  const loader = useCallback(
    () =>
      getOutstandingAgingReport(userId, {
        date_from: dateFrom,
        date_to: dateTo,
        outlet_id: outletId,
        aging_bucket: agingBucketFilter || undefined,
      }),
    [userId, dateFrom, dateTo, outletId, agingBucketFilter]
  );
  const { data, loading } = useReportLoader<OutstandingAgingRow[]>(loader, [], setError);
  const chartData = useMemo(() => buildAgingCharts(data), [data]);
  const bucketSummary = useMemo(() => summarizeAgingBuckets(data), [data]);

  const totalOutstanding = roundCurrency(data.reduce((sum, row) => sum + row.balance_due, 0));
  const totalBilled = sumMoney(data, (row) => row.grand_total);
  const totalPaid = sumMoney(data, (row) => row.amount_paid);

  return (
    <>
      {/* Total on top, the four buckets beneath it in age order. */}
      <FigureStrip label="Outstanding by age" className="grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Total outstanding"
          big
          loading={loading}
          hint={plural(data.length, 'unpaid invoice')}
          className="col-span-2 lg:col-span-4"
        >
          <span className={cn(totalOutstanding > 0 ? 'text-ink' : 'text-final')}>{formatCurrency(totalOutstanding)}</span>
        </Figure>
        {bucketSummary.map(({ bucket, count, amount }) => (
          <Figure key={bucket} label={`${bucket} days`} loading={loading} hint={plural(count, 'invoice')}>
            <span className={cn(bucket !== '0-30' && amount > 0 ? 'text-overdue' : 'text-ink')}>{formatCurrency(amount)}</span>
          </Figure>
        ))}
      </FigureStrip>

      <LedgerSheet
        id="aging-ledger-h"
        title="Unpaid invoices"
        summary={
          loading ? 'Loading…' : `${plural(data.length, 'invoice')} · bar length is days since the invoice date`
        }
        tools={
          <>
            <div className="w-full sm:w-44">
              <Select
                label="Aging bucket"
                value={agingBucketFilter}
                onChange={(e) => setAgingBucketFilter(e.target.value as AgingBucket | '')}
              >
                <option value="">All buckets</option>
                <option value="0-30">0-30 days</option>
                <option value="31-60">31-60 days</option>
                <option value="61-90">61-90 days</option>
                <option value="90+">90+ days</option>
              </Select>
            </div>
            <ExportButton
              onClick={() => downloadCsv('outstanding-aging-report.csv', exportOutstandingAgingReportCSV(data))}
              disabled={loading || data.length === 0}
            />
          </>
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : data.length === 0 ? (
          <LedgerEmpty
            failed={failed}
            title="No unpaid invoices"
            description="Every invoice matching these filters is fully paid."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Invoice · date</th>
                  <th scope="col">Client · outlet</th>
                  <th scope="col" className="text-right">Total</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Balance</th>
                  <th scope="col">Age</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.invoice_id}>
                    <td className="whitespace-nowrap">
                      <div className="inline-block max-w-full align-top">
                        <Link
                          to={`/invoices/${row.invoice_id}`}
                          className="serial block font-semibold text-ink hover:text-brand-primary"
                        >
                          {row.invoice_number}
                        </Link>
                        <span className="block text-sm text-ink-muted">{fmtDate(row.invoice_date)}</span>
                      </div>
                    </td>
                    <td className="max-w-[16rem]">
                      <div className="min-w-0">
                        <span className="block truncate">{row.client_name}</span>
                        <span className="block truncate text-sm text-ink-muted">{row.outlet_name}</span>
                      </div>
                    </td>
                    <td className="amount cell-hide-sm text-right">{formatCurrency(row.grand_total)}</td>
                    <td className="amount cell-hide-sm text-right">{formatCurrency(row.amount_paid)}</td>
                    <td className="amount cell-emph text-right font-semibold">{formatCurrency(row.balance_due)}</td>
                    <td>
                      <div className="flex flex-col items-end gap-1 sm:items-start">
                        <AgingBar days={row.days_outstanding} />
                        <Badge variant={BUCKET_BADGE[row.aging_bucket] ?? 'default'}>{row.aging_bucket} days</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalBilled)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalPaid)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalOutstanding)}</td>
                  <td className={TFOOT_CELL} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {!loading && data.length > 0 && (
        <ChartSheet title="Aging analysis" description="Outstanding amount per bucket">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={chartData.bucketData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" name="Outstanding" maxBarSize={64}>
                {/* Same rule as the aging bar: amber under 30 days, overdue from 30. */}
                {chartData.bucketData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? CHART.partial : CHART.overdue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSheet>
      )}
    </>
  );
}

// ================================================================
// SUBSCRIPTIONS REPORT TAB
// ================================================================

function SubscriptionsReportTab({ userId, outletId, setError, failed }: Omit<ReportTabProps, 'dateFrom' | 'dateTo'>) {
  const loader = useCallback(
    () => getSubscriptionPerformanceReport(userId, { outlet_id: outletId }),
    [userId, outletId]
  );
  const { data, loading } = useReportLoader<SubscriptionMRRRow[]>(loader, [], setError);
  const chartData = useMemo(() => buildSubscriptionCharts(data), [data]);

  const totalMRR = roundCurrency(data.reduce((sum, row) => sum + row.mrr, 0));
  const totalAnnual = roundCurrency(data.reduce((sum, row) => sum + row.annual_value, 0));

  return (
    <>
      <FigureStrip label="Subscription totals" className="sm:grid-cols-3">
        <Figure label="Monthly recurring revenue" big loading={loading} hint="MRR across active subscriptions">
          {formatCurrency(totalMRR)}
        </Figure>
        <Figure label="Annual value" loading={loading} hint="Yearly value of active subscriptions">
          {formatCurrency(totalAnnual)}
        </Figure>
        <Figure label="Active subscriptions" loading={loading} hint="Current snapshot">
          {fmtCount(data.length)}
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="subs-ledger-h"
        title="Active subscriptions"
        summary={loading ? 'Loading…' : plural(data.length, 'subscription')}
        tools={
          <ExportButton
            onClick={() => downloadCsv('subscriptions-report.csv', exportSubscriptionPerformanceReportCSV(data))}
            disabled={loading || data.length === 0}
          />
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : data.length === 0 ? (
          <LedgerEmpty
            failed={failed}
            title="No active subscriptions"
            description="Active subscriptions for the selected outlet will be listed here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">Cycle</th>
                  <th scope="col" className="text-right">Qty</th>
                  <th scope="col" className="text-right">Price / unit</th>
                  <th scope="col" className="text-right">Cycle amount</th>
                  <th scope="col" className="text-right">MRR</th>
                  <th scope="col">Next billing</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.subscription_id}>
                    <td className="font-medium text-ink">{row.client_name}</td>
                    <td className="text-ink-muted">{row.outlet_name}</td>
                    <td className="capitalize text-ink-muted">{row.billing_cycle}</td>
                    <td className="amount text-right">{fmtCount(row.quantity)}</td>
                    <td className="amount text-right">{formatCurrency(row.price_per_unit)}</td>
                    <td className="amount text-right">{formatCurrency(row.cycle_amount)}</td>
                    <td className="amount text-right font-semibold">{formatCurrency(row.mrr)}</td>
                    <td className="whitespace-nowrap text-ink-muted">{fmtDate(row.next_billing_date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={6} className={cn(TFOOT_CELL, 'text-left')}>
                    Total MRR
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalMRR)}</td>
                  <td className={TFOOT_CELL} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {!loading && data.length > 0 && (
        <ChartSheet title="MRR by outlet">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={chartData.outletData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={CHART.primary} name="MRR" maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSheet>
      )}
    </>
  );
}

// ================================================================
// EVENTS REPORT TAB
// ================================================================

function EventsReportTab({ userId, dateFrom, dateTo, outletId, setError, failed }: ReportTabProps) {
  const loader = useCallback(
    () => getEventsRevenueReport(userId, { date_from: dateFrom, date_to: dateTo, outlet_id: outletId }),
    [userId, dateFrom, dateTo, outletId]
  );
  const { data, loading } = useReportLoader<RevenueReportRow[]>(loader, [], setError);
  const chartData = useMemo(() => buildEventCharts(data), [data]);

  const totalRevenue = roundCurrency(data.reduce((sum, row) => sum + row.total_invoiced, 0));
  const totalCollected = roundCurrency(data.reduce((sum, row) => sum + row.total_collected, 0));
  const totalOutstanding = sumMoney(data, (row) => row.outstanding);
  const eventsCount = data.reduce((sum, row) => sum + row.invoice_count, 0);

  return (
    <>
      <FigureStrip label="Event totals" className="sm:grid-cols-3">
        <Figure label="Event revenue" big loading={loading} hint="Invoiced for events">
          {formatCurrency(totalRevenue)}
        </Figure>
        <Figure label="Collected" loading={loading} hint="Received so far">
          <span className="text-final">{formatCurrency(totalCollected)}</span>
        </Figure>
        <Figure label="Event invoices" loading={loading} hint="Number of invoices">
          {fmtCount(eventsCount)}
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="events-ledger-h"
        title="Event revenue by date"
        summary={loading ? 'Loading…' : `${plural(data.length, 'row')} · one per date and outlet`}
        tools={
          <ExportButton
            onClick={() => downloadCsv('events-revenue-report.csv', exportEventsRevenueReportCSV(data))}
            disabled={loading || data.length === 0}
          />
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : data.length === 0 ? (
          <LedgerEmpty failed={failed} title="No event revenue in this period" description={NO_MATCH} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Outlet</th>
                  <th scope="col" className="text-right">Invoices</th>
                  <th scope="col" className="text-right">Revenue</th>
                  <th scope="col" className="text-right">Collected</th>
                  <th scope="col" className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap font-medium text-ink">{fmtDate(row.report_date)}</td>
                    <td>{row.outlet_name}</td>
                    <td className="amount text-right">{fmtCount(row.invoice_count)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_invoiced)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_collected)}</td>
                    <td className="amount text-right">{formatCurrency(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(eventsCount)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalRevenue)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalCollected)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {!loading && data.length > 0 && (
        <ChartSheet title="Event revenue by outlet">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={chartData.outletData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={CHART.primary} name="Revenue" maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSheet>
      )}
    </>
  );
}

// ================================================================
// CLIENTS REPORT TAB
// ================================================================

function ClientsReportTab({ userId, outletId, setError, failed }: Omit<ReportTabProps, 'dateFrom' | 'dateTo'>) {
  const loader = useCallback(
    () => getClientRevenueReport(userId, { outlet_id: outletId }),
    [userId, outletId]
  );
  const { data, loading } = useReportLoader<ClientRevenueRow[]>(loader, [], setError);

  const topClients = data.slice(0, 10);

  const totals = {
    invoices: sumCount(data, (r) => r.invoice_count),
    invoiced: sumMoney(data, (r) => r.total_invoiced),
    collected: sumMoney(data, (r) => r.total_collected),
    outstanding: sumMoney(data, (r) => r.outstanding),
    subscription: sumMoney(data, (r) => r.subscription_revenue),
    event: sumMoney(data, (r) => r.event_revenue),
  };

  return (
    <>
      <FigureStrip label="Client revenue totals" className="grid-cols-2 xl:grid-cols-4">
        <Figure label="Invoiced" big loading={loading} hint={plural(totals.invoices, 'invoice')}>
          {formatCurrency(totals.invoiced)}
        </Figure>
        <Figure label="Collected" loading={loading} hint="All time">
          <span className="text-final">{formatCurrency(totals.collected)}</span>
        </Figure>
        <Figure label="Outstanding" loading={loading} hint="Still to collect">
          <span className={cn(totals.outstanding > 0 ? 'text-partial' : 'text-ink')}>{formatCurrency(totals.outstanding)}</span>
        </Figure>
        <Figure label="Clients" loading={loading} hint="In this report">
          {fmtCount(data.length)}
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="clients-ledger-h"
        title="All clients"
        summary={loading ? 'Loading…' : `${plural(data.length, 'client')} · highest revenue first`}
        tools={
          <ExportButton
            onClick={() => downloadCsv('client-revenue-report.csv', exportClientRevenueReportCSV(data))}
            disabled={loading || data.length === 0}
          />
        }
      >
        {loading ? (
          <TableSkeleton rows={6} cols={9} />
        ) : data.length === 0 ? (
          <LedgerEmpty
            failed={failed}
            title="No client revenue yet"
            description="Clients appear here once they have been invoiced."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Type</th>
                  <th scope="col">Outlet</th>
                  <th scope="col" className="text-right">Invoices</th>
                  <th scope="col" className="text-right">Invoiced</th>
                  <th scope="col" className="text-right">Collected</th>
                  <th scope="col" className="text-right">Outstanding</th>
                  <th scope="col" className="text-right">Subscription</th>
                  <th scope="col" className="text-right">Event</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.client_id}>
                    <td className="font-medium text-ink">{row.client_name}</td>
                    <td className="capitalize text-ink-muted">{row.client_type}</td>
                    <td className="text-ink-muted">{row.outlet_name}</td>
                    <td className="amount text-right">{fmtCount(row.invoice_count)}</td>
                    <td className="amount text-right font-semibold">{formatCurrency(row.total_invoiced)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_collected)}</td>
                    <td className="amount text-right">{formatCurrency(row.outstanding)}</td>
                    <td className="amount text-right">{formatCurrency(row.subscription_revenue)}</td>
                    <td className="amount text-right">{formatCurrency(row.event_revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3} className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totals.invoices)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.invoiced)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.collected)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.outstanding)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.subscription)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.event)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>

      {/* Top 10: a ranked read of the same ledger. */}
      {(loading || topClients.length > 0) && (
        <section className="sheet overflow-hidden" aria-labelledby="top-clients-h">
          <h2 id="top-clients-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">
            Top 10 clients by revenue
          </h2>
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-5" />
              ))}
            </div>
          ) : (
            <ol className="divide-y divide-rule">
              {topClients.map((client, idx) => (
                <li key={client.client_id} className="flex items-center gap-4 px-5 py-3">
                  <span className="tabular w-6 shrink-0 text-right text-sm font-semibold text-ink-muted">{idx + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{client.client_name}</span>
                    <span className="block truncate text-sm capitalize text-ink-muted">
                      {client.outlet_name} · {client.client_type}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="amount block text-sm font-semibold text-ink">{formatCurrency(client.total_invoiced)}</span>
                    <span className="tabular block text-sm text-ink-muted">{plural(client.invoice_count, 'invoice')}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

// ================================================================
// OUTLETS REPORT TAB
// ================================================================

function OutletsReportTab({ userId, outletId, setError, failed }: Omit<ReportTabProps, 'dateFrom' | 'dateTo'>) {
  const loader = useCallback(
    () => getOutletPerformanceReport(userId, { outlet_id: outletId }),
    [userId, outletId]
  );
  const { data, loading } = useReportLoader<OutletPerformanceRow[]>(loader, [], setError);

  const totals = {
    clients: sumCount(data, (r) => r.active_clients),
    invoices: sumCount(data, (r) => r.total_invoices),
    invoiced: sumMoney(data, (r) => r.total_invoiced),
    collected: sumMoney(data, (r) => r.total_collected),
    outstanding: sumMoney(data, (r) => r.outstanding),
    subs: sumCount(data, (r) => r.active_subscriptions),
    mrr: sumMoney(data, (r) => r.mrr),
    events: sumCount(data, (r) => r.completed_events),
  };

  return (
    <>
      <FigureStrip label="Outlet totals" className="grid-cols-2 xl:grid-cols-4">
        <Figure label="Invoiced" big loading={loading} hint={plural(totals.invoices, 'invoice')}>
          {formatCurrency(totals.invoiced)}
        </Figure>
        <Figure label="Collected" loading={loading} hint="All time">
          <span className="text-final">{formatCurrency(totals.collected)}</span>
        </Figure>
        <Figure label="Outstanding" loading={loading} hint="Still to collect">
          <span className={cn(totals.outstanding > 0 ? 'text-partial' : 'text-ink')}>{formatCurrency(totals.outstanding)}</span>
        </Figure>
        <Figure label="MRR" loading={loading} hint={plural(totals.subs, 'active subscription')}>
          {formatCurrency(totals.mrr)}
        </Figure>
      </FigureStrip>

      <LedgerSheet
        id="outlets-ledger-h"
        title="Outlet performance"
        summary={loading ? 'Loading…' : plural(data.length, 'outlet')}
        tools={
          <ExportButton
            onClick={() => downloadCsv('outlet-performance-report.csv', exportOutletPerformanceReportCSV(data))}
            disabled={loading || data.length === 0}
          />
        }
      >
        {loading ? (
          <TableSkeleton rows={4} cols={10} />
        ) : data.length === 0 ? (
          <LedgerEmpty failed={failed} title="No outlet figures yet" description="Outlets appear here once they have activity." />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Outlet</th>
                  <th scope="col" className="text-right">Clients</th>
                  <th scope="col" className="text-right">Invoices</th>
                  <th scope="col" className="text-right">Invoiced</th>
                  <th scope="col" className="text-right">Collected</th>
                  <th scope="col" className="text-right">Outstanding</th>
                  <th scope="col" className="text-right">Collection %</th>
                  <th scope="col" className="text-right">Subs</th>
                  <th scope="col" className="text-right">MRR</th>
                  <th scope="col" className="text-right">Events</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.outlet_id}>
                    <td>
                      <span className="block font-medium text-ink">{row.outlet_name}</span>
                      <span className="block text-xs text-ink-muted">
                        <span className="serial">{row.outlet_code}</span>
                        {row.city ? ` · ${row.city}` : ''}
                      </span>
                    </td>
                    <td className="amount text-right">{fmtCount(row.active_clients)}</td>
                    <td className="amount text-right">{fmtCount(row.total_invoices)}</td>
                    <td className="amount text-right font-semibold">{formatCurrency(row.total_invoiced)}</td>
                    <td className="amount text-right">{formatCurrency(row.total_collected)}</td>
                    <td className="amount text-right">{formatCurrency(row.outstanding)}</td>
                    <td className="amount text-right">{row.collection_rate_percent}%</td>
                    <td className="amount text-right">{fmtCount(row.active_subscriptions)}</td>
                    <td className="amount text-right">{formatCurrency(row.mrr)}</td>
                    <td className="amount text-right">{fmtCount(row.completed_events)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className={cn(TFOOT_CELL, 'text-left')}>
                    Total
                  </th>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totals.clients)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totals.invoices)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.invoiced)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.collected)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.outstanding)}</td>
                  <td className={TFOOT_CELL} />
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totals.subs)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{formatCurrency(totals.mrr)}</td>
                  <td className={cn(TFOOT_CELL, 'amount text-right')}>{fmtCount(totals.events)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </LedgerSheet>
    </>
  );
}
