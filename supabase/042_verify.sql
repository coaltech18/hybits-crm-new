-- ================================================================
-- VERIFY 042 — runnable check, rolls back, changes nothing.
-- Paste into the Supabase SQL editor AFTER applying 042.
--
-- Self-contained: creates throwaway outlets, clients, an admin and a
-- manager (auth.users + user_profiles), invoices, payments,
-- subscriptions, inventory items and audits. Everything is undone by
-- the ROLLBACK at the bottom.
--
-- Part 1 runs as the SQL-editor owner. Parts 2 and 3 switch to the
-- `authenticated` role with a fake JWT (request.jwt.claims), so RLS
-- and auth.uid() behave exactly as for the app: that is what proves
-- the manager numbering and the audit RPC fixes.
--
-- Expected notices: "042 part 1 OK", "042 part 2 (manager) OK",
-- "042 part 3 (admin) OK", "042 part 4 OK". Any failure raises and
-- aborts.
-- ================================================================
BEGIN;

-- ----------------------------------------------------------------
-- Part 1: fixtures + owner-level checks
-- ----------------------------------------------------------------
DO $$
DECLARE
  r text := substr(md5(random()::text), 1, 6);
  v_admin uuid := gen_random_uuid();
  v_mgr uuid := gen_random_uuid();
  o_a uuid; o_b uuid; o_c uuid; o_d uuid; o_e uuid; o_f uuid; o_g uuid; o_h uuid;
  c_a uuid; c_b uuid; c_c uuid; c_d uuid; c_e uuid;
  k1 uuid; k2 uuid; ec1 uuid; ec2 uuid;
  ev1 uuid; ev_cancel uuid;
  v_inv uuid; v_inv2 uuid; v_item uuid;
  v_num text; v_num2 text; v_ok boolean;
  v_tax numeric; v_cgst numeric; v_sgst numeric;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_rec record;
  i integer;
  g1 uuid; h1 uuid;
BEGIN
  -- ---- users (auth.users first: user_profiles.id references it) ----
  INSERT INTO auth.users (id, aud, role, email)
  VALUES (v_admin, 'authenticated', 'authenticated', 'v042-admin-' || r || '@example.invalid'),
         (v_mgr,   'authenticated', 'authenticated', 'v042-mgr-'   || r || '@example.invalid');

  INSERT INTO user_profiles (id, email, full_name, role, is_active)
  VALUES (v_admin, 'v042-admin-' || r || '@example.invalid', 'Verify Admin', 'admin', true),
         (v_mgr,   'v042-mgr-'   || r || '@example.invalid', 'Verify Manager', 'manager', true)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true, full_name = EXCLUDED.full_name;

  -- ---- outlets ----
  INSERT INTO outlets (name, code) VALUES ('V042 A', 'ZZ-V042A-' || r) RETURNING id INTO o_a;
  INSERT INTO outlets (name, code) VALUES ('V042 B', 'ZZ-V042B-' || r) RETURNING id INTO o_b;
  INSERT INTO outlets (name, code) VALUES ('V042 C', 'ZZ-V042C-' || r) RETURNING id INTO o_c;
  INSERT INTO outlets (name, code) VALUES ('V042 D', 'Z_' || r)        RETURNING id INTO o_d;
  INSERT INTO outlets (name, code) VALUES ('V042 E', 'Zx' || r)        RETURNING id INTO o_e;
  INSERT INTO outlets (name, code, gstin) VALUES ('V042 F', 'ZZ-V042F-' || r, '29ABCDE1234F1Z5') RETURNING id INTO o_f;
  INSERT INTO outlets (name, code) VALUES ('V042 G', 'ZZ-V042G-' || r) RETURNING id INTO o_g;
  INSERT INTO outlets (name, code) VALUES ('V042 H', 'ZZ-V042H-' || r) RETURNING id INTO o_h;

  INSERT INTO user_outlet_assignments (user_id, outlet_id) VALUES (v_mgr, o_a);

  -- ---- clients ----
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_a, 'corporate', 'V042 Client A', '9999999999') RETURNING id INTO c_a;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_b, 'corporate', 'V042 Client B', '9999999999') RETURNING id INTO c_b;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_c, 'corporate', 'V042 Client C', '9999999999') RETURNING id INTO c_c;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_d, 'corporate', 'V042 Client D', '9999999999') RETURNING id INTO c_d;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_e, 'corporate', 'V042 Client E', '9999999999') RETURNING id INTO c_e;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_f, 'corporate', 'V042 K1', '9999999999') RETURNING id INTO k1;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_f, 'corporate', 'V042 K2', '9999999999') RETURNING id INTO k2;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_f, 'event', 'V042 EC1', '9999999999') RETURNING id INTO ec1;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_f, 'event', 'V042 EC2', '9999999999') RETURNING id INTO ec2;

  -- ============================================================
  -- 1. invoice_items: draft delete allowed, issued blocked
  -- ============================================================
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total)
  VALUES ('subscription', c_a, o_a, 'draft', 100, 18, 118) RETURNING id INTO v_inv;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Line', 1, 100, 100, 18, 18) RETURNING id INTO v_item;

  BEGIN
    DELETE FROM invoice_items WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '042 FAILED: deleting a DRAFT invoice item was refused: %', SQLERRM;
  END;

  -- empty draft cannot be finalized
  v_ok := false;
  BEGIN
    UPDATE invoices SET status = 'finalized' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: a draft with no items was finalized'; END IF;

  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Line', 1, 100, 100, 18, 18) RETURNING id INTO v_item;
  UPDATE invoices SET status = 'finalized' WHERE id = v_inv;

  v_ok := false;
  BEGIN
    DELETE FROM invoice_items WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: an item of a FINALIZED invoice was deleted'; END IF;

  v_ok := false;
  BEGIN
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
    VALUES (v_inv, 'Late line', 1, 10, 10, 0, 0);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: an item was added to a FINALIZED invoice'; END IF;

  v_ok := false;
  BEGIN
    UPDATE invoice_items SET unit_price = 1 WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: an item of a FINALIZED invoice was edited'; END IF;

  v_ok := false;
  BEGIN
    DELETE FROM invoices WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: a FINALIZED invoice was deleted'; END IF;

  -- a draft WITH items can be discarded (create-rollback); items cascade
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total)
  VALUES ('subscription', c_a, o_a, 'draft', 100, 18, 118) RETURNING id INTO v_inv2;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv2, 'Line', 1, 100, 100, 18, 18);
  BEGIN
    DELETE FROM invoices WHERE id = v_inv2;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '042 FAILED: discarding a draft invoice was refused: %', SQLERRM;
  END;
  IF EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = v_inv2) THEN
    RAISE EXCEPTION '042 FAILED: draft invoice deleted but its items remain';
  END IF;

  -- ============================================================
  -- 2. item amounts computed by the DB (browser float value ignored)
  -- ============================================================
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total)
  VALUES ('subscription', c_a, o_a, 'draft', 5.75, 1.04, 6.79) RETURNING id INTO v_inv2;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv2, 'Float trap', 1, 5.75, 5.75, 18, 1.03)   -- JS rounds 1.035 down to 1.03
  RETURNING tax_amount INTO v_tax;
  IF v_tax <> 1.04 THEN
    RAISE EXCEPTION '042 FAILED: tax_amount not recomputed (got %, expected 1.04)', v_tax;
  END IF;

  -- ============================================================
  -- 3. payment dated IST-today accepted, tomorrow rejected
  -- ============================================================
  BEGIN
    INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
    VALUES (v_inv, 10, 'cash', v_today);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '042 FAILED: payment dated IST today (%) rejected: %', v_today, SQLERRM;
  END;

  v_ok := false;
  BEGIN
    INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
    VALUES (v_inv, 1, 'cash', v_today + 1);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: a future-dated payment was accepted'; END IF;

  -- payments_summary over outlet A: one active 10 today; add + void a 5
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 5, 'upi', v_today - 1);
  UPDATE payments SET is_active = false WHERE invoice_id = v_inv AND amount = 5;

  SELECT * INTO v_rec FROM payments_summary(NULL, NULL, NULL, o_a, NULL);
  IF v_rec.total_amount <> 10 OR v_rec.total_count <> 1 OR v_rec.today_amount <> 10
     OR v_rec.today_count <> 1 OR v_rec.voided_count <> 1 THEN
    RAISE EXCEPTION '042 FAILED: payments_summary wrong: %', row_to_json(v_rec);
  END IF;

  SELECT * INTO v_rec FROM payments_summary(v_today - 10, v_today - 1, NULL, o_a, NULL);
  IF v_rec.total_count <> 0 OR v_rec.today_count <> 1 OR v_rec.voided_count <> 1 THEN
    RAISE EXCEPTION '042 FAILED: payments_summary date range wrong: %', row_to_json(v_rec);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM payments_with_details WHERE invoice_id = v_inv AND outlet_id = o_a) THEN
    RAISE EXCEPTION '042 FAILED: payments_with_details.outlet_id missing or wrong';
  END IF;

  -- ============================================================
  -- 4. numbering: outlet_short next day, > 9999, LIKE wildcards
  -- ============================================================
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', c_b, o_b, 'draft', 'outlet_short', '2026-05-01')
  RETURNING invoice_number INTO v_num;
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', c_b, o_b, 'draft', 'outlet_short', '2026-05-02')
  RETURNING invoice_number INTO v_num2;
  IF v_num = v_num2 THEN
    RAISE EXCEPTION '042 FAILED: outlet_short collided on the next day (%)', v_num;
  END IF;
  IF v_num <> 'INV-ZZ-V042B-' || r || '-0031' OR v_num2 <> 'INV-ZZ-V042B-' || r || '-0032' THEN
    RAISE EXCEPTION '042 FAILED: outlet_short not a running counter: %, %', v_num, v_num2;
  END IF;

  INSERT INTO invoices (invoice_number, invoice_type, client_id, outlet_id, status, invoice_number_format)
  VALUES ('INV-ZZ-V042C-' || r || '-9999', 'subscription', c_c, o_c, 'draft', 'outlet_short');
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format)
  VALUES ('subscription', c_c, o_c, 'draft', 'outlet_short')
  RETURNING invoice_number INTO v_num;
  IF v_num <> 'INV-ZZ-V042C-' || r || '-10000' THEN
    RAISE EXCEPTION '042 FAILED: counter after 9999 is %, expected ...-10000', v_num;
  END IF;

  INSERT INTO invoices (invoice_number, invoice_type, client_id, outlet_id, status, invoice_number_format)
  VALUES ('INV-Zx' || r || '-0500', 'subscription', c_e, o_e, 'draft', 'outlet_short');
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format)
  VALUES ('subscription', c_d, o_d, 'draft', 'outlet_short')
  RETURNING invoice_number INTO v_num;
  IF v_num <> 'INV-Z_' || r || '-0031' THEN
    RAISE EXCEPTION '042 FAILED: "_" in an outlet code matched another outlet''s numbers (got %)', v_num;
  END IF;

  -- draft moved into another FY is renumbered; outlet_short is not
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', c_c, o_c, 'draft', 'fy_only', '2025-03-15')
  RETURNING id, invoice_number INTO v_inv2, v_num;
  IF v_num NOT LIKE 'INV/2024-25/%' THEN
    RAISE EXCEPTION '042 FAILED: FY numbering wrong: %', v_num;
  END IF;
  UPDATE invoices SET issued_at = '2025-04-10' WHERE id = v_inv2 RETURNING invoice_number INTO v_num;
  IF v_num NOT LIKE 'INV/2025-26/%' THEN
    RAISE EXCEPTION '042 FAILED: draft not renumbered after its date moved FY: %', v_num;
  END IF;

  -- outlet B: an fy_only number the manager (outlet A only) cannot see
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', c_b, o_b, 'draft', 'fy_only', '2024-07-01')
  RETURNING invoice_number INTO v_num;
  PERFORM set_config('v042.b_fy_number', v_num, true);

  -- ============================================================
  -- 5. report fan-out: K1 has 2 subscriptions + 3 invoices,
  --    outlet F also has K2 (1 sub) and an event client with an event
  -- ============================================================
  INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, quantity, price_per_unit, next_billing_date)
  VALUES (o_f, k1, 'monthly', 1, '2026-01-01', 10, 100, '2026-02-01'),
         (o_f, k1, 'weekly', NULL, '2026-01-01', 1, 120, '2026-01-08'),
         (o_f, k2, 'monthly', 1, '2026-01-01', 1, 50, '2026-02-01');
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_f, ec1, 'V042 Event', '2026-01-10', 'completed') RETURNING id INTO ev1;
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_f, ec1, 'V042 Event 2', '2026-01-11', 'planned');

  FOR i IN 1..3 LOOP
    INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total, issued_at)
    VALUES ('subscription', k1, o_f, 'draft', 100, 18, 118, '2026-01-15') RETURNING id INTO v_inv2;
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
    VALUES (v_inv2, 'Line', 1, 100, 100, 18, 18);
    UPDATE invoices SET status = 'finalized' WHERE id = v_inv2;
  END LOOP;

  SELECT * INTO v_rec FROM report_client_revenue WHERE client_id = k1;
  IF v_rec.total_invoiced <> 354 OR v_rec.invoice_count <> 3 OR v_rec.active_subscriptions <> 2 THEN
    RAISE EXCEPTION '042 FAILED: report_client_revenue fan-out: total %, invoices %, subs %',
      v_rec.total_invoiced, v_rec.invoice_count, v_rec.active_subscriptions;
  END IF;

  SELECT * INTO v_rec FROM report_outlet_performance WHERE outlet_id = o_f;
  IF v_rec.total_invoiced <> 354 OR v_rec.outstanding <> 354 OR v_rec.total_invoices <> 3
     OR v_rec.active_subscriptions <> 3 OR v_rec.active_clients <> 4 OR v_rec.completed_events <> 1
     OR v_rec.planned_events <> 1 OR v_rec.mrr <> 1570 THEN
    -- mrr: 10*100 + 120*52/12 (=520) + 50 = 1570
    RAISE EXCEPTION '042 FAILED: report_outlet_performance fan-out: %', row_to_json(v_rec);
  END IF;

  -- ============================================================
  -- 6. party snapshot + GST split + rate label
  -- ============================================================
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE client_id = k1 AND client_name_snap = 'V042 K1'
                   AND client_gst_type_snap = 'domestic' AND supplier_gstin_snap = '29ABCDE1234F1Z5') THEN
    RAISE EXCEPTION '042 FAILED: party snapshot not taken at finalize';
  END IF;
  UPDATE clients SET name = 'V042 K1 Renamed' WHERE id = k1;
  IF EXISTS (SELECT 1 FROM gst_working_domestic WHERE outlet_id = o_f AND party_name <> 'V042 K1') THEN
    RAISE EXCEPTION '042 FAILED: GST sheet follows the live client name instead of the snapshot';
  END IF;

  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total, issued_at)
  VALUES ('subscription', c_a, o_a, 'draft', 150.50, 11.59, 162.09, '2026-01-20') RETURNING id INTO v_inv2;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv2, 'At 18', 1, 50.50, 50.50, 18, 9.09),   -- odd paise
         (v_inv2, 'At 5', 1, 100, 100, 5, 5);
  UPDATE invoices SET tax_total = 14.09, grand_total = 164.59, status = 'finalized' WHERE id = v_inv2;

  SELECT cgst, sgst, rate, rate_label INTO v_rec FROM gst_working_domestic WHERE invoice_id = v_inv2;
  IF v_rec.cgst + v_rec.sgst <> 14.09 THEN
    RAISE EXCEPTION '042 FAILED: CGST % + SGST % <> tax 14.09', v_rec.cgst, v_rec.sgst;
  END IF;
  IF v_rec.rate <> 18 OR v_rec.rate_label <> '5% / 18%' THEN
    RAISE EXCEPTION '042 FAILED: rate % / rate_label % (expected 18 / 5%% / 18%%)', v_rec.rate, v_rec.rate_label;
  END IF;

  -- ============================================================
  -- 7. event invoice must belong to the event's client
  -- ============================================================
  v_ok := false;
  BEGIN
    INSERT INTO invoices (invoice_type, client_id, outlet_id, event_id, status)
    VALUES ('event', ec2, o_f, ev1, 'draft');
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: invoiced another client''s event'; END IF;

  -- ============================================================
  -- 8. no dispatch to a cancelled event
  -- ============================================================
  INSERT INTO inventory_items (outlet_id, name, category, unit, total_quantity, available_quantity, lifecycle_status)
  VALUES (o_f, 'V042 Plate F', 'Plate', 'pcs', 10, 10, 'active') RETURNING id INTO v_item;
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_f, ec1, 'V042 Cancelled', '2026-01-12', 'cancelled') RETURNING id INTO ev_cancel;
  v_ok := false;
  BEGIN
    INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                     quantity, reference_type, reference_id, reason_code, created_by)
    VALUES (o_f, v_item, 'outflow', 'allocation', 1, 'event', ev_cancel, 'event_dispatch', v_admin);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: dishware dispatched to a cancelled event'; END IF;

  -- ---- audit fixtures (items at G and H, 10 available each) ----
  INSERT INTO inventory_items (outlet_id, name, category, unit, total_quantity, available_quantity, lifecycle_status)
  VALUES (o_g, 'V042 Plate G', 'Plate', 'pcs', 10, 10, 'active') RETURNING id INTO g1;
  INSERT INTO inventory_items (outlet_id, name, category, unit, total_quantity, available_quantity, lifecycle_status)
  VALUES (o_h, 'V042 Plate H', 'Plate', 'pcs', 10, 10, 'active') RETURNING id INTO h1;

  -- hand the ids to the later blocks (transaction-local settings)
  PERFORM set_config('v042.admin', v_admin::text, true);
  PERFORM set_config('v042.mgr', v_mgr::text, true);
  PERFORM set_config('v042.o_a', o_a::text, true);
  PERFORM set_config('v042.o_b', o_b::text, true);
  PERFORM set_config('v042.o_g', o_g::text, true);
  PERFORM set_config('v042.o_h', o_h::text, true);
  PERFORM set_config('v042.g1', g1::text, true);
  PERFORM set_config('v042.h1', h1::text, true);
  PERFORM set_config('v042.c_a', c_a::text, true);
  PERFORM set_config('v042.mgr_updated_at',
    (SELECT updated_at::text FROM user_profiles WHERE id = v_mgr), true);

  RAISE NOTICE '042 part 1 OK';
END $$;

-- ----------------------------------------------------------------
-- Part 2: as the MANAGER (RLS on, outlet A only)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v042.mgr'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  v_num text;
  v_inv uuid;
  v_n integer;
  v_ok boolean;
BEGIN
  -- Global FY counter: outlet B's number is invisible to this manager
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at)
  VALUES ('subscription', current_setting('v042.c_a')::uuid, current_setting('v042.o_a')::uuid,
          'draft', 'fy_only', '2024-07-02')
  RETURNING invoice_number INTO v_num;
  PERFORM set_config('v042.mgr_fy_number', v_num, true);

  -- create-rollback contract: a manager can discard their own draft
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
  VALUES ('subscription', current_setting('v042.c_a')::uuid, current_setting('v042.o_a')::uuid, 'draft')
  RETURNING id INTO v_inv;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Line', 2, 10, 20, 0, 0);
  DELETE FROM invoices WHERE id = v_inv;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION '042 FAILED: manager could not discard own draft (deleted % rows)', v_n;
  END IF;

  -- record_login
  PERFORM record_login();
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND last_login IS NOT NULL) THEN
    RAISE EXCEPTION '042 FAILED: record_login did not set last_login';
  END IF;
  PERFORM set_config('v042.mgr_updated_at_after',
    (SELECT updated_at::text FROM user_profiles WHERE id = auth.uid()), true);

  -- a manager cannot reassign outlets
  v_ok := false;
  BEGIN
    PERFORM set_user_outlet_assignments(auth.uid(), ARRAY[current_setting('v042.o_b')::uuid]);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: a manager changed outlet assignments'; END IF;

  RAISE NOTICE '042 part 2 (manager) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 3: as the ADMIN (audit RPCs end to end, outlet assignment RPC)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v042.admin'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  v_period text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM');
  v_aud uuid;
  v_rec record;
  v_avail integer;
  v_ok boolean;
BEGIN
  -- ---- surplus audit at G: submit auto-approves (admin) ----
  v_aud := create_inventory_audit(current_setting('v042.o_g')::uuid, v_period, NULL);
  UPDATE inventory_audit_line_items
  SET physical_quantity = system_quantity + 5, reason_code = 'audit_surplus', status = 'counted'
  WHERE audit_id = v_aud;

  SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);   -- was: "audit_id is ambiguous"
  IF NOT v_rec.auto_approved OR v_rec.movements_created <> 1 THEN
    RAISE EXCEPTION '042 FAILED: submit returned %', row_to_json(v_rec);
  END IF;
  SELECT available_quantity INTO v_avail FROM inventory_items WHERE id = current_setting('v042.g1')::uuid;
  IF v_avail <> 15 THEN
    RAISE EXCEPTION '042 FAILED: surplus not applied (available %, expected 15)', v_avail;
  END IF;

  -- ---- shortage audit at H: submit -> pending, approve applies ----
  v_aud := create_inventory_audit(current_setting('v042.o_h')::uuid, v_period, NULL);
  UPDATE inventory_audit_line_items
  SET physical_quantity = system_quantity - 2, reason_code = 'audit_shortage', status = 'counted'
  WHERE audit_id = v_aud;

  SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);
  IF v_rec.auto_approved THEN
    RAISE EXCEPTION '042 FAILED: a shortage was auto-approved';
  END IF;

  SELECT * INTO v_rec FROM approve_inventory_audit(v_aud, NULL, true, NULL);
  IF NOT v_rec.success OR v_rec.movements_created <> 1 THEN
    RAISE EXCEPTION '042 FAILED: approve returned %', row_to_json(v_rec);
  END IF;
  SELECT available_quantity INTO v_avail FROM inventory_items WHERE id = current_setting('v042.h1')::uuid;
  IF v_avail <> 8 THEN
    RAISE EXCEPTION '042 FAILED: shortage not applied (available %, expected 8)', v_avail;
  END IF;

  -- approving twice must fail (row lock + status predicate)
  v_ok := false;
  BEGIN
    PERFORM approve_inventory_audit(v_aud, NULL, true, NULL);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: an approved audit was approved again'; END IF;

  -- ---- outlet assignments replaced atomically, assigned_by set ----
  PERFORM set_user_outlet_assignments(current_setting('v042.mgr')::uuid,
                                      ARRAY[current_setting('v042.o_b')::uuid]);
  IF (SELECT count(*) FROM user_outlet_assignments WHERE user_id = current_setting('v042.mgr')::uuid) <> 1
     OR NOT EXISTS (SELECT 1 FROM user_outlet_assignments
                    WHERE user_id = current_setting('v042.mgr')::uuid
                      AND outlet_id = current_setting('v042.o_b')::uuid
                      AND assigned_by = auth.uid()) THEN
    RAISE EXCEPTION '042 FAILED: set_user_outlet_assignments did not replace the set';
  END IF;

  v_ok := false;
  BEGIN
    PERFORM set_user_outlet_assignments(current_setting('v042.mgr')::uuid, ARRAY[]::uuid[]);
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '042 FAILED: empty outlet list accepted'; END IF;

  RAISE NOTICE '042 part 3 (admin) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 4: cross-session assertions (owner)
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_b text := current_setting('v042.b_fy_number');
  v_m text := current_setting('v042.mgr_fy_number');
BEGIN
  IF v_b = v_m THEN
    RAISE EXCEPTION '042 FAILED: manager and other outlet got the same number %', v_m;
  END IF;
  IF substr(v_m, length('INV/2024-25/') + 1)::bigint <= substr(v_b, length('INV/2024-25/') + 1)::bigint THEN
    RAISE EXCEPTION '042 FAILED: manager number % not after hidden outlet number %', v_m, v_b;
  END IF;

  IF current_setting('v042.mgr_updated_at_after') <> current_setting('v042.mgr_updated_at') THEN
    RAISE EXCEPTION '042 FAILED: record_login bumped updated_at (% -> %)',
      current_setting('v042.mgr_updated_at'), current_setting('v042.mgr_updated_at_after');
  END IF;

  RAISE NOTICE '042 part 4 OK  (manager % vs hidden %)', v_m, v_b;
END $$;

ROLLBACK;
