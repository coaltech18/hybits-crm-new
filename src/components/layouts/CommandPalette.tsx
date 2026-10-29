import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Users, Package, CornerDownLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import { useDialog } from '@/components/ui/Modal';
import { navFor } from './navigation';

// ================================================================
// CTRL+K JUMP — everything reachable by its number or name.
// Pages + invoice numbers + clients + dishware items. RLS scopes results.
// ================================================================

interface Hit {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: typeof Search;
  section: string;
}

/** Escape LIKE wildcards so user text is matched literally. */
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const panelRef = useDialog(open, onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [records, setRecords] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setQ('');
      setRecords([]);
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pages = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    return navFor(user?.role)
      .flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
      .filter((i) => !term || `${i.label} ${i.group} ${i.keywords ?? ''}`.toLowerCase().includes(term))
      .slice(0, term ? 6 : 8)
      .map((i) => ({ id: i.to, label: i.label, hint: i.group, to: i.to, icon: i.icon, section: 'Go to' }));
  }, [q, user?.role]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const pattern = `%${likeSafe(term)}%`;
      const [inv, cli, itm] = await Promise.all([
        supabase.from('invoices').select('id, invoice_number, status, grand_total').ilike('invoice_number', pattern).order('created_at', { ascending: false }).limit(5),
        supabase.from('clients').select('id, name, client_type').ilike('name', pattern).order('name').limit(5),
        supabase.from('inventory_items').select('id, name, category').ilike('name', pattern).order('name').limit(5),
      ]);
      if (cancelled) return;
      const out: Hit[] = [];
      for (const r of inv.data ?? []) out.push({ id: `i-${r.id}`, label: r.invoice_number || 'Draft invoice', hint: String(r.status).replace(/_/g, ' '), to: `/invoices/${r.id}`, icon: FileText, section: 'Invoices' });
      for (const r of cli.data ?? []) out.push({ id: `c-${r.id}`, label: r.name, hint: r.client_type, to: `/clients/${r.id}`, icon: Users, section: 'Clients' });
      for (const r of itm.data ?? []) out.push({ id: `p-${r.id}`, label: r.name, hint: r.category ?? 'Item', to: `/inventory/items/${r.id}`, icon: Package, section: 'Dishware' });
      setRecords(out);
      setSearching(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const hits = [...records, ...pages];
  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    navigate(h.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[cursor]);
    }
  };

  let lastSection = '';

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="fixed inset-0 bg-scrim/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="relative mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl">
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Jump to" className="overflow-hidden rounded-sheet bg-white shadow-dialog animate-scale-in">
          <div className="flex items-center gap-3 border-b border-rule px-4">
            <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Invoice number, client, dish item or page…"
              className="h-14 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="jump-results"
              aria-activedescendant={hits[cursor] ? `jump-${hits[cursor].id}` : undefined}
              aria-label="Search"
            />
            {searching && <span className="text-xs text-ink-faint">Searching…</span>}
          </div>
          <ul id="jump-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
            {hits.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-muted">
                {q.trim().length >= 2 && !searching ? `Nothing matches “${q.trim()}”.` : 'Type at least two letters.'}
              </li>
            )}
            {hits.map((h, i) => {
              const header = h.section !== lastSection ? h.section : null;
              lastSection = h.section;
              const Icon = h.icon;
              return (
                <li key={h.id} role="none">
                  {header && <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{header}</div>}
                  <button
                    id={`jump-${h.id}`}
                    role="option"
                    aria-selected={i === cursor}
                    type="button"
                    onMouseMove={() => setCursor(i)}
                    onClick={() => go(h)}
                    className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm', i === cursor ? 'bg-final-tint' : 'hover:bg-paper')}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className={cn('min-w-0 flex-1 truncate font-medium text-ink', h.section === 'Invoices' && 'serial')}>{h.label}</span>
                    <span className="shrink-0 text-xs capitalize text-ink-muted">{h.hint}</span>
                    {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-4 border-t border-rule bg-paper px-4 py-2 text-xs text-ink-muted">
            <span><kbd className="font-mono">↑↓</kbd> move</span>
            <span><kbd className="font-mono">Enter</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
