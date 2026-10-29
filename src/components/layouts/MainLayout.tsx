import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Search, Store, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { useLedgerLabels } from '@/components/ui/ledgerLabels';

export function MainLayout() {
  const { pathname } = useLocation();
  const { user, outlets } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useLedgerLabels(mainRef);

  // Close the mobile drawer on navigation; scroll each page to the top.
  useEffect(() => {
    setDrawerOpen(false);
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setJumpOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scope =
    user?.role === 'manager'
      ? outlets.length === 1
        ? outlets[0].name
        : `${outlets.length} outlets`
      : 'All outlets';

  return (
    <div className="flex h-[100dvh] bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="hidden shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-scrim/50 animate-fade-in" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="relative h-full w-64 shadow-dialog animate-slide-in-right" role="dialog" aria-modal="true" aria-label="Navigation">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-12 top-3 rounded-full bg-white p-2 text-ink shadow-lift"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1.5 rounded-md p-2 text-ink-muted hover:bg-paper-sunk hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <img src="/favicon.png" alt="" className="h-7 w-7 lg:hidden" />

          <button
            type="button"
            onClick={() => setJumpOpen(true)}
            className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-rule bg-paper px-3 text-sm text-ink-faint transition-colors hover:border-rule-strong hover:bg-white"
            aria-label="Search invoices, clients, items and pages (Ctrl+K)"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Jump to invoice, client, item…</span>
            <kbd className="ml-auto hidden rounded border border-rule bg-white px-1.5 py-0.5 font-mono text-xs text-ink-muted sm:inline">Ctrl K</kbd>
          </button>

          <div className="ml-auto hidden items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink-muted md:flex" title={outlets.map((o) => o.name).join(', ')}>
            <Store className="h-4 w-4" aria-hidden="true" />
            <span className="max-w-[16rem] truncate font-medium text-ink">{scope}</span>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={jumpOpen} onClose={() => setJumpOpen(false)} />
    </div>
  );
}
