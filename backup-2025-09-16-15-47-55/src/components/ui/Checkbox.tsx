import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: string;
  className?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="space-y-2">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id={checkboxId}
            className={cn(
              "h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              error && "border-error focus:ring-error",
              className
            )}
            ref={ref}
            {...props}
          />
          {(label || description) && (
            <div className="space-y-1">
              {label && (
                <label
                  htmlFor={checkboxId}
                  className={cn(
                    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer",
                    error ? "text-error" : "text-foreground"
                  )}
                >
                  {label}
                  {props.required && <span className="text-error ml-1">*</span>}
                </label>
              )}
              {description && !error && (
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
              {error && (
                <p className="text-sm text-error">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

// Checkbox Group component
interface CheckboxGroupProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const CheckboxGroup = forwardRef<HTMLFieldSetElement, CheckboxGroupProps>(
  ({ className, children, label, description, error, required, disabled, ...props }, ref) => {
    return (
      <fieldset
        ref={ref}
        disabled={disabled}
        className={cn("space-y-3", className)}
        {...props}
      >
        {label && (
          <legend className={cn(
            "text-sm font-medium",
            error ? "text-error" : "text-foreground"
          )}>
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </legend>
        )}

        {description && !error && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}

        <div className="space-y-2">
          {children}
        </div>

        {error && (
          <p className="text-sm text-error">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
);

CheckboxGroup.displayName = "CheckboxGroup";

export { Checkbox, CheckboxGroup };
export default Checkbox;
