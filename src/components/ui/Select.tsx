// ============================================================================
// SELECT COMPONENT
// ============================================================================

import { useState, useRef, useEffect, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { SelectProps, SelectOption } from '@/types';
import Icon from '@/components/AppIcon';

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      className,
      disabled = false,
      searchable = false,
      label,
      required = false,
      error,
      ...props
    },
    _ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const selectRef = useRef<HTMLDivElement>(null);

    const filteredOptions = searchable
      ? options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    const selectedOption = options.find(option => option.value === value);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOptionClick = (option: SelectOption) => {
      if (!option.disabled) {
        onChange?.(String(option.value));
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        
        <div ref={selectRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          >
            <span className={cn(
              'truncate',
              !selectedOption && 'text-muted-foreground'
            )}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <Icon
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              className="text-muted-foreground"
            />
          </button>

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg">
              {searchable && (
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Search options..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              
              <div className="max-h-60 overflow-auto">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => handleOptionClick(option)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
                        option.disabled && 'opacity-50 cursor-not-allowed',
                        option.value === value && 'bg-accent text-accent-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
