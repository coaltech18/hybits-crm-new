import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action first, quieter ones after. Wraps on small screens. */
  actions?: React.ReactNode;
  back?: { to: string; label: string };
  /** Status stamp or badges beside the title. */
  meta?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, back, meta, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 lg:mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-ink-muted transition-colors hover:text-brand-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
