import { cn } from '@/utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeStyles = { sm: 'h-4 w-4', md: 'h-7 w-7', lg: 'h-10 w-10' };

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" role="status">
      <svg className={cn('animate-spin text-brand-primary', sizeStyles[size], className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Placeholder lines while content loads; keeps the layout instead of blanking the page. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md h-4', className)} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-rule/70" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={c === 0 ? 'w-28' : 'flex-1'} />
          ))}
        </div>
      ))}
    </div>
  );
}
