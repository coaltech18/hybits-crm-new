import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'destructive' | 'default';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// One primary action per view; everything else is the quiet outline or ghost.
const variantStyles: Record<string, string> = {
  primary: 'bg-brand-primary text-white shadow-sheet hover:bg-brand-primaryDark active:bg-brand-primaryActive',
  outline: 'bg-white text-ink border border-rule-strong shadow-sheet hover:bg-paper-sunk hover:border-ink-faint',
  danger: 'bg-danger text-white shadow-sheet hover:bg-danger-hover',
  ghost: 'bg-transparent text-ink-muted hover:bg-paper-sunk hover:text-ink',
};
variantStyles.secondary = variantStyles.outline;
variantStyles.default = variantStyles.outline;
variantStyles.destructive = variantStyles.danger;

const sizeStyles = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

const base =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold select-none ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-logo ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none [&_svg]:shrink-0';

/** A router link that looks like a Button (never nest <Button> inside <Link>). */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: LinkProps & { variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  return <Link className={cn(base, variantStyles[variant] ?? variantStyles.primary, sizeStyles[size], className)} {...props} />;
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
  return (
    <button
      className={cn(
        base,
        variantStyles[variant] ?? variantStyles.primary,
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
