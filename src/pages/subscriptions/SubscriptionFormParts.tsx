import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

// ================================================================
// SUBSCRIPTION FORM PARTS — layout pieces shared by the add and edit
// forms. Presentation only: no state beyond what the caller passes.
// ================================================================

/** A titled section of the form sheet. Sections are divided by hairlines. */
export function FormSection({
  title, description, children, className,
}: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('px-5 py-6 sm:px-6', className)}>
      <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** An optional section that opens on demand. `open` is presentational state owned by the caller. */
export function CollapsibleSection({
  title, description, open, onToggle, badge, children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const regionId = useId();
  return (
    <section className="px-5 py-5 sm:px-6">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={regionId}
          className="group flex w-full items-start justify-between gap-4 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-logo"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink group-hover:text-brand-primary">
              {title}
              <span className="text-sm font-normal text-ink-muted">(optional)</span>
              {badge}
            </span>
            <span className="mt-0.5 block text-sm font-normal text-ink-muted">{description}</span>
          </span>
          <ChevronDown
            className={cn('mt-1 h-5 w-5 shrink-0 text-ink-muted transition-transform duration-150', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id={regionId} className="mt-5">
          {children}
        </div>
      )}
    </section>
  );
}

/** Live "value per cycle" figure: quantity × price. */
export function ValueReadout({ quantity, price, note }: { quantity: number; price: number; note?: string }) {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const p = Number.isFinite(price) ? price : 0;
  return (
    <div className="rounded-lg border border-rule bg-paper-sunk px-4 py-3" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Value per cycle</span>
        <span className="amount text-2xl font-bold tracking-tight text-ink">{formatCurrency(q * p)}</span>
      </div>
      <p className="amount mt-0.5 text-right text-sm text-ink-muted">
        {new Intl.NumberFormat('en-IN').format(q)} × {formatCurrency(p)}
      </p>
      {note && <p className="mt-2 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

/** The form's sticky bottom bar: Cancel (outline) then the primary save. */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-sheet border-t border-rule bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  );
}
