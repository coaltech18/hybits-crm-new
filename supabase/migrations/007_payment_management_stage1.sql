-- ===================================================================
-- HYBITS CRM — Payment Management System (Stage 1)
-- Adds soft delete support and ensures proper invoice payment tracking
-- ===================================================================

-- 1. Add deleted_at column to payments table for soft delete
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Ensure invoices.payment_received is NUMERIC(14,2) with default 0
-- Note: Must drop and recreate balance_due generated column first since it depends on payment_received
ALTER TABLE public.invoices 
DROP COLUMN IF EXISTS balance_due;

ALTER TABLE public.invoices 
ALTER COLUMN payment_received TYPE NUMERIC(14,2),
ALTER COLUMN payment_received SET DEFAULT 0;

-- Recreate balance_due as generated column with correct type
ALTER TABLE public.invoices 
ADD COLUMN balance_due NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - payment_received) STORED;

-- 3. Ensure invoices.payment_status has default 'pending'
ALTER TABLE public.invoices 
ALTER COLUMN payment_status SET DEFAULT 'pending';

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at) WHERE deleted_at IS NOT NULL;

-- End of 007_payment_management_stage1.sql

