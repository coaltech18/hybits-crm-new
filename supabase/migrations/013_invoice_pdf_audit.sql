-- ===================================================================
-- HYBITS CRM — Invoice PDF Audit Table
-- Tracks PDF generation events for audit and compliance
-- ===================================================================

-- Create audit table (idempotent)
CREATE TABLE IF NOT EXISTS public.invoice_pdf_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES public.user_profiles(id),
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  pdf_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_audit_invoice_id ON public.invoice_pdf_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_audit_generated_by ON public.invoice_pdf_audit(generated_by);
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_audit_generated_at ON public.invoice_pdf_audit(generated_at);

-- Enable RLS
ALTER TABLE public.invoice_pdf_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see audit logs for invoices they can access
CREATE POLICY "Invoice PDF audit read own outlet" ON public.invoice_pdf_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE i.id = invoice_pdf_audit.invoice_id
        AND (
          up.role = 'admin' OR 
          i.outlet_id = up.outlet_id
        )
    )
  );

-- Only service role can insert audit logs (Edge Functions use service role)
-- No policy needed - service role bypasses RLS

-- Grant permissions
GRANT SELECT ON public.invoice_pdf_audit TO authenticated;
GRANT INSERT ON public.invoice_pdf_audit TO service_role;

-- End of 013_invoice_pdf_audit.sql

