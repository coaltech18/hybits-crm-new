// ============================================================================
// SECURITY HEADERS HELPER
// ============================================================================
// Shared security headers for Supabase Edge Functions (Deno)
// Import this in your function files and merge with response headers
// ============================================================================

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'",
  'Referrer-Policy': 'no-referrer-when-downgrade',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // X-XSS-Protection is deprecated; CSP is primary defense
};

