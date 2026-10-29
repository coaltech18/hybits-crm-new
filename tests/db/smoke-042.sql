-- =====================================================================
-- Harness smoke checks for high-risk 042 behaviours.
-- Split by "-- @@ <name>" markers; migrations.test.mjs runs each chunk on its own
-- and reports it separately. Every chunk is BEGIN ... ROLLBACK.
-- Fixed ids come from seed-pre042.sql:
--   users  admin a..01, mgr1 a..02 (outlet A), acct a..03, mgr2 a..04 (A+B)
--   outlets A b..0a (code SA, gstin), B b..0b (code SB)
--   clients a1, a2 (sez), a3 (event)  @A;  b1 @B
--   invoices f..01 A outlet_short finalized (500 paid) | f..02 A fy_only SEZ
--            f..03 B default finalized | f..04 A draft fy_only | f..05 A event
--   item 10..a1 @A; event e..a3 (40 out, 30 back); subs d..a1/a2/a3
-- =====================================================================

-- @@ S0 post-042 data state (backfills / repairs on pre-existing rows)
BEGIN;
DO $$
DECLARE v_rec record;
BEGIN
  -- snapshot backfill: 4 issued seed invoices, draft untouched
  IF (SELECT count(*) FROM invoices WHERE id::text LIKE 'f0000000-%' AND client_name_snap IS NOT NULL) <> 4
     OR EXISTS (SELECT 1 FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000004' AND client_name_snap IS NOT NULL) THEN
    RAISE EXCEPTION 'SMOKE FAILED: snapshot backfill wrong';
  END IF;
  SELECT client_gst_type_snap, supplier_gstin_snap INTO v_rec FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000003';
  IF v_rec.client_gst_type_snap <> 'domestic' OR v_rec.supplier_gstin_snap IS NOT NULL THEN
    RAISE EXCEPTION 'SMOKE FAILED: NULL gst_type / NULL outlet gstin snapshot wrong: %', row_to_json(v_rec);
  END IF;
  IF (SELECT client_gst_type_snap FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000002') <> 'sez' THEN
    RAISE EXCEPTION 'SMOKE FAILED: SEZ snapshot wrong';
  END IF;
  -- price history names
  IF EXISTS (SELECT 1 FROM subscription_price_history WHERE changed_by IS NOT NULL AND changed_by_name IS NULL) THEN
    RAISE EXCEPTION 'SMOKE FAILED: price history changed_by_name not backfilled';
  END IF;
  -- phantom repair
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = 'd0000000-0000-0000-0000-0000000000a2'
                 AND questionnaire->>'notes' = 'kit only'
                 AND (questionnaire->'standard_kit'->0->>'quantity')::int = 25) THEN
    RAISE EXCEPTION 'SMOKE FAILED: phantom kit not copied into questionnaire (existing keys kept)';
  END IF;
  IF EXISTS (SELECT 1 FROM inventory_allocations WHERE reference_id = 'd0000000-0000-0000-0000-0000000000a2' AND is_active) THEN
    RAISE EXCEPTION 'SMOKE FAILED: phantom allocation not closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventory_allocations WHERE reference_id = 'd0000000-0000-0000-0000-0000000000a3'
                 AND allocated_quantity = 5 AND is_active) THEN
    RAISE EXCEPTION 'SMOKE FAILED: partially phantom allocation not trimmed to 5';
  END IF;
  -- structural
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payments'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%CURRENT_DATE%') THEN
    RAISE EXCEPTION 'SMOKE FAILED: UTC CURRENT_DATE check still on payments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'invoices_one_live_invoice_per_event') THEN
    RAISE EXCEPTION 'SMOKE FAILED: one-live-invoice-per-event index missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'v'
               AND NOT COALESCE('security_invoker=true' = ANY (c.reloptions), false)) THEN
    RAISE EXCEPTION 'SMOKE FAILED: views without security_invoker: %',
      (SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'v'
         AND NOT COALESCE('security_invoker=true' = ANY (c.reloptions), false));
  END IF;
  RAISE NOTICE 'S0 OK';
END $$;
ROLLBACK;

-- @@ S1 numbering: two outlets, outlet_short next day, default/fy across RLS
BEGIN;
-- mgr2 (outlets A+B)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
DO $$
DECLARE n text[] := '{}'; v text;
BEGIN
  -- outlet_short, day 1 and day 2, both outlets (A already has INV-SA-0031)
  FOREACH v IN ARRAY ARRAY['2026-10-01', '2026-10-02'] LOOP
    INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
    VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft', 'outlet_short', v::date)
    RETURNING invoice_number INTO v; n := n || v;
  END LOOP;
  FOREACH v IN ARRAY ARRAY['2026-10-01', '2026-10-02'] LOOP
    INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
    VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'draft', 'outlet_short', v::date)
    RETURNING invoice_number INTO v; n := n || v;
  END LOOP;
  IF n <> ARRAY['INV-SA-0032', 'INV-SA-0033', 'INV-SB-0031', 'INV-SB-0032'] THEN
    RAISE EXCEPTION 'SMOKE FAILED: outlet_short sequence %', n;
  END IF;
  -- default at B (global counter; seed max is 0032)
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, issued_at)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'draft', '2026-10-03')
  RETURNING invoice_number INTO v;
  IF v <> 'INV-20261003-0033' THEN RAISE EXCEPTION 'SMOKE FAILED: default at B got %', v; END IF;
  -- fy_only in 2026-27 continues the pre-042 series (draft f..04 holds 0031)
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'draft', 'fy_only', '2026-10-03')
  RETURNING invoice_number INTO v;
  IF v <> 'INV/2026-27/0032' THEN RAISE EXCEPTION 'SMOKE FAILED: fy_only 2026-27 got %', v; END IF;
  -- outlet_fy, FY other than 2025-26 starts at 0001
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft', 'outlet_fy', '2024-01-15')
  RETURNING invoice_number INTO v;
  IF v <> 'INV/SA/2023-24/0001' THEN RAISE EXCEPTION 'SMOKE FAILED: outlet_fy 2023-24 got %', v; END IF;
END $$;
RESET ROLE;
-- mgr1 (outlet A only): cannot see B's numbers, must not collide
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE v text;
BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'SMOKE FAILED: mgr1 can see outlet B invoices (RLS)';
  END IF;
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, issued_at)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft', '2026-10-03')
  RETURNING invoice_number INTO v;
  IF v <> 'INV-20261003-0034' THEN RAISE EXCEPTION 'SMOKE FAILED: default for mgr1 got % (expected after hidden 0033)', v; END IF;
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft', 'fy_only', '2026-10-03')
  RETURNING invoice_number INTO v;
  IF v <> 'INV/2026-27/0033' THEN RAISE EXCEPTION 'SMOKE FAILED: fy_only for mgr1 got %', v; END IF;
  -- draft renumbered when its date moves to another day (default format)
  UPDATE invoices SET issued_at = '2026-10-04' WHERE invoice_number = 'INV-20261003-0034' RETURNING invoice_number INTO v;
  IF v NOT LIKE 'INV-20261004-%' THEN RAISE EXCEPTION 'SMOKE FAILED: draft not renumbered on day change: %', v; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT invoice_number FROM invoices GROUP BY invoice_number HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'SMOKE FAILED: duplicate invoice numbers';
  END IF;
  RAISE NOTICE 'S1 OK';
END $$;
ROLLBACK;

-- @@ S2 draft items editable, issued items locked (as manager, RLS on)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE v_n integer; v_ok boolean; v_inv uuid := 'f0000000-0000-0000-0000-000000000004'; v_item uuid;
BEGIN
  DELETE FROM invoice_items WHERE invoice_id = v_inv;   -- pre-042 seed item
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: manager deleted % draft items, expected 1', v_n; END IF;

  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'New line', 3, 33.33, 0, 18, 0) RETURNING id INTO v_item;
  IF (SELECT line_total FROM invoice_items WHERE id = v_item) <> 99.99
     OR (SELECT tax_amount FROM invoice_items WHERE id = v_item) <> 18.00 THEN
    RAISE EXCEPTION 'SMOKE FAILED: DB did not compute item amounts';
  END IF;
  UPDATE invoice_items SET quantity = 4 WHERE id = v_item;
  UPDATE invoices SET subtotal = 133.32, tax_total = 24.00, grand_total = 157.32, status = 'finalized' WHERE id = v_inv;

  v_ok := false;
  BEGIN
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
    VALUES (v_inv, 'Late', 1, 1, 1, 0, 0);
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'SMOKE FAILED: item inserted into a FINALIZED invoice'; END IF;

  v_ok := false;
  BEGIN UPDATE invoice_items SET unit_price = 1 WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'SMOKE FAILED: item of a FINALIZED invoice edited'; END IF;

  v_ok := false;
  BEGIN DELETE FROM invoice_items WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'SMOKE FAILED: item of a FINALIZED invoice deleted'; END IF;

  -- snapshot taken at finalize by a manager (definer trigger)
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = v_inv AND client_name_snap = 'Seed Corp A1'
                 AND supplier_gstin_snap = '29AAAAA0000A1Z5') THEN
    RAISE EXCEPTION 'SMOKE FAILED: snapshot not taken on manager finalize';
  END IF;

  -- manager discards an unpaid draft with items
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status)
  VALUES ('f0000000-0000-0000-0000-0000000000d1', 'subscription', 'c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'draft');
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-0000000000d1', 'x', 1, 1, 1, 0, 0);
  DELETE FROM invoices WHERE id = 'f0000000-0000-0000-0000-0000000000d1';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: manager draft discard deleted % rows', v_n; END IF;

  -- manager cannot delete a finalized invoice
  v_n := 0;
  BEGIN
    DELETE FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_n := 0; END;
  IF v_n <> 0 OR NOT EXISTS (SELECT 1 FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'SMOKE FAILED: manager deleted a finalized invoice';
  END IF;
END $$;
RESET ROLE;
-- an ADMIN can also discard a draft (the DELETE policy recursion hit every role)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE v_n integer;
BEGIN
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status)
  VALUES ('f0000000-0000-0000-0000-0000000000d2', 'subscription', 'c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'draft');
  DELETE FROM invoices WHERE id = 'f0000000-0000-0000-0000-0000000000d2';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'SMOKE FAILED: admin draft discard deleted % rows', v_n; END IF;
  RAISE NOTICE 'S2 OK';
END $$;
ROLLBACK;

-- @@ S3 payments: IST-today accepted, IST-tomorrow rejected, summary + view under RLS
BEGIN;
-- a payment at outlet B that mgr1 must not see in the summary
INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
VALUES ('f0000000-0000-0000-0000-000000000003', 90, 'cash', '2025-11-02');
SET LOCAL timezone = 'America/Los_Angeles';   -- session tz must not matter
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; v_ok boolean; v_rec record;
BEGIN
  BEGIN
    INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
    VALUES ('f0000000-0000-0000-0000-000000000001', 100, 'cash', v_today);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SMOKE FAILED: payment dated IST today (%) rejected: %', v_today, SQLERRM;
  END;
  v_ok := false;
  BEGIN
    INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
    VALUES ('f0000000-0000-0000-0000-000000000001', 1, 'cash', v_today + 1);
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'SMOKE FAILED: IST-tomorrow payment accepted'; END IF;

  -- mgr1 sees outlet A only: 500 + 1000 (seed) + 100 today
  SELECT * INTO v_rec FROM payments_summary();
  IF v_rec.total_amount <> 1600 OR v_rec.total_count <> 3 OR v_rec.today_amount <> 100
     OR v_rec.today_count <> 1 OR v_rec.voided_count <> 0 THEN
    RAISE EXCEPTION 'SMOKE FAILED: payments_summary for mgr1: %', row_to_json(v_rec);
  END IF;
  SELECT * INTO v_rec FROM payments_summary(NULL, NULL, 'upi'::payment_method, NULL, NULL);
  IF v_rec.total_amount <> 500 OR v_rec.total_count <> 1 THEN
    RAISE EXCEPTION 'SMOKE FAILED: payments_summary method filter: %', row_to_json(v_rec);
  END IF;
  IF (SELECT count(*) FROM payments_with_details) <> 3
     OR EXISTS (SELECT 1 FROM payments_with_details WHERE outlet_id <> 'b0000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM payments_with_details WHERE recorded_by_name IS NULL) THEN
    RAISE EXCEPTION 'SMOKE FAILED: payments_with_details for mgr1: %',
      (SELECT json_agg(json_build_object('outlet', outlet_id, 'by', recorded_by_name)) FROM payments_with_details);
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
DECLARE v_rec record;
BEGIN
  SELECT * INTO v_rec FROM payments_summary();   -- accountant: all outlets
  IF v_rec.total_amount <> 1690 OR v_rec.total_count <> 4 THEN
    RAISE EXCEPTION 'SMOKE FAILED: payments_summary for accountant: %', row_to_json(v_rec);
  END IF;
  RAISE NOTICE 'S3 OK';
END $$;
ROLLBACK;

-- @@ S4 audits: manager create/count/submit, admin approve + reject, no "ambiguous"
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE v_aud uuid; v_rec record;
BEGIN
  v_aud := create_inventory_audit('b0000000-0000-0000-0000-00000000000a',
                                  to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM'), NULL);
  UPDATE inventory_audit_line_items
  SET physical_quantity = system_quantity - 3, reason_code = 'audit_shortage', status = 'counted'
  WHERE audit_id = v_aud;
  BEGIN
    SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SMOKE FAILED: manager submit raised: %', SQLERRM;
  END;
  IF v_rec.auto_approved OR v_rec.audit_id <> v_aud THEN
    RAISE EXCEPTION 'SMOKE FAILED: manager shortage submit returned %', row_to_json(v_rec);
  END IF;
  PERFORM set_config('smoke.aud1', v_aud::text, true);
  -- manager may not approve
  BEGIN
    PERFORM approve_inventory_audit(v_aud, NULL, true, NULL);
    RAISE EXCEPTION 'SMOKE FAILED: manager approved an audit';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'SMOKE FAILED%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE v_rec record; v_aud uuid := current_setting('smoke.aud1')::uuid;
BEGIN
  BEGIN
    SELECT * INTO v_rec FROM approve_inventory_audit(v_aud, NULL, true, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SMOKE FAILED: admin approve raised: %', SQLERRM;
  END;
  IF NOT v_rec.success OR v_rec.movements_created <> 1 THEN
    RAISE EXCEPTION 'SMOKE FAILED: approve returned %', row_to_json(v_rec);
  END IF;
  IF (SELECT available_quantity FROM inventory_items WHERE id = '10000000-0000-0000-0000-0000000000a1') <> 82 THEN
    RAISE EXCEPTION 'SMOKE FAILED: shortage not applied (available %)',
      (SELECT available_quantity FROM inventory_items WHERE id = '10000000-0000-0000-0000-0000000000a1');
  END IF;
END $$;
RESET ROLE;
-- manager: surplus audit for the previous month -> pending (manager surplus needs approval) -> admin rejects -> re-create allowed
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE v_aud uuid; v_rec record;
BEGIN
  v_aud := create_inventory_audit('b0000000-0000-0000-0000-00000000000a',
                                  to_char((now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month', 'YYYY-MM'), NULL);
  UPDATE inventory_audit_line_items
  SET physical_quantity = system_quantity + 2, reason_code = 'audit_surplus', status = 'counted'
  WHERE audit_id = v_aud;
  SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);
  IF v_rec.auto_approved THEN RAISE EXCEPTION 'SMOKE FAILED: manager surplus auto-approved'; END IF;
  PERFORM set_config('smoke.aud2', v_aud::text, true);
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE v_rec record; v_aud uuid;
BEGIN
  SELECT * INTO v_rec FROM approve_inventory_audit(current_setting('smoke.aud2')::uuid, NULL, false, 'recount');
  IF NOT v_rec.success OR v_rec.movements_created <> 0 THEN
    RAISE EXCEPTION 'SMOKE FAILED: reject returned %', row_to_json(v_rec);
  END IF;
  IF (SELECT status FROM inventory_audits WHERE id = current_setting('smoke.aud2')::uuid) <> 'rejected' THEN
    RAISE EXCEPTION 'SMOKE FAILED: audit not rejected';
  END IF;
  -- same outlet + period again after a rejection
  v_aud := create_inventory_audit('b0000000-0000-0000-0000-00000000000a',
                                  to_char((now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month', 'YYYY-MM'), NULL);
  UPDATE inventory_audit_line_items SET physical_quantity = system_quantity, status = 'counted' WHERE audit_id = v_aud;
  SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);
  IF NOT v_rec.auto_approved OR v_rec.movements_created <> 0 THEN
    RAISE EXCEPTION 'SMOKE FAILED: zero-variance admin submit returned %', row_to_json(v_rec);
  END IF;
  RAISE NOTICE 'S4 OK';
END $$;
ROLLBACK;

-- @@ S5 report_client_revenue / outlet performance: no fan-out (2 subs + 3 invoices + payments)
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE v_k uuid; v_inv uuid; i integer;
BEGIN
  INSERT INTO clients (outlet_id, client_type, name, phone)
  VALUES ('b0000000-0000-0000-0000-00000000000a', 'corporate', 'Smoke K', '9000000099') RETURNING id INTO v_k;
  PERFORM set_config('smoke.k', v_k::text, true);
  INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, quantity, price_per_unit, next_billing_date)
  VALUES ('b0000000-0000-0000-0000-00000000000a', v_k, 'monthly', 1, '2026-01-01', 10, 100, '2026-02-01'),
         ('b0000000-0000-0000-0000-00000000000a', v_k, 'daily', NULL, '2026-01-01', 1, 12, '2026-01-02');
  FOR i IN 1..3 LOOP
    INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total, issued_at)
    VALUES ('subscription', v_k, 'b0000000-0000-0000-0000-00000000000a', 'draft', 100, 18, 118, ('2026-02-0' || i)::timestamptz)
    RETURNING id INTO v_inv;
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
    VALUES (v_inv, 'Line', 1, 100, 100, 18, 18);
    UPDATE invoices SET status = 'finalized' WHERE id = v_inv;
    IF i = 1 THEN
      INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
      VALUES (v_inv, 50, 'cash', '2026-02-05'), (v_inv, 30, 'upi', '2026-02-06');
    END IF;
  END LOOP;
END $$;
SET LOCAL ROLE authenticated;   -- as admin, through RLS
DO $$
DECLARE v_rec record; v_sum numeric;
BEGIN
  SELECT * INTO v_rec FROM report_client_revenue WHERE client_id = current_setting('smoke.k')::uuid;
  IF v_rec.total_invoiced <> 354 OR v_rec.invoice_count <> 3 OR v_rec.active_subscriptions <> 2
     OR v_rec.total_collected <> 80 OR v_rec.outstanding <> 274 THEN
    RAISE EXCEPTION 'SMOKE FAILED: report_client_revenue: %', row_to_json(v_rec);
  END IF;
  -- outlet totals = sum of its clients' totals
  SELECT SUM(total_invoiced) INTO v_sum FROM report_client_revenue WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a';
  SELECT * INTO v_rec FROM report_outlet_performance WHERE outlet_id = 'b0000000-0000-0000-0000-00000000000a';
  IF v_rec.total_invoiced <> v_sum THEN
    RAISE EXCEPTION 'SMOKE FAILED: outlet total % <> sum of client totals %', v_rec.total_invoiced, v_sum;
  END IF;
  -- seed issued at A: f01, f02, f05 (f04 is a draft) + 3 here
  IF v_rec.total_invoices <> 6 OR v_rec.active_subscriptions <> 5 THEN
    RAISE EXCEPTION 'SMOKE FAILED: outlet A counts: %', row_to_json(v_rec);
  END IF;
  RAISE NOTICE 'S5 OK  (outlet A: invoiced %, collected %, mrr %)', v_rec.total_invoiced, v_rec.total_collected, v_rec.mrr;
END $$;
ROLLBACK;

-- @@ S6 reference_allocation_history: event dispatch/returns/damage/loss + repaired phantom rows
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE v_rec record;
BEGIN
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'return_damaged', 3, 'event',
          'e0000000-0000-0000-0000-0000000000a3', 'client_damage', 'chipped', auth.uid());
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reference_id, reason_code, notes, created_by)
  VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'loss', 2, 'event',
          'e0000000-0000-0000-0000-0000000000a3', 'client_lost', 'not returned', auth.uid());

  SELECT * INTO v_rec FROM reference_allocation_history WHERE reference_id = 'e0000000-0000-0000-0000-0000000000a3';
  IF v_rec.allocated_quantity <> 40 OR v_rec.returned_good <> 30 OR v_rec.returned_damaged <> 3
     OR v_rec.lost <> 2 OR v_rec.disposed <> 0 OR v_rec.outstanding_quantity <> 5 OR NOT v_rec.is_active
     OR v_rec.item_name <> 'Seed Steel Plate' THEN
    RAISE EXCEPTION 'SMOKE FAILED: event history row: %', row_to_json(v_rec);
  END IF;
  SELECT * INTO v_rec FROM reference_allocation_history WHERE reference_id = 'd0000000-0000-0000-0000-0000000000a2';
  IF v_rec.is_active OR v_rec.outstanding_quantity <> 0 THEN
    RAISE EXCEPTION 'SMOKE FAILED: closed phantom row: %', row_to_json(v_rec);
  END IF;
  SELECT * INTO v_rec FROM reference_allocation_history WHERE reference_id = 'd0000000-0000-0000-0000-0000000000a3';
  IF NOT v_rec.is_active OR v_rec.outstanding_quantity <> 5 THEN
    RAISE EXCEPTION 'SMOKE FAILED: trimmed phantom row: %', row_to_json(v_rec);
  END IF;
  IF (SELECT count(*) FROM reference_allocation_history) <> 3 THEN
    RAISE EXCEPTION 'SMOKE FAILED: reference_allocation_history row count %', (SELECT count(*) FROM reference_allocation_history);
  END IF;
END $$;
RESET ROLE;
-- mgr2 is assigned to A and sees the rows; a manager of B only would not (RLS via security_invoker)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM reference_allocation_history) <> 3 THEN
    RAISE EXCEPTION 'SMOKE FAILED: mgr2 sees % history rows, expected 3', (SELECT count(*) FROM reference_allocation_history);
  END IF;
  RAISE NOTICE 'S6 OK';
END $$;
ROLLBACK;
