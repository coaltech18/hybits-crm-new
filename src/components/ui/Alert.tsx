import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
  className?: string;
}

const variantStyles = {
  success: 'bg-final-tint text-final border-final-rule',
  error: 'bg-danger-tint text-danger border-danger-rule',
  warning: 'bg-partial-tint text-partial border-partial-rule',
  info: 'bg-info-tint text-info border-info-rule',
};

const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export function Alert({ children, variant = 'info', className }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', variantStyles[variant], className)}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 [&_p]:text-current">{children}</div>
    </div>
  );
}
