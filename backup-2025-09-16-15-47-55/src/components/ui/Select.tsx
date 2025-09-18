import { forwardRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { SelectProps } from '@/types';
import Icon from '@/components/AppIcon';

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, value, onChange, placeholder, disabled, searchable, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = searchable 
      ? options.filter(option => 
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    const selectedOption = options.find(option => option.value === value);

    if (searchable) {
      return (
        <div className="relative w-full">
          <div
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
              className
            )}
            onClick={() => !disabled && setIsOpen(!isOpen)}
          >
            <span className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground"
            )}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <Icon 
              name={isOpen ? "ChevronUp" : "ChevronDown"} 
              size={16} 
              className="text-muted-foreground" 
            />
          </div>

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-lg shadow-lg max-h-60 overflow-hidden">
              {searchable && (
                <div className="p-2 border-b border-input">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <div className="max-h-48 overflow-y-auto">
                {filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors",
                      option.disabled && "opacity-50 cursor-not-allowed",
                      option.value === value && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange?.(String(option.value));
                        setIsOpen(false);
                        setSearchTerm('');
                      }
                    }}
                  >
                    {option.label}
                  </div>
                ))}
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No options found
                  </div>
                )}
              </div>
            </div>
          )}

          {isOpen && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
          )}
        </div>
      );
    }

    return (
      <select
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        ref={ref}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = "Select";

export default Select;
