import React from 'react';
import { cn } from '@/utils/cn';

// ================================================================
// INVENTORY MODAL PARTS — presentational pieces shared by the
// stock-movement dialogs. No state, no data access.
// ================================================================

export type FactTone = 'ink' | 'final' | 'info' | 'partial' | 'overdue' | 'void';

const toneClass: Record<FactTone, string> = {
  ink: 'text-ink',
  final: 'text-final',
  info: 'text-info',
  partial: 'text-partial',
  overdue: 'text-overdue',
  void: 'text-void',
};

export interface Fact {
  label: string;
  value: React.ReactNode;
  tone?: FactTone;
}

/** The record being acted on: its name, then the quantities that bound the action. */
export function FactWell({ eyebrow, title, facts = [] }: { eyebrow: string; title: React.ReactNode; facts?: Fact[] }) {
  return (
    <div className="rounded-lg border border-rule bg-paper px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{eyebrow}</p>
          <p className="mt-0.5 break-words text-base font-semibold text-ink">{title}</p>
        </div>
        {facts.length > 0 && (
          <dl className="flex gap-6">
            {facts.map((f) => (
              <div key={f.label} className="text-right">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{f.label}</dt>
                <dd className={cn('tabular mt-0.5 text-2xl font-semibold leading-none', toneClass[f.tone ?? 'ink'])}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

/** Dialog footer: Cancel first, the primary action bottom-right (stacked, primary on top, on phones). */
export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex flex-col-reverse gap-2 border-t border-rule bg-white px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  );
}

export interface Choice<V extends string> {
  value: V;
  label: string;
  hint?: string;
  tone?: 'final' | 'partial' | 'overdue' | 'info';
}

const choiceOn: Record<NonNullable<Choice<string>['tone']>, string> = {
  final: 'border-final bg-final-tint text-final',
  partial: 'border-partial bg-partial-tint text-partial',
  overdue: 'border-overdue bg-overdue-tint text-overdue',
  info: 'border-info bg-info-tint text-info',
};

/** A labelled radio group drawn as segmented choices (fieldset + legend, real radios). */
export function ChoiceGroup<V extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: V;
  options: Choice<V>[];
  onChange: (value: V) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold text-ink">{legend}</legend>
      <div className={cn('grid gap-2', options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-logo',
                on ? choiceOn[o.tone ?? 'final'] : 'border-rule-strong bg-white text-ink hover:border-ink-faint'
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{o.label}</span>
              {o.hint && <span className={cn('text-xs', on ? 'text-current' : 'text-ink-muted')}>{o.hint}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Search results for picking a subscription or event. Each row is a real button. */
export function PickList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ul aria-label={label} className="mt-2 max-h-56 divide-y divide-rule overflow-y-auto rounded-lg border border-rule bg-white">
      {children}
    </ul>
  );
}

export function PickRow({ onPick, title, meta }: { onPick: () => void; title: string; meta?: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-final-tint/50 focus-visible:bg-final-tint/50 focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          {meta && <span className="block text-xs capitalize text-ink-muted">{meta}</span>}
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand-primary">Select</span>
      </button>
    </li>
  );
}

/** The chosen subscription or event, with a quiet way to change it. */
export function PickedReference({ kind, name, onChange }: { kind: string; name: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-final-rule bg-final-tint px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-final">{kind}</p>
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand-primary hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-logo"
      >
        Change
      </button>
    </div>
  );
}
