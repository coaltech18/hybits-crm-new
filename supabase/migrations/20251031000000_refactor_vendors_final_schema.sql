  -- ============================================================================
  -- FINAL VENDOR & SUBSCRIPTION SCHEMA (Refactored)
  -- ============================================================================

  -- 1. Create vendors table (clean, no bank details)
  CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','terminated')),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- 2. Update vendor_subscriptions with new columns
  CREATE TABLE IF NOT EXISTS public.vendor_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('30k','40k','60k','custom')),
    subscription_start DATE NOT NULL,
    subscription_end DATE,
    monthly_fee NUMERIC NOT NULL DEFAULT 0,
    security_deposit_amount NUMERIC NOT NULL DEFAULT 0,
    total_dish_value NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- 3. Update vendor_subscription_items with status
  CREATE TABLE IF NOT EXISTS public.vendor_subscription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT,
    price_per_piece NUMERIC NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'issued' CHECK (status IN ('issued','returned','damaged','lost')),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- 4. Create vendor_payments table
  CREATE TABLE IF NOT EXISTS public.vendor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('subscription','deposit','refund','damage')),
    payment_mode TEXT CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque','other')),
    transaction_ref TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- 5. Create indexes
  CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
  CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_vendor_id ON public.vendor_subscriptions(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_status ON public.vendor_subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_vendor_subscription_items_subscription_id ON public.vendor_subscription_items(subscription_id);
  CREATE INDEX IF NOT EXISTS idx_vendor_subscription_items_status ON public.vendor_subscription_items(status);
  CREATE INDEX IF NOT EXISTS idx_vendor_payments_subscription_id ON public.vendor_payments(subscription_id);
  CREATE INDEX IF NOT EXISTS idx_vendor_payments_payment_type ON public.vendor_payments(payment_type);
  CREATE INDEX IF NOT EXISTS idx_vendor_payments_created_at ON public.vendor_payments(created_at);

