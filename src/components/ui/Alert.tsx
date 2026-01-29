import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
  className?: string;
}

export function Alert({ children, variant = 'info', className }: AlertProps) {
  const variantStyles = {
    success: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-brand-primary/10 text-brand-text border-brand-border',
    info: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
  };

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const Icon = icons[variant];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        variantStyles[variant],
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
