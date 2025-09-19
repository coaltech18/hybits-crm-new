// ============================================================================
// CUSTOM FORM HOOK
// ============================================================================

import { useState, useCallback } from 'react';
import { ValidationRule, FormErrors } from '@/types/forms';
import { validateField } from '@/utils/validation';

export interface UseFormOptions<T> {
  initialData: T;
  validationRules?: Partial<Record<keyof T, ValidationRule[]>>;
  onSubmit: (data: T) => void | Promise<void>;
}

export interface UseFormReturn<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  setData: (data: Partial<T>) => void;
  reset: () => void;
}

export function useForm<T extends Record<string, any>>({
  initialData,
  validationRules = {},
  onSubmit,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [data, setDataState] = useState<T>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateFieldValue = useCallback((field: keyof T, value: any): string | undefined => {
    const rules = validationRules[field];
    if (!rules) return undefined;

    return validateField(value, rules);
  }, [validationRules]);

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    for (const field in validationRules) {
      const error = validateFieldValue(field, data[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [data, validationRules, validateFieldValue]);

  const handleChange = useCallback((field: keyof T) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : e.target.value;

      setDataState(prev => ({ ...prev, [field]: value }));
      
      // Clear error when user starts typing
      if (errors[field as string]) {
        setErrors(prev => ({ ...prev, [field as string]: undefined }));
      }
    };
  }, [errors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAll()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [data, validateAll, onSubmit]);

  const setError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field as string]: error }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => ({ ...prev, [field as string]: undefined }));
  }, []);

  const setData = useCallback((newData: Partial<T>) => {
    setDataState(prev => ({ ...prev, ...newData }));
  }, []);

  const reset = useCallback(() => {
    setDataState(initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  const isValid = Object.keys(errors).length === 0;

  return {
    data,
    errors,
    isSubmitting,
    isValid,
    handleChange,
    handleSubmit,
    setError,
    clearError,
    setData,
    reset,
  };
}
