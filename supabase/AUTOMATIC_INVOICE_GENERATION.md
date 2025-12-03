# Automatic Invoice Generation Setup

This document explains how to set up automatic monthly invoice generation for both **Customer Subscriptions** and **Vendor Subscriptions**.

## Overview

The system includes two RPC functions that automatically generate monthly invoices:
1. `generate_monthly_subscription_invoices` - For customer subscriptions
2. `generate_monthly_vendor_subscription_invoices` - For vendor subscriptions

## How It Works

### Customer Subscriptions
- Generates invoices for active customer subscriptions
- Calculates prorated amounts for partial months
- Links invoices via `subscription_invoices` table
- Includes proper GST calculation (CGST/SGST/IGST)

### Vendor Subscriptions
- Generates invoices for active vendor subscriptions
- Creates system customer "Vendor Payments (System)" per outlet if needed
- Calculates monthly fee with GST
- Links invoices via `vendor_subscription_invoices` table

## Setup Options

### Option 1: Supabase Cron Jobs (Recommended)

Supabase supports PostgreSQL cron jobs via the `pg_cron` extension.

#### Step 1: Enable pg_cron Extension

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
```

#### Step 2: Schedule Monthly Invoice Generation

Run this SQL to schedule automatic invoice generation on the 1st of each month at 2 AM:

```sql
-- Schedule customer subscription invoices (1st of month, 2 AM)
SELECT cron.schedule(
  'generate-customer-subscription-invoices',
  '0 2 1 * *', -- 2 AM on 1st of every month
  $$
  SELECT * FROM public.generate_monthly_subscription_invoices(CURRENT_DATE);
  $$
);

-- Schedule vendor subscription invoices (1st of month, 2:05 AM)
SELECT cron.schedule(
  'generate-vendor-subscription-invoices',
  '5 2 1 * *', -- 2:05 AM on 1st of every month
  $$
  SELECT * FROM public.generate_monthly_vendor_subscription_invoices(CURRENT_DATE);
  $$
);
```

#### Step 3: Verify Scheduled Jobs

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname LIKE '%subscription-invoices%'
)
ORDER BY start_time DESC 
LIMIT 20;
```

### Option 2: External Cron Job (Alternative)

If pg_cron is not available, use an external cron service (e.g., GitHub Actions, Vercel Cron, or a dedicated server).

#### Using GitHub Actions

Create `.github/workflows/generate-invoices.yml`:

```yaml
name: Generate Monthly Invoices

on:
  schedule:
    # Run on 1st of every month at 2 AM UTC
    - cron: '0 2 1 * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  generate-invoices:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Customer Subscription Invoices
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/generate-invoices" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"type": "customer"}'
      
      - name: Generate Vendor Subscription Invoices
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/generate-invoices" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"type": "vendor"}'
```

### Option 3: Edge Function + Supabase Cron (Best for Production)

Create a Supabase Edge Function that calls both RPC functions, then schedule it.

#### Step 1: Create Edge Function

Create `supabase/functions/generate-monthly-invoices/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const runDate = new Date().toISOString().split('T')[0]
    
    // Generate customer subscription invoices
    const { data: customerResults, error: customerError } = await supabase
      .rpc('generate_monthly_subscription_invoices', { p_run_date: runDate })
    
    if (customerError) {
      console.error('Error generating customer invoices:', customerError)
    }
    
    // Generate vendor subscription invoices
    const { data: vendorResults, error: vendorError } = await supabase
      .rpc('generate_monthly_vendor_subscription_invoices', { p_run_date: runDate })
    
    if (vendorError) {
      console.error('Error generating vendor invoices:', vendorError)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        customerInvoices: customerResults?.length || 0,
        vendorInvoices: vendorResults?.length || 0,
        totalGenerated: (customerResults?.length || 0) + (vendorResults?.length || 0)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

#### Step 2: Schedule Edge Function

```sql
-- Schedule Edge Function call (1st of month, 2 AM)
SELECT cron.schedule(
  'generate-all-subscription-invoices',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/generate-monthly-invoices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
      'Content-Type', 'application/json'
    )
  ) AS request_id;
  $$
);
```

## Manual Invoice Generation

### Via UI

The application includes UI buttons to manually trigger invoice generation:
- **Customer Subscriptions Page**: "Generate Invoices" button
- **Vendor Subscriptions Page**: "Generate Invoices" button (to be added)

### Via API/Service

```typescript
import { BillingService } from '@/services/billingService';

// Generate all invoices
const results = await BillingService.generateAllMonthlyInvoices();

// Or generate separately
const customerInvoices = await BillingService.rpcGenerateMonthlyInvoices();
const vendorInvoices = await BillingService.rpcGenerateMonthlyVendorSubscriptionInvoices();
```

## Important Notes

1. **Duplicate Prevention**: Both RPC functions check for existing invoices for the billing period to prevent duplicates.

2. **Partial Months**: Invoices are prorated for partial months (e.g., if subscription starts mid-month).

3. **GST Calculation**: 
   - Customer subscriptions use the GST rate from the subscription record
   - Vendor subscriptions default to 18% GST (can be customized)

4. **System Customers**: Vendor subscription invoices use a system customer "Vendor Payments (System)" created automatically per outlet.

5. **Invoice Linking**: All invoices are properly linked via:
   - `subscription_invoices` (customer subscriptions)
   - `vendor_subscription_invoices` (vendor subscriptions)

6. **Payment Tracking**: Generated invoices have `payment_status = 'pending'` and can be tracked through the normal invoice payment flow.

## Testing

To test invoice generation manually:

```sql
-- Test customer subscription invoices
SELECT * FROM public.generate_monthly_subscription_invoices(CURRENT_DATE);

-- Test vendor subscription invoices
SELECT * FROM public.generate_monthly_vendor_subscription_invoices(CURRENT_DATE);
```

## Monitoring

Check invoice generation logs:

```sql
-- View recent invoices
SELECT 
  i.invoice_number,
  i.invoice_date,
  i.total_amount,
  i.payment_status,
  si.billing_period_start,
  si.billing_period_end
FROM invoices i
JOIN subscription_invoices si ON si.invoice_id = i.id
ORDER BY i.created_at DESC
LIMIT 20;

-- View vendor subscription invoices
SELECT 
  i.invoice_number,
  i.invoice_date,
  i.total_amount,
  i.payment_status,
  vsi.billing_period_start,
  vsi.billing_period_end,
  vs.vsub_code
FROM invoices i
JOIN vendor_subscription_invoices vsi ON vsi.invoice_id = i.id
JOIN vendor_subscriptions vs ON vs.id = vsi.subscription_id
ORDER BY i.created_at DESC
LIMIT 20;
```

## Troubleshooting

1. **No invoices generated**: Check that subscriptions are active and within date range
2. **Duplicate invoices**: The functions prevent duplicates, but if they occur, check the unique constraints
3. **Missing customer_id**: Vendor invoices create system customers automatically
4. **GST calculation errors**: Verify GST rates are set correctly on subscriptions

