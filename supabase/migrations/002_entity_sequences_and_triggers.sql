-- ===================================================================
-- HYBITS CRM — Entity sequences and code generators (safe for concurrency)
-- IDs use your chosen uppercase prefixes:
-- Outlets: HYBITS-001
-- Customers: CUST-001 (per-outlet)
-- Items: ITEM-001 (per-outlet)
-- Orders: ORD-001 (per-outlet)
-- Invoices: INVOICE-001 (per-outlet)
-- Users: USER-001
-- Vendors: VENDOR-001 (per-outlet)
-- Vendor subscriptions: VSUB-001 (per-outlet)
-- Vendor payments: VPAY-001 (per-outlet)
-- Stock movements: SM-001
-- Payments: PAY-001
-- This migration creates entity_sequences, next_entity_seq() RPC and generate_entity_code() RPC,
-- and triggers to auto-populate *_code fields on insert.

-- 1. sequences table
CREATE TABLE IF NOT EXISTS public.entity_sequences (
  id SERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  outlet_id UUID DEFAULT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity, outlet_id)
);

-- 2. next_entity_seq - upsert + retry logic
CREATE OR REPLACE FUNCTION public.next_entity_seq(
  p_entity TEXT,
  p_outlet UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  cur INTEGER;
BEGIN
  LOOP
    BEGIN
      UPDATE public.entity_sequences
      SET last_seq = entity_sequences.last_seq + 1, updated_at = NOW()
      WHERE entity = p_entity AND outlet_id IS NOT DISTINCT FROM p_outlet
      RETURNING entity_sequences.last_seq INTO cur;

      IF FOUND THEN
        RETURN cur;
      END IF;

      -- Insert with ON CONFLICT - use subquery to avoid ambiguity
      INSERT INTO public.entity_sequences(entity, outlet_id, last_seq)
      VALUES (p_entity, p_outlet, 1)
      ON CONFLICT (entity, outlet_id) 
      DO UPDATE SET 
        last_seq = (SELECT last_seq FROM public.entity_sequences es WHERE es.entity = EXCLUDED.entity AND es.outlet_id IS NOT DISTINCT FROM EXCLUDED.outlet_id) + 1,
        updated_at = NOW()
      RETURNING last_seq INTO cur;

      RETURN cur;
    EXCEPTION WHEN serialization_failure THEN
      PERFORM pg_sleep(0.01);
      CONTINUE;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. generate_entity_code
CREATE OR REPLACE FUNCTION public.generate_entity_code(
  p_entity TEXT,
  p_prefix TEXT,
  p_outlet_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  seq INTEGER;
  outcode TEXT;
  code TEXT;
BEGIN
  seq := public.next_entity_seq(p_entity, p_outlet_id);

  IF p_outlet_id IS NOT NULL THEN
    SELECT UPPER(COALESCE(code, 'OUT')) INTO outcode FROM public.locations WHERE id = p_outlet_id LIMIT 1;
    IF outcode IS NULL THEN
      outcode := 'OUT';
    END IF;
    code := UPPER(p_prefix) || '-' || outcode || '-' || LPAD(seq::text, 3, '0');
  ELSE
    code := UPPER(p_prefix) || '-' || LPAD(seq::text, 3, '0');
  END IF;

  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGERS for code generation

-- Outlets: HYBITS-001
CREATE OR REPLACE FUNCTION public.set_outlet_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_entity_code('outlet', 'HYBITS', NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_outlet_code ON public.locations;
CREATE TRIGGER trg_set_outlet_code BEFORE INSERT ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.set_outlet_code();

-- Customers: CUST-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := public.generate_entity_code('customer', 'CUST', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_customer_code ON public.customers;
CREATE TRIGGER trg_set_customer_code BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_customer_code();

-- Inventory items: ITEM-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_item_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
    NEW.item_code := public.generate_entity_code('inventory_item', 'ITEM', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_item_code ON public.inventory_items;
CREATE TRIGGER trg_set_item_code BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_item_code();

-- Orders: ORD-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_entity_code('order', 'ORD', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_order_number ON public.rental_orders;
CREATE TRIGGER trg_set_order_number BEFORE INSERT ON public.rental_orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- Invoices: INVOICE-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_entity_code('invoice', 'INVOICE', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_invoice_number ON public.invoices;
CREATE TRIGGER trg_set_invoice_number BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- Payments: PAY-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_payment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_number IS NULL OR NEW.payment_number = '' THEN
    NEW.payment_number := public.generate_entity_code('payment', 'PAY', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_payment_number ON public.payments;
CREATE TRIGGER trg_set_payment_number BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_payment_number();

-- Vendors: VENDOR-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_vendor_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_code IS NULL OR NEW.vendor_code = '' THEN
    NEW.vendor_code := public.generate_entity_code('vendor', 'VENDOR', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_vendor_code ON public.vendors;
CREATE TRIGGER trg_set_vendor_code BEFORE INSERT ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.set_vendor_code();

-- Vendor subscriptions: VSUB-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_vsub_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vsub_code IS NULL OR NEW.vsub_code = '' THEN
    NEW.vsub_code := public.generate_entity_code('vsub', 'VSUB', (SELECT outlet_id FROM public.vendors WHERE id = NEW.vendor_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_vsub_code ON public.vendor_subscriptions;
CREATE TRIGGER trg_set_vsub_code BEFORE INSERT ON public.vendor_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_vsub_code();

-- Vendor payments: VPAY-OUTCODE-001
CREATE OR REPLACE FUNCTION public.set_vpay_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vpay_code IS NULL OR NEW.vpay_code = '' THEN
    NEW.vpay_code := public.generate_entity_code('vpay', 'VPAY', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_vpay_code ON public.vendor_payments;
CREATE TRIGGER trg_set_vpay_code BEFORE INSERT ON public.vendor_payments
FOR EACH ROW EXECUTE FUNCTION public.set_vpay_code();

-- Stock movement codes: SM-001 (global per-outlet)
CREATE OR REPLACE FUNCTION public.set_stock_movement_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_code IS NULL OR NEW.movement_code = '' THEN
    NEW.movement_code := public.generate_entity_code('stock_movement', 'SM', NEW.outlet_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_stock_movement_code ON public.stock_movements;
CREATE TRIGGER trg_set_stock_movement_code BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.set_stock_movement_code();

-- End of 002_entity_sequences_and_triggers.sql

