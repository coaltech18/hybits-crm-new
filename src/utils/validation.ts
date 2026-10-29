// ================================================================
// VALIDATION UTILITIES
// ================================================================
// Production-grade validation functions for forms and data
// ================================================================

/**
 * Validate GSTIN format (15 characters)
 * Format: 2-digit state code + 10-digit PAN + 1 check digit + Z + 1 alphanumeric
 * Example: 27AAPFU0939F1ZV
 */
export function validateGSTIN(gstin: string): { valid: boolean; error?: string } {
  if (!gstin || gstin.trim() === '') {
    return { valid: true }; // GSTIN is optional
  }

  const trimmed = gstin.trim().toUpperCase();

  // Check length
  if (trimmed.length !== 15) {
    return {
      valid: false,
      error: 'GSTIN must be exactly 15 characters',
    };
  }

  // Check format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Example: 27AAPFU0939F1ZV',
    };
  }

  // State code: 01-38, or 97 (Other Territory)
  const stateCode = parseInt(trimmed.slice(0, 2), 10);
  if (!((stateCode >= 1 && stateCode <= 38) || stateCode === 97)) {
    return {
      valid: false,
      error: 'Invalid GSTIN state code (first two digits)',
    };
  }

  // Check digit (15th character): GSTN mod-36 checksum
  if (computeGstinCheckChar(trimmed) !== trimmed[14]) {
    return {
      valid: false,
      error: 'Invalid GSTIN check digit. Please re-check the number.',
    };
  }

  return { valid: true };
}

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Compute the GSTIN check character from the first 14 characters. */
function computeGstinCheckChar(gstin: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARSET.indexOf(gstin[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GSTIN_CHARSET[(36 - (sum % 36)) % 36];
}

/**
 * Validate Indian phone number
 * Accepts: 10-digit mobile (6-9 start) with optional +91 or 91 prefix,
 * or an 11-digit landline with STD code (leading 0, e.g. 080-12345678)
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove all spaces, hyphens, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Check various formats
  const patterns = [
    /^[6-9]\d{9}$/, // 10 digits starting with 6-9
    /^\+91[6-9]\d{9}$/, // +91 prefix
    /^91[6-9]\d{9}$/, // 91 prefix
    /^0\d{10}$/, // landline with STD code
  ];

  const isValid = patterns.some(pattern => pattern.test(cleaned));

  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid phone number. Use a 10-digit mobile starting with 6-9, or a landline with STD code (e.g. 080-12345678)',
    };
  }

  return { valid: true };
}

/**
 * Normalize phone number to standard format (+91XXXXXXXXXX)
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // If already has +91 prefix
  if (cleaned.startsWith('+91')) {
    return cleaned;
  }

  // If has 91 prefix without +
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // If just 10 digits, add +91
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }

  return cleaned;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim() === '') {
    return { valid: true }; // Email is optional in most forms
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email.trim())) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }

  return { valid: true };
}

/**
 * Validate required text field
 */
export function validateRequired(
  value: string | null | undefined,
  fieldName: string
): { valid: boolean; error?: string } {
  if (!value || value.trim() === '') {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  return { valid: true };
}

/**
 * Validate minimum length
 */
export function validateMinLength(
  value: string,
  minLength: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (value.trim().length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate maximum length
 */
export function validateMaxLength(
  value: string,
  maxLength: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (value.trim().length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${maxLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate pincode (6 digits)
 */
export function validatePincode(pincode: string): { valid: boolean; error?: string } {
  if (!pincode || pincode.trim() === '') {
    return { valid: true }; // Pincode is optional
  }

  const pincodePattern = /^[1-9][0-9]{5}$/;

  if (!pincodePattern.test(pincode.trim())) {
    return {
      valid: false,
      error: 'Invalid pincode. Must be 6 digits',
    };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters',
    };
  }

  // Check for at least one uppercase, one lowercase, one number
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, and number',
    };
  }

  return { valid: true };
}
