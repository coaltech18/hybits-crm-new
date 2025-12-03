-- ===================================================================
-- HYBITS CRM — Vendor Subscription Invoice Generation
-- Creates linking table and RPC function for automatic monthly invoice generation
-- ===================================================================

-- Create vendor_subscription_invoices linking table (similar to subscription_invoices)
CREATE TABLE IF NOT EXISTS public.vendor_subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, billing_period_start, billing_period_end)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_invoices_subscription ON public.vendor_subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_invoices_invoice ON public.vendor_subscription_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_invoices_period ON public.vendor_subscription_invoices(billing_period_start, billing_period_end);

-- Enable RLS
ALTER TABLE public.vendor_subscription_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see invoices for subscriptions they can access
DROP POLICY IF EXISTS "Vendor subscription invoices read" ON public.vendor_subscription_invoices;
CREATE POLICY "Vendor subscription invoices read" ON public.vendor_subscription_invoices
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vendor_subscriptions vs
      WHERE vs.id = vendor_subscription_invoices.subscription_id
        AND (
          public.is_admin()
          OR vs.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
        )
    )
  );

-- Only service role can insert (via RPC function)
-- No policy needed - service role bypasses RLS

-- Grant permissions
GRANT SELECT ON public.vendor_subscription_invoices TO authenticated;
GRANT INSERT ON public.vendor_subscription_invoices TO service_role;

-- ===================================================================
-- RPC Function: Generate Monthly Invoices for Vendor Subscriptions
-- ===================================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_vendor_subscription_invoices(p_run_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(subscription_id UUID, invoice_id UUID, amount NUMERIC) AS $$
DECLARE
  rec RECORD;
  inv_id UUID;
  item_id UUID;
  billing_start DATE;
  billing_end DATE;
  days_in_period INTEGER;
  monthly_fee_val NUMERIC;
  gst_rate NUMERIC := 18; -- Default GST rate for vendor subscriptions
  taxable_value NUMERIC;
  gst_amount NUMERIC;
  total_amount_val NUMERIC;
  vendor_rec RECORD;
  customer_id_for_invoice UUID; -- We need a customer_id for invoices table
BEGIN
  FOR rec IN
    SELECT vs.*, v.outlet_id, v.name as vendor_name
    FROM public.vendor_subscriptions vs
    JOIN public.vendors v ON v.id = vs.vendor_id
    WHERE vs.status = 'active'
      AND (vs.subscription_start <= p_run_date)
      AND (vs.subscription_end IS NULL OR vs.subscription_end >= p_run_date)
      -- Only generate if invoice doesn't already exist for this period
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_subscription_invoices vsi
        WHERE vsi.subscription_id = vs.id
          AND vsi.billing_period_start = date_trunc('month', p_run_date)::date
      )
  LOOP
    billing_start := date_trunc('month', p_run_date)::date;
    billing_end := (date_trunc('month', p_run_date) + interval '1 month - 1 day')::date;
    
    -- Handle partial month if subscription started later or ended earlier
    IF rec.subscription_start > billing_start THEN
      billing_start := rec.subscription_start;
    END IF;
    IF rec.subscription_end IS NOT NULL AND rec.subscription_end < billing_end THEN
      billing_end := rec.subscription_end;
    END IF;
    
    days_in_period := (billing_end - billing_start + 1);
    
    -- Calculate monthly fee (prorated for partial months)
    -- Monthly fee is already set, so we prorate it based on days
    monthly_fee_val := ROUND((rec.monthly_fee * days_in_period) / 30, 2);
    
    -- Calculate GST (assuming 18% GST on vendor subscriptions)
    taxable_value := monthly_fee_val;
    gst_amount := ROUND(taxable_value * gst_rate / 100, 2);
    total_amount_val := taxable_value + gst_amount;
    
    -- Get vendor details to find a customer_id (or create a system customer)
    -- For vendor subscriptions, we might need a special "Vendor" customer
    -- For now, we'll use NULL customer_id and handle it in the invoice type
    -- Actually, invoices table requires customer_id, so we need to handle this
    
    -- Create a system customer for vendors if needed, or use a special handling
    -- For simplicity, we'll create invoices with a NULL customer_id (if allowed)
    -- But better: create a system "Vendor Payments" customer or use vendor as customer
    
    -- For vendor subscriptions, we need a customer_id for the invoices table
    -- Create or get a system customer for vendor invoices (one per outlet)
    SELECT id INTO customer_id_for_invoice
    FROM public.customers
    WHERE customer_code = format('VENDOR-SYS-%s', rec.outlet_id)
    LIMIT 1;
    
    -- If system customer doesn't exist, create it
    IF customer_id_for_invoice IS NULL THEN
      INSERT INTO public.customers (
        customer_code,
        name,
        contact_person,
        email,
        phone,
        outlet_id,
        status,
        notes
      )
      VALUES (
        format('VENDOR-SYS-%s', rec.outlet_id),
        'Vendor Payments (System)',
        'System Account',
        'vendor-payments@system.local',
        '0000000000',
        rec.outlet_id,
        'active',
        'System customer for vendor subscription invoices'
      )
      RETURNING id INTO customer_id_for_invoice;
    END IF;
    
    -- Create invoice with monthly fee
    INSERT INTO public.invoices (
      customer_id, 
      order_id, 
      outlet_id, 
      invoice_type, 
      invoice_date, 
      due_date, 
      subtotal, 
      taxable_value,
      cgst,
      sgst,
      igst,
      total_gst, 
      total_amount, 
      payment_received, 
      payment_status, 
      notes,
      created_by
    )
    VALUES (
      customer_id_for_invoice,
      NULL, 
      rec.outlet_id, 
      'rental', 
      p_run_date, 
      billing_end + INTERVAL '7 days', 
      taxable_value,
      taxable_value,
      CASE WHEN gst_rate > 0 THEN ROUND(gst_amount / 2, 2) ELSE 0 END, -- CGST (half of GST for intra-state)
      CASE WHEN gst_rate > 0 THEN ROUND(gst_amount / 2, 2) ELSE 0 END, -- SGST (half of GST for intra-state)
      0, -- IGST (for inter-state, but vendor subscriptions are typically intra-state)
      gst_amount, 
      total_amount_val, 
      0, 
      'pending',
      format('Vendor Subscription %s - Monthly fee for %s (Period: %s to %s)', 
        rec.vsub_code, rec.vendor_name, billing_start, billing_end),
      rec.created_by
    )
    RETURNING id INTO inv_id;
    
    -- Add invoice item: monthly subscription fee
    INSERT INTO public.invoice_items (
      invoice_id, 
      description, 
      quantity, 
      rate, 
      gst_rate, 
      amount,
      total_amount
    )
    VALUES (
      inv_id, 
      format('Vendor Subscription %s - Monthly Fee (%s days)', rec.vsub_code, days_in_period), 
      1, 
      monthly_fee_val, 
      gst_rate, 
      taxable_value,
      total_amount_val
    )
    RETURNING id INTO item_id;
    
    -- Link vendor_subscription_invoices
    INSERT INTO public.vendor_subscription_invoices (
      subscription_id, 
      invoice_id, 
      billing_period_start, 
      billing_period_end
    )
    VALUES (rec.id, inv_id, billing_start, billing_end);
    
    subscription_id := rec.id;
    invoice_id := inv_id;
    amount := total_amount_val;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_monthly_vendor_subscription_invoices(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_vendor_subscription_invoices(DATE) TO service_role;

-- ===================================================================
-- Update Customer Subscription Invoice Generator to use proper GST calculation
-- ===================================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_subscription_invoices(p_run_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(subscription_id UUID, invoice_id UUID, amount NUMERIC) AS $$
DECLARE
  rec RECORD;
  inv_id UUID;
  item_id UUID;
  billing_start DATE;
  billing_end DATE;
  days_in_period INTEGER;
  amount_val NUMERIC;
  taxable_value NUMERIC;
  gst_amount NUMERIC;
  total_amount_val NUMERIC;
  gst_rate_val NUMERIC;
BEGIN
  FOR rec IN
    SELECT cs.*
    FROM public.customer_subscriptions cs
    WHERE cs.status = 'active'
      AND (cs.start_date <= p_run_date)
      AND (cs.end_date IS NULL OR cs.end_date >= p_run_date)
      -- Only generate if invoice doesn't already exist for this period
      AND NOT EXISTS (
        SELECT 1 FROM public.subscription_invoices si
        WHERE si.subscription_id = cs.id
          AND si.billing_period_start = date_trunc('month', p_run_date)::date
      )
  LOOP
    billing_start := date_trunc('month', p_run_date)::date;
    billing_end := (date_trunc('month', p_run_date) + interval '1 month - 1 day')::date;
    
    -- Handle partial month if subscription started later or ended earlier
    IF rec.start_date > billing_start THEN
      billing_start := rec.start_date;
    END IF;
    IF rec.end_date IS NOT NULL AND rec.end_date < billing_end THEN
      billing_end := rec.end_date;
    END IF;
    
    days_in_period := (billing_end - billing_start + 1);
    
    -- Calculate monthly amount (prorated)
    amount_val := ROUND((rec.quantity_per_day * rec.unit_price * days_in_period), 2);
    
    -- Get GST rate
    gst_rate_val := COALESCE(rec.gst_rate::numeric, 18);
    
    -- Calculate GST
    taxable_value := amount_val;
    gst_amount := ROUND(taxable_value * gst_rate_val / 100, 2);
    total_amount_val := taxable_value + gst_amount;
    
    -- Create invoice with proper GST breakdown
    INSERT INTO public.invoices (
      customer_id, 
      order_id, 
      outlet_id, 
      invoice_type, 
      invoice_date, 
      due_date, 
      subtotal, 
      taxable_value,
      cgst,
      sgst,
      igst,
      total_gst, 
      total_amount, 
      payment_received, 
      payment_status, 
      notes,
      created_by
    )
    VALUES (
      rec.customer_id, 
      NULL, 
      rec.outlet_id, 
      'rental', 
      p_run_date, 
      billing_end + INTERVAL '7 days', 
      taxable_value,
      taxable_value,
      CASE WHEN gst_rate_val > 0 THEN ROUND(gst_amount / 2, 2) ELSE 0 END, -- CGST
      CASE WHEN gst_rate_val > 0 THEN ROUND(gst_amount / 2, 2) ELSE 0 END, -- SGST
      0, -- IGST (assuming intra-state)
      gst_amount, 
      total_amount_val, 
      0, 
      'pending',
      format('Subscription %s - Monthly charge (Period: %s to %s)', 
        rec.subscription_code, billing_start, billing_end),
      rec.created_by
    )
    RETURNING id INTO inv_id;
    
    -- Add invoice item: monthly subscription charge
    INSERT INTO public.invoice_items (
      invoice_id, 
      description, 
      quantity, 
      rate, 
      gst_rate, 
      amount,
      total_amount
    )
    VALUES (
      inv_id, 
      format('Subscription %s - Monthly charge (%s days)', rec.subscription_code, days_in_period), 
      (rec.quantity_per_day * days_in_period), 
      rec.unit_price, 
      gst_rate_val, 
      taxable_value,
      total_amount_val
    )
    RETURNING id INTO item_id;
    
    -- Link subscription_invoices
    INSERT INTO public.subscription_invoices (
      subscription_id, 
      invoice_id, 
      billing_period_start, 
      billing_period_end
    )
    VALUES (rec.id, inv_id, billing_start, billing_end);
    
    subscription_id := rec.id;
    invoice_id := inv_id;
    amount := total_amount_val;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End of 015_vendor_subscription_invoices.sql

