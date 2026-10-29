import React, { useId } from 'react';
import { cn } from '@/utils/cn';
import { FieldLabel, FieldMessage, fieldBase, fieldState } from './Input';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%234A5E57' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_0.6rem_center]";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className, id, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;
    const msgId = `${selectId}-msg`;

    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={selectId} required={props.required}>{label}</FieldLabel>}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? msgId : undefined}
          className={cn(fieldBase, 'h-10 appearance-none pr-9 cursor-pointer', chevron, fieldState(error), className)}
          {...props}
        >
          {options && Array.isArray(options)
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <FieldMessage id={msgId} error={error} helperText={helperText} />
      </div>
    );
  }
);

Select.displayName = 'Select';
