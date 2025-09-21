// ============================================================================
// INPUT COMPONENT
// ============================================================================

import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { InputProps } from '@/types';

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      placeholder,
      value,
      onChange,
      onBlur,
      onFocus,
      className,
      disabled = false,
      required = false,
      error,
      label,
      multiline = false,
      rows = 3,
      readOnly = false,
      min,
      max,
      step,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors';

    const inputElement = multiline ? (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        placeholder={placeholder}
        value={value}
        onChange={onChange as any}
        onBlur={onBlur as any}
        onFocus={onFocus as any}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        rows={rows}
        className={cn(
          baseClasses,
          'min-h-[80px] resize-none',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    ) : (
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        className={cn(
          baseClasses,
          'h-10',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        {...props}
      />
    );

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        {inputElement}
        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
