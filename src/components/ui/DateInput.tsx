import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FieldLabel, FieldMessage, fieldBase, fieldState } from './Input';

// ================================================================
// DATE INPUT — always day-first (DD/MM/YYYY), whatever the browser's
// language. A native <input type="date"> renders mm/dd/yyyy on an
// English (US) browser, which is a misread waiting to happen on bills.
// Value in and out is ISO YYYY-MM-DD (or '' when empty), so callers
// keep the same `e.target.value` handling as with a native input.
// The calendar button opens the native picker for mouse users.
// ================================================================

type DateChange = { target: { value: string; name?: string } };

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  value: string;
  onChange: (e: DateChange) => void;
  label?: string;
  error?: string;
  helperText?: string;
  min?: string;
  max?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Parse D/M/YYYY (also - . or space separated) to ISO; null if not a real date. */
export function displayToIso(text: string): string | null {
  const m = /^\s*(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})\s*$/.exec(text);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function DateInput({
  value, onChange, label, error, helperText, min, max, id, name, className, disabled, required, onBlur, ...rest
}: DateInputProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const msgId = `${inputId}-msg`;
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setTextState] = useState(isoToDisplay(value));
  const textRef = useRef(text);
  const setText = (t: string) => {
    textRef.current = t;
    setTextState(t);
  };
  const [localError, setLocalError] = useState<string | null>(null);

  // Follow outside changes (reset, prefill) unless the user is mid-typing a different date.
  useEffect(() => {
    if (displayToIso(textRef.current) !== value) {
      textRef.current = isoToDisplay(value);
      setTextState(textRef.current);
    }
  }, [value]);

  const emit = (iso: string) => onChange({ target: { value: iso, name } });

  const commit = (raw: string) => {
    if (!raw.trim()) {
      setLocalError(null);
      if (value !== '') emit('');
      return;
    }
    const iso = displayToIso(raw);
    if (!iso) return setLocalError('Enter the date as DD/MM/YYYY.');
    if (min && iso < min) return setLocalError(`Date can't be before ${isoToDisplay(min)}.`);
    if (max && iso > max) return setLocalError(`Date can't be after ${isoToDisplay(max)}.`);
    setLocalError(null);
    setText(isoToDisplay(iso));
    if (iso !== value) emit(iso);
  };

  const shownError = error || localError || undefined;

  return (
    <div className="w-full">
      {label && <FieldLabel htmlFor={inputId} required={required}>{label}</FieldLabel>}
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          value={text}
          disabled={disabled}
          required={required}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError || helperText ? msgId : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const iso = displayToIso(e.target.value);
            if (iso && (!min || iso >= min) && (!max || iso <= max)) {
              setLocalError(null);
              if (iso !== value) emit(iso);
            }
          }}
          onBlur={(e) => {
            commit(e.target.value);
            onBlur?.(e);
          }}
          className={cn(fieldBase, 'h-10 pr-10 tabular', fieldState(shownError), className)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.focus();
              el.click();
            }
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-muted hover:text-brand-primary disabled:opacity-40"
          aria-label="Open calendar"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            setLocalError(null);
            setText(isoToDisplay(e.target.value));
            emit(e.target.value);
          }}
        />
      </div>
      <FieldMessage id={msgId} error={shownError} helperText={helperText} />
    </div>
  );
}

if (import.meta.env?.DEV) {
  console.assert(displayToIso('5/9/2026') === '2026-09-05', 'day-first parse');
  console.assert(displayToIso('31/02/2026') === null, 'rejects impossible dates');
  console.assert(isoToDisplay('2026-10-29') === '29/10/2026', 'iso → display');
}
