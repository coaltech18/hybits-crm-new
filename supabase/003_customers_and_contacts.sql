-- ==============================================================
-- 003 - Customers and Contacts
-- ==============================================================

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE,
  company_name TEXT,
  contact_person TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  state TEXT,
  address TEXT,
  location_id UUID REFERENCES public.locations(id),
  credit_limit NUMERIC(12,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_location_id ON public.customers(location_id);

CREATE POLICY "Allow access within location" ON public.customers
  FOR ALL USING (
    location_id IN (
      SELECT location_id FROM public.users_meta WHERE user_id = auth.uid()
    )
  );
