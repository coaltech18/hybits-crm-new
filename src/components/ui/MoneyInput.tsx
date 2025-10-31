// ============================================================================
// MONEY INPUT (Indian grouping)
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/utils/cn';

export interface MoneyInputProps {
  label?: string;
  value?: number;
  onValueChange?: (value: number | undefined) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function formatINR(input: string) {
  if (input === '') return '';
  const num = Number(input.replace(/\D/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-IN').format(num);
}

const MoneyInput: React.FC<MoneyInputProps> = ({
  label,
  value,
  onValueChange,
  required,
  disabled,
  className,
  placeholder = '0'
}) => {
  const [raw, setRaw] = useState<string>('');

  useEffect(() => {
    if (value === undefined || value === null) {
      setRaw('');
    } else if (!document.activeElement || (document.activeElement as HTMLElement).tagName !== 'INPUT') {
      // On external updates, sync display
      setRaw(String(value));
    }
  }, [value]);

  const display = useMemo(() => formatINR(raw), [raw]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setRaw(digits);
    onValueChange?.(digits === '' ? undefined : Number(digits));
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <div className={cn('flex w-full items-center rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring h-10 overflow-hidden', className)}>
        <span className="px-3 text-sm text-muted-foreground select-none">₹</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9,]*"
          className="flex-1 h-full bg-transparent outline-none text-sm px-1"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      </div>
    </div>
  );
};

export default MoneyInput;
