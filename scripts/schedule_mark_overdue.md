# Schedule run-mark-overdue Edge Function

## Overview
The `run-mark-overdue` Edge Function should be scheduled to run daily to mark overdue invoices and orders.

## Option 1: Supabase Cron Jobs (Recommended)

Supabase supports cron jobs via pg_cron extension. Create a SQL migration:

```sql
-- Schedule run-mark-overdue to run daily at 2 AM UTC
SELECT cron.schedule(
  'mark-overdue-daily',
  '0 2 * * *', -- 2 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-mark-overdue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**To apply:**
1. Replace `YOUR_PROJECT_REF` with your Supabase project reference
2. Replace `YOUR_ANON_KEY` with your Supabase anon key (or use a service role key for better security)
3. Run this SQL in your Supabase SQL editor or add as a migration

## Option 2: GitHub Actions (Alternative)

Create `.github/workflows/mark-overdue.yml`:

```yaml
name: Mark Overdue Daily

on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily
  workflow_dispatch: # Allow manual trigger

jobs:
  mark-overdue:
    runs-on: ubuntu-latest
    steps:
      - name: Call run-mark-overdue
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-mark-overdue \
            -d '{}'
```

**To set up:**
1. Add `SUPABASE_ANON_KEY` to GitHub Secrets
2. Replace `YOUR_PROJECT_REF` with your project reference
3. Commit and push the workflow file

## Option 3: External Cron Service

Use services like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **Zapier** (paid)
- **n8n** (self-hosted)

Configure to POST to:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-mark-overdue
```

With headers:
- `Authorization: Bearer YOUR_ANON_KEY`
- `Content-Type: application/json`

## Testing

Test the function manually:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-mark-overdue \
  -d '{}'
```

## Monitoring

- Check Supabase Edge Functions logs in dashboard
- Monitor invoice/order payment_status changes
- Set up alerts for function failures

## Security Notes

- Use service role key for cron jobs (not anon key) if possible
- Consider adding authentication/authorization to the function
- Rate limit the endpoint if exposed publicly

