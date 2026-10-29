import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FilePlus2, FileText, PackageOpen, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Alert } from '@/components/ui/Alert';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { AgingBar } from '@/components/ui/AgingBar';
import { getDashboardStats, getDashboardQueues, DashboardStats, DashboardQueues } from '@/services/dashboardService';
import { formatCurrency } from '@/utils/format';
import { daysSince, toLocalISODate } from '@/utils/date';
import { cn } from '@/utils/cn';

// ================================================================
// DASHBOARD — the bill book's front page.
// Money strip (exposure first) → unpaid invoices ledger, oldest first
// → what needs doing next. Every figure is either real or "—".
// ================================================================

const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatCurrency(n));
const count = (n: number | null | undefined) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));
const ageOf = (iso: string | null) => (iso ? daysSince(toLocalISODate(new Date(iso))) : 0);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, outlets } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queues, setQueues] = useState<DashboardQueues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [s, q] = await Promise.all([getDashboardStats(), getDashboardQueues()]);
      if (id !== requestId.current) return;
      setStats(s);
      setQueues(q);
      const failed = [...s.errors];
      if (q.unpaid === null) failed.push('Unpaid invoices');
      if (q.dishesOut === null) failed.push('Dishes out');
      if (failed.length) setError(`Some figures could not load (${failed.join(', ')}). They show as “—”.`);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const first = loading && !stats;
  const unpaid = queues?.unpaid ?? [];
  const scope = user?.role === 'manager' ? (outlets.length === 1 ? outlets[0].name : `${outlets.length} outlets`) : 'All outlets';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <PageHeader
        title={`${greeting()}${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}`}
        description={`${today} · ${scope}${stats ? ` · ${count(stats.totalClients)} active clients · ${count(stats.activeSubscriptions)} active subscriptions` : ''}`}
        actions={
          <>
            {canWrite && (
              <LinkButton to="/invoices/create">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New invoice
              </LinkButton>
            )}
            {canWrite && (
              <LinkButton to="/inventory/allocate" variant="outline">
                <Send className="h-4 w-4" aria-hidden="true" />
                Send dishes
              </LinkButton>
            )}
            <Button variant="ghost" onClick={load} disabled={loading} aria-label="Refresh figures">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </Button>
          </>
        }
      />

      {error && <Alert variant="warning" className="mb-6">{error}</Alert>}

      {/* Money strip: exposure first, outstanding the loudest figure. */}
      <section aria-label="Key figures" className="sheet mb-6 grid grid-cols-2 lg:grid-cols-4 [&>*]:border-rule max-lg:[&>*:nth-child(-n+2)]:border-b lg:divide-x divide-rule">
        <Figure label="Outstanding" hint={`${count(queues?.unpaid?.length)} unpaid invoices`} loading={first} big>
          <span className={cn((stats?.outstandingAmount ?? 0) > 0 ? 'text-ink' : 'text-final')}>{money(stats?.outstandingAmount)}</span>
        </Figure>
        <Figure label="Over 30 days" hint="Unpaid for more than 30 days" loading={first} className="max-lg:border-l">
          <span className={cn((queues?.over30Amount ?? 0) > 0 ? 'text-overdue' : 'text-ink')}>{money(queues?.over30Amount)}</span>
        </Figure>
        <Figure label="Dishes out" hint={`with ${count(queues?.dishesOut?.length)} clients & events`} loading={first}>
          {count(queues?.dishesOutPieces)} <span className="text-base font-medium text-ink-muted">pcs</span>
        </Figure>
        <Figure label="Invoiced this month" hint={`${count(stats?.totalInvoices)} issued invoices in all`} loading={first} className="max-lg:border-l">
          {money(stats?.currentMonthRevenue)}
        </Figure>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Unpaid invoices ledger */}
        <section className="sheet overflow-hidden" aria-labelledby="unpaid-h">
          <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4">
            <div>
              <h2 id="unpaid-h" className="text-lg font-semibold text-ink">Waiting for payment</h2>
              <p className="text-sm text-ink-muted">Oldest first. Bar length is days since the invoice date.</p>
            </div>
            <Link to="/invoices" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">
              All invoices <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {first ? (
            <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : queues?.unpaid === null ? (
            <p className="px-5 py-12 text-center text-sm text-ink-muted">Unpaid invoices could not load. Use refresh to try again.</p>
          ) : unpaid.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-base font-semibold text-final">Every issued invoice is paid.</p>
              <p className="mt-1 text-sm text-ink-muted">New balances will appear here as soon as an invoice is finalized.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Client</th>
                    <th scope="col">Age</th>
                    <th scope="col" className="text-right">Balance due</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.slice(0, 12).map((inv) => (
                    <tr key={inv.id} className={cn(ageOf(inv.issued_at) > 30 && 'row-overdue')}>
                      <td>
                        <Link to={`/invoices/${inv.id}`} className="serial whitespace-nowrap font-semibold text-ink hover:text-brand-primary">
                          {inv.invoice_number ?? 'Unnumbered'}
                        </Link>
                        {inv.status === 'partially_paid' && <StatusBadge kind="invoice" status="partially_paid" className="mt-1 block w-fit" />}
                      </td>
                      <td>
                        <span className="block max-w-[13rem] truncate xl:max-w-[11rem] 2xl:max-w-[16rem]" title={inv.client_name}>{inv.client_name}</span>
                        <span className="block text-xs text-ink-muted">{fmtDate(inv.issued_at)}</span>
                      </td>
                      <td><AgingBar days={ageOf(inv.issued_at)} pxPerDay={0.9} /></td>
                      <td className="amount cell-emph text-right font-semibold">{formatCurrency(inv.balance_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unpaid.length > 12 && (
                <p className="border-t border-rule px-5 py-3 text-sm text-ink-muted">
                  Showing the 12 oldest of {unpaid.length}.{' '}
                  <Link to="/reports" className="font-semibold text-brand-primary hover:underline">See the aging report</Link>
                </p>
              )}
            </div>
          )}
        </section>

        {/* What needs doing next */}
        <div className="space-y-6">
          <section className="sheet" aria-labelledby="next-h">
            <h2 id="next-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink">Needs attention</h2>
            <ul className="divide-y divide-rule">
              <NextItem
                to="/invoices"
                icon={FileText}
                title={first ? '…' : `${count(queues?.draftCount)} draft invoice${queues?.draftCount === 1 ? '' : 's'}`}
                detail="Drafts have no number on paper yet. Finalize them to bill the client."
                tone={(queues?.draftCount ?? 0) > 0 ? 'draft' : 'quiet'}
              />
              <NextItem
                to={canWrite ? '/inventory/allocate' : '/inventory/reports?tab=allocation'}
                icon={PackageOpen}
                title={first ? '…' : `${count(queues?.dishesOutPieces)} pieces still out`}
                detail={canWrite ? 'Receive them back, or record what was damaged or lost.' : 'See who still holds which dishes.'}
                tone={(queues?.dishesOutPieces ?? 0) > 0 ? 'partial' : 'quiet'}
              />
            </ul>
          </section>

          <section className="sheet" aria-labelledby="out-h">
            <div className="border-b border-rule px-5 py-4">
              <h2 id="out-h" className="text-lg font-semibold text-ink">Dishes out the longest</h2>
              <p className="text-sm text-ink-muted">Bar length is days since the first dispatch.</p>
            </div>
            {first ? (
              <div className="space-y-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
            ) : queues?.dishesOut === null ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">Dishware out could not load. Use refresh to try again.</p>
            ) : (queues?.dishesOut ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">No dishware is out right now.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {(queues?.dishesOut ?? []).slice(0, 6).map((r) => (
                  <li key={`${r.reference_type}:${r.reference_id}`} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        to={r.reference_type === 'event' ? `/events/${r.reference_id}` : `/subscriptions/${r.reference_id}`}
                        className="min-w-0 truncate text-sm font-semibold text-ink hover:text-brand-primary"
                      >
                        {r.reference_name}
                      </Link>
                      <span className="tabular shrink-0 text-sm font-semibold text-ink">{count(r.pieces)} pcs</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs capitalize text-ink-muted">{r.reference_type}</span>
                      <AgingBar days={daysSince(toLocalISODate(new Date(r.since)))} pxPerDay={1.4} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label, hint, loading, big, className, children,
}: { label: string; hint: string; loading: boolean; big?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 px-5 py-4 sm:px-6 sm:py-5', className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      {loading ? (
        <Skeleton className={cn('mt-2', big ? 'h-9 w-40' : 'h-8 w-32')} />
      ) : (
        <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}>{children}</div>
      )}
      <div className="mt-1 text-sm text-ink-muted">{hint}</div>
    </div>
  );
}

function NextItem({
  to, icon: Icon, title, detail, tone,
}: { to: string; icon: typeof FileText; title: string; detail: string; tone: 'draft' | 'partial' | 'quiet' }) {
  return (
    <li>
      <Link to={to} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-paper">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            tone === 'draft' && 'border-draft-rule bg-draft-tint text-draft',
            tone === 'partial' && 'border-partial-rule bg-partial-tint text-partial',
            tone === 'quiet' && 'border-rule bg-paper text-ink-muted'
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-sm text-ink-muted">{detail}</span>
        </span>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}
