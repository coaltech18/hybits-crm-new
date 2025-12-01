# Security Headers Documentation

## Overview

This document describes the security headers implemented in the Hybits CRM application. Security headers help protect against common web vulnerabilities such as XSS attacks, clickjacking, MIME type sniffing, and more.

## Headers Implemented

### Content-Security-Policy (CSP)
**Purpose:** Prevents XSS attacks by controlling which resources can be loaded and executed.

**Current Configuration:**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self';
frame-ancestors 'self'
```

**Where to Modify:**
- **Supabase Edge Functions:** `supabase/functions/_shared/securityHeaders.ts`
- **Node/Express Server:** In the server entry point file (if applicable)

**Adding Additional CDNs:**
To add a new CDN or external resource, update the appropriate directive in the CSP string:

```typescript
// Example: Adding a new script source
script-src 'self' 'unsafe-inline' https://new-cdn.example.com

// Example: Adding a new image source
img-src 'self' data: https: https://images.example.com
```

### Referrer-Policy
**Purpose:** Controls how much referrer information is sent with requests.

**Current Value:** `no-referrer-when-downgrade`

**Options:**
- `no-referrer` - Never send referrer
- `no-referrer-when-downgrade` - Send referrer for same-origin requests, HTTPS→HTTPS
- `origin` - Send only origin (not full URL)
- `strict-origin-when-cross-origin` - Send full URL for same-origin, origin for cross-origin HTTPS

### Permissions-Policy (formerly Feature-Policy)
**Purpose:** Controls which browser features and APIs can be used.

**Current Configuration:** `geolocation=(), camera=(), microphone=()`

This disables geolocation, camera, and microphone access by default. Modify as needed for your application requirements.

### X-Content-Type-Options
**Purpose:** Prevents browsers from MIME-sniffing responses.

**Current Value:** `nosniff`

This forces browsers to respect the declared Content-Type and prevents MIME type sniffing attacks.

### X-Frame-Options
**Purpose:** Prevents clickjacking attacks by controlling iframe embedding.

**Current Value:** `DENY`

**Options:**
- `DENY` - Never allow framing
- `SAMEORIGIN` - Allow framing from same origin
- `ALLOW-FROM uri` - Allow framing from specific URI (deprecated)

### Strict-Transport-Security (HSTS)
**Purpose:** Forces browsers to use HTTPS connections.

**Current Configuration:** Only enabled in production environments

**Header:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

**Note:** This header is only set when `NODE_ENV === 'production'` to avoid issues in development.

## Implementation Locations

### Supabase Edge Functions
**Important:** Supabase Edge Functions don't support shared modules across functions. Each function must have security headers inlined directly in its code.

Security headers are defined inline in each function file:
- `generate-invoice-pdf/index.ts`
- `run-mark-overdue/index.ts`
- `manage-users/index.ts`

**Reference file:** `supabase/functions/_shared/securityHeaders.ts` (for reference only, not imported)

**Note:** When updating security headers, you must update all three function files manually to keep them in sync.

### Node/Express Server
If a Node/Express server exists, security headers are set via middleware in the server entry point.

## Verification

### Verify Headers on Local Server
```bash
# For local development server (adjust port if different)
curl -I http://localhost:3000/ | grep -i "content-security-policy\|x-frame-options\|referrer-policy\|permissions-policy\|strict-transport-security\|x-content-type-options"
```

### Verify Supabase Edge Function Headers
```bash
# Replace <your-project> and <function-name> with actual values
curl -I https://<your-project>.supabase.co/functions/v1/generate-invoice-pdf \
  -H "Authorization: Bearer <YOUR_TOKEN>" | \
  grep -i "content-security-policy\|x-frame-options\|referrer-policy\|permissions-policy\|x-content-type-options"
```

### Expected Output
You should see headers like:
```
content-security-policy: default-src 'self'; script-src 'self' ...
x-frame-options: DENY
referrer-policy: no-referrer-when-downgrade
permissions-policy: geolocation=(), camera=(), microphone=()
x-content-type-options: nosniff
```

## CDN/Hosting Level Configuration

### Netlify `_headers` File
If deploying to Netlify, you can also set headers via a `public/_headers` file:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' ...
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer-when-downgrade
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  X-Content-Type-Options: nosniff
```

### Vercel `headers()` Function
If deploying to Vercel, you can use the `headers()` function in `vercel.json` or `next.config.js`:

```javascript
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; ..."
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
        // ... other headers
      ]
    }
  ]
}
```

## Troubleshooting

### CSP Violations
If you see CSP violations in the browser console:
1. Check which resource is being blocked
2. Add the appropriate source to the CSP directive
3. Update `securityHeaders.ts` and redeploy

### Development vs Production
- HSTS is only enabled in production to avoid issues with local development
- CSP can be relaxed in development if needed (not recommended)

### Testing
Always test security headers in a staging environment before deploying to production. Some headers (like HSTS) are cached by browsers and can cause issues if misconfigured.

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Security Headers Scanner](https://securityheaders.com/)

