import { supabase } from '@/lib/supabase';
import { roundCurrency } from '@/utils/format';
import { daysSince, parseLocalISODate, startOfMonthISO, toLocalISODate } from '@/utils/date';
import { fetchAllRows } from '@/services/reportService';
import { countErrorMessage } from '@/utils/query';

// ================================================================
// DASHBOARD SERVICE
// ================================================================
// Provides aggregated statistics for the admin dashboard.
// All queries are READ-ONLY and respect RLS policies.
// ================================================================

const ISSUED_STATUSES = ['finalized', 'partially_paid', 'paid'];

/** Each figure is null when its query failed; `errors` names the failed cards. */
export interface DashboardStats {
    totalClients: number | null;
    activeSubscriptions: number | null;
    totalInvoices: number | null;
    outstandingAmount: number | null;
    currentMonthRevenue: number | null;
    errors: string[];
}

type Settled<T> = { value: T | null; error: unknown };

async function settle<T>(promise: PromiseLike<T>): Promise<Settled<T>> {
    try {
        return { value: await promise, error: null };
    } catch (error) {
        return { value: null, error };
    }
}

async function countRows(build: PromiseLike<{ count: number | null; error: { message: string } | null; status?: number }>, thing = 'rows') {
    const { count, error, status } = await build;
    if (error) throw new Error(countErrorMessage(error, status, thing));
    return count ?? 0;
}

/**
 * Get dashboard statistics
 *
 * Fetches aggregated metrics from the database:
 * - Total Clients (active only)
 * - Active Subscriptions
 * - Total Invoices (finalized + partially_paid + paid)
 * - Outstanding Amount (unpaid balances of issued invoices only)
 * - Current Month Revenue (issued since the 1st of the local month)
 *
 * A failed query yields null for that card (never a fake 0).
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    // Local (IST) midnight on the 1st, as a timestamptz instant
    const firstDayOfMonthISO = parseLocalISODate(startOfMonthISO()).toISOString();

    // Execute all queries in parallel for performance
    const [clients, subscriptions, invoices, outstanding, revenue] = await Promise.all([
        // 1. Total active clients
        settle(countRows(
            supabase
                .from('clients')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true),
            'clients'
        )),

        // 2. Active subscriptions
        settle(countRows(
            supabase
                .from('subscriptions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'active'),
            'subscriptions'
        )),

        // 3. Total finalized/paid invoices
        settle(countRows(
            supabase
                .from('invoices')
                .select('id', { count: 'exact', head: true })
                .in('status', ISSUED_STATUSES),
            'invoices'
        )),

        // 4. Outstanding amount: issued invoices only (drafts/cancelled are not receivable).
        //    Paged so the sum is never truncated at the 1000-row cap.
        settle(fetchAllRows<{ balance_due: number | null }>(() =>
            supabase
                .from('invoices_with_payment_status')
                .select('id, balance_due')
                .in('status', ISSUED_STATUSES)
                .gt('balance_due', 0)
                .order('id')
        )),

        // 5. Current month revenue (issued this local month)
        settle(fetchAllRows<{ grand_total: number | null }>(() =>
            supabase
                .from('invoices')
                .select('id, grand_total')
                .in('status', ISSUED_STATUSES)
                .gte('issued_at', firstDayOfMonthISO)
                .order('id')
        )),
    ]);

    const errors: string[] = [];
    const named: [string, Settled<unknown>][] = [
        ['Total Clients', clients],
        ['Active Subscriptions', subscriptions],
        ['Total Invoices', invoices],
        ['Outstanding', outstanding],
        ['This Month', revenue],
    ];
    for (const [name, result] of named) {
        if (result.error) {
            console.error(`Dashboard: ${name} failed`, result.error);
            errors.push(name);
        }
    }

    return {
        totalClients: clients.value,
        activeSubscriptions: subscriptions.value,
        totalInvoices: invoices.value,
        outstandingAmount: outstanding.value
            ? roundCurrency(outstanding.value.reduce((sum, row) => sum + (Number(row.balance_due) || 0), 0))
            : null,
        currentMonthRevenue: revenue.value
            ? roundCurrency(revenue.value.reduce((sum, row) => sum + (Number(row.grand_total) || 0), 0))
            : null,
        errors,
    };
}

// ================================================================
// WORK QUEUES — what needs doing next (oldest first)
// ================================================================

export interface UnpaidInvoiceRow {
    id: string;
    invoice_number: string | null;
    client_name: string;
    issued_at: string | null;
    grand_total: number;
    balance_due: number;
    status: string;
}

export interface DishesOutRow {
    reference_type: 'event' | 'subscription';
    reference_id: string;
    reference_name: string;
    pieces: number;
    since: string;
}

export interface DashboardQueues {
    unpaid: UnpaidInvoiceRow[] | null;
    over30Amount: number | null;
    draftCount: number | null;
    dishesOut: DishesOutRow[] | null;
    dishesOutPieces: number | null;
}

/** Unpaid invoices (oldest first), drafts waiting, and dishware still out by client/event. */
export async function getDashboardQueues(): Promise<DashboardQueues> {
    const [unpaidRes, draftRes, allocRes] = await Promise.all([
        settle(fetchAllRows<{ id: string; invoice_number: string | null; client_id: string; issued_at: string | null; grand_total: number; balance_due: number; status: string }>(() =>
            supabase
                .from('invoices_with_payment_status')
                .select('id, invoice_number, client_id, issued_at, grand_total, balance_due, status')
                .in('status', ['finalized', 'partially_paid'])
                .gt('balance_due', 0)
                .order('issued_at', { ascending: true })
                .order('id')
        )),
        settle(countRows(
            supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
            'draft invoices'
        )),
        settle(fetchAllRows<{ allocation_id: string; reference_type: 'event' | 'subscription'; reference_id: string; reference_name: string | null; outstanding_quantity: number; created_at: string }>(() =>
            supabase
                .from('inventory_allocations_with_details')
                .select('allocation_id, reference_type, reference_id, reference_name, outstanding_quantity, created_at')
                .gt('outstanding_quantity', 0)
                .order('allocation_id')
        )),
    ]);

    // Client names in one follow-up query (views don't embed reliably).
    let unpaid: UnpaidInvoiceRow[] | null = null;
    let over30Amount: number | null = null;
    if (unpaidRes.value) {
        const ids = [...new Set(unpaidRes.value.map((r) => r.client_id))];
        const names = new Map<string, string>();
        for (let i = 0; i < ids.length; i += 200) {
            const { data } = await supabase.from('clients').select('id, name').in('id', ids.slice(i, i + 200));
            for (const c of data ?? []) names.set(c.id, c.name);
        }
        unpaid = unpaidRes.value.map((r) => ({
            id: r.id,
            invoice_number: r.invoice_number,
            client_name: names.get(r.client_id) ?? '—',
            issued_at: r.issued_at,
            grand_total: Number(r.grand_total) || 0,
            balance_due: Number(r.balance_due) || 0,
            status: r.status,
        }));
        // Same boundary as the aging report: day 31 onwards is "over 30 days".
        over30Amount = roundCurrency(
            unpaid.filter((r) => r.issued_at && daysSince(toLocalISODate(new Date(r.issued_at))) > 30).reduce((s, r) => s + r.balance_due, 0)
        );
    }

    let dishesOut: DishesOutRow[] | null = null;
    let dishesOutPieces: number | null = null;
    if (allocRes.value) {
        const byRef = new Map<string, DishesOutRow>();
        for (const a of allocRes.value) {
            const key = `${a.reference_type}:${a.reference_id}`;
            const row = byRef.get(key) ?? { reference_type: a.reference_type, reference_id: a.reference_id, reference_name: a.reference_name ?? '—', pieces: 0, since: a.created_at };
            row.pieces += Number(a.outstanding_quantity) || 0;
            if (a.created_at < row.since) row.since = a.created_at;
            byRef.set(key, row);
        }
        dishesOut = [...byRef.values()].sort((x, y) => x.since.localeCompare(y.since));
        dishesOutPieces = dishesOut.reduce((s, r) => s + r.pieces, 0);
    }

    for (const [name, r] of [['Unpaid invoices', unpaidRes], ['Drafts', draftRes], ['Dishes out', allocRes]] as const) {
        if (r.error) console.error(`Dashboard: ${name} failed`, r.error);
    }

    return { unpaid, over30Amount, draftCount: draftRes.value, dishesOut, dishesOutPieces };
}
