import React from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'destructive' | 'info' | 'default' | 'secondary';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    success: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
    warning: 'bg-brand-primary/20 text-brand-text border-brand-border',
    danger: 'bg-red-100 text-red-800 border-red-200',
    destructive: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
    default: 'bg-brand-border/50 text-brand-text border-brand-border',
    secondary: 'bg-brand-border/50 text-brand-text border-brand-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant] ?? variantStyles.default,
        className
      )}
    >
      {children}
    </span>
  );
}
