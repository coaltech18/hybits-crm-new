-- ==============================================================
-- 005 - Orders and Invoices
-- ==============================================================

CREATE TABLE public.rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  event_name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.rental_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.rental_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id),
  quantity NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2)
);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  invoice_date DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  order_id UUID REFERENCES public.rental_orders(id),
  taxable_value NUMERIC(12,2),
  gst_rate NUMERIC(5,2),
  total_amount NUMERIC(12,2),
  invoice_type TEXT DEFAULT 'invoice',
  location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id),
  quantity NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  gst_rate NUMERIC(5,2),
  total_price NUMERIC(12,2)
);
