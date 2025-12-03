-- ============================================================================
-- Migration: Invoice Creation Audit Table
-- ============================================================================
-- Creates audit table to track invoice creation attempts for orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_creation_audit (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES public.rental_orders(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  requester_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  attempt_integer INTEGER NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_invoice_creation_audit_order_id ON public.invoice_creation_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_creation_audit_invoice_id ON public.invoice_creation_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_creation_audit_created_at ON public.invoice_creation_audit(created_at DESC);

-- Enable RLS
ALTER TABLE public.invoice_creation_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view audit entries for orders they have access to
CREATE POLICY "Users can view invoice creation audit for accessible orders"
  ON public.invoice_creation_audit
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
    OR
    -- Manager/Accountant can see their outlet's audits
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND (
        invoice_creation_audit.outlet_id = up.outlet_id
        OR invoice_creation_audit.outlet_id IS NULL
      )
    )
  );

-- RLS Policy: Service role can insert audit entries
CREATE POLICY "Service role can insert invoice creation audit"
  ON public.invoice_creation_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.invoice_creation_audit TO authenticated;
GRANT INSERT ON public.invoice_creation_audit TO service_role;

-- Add comment
COMMENT ON TABLE public.invoice_creation_audit IS 
  'Audit trail for invoice creation attempts from orders. Tracks retries, errors, and success.';

