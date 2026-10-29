import React from 'react';
import { Building2, PartyPopper } from 'lucide-react';
import type { ClientType } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

// ================================================================
// CLIENT MODULE PARTS — shared by the clients list, detail and forms.
// Presentation only: no data, no state of their own.
// ================================================================

const TYPE_COPY: Record<ClientType, { label: string; hint: string; icon: typeof Building2 }> = {
  corporate: { label: 'Corporate', hint: 'Recurring subscriptions, billed daily, weekly or monthly', icon: Building2 },
  event: { label: 'Event', hint: 'One-off bookings such as weddings and functions', icon: PartyPopper },
};

export function ClientTypeBadge({ type, className }: { type: ClientType; className?: string }) {
  return (
    <Badge variant={type === 'corporate' ? 'info' : 'partial'} className={className}>
      {TYPE_COPY[type]?.label ?? type}
    </Badge>
  );
}

export function ClientActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge variant={active ? 'final' : 'void'} className={className}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

/** One section of a form sheet. Sections after the first get a hairline rule above. */
export function FormSection({
  title, description, children, id,
}: { title: string; description?: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-rule px-5 py-6 first:border-t-0 sm:px-6">
      <div className="mb-4">
        <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** Corporate / Event as a pair of radio cards inside a fieldset. */
export function ClientTypeChoice({
  value, onChange, name = 'client_type',
}: { value: ClientType | undefined; onChange: (type: ClientType) => void; name?: string }) {
  return (
    <fieldset className="md:col-span-2">
      {/* The section heading names the group visibly; the legend names it for assistive tech. */}
      <legend className="sr-only">Client type (required)</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(['corporate', 'event'] as const).map((type) => {
          const { label, hint, icon: Icon } = TYPE_COPY[type];
          const checked = value === type;
          return (
            <label
              key={type}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-4 py-3 transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-logo',
                checked ? 'border-brand-primary bg-final-tint/50' : 'border-rule-strong hover:border-ink-faint'
              )}
            >
              <input
                type="radio"
                name={name}
                value={type}
                checked={checked}
                onChange={(e) => onChange(e.target.value as ClientType)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className={cn('h-4 w-4', checked ? 'text-brand-primary' : 'text-ink-muted')} aria-hidden="true" />
                  {label}
                </span>
                <span className="mt-0.5 block text-sm text-ink-muted">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Read-only view of the client type, for when it cannot be changed. */
export function ClientTypeReadout({ type, note }: { type: ClientType; note?: string }) {
  const { label, hint, icon: Icon } = TYPE_COPY[type] ?? TYPE_COPY.corporate;
  return (
    <div className="md:col-span-2">
      <div className="flex items-start gap-3 rounded-lg border border-rule bg-paper-sunk px-4 py-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-sm text-ink-muted">{hint}</p>
        </div>
      </div>
      {note && <p className="mt-1.5 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

/** Sticky bottom bar of a form sheet: Cancel then Save. */
export function FormActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-b-sheet border-t border-rule bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
      {children}
    </div>
  );
}
