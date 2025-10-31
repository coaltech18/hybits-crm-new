// ============================================================================
// PHONE INPUT (+91 prefix)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

export interface PhoneInputProps {
  label?: string;
  value?: string;
  onChange?: (fullValue: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  placeholder = 'Enter phone number'
}) => {
  const [digits, setDigits] = useState<string>('');

  // Initialize digits from incoming value
  useEffect(() => {
    if (!value) return;
    if (value.startsWith('+91')) {
      setDigits(value.replace('+91', '').replace(/\D/g, '').slice(0, 10));
    } else {
      setDigits(value.replace(/\D/g, '').slice(0, 10));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setDigits(onlyDigits);
    onChange?.(`+91${onlyDigits}`);
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
        <span className="px-3 text-sm text-muted-foreground select-none">+91</span>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          className="flex-1 h-full bg-transparent outline-none text-sm px-1"
          value={digits}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      </div>
    </div>
  );
};

export default PhoneInput;
