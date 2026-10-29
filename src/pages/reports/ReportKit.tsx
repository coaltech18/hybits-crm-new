import React, { useRef } from 'react';
import { Download, FileX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ================================================================
// REPORT KIT — the pieces both report pages share: an accessible
// tablist, the totals strip, the ledger sheet and the chart sheet.
// Presentation only; every figure is computed by the page.
// ================================================================

interface TabDef<T extends string> {
  id: T;
  label: string;
}

/**
 * WAI-ARIA tablist with manual activation: arrows/Home/End move focus,
 * Enter/Space (a click) selects. Manual so arrowing past a tab doesn't
 * fire that report's query.
 */
export function ReportTabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
  label,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix: string;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
  }

  return (
    <div className="overflow-x-auto">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-rule">
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={selected ? `${idPrefix}-panel-${tab.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-logo',
                selected
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-ink-muted hover:border-rule-strong hover:text-ink'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({
  idPrefix,
  active,
  children,
}: {
  idPrefix: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${active}`}
      aria-labelledby={`${idPrefix}-tab-${active}`}
      tabIndex={0}
      className="space-y-6 rounded-sheet focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-logo"
    >
      {children}
    </div>
  );
}

/** Totals strip: figures on one sheet, divided by hairlines at any column count. */
export function FigureStrip({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className={cn('sheet grid gap-px overflow-hidden bg-rule', className)}>
      {children}
    </section>
  );
}

export function Figure({
  label,
  hint,
  loading,
  big,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  loading: boolean;
  big?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 bg-white px-5 py-4', className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      {loading ? (
        <Skeleton className={cn('mt-2', big ? 'h-9 w-40' : 'h-7 w-28')} />
      ) : (
        <div className={cn('amount mt-1 font-bold tracking-tight text-ink', big ? 'text-2xl xl:text-3xl' : 'text-xl xl:text-2xl')}>{children}</div>
      )}
      {hint !== undefined && <div className="mt-1 truncate text-sm text-ink-muted">{loading ? ' ' : hint}</div>}
    </div>
  );
}

/** A ledger on its own sheet: title + count line, then tools (filter, export), then the table. */
export function LedgerSheet({
  id,
  title,
  summary,
  tools,
  children,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sheet overflow-hidden" aria-labelledby={id}>
      <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {summary && <p className="tabular text-sm text-ink-muted">{summary}</p>}
        </div>
        {tools && <div className="flex flex-wrap items-end gap-2">{tools}</div>}
      </div>
      {children}
    </section>
  );
}

export function ExportButton({ onClick, disabled, label = 'Export CSV' }: { onClick: () => void; disabled: boolean; label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Honest empty state: says whether nothing matched or the report failed. */
export function LedgerEmpty({ failed, title, description }: { failed: boolean; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-rule-strong bg-paper">
        <FileX className="h-5 w-5 text-ink-muted" aria-hidden="true" />
      </div>
      <p className="text-base font-semibold text-ink">{failed ? 'This report could not load' : title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">
        {failed ? 'The error is shown above. Change a filter or reload the page to try again.' : description}
      </p>
    </div>
  );
}

export function ChartSheet({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn('sheet min-w-0 px-5 py-4', className)}>
      <figcaption className="mb-3">
        <span className="block text-base font-semibold text-ink">{title}</span>
        {description && <span className="block text-sm text-ink-muted">{description}</span>}
      </figcaption>
      {/* font-variant-numeric inherits into the SVG tick labels */}
      <div className="tabular h-[280px] w-full">{children}</div>
    </figure>
  );
}
