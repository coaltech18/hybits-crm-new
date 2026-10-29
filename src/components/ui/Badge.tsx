import React from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant =
  | 'success' | 'warning' | 'danger' | 'destructive' | 'info' | 'default' | 'secondary'
  | 'draft' | 'final' | 'partial' | 'paid' | 'overdue' | 'void';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

// Carbon-copy tints: each state has its own hue so status scans without reading.
const variantStyles: Record<BadgeVariant, string> = {
  draft: 'bg-draft-tint text-draft border-draft-rule',
  final: 'bg-final-tint text-final border-final-rule',
  partial: 'bg-partial-tint text-partial border-partial-rule',
  paid: 'bg-stamp-tint text-stamp border-stamp-rule',
  overdue: 'bg-overdue-tint text-overdue border-overdue-rule',
  void: 'bg-void-tint text-void border-void-rule',
  success: 'bg-final-tint text-final border-final-rule',
  warning: 'bg-partial-tint text-partial border-partial-rule',
  danger: 'bg-danger-tint text-danger border-danger-rule',
  destructive: 'bg-danger-tint text-danger border-danger-rule',
  info: 'bg-info-tint text-info border-info-rule',
  secondary: 'bg-void-tint text-void border-void-rule',
  default: 'bg-paper-sunk text-ink-muted border-rule',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        variantStyles[variant] ?? variantStyles.default,
        className
      )}
    >
      {children}
    </span>
  );
}
