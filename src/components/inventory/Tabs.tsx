import React, { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

// ================================================================
// TABS — real ARIA tabs (tablist / tab / tabpanel) with roving
// focus: Left/Right/Home/End move between tabs and select them.
// `segmented` draws the two-task switch on Send & receive;
// `underline` draws report tabs.
// ================================================================

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Optional count shown after the label (e.g. rows still out). */
  count?: number;
  icon?: LucideIcon;
}

const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

export function TabList<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
  label,
  variant = 'underline',
  className,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix: string;
  label: string;
  variant?: 'underline' | 'segmented';
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  const segmented = variant === 'segmented';

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        segmented
          ? 'inline-flex w-full rounded-lg border border-rule-strong bg-paper-sunk p-1 sm:w-auto'
          : 'flex gap-1 overflow-x-auto border-b border-rule',
        className
      )}
    >
      {tabs.map((t, i) => {
        const on = t.id === active;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={tabId(idPrefix, t.id)}
            aria-selected={on}
            aria-controls={panelId(idPrefix, t.id)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-logo',
              segmented
                ? cn(
                    'h-9 flex-1 rounded-md px-4 sm:flex-none',
                    on ? 'bg-white text-ink shadow-sheet' : 'text-ink-muted hover:text-ink'
                  )
                : cn(
                    '-mb-px h-11 border-b-2 px-3',
                    on ? 'border-brand-primary text-brand-primary' : 'border-transparent text-ink-muted hover:border-rule-strong hover:text-ink'
                  )
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-md px-1.5 text-xs font-semibold',
                  on ? 'bg-partial-tint text-partial' : 'bg-white/70 text-ink-muted'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  id,
  children,
  className,
}: {
  idPrefix: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} tabIndex={0} className={cn('focus-visible:outline-none', className)}>
      {children}
    </div>
  );
}
