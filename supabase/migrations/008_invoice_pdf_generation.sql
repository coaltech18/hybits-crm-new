-- ===================================================================
-- HYBITS CRM — Invoice PDF Generation (Stage 2)
-- Adds PDF storage columns to invoices table
-- ===================================================================

-- Add PDF storage columns to invoices table (idempotent)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT NULL;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_pdf_key TEXT NULL;

-- Add index for PDF key lookups
CREATE INDEX IF NOT EXISTS idx_invoices_pdf_key ON public.invoices(invoice_pdf_key) WHERE invoice_pdf_key IS NOT NULL;

-- End of 008_invoice_pdf_generation.sql
