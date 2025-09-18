// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

import { ValidationRule, FormErrors } from '@/types/forms';

/**
 * Validates a single field value against validation rules
 */
export function validateField(value: any, rules: ValidationRule[]): string | undefined {
  for (const rule of rules) {
    const error = validateRule(value, rule);
    if (error) return error;
  }
  return undefined;
}

/**
 * Validates a single rule
 */
function validateRule(value: any, rule: ValidationRule): string | undefined {
  switch (rule.type) {
    case 'required':
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return rule.message;
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return rule.message;
      }
      break;

    case 'min':
      if (value && value.length < rule.value) {
        return rule.message;
      }
      break;

    case 'max':
      if (value && value.length > rule.value) {
        return rule.message;
      }
      break;

    case 'pattern':
      if (value && !rule.value.test(value)) {
        return rule.message;
      }
      break;

    case 'custom':
      if (rule.validator && !rule.validator(value)) {
        return rule.message;
      }
      break;
  }
  return undefined;
}

/**
 * Validates an entire form object
 */
export function validateForm<T>(
  data: T,
  validationRules: Record<keyof T, ValidationRule[]>
): FormErrors {
  const errors: FormErrors = {};

  for (const [field, rules] of Object.entries(validationRules)) {
    const value = (data as any)[field];
    const error = validateField(value, rules as ValidationRule[]);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

/**
 * Common validation rules
 */
export const commonValidationRules = {
  required: (message: string = 'This field is required'): ValidationRule => ({
    type: 'required',
    message,
  }),

  email: (message: string = 'Please enter a valid email address'): ValidationRule => ({
    type: 'email',
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    type: 'min',
    value: min,
    message: message || `Must be at least ${min} characters long`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    type: 'max',
    value: max,
    message: message || `Must be no more than ${max} characters long`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    type: 'pattern',
    value: regex,
    message,
  }),

  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    type: 'custom',
    validator,
    message,
  }),
};

/**
 * Phone number validation
 */
export const phoneValidation = commonValidationRules.pattern(
  /^[\+]?[1-9][\d]{0,15}$/,
  'Please enter a valid phone number'
);

/**
 * GSTIN validation
 */
export const gstinValidation = commonValidationRules.pattern(
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  'Please enter a valid GSTIN'
);

/**
 * PIN code validation
 */
export const pincodeValidation = commonValidationRules.pattern(
  /^[1-9][0-9]{5}$/,
  'Please enter a valid 6-digit PIN code'
);
