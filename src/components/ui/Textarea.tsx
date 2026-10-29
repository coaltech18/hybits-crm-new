import React, { useId } from 'react';
import { cn } from '@/utils/cn';
import { FieldLabel, FieldMessage, fieldBase, fieldState } from './Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const autoId = useId();
    const areaId = id || autoId;
    const msgId = `${areaId}-msg`;

    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={areaId} required={props.required}>{label}</FieldLabel>}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? msgId : undefined}
          className={cn(fieldBase, 'min-h-[88px] py-2 leading-relaxed resize-y', fieldState(error), className)}
          {...props}
        />
        <FieldMessage id={msgId} error={error} helperText={helperText} />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
