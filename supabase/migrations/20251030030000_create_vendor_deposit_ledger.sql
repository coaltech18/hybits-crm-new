-- Deposit ledger for vendor security deposits
CREATE TABLE IF NOT EXISTS public.vendor_deposit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.vendor_subscriptions(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('collect','adjust','refund')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  reason TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_deposit_ledger_vendor_id ON public.vendor_deposit_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deposit_ledger_subscription_id ON public.vendor_deposit_ledger(subscription_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deposit_ledger_created_at ON public.vendor_deposit_ledger(created_at);
