import { supabase } from '@/lib/supabase';

// ================================================================
// DASHBOARD SERVICE
// ================================================================
// Provides aggregated statistics for the admin dashboard.
// All queries are READ-ONLY and respect RLS policies.
// ================================================================

export interface DashboardStats {
    totalClients: number;
    activeSubscriptions: number;
    totalInvoices: number;
    outstandingAmount: number;
    currentMonthRevenue: number;
}

/**
 * Get dashboard statistics
 * 
 * Fetches aggregated metrics from the database:
 * - Total Clients (active only)
 * - Active Subscriptions
 * - Total Invoices (issued only)
 * - Outstanding Amount (sum of unpaid balances)
 * - Current Month Revenue (issued this month)
 * 
 * @param _userId - Current user ID (for RLS context)
 * @returns Dashboard statistics
 */
export async function getDashboardStats(_userId: string): Promise<DashboardStats> {
    // Get current month boundaries
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfMonthISO = firstDayOfMonth.toISOString();

    // Execute all queries in parallel for performance
    const [
        clientsResult,
        subscriptionsResult,
        invoicesResult,
        outstandingResult,
        revenueResult,
    ] = await Promise.all([
        // 1. Total active clients
        supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true),

        // 2. Active subscriptions
        supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .eq('is_active', true),

        // 3. Total issued invoices
        supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'issued'),

        // 4. Outstanding amount (from view with payment status)
        supabase
            .from('invoices_with_payment_status')
            .select('balance_due')
            .gt('balance_due', 0),

        // 5. Current month revenue (issued this month)
        supabase
            .from('invoices')
            .select('grand_total')
            .eq('status', 'issued')
            .gte('issued_at', firstDayOfMonthISO),
    ]);

    // Handle errors gracefully - log but don't break dashboard
    if (clientsResult.error) console.error('Dashboard: clients error', clientsResult.error);
    if (subscriptionsResult.error) console.error('Dashboard: subscriptions error', subscriptionsResult.error);
    if (invoicesResult.error) console.error('Dashboard: invoices error', invoicesResult.error);
    if (outstandingResult.error) console.error('Dashboard: outstanding error', outstandingResult.error);
    if (revenueResult.error) console.error('Dashboard: revenue error', revenueResult.error);

    // Calculate outstanding amount (sum of all balance_due)
    const outstandingAmount = outstandingResult.data
        ? outstandingResult.data.reduce((sum, row) => sum + (row.balance_due || 0), 0)
        : 0;

    // Calculate current month revenue (sum of all grand_total)
    const currentMonthRevenue = revenueResult.data
        ? revenueResult.data.reduce((sum, row) => sum + (row.grand_total || 0), 0)
        : 0;

    return {
        totalClients: clientsResult.count ?? 0,
        activeSubscriptions: subscriptionsResult.count ?? 0,
        totalInvoices: invoicesResult.count ?? 0,
        outstandingAmount,
        currentMonthRevenue,
    };
}
