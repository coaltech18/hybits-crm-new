import { supabase } from '@/lib/supabase';
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
    .maybeSingle();

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
  filters: ReportFilters
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
// REVENUE REPORT
// ================================================================

export async function getRevenueReport(
  userId: string,
  filters: ReportFilters & { invoice_type?: InvoiceType }
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('report_revenue_daily')
    .select('*')
    .order('report_date', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

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

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as RevenueReportRow[];
}

export async function getRevenueChartData(userId: string, filters: ReportFilters) {
  const data = await getRevenueReport(userId, filters);

  // Line chart: Revenue trend over time
  const trendMap = new Map<string, { invoiced: number; collected: number }>();
  data.forEach(row => {
    const existing = trendMap.get(row.report_date) || { invoiced: 0, collected: 0 };
    trendMap.set(row.report_date, {
      invoiced: existing.invoiced + row.total_invoiced,
      collected: existing.collected + row.total_collected,
    });
  });

  const trendData: ChartDataPoint[] = Array.from(trendMap.entries())
    .map(([date, values]) => ({
      name: date,
      invoiced: values.invoiced,
      collected: values.collected,
      value: values.invoiced,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Bar chart: Outlet-wise revenue
  const outletMap = new Map<string, { invoiced: number; collected: number }>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || { invoiced: 0, collected: 0 };
    outletMap.set(row.outlet_name, {
      invoiced: existing.invoiced + row.total_invoiced,
      collected: existing.collected + row.total_collected,
    });
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, values]) => ({
    name: outlet,
    invoiced: values.invoiced,
    collected: values.collected,
    value: values.invoiced,
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

  let query = supabase
    .from('report_payments_daily')
    .select('*')
    .order('report_date', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

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

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as PaymentsReportRow[];
}

export async function getPaymentsChartData(userId: string, filters: ReportFilters) {
  const data = await getPaymentsReport(userId, filters);

  // Pie chart: Payment method split
  const methodMap = new Map<string, number>();
  data.forEach(row => {
    const existing = methodMap.get(row.payment_method) || 0;
    methodMap.set(row.payment_method, existing + row.total_amount);
  });

  const methodData: ChartDataPoint[] = Array.from(methodMap.entries()).map(([method, amount]) => ({
    name: method.replace('_', ' ').toUpperCase(),
    value: amount,
  }));

  // Bar chart: Daily collections
  const dailyMap = new Map<string, number>();
  data.forEach(row => {
    const existing = dailyMap.get(row.report_date) || 0;
    dailyMap.set(row.report_date, existing + row.total_amount);
  });

  const dailyData: ChartDataPoint[] = Array.from(dailyMap.entries())
    .map(([date, amount]) => ({
      name: date,
      value: amount,
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

  let query = supabase
    .from('report_outstanding_aging')
    .select('*')
    .order('days_outstanding', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

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

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as OutstandingAgingRow[];
}

export async function getOutstandingAgingChartData(userId: string, filters: ReportFilters) {
  const data = await getOutstandingAgingReport(userId, filters);

  // Bar chart: Aging buckets
  const bucketMap = new Map<AgingBucket, number>([
    ['0-30', 0],
    ['31-60', 0],
    ['61-90', 0],
    ['90+', 0],
  ]);

  data.forEach(row => {
    const existing = bucketMap.get(row.aging_bucket) || 0;
    bucketMap.set(row.aging_bucket, existing + row.balance_due);
  });

  const bucketData: ChartDataPoint[] = [
    { name: '0-30 days', value: bucketMap.get('0-30') || 0 },
    { name: '31-60 days', value: bucketMap.get('31-60') || 0 },
    { name: '61-90 days', value: bucketMap.get('61-90') || 0 },
    { name: '90+ days', value: bucketMap.get('90+') || 0 },
  ];

  return { bucketData };
}

// ================================================================
// SUBSCRIPTION PERFORMANCE REPORT
// ================================================================

export async function getSubscriptionPerformanceReport(
  userId: string,
  filters: ReportFilters
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('report_subscription_mrr')
    .select('*')
    .order('mrr', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

  // Apply date filters (next_billing_date for upcoming billing)
  if (filters.date_from) {
    query = query.gte('next_billing_date', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('next_billing_date', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as SubscriptionMRRRow[];
}

export async function getSubscriptionPerformanceChartData(userId: string, filters: ReportFilters) {
  const data = await getSubscriptionPerformanceReport(userId, filters);

  // Bar chart: Outlet-wise MRR
  const outletMap = new Map<string, number>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || 0;
    outletMap.set(row.outlet_name, existing + row.mrr);
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, mrr]) => ({
    name: outlet,
    value: mrr,
  }));

  return { outletData };
}

// ================================================================
// EVENTS REVENUE REPORT
// ================================================================

export async function getEventsRevenueReport(userId: string, filters: ReportFilters) {
  const roleData = await getUserRoleAndOutlets(userId);

  // Get event invoices from revenue report
  let query = supabase
    .from('report_revenue_daily')
    .select('*')
    .eq('invoice_type', 'event')
    .order('report_date', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

  // Apply date filters
  if (filters.date_from) {
    query = query.gte('report_date', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('report_date', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as RevenueReportRow[];
}

export async function getEventsRevenueChartData(userId: string, filters: ReportFilters) {
  const data = await getEventsRevenueReport(userId, filters);

  // Bar chart: Event revenue by outlet
  const outletMap = new Map<string, number>();
  data.forEach(row => {
    const existing = outletMap.get(row.outlet_name) || 0;
    outletMap.set(row.outlet_name, existing + row.total_invoiced);
  });

  const outletData: ChartDataPoint[] = Array.from(outletMap.entries()).map(([outlet, revenue]) => ({
    name: outlet,
    value: revenue,
  }));

  return { outletData };
}

// ================================================================
// CLIENT REVENUE REPORT
// ================================================================

export async function getClientRevenueReport(
  userId: string,
  filters: ReportFilters
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('report_client_revenue')
    .select('*')
    .order('total_invoiced', { ascending: false });

  // Apply outlet filter
  query = applyOutletFilter(query, roleData, filters);
  if (query === null) return [];

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ClientRevenueRow[];
}

// ================================================================
// OUTLET PERFORMANCE REPORT
// ================================================================

export async function getOutletPerformanceReport(
  userId: string,
  filters: ReportFilters
) {
  const roleData = await getUserRoleAndOutlets(userId);

  let query = supabase
    .from('report_outlet_performance')
    .select('*')
    .order('total_invoiced', { ascending: false });

  // For managers, still show their outlet (for context)
  if (roleData.role === 'manager' && roleData.outletIds) {
    if (roleData.outletIds.length > 0) {
      query = query.in('outlet_id', roleData.outletIds);
    } else {
      return [];
    }
  }

  // Admin/Accountant with outlet filter
  if (filters.outlet_id && ['admin', 'accountant'].includes(roleData.role)) {
    query = query.eq('outlet_id', filters.outlet_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as OutletPerformanceRow[];
}

// ================================================================
// CSV EXPORT FUNCTIONS
// ================================================================

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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export function exportPaymentsReportCSV(data: PaymentsReportRow[]): string {
  const headers = ['Date', 'Outlet', 'Payment Method', 'Payment Count', 'Total Amount'];

  const rows = data.map(row => [
    row.report_date,
    row.outlet_name,
    row.payment_method.replace('_', ' ').toUpperCase(),
    row.payment_count,
    row.total_amount,
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
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
    row.city || '',
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

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
