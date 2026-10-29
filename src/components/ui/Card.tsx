import React from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

/** A sheet on the paper ground. Never nest sheets. */
export function Card({ children, className, padding = 'md' }: CardProps) {
  return <div className={cn('sheet', paddingStyles[padding], className)}>{children}</div>;
}
