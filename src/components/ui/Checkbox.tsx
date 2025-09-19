// ============================================================================
// CHECKBOX COMPONENT
// ============================================================================

import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  required?: boolean;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked = false,
      onChange,
      disabled = false,
      label,
      className,
      id,
      name,
      value,
      required = false,
      error,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked);
    };

    const checkboxElement = (
      <input
        ref={ref}
        type="checkbox"
        id={id}
        name={name}
        value={value}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={cn(
          'h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus:ring-destructive',
          className
        )}
        {...props}
      />
    );

    if (label) {
      return (
        <div className="w-full">
          <div className="flex items-center space-x-2">
            {checkboxElement}
            <label
              htmlFor={id}
              className={cn(
                'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                error && 'text-destructive'
              )}
            >
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
          </div>
          {error && (
            <p className="mt-1 text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    return checkboxElement;
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;

// Checkbox Group Component
export interface CheckboxGroupProps {
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  error?: string;
  required?: boolean;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  options,
  value,
  onChange,
  className,
  error,
}) => {
  const handleChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter(v => v !== optionValue));
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          id={`checkbox-${option.value}`}
          checked={value.includes(option.value)}
          onChange={(checked) => handleChange(option.value, checked)}
          disabled={option.disabled || false}
          label={option.label}
        />
      ))}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
