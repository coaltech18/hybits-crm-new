-- ===================================================================
-- HYBITS CRM — FULL PRODUCTION SCHEMA (clean start)
-- Created for new Supabase project. This file uses DROP statements to
-- ensure a clean state on a new account. Run this first.
-- ===================================================================

-- 0. Optional: drop dependent objects (safe on brand-new DB)
DROP VIEW IF EXISTS public.gst_reports_final;
DROP VIEW IF EXISTS public.gst_reports_split_view;
DROP VIEW IF EXISTS public.gst_reports_view;

DROP TABLE IF EXISTS public.vendor_deposit_ledger CASCADE;
DROP TABLE IF EXISTS public.vendor_payments CASCADE;
DROP TABLE IF EXISTS public.vendor_subscription_items CASCADE;
DROP TABLE IF EXISTS public.vendor_subscriptions CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;

DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

DROP TABLE IF EXISTS public.rental_order_items CASCADE;
DROP TABLE IF EXISTS public.rental_orders CASCADE;

DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;

DROP TABLE IF EXISTS public.customers CASCADE;

DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;

DROP TYPE IF EXISTS public.invoice_type CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.customer_type CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;
DROP TYPE IF EXISTS public.gst_rate CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. ENUM TYPES
CREATE TYPE public.user_role      AS ENUM ('admin', 'manager', 'accountant');
CREATE TYPE public.customer_type  AS ENUM ('individual', 'corporate', 'event_company', 'restaurant');
CREATE TYPE public.order_status   AS ENUM ('pending', 'confirmed', 'items_dispatched', 'items_returned', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE public.invoice_type   AS ENUM ('rental', 'security_deposit', 'damage_charges', 'late_fee', 'credit_note');
CREATE TYPE public.gst_rate       AS ENUM ('0', '5', '12', '18', '28');
CREATE TYPE public.payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online');

-- 3. CORE TABLES (LOCATIONS + USER PROFILES)
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  manager_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  role public.user_role DEFAULT 'manager',
  outlet_id UUID REFERENCES public.locations(id),
  outlet_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL UNIQUE,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  gstin TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_pincode TEXT,
  address_country TEXT DEFAULT 'India',
  customer_type public.customer_type DEFAULT 'individual',
  credit_limit NUMERIC(12,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  outlet_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_outlet ON public.customers(outlet_id);

-- 5. INVENTORY ITEMS & STOCK MOVEMENTS
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  condition TEXT DEFAULT 'excellent',
  total_quantity NUMERIC(12,2) DEFAULT 0,
  available_quantity NUMERIC(12,2) DEFAULT 0,
  reserved_quantity NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  hsn_code TEXT,
  reorder_point NUMERIC(12,2) DEFAULT 0,
  image_url TEXT,
  thumbnail_url TEXT,
  image_alt_text TEXT,
  outlet_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_code TEXT UNIQUE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT CHECK (movement_type IN ('in','out','return','damage','adjustment')),
  quantity NUMERIC(12,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  outlet_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- stock trigger will be created in migration 002

-- 6. RENTAL ORDERS & ITEMS
CREATE TABLE public.rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  outlet_id UUID REFERENCES public.locations(id),
  event_name TEXT,
  event_type TEXT,
  event_date DATE,
  delivery_date DATE,
  return_date DATE,
  event_duration INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  location_type TEXT,
  status public.order_status DEFAULT 'pending',
  payment_status public.payment_status DEFAULT 'pending',
  total_amount NUMERIC(12,2) DEFAULT 0,
  security_deposit NUMERIC(12,2) DEFAULT 0,
  gst_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.rental_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.rental_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT,
  quantity NUMERIC(12,2) NOT NULL,
  rental_days INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVOICES, INVOICE ITEMS & PAYMENTS
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  order_id UUID REFERENCES public.rental_orders(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.locations(id),
  invoice_type public.invoice_type DEFAULT 'rental',
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  total_gst NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_received NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - payment_received) STORED,
  payment_status public.payment_status DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  outlet_id UUID REFERENCES public.locations(id),
  payment_date DATE DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method public.payment_method NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- trigger to apply payments will be created in migration 002

-- 8. VENDORS & SUBSCRIPTIONS (OUTLET-WISE)
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  outlet_id UUID REFERENCES public.locations(id),
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vendor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vsub_code TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  subscription_start DATE NOT NULL,
  subscription_end DATE,
  total_dish_value NUMERIC(12,2) DEFAULT 0,
  security_deposit_amount NUMERIC(12,2) DEFAULT 0,
  monthly_fee NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vendor_subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size TEXT,
  price_per_piece NUMERIC(12,2) DEFAULT 0,
  quantity NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vpay_code TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.vendor_subscriptions(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.locations(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_type TEXT CHECK (payment_type IN ('subscription','deposit','refund','damage')),
  payment_mode public.payment_method DEFAULT 'cash',
  transaction_ref TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vendor_deposit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id),
  outlet_id UUID REFERENCES public.locations(id),
  amount NUMERIC(12,2) NOT NULL,
  transaction_type TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. GST REPORTING VIEWS
CREATE OR REPLACE VIEW public.gst_reports_view AS
SELECT
  inv.id AS invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  COALESCE(c.contact_person, c.company_name, 'Unknown') AS customer_name,
  c.gstin AS gst_number,
  'NA'::text AS hsn_code,
  SUM(ii.quantity * ii.rate) AS taxable_value,
  COALESCE(MAX(ii.gst_rate::numeric), 0) AS tax_rate,
  CASE
    WHEN c.gstin IS NULL OR c.gstin = '' THEN 'Domestic'
    WHEN SUBSTRING(c.gstin FROM 1 FOR 2) = '29' THEN 'Domestic'
    ELSE 'Interstate'
  END AS region_type_base,
  inv.invoice_type::text AS invoice_type,
  inv.outlet_id
FROM public.invoices inv
JOIN public.invoice_items ii ON ii.invoice_id = inv.id
LEFT JOIN public.customers c ON c.id = inv.customer_id
GROUP BY inv.id, inv.invoice_number, inv.invoice_date, customer_name, gst_number, inv.invoice_type, inv.outlet_id;

CREATE OR REPLACE VIEW public.gst_reports_split_view AS
SELECT
  g.invoice_id,
  g.invoice_number,
  g.invoice_date,
  g.customer_name,
  g.gst_number,
  g.hsn_code,
  ROUND(g.taxable_value, 2) AS taxable_value,
  g.tax_rate,
  CASE WHEN g.region_type_base = 'Domestic' THEN ROUND((g.taxable_value * g.tax_rate / 100) / 2, 2) ELSE 0 END AS cgst,
  CASE WHEN g.region_type_base = 'Domestic' THEN ROUND((g.taxable_value * g.tax_rate / 100) / 2, 2) ELSE 0 END AS sgst,
  CASE WHEN g.region_type_base = 'Interstate' THEN ROUND((g.taxable_value * g.tax_rate / 100), 2) ELSE 0 END AS igst,
  ROUND((g.taxable_value * g.tax_rate / 100), 2) AS total_tax,
  ROUND((g.taxable_value + (g.taxable_value * g.tax_rate / 100)), 2) AS grand_total,
  CASE WHEN g.region_type_base = 'Interstate' THEN 'Export' ELSE 'Domestic' END AS region_type,
  CASE WHEN g.invoice_type = 'credit_note' THEN 'Credit Note' ELSE 'Invoice' END AS document_type,
  CASE WHEN g.invoice_type = 'credit_note' THEN -1 ELSE 1 END AS multiplier,
  g.outlet_id
FROM public.gst_reports_view g;

CREATE OR REPLACE VIEW public.gst_reports_final AS
SELECT
  invoice_id,
  invoice_number,
  invoice_date,
  customer_name,
  gst_number,
  hsn_code,
  taxable_value * multiplier AS taxable_value,
  tax_rate,
  cgst * multiplier AS cgst,
  sgst * multiplier AS sgst,
  igst * multiplier AS igst,
  total_tax * multiplier AS total_tax,
  grand_total * multiplier AS grand_total,
  region_type,
  document_type,
  outlet_id
FROM public.gst_reports_split_view;

GRANT SELECT ON public.gst_reports_view        TO authenticated, service_role;
GRANT SELECT ON public.gst_reports_split_view  TO authenticated, service_role;
GRANT SELECT ON public.gst_reports_final       TO authenticated, service_role;

-- 10. STORAGE BUCKET FOR INVENTORY IMAGES (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-images','inventory-images', false)
ON CONFLICT (id) DO NOTHING;

-- Policies on storage.objects (these policies assume authenticated users)
DROP POLICY IF EXISTS "Allow authenticated insert inventory images" ON storage.objects;
CREATE POLICY "Allow authenticated insert inventory images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated read inventory images" ON storage.objects;
CREATE POLICY "Allow authenticated read inventory images" ON storage.objects
  FOR SELECT USING (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update inventory images" ON storage.objects;
CREATE POLICY "Allow authenticated update inventory images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete inventory images" ON storage.objects;
CREATE POLICY "Allow authenticated delete inventory images" ON storage.objects
  FOR DELETE USING (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');

-- 11. AUTH TRIGGER (AUTOMATIC user_profiles CREATION)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_outlet UUID;
  target_outlet_name TEXT;
  requested_outlet TEXT;
  requested_role TEXT;
  resolved_role public.user_role;
  is_active_flag BOOLEAN;
  phone_value TEXT;
BEGIN
  requested_outlet := COALESCE(NEW.raw_user_meta_data->>'outlet_id', NULL);
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'manager');
  phone_value := COALESCE(NEW.raw_user_meta_data->>'phone', NULL);
  is_active_flag := COALESCE((NEW.raw_user_meta_data->>'is_active')::BOOLEAN, TRUE);

  BEGIN
    resolved_role := requested_role::public.user_role;
  EXCEPTION WHEN others THEN
    resolved_role := 'manager';
  END;

  IF requested_outlet IS NOT NULL THEN
    SELECT id, name
      INTO target_outlet, target_outlet_name
    FROM public.locations
    WHERE id = requested_outlet::uuid
    LIMIT 1;
  END IF;

  IF target_outlet IS NULL THEN
    SELECT id, name
      INTO target_outlet, target_outlet_name
    FROM public.locations
    ORDER BY created_at
    LIMIT 1;
  END IF;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    phone,
    outlet_id,
    outlet_name,
    is_active,
    created_at,
    updated_at,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    resolved_role,
    phone_value,
    target_outlet,
    target_outlet_name,
    is_active_flag,
    NOW(),
    NOW(),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. ENABLE RLS & APPLY POLICIES
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_deposit_ledger ENABLE ROW LEVEL SECURITY;

-- helper: is_admin using SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- USER_PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles read own" ON public.user_profiles;
CREATE POLICY "Profiles read own" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles insert own" ON public.user_profiles;
CREATE POLICY "Profiles insert own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles update own" ON public.user_profiles;
CREATE POLICY "Profiles update own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles admin view" ON public.user_profiles;
CREATE POLICY "Profiles admin view" ON public.user_profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Profiles admin manage" ON public.user_profiles;
CREATE POLICY "Profiles admin manage" ON public.user_profiles
  FOR ALL USING (public.is_admin());

-- LOCATIONS POLICIES
DROP POLICY IF EXISTS "Locations read" ON public.locations;
CREATE POLICY "Locations read" ON public.locations
  FOR SELECT USING (public.is_admin() OR id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Locations admin manage" ON public.locations;
CREATE POLICY "Locations admin manage" ON public.locations
  FOR ALL USING (public.is_admin());

-- CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Customers read" ON public.customers;
CREATE POLICY "Customers read" ON public.customers
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Customers write" ON public.customers;
CREATE POLICY "Customers write" ON public.customers
  FOR ALL USING (
    public.is_admin()
    OR (outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()) AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- INVENTORY POLICIES
DROP POLICY IF EXISTS "Inventory read" ON public.inventory_items;
CREATE POLICY "Inventory read" ON public.inventory_items
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Inventory write" ON public.inventory_items;
CREATE POLICY "Inventory write" ON public.inventory_items
  FOR ALL USING (
    public.is_admin()
    OR (outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()) AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- STOCK MOVEMENTS POLICIES
DROP POLICY IF EXISTS "Stock movements read" ON public.stock_movements;
CREATE POLICY "Stock movements read" ON public.stock_movements
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Stock movements write" ON public.stock_movements;
CREATE POLICY "Stock movements write" ON public.stock_movements
  FOR ALL USING (
    public.is_admin()
    OR (created_by = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR (created_by = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  );

-- ORDERS POLICIES
DROP POLICY IF EXISTS "Orders read" ON public.rental_orders;
CREATE POLICY "Orders read" ON public.rental_orders
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Orders write" ON public.rental_orders;
CREATE POLICY "Orders write" ON public.rental_orders
  FOR ALL USING (
    public.is_admin()
    OR (outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()) AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- ORDER ITEMS POLICIES
DROP POLICY IF EXISTS "Order items read" ON public.rental_order_items;
CREATE POLICY "Order items read" ON public.rental_order_items
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.rental_orders
      WHERE rental_orders.id = rental_order_items.order_id
        AND rental_orders.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order items write" ON public.rental_order_items;
CREATE POLICY "Order items write" ON public.rental_order_items
  FOR ALL USING (
    public.is_admin()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager')
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager')
  );

-- INVOICES POLICIES
DROP POLICY IF EXISTS "Invoices read" ON public.invoices;
CREATE POLICY "Invoices read" ON public.invoices
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Invoices write" ON public.invoices;
CREATE POLICY "Invoices write" ON public.invoices
  FOR ALL USING (
    public.is_admin()
    OR (outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()) AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- INVOICE ITEMS POLICIES
DROP POLICY IF EXISTS "Invoice items read" ON public.invoice_items;
CREATE POLICY "Invoice items read" ON public.invoice_items
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Invoice items write" ON public.invoice_items;
CREATE POLICY "Invoice items write" ON public.invoice_items
  FOR ALL USING (
    public.is_admin()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager')
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager')
  );

-- PAYMENTS POLICIES (accounting)
DROP POLICY IF EXISTS "Payments read" ON public.payments;
CREATE POLICY "Payments read" ON public.payments
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Payments write" ON public.payments;
CREATE POLICY "Payments write" ON public.payments
  FOR ALL USING (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- VENDOR & SUBSCRIPTION POLICIES
DROP POLICY IF EXISTS "Vendors read" ON public.vendors;
CREATE POLICY "Vendors read" ON public.vendors
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendors write" ON public.vendors;
CREATE POLICY "Vendors write" ON public.vendors
  FOR ALL USING (
    public.is_admin()
    OR (outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid()) AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','manager'))
  ) WITH CHECK (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor subscriptions read" ON public.vendor_subscriptions;
CREATE POLICY "Vendor subscriptions read" ON public.vendor_subscriptions
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vendors v WHERE v.id = vendor_subscriptions.vendor_id AND v.outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor payments read" ON public.vendor_payments;
CREATE POLICY "Vendor payments read" ON public.vendor_payments
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor payments write" ON public.vendor_payments;
CREATE POLICY "Vendor payments write" ON public.vendor_payments
  FOR ALL USING (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendor deposit read" ON public.vendor_deposit_ledger;
CREATE POLICY "Vendor deposit read" ON public.vendor_deposit_ledger
  FOR SELECT USING (
    public.is_admin()
    OR outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor deposit write" ON public.vendor_deposit_ledger;
CREATE POLICY "Vendor deposit write" ON public.vendor_deposit_ledger
  FOR ALL USING (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin','accountant')
      AND outlet_id = (SELECT outlet_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- 13. Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON public.inventory_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet ON public.rental_orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_payments_outlet ON public.payments(outlet_id);

-- End of 001_full_production_schema.sql

