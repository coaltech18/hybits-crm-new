-- =====================================================================
-- Business-flow tests on the FINAL schema (after 043).
-- Split by "-- @@ <name>" markers; migrations.test.mjs runs each chunk as
-- its own step ("flow <name>"). Every chunk is BEGIN ... ROLLBACK and
-- self-contained (its pg_temp helpers are dropped by the ROLLBACK).
--
-- Every flow acts the way the app does through PostgREST:
--   SET LOCAL ROLE authenticated + request.jwt.claims {"sub": <user>}
-- so RLS, column privileges, auth.uid() and the triggers all apply.
-- RESET ROLE switches back to the owner to check the result.
--
-- Spec: docs/APPLICATION_WORKFLOW.md section 2 (roles) and
-- supabase/MIGRATION_ORDER.md rows 42/43 (invoice / payment / inventory
-- rules).
--
-- Fixed ids from seed-pre042.sql:
--   users   admin a..01, mgr1 a..02 (outlet A), acct a..03, mgr2 a..04 (A+B)
--   outlets A b..0a (code SA), B b..0b (code SB)
--   clients a1 (corporate), a2 (corporate, sez), a3 (event) @A;  b1 (corporate) @B
--   invoices f..01 A finalized (500 paid) | f..02 A paid | f..03 B finalized
--            f..04 A draft (1 item)      | f..05 A event finalized
--   item 10..a1 @A; event e..a3 @A (completed)
-- =====================================================================

-- @@ F1 invoice lifecycle as manager (draft -> items -> finalize -> locked -> cancel)
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  v_inv uuid; v_plates uuid; v_bowls uuid; v_n integer;
  v_rec record; v_num_draft text;
BEGIN
  -- Create the draft the way the app does (it sends its own totals; the DB ignores them).
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a',
          'draft', 999, 99, 1098)
  RETURNING id, invoice_number INTO v_inv, v_num_draft;
  SELECT * INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.status <> 'draft' OR (v_rec.subtotal, v_rec.tax_total, v_rec.grand_total) <> (0::numeric, 0::numeric, 0::numeric) THEN
    RAISE EXCEPTION 'FLOW FAILED: new draft not a zero-total draft: status %, % / % / %',
      v_rec.status, v_rec.subtotal, v_rec.tax_total, v_rec.grand_total;
  END IF;

  -- Two items; the line amounts the client sends are wrong on purpose.
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Steel plates', 10, 12.50, 1, 18, 1) RETURNING id INTO v_plates;   -- 125.00 + 22.50
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Bowls', 3, 33.33, 0, 5, 0) RETURNING id INTO v_bowls;              -- 99.99 + 5.00 (4.9995)
  SELECT line_total, tax_amount INTO v_rec FROM invoice_items WHERE id = v_plates;
  IF v_rec.line_total <> 125.00 OR v_rec.tax_amount <> 22.50 THEN
    RAISE EXCEPTION 'FLOW FAILED: plates line %/% (expected 125.00/22.50)', v_rec.line_total, v_rec.tax_amount;
  END IF;
  SELECT line_total, tax_amount INTO v_rec FROM invoice_items WHERE id = v_bowls;
  IF v_rec.line_total <> 99.99 OR v_rec.tax_amount <> 5.00 THEN
    RAISE EXCEPTION 'FLOW FAILED: bowls line %/% (expected 99.99/5.00)', v_rec.line_total, v_rec.tax_amount;
  END IF;
  SELECT subtotal, tax_total, grand_total INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.subtotal <> 224.99 OR v_rec.tax_total <> 27.50 OR v_rec.grand_total <> 252.49 THEN
    RAISE EXCEPTION 'FLOW FAILED: header after 2 items % / % / % (expected 224.99 / 27.50 / 252.49)',
      v_rec.subtotal, v_rec.tax_total, v_rec.grand_total;
  END IF;

  -- Edit an item while it is a draft: header follows.
  UPDATE invoice_items SET quantity = 6 WHERE id = v_bowls;               -- 199.98 + 10.00 (9.999)
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FLOW FAILED: draft item edit touched % rows', v_n; END IF;
  SELECT subtotal, tax_total, grand_total INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.subtotal <> 324.98 OR v_rec.tax_total <> 32.50 OR v_rec.grand_total <> 357.48 THEN
    RAISE EXCEPTION 'FLOW FAILED: header after item edit % / % / % (expected 324.98 / 32.50 / 357.48)',
      v_rec.subtotal, v_rec.tax_total, v_rec.grand_total;
  END IF;

  -- A forged header on the draft is recomputed from the items.
  UPDATE invoices SET subtotal = 1, tax_total = 0, grand_total = 1 WHERE id = v_inv;
  IF (SELECT grand_total FROM invoices WHERE id = v_inv) <> 357.48 THEN
    RAISE EXCEPTION 'FLOW FAILED: forged draft header kept';
  END IF;

  -- Finalize (the app: UPDATE status = 'finalized').
  UPDATE invoices SET status = 'finalized' WHERE id = v_inv;
  SELECT * INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.status <> 'finalized' THEN
    RAISE EXCEPTION 'FLOW FAILED: status after finalize is %', v_rec.status;
  END IF;
  IF v_rec.issued_at IS NULL THEN
    RAISE EXCEPTION 'FLOW FAILED: finalized invoice has no invoice date';
  END IF;
  -- default format: INV-<IST date of the invoice>-NNNN (at least 4 digits)
  IF v_rec.invoice_number IS NULL
     OR v_rec.invoice_number !~ ('^INV-' || to_char(v_rec.issued_at AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-[0-9]{4,}$') THEN
    RAISE EXCEPTION 'FLOW FAILED: invoice number % not well-formed for date %', v_rec.invoice_number, v_rec.issued_at;
  END IF;
  IF v_rec.invoice_number IS DISTINCT FROM v_num_draft THEN
    RAISE EXCEPTION 'FLOW FAILED: number changed at finalize (% -> %)', v_num_draft, v_rec.invoice_number;
  END IF;
  IF v_rec.grand_total <> 357.48 OR v_rec.client_name_snap IS DISTINCT FROM 'Seed Corp A1' THEN
    RAISE EXCEPTION 'FLOW FAILED: finalized header %, party snapshot %', v_rec.grand_total, v_rec.client_name_snap;
  END IF;
  PERFORM set_config('flow.inv', v_inv::text, true);
  PERFORM set_config('flow.item', v_plates::text, true);
END $$;

-- Issued: items and header are locked.
SELECT pg_temp.expect_fail('add an item to a finalized invoice',
  format($q$INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
            VALUES (%L, 'Late', 1, 1, 1, 0, 0)$q$, current_setting('flow.inv')),
  'only be added or changed while the invoice is a draft');
SELECT pg_temp.expect_fail('edit an item of a finalized invoice',
  format('UPDATE invoice_items SET quantity = 100 WHERE id = %L', current_setting('flow.item')),
  'only be added or changed while the invoice is a draft');
SELECT pg_temp.expect_fail('delete an item of a finalized invoice',
  format('DELETE FROM invoice_items WHERE id = %L', current_setting('flow.item')),
  'cannot be deleted once the invoice is');
SELECT pg_temp.expect_fail('renumber a finalized invoice',
  format($q$UPDATE invoices SET invoice_number = 'INV-20260101-9999' WHERE id = %L$q$, current_setting('flow.inv')),
  'system-assigned');
SELECT pg_temp.expect_fail('finalized invoice back to draft',
  format($q$UPDATE invoices SET status = 'draft' WHERE id = %L$q$, current_setting('flow.inv')),
  'status transition|not allowed');
DO $$
DECLARE v_inv uuid := current_setting('flow.inv')::uuid; v_n integer := 0;
BEGIN
  -- discarding is for drafts only: refused, or filtered to 0 rows by RLS
  BEGIN
    DELETE FROM invoices WHERE id = v_inv;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_n := 0;
  END;
  IF v_n <> 0 OR NOT EXISTS (SELECT 1 FROM invoices WHERE id = v_inv) THEN
    RAISE EXCEPTION 'FLOW FAILED: manager deleted a finalized invoice';
  END IF;

  -- a forged header on an issued invoice is either refused or not kept
  BEGIN
    UPDATE invoices SET subtotal = 1, tax_total = 0, grand_total = 1 WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  IF (SELECT grand_total FROM invoices WHERE id = v_inv) <> 357.48
     OR (SELECT count(*) FROM invoice_items WHERE invoice_id = v_inv) <> 2
     OR (SELECT sum(line_total) FROM invoice_items WHERE invoice_id = v_inv) <> 324.98 THEN
    RAISE EXCEPTION 'FLOW FAILED: finalized invoice changed: grand %, items %',
      (SELECT grand_total FROM invoices WHERE id = v_inv), (SELECT count(*) FROM invoice_items WHERE invoice_id = v_inv);
  END IF;

  -- Cancel the unpaid finalized invoice.
  UPDATE invoices SET status = 'cancelled' WHERE id = v_inv;
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'cancelled' THEN
    RAISE EXCEPTION 'FLOW FAILED: cancel of an unpaid finalized invoice did not stick';
  END IF;
END $$;
SELECT pg_temp.expect_fail('payment on a cancelled invoice',
  format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
            VALUES (%L, 10, 'cash', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, current_setting('flow.inv')),
  'cancelled invoice');
SELECT pg_temp.expect_fail('cancelled invoice re-opened',
  format($q$UPDATE invoices SET status = 'finalized' WHERE id = %L$q$, current_setting('flow.inv')),
  'cancelled invoices cannot be modified|status transition');

-- An empty draft cannot be finalized; a payment on a draft is refused.
DO $$
DECLARE v_inv uuid; v_ok boolean := false;
BEGIN
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft')
  RETURNING id INTO v_inv;
  PERFORM set_config('flow.empty', v_inv::text, true);
END $$;
SELECT pg_temp.expect_fail('finalize a draft with no items',
  format($q$UPDATE invoices SET status = 'finalized' WHERE id = %L$q$, current_setting('flow.empty')),
  'item');
SELECT pg_temp.expect_fail('payment on a draft invoice',
  format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
            VALUES (%L, 0.01, 'cash', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, current_setting('flow.empty')),
  'draft invoice');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT status FROM invoices WHERE id = current_setting('flow.inv')::uuid) <> 'cancelled'
     OR (SELECT created_by FROM invoices WHERE id = current_setting('flow.inv')::uuid)
        IS DISTINCT FROM 'a0000000-0000-0000-0000-000000000002'::uuid THEN
    RAISE EXCEPTION 'FLOW FAILED: owner view of the manager''s invoice: %',
      (SELECT row_to_json(i) FROM (SELECT status, created_by FROM invoices WHERE id = current_setting('flow.inv')::uuid) i);
  END IF;
  RAISE NOTICE 'F1 OK';
END $$;
ROLLBACK;

-- @@ F2 payments: partial -> paid -> overpayment rejected -> void -> immutable
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;
-- invoice status + payment view in one line, for comparisons
CREATE FUNCTION pg_temp.inv_state(p_id uuid)
RETURNS text LANGUAGE sql AS $fn$
  SELECT i.status || ' paid=' || v.amount_paid || ' due=' || v.balance_due || ' ps=' || v.payment_status
  FROM invoices i JOIN invoices_with_payment_status v ON v.id = i.id WHERE i.id = p_id
$fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_inv uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid; v_s text; v_rec record;
BEGIN
  -- finalized invoice of 1180.00 (1000 + 18%)
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft')
  RETURNING id INTO v_inv;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Monthly rental', 100, 10, 1000, 18, 180);
  UPDATE invoices SET status = 'finalized' WHERE id = v_inv;
  v_s := pg_temp.inv_state(v_inv);
  IF v_s <> 'finalized paid=0.00 due=1180.00 ps=unpaid' THEN
    RAISE EXCEPTION 'FLOW FAILED: before payments: %', v_s;
  END IF;

  -- partial payment
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 400.50, 'upi', v_today) RETURNING id INTO v_p1;
  v_s := pg_temp.inv_state(v_inv);
  IF v_s <> 'partially_paid paid=400.50 due=779.50 ps=partially_paid' THEN
    RAISE EXCEPTION 'FLOW FAILED: after partial payment: %', v_s;
  END IF;

  -- the rest
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 779.50, 'bank_transfer', v_today) RETURNING id INTO v_p2;
  v_s := pg_temp.inv_state(v_inv);
  IF v_s <> 'paid paid=1180.00 due=0.00 ps=paid' THEN
    RAISE EXCEPTION 'FLOW FAILED: after settling payment: %', v_s;
  END IF;

  PERFORM set_config('flow.inv', v_inv::text, true);
  PERFORM set_config('flow.p1', v_p1::text, true);
  PERFORM set_config('flow.p2', v_p2::text, true);
END $$;

-- overpayment (beyond the Rs 0.05 rounding tolerance) is refused
SELECT pg_temp.expect_fail('payment on a fully paid invoice',
  format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
            VALUES (%L, 1, 'cash', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, current_setting('flow.inv')),
  'exceeds invoice total');
-- payments cannot be edited
SELECT pg_temp.expect_fail('edit a payment amount',
  format('UPDATE payments SET amount = 100 WHERE id = %L', current_setting('flow.p1')),
  'cannot be edited');
SELECT pg_temp.expect_fail('edit a payment method',
  format($q$UPDATE payments SET payment_method = 'cash' WHERE id = %L$q$, current_setting('flow.p1')),
  'cannot be edited');
-- the invoice status cannot be set by hand
SELECT pg_temp.expect_fail('paid invoice set to partially_paid by hand',
  format($q$UPDATE invoices SET status = 'partially_paid' WHERE id = %L$q$, current_setting('flow.inv')),
  'follows its payments');
SELECT pg_temp.expect_fail('paid invoice cancelled',
  format($q$UPDATE invoices SET status = 'cancelled' WHERE id = %L$q$, current_setting('flow.inv')),
  'void all payments|invalid status transition');

DO $$
DECLARE
  v_inv uuid := current_setting('flow.inv')::uuid;
  v_p2 uuid := current_setting('flow.p2')::uuid;
  v_s text; v_rec record; v_n integer;
BEGIN
  -- void the settling payment the way the app does
  UPDATE payments SET is_active = false, void_reason = 'Bank transfer bounced ' WHERE id = v_p2;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FLOW FAILED: void touched % rows', v_n; END IF;
  SELECT * INTO v_rec FROM payments WHERE id = v_p2;
  IF v_rec.is_active OR v_rec.voided_at IS NULL
     OR v_rec.voided_by IS DISTINCT FROM 'a0000000-0000-0000-0000-000000000002'::uuid
     OR v_rec.void_reason IS DISTINCT FROM 'Bank transfer bounced' OR v_rec.amount <> 779.50 THEN
    RAISE EXCEPTION 'FLOW FAILED: void trail: active %, at %, by %, reason %, amount %',
      v_rec.is_active, v_rec.voided_at, v_rec.voided_by, v_rec.void_reason, v_rec.amount;
  END IF;
  v_s := pg_temp.inv_state(v_inv);
  IF v_s <> 'partially_paid paid=400.50 due=779.50 ps=partially_paid' THEN
    RAISE EXCEPTION 'FLOW FAILED: after void: %', v_s;
  END IF;
END $$;

SELECT pg_temp.expect_fail('reactivate a voided payment',
  format('UPDATE payments SET is_active = true WHERE id = %L', current_setting('flow.p2')),
  'cannot be changed or reactivated');
SELECT pg_temp.expect_fail('edit the amount of a voided payment',
  format('UPDATE payments SET amount = 1 WHERE id = %L', current_setting('flow.p2')),
  'cannot be changed or reactivated');
SELECT pg_temp.expect_fail('overpay a partially paid invoice',
  format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
            VALUES (%L, 779.56, 'cash', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, current_setting('flow.inv')),
  'exceeds invoice total');

DO $$
DECLARE
  v_inv uuid := current_setting('flow.inv')::uuid;
  v_n integer; v_s text;
BEGIN
  -- a payment cannot be deleted (void instead): refused or nothing deleted
  BEGIN
    DELETE FROM payments WHERE id = current_setting('flow.p1')::uuid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_n := 0;
  END;
  IF v_n <> 0 OR NOT EXISTS (SELECT 1 FROM payments WHERE id = current_setting('flow.p1')::uuid AND is_active) THEN
    RAISE EXCEPTION 'FLOW FAILED: manager deleted a payment';
  END IF;

  -- correction path: re-record the voided amount -> paid again
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 779.50, 'cheque', (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_s := pg_temp.inv_state(v_inv);
  IF v_s <> 'paid paid=1180.00 due=0.00 ps=paid' THEN
    RAISE EXCEPTION 'FLOW FAILED: after re-recording: %', v_s;
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM payments WHERE invoice_id = current_setting('flow.inv')::uuid) <> 3
     OR (SELECT sum(amount) FROM payments WHERE invoice_id = current_setting('flow.inv')::uuid AND is_active) <> 1180.00 THEN
    RAISE EXCEPTION 'FLOW FAILED: owner sees the wrong payment rows';
  END IF;
  RAISE NOTICE 'F2 OK';
END $$;
ROLLBACK;

-- @@ F3 dishware out and back: stock in -> send to event -> return / damaged / lost
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;
-- Item buckets + the event's allocation, checked against expectations and
-- the schema invariant total = available + allocated + damaged + in_repair
-- (quantity_balance_v2; lost stock leaves total).
CREATE FUNCTION pg_temp.check_stock(p_step text, p_item uuid, p_event uuid,
  p_total int, p_avail int, p_alloc int, p_damaged int, p_lost int,
  p_sent int, p_outstanding int, p_active boolean)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_i record; v_a record; v_h record;
BEGIN
  SELECT * INTO v_i FROM inventory_items WHERE id = p_item;
  IF (v_i.total_quantity, v_i.available_quantity, v_i.allocated_quantity, v_i.damaged_quantity, v_i.lost_quantity, v_i.in_repair_quantity)
     IS DISTINCT FROM (p_total, p_avail, p_alloc, p_damaged, p_lost, 0) THEN
    RAISE EXCEPTION 'FLOW FAILED: [%] item total/avail/alloc/damaged/lost/repair = %/%/%/%/%/% (expected %/%/%/%/%/0)', p_step,
      v_i.total_quantity, v_i.available_quantity, v_i.allocated_quantity, v_i.damaged_quantity, v_i.lost_quantity, v_i.in_repair_quantity,
      p_total, p_avail, p_alloc, p_damaged, p_lost;
  END IF;
  IF v_i.total_quantity <> v_i.available_quantity + v_i.allocated_quantity + v_i.damaged_quantity + v_i.in_repair_quantity THEN
    RAISE EXCEPTION 'FLOW FAILED: [%] total <> available + allocated + damaged + in_repair', p_step;
  END IF;
  IF p_event IS NULL THEN RETURN; END IF;
  SELECT * INTO v_a FROM inventory_allocations
  WHERE inventory_item_id = p_item AND reference_type = 'event' AND reference_id = p_event;
  SELECT * INTO v_h FROM reference_allocation_history
  WHERE inventory_item_id = p_item AND reference_type = 'event' AND reference_id = p_event;
  IF v_a.allocated_quantity IS DISTINCT FROM p_sent OR v_a.is_active IS DISTINCT FROM p_active
     OR v_h.outstanding_quantity IS DISTINCT FROM p_outstanding::numeric THEN
    RAISE EXCEPTION 'FLOW FAILED: [%] event allocation sent %, active %, outstanding % (expected %, %, %)', p_step,
      v_a.allocated_quantity, v_a.is_active, v_h.outstanding_quantity, p_sent, p_active, p_outstanding;
  END IF;
  -- the event's open quantity is exactly what the item shows as allocated (only allocation of this item)
  IF v_h.outstanding_quantity <> v_i.allocated_quantity THEN
    RAISE EXCEPTION 'FLOW FAILED: [%] event outstanding % <> item allocated %', p_step, v_h.outstanding_quantity, v_i.allocated_quantity;
  END IF;
END $fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE
  o_a uuid := 'b0000000-0000-0000-0000-00000000000a';
  v_item uuid; v_ev uuid; v_mv record;
BEGIN
  -- new item (the app sends zero quantities) and a planned event at outlet A
  INSERT INTO inventory_items (outlet_id, name, category, unit, lifecycle_status,
                               total_quantity, available_quantity, allocated_quantity,
                               damaged_quantity, in_repair_quantity, lost_quantity)
  VALUES (o_a, 'Flow Brass Thali', 'Plate', 'pcs', 'active', 0, 0, 0, 0, 0, 0)
  RETURNING id INTO v_item;
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_a, 'c0000000-0000-0000-0000-0000000000a3', 'Flow Reception',
          (now() AT TIME ZONE 'Asia/Kolkata')::date + 5, 'planned')
  RETURNING id INTO v_ev;
  PERFORM set_config('flow.item', v_item::text, true);
  PERFORM set_config('flow.ev', v_ev::text, true);

  -- 1. stock in 100 (AddStockModal -> createStockInV2)
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'inflow', 'stock_in', 100, 'manual', NULL, 'purchase', 'Flow purchase', auth.uid())
  RETURNING * INTO v_mv;
  IF v_mv.created_by IS DISTINCT FROM auth.uid() OR v_mv.movement_category <> 'inflow' THEN
    RAISE EXCEPTION 'FLOW FAILED: stock-in row %', row_to_json(v_mv);
  END IF;
  PERFORM pg_temp.check_stock('stock in', v_item, NULL, 100, 100, 0, 0, 0, NULL, NULL, NULL);

  -- 2. send 60 to the event (allocateInventoryV2)
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'outflow', 'allocation', 60, 'event', v_ev, 'event_dispatch', NULL, auth.uid());
  PERFORM pg_temp.check_stock('send 60', v_item, v_ev, 100, 40, 60, 0, 0, 60, 60, true);
  IF NOT (SELECT opening_balance_confirmed FROM inventory_items WHERE id = v_item) THEN
    RAISE EXCEPTION 'FLOW FAILED: first dispatch did not lock the opening balance';
  END IF;
END $$;

-- sending more than is available is refused, and nothing moves
SELECT pg_temp.expect_fail('send more than available',
  format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                quantity, reference_type, reference_id, reason_code, created_by)
            VALUES ('b0000000-0000-0000-0000-00000000000a', %L, 'outflow', 'allocation', 41, 'event', %L, 'event_dispatch', auth.uid())$q$,
         current_setting('flow.item'), current_setting('flow.ev')),
  'insufficient available stock');

DO $$
DECLARE
  o_a uuid := 'b0000000-0000-0000-0000-00000000000a';
  v_item uuid := current_setting('flow.item')::uuid;
  v_ev uuid := current_setting('flow.ev')::uuid;
  v_h record;
BEGIN
  PERFORM pg_temp.check_stock('after refused over-send', v_item, v_ev, 100, 40, 60, 0, 0, 60, 60, true);

  -- 3. 30 come back fine (returnInventoryV2, is_damaged = false)
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'return', 'return', 30, 'event', v_ev, 'normal_return', NULL, auth.uid());
  PERFORM pg_temp.check_stock('return 30', v_item, v_ev, 100, 70, 30, 0, 0, 60, 30, true);

  -- 4. 10 come back damaged (returnInventoryV2, is_damaged = true)
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'return', 'return_damaged', 10, 'event', v_ev, 'client_damage', NULL, auth.uid());
  PERFORM pg_temp.check_stock('return 10 damaged', v_item, v_ev, 100, 70, 20, 10, 0, 60, 20, true);

  -- 5. 5 lost at the client (writeOffInventoryV2, reason client_lost -> loss)
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'writeoff', 'loss', 5, 'event', v_ev, 'client_lost', 'Not returned by client', auth.uid());
  PERFORM pg_temp.check_stock('lose 5', v_item, v_ev, 95, 70, 15, 10, 5, 60, 15, true);

  SELECT * INTO v_h FROM reference_allocation_history WHERE reference_id = v_ev AND inventory_item_id = v_item;
  IF (v_h.allocated_quantity, v_h.returned_good, v_h.returned_damaged, v_h.lost, v_h.disposed)
     IS DISTINCT FROM (60::numeric, 30::numeric, 10::numeric, 5::numeric, 0::numeric) THEN
    RAISE EXCEPTION 'FLOW FAILED: event history %', row_to_json(v_h);
  END IF;
END $$;

-- more than is still out cannot come back or be written off
SELECT pg_temp.expect_fail('return more than outstanding',
  format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                quantity, reference_type, reference_id, reason_code, created_by)
            VALUES ('b0000000-0000-0000-0000-00000000000a', %L, 'return', 'return', 16, 'event', %L, 'normal_return', auth.uid())$q$,
         current_setting('flow.item'), current_setting('flow.ev')),
  'more than outstanding');
SELECT pg_temp.expect_fail('lose more than outstanding',
  format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                quantity, reference_type, reference_id, reason_code, notes, created_by)
            VALUES ('b0000000-0000-0000-0000-00000000000a', %L, 'writeoff', 'loss', 16, 'event', %L, 'client_lost', 'x', auth.uid())$q$,
         current_setting('flow.item'), current_setting('flow.ev')),
  'more than outstanding');
-- the ledger is append-only: edits/deletes are refused or touch 0 rows
DO $$
DECLARE v_n integer := 0; v_m integer := 0;
BEGIN
  BEGIN
    UPDATE inventory_movements SET quantity = 1 WHERE inventory_item_id = current_setting('flow.item')::uuid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_n := 0;
  END;
  BEGIN
    DELETE FROM inventory_movements WHERE inventory_item_id = current_setting('flow.item')::uuid;
    GET DIAGNOSTICS v_m = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_m := 0;
  END;
  IF v_n <> 0 OR v_m <> 0 THEN
    RAISE EXCEPTION 'FLOW FAILED: manager changed % / deleted % ledger rows', v_n, v_m;
  END IF;
END $$;

DO $$
DECLARE
  o_a uuid := 'b0000000-0000-0000-0000-00000000000a';
  v_item uuid := current_setting('flow.item')::uuid;
  v_ev uuid := current_setting('flow.ev')::uuid;
BEGIN
  PERFORM pg_temp.check_stock('after refused over-return', v_item, v_ev, 95, 70, 15, 10, 5, 60, 15, true);
  -- 6. the last 15 come back -> the event's allocation closes
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES (o_a, v_item, 'return', 'return', 15, 'event', v_ev, 'normal_return', NULL, auth.uid());
  PERFORM pg_temp.check_stock('return last 15', v_item, v_ev, 95, 85, 0, 10, 5, 60, 0, false);
END $$;
RESET ROLE;
DO $$
DECLARE v_item uuid := current_setting('flow.item')::uuid;
BEGIN
  -- ledger: 100 in = 85 available + 10 damaged + 5 lost; every row by the manager
  IF (SELECT count(*) FROM inventory_movements WHERE inventory_item_id = v_item) <> 6
     OR EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_item_id = v_item
                AND created_by IS DISTINCT FROM 'a0000000-0000-0000-0000-000000000002'::uuid) THEN
    RAISE EXCEPTION 'FLOW FAILED: ledger rows for the item: %',
      (SELECT json_agg(json_build_object('t', movement_type, 'q', quantity, 'by', created_by)) FROM inventory_movements WHERE inventory_item_id = v_item);
  END IF;
  RAISE NOTICE 'F3 OK';
END $$;
ROLLBACK;

-- @@ F4a outlet isolation: manager of outlet A only
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;
CREATE FUNCTION pg_temp.expect_rows(p_label text, p_sql text, p_rows integer)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_n integer;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FLOW FAILED: % raised: %', p_label, SQLERRM;
  END;
  IF v_n <> p_rows THEN
    RAISE EXCEPTION 'FLOW FAILED: % touched % row(s), expected %', p_label, v_n, p_rows;
  END IF;
END $fn$;

-- owner: a payment and a stock item at outlet B, and the expected counts per outlet
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
VALUES ('f0000000-0000-0000-0000-000000000003', 90, 'cash', '2025-11-02');
INSERT INTO inventory_items (id, outlet_id, name, category, unit, lifecycle_status)
VALUES ('10000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Flow B Bowl', 'Bowl', 'pcs', 'active');
-- outlet B activity in every module, so the sweep below has something to leak
INSERT INTO clients (id, outlet_id, client_type, name, phone)
VALUES ('c0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-00000000000b', 'event', 'Flow B Event Client', '9000000083');
INSERT INTO events (id, outlet_id, client_id, event_name, event_date, status)
VALUES ('e0000000-0000-0000-0000-0000000000b3', 'b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-0000000000b3',
        'Flow B Party', (now() AT TIME ZONE 'Asia/Kolkata')::date + 3, 'planned');
INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, quantity, price_per_unit, next_billing_date, status)
VALUES ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-0000000000b1', 'monthly', 1,
        (now() AT TIME ZONE 'Asia/Kolkata')::date, 10, 5, (now() AT TIME ZONE 'Asia/Kolkata')::date + 30, 'active');
INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-0000000000b1', 'inflow', 'stock_in', 20, 'manual', 'purchase',
        'a0000000-0000-0000-0000-000000000001');
INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reference_id, reason_code, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-0000000000b1', 'outflow', 'allocation', 5, 'event',
        'e0000000-0000-0000-0000-0000000000b3', 'event_dispatch', 'a0000000-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claims', '', true);
-- relations with an outlet_id column that hold outlet B rows (owner view)
DO $$
DECLARE r record; v_n bigint; v_rels integer := 0;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'outlet_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE outlet_id = %L', r.relname, 'b0000000-0000-0000-0000-00000000000b') INTO v_n;
    IF v_n > 0 THEN v_rels := v_rels + 1; END IF;
  END LOOP;
  IF v_rels < 10 THEN
    RAISE EXCEPTION 'FLOW FAILED: setup: only % relations hold outlet B rows', v_rels;
  END IF;
  PERFORM set_config('flow.b_rels', v_rels::text, true);
END $$;
SELECT set_config('flow.inv_a', (SELECT count(*) FROM invoices WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a')::text, true),
       set_config('flow.cli_a', (SELECT count(*) FROM clients WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a')::text, true),
       set_config('flow.pay_a', (SELECT count(*) FROM payments p JOIN invoices i ON i.id = p.invoice_id
                                 WHERE i.outlet_id = 'b0000000-0000-0000-0000-00000000000a')::text, true),
       set_config('flow.item_a', (SELECT count(*) FROM inventory_items WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a')::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE o_b uuid := 'b0000000-0000-0000-0000-00000000000b';
BEGIN
  IF (SELECT count(*) FROM invoices) <> current_setting('flow.inv_a')::int
     OR (SELECT count(*) FROM clients) <> current_setting('flow.cli_a')::int
     OR (SELECT count(*) FROM payments) <> current_setting('flow.pay_a')::int
     OR (SELECT count(*) FROM inventory_items) <> current_setting('flow.item_a')::int
     OR current_setting('flow.inv_a')::int = 0 OR current_setting('flow.pay_a')::int = 0 THEN
    RAISE EXCEPTION 'FLOW FAILED: mgr1 sees invoices %/%, clients %/%, payments %/%, items %/% (visible/expected outlet A)',
      (SELECT count(*) FROM invoices), current_setting('flow.inv_a'),
      (SELECT count(*) FROM clients), current_setting('flow.cli_a'),
      (SELECT count(*) FROM payments), current_setting('flow.pay_a'),
      (SELECT count(*) FROM inventory_items), current_setting('flow.item_a');
  END IF;
  IF EXISTS (SELECT 1 FROM invoices WHERE outlet_id = o_b)
     OR EXISTS (SELECT 1 FROM clients WHERE outlet_id = o_b)
     OR EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = 'f0000000-0000-0000-0000-000000000003')
     OR EXISTS (SELECT 1 FROM payments WHERE invoice_id = 'f0000000-0000-0000-0000-000000000003')
     OR EXISTS (SELECT 1 FROM payments_with_details WHERE outlet_id = o_b)
     OR EXISTS (SELECT 1 FROM invoices_with_payment_status WHERE outlet_id = o_b)
     OR EXISTS (SELECT 1 FROM inventory_items WHERE outlet_id = o_b) THEN
    RAISE EXCEPTION 'FLOW FAILED: mgr1 can see outlet B rows';
  END IF;
END $$;
-- sweep: no public table or view with an outlet_id column shows mgr1 an outlet B row
DO $$
DECLARE r record; v_n bigint; v_checked integer := 0;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'outlet_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I WHERE outlet_id = %L', r.relname, 'b0000000-0000-0000-0000-00000000000b') INTO v_n;
    EXCEPTION WHEN insufficient_privilege THEN
      v_n := 0;
    END;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'FLOW FAILED: mgr1 sees % outlet B row(s) in %', v_n, r.relname;
    END IF;
    v_checked := v_checked + 1;
  END LOOP;
  IF v_checked < 10 THEN
    RAISE EXCEPTION 'FLOW FAILED: outlet sweep only found % relations with outlet_id', v_checked;
  END IF;
END $$;
SELECT pg_temp.expect_fail('mgr1 creates a client at outlet B',
  $q$INSERT INTO clients (outlet_id, client_type, name, phone)
     VALUES ('b0000000-0000-0000-0000-00000000000b', 'corporate', 'Flow Intruder', '9000000077')$q$,
  'row-level security');
SELECT pg_temp.expect_fail('mgr1 creates an invoice at outlet B',
  $q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
     VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'draft')$q$,
  'row-level security|client does not exist');
SELECT pg_temp.expect_fail('mgr1 records a payment on an outlet B invoice',
  $q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
     VALUES ('f0000000-0000-0000-0000-000000000003', 1, 'cash', '2025-11-03')$q$,
  'row-level security|invoice does not exist');
SELECT pg_temp.expect_fail('mgr1 posts stock-in on an outlet B item',
  $q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
     VALUES ('b0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-0000000000b1', 'inflow', 'stock_in', 5, 'manual', 'purchase', auth.uid())$q$,
  'row-level security');
SELECT pg_temp.expect_rows('mgr1 edits an outlet B invoice',
  $q$UPDATE invoices SET terms_and_conditions = 'x' WHERE id = 'f0000000-0000-0000-0000-000000000003'$q$, 0);
SELECT pg_temp.expect_rows('mgr1 edits an outlet B client',
  $q$UPDATE clients SET name = 'Hijacked' WHERE id = 'c0000000-0000-0000-0000-0000000000b1'$q$, 0);
SELECT pg_temp.expect_rows('mgr1 voids an outlet B payment',
  $q$UPDATE payments SET is_active = false WHERE invoice_id = 'f0000000-0000-0000-0000-000000000003'$q$, 0);
-- own outlet works; moving a client to outlet B does not
DO $$
DECLARE v_c uuid;
BEGIN
  INSERT INTO clients (outlet_id, client_type, name, phone)
  VALUES ('b0000000-0000-0000-0000-00000000000a', 'corporate', 'Flow Own Client', '9000000078') RETURNING id INTO v_c;
  PERFORM set_config('flow.c', v_c::text, true);
END $$;
SELECT pg_temp.expect_fail('mgr1 moves a client to outlet B',
  format($q$UPDATE clients SET outlet_id = 'b0000000-0000-0000-0000-00000000000b' WHERE id = %L$q$, current_setting('flow.c')),
  'row-level security|outlet');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT name FROM clients WHERE id = 'c0000000-0000-0000-0000-0000000000b1') <> 'Seed Corp B1'
     OR (SELECT terms_and_conditions FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000003') IS NOT DISTINCT FROM 'x'
     OR NOT (SELECT bool_and(is_active) FROM payments WHERE invoice_id = 'f0000000-0000-0000-0000-000000000003')
     OR (SELECT outlet_id FROM clients WHERE id = current_setting('flow.c')::uuid) <> 'b0000000-0000-0000-0000-00000000000a'
     OR (SELECT total_quantity FROM inventory_items WHERE id = '10000000-0000-0000-0000-0000000000b1') <> 20 THEN
    RAISE EXCEPTION 'FLOW FAILED: outlet B data changed by mgr1';
  END IF;
  RAISE NOTICE 'F4a OK';
END $$;
ROLLBACK;

-- @@ F4b outlet visibility: manager of A+B, and admin, see both outlets
BEGIN;
-- Row count of every public table and view as the current role (-1 = refused).
CREATE FUNCTION pg_temp.counts()
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE r record; v_n bigint; v_j jsonb := '{}';
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v') LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I', r.relname) INTO v_n;
    EXCEPTION WHEN insufficient_privilege THEN v_n := -1;
    END;
    v_j := v_j || jsonb_build_object(r.relname, v_n);
  END LOOP;
  RETURN v_j;
END $fn$;
-- The current role sees exactly the owner's rows (flow.owner) in every
-- table and view except p_except (admin-only data: users, settings, ...).
CREATE FUNCTION pg_temp.sees_all(p_who text, p_except text[])
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_diff text;
BEGIN
  SELECT string_agg(format('%s %s/%s', e.key, e.value, current_setting('flow.owner')::jsonb ->> e.key), ', ')
  INTO v_diff
  FROM jsonb_each_text(pg_temp.counts()) e
  WHERE e.key <> ALL (p_except)
    AND e.value IS DISTINCT FROM current_setting('flow.owner')::jsonb ->> e.key;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'FLOW FAILED: % does not see every row (visible/owner): %', p_who, v_diff;
  END IF;
END $fn$;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
VALUES ('f0000000-0000-0000-0000-000000000003', 90, 'cash', '2025-11-02');
SELECT set_config('request.jwt.claims', '', true);
-- owner totals (everything) and per outlet A+B
SELECT set_config('flow.inv', (SELECT count(*) FROM invoices)::text, true),
       set_config('flow.cli', (SELECT count(*) FROM clients)::text, true),
       set_config('flow.pay', (SELECT count(*) FROM payments)::text, true),
       set_config('flow.items', (SELECT count(*) FROM invoice_items)::text, true),
       set_config('flow.mv', (SELECT count(*) FROM inventory_movements)::text, true),
       set_config('flow.outlets', (SELECT count(*) FROM outlets)::text, true),
       set_config('flow.users', (SELECT count(*) FROM user_profiles)::text, true);
SELECT set_config('flow.owner', pg_temp.counts()::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
DO $$
BEGIN
  -- every seeded row belongs to outlet A or B, so mgr2 sees all of them
  IF (SELECT count(*) FROM invoices) <> current_setting('flow.inv')::int
     OR (SELECT count(*) FROM clients) <> current_setting('flow.cli')::int
     OR (SELECT count(*) FROM payments) <> current_setting('flow.pay')::int
     OR (SELECT count(*) FROM invoice_items) <> current_setting('flow.items')::int
     OR NOT EXISTS (SELECT 1 FROM invoices WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000b')
     OR NOT EXISTS (SELECT 1 FROM invoices WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a')
     OR NOT EXISTS (SELECT 1 FROM clients WHERE id = 'c0000000-0000-0000-0000-0000000000b1')
     OR NOT EXISTS (SELECT 1 FROM payments_with_details WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'FLOW FAILED: mgr2 sees invoices %/%, clients %/%, payments %/%',
      (SELECT count(*) FROM invoices), current_setting('flow.inv'),
      (SELECT count(*) FROM clients), current_setting('flow.cli'),
      (SELECT count(*) FROM payments), current_setting('flow.pay');
  END IF;
END $$;
-- every table / view (outlet-scoped data) as the owner sees it; user
-- management, settings and the migration log are admin-only
SELECT pg_temp.sees_all('mgr2', ARRAY['user_profiles', 'admin_users_summary', 'user_outlet_assignments',
                                      'system_settings', 'inventory_migration_log']);
-- mgr2 can work at outlet B
DO $$
DECLARE v_c uuid; v_i uuid;
BEGIN
  INSERT INTO clients (outlet_id, client_type, name, phone)
  VALUES ('b0000000-0000-0000-0000-00000000000b', 'corporate', 'Flow B Client', '9000000079') RETURNING id INTO v_c;
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
  VALUES ('subscription', v_c, 'b0000000-0000-0000-0000-00000000000b', 'draft') RETURNING id INTO v_i;
  IF v_i IS NULL THEN RAISE EXCEPTION 'FLOW FAILED: mgr2 could not create an outlet B invoice'; END IF;
END $$;
RESET ROLE;
SELECT set_config('flow.owner', pg_temp.counts()::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT pg_temp.sees_all('admin', ARRAY[]::text[]);
DO $$
BEGIN
  -- admin: everything (the two rows mgr2 just added included)
  IF (SELECT count(*) FROM invoices) <> current_setting('flow.inv')::int + 1
     OR (SELECT count(*) FROM clients) <> current_setting('flow.cli')::int + 1
     OR (SELECT count(*) FROM payments) <> current_setting('flow.pay')::int
     OR (SELECT count(*) FROM invoice_items) <> current_setting('flow.items')::int
     OR (SELECT count(*) FROM inventory_movements) <> current_setting('flow.mv')::int
     OR (SELECT count(*) FROM outlets) <> current_setting('flow.outlets')::int
     OR (SELECT count(*) FROM user_profiles) <> current_setting('flow.users')::int THEN
    RAISE EXCEPTION 'FLOW FAILED: admin sees invoices %, clients %, payments %, items %, movements %, outlets %, users %',
      (SELECT count(*) FROM invoices), (SELECT count(*) FROM clients), (SELECT count(*) FROM payments),
      (SELECT count(*) FROM invoice_items), (SELECT count(*) FROM inventory_movements),
      (SELECT count(*) FROM outlets), (SELECT count(*) FROM user_profiles);
  END IF;
  RAISE NOTICE 'F4b OK';
END $$;
ROLLBACK;

-- @@ F4c accountant: reads every outlet, every write refused
BEGIN;
-- Row count of every public table and view as the current role (-1 = refused).
CREATE FUNCTION pg_temp.counts()
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE r record; v_n bigint; v_j jsonb := '{}';
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v') LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I', r.relname) INTO v_n;
    EXCEPTION WHEN insufficient_privilege THEN v_n := -1;
    END;
    v_j := v_j || jsonb_build_object(r.relname, v_n);
  END LOOP;
  RETURN v_j;
END $fn$;
-- The current role sees exactly the owner's rows (flow.owner) in every
-- table and view except p_except (admin-only data: users, settings, ...).
CREATE FUNCTION pg_temp.sees_all(p_who text, p_except text[])
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_diff text;
BEGIN
  SELECT string_agg(format('%s %s/%s', e.key, e.value, current_setting('flow.owner')::jsonb ->> e.key), ', ')
  INTO v_diff
  FROM jsonb_each_text(pg_temp.counts()) e
  WHERE e.key <> ALL (p_except)
    AND e.value IS DISTINCT FROM current_setting('flow.owner')::jsonb ->> e.key;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'FLOW FAILED: % does not see every row (visible/owner): %', p_who, v_diff;
  END IF;
END $fn$;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;
-- UPDATE / DELETE: refused outright or filtered to zero rows by RLS
CREATE FUNCTION pg_temp.expect_no_write(p_label text, p_sql text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_n integer;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FLOW FAILED: % changed % row(s)', p_label, v_n;
  END IF;
END $fn$;

SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
VALUES ('f0000000-0000-0000-0000-000000000003', 90, 'cash', '2025-11-02');
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('flow.inv', (SELECT count(*) FROM invoices)::text, true),
       set_config('flow.cli', (SELECT count(*) FROM clients)::text, true),
       set_config('flow.pay', (SELECT count(*) FROM payments)::text, true),
       set_config('flow.items', (SELECT count(*) FROM invoice_items)::text, true),
       set_config('flow.mv', (SELECT count(*) FROM inventory_movements)::text, true),
       set_config('flow.state', (SELECT md5(string_agg(t, '|' ORDER BY t)) FROM (
         SELECT row_to_json(i)::text AS t FROM invoices i UNION ALL
         SELECT row_to_json(ii)::text FROM invoice_items ii UNION ALL
         SELECT row_to_json(p)::text FROM payments p UNION ALL
         SELECT row_to_json(c)::text FROM clients c UNION ALL
         SELECT row_to_json(m)::text FROM inventory_movements m UNION ALL
         SELECT row_to_json(it)::text FROM inventory_items it) s), true);
SELECT set_config('flow.owner', pg_temp.counts()::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM invoices) <> current_setting('flow.inv')::int
     OR (SELECT count(*) FROM clients) <> current_setting('flow.cli')::int
     OR (SELECT count(*) FROM payments) <> current_setting('flow.pay')::int
     OR (SELECT count(*) FROM invoice_items) <> current_setting('flow.items')::int
     OR (SELECT count(*) FROM inventory_movements) <> current_setting('flow.mv')::int
     OR (SELECT count(DISTINCT outlet_id) FROM invoices) <> 2
     OR (SELECT count(*) FROM payments_with_details) <> current_setting('flow.pay')::int THEN
    RAISE EXCEPTION 'FLOW FAILED: accountant sees invoices %/%, clients %/%, payments %/%, items %/%, movements %/%',
      (SELECT count(*) FROM invoices), current_setting('flow.inv'),
      (SELECT count(*) FROM clients), current_setting('flow.cli'),
      (SELECT count(*) FROM payments), current_setting('flow.pay'),
      (SELECT count(*) FROM invoice_items), current_setting('flow.items'),
      (SELECT count(*) FROM inventory_movements), current_setting('flow.mv');
  END IF;
END $$;

SELECT pg_temp.sees_all('accountant', ARRAY['user_profiles', 'admin_users_summary', 'user_outlet_assignments',
                                            'system_settings', 'inventory_migration_log']);
-- clients
SELECT pg_temp.expect_fail('accountant creates a client',
  $q$INSERT INTO clients (outlet_id, client_type, name, phone)
     VALUES ('b0000000-0000-0000-0000-00000000000a', 'corporate', 'Flow Acct Client', '9000000080')$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_no_write('accountant edits a client',
  $q$UPDATE clients SET name = 'Edited' WHERE id = 'c0000000-0000-0000-0000-0000000000a1'$q$);
SELECT pg_temp.expect_no_write('accountant deletes a client',
  $q$DELETE FROM clients WHERE id = 'c0000000-0000-0000-0000-0000000000b1'$q$);
-- invoices
SELECT pg_temp.expect_fail('accountant creates an invoice',
  $q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
     VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft')$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_no_write('accountant edits a draft invoice',
  $q$UPDATE invoices SET terms_and_conditions = 'x' WHERE id = 'f0000000-0000-0000-0000-000000000004'$q$);
SELECT pg_temp.expect_no_write('accountant finalizes a draft invoice',
  $q$UPDATE invoices SET status = 'finalized' WHERE id = 'f0000000-0000-0000-0000-000000000004'$q$);
SELECT pg_temp.expect_no_write('accountant cancels a finalized invoice',
  $q$UPDATE invoices SET status = 'cancelled' WHERE id = 'f0000000-0000-0000-0000-000000000003'$q$);
SELECT pg_temp.expect_no_write('accountant discards a draft invoice',
  $q$DELETE FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000004'$q$);
-- invoice_items (f..04 is a draft, so only RLS can stop these)
SELECT pg_temp.expect_fail('accountant adds an invoice item',
  $q$INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
     VALUES ('f0000000-0000-0000-0000-000000000004', 'x', 1, 1, 1, 0, 0)$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_no_write('accountant edits an invoice item',
  $q$UPDATE invoice_items SET quantity = 99 WHERE invoice_id = 'f0000000-0000-0000-0000-000000000004'$q$);
SELECT pg_temp.expect_no_write('accountant deletes an invoice item',
  $q$DELETE FROM invoice_items WHERE invoice_id = 'f0000000-0000-0000-0000-000000000004'$q$);
-- payments
SELECT pg_temp.expect_fail('accountant records a payment',
  $q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
     VALUES ('f0000000-0000-0000-0000-000000000003', 10, 'cash', '2025-11-03')$q$,
  'row-level security|permission denied|invoice does not exist');
SELECT pg_temp.expect_no_write('accountant voids a payment',
  $q$UPDATE payments SET is_active = false, void_reason = 'x' WHERE invoice_id = 'f0000000-0000-0000-0000-000000000001'$q$);
SELECT pg_temp.expect_no_write('accountant deletes a payment',
  $q$DELETE FROM payments WHERE invoice_id = 'f0000000-0000-0000-0000-000000000003'$q$);
-- inventory movements
SELECT pg_temp.expect_fail('accountant posts a stock-in',
  $q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
     VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'inflow', 'stock_in', 5, 'manual', 'purchase', auth.uid())$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_fail('accountant sends dishes to an event',
  $q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reference_id, reason_code, created_by)
     VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'return', 'return', 1, 'event',
             'e0000000-0000-0000-0000-0000000000a3', 'normal_return', auth.uid())$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_no_write('accountant edits a movement',
  $q$UPDATE inventory_movements SET quantity = 1 WHERE inventory_item_id = '10000000-0000-0000-0000-0000000000a1'$q$);
SELECT pg_temp.expect_no_write('accountant deletes a movement',
  $q$DELETE FROM inventory_movements WHERE inventory_item_id = '10000000-0000-0000-0000-0000000000a1'$q$);
SELECT pg_temp.expect_no_write('accountant renames a stock item',
  $q$UPDATE inventory_items SET name = 'x' WHERE id = '10000000-0000-0000-0000-0000000000a1'$q$);
-- sweep: no UPDATE / DELETE reaches any row of any public table (the
-- accountant's own name/phone is editable by design, 043 own-profile rule)
DO $$
DECLARE r record; v_n integer;
BEGIN
  FOR r IN
    SELECT c.relname, a.attname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN LATERAL (SELECT attname FROM pg_attribute WHERE attrelid = c.oid AND attnum > 0 AND NOT attisdropped
                  ORDER BY attnum LIMIT 1) a ON true
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    PERFORM pg_temp.expect_no_write('accountant UPDATE on ' || r.relname,
      format('UPDATE %I SET %I = %I', r.relname, r.attname, r.attname)
      || CASE WHEN r.relname = 'user_profiles' THEN ' WHERE id <> auth.uid()' ELSE '' END);
    PERFORM pg_temp.expect_no_write('accountant DELETE on ' || r.relname, format('DELETE FROM %I', r.relname));
  END LOOP;
END $$;
RESET ROLE;
DO $$
DECLARE v_now text;
BEGIN
  SELECT md5(string_agg(t, '|' ORDER BY t)) INTO v_now FROM (
    SELECT row_to_json(i)::text AS t FROM invoices i UNION ALL
    SELECT row_to_json(ii)::text FROM invoice_items ii UNION ALL
    SELECT row_to_json(p)::text FROM payments p UNION ALL
    SELECT row_to_json(c)::text FROM clients c UNION ALL
    SELECT row_to_json(m)::text FROM inventory_movements m UNION ALL
    SELECT row_to_json(it)::text FROM inventory_items it) s;
  IF v_now <> current_setting('flow.state') THEN
    RAISE EXCEPTION 'FLOW FAILED: data changed during the accountant session';
  END IF;
  RAISE NOTICE 'F4c OK';
END $$;
ROLLBACK;

-- @@ F4d anon and a deactivated manager: no reads, no writes
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION 'FLOW FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FLOW FAILED: % was ALLOWED', p_label;
END $fn$;
CREATE FUNCTION pg_temp.expect_no_write(p_label text, p_sql text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_n integer;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'FLOW FAILED: % changed % row(s)', p_label, v_n;
  END IF;
END $fn$;
-- Every public table and view: the current role sees no rows (or the read
-- is refused). Exceptions: admin_role_permission_matrix is a static VALUES
-- list (no data), and a signed-in user's OWN profile row is not counted.
CREATE FUNCTION pg_temp.read_sweep(p_who text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r record; v_n bigint;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v') AND c.relname <> 'admin_role_permission_matrix'
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I', r.relname)
        || CASE r.relname WHEN 'user_profiles' THEN ' WHERE id IS DISTINCT FROM auth.uid()'
                          WHEN 'admin_users_summary' THEN ' WHERE user_id IS DISTINCT FROM auth.uid()'
                          ELSE '' END
      INTO v_n;
    EXCEPTION WHEN insufficient_privilege THEN
      v_n := 0;
    END;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'FLOW FAILED: % can read % row(s) of %', p_who, v_n, r.relname;
    END IF;
  END LOOP;
END $fn$;
-- Every public table: UPDATE / DELETE reach no row (or are refused).
CREATE FUNCTION pg_temp.write_sweep(p_who text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, a.attname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN LATERAL (SELECT attname FROM pg_attribute WHERE attrelid = c.oid AND attnum > 0 AND NOT attisdropped
                  ORDER BY attnum LIMIT 1) a ON true
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    PERFORM pg_temp.expect_no_write(p_who || ' UPDATE on ' || r.relname,
      format('UPDATE %I SET %I = %I', r.relname, r.attname, r.attname));
    PERFORM pg_temp.expect_no_write(p_who || ' DELETE on ' || r.relname, format('DELETE FROM %I', r.relname));
  END LOOP;
END $fn$;

-- anon (public anon key, no session)
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.read_sweep('anon');
SELECT pg_temp.expect_fail('anon creates a client',
  $q$INSERT INTO clients (outlet_id, client_type, name, phone)
     VALUES ('b0000000-0000-0000-0000-00000000000a', 'corporate', 'Flow Anon', '9000000081')$q$,
  'row-level security|permission denied');
SELECT pg_temp.expect_fail('anon creates an invoice',
  $q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
     VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft')$q$,
  'row-level security|permission denied|client does not exist');
SELECT pg_temp.expect_fail('anon records a payment',
  $q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
     VALUES ('f0000000-0000-0000-0000-000000000001', 1, 'cash', '2025-11-03')$q$,
  'row-level security|permission denied|invoice does not exist');
SELECT pg_temp.expect_no_write('anon edits an invoice',
  $q$UPDATE invoices SET terms_and_conditions = 'x'$q$);
SELECT pg_temp.expect_no_write('anon voids payments',
  $q$UPDATE payments SET is_active = false$q$);
SELECT pg_temp.write_sweep('anon');
RESET ROLE;

-- deactivate mgr2 (A+B) with a leftover token
UPDATE user_profiles SET is_active = false WHERE id = 'a0000000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SELECT pg_temp.read_sweep('deactivated manager');
SELECT pg_temp.expect_fail('deactivated manager creates a client',
  $q$INSERT INTO clients (outlet_id, client_type, name, phone)
     VALUES ('b0000000-0000-0000-0000-00000000000a', 'corporate', 'Flow Ghost', '9000000082')$q$,
  'row-level security|inactive');
SELECT pg_temp.expect_fail('deactivated manager creates an invoice',
  $q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
     VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft')$q$,
  'row-level security|inactive|client does not exist');
SELECT pg_temp.expect_fail('deactivated manager records a payment',
  $q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
     VALUES ('f0000000-0000-0000-0000-000000000001', 1, 'cash', '2025-11-03')$q$,
  'row-level security|inactive|invoice does not exist');
SELECT pg_temp.expect_fail('deactivated manager posts a stock-in',
  $q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
     VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'inflow', 'stock_in', 5, 'manual', 'purchase', auth.uid())$q$,
  'row-level security|inactive');
SELECT pg_temp.expect_no_write('deactivated manager edits a draft invoice',
  $q$UPDATE invoices SET terms_and_conditions = 'x' WHERE id = 'f0000000-0000-0000-0000-000000000004'$q$);
SELECT pg_temp.expect_no_write('deactivated manager voids a payment',
  $q$UPDATE payments SET is_active = false WHERE invoice_id = 'f0000000-0000-0000-0000-000000000001'$q$);
SELECT pg_temp.expect_no_write('deactivated manager edits a client',
  $q$UPDATE clients SET name = 'x' WHERE id = 'c0000000-0000-0000-0000-0000000000b1'$q$);
SELECT pg_temp.expect_no_write('deactivated manager deletes a draft item',
  $q$DELETE FROM invoice_items WHERE invoice_id = 'f0000000-0000-0000-0000-000000000004'$q$);
SELECT pg_temp.write_sweep('deactivated manager');   -- own profile included (043: only while active)
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM invoice_items WHERE invoice_id = 'f0000000-0000-0000-0000-000000000004') <> 1
     OR (SELECT terms_and_conditions FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000004') IS NOT DISTINCT FROM 'x'
     OR EXISTS (SELECT 1 FROM payments WHERE NOT is_active)
     OR EXISTS (SELECT 1 FROM clients WHERE name IN ('x', 'Flow Ghost', 'Flow Anon')) THEN
    RAISE EXCEPTION 'FLOW FAILED: data changed by anon / deactivated sessions';
  END IF;
  RAISE NOTICE 'F4d OK';
END $$;
ROLLBACK;
