import React, { useId } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const fieldBase =
  'block w-full rounded-lg border bg-white px-3 text-sm text-ink shadow-[inset_0_1px_1px_rgba(15,61,49,0.04)] ' +
  'placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 ' +
  'focus:outline-none focus:border-brand-logo focus:ring-[3px] focus:ring-brand-logo/20 ' +
  'disabled:bg-paper-sunk disabled:text-ink-muted disabled:cursor-not-allowed';

export const fieldState = (error?: string) =>
  error ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-rule-strong hover:border-ink-faint';

export function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
    </label>
  );
}

export function FieldMessage({ id, error, helperText }: { id: string; error?: string; helperText?: string }) {
  if (error) return <p id={id} className="mt-1.5 text-sm text-danger">{error}</p>;
  if (helperText) return <p id={id} className="mt-1.5 text-sm text-ink-muted">{helperText}</p>;
  return null;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    const msgId = `${inputId}-msg`;

    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={inputId} required={props.required}>{label}</FieldLabel>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? msgId : undefined}
          className={cn(fieldBase, 'h-10', fieldState(error), className)}
          {...props}
        />
        <FieldMessage id={msgId} error={error} helperText={helperText} />
      </div>
    );
  }
);

Input.displayName = 'Input';
