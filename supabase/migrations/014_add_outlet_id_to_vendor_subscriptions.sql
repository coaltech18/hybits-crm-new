-- ===================================================================
-- HYBITS CRM — Add outlet_id to vendor_subscriptions table
-- Fixes subscription creation error by adding missing outlet_id column
-- ===================================================================

-- Add outlet_id column to vendor_subscriptions (idempotent)
ALTER TABLE public.vendor_subscriptions
  ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.locations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_outlet ON public.vendor_subscriptions(outlet_id);

-- Update RLS policy to use outlet_id directly instead of vendor's outlet_id
DROP POLICY IF EXISTS "Vendor subscriptions read" ON public.vendor_subscriptions;
CREATE POLICY "Vendor subscriptions read" ON public.vendor_subscriptions
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- Add write policy for vendor subscriptions
DROP POLICY IF EXISTS "Vendor subscriptions write" ON public.vendor_subscriptions;
CREATE POLICY "Vendor subscriptions write" ON public.vendor_subscriptions
  FOR ALL USING (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- End of 014_add_outlet_id_to_vendor_subscriptions.sql

