import React from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'destructive' | 'default';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-offset-brand-bg';

  const variantStyles: Record<string, string> = {
    primary: 'bg-brand-primary text-white hover:bg-brand-primaryDark focus:ring-brand-primary',
    secondary: 'border border-brand-primary text-brand-primary hover:bg-brand-primary/10 focus:ring-brand-primary',
    outline: 'border border-brand-primary text-brand-primary hover:bg-brand-primary/10 focus:ring-brand-primary',
    default: 'border border-brand-primary text-brand-primary hover:bg-brand-primary/10 focus:ring-brand-primary',
    danger: 'bg-brand-deep text-white hover:opacity-90 focus:ring-brand-deep',
    destructive: 'bg-brand-deep text-white hover:opacity-90 focus:ring-brand-deep',
    ghost: 'bg-transparent text-brand-text hover:bg-brand-border/50 focus:ring-brand-text',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant] ?? variantStyles.primary,
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}
