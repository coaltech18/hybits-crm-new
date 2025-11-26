-- ===================================================================
-- HYBITS CRM — HSN/SAC, GST Rate & Per-Line Tax Engine (Stage 3)
-- Adds HSN/SAC codes, GST rates per item, and computed tax totals
-- ===================================================================

-- 1. Add HSN/SAC and GST rate columns to invoice_items table
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 18.00;

-- 2. Add computed tax total columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(14,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS cgst NUMERIC(14,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS sgst NUMERIC(14,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS igst NUMERIC(14,2) DEFAULT 0 NOT NULL;

-- Note: total_amount already exists, but ensure it's NUMERIC(14,2)
-- Must drop and recreate balance_due generated column first since it depends on total_amount
ALTER TABLE public.invoices 
DROP COLUMN IF EXISTS balance_due;

ALTER TABLE public.invoices 
ALTER COLUMN total_amount TYPE NUMERIC(14,2),
ALTER COLUMN total_amount SET DEFAULT 0,
ALTER COLUMN total_amount SET NOT NULL;

-- Recreate balance_due as generated column with correct type
ALTER TABLE public.invoices 
ADD COLUMN balance_due NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - COALESCE(payment_received, 0)) STORED;

-- 3. Add indexes for performance on GST rate and HSN code lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_gst_rate ON public.invoice_items(gst_rate);
CREATE INDEX IF NOT EXISTS idx_invoice_items_hsn_code ON public.invoice_items(hsn_code) WHERE hsn_code IS NOT NULL;

-- 4. Add indexes on invoice tax columns for reporting
CREATE INDEX IF NOT EXISTS idx_invoices_taxable_value ON public.invoices(taxable_value);
CREATE INDEX IF NOT EXISTS idx_invoices_cgst ON public.invoices(cgst);
CREATE INDEX IF NOT EXISTS idx_invoices_sgst ON public.invoices(sgst);
CREATE INDEX IF NOT EXISTS idx_invoices_igst ON public.invoices(igst);

-- 5. Add constraints to ensure valid GST rates (0-100%)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_gst_rate_valid') THEN
        ALTER TABLE public.invoice_items 
        ADD CONSTRAINT chk_gst_rate_valid 
        CHECK (gst_rate >= 0 AND gst_rate <= 100);
    END IF;
END $$;

-- 6. Add constraints to ensure non-negative tax amounts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_taxable_value_positive') THEN
        ALTER TABLE public.invoices 
        ADD CONSTRAINT chk_taxable_value_positive 
        CHECK (taxable_value >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cgst_positive') THEN
        ALTER TABLE public.invoices 
        ADD CONSTRAINT chk_cgst_positive 
        CHECK (cgst >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sgst_positive') THEN
        ALTER TABLE public.invoices 
        ADD CONSTRAINT chk_sgst_positive 
        CHECK (sgst >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_igst_positive') THEN
        ALTER TABLE public.invoices 
        ADD CONSTRAINT chk_igst_positive 
        CHECK (igst >= 0);
    END IF;
END $$;

-- 7. Update existing invoice_items with default GST rate if NULL
UPDATE public.invoice_items 
SET gst_rate = 18.00 
WHERE gst_rate IS NULL;

-- 8. Backfill existing invoices with computed totals (optional - can be run separately)
-- This is a safe operation that computes totals from existing invoice_items
-- Uncomment and run if you want to backfill existing data:

/*
UPDATE public.invoices 
SET 
  taxable_value = COALESCE(
    (SELECT SUM(quantity * unit_price) 
     FROM public.invoice_items 
     WHERE invoice_id = invoices.id), 
    0
  ),
  cgst = 0, -- Will be computed by application logic
  sgst = 0, -- Will be computed by application logic  
  igst = 0, -- Will be computed by application logic
  total_amount = COALESCE(
    (SELECT SUM(quantity * unit_price * (1 + COALESCE(gst_rate, 18.00) / 100)) 
     FROM public.invoice_items 
     WHERE invoice_id = invoices.id), 
    0
  )
WHERE taxable_value = 0 OR taxable_value IS NULL;
*/

-- End of 010_hsn_gst_tax_engine.sql
