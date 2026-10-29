import { supabase } from '@/lib/supabase';
import { toCsv } from '@/utils/csv';
import { roundCurrency } from '@/utils/format';
import type {
  ReportFilters,
  RevenueReportRow,
  PaymentsReportRow,
  OutstandingAgingRow,
  SubscriptionMRRRow,
  ClientRevenueRow,
  OutletPerformanceRow,
  ChartDataPoint,
  AgingBucket,
  InvoiceType,
  PaymentMethod,
} from '@/types';

// ================================================================
// REPORT SERVICE (PHASE 7)
// ================================================================
// Production-grade reporting with role-based access control
// All reports are READ-ONLY
// CSV exports included for every report
// ================================================================

// ================================================================
// SHARED ACCESS + PAGING HELPERS (also used by gstReportService)
// ================================================================

export interface RoleScope {
  role: string;
  outletIds: string[] | null;
}

/**
 * Get user role and assigned outlets (for managers).
 * Query errors are thrown, so a failed lookup never looks like "no outlets".
 */
export async function getUserRoleAndOutlets(userId: string): Promise<RoleScope> {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }
  if (!profile) {
    throw new Error('User profile not found');
  }

  // Managers: Get assigned outlets
  if (profile.role === 'manager') {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id')
      .eq('user_id', userId);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    const outletIds = (assignments ?? []).map((a: { outlet_id: string }) => a.outlet_id);
    return { role: profile.role, outletIds };
  }

  // Admin/Accountant: All outlets
  return { role: profile.role, outletIds: null };
}

interface OutletFilterableQuery<Q> {
  in(column: string, values: readonly string[]): Q;
  eq(column: string, value: string): Q;
}

/**
 * Apply outlet filter based on role. Returns null when the user can see no outlet.
 */
export function applyOutletFilter<Q extends OutletFilterableQuery<Q>>(
  query: Q,
  roleData: RoleScope,
  filters: { outlet_id?: string }
): Q | null {
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
  if (filters.outlet_id && (roleData.role === 'admin' || roleData.role === 'accountant')) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  return query;
}

const PAGE_SIZE = 1000; // PostgREST max_rows (supabase/config.toml)

interface PagedQuery<T> {
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * Fetch every row of a query, page by page, so totals are never silently
 * truncated at PostgREST's row cap. `build` must create a fresh, fully
 * ordered (unique tiebreaker) query each call, or return null for "no access".
 */
export async function fetchAllRows<T>(build: () => PagedQuery<T> | null): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = build();
    if (query === null) return [];
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(error.message);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const sumBy = <T>(rows: T[], pick: (row: T) => number) =>
  roundCurrency(rows.reduce((sum, row) => sum + (Number(pick(row)) || 0), 0));

// ================================================================
// REVENUE REPORT
// ================================================================

export async function getRevenueReport(
  userId: string,
  filters: ReportFilters & { invoice_type?: InvoiceType }
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<RevenueReportRow>(() => {
    let query = applyOutletFilter(
      supabase
        .from('report_revenue_daily')
        .select('*')
        .order('report_date', { ascending: false })
        .order('outlet_id')
        .order('invoice_type'),
      roleData,
      filters
    );
    if (query === null) return null;

    // Apply date filters
    if (filters.date_from) {
      query = query.gte('report_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('report_date', filters.date_to);
    }

    // Apply invoice type filter
    if (filters.invoice_type) {
      query = query.eq('invoice_type', filters.invoice_type);
    }

    return query;
  });
}

/** Revenue trend + outlet-wise charts from already-filtered rows. */
export function buildRevenueCharts(data: RevenueReportRow[]) {
  // Line chart: Revenue trend over time
  const trendMap = new Map<string, { invoiced: number; collected: number }>();
  data.forEach(row => {
    const existing = trendMap.get(row.report_date) || { invoiced: 0, collected: 0 };
    trendMap.set(row.report_date, {
      invoiced: existing.invoiced + Number(row.total_invoiced),
      collected: existing.collected + Number(row.total_collected),
    });
  });

  const trendData: ChartDataPoint[] = Array.from(trendMap.entries())
    .map(([date, values]) => ({
      name: date,
      invoiced: roundCurrency(values.invoiced),
      collected: roundCurrency(values.collected),
      value: roundCurrency(values.invoiced),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Bar chart: Outlet-wise revenue
  const outletMap = new Map<string, { invoiced: number; collected: number }>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || { invoiced: 0, collected: 0 };
    outletMap.set(row.outlet_name, {
      invoiced: existing.invoiced + Number(row.total_invoiced),
      collected: existing.collected + Number(row.total_collected),
    });
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, values]) => ({
    name: outlet,
    invoiced: roundCurrency(values.invoiced),
    collected: roundCurrency(values.collected),
    value: roundCurrency(values.invoiced),
  }));

  return { trendData, outletData };
}

// ================================================================
// PAYMENTS REPORT
// ================================================================

export async function getPaymentsReport(
  userId: string,
  filters: ReportFilters & { payment_method?: PaymentMethod }
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<PaymentsReportRow>(() => {
    let query = applyOutletFilter(
      supabase
        .from('report_payments_daily')
        .select('*')
        // One row per day x outlet x method (042; invoice_id is always NULL),
        // so this order is unique and paging is deterministic.
        .order('report_date', { ascending: false })
        .order('outlet_name')
        .order('outlet_id')
        .order('payment_method'),
      roleData,
      filters
    );
    if (query === null) return null;

    // Apply date filters
    if (filters.date_from) {
      query = query.gte('report_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('report_date', filters.date_to);
    }

    // Apply payment method filter
    if (filters.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    return query;
  });
}

export function formatPaymentMethodLabel(method: string): string {
  return method.replace(/_/g, ' ').toUpperCase();
}

/** Method split + daily collections charts from already-filtered rows. */
export function buildPaymentsCharts(data: PaymentsReportRow[]) {
  // Pie chart: Payment method split
  const methodMap = new Map<string, number>();
  data.forEach(row => {
    const existing = methodMap.get(row.payment_method) || 0;
    methodMap.set(row.payment_method, existing + Number(row.total_amount));
  });

  const methodData: ChartDataPoint[] = Array.from(methodMap.entries()).map(([method, amount]) => ({
    name: formatPaymentMethodLabel(method),
    value: roundCurrency(amount),
  }));

  // Bar chart: Daily collections
  const dailyMap = new Map<string, number>();
  data.forEach(row => {
    const existing = dailyMap.get(row.report_date) || 0;
    dailyMap.set(row.report_date, existing + Number(row.total_amount));
  });

  const dailyData: ChartDataPoint[] = Array.from(dailyMap.entries())
    .map(([date, amount]) => ({
      name: date,
      value: roundCurrency(amount),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { methodData, dailyData };
}

// ================================================================
// OUTSTANDING & AGING REPORT
// ================================================================

export async function getOutstandingAgingReport(
  userId: string,
  filters: ReportFilters & { aging_bucket?: AgingBucket }
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<OutstandingAgingRow>(() => {
    let query = applyOutletFilter(
      supabase
        .from('report_outstanding_aging')
        .select('*')
        .order('days_outstanding', { ascending: false })
        .order('invoice_id'),
      roleData,
      filters
    );
    if (query === null) return null;

    // Apply date filters (invoice_date)
    if (filters.date_from) {
      query = query.gte('invoice_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('invoice_date', filters.date_to);
    }

    // Apply aging bucket filter
    if (filters.aging_bucket) {
      query = query.eq('aging_bucket', filters.aging_bucket);
    }

    return query;
  });
}

export const AGING_BUCKETS: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];

/** Count and balance per aging bucket. */
export function summarizeAgingBuckets(data: OutstandingAgingRow[]) {
  return AGING_BUCKETS.map(bucket => {
    const rows = data.filter(row => row.aging_bucket === bucket);
    return { bucket, count: rows.length, amount: sumBy(rows, row => row.balance_due) };
  });
}

/** Aging bucket chart from already-filtered rows. */
export function buildAgingCharts(data: OutstandingAgingRow[]) {
  const bucketData: ChartDataPoint[] = summarizeAgingBuckets(data).map(({ bucket, amount }) => ({
    name: `${bucket} days`,
    value: amount,
  }));

  return { bucketData };
}

// ================================================================
// SUBSCRIPTION PERFORMANCE REPORT
// ================================================================

/**
 * Active subscriptions with MRR. This is a current snapshot, so the date
 * range is intentionally not applied (it used to filter on next_billing_date,
 * which made "Active Subscriptions" and MRR silently partial).
 */
export async function getSubscriptionPerformanceReport(
  userId: string,
  filters: Pick<ReportFilters, 'outlet_id'>
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<SubscriptionMRRRow>(() =>
    applyOutletFilter(
      supabase
        .from('report_subscription_mrr')
        .select('*')
        .order('mrr', { ascending: false })
        .order('subscription_id'),
      roleData,
      filters
    )
  );
}

/** Outlet-wise MRR chart from already-filtered rows. */
export function buildSubscriptionCharts(data: SubscriptionMRRRow[]) {
  const outletMap = new Map<string, number>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || 0;
    outletMap.set(row.outlet_name, existing + Number(row.mrr));
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, mrr]) => ({
    name: outlet,
    value: roundCurrency(mrr),
  }));

  return { outletData };
}

// ================================================================
// EVENTS REVENUE REPORT
// ================================================================

export async function getEventsRevenueReport(userId: string, filters: ReportFilters) {
  return getRevenueReport(userId, { ...filters, invoice_type: 'event' });
}

/** Event revenue by outlet chart from already-filtered rows. */
export function buildEventCharts(data: RevenueReportRow[]) {
  const outletMap = new Map<string, number>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || 0;
    outletMap.set(row.outlet_name, existing + Number(row.total_invoiced));
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, revenue]) => ({
    name: outlet,
    value: roundCurrency(revenue),
  }));

  return { outletData };
}

// ================================================================
// CLIENT REVENUE REPORT (all-time; the view has no date column)
// ================================================================

export async function getClientRevenueReport(
  userId: string,
  filters: Pick<ReportFilters, 'outlet_id'>
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<ClientRevenueRow>(() =>
    applyOutletFilter(
      supabase
        .from('report_client_revenue')
        .select('*')
        .order('total_invoiced', { ascending: false })
        .order('client_id'),
      roleData,
      filters
    )
  );
}

// ================================================================
// OUTLET PERFORMANCE REPORT (all-time; the view has no date column)
// ================================================================

export async function getOutletPerformanceReport(
  userId: string,
  filters: Pick<ReportFilters, 'outlet_id'>
) {
  const roleData = await getUserRoleAndOutlets(userId);

  return fetchAllRows<OutletPerformanceRow>(() =>
    applyOutletFilter(
      supabase
        .from('report_outlet_performance')
        .select('*')
        .order('total_invoiced', { ascending: false })
        .order('outlet_id'),
      roleData,
      filters
    )
  );
}

// ================================================================
// CSV EXPORT FUNCTIONS
// ================================================================
// All cells go through @/utils/csv (RFC 4180 quoting + formula-injection
// neutralising). Pass the result to downloadCsv().

export function exportRevenueReportCSV(data: RevenueReportRow[]): string {
  const headers = [
    'Date',
    'Outlet',
    'Invoice Type',
    'Invoice Count',
    'Total Invoiced',
    'Total Collected',
    'Outstanding',
  ];

  const rows = data.map(row => [
    row.report_date,
    row.outlet_name,
    row.invoice_type,
    row.invoice_count,
    row.total_invoiced,
    row.total_collected,
    row.outstanding,
  ]);

  return toCsv(headers, rows);
}

export function exportPaymentsReportCSV(data: PaymentsReportRow[]): string {
  const headers = ['Date', 'Outlet', 'Payment Method', 'Payment Count', 'Total Amount'];

  const rows = data.map(row => [
    row.report_date,
    row.outlet_name,
    formatPaymentMethodLabel(row.payment_method),
    row.payment_count,
    row.total_amount,
  ]);

  return toCsv(headers, rows);
}

export function exportOutstandingAgingReportCSV(data: OutstandingAgingRow[]): string {
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Client',
    'Outlet',
    'Invoice Total',
    'Amount Paid',
    'Balance Due',
    'Days Outstanding',
    'Aging Bucket',
  ];

  const rows = data.map(row => [
    row.invoice_number,
    row.invoice_date,
    row.client_name,
    row.outlet_name,
    row.grand_total,
    row.amount_paid,
    row.balance_due,
    row.days_outstanding,
    row.aging_bucket,
  ]);

  return toCsv(headers, rows);
}

export function exportSubscriptionPerformanceReportCSV(data: SubscriptionMRRRow[]): string {
  const headers = [
    'Client',
    'Outlet',
    'Billing Cycle',
    'Status',
    'Quantity',
    'Price Per Unit',
    'Cycle Amount',
    'MRR',
    'Annual Value',
    'Next Billing Date',
  ];

  const rows = data.map(row => [
    row.client_name,
    row.outlet_name,
    row.billing_cycle,
    row.status,
    row.quantity,
    row.price_per_unit,
    row.cycle_amount,
    row.mrr,
    row.annual_value,
    row.next_billing_date,
  ]);

  return toCsv(headers, rows);
}

export function exportEventsRevenueReportCSV(data: RevenueReportRow[]): string {
  const headers = ['Date', 'Outlet', 'Invoice Count', 'Total Invoiced', 'Total Collected', 'Outstanding'];

  const rows = data.map(row => [
    row.report_date,
    row.outlet_name,
    row.invoice_count,
    row.total_invoiced,
    row.total_collected,
    row.outstanding,
  ]);

  return toCsv(headers, rows);
}

export function exportClientRevenueReportCSV(data: ClientRevenueRow[]): string {
  const headers = [
    'Client Name',
    'Client Type',
    'Outlet',
    'Invoice Count',
    'Total Invoiced',
    'Total Collected',
    'Outstanding',
    'Subscription Revenue',
    'Event Revenue',
    'Active Subscriptions',
    'Completed Events',
  ];

  const rows = data.map(row => [
    row.client_name,
    row.client_type,
    row.outlet_name,
    row.invoice_count,
    row.total_invoiced,
    row.total_collected,
    row.outstanding,
    row.subscription_revenue,
    row.event_revenue,
    row.active_subscriptions,
    row.completed_events,
  ]);

  return toCsv(headers, rows);
}

export function exportOutletPerformanceReportCSV(data: OutletPerformanceRow[]): string {
  const headers = [
    'Outlet Name',
    'Code',
    'City',
    'Active Clients',
    'Total Invoices',
    'Total Invoiced',
    'Total Collected',
    'Outstanding',
    'Collection Rate %',
    'Active Subscriptions',
    'MRR',
    'Completed Events',
  ];

  const rows = data.map(row => [
    row.outlet_name,
    row.outlet_code,
    row.city,
    row.active_clients,
    row.total_invoices,
    row.total_invoiced,
    row.total_collected,
    row.outstanding,
    row.collection_rate_percent,
    row.active_subscriptions,
    row.mrr,
    row.completed_events,
  ]);

  return toCsv(headers, rows);
}
