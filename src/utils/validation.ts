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

/**
 * Indian date format validation (DD-MM-YYYY)
 */
export const indianDateValidation = commonValidationRules.custom(
  (value: string) => {
    if (!value) return true; // Let required validation handle empty values
    
    const parts = value.split('-');
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0] || '0', 10);
    const month = parseInt(parts[1] || '0', 10);
    const year = parseInt(parts[2] || '0', 10);
    
    // Check if all parts are valid numbers
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    
    // Check ranges
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    
    // Check if the date is valid
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  },
  'Please enter a valid date in DD-MM-YYYY format'
);