# Subscription Invoice Generation Scheduling

## Overview

The `generate_monthly_subscription_invoices` RPC function generates monthly invoices for all active customer subscriptions. This function can be run manually or scheduled to run automatically.

## Manual Execution

### Via Supabase SQL Editor

```sql
-- Generate invoices for current month
SELECT * FROM public.generate_monthly_subscription_invoices(CURRENT_DATE);

-- Generate invoices for a specific date
SELECT * FROM public.generate_monthly_subscription_invoices('2024-02-01'::DATE);
```

### Via Frontend

Use the "Generate Invoices" button in the Subscriptions page, which calls:
```typescript
await supabase.rpc('generate_monthly_subscription_invoices', { p_run_date: selectedDate })
```

## Automatic Scheduling

### Option 1: pg_cron Extension (Recommended if available)

If your Supabase project has the `pg_cron` extension enabled, you can schedule automatic execution:

```sql
-- Schedule to run on the 1st of each month at 02:00 UTC
SELECT cron.schedule(
  'monthly_subscription_invoices',
  '0 2 1 * *',
  $$SELECT public.generate_monthly_subscription_invoices(now()::date);$$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule if needed
SELECT cron.unschedule('monthly_subscription_invoices');
```

**Cron Schedule Format:** `minute hour day_of_month month day_of_week`
- `0 2 1 * *` = 02:00 UTC on the 1st of every month

### Option 2: External Scheduler (GitHub Actions, Vercel Cron, etc.)

If `pg_cron` is not available, use an external scheduler:

#### GitHub Actions Example

Create `.github/workflows/subscription-invoices.yml`:

```yaml
name: Generate Subscription Invoices

on:
  schedule:
    - cron: '0 2 1 * *'  # 1st of each month at 02:00 UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  generate-invoices:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase RPC
        run: |
          curl -X POST \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"p_run_date": "'$(date +%Y-%m-%d)'"}' \
            https://YOUR_PROJECT.supabase.co/rest/v1/rpc/generate_monthly_subscription_invoices
```

#### Vercel Cron Example

Create `api/cron/subscriptions.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc('generate_monthly_subscription_invoices', {
    p_run_date: new Date().toISOString().split('T')[0]
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ success: true, invoices: data });
}
```

Then add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/subscriptions",
    "schedule": "0 2 1 * *"
  }]
}
```

## Recommended Schedule

- **Frequency:** Monthly
- **Day:** 1st of each month
- **Time:** 02:00 UTC (to avoid peak usage hours)
- **Rationale:** Generates invoices at the start of each billing period

## Security Notes

⚠️ **IMPORTANT:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code. Only use it in:
- Server-side functions
- GitHub Actions secrets
- Environment variables in secure hosting platforms
- Supabase Edge Functions

## Testing

Before scheduling, test manually:

1. Create a test subscription
2. Run the RPC function manually
3. Verify invoices are created correctly
4. Check invoice totals match expected calculations
5. Verify `subscription_invoices` linking table is populated

## Monitoring

After scheduling, monitor:
- Invoice generation success rate
- Any errors in Supabase logs
- Customer complaints about missing invoices
- Payment reconciliation

