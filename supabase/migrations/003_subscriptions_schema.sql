-- 003_subscriptions_schema.sql
-- Create subscription tables, triggers, and RLS policies

CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  outlet_id UUID REFERENCES public.locations(id),
  billing_period TEXT DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.locations(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  quantity_per_day INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity_per_day * unit_price * 30) STORED,
  security_deposit NUMERIC(12,2) DEFAULT 0,
  gst_rate public.gst_rate DEFAULT '18',
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_code TEXT UNIQUE,
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.locations(id),
  payment_date DATE DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method public.payment_method,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  billing_period_start DATE,
  billing_period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_outlet ON public.customer_subscriptions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_plans_outlet ON public.plans(outlet_id);

-- Subscription code trigger (uses public.generate_entity_code)
CREATE OR REPLACE FUNCTION public.set_subscription_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_code IS NULL OR NEW.subscription_code = '' THEN
    NEW.subscription_code := public.generate_entity_code('cust_sub', 'SUB', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_subscription_code ON public.customer_subscriptions;
CREATE TRIGGER trg_set_subscription_code BEFORE INSERT ON public.customer_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_subscription_code();

-- Payment code trigger
CREATE OR REPLACE FUNCTION public.set_subscription_payment_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_code IS NULL OR NEW.payment_code = '' THEN
    NEW.payment_code := public.generate_entity_code('sub_payment', 'SPAY', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_subscription_payment_code ON public.subscription_payments;
CREATE TRIGGER trg_set_subscription_payment_code BEFORE INSERT ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.set_subscription_payment_code();

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Policies assume public.is_admin() helper exists. If not, ensure it's present in migrations 001/002.
DROP POLICY IF EXISTS "Plans read" ON public.plans;
CREATE POLICY "Plans read" ON public.plans
  FOR SELECT USING (public.is_admin() OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Plans write" ON public.plans;
CREATE POLICY "Plans write" ON public.plans
  FOR ALL USING (public.is_admin() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  WITH CHECK (public.is_admin() OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Subscriptions read" ON public.customer_subscriptions;
CREATE POLICY "Subscriptions read" ON public.customer_subscriptions
  FOR SELECT USING (public.is_admin() OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Subscriptions write" ON public.customer_subscriptions;
CREATE POLICY "Subscriptions write" ON public.customer_subscriptions
  FOR ALL USING (public.is_admin() OR ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager') AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())))
  WITH CHECK (public.is_admin() OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Subscription items read" ON public.subscription_items;
CREATE POLICY "Subscription items read" ON public.subscription_items
  FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.customer_subscriptions cs WHERE cs.id = subscription_items.subscription_id AND cs.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Subscription items write" ON public.subscription_items;
CREATE POLICY "Subscription items write" ON public.subscription_items
  FOR ALL USING (public.is_admin() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.customer_subscriptions cs WHERE cs.id = subscription_items.subscription_id AND cs.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Subscription payments read" ON public.subscription_payments;
CREATE POLICY "Subscription payments read" ON public.subscription_payments
  FOR SELECT USING (public.is_admin() OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Subscription payments write" ON public.subscription_payments;
CREATE POLICY "Subscription payments write" ON public.subscription_payments
  FOR ALL USING (public.is_admin() OR ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant') AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())))
  WITH CHECK (public.is_admin() OR ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant') AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Subscription invoices read" ON public.subscription_invoices;
CREATE POLICY "Subscription invoices read" ON public.subscription_invoices
  FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.customer_subscriptions cs WHERE cs.id = subscription_invoices.subscription_id AND cs.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Subscription invoices write" ON public.subscription_invoices;
CREATE POLICY "Subscription invoices write" ON public.subscription_invoices
  FOR ALL USING (public.is_admin() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager','accountant'))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.customer_subscriptions cs WHERE cs.id = subscription_invoices.subscription_id AND cs.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())));

