-- ================================================================
-- VERIFY 038 — runnable check, rolls back, changes nothing.
-- Paste into the Supabase SQL editor AFTER applying 038.
--
-- Self-contained: creates its own throwaway outlet + client, so it
-- works on an empty database. Everything is undone by the ROLLBACK
-- at the bottom — no rows survive this script.
--
-- Expected: "038 OK" in the notices, and 0 rows changed.
-- ================================================================
BEGIN;

DO $$
DECLARE
  v_outlet uuid;
  v_client uuid;
  v_id uuid;
  v_number text;
  v_issued timestamptz;
  back_date CONSTANT timestamptz := '2025-06-15'::timestamptz;  -- FY 2025-26
BEGIN
  -- Throwaway fixtures (rolled back)
  INSERT INTO outlets (name, code)
  VALUES ('Verify 038 Outlet', 'ZZ-VERIFY-038')
  RETURNING id INTO v_outlet;

  INSERT INTO clients (outlet_id, client_type, name, phone)
  VALUES (v_outlet, 'corporate', 'Verify 038 Client', '9999999999')
  RETURNING id INTO v_client;

  -- ---- 1. back-dated invoice keeps its date through finalization ----
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status,
                        subtotal, tax_total, grand_total,
                        issued_at, invoice_number_format)
  VALUES ('subscription', v_client, v_outlet, 'draft',
          100, 18, 118, back_date, 'fy_only')
  RETURNING id, invoice_number INTO v_id, v_number;

  IF v_number NOT LIKE 'INV/2025-26/%' THEN
    RAISE EXCEPTION 'FY in number wrong: got %, expected INV/2025-26/NNNN', v_number;
  END IF;

  -- 042: a draft needs at least one line item to be finalized
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_id, 'Verify line', 1, 100, 100, 18, 18);
  UPDATE invoices SET status = 'finalized' WHERE id = v_id;
  SELECT issued_at INTO v_issued FROM invoices WHERE id = v_id;

  IF v_issued::date <> back_date::date THEN
    RAISE EXCEPTION 'issued_at overwritten: got %, expected %', v_issued, back_date;
  END IF;

  -- ---- 2. no supplied date still defaults to today ----
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status,
                        subtotal, tax_total, grand_total)
  VALUES ('subscription', v_client, v_outlet, 'draft', 100, 18, 118)
  RETURNING id INTO v_id;

  -- 042: a draft needs at least one line item to be finalized
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_id, 'Verify line', 1, 100, 100, 18, 18);
  UPDATE invoices SET status = 'finalized' WHERE id = v_id;
  SELECT issued_at INTO v_issued FROM invoices WHERE id = v_id;

  IF v_issued::date <> CURRENT_DATE THEN
    RAISE EXCEPTION 'default date broke: got %, expected today', v_issued;
  END IF;

  RAISE NOTICE '038 OK';
END $$;

ROLLBACK;
