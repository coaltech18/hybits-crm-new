-- ================================================================
-- VERIFY 043 -- runnable check, rolls back, changes nothing.
-- Paste into the Supabase SQL editor AFTER applying 043.
--
-- Self-contained: creates throwaway users (2 admins, a manager, an
-- accountant, a deactivated manager), outlets, clients, events,
-- invoices, payments, subscriptions, inventory items, movements and
-- audits. Everything is undone by the ROLLBACK at the bottom.
-- (To exercise the last-admin rule it temporarily deactivates every
-- OTHER admin inside this transaction; the ROLLBACK restores them.)
--
-- Parts 2-6 switch to the `authenticated` / `anon` role with a fake
-- JWT (request.jwt.claims), so RLS, privileges and auth.uid() behave
-- exactly as for PostgREST. Every exploit from the security review
-- is replayed and must FAIL for the right reason; every app flow
-- must still work.
--
-- Expected notices: "043 part 1 (owner) OK", "043 part 2 (manager)
-- OK", "043 part 3 (admin) OK", "043 part 4 (accountant) OK",
-- "043 part 5 (deactivated) OK", "043 part 6 (anon) OK",
-- "043 part 7 (ledger) OK". Any failure raises and aborts.
-- Needs permission to insert into auth.users (standard SQL editor).
-- ================================================================
BEGIN;

-- ----------------------------------------------------------------
-- Helpers (temporary; dropped by the ROLLBACK)
-- ----------------------------------------------------------------
-- The statement must fail, and with an error matching p_pattern
-- (so a typo in the test cannot pass as "blocked").
CREATE FUNCTION pg_temp.expect_fail(p_label text, p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~* p_pattern THEN
      RAISE EXCEPTION '043 FAILED: % failed for the wrong reason: %', p_label, SQLERRM;
    END IF;
    RAISE NOTICE '   blocked: % (%)', p_label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '043 FAILED: % was ALLOWED', p_label;
END $fn$;

-- The statement must succeed and touch exactly p_rows rows.
CREATE FUNCTION pg_temp.expect_rows(p_label text, p_sql text, p_rows integer)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_n integer;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '043 FAILED: % raised: %', p_label, SQLERRM;
  END;
  IF v_n <> p_rows THEN
    RAISE EXCEPTION '043 FAILED: % touched % row(s), expected %', p_label, v_n, p_rows;
  END IF;
END $fn$;

CREATE FUNCTION pg_temp.v(p_key text)
RETURNS uuid LANGUAGE sql AS $fn$ SELECT current_setting('v043.' || p_key)::uuid $fn$;

-- ----------------------------------------------------------------
-- Part 1: fixtures + catalog checks (owner)
-- ----------------------------------------------------------------
DO $$
DECLARE
  r text := substr(md5(random()::text), 1, 6);
  v_admin uuid := gen_random_uuid();
  v_admin2 uuid := gen_random_uuid();
  v_mgr uuid := gen_random_uuid();
  v_acc uuid := gen_random_uuid();
  v_dead uuid := gen_random_uuid();
  o_a uuid; o_b uuid;
  c_corp uuid; c_corp2 uuid; c_evt uuid;
  it_a uuid; ev_p uuid; ev_c uuid; inv_fin uuid;
  v_bad text;
BEGIN
  -- ---- users ----
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_admin,  'authenticated', 'authenticated', 'v043-admin-'  || r || '@example.invalid'),
    (v_admin2, 'authenticated', 'authenticated', 'v043-admin2-' || r || '@example.invalid'),
    (v_mgr,    'authenticated', 'authenticated', 'v043-mgr-'    || r || '@example.invalid'),
    (v_acc,    'authenticated', 'authenticated', 'v043-acc-'    || r || '@example.invalid'),
    (v_dead,   'authenticated', 'authenticated', 'v043-dead-'   || r || '@example.invalid');

  INSERT INTO user_profiles (id, email, full_name, role, is_active) VALUES
    (v_admin,  'v043-admin-'  || r || '@example.invalid', 'V043 Admin',      'admin',      true),
    (v_admin2, 'v043-admin2-' || r || '@example.invalid', 'V043 Admin Two',  'admin',      true),
    (v_mgr,    'v043-mgr-'    || r || '@example.invalid', 'V043 Manager',    'manager',    true),
    (v_acc,    'v043-acc-'    || r || '@example.invalid', 'V043 Accountant', 'accountant', true),
    (v_dead,   'v043-dead-'   || r || '@example.invalid', 'V043 Ex-Manager', 'manager',    false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, full_name = EXCLUDED.full_name;

  -- only the two fixture admins stay active (undone by ROLLBACK)
  UPDATE user_profiles SET is_active = false
  WHERE role = 'admin' AND is_active AND id NOT IN (v_admin, v_admin2);

  -- ---- outlets / assignments / clients ----
  INSERT INTO outlets (name, code) VALUES ('V043 A', 'ZZ-V043A-' || r) RETURNING id INTO o_a;
  INSERT INTO outlets (name, code) VALUES ('V043 B', 'ZZ-V043B-' || r) RETURNING id INTO o_b;
  INSERT INTO user_outlet_assignments (user_id, outlet_id) VALUES (v_mgr, o_a), (v_dead, o_a);

  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_a, 'corporate', 'V043 Corp', '9999999999') RETURNING id INTO c_corp;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_a, 'corporate', 'V043 Corp Two', '9999999999') RETURNING id INTO c_corp2;
  INSERT INTO clients (outlet_id, client_type, name, phone) VALUES (o_a, 'event', 'V043 Event Client', '9999999999') RETURNING id INTO c_evt;

  -- ---- events ----
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_a, c_evt, 'V043 Planned Event', (now() AT TIME ZONE 'Asia/Kolkata')::date + 10, 'planned') RETURNING id INTO ev_p;
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_a, c_evt, 'V043 Completed Event', '2026-01-15', 'completed') RETURNING id INTO ev_c;

  -- ---- inventory: 100 in, 10 dispatched to the planned event ----
  INSERT INTO inventory_items (outlet_id, name, category, unit, lifecycle_status)
  VALUES (o_a, 'V043 Plate', 'Plate', 'pcs', 'active') RETURNING id INTO it_a;
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reason_code, created_by)
  VALUES (o_a, it_a, 'inflow', 'stock_in', 100, 'manual', 'purchase', v_admin);
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, created_by)
  VALUES (o_a, it_a, 'outflow', 'allocation', 10, 'event', ev_p, 'event_dispatch', v_admin);

  IF NOT EXISTS (SELECT 1 FROM inventory_allocations
                 WHERE reference_id = ev_p AND allocated_quantity = 10 AND is_active) THEN
    RAISE EXCEPTION '043 FAILED: ledger trigger did not create the allocation (owner)';
  END IF;
  IF NOT (SELECT opening_balance_confirmed FROM inventory_items WHERE id = it_a) THEN
    RAISE EXCEPTION '043 FAILED: opening balance not locked by the first allocation';
  END IF;

  -- ---- a finalized invoice (118) ----
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status)
  VALUES ('subscription', c_corp, o_a, 'draft') RETURNING id INTO inv_fin;
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (inv_fin, 'Line', 1, 100, 100, 18, 18);
  UPDATE invoices SET status = 'finalized' WHERE id = inv_fin;
  IF (SELECT grand_total FROM invoices WHERE id = inv_fin) <> 118 THEN
    RAISE EXCEPTION '043 FAILED: draft totals not recomputed from items (owner)';
  END IF;

  -- ---- catalog: SECURITY DEFINER functions ----
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=public, pg_temp'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '043 FAILED: definer functions executable by anon or without pinned search_path: %', v_bad;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '043 FAILED: definer trigger functions executable by authenticated: %', v_bad;
  END IF;

  IF to_regprocedure('public.get_invoice_balance(uuid)') IS NOT NULL
     AND (has_function_privilege('authenticated', 'public.get_invoice_balance(uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.is_invoice_settled(uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.get_invoice_payment_status(uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION '043 FAILED: unused settlement helpers still callable';
  END IF;

  IF has_function_privilege('authenticated', 'public.audit_actor(uuid, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.invoice_derived_payment_status(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '043 FAILED: internal helpers callable by authenticated';
  END IF;

  IF NOT (has_function_privilege('authenticated', 'public.record_login()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.set_user_outlet_assignments(uuid, uuid[])', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.create_inventory_audit(uuid, character varying, uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.submit_inventory_audit(uuid, uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.approve_inventory_audit(uuid, uuid, boolean, text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.payments_summary(date, date, payment_method, uuid, date)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.current_user_role()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.user_display_name(uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION '043 FAILED: an RPC / policy helper the app needs is no longer executable';
  END IF;

  -- ---- catalog: table / column privileges ----
  IF has_table_privilege('authenticated', 'public.inventory_allocations', 'INSERT')
     OR has_table_privilege('authenticated', 'public.inventory_allocations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.inventory_allocations', 'DELETE')
     OR has_table_privilege('authenticated', 'public.inventory_audits', 'INSERT')
     OR has_table_privilege('authenticated', 'public.inventory_audits', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.inventory_audit_line_items', 'INSERT')
     OR has_table_privilege('authenticated', 'public.inventory_audit_line_items', 'DELETE')
     OR has_column_privilege('authenticated', 'public.inventory_audit_line_items', 'system_quantity', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.invoices', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.payments', 'TRUNCATE') THEN
    RAISE EXCEPTION '043 FAILED: client roles still hold a revoked table privilege';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.inventory_audit_line_items', 'physical_quantity', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.inventory_audits', 'DELETE') THEN
    RAISE EXCEPTION '043 FAILED: privileges the app needs (audit counts / cancel) are missing';
  END IF;

  -- ---- hand the ids to the later blocks ----
  PERFORM set_config('v043.admin', v_admin::text, true);
  PERFORM set_config('v043.admin2', v_admin2::text, true);
  PERFORM set_config('v043.mgr', v_mgr::text, true);
  PERFORM set_config('v043.acc', v_acc::text, true);
  PERFORM set_config('v043.dead', v_dead::text, true);
  PERFORM set_config('v043.o_a', o_a::text, true);
  PERFORM set_config('v043.o_b', o_b::text, true);
  PERFORM set_config('v043.c_corp', c_corp::text, true);
  PERFORM set_config('v043.c_corp2', c_corp2::text, true);
  PERFORM set_config('v043.c_evt', c_evt::text, true);
  PERFORM set_config('v043.it_a', it_a::text, true);
  PERFORM set_config('v043.ev_p', ev_p::text, true);
  PERFORM set_config('v043.ev_c', ev_c::text, true);
  PERFORM set_config('v043.inv_fin', inv_fin::text, true);

  RAISE NOTICE '043 part 1 (owner) OK';
END $$;

-- ----------------------------------------------------------------
-- Part 2: as the MANAGER of outlet A
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v043.mgr'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  v_mgr uuid := pg_temp.v('mgr');
  v_admin uuid := pg_temp.v('admin');
  o_a uuid := pg_temp.v('o_a');
  o_b uuid := pg_temp.v('o_b');
  c_corp uuid := pg_temp.v('c_corp');
  c_corp2 uuid := pg_temp.v('c_corp2');
  c_evt uuid := pg_temp.v('c_evt');
  it_a uuid := pg_temp.v('it_a');
  ev_p uuid := pg_temp.v('ev_p');
  ev_c uuid := pg_temp.v('ev_c');
  inv_fin uuid := pg_temp.v('inv_fin');
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_period text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM');
  v_id uuid; v_by uuid; v_bool boolean;
  v_item_new uuid; v_aud uuid; v_inv uuid; v_pay1 uuid; v_pay2 uuid; v_pay_fin uuid;
  v_ev uuid; v_sub uuid; v_cli uuid;
  v_rec record;
  v_status invoice_status;
  v_ts timestamptz;
BEGIN
  -- ============================================================
  -- #0 movement actor: manager posts an admin-only adjustment as an admin
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager adjustment posted with an admin''s created_by',
    format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                quantity, reference_type, reason_code, notes, created_by)
              VALUES (%L, %L, 'adjustment', 'adjustment', 500, 'manual', 'count_correction_negative', 'x', %L)$q$,
           o_a, it_a, v_admin),
    'only admins');

  -- legit: stock-in still works; attribution is the session user
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reason_code, created_by)
  VALUES (o_a, it_a, 'inflow', 'stock_in', 5, 'manual', 'purchase', v_admin)
  RETURNING id, created_by INTO v_id, v_by;
  IF v_by IS DISTINCT FROM v_mgr THEN
    RAISE EXCEPTION '043 FAILED: movement attributed to % instead of the session user', v_by;
  END IF;

  -- ============================================================
  -- #1 allocations are read-only
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager closes a client allocation directly',
    format('UPDATE inventory_allocations SET is_active = false WHERE reference_id = %L', ev_p),
    'permission denied|cannot be edited');
  PERFORM pg_temp.expect_fail('manager inflates an allocation',
    format($q$INSERT INTO inventory_allocations (outlet_id, inventory_item_id, reference_type, reference_id, allocated_quantity, is_active)
              VALUES (%L, %L, 'event', %L, 1000, true)$q$, o_a, it_a, gen_random_uuid()),
    'permission denied|cannot be edited');
  PERFORM pg_temp.expect_fail('manager deletes an allocation',
    format('DELETE FROM inventory_allocations WHERE reference_id = %L', ev_p),
    'permission denied|cannot be edited');
  IF NOT EXISTS (SELECT 1 FROM inventory_allocations WHERE reference_id = ev_p AND is_active) THEN
    RAISE EXCEPTION '043 FAILED: manager can no longer read allocations of the outlet';
  END IF;

  -- legit: a return still flows through the ledger into the allocation
  INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type,
                                   quantity, reference_type, reference_id, reason_code, created_by)
  VALUES (o_a, it_a, 'return', 'return', 3, 'event', ev_p, 'normal_return', v_mgr);

  -- ============================================================
  -- #2 inventory_items quantities / lock / outlet
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager hides stock by editing quantities',
    format('UPDATE inventory_items SET available_quantity = available_quantity - 1, total_quantity = total_quantity - 1 WHERE id = %L', it_a),
    'only through inventory movements');
  PERFORM pg_temp.expect_fail('manager re-opens a locked opening balance',
    format('UPDATE inventory_items SET opening_balance_confirmed = false WHERE id = %L', it_a),
    'opening-balance lock');
  PERFORM pg_temp.expect_fail('manager moves an item to another outlet',
    format('UPDATE inventory_items SET outlet_id = %L WHERE id = %L', o_b, it_a),
    'another outlet');
  PERFORM pg_temp.expect_rows('manager renames an item (legit)',
    format($q$UPDATE inventory_items SET name = 'V043 Plate (renamed)' WHERE id = %L$q$, it_a), 1);
  PERFORM pg_temp.expect_fail('manager creates an item with phantom stock',
    format($q$INSERT INTO inventory_items (outlet_id, name, category, unit, total_quantity, available_quantity)
              VALUES (%L, 'V043 Phantom', 'Plate', 'pcs', 5000, 5000)$q$, o_a),
    'zero stock');

  -- legit create (app sends zeros); a requested lock is ignored
  INSERT INTO inventory_items (outlet_id, name, category, unit, lifecycle_status, opening_balance_confirmed,
                               total_quantity, available_quantity, allocated_quantity, damaged_quantity,
                               in_repair_quantity, lost_quantity)
  VALUES (o_a, 'V043 Bowl', 'Bowl', 'pcs', 'draft', true, 0, 0, 0, 0, 0, 0)
  RETURNING id, opening_balance_confirmed INTO v_item_new, v_bool;
  IF v_bool THEN
    RAISE EXCEPTION '043 FAILED: a new item was created with the opening balance locked';
  END IF;
  PERFORM pg_temp.expect_rows('manager deletes an item (no DELETE policy)',
    format('DELETE FROM inventory_items WHERE id = %L', v_item_new), 0);

  -- ============================================================
  -- #3 audits
  -- ============================================================
  v_aud := create_inventory_audit(o_a, v_period, NULL);
  PERFORM pg_temp.expect_rows('manager cancels an unsubmitted audit (legit)',
    format('DELETE FROM inventory_audits WHERE id = %L', v_aud), 1);

  v_aud := create_inventory_audit(o_a, v_period, NULL);
  PERFORM pg_temp.expect_fail('manager forges an audit approval',
    format($q$UPDATE inventory_audits SET status = 'approved', approved_by = %L, approved_at = now() WHERE id = %L$q$, v_admin, v_aud),
    'permission denied');
  PERFORM pg_temp.expect_fail('manager skips counting (items_counted)',
    format('UPDATE inventory_audits SET items_counted = items_total WHERE id = %L', v_aud),
    'permission denied');
  PERFORM pg_temp.expect_fail('manager adds an audit line',
    format('INSERT INTO inventory_audit_line_items (audit_id, inventory_item_id, system_quantity) VALUES (%L, %L, 0)', v_aud, it_a),
    'permission denied');
  PERFORM pg_temp.expect_fail('manager edits a system quantity',
    format('UPDATE inventory_audit_line_items SET system_quantity = 0 WHERE audit_id = %L', v_aud),
    'permission denied');
  PERFORM pg_temp.expect_fail('manager enters a negative count',
    format('UPDATE inventory_audit_line_items SET physical_quantity = -1 WHERE audit_id = %L', v_aud),
    'audit_line_physical_qty_nonneg|check constraint');

  -- legit count + submit (manager surplus -> pending approval)
  UPDATE inventory_audit_line_items
  SET physical_quantity = system_quantity + 1, reason_code = 'audit_surplus', status = 'counted'
  WHERE audit_id = v_aud;
  SELECT * INTO v_rec FROM submit_inventory_audit(v_aud, NULL);
  IF v_rec.auto_approved OR (SELECT status FROM inventory_audits WHERE id = v_aud) <> 'pending_approval' THEN
    RAISE EXCEPTION '043 FAILED: manager audit submit did not go to approval';
  END IF;

  -- after submission the counts are frozen and the audit cannot be deleted
  BEGIN
    UPDATE inventory_audit_line_items SET physical_quantity = 999 WHERE audit_id = v_aud;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM inventory_audit_line_items WHERE audit_id = v_aud AND physical_quantity = 999) THEN
    RAISE EXCEPTION '043 FAILED: counts changed after the audit was submitted';
  END IF;
  PERFORM pg_temp.expect_rows('manager deletes a submitted audit',
    format('DELETE FROM inventory_audits WHERE id = %L', v_aud), 0);
  PERFORM set_config('v043.aud', v_aud::text, true);
  PERFORM set_config('v043.item_new', v_item_new::text, true);

  -- ============================================================
  -- #4 / #6 / #14 / #15 / #17 / #20 invoices
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager creates an invoice already PAID',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status, subtotal, tax_total, grand_total, issued_at)
              VALUES ('subscription', %L, %L, 'paid', 100, 0, 100, now())$q$, c_corp, o_a),
    'created as draft');
  PERFORM pg_temp.expect_fail('manager creates an invoice already FINALIZED',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status, issued_at)
              VALUES ('subscription', %L, %L, 'finalized', now())$q$, c_corp, o_a),
    'created as draft');
  PERFORM pg_temp.expect_fail('subscription invoice billed to an event client',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status) VALUES ('subscription', %L, %L, 'draft')$q$, c_evt, o_a),
    'corporate clients');
  PERFORM pg_temp.expect_fail('future invoice date',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status, issued_at) VALUES ('subscription', %L, %L, 'draft', %L)$q$,
           c_corp, o_a, v_today + 2),
    'between 2017-07-01 and today');
  PERFORM pg_temp.expect_fail('pre-GST invoice date',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status, issued_at) VALUES ('subscription', %L, %L, 'draft', '2010-01-01')$q$,
           c_corp, o_a),
    'between 2017-07-01 and today');
  PERFORM pg_temp.expect_fail('unknown number format',
    format($q$INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number_format) VALUES ('subscription', %L, %L, 'draft', 'bogus')$q$,
           c_corp, o_a),
    'unknown invoice number format');

  -- forged number / totals / snapshot / created_at are ignored on insert
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status, invoice_number,
                        subtotal, tax_total, grand_total, client_name_snap, created_at)
  VALUES ('subscription', c_corp, o_a, 'draft', 'INV/2026-27/9999', 1000, 0, 1000, 'Forged Party', '2020-01-01')
  RETURNING id INTO v_inv;
  SELECT * INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.invoice_number = 'INV/2026-27/9999' THEN
    RAISE EXCEPTION '043 FAILED: client-chosen invoice number kept';
  END IF;
  IF v_rec.grand_total <> 0 OR v_rec.client_name_snap IS NOT NULL OR v_rec.created_at < now() - interval '1 hour' THEN
    RAISE EXCEPTION '043 FAILED: client totals/snapshot/created_at kept on insert: %', row_to_json(v_rec);
  END IF;

  -- legit draft flow: items drive the header
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES (v_inv, 'Plates', 2, 50, 100, 18, 18);
  IF (SELECT grand_total FROM invoices WHERE id = v_inv) <> 118 THEN
    RAISE EXCEPTION '043 FAILED: header totals did not follow the items';
  END IF;
  UPDATE invoices SET subtotal = 1, tax_total = 0, grand_total = 1 WHERE id = v_inv;
  SELECT * INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.subtotal <> 100 OR v_rec.tax_total <> 18 OR v_rec.grand_total <> 118 THEN
    RAISE EXCEPTION '043 FAILED: forged header totals kept on a draft: %/%/%', v_rec.subtotal, v_rec.tax_total, v_rec.grand_total;
  END IF;

  PERFORM pg_temp.expect_fail('manager renumbers a draft',
    format($q$UPDATE invoices SET invoice_number = 'INV/2026-27/9999' WHERE id = %L$q$, v_inv),
    'system-assigned');
  PERFORM pg_temp.expect_fail('manager re-points a draft to another client',
    format('UPDATE invoices SET client_id = %L WHERE id = %L', c_corp2, v_inv),
    'fixed when it is created');

  -- forged snapshot on the draft is discarded at finalize
  UPDATE invoices SET client_name_snap = 'Forged Party', client_gst_type_snap = 'export' WHERE id = v_inv;
  UPDATE invoices SET status = 'finalized' WHERE id = v_inv;                     -- legit finalize
  SELECT * INTO v_rec FROM invoices WHERE id = v_inv;
  IF v_rec.status <> 'finalized' OR v_rec.client_name_snap IS DISTINCT FROM 'V043 Corp'
     OR v_rec.client_gst_type_snap IS DISTINCT FROM 'domestic' THEN
    RAISE EXCEPTION '043 FAILED: finalize/snapshot wrong: status %, party %, type %',
      v_rec.status, v_rec.client_name_snap, v_rec.client_gst_type_snap;
  END IF;

  PERFORM pg_temp.expect_fail('re-dating an issued invoice into an earlier GST period',
    format($q$UPDATE invoices SET issued_at = '2024-03-31' WHERE id = %L$q$, v_inv),
    'locked once the invoice is issued');
  PERFORM pg_temp.expect_fail('marking an unpaid invoice PAID',
    format($q$UPDATE invoices SET status = 'paid' WHERE id = %L$q$, v_inv),
    'follows its payments');

  -- legit payment -> status derived by the DB
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 50, 'cash', v_today) RETURNING id INTO v_pay1;
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'partially_paid' THEN
    RAISE EXCEPTION '043 FAILED: payment did not move the invoice to partially_paid';
  END IF;
  PERFORM pg_temp.expect_fail('partially paid -> finalized by hand',
    format($q$UPDATE invoices SET status = 'finalized' WHERE id = %L$q$, v_inv), 'follows its payments');
  PERFORM pg_temp.expect_fail('partially paid -> paid by hand',
    format($q$UPDATE invoices SET status = 'paid' WHERE id = %L$q$, v_inv), 'follows its payments');
  PERFORM pg_temp.expect_fail('cancelling an invoice that has payments',
    format($q$UPDATE invoices SET status = 'cancelled' WHERE id = %L$q$, v_inv),
    'void all payments|invalid status transition');

  -- ============================================================
  -- #7 payments immutable except void
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager rewrites a payment amount',
    format('UPDATE payments SET amount = 1 WHERE id = %L', v_pay1), 'cannot be edited');
  PERFORM pg_temp.expect_fail('manager back-dates a payment',
    format($q$UPDATE payments SET payment_date = '2025-01-01' WHERE id = %L$q$, v_pay1), 'cannot be edited');
  PERFORM pg_temp.expect_fail('manager re-points a payment to another invoice',
    format('UPDATE payments SET invoice_id = %L WHERE id = %L', inv_fin, v_pay1), 'cannot be edited');
  PERFORM pg_temp.expect_fail('manager rewrites a payment created_at',
    format($q$UPDATE payments SET created_at = '2026-01-01' WHERE id = %L$q$, v_pay1), 'cannot be edited');
  PERFORM pg_temp.expect_fail('payment dated before the invoice date',
    format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date) VALUES (%L, 1, 'cash', %L)$q$,
           v_inv, v_today - 1),
    'before the invoice date');

  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 68, 'upi', v_today) RETURNING id INTO v_pay2;
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'paid' THEN
    RAISE EXCEPTION '043 FAILED: settling payment did not mark the invoice paid';
  END IF;

  -- legit void (with a reason), stamped by the DB
  UPDATE payments SET is_active = false, void_reason = '  Entered twice ' WHERE id = v_pay2;
  SELECT * INTO v_rec FROM payments WHERE id = v_pay2;
  IF v_rec.voided_by IS DISTINCT FROM v_mgr OR v_rec.voided_at IS NULL OR v_rec.void_reason IS DISTINCT FROM 'Entered twice' THEN
    RAISE EXCEPTION '043 FAILED: void trail wrong: by %, at %, reason %', v_rec.voided_by, v_rec.voided_at, v_rec.void_reason;
  END IF;
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'partially_paid' THEN
    RAISE EXCEPTION '043 FAILED: void did not move the invoice back to partially_paid';
  END IF;
  PERFORM pg_temp.expect_fail('manager reactivates a voided payment',
    format('UPDATE payments SET is_active = true WHERE id = %L', v_pay2), 'cannot be changed or reactivated');
  PERFORM pg_temp.expect_fail('manager rewrites a void reason',
    format($q$UPDATE payments SET void_reason = 'x' WHERE id = %L$q$, v_pay2), 'cannot be changed or reactivated');

  -- app-style void (no reason) -> invoice back to finalized -> cancel allowed
  UPDATE payments SET is_active = false WHERE id = v_pay1;
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'finalized' THEN
    RAISE EXCEPTION '043 FAILED: voiding the last payment did not revert the invoice to finalized';
  END IF;
  UPDATE invoices SET status = 'cancelled' WHERE id = v_inv;                      -- legit cancel
  IF (SELECT status FROM invoices WHERE id = v_inv) <> 'cancelled' THEN
    RAISE EXCEPTION '043 FAILED: legit cancel of an unpaid finalized invoice failed';
  END IF;

  -- paid -> finalized -> cancelled (sales suppression) on a fully paid invoice
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (inv_fin, 118, 'bank_transfer', v_today) RETURNING id INTO v_pay_fin;
  IF (SELECT status FROM invoices WHERE id = inv_fin) <> 'paid' THEN
    RAISE EXCEPTION '043 FAILED: full payment did not mark the invoice paid';
  END IF;
  PERFORM pg_temp.expect_fail('paid invoice set back to finalized by hand',
    format($q$UPDATE invoices SET status = 'finalized' WHERE id = %L$q$, inv_fin), 'follows its payments');
  PERFORM pg_temp.expect_fail('paid invoice cancelled',
    format($q$UPDATE invoices SET status = 'cancelled' WHERE id = %L$q$, inv_fin),
    'void all payments|invalid status transition');
  PERFORM set_config('v043.pay_fin', v_pay_fin::text, true);
  PERFORM set_config('v043.pay2', v_pay2::text, true);

  -- ============================================================
  -- #8 events
  -- ============================================================
  PERFORM pg_temp.expect_fail('event created as completed',
    format($q$INSERT INTO events (outlet_id, client_id, event_name, event_date, status) VALUES (%L, %L, 'X', %L, 'completed')$q$,
           o_a, c_evt, v_today),
    'must start as planned');
  INSERT INTO events (outlet_id, client_id, event_name, event_date, status)
  VALUES (o_a, c_evt, 'V043 New Event', v_today + 7, 'planned') RETURNING id INTO v_ev;
  PERFORM pg_temp.expect_rows('edit a planned event (legit)',
    format($q$UPDATE events SET event_name = 'V043 New Event (edited)', guest_count = 50 WHERE id = %L AND status = 'planned'$q$, v_ev), 1);
  PERFORM pg_temp.expect_rows('complete a planned event (legit)',
    format($q$UPDATE events SET status = 'completed' WHERE id = %L AND status = 'planned'$q$, v_ev), 1);
  PERFORM pg_temp.expect_fail('rename a completed (invoiceable) event',
    format($q$UPDATE events SET event_name = 'Altered' WHERE id = %L$q$, ev_c), 'only planned events');
  PERFORM pg_temp.expect_fail('re-date a completed event',
    format($q$UPDATE events SET event_date = '2025-12-31' WHERE id = %L$q$, ev_c), 'only planned events');
  PERFORM pg_temp.expect_fail('completed event back to planned',
    format($q$UPDATE events SET status = 'planned' WHERE id = %L$q$, ev_c), 'invalid event status');
  PERFORM pg_temp.expect_rows('note on a completed event (legit)',
    format($q$UPDATE events SET notes = 'after the fact' WHERE id = %L$q$, ev_c), 1);

  -- ============================================================
  -- #12 subscriptions
  -- ============================================================
  PERFORM pg_temp.expect_fail('subscription created already cancelled',
    format($q$INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, end_date, quantity,
                price_per_unit, next_billing_date, notes, status)
              VALUES (%L, %L, 'monthly', 1, %L, %L, 1, 1, %L, 'x', 'cancelled')$q$,
           o_a, c_corp2, v_today, v_today, v_today + 30),
    'start active');
  PERFORM pg_temp.expect_fail('manager back-dates a subscription',
    format($q$INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, quantity,
                price_per_unit, next_billing_date, notes, status)
              VALUES (%L, %L, 'monthly', 1, %L, 1, 1, %L, 'x', 'active')$q$,
           o_a, c_corp2, v_today - 30, v_today + 30),
    'past start dates');

  INSERT INTO subscriptions (outlet_id, client_id, billing_cycle, billing_day, start_date, quantity,
                             price_per_unit, next_billing_date, notes, status)
  VALUES (o_a, c_corp2, 'monthly', 1, v_today, 10, 5, v_today + 30, 'V043 pricing note', 'active')
  RETURNING id INTO v_sub;

  PERFORM pg_temp.expect_fail('price change without a reason',
    format('UPDATE subscriptions SET price_per_unit = 6 WHERE id = %L', v_sub), 'reason is required');
  PERFORM pg_temp.expect_rows('price change with a reason (legit)',
    format($q$UPDATE subscriptions SET price_per_unit = 6, price_change_reason = 'Negotiated' WHERE id = %L$q$, v_sub), 1);
  PERFORM pg_temp.expect_fail('manager changes the start date',
    format('UPDATE subscriptions SET start_date = %L WHERE id = %L', v_today + 1, v_sub), 'only admins can change the start date');
  PERFORM pg_temp.expect_fail('end date on an active subscription',
    format('UPDATE subscriptions SET end_date = %L WHERE id = %L', v_today + 10, v_sub), 'end date is set only');
  PERFORM pg_temp.expect_fail('next billing date set by hand',
    format('UPDATE subscriptions SET next_billing_date = %L WHERE id = %L', v_today + 3, v_sub), 'billing schedule');
  PERFORM pg_temp.expect_rows('pause (legit)',
    format($q$UPDATE subscriptions SET status = 'paused' WHERE id = %L AND status = 'active'$q$, v_sub), 1);
  PERFORM pg_temp.expect_rows('resume with a new billing date (legit)',
    format($q$UPDATE subscriptions SET status = 'active', next_billing_date = %L WHERE id = %L AND status = 'paused'$q$,
           v_today + 31, v_sub), 1);
  PERFORM pg_temp.expect_rows('cycle change recomputes next billing date (legit)',
    format($q$UPDATE subscriptions SET billing_cycle = 'weekly', billing_day = NULL, next_billing_date = %L WHERE id = %L$q$,
           v_today + 7, v_sub), 1);
  PERFORM pg_temp.expect_rows('cancel (legit)',
    format($q$UPDATE subscriptions SET status = 'cancelled', end_date = %L WHERE id = %L AND status IN ('active', 'paused')$q$,
           v_today, v_sub), 1);
  PERFORM pg_temp.expect_fail('un-cancel a subscription',
    format($q$UPDATE subscriptions SET status = 'active', end_date = NULL WHERE id = %L$q$, v_sub),
    'cancelled subscriptions cannot be changed');

  -- ============================================================
  -- #9 own profile
  -- ============================================================
  PERFORM pg_temp.expect_fail('manager changes own email',
    format($q$UPDATE user_profiles SET email = 'admin@hybits.invalid' WHERE id = %L$q$, v_mgr), 'only change your own name');
  PERFORM pg_temp.expect_fail('manager fakes own last_login',
    format($q$UPDATE user_profiles SET last_login = '2020-01-01' WHERE id = %L$q$, v_mgr), 'only change your own name');
  PERFORM pg_temp.expect_fail('manager promotes self',
    format($q$UPDATE user_profiles SET role = 'admin' WHERE id = %L$q$, v_mgr), 'only change your own name|row-level security');
  PERFORM pg_temp.expect_rows('manager edits own name and phone (legit)',
    format($q$UPDATE user_profiles SET full_name = 'V043 Manager', phone = '9876543210' WHERE id = %L$q$, v_mgr), 1);
  PERFORM pg_temp.expect_rows('manager edits another user',
    format($q$UPDATE user_profiles SET full_name = 'Hacked' WHERE id = %L$q$, v_admin), 0);
  PERFORM record_login();                                                         -- legit
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_mgr AND last_login IS NOT NULL) THEN
    RAISE EXCEPTION '043 FAILED: record_login no longer records the login';
  END IF;

  -- ============================================================
  -- #19 created_at
  -- ============================================================
  UPDATE clients SET created_at = '2001-01-01' WHERE id = c_corp;
  IF (SELECT created_at FROM clients WHERE id = c_corp) < '2002-01-01' THEN
    RAISE EXCEPTION '043 FAILED: client created_at rewritten';
  END IF;
  INSERT INTO clients (outlet_id, client_type, name, phone, created_at)
  VALUES (o_a, 'corporate', 'V043 Backdated', '9999999999', '2001-01-01') RETURNING id, created_at INTO v_cli, v_ts;
  IF v_ts < now() - interval '1 hour' THEN
    RAISE EXCEPTION '043 FAILED: client-supplied created_at kept on insert';
  END IF;
  UPDATE subscriptions SET created_at = '2099-01-01' WHERE id = v_sub;
  UPDATE events SET created_at = '2099-01-01' WHERE id = v_ev;
  IF (SELECT created_at FROM subscriptions WHERE id = v_sub) > now() + interval '1 day'
     OR (SELECT created_at FROM events WHERE id = v_ev) > now() + interval '1 day' THEN
    RAISE EXCEPTION '043 FAILED: subscription/event created_at rewritten';
  END IF;

  RAISE NOTICE '043 part 2 (manager) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 3: as an ADMIN
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v043.admin'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  v_admin uuid := pg_temp.v('admin');
  v_admin2 uuid := pg_temp.v('admin2');
  v_mgr uuid := pg_temp.v('mgr');
  o_a uuid := pg_temp.v('o_a');
  o_b uuid := pg_temp.v('o_b');
  it_a uuid := pg_temp.v('it_a');
  ev_p uuid := pg_temp.v('ev_p');
  v_aud uuid := pg_temp.v('aud');
  v_rec record;
BEGIN
  -- admins are bound by the same money / ledger rules
  PERFORM pg_temp.expect_fail('admin rewrites a payment amount',
    format('UPDATE payments SET amount = 1 WHERE id = %L', pg_temp.v('pay_fin')), 'cannot be edited');
  PERFORM pg_temp.expect_fail('admin reactivates a voided payment',
    format('UPDATE payments SET is_active = true WHERE id = %L', pg_temp.v('pay2')), 'cannot be changed or reactivated');
  PERFORM pg_temp.expect_fail('admin edits stock quantities directly',
    format('UPDATE inventory_items SET available_quantity = available_quantity + 1, total_quantity = total_quantity + 1 WHERE id = %L', it_a),
    'only through inventory movements');
  PERFORM pg_temp.expect_fail('admin edits an allocation directly',
    format('UPDATE inventory_allocations SET allocated_quantity = 1 WHERE reference_id = %L', ev_p),
    'permission denied|cannot be edited');

  -- audits: status only through the RPC
  PERFORM pg_temp.expect_fail('admin rewinds an audit status directly',
    format($q$UPDATE inventory_audits SET status = 'counting' WHERE id = %L$q$, v_aud), 'permission denied');
  SELECT * INTO v_rec FROM approve_inventory_audit(v_aud, NULL, true, NULL);       -- legit
  IF NOT v_rec.success OR v_rec.movements_created <> 2 THEN
    RAISE EXCEPTION '043 FAILED: approve_inventory_audit returned %', row_to_json(v_rec);
  END IF;
  PERFORM pg_temp.expect_rows('admin deletes an approved audit',
    format('DELETE FROM inventory_audits WHERE id = %L', v_aud), 0);
  IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE notes LIKE '%' || v_aud::text || '%' AND created_by = v_admin) THEN
    RAISE EXCEPTION '043 FAILED: audit adjustments not attributed to the approving admin';
  END IF;

  -- admin invariants
  PERFORM pg_temp.expect_fail('admin deactivates own account',
    format('UPDATE user_profiles SET is_active = false WHERE id = %L', v_admin), 'own account');
  PERFORM pg_temp.expect_rows('admin deactivates another admin (legit)',
    format('UPDATE user_profiles SET is_active = false WHERE id = %L', v_admin2), 1);
  PERFORM pg_temp.expect_fail('last active admin demotes self',
    format($q$UPDATE user_profiles SET role = 'manager' WHERE id = %L$q$, v_admin), 'last active admin');
  PERFORM pg_temp.expect_rows('admin reactivates a user (legit)',
    format('UPDATE user_profiles SET is_active = true WHERE id = %L', v_admin2), 1);
  PERFORM pg_temp.expect_rows('admin edits another user''s profile (legit)',
    format($q$UPDATE user_profiles SET phone = '9000000000' WHERE id = %L$q$, v_mgr), 1);

  -- outlet assignment RPC still works
  PERFORM set_user_outlet_assignments(v_mgr, ARRAY[o_a, o_b]);
  IF (SELECT count(*) FROM user_outlet_assignments WHERE user_id = v_mgr) <> 2 THEN
    RAISE EXCEPTION '043 FAILED: set_user_outlet_assignments';
  END IF;
  PERFORM set_user_outlet_assignments(v_mgr, ARRAY[o_a]);

  RAISE NOTICE '043 part 3 (admin) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 4: as the ACCOUNTANT (read-only)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v043.acc'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  inv_fin uuid := pg_temp.v('inv_fin');
  o_a uuid := pg_temp.v('o_a');
  it_a uuid := pg_temp.v('it_a');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = inv_fin)
     OR NOT EXISTS (SELECT 1 FROM inventory_audits WHERE id = pg_temp.v('aud')) THEN
    RAISE EXCEPTION '043 FAILED: accountant lost read access';
  END IF;
  PERFORM pg_temp.expect_rows('accountant edits an invoice',
    format($q$UPDATE invoices SET terms_and_conditions = 'x' WHERE id = %L$q$, inv_fin), 0);
  PERFORM pg_temp.expect_rows('accountant edits an audit count',
    format($q$UPDATE inventory_audit_line_items SET notes = 'x' WHERE audit_id = %L$q$, pg_temp.v('aud')), 0);
  PERFORM pg_temp.expect_fail('accountant records a payment',
    format($q$INSERT INTO payments (invoice_id, amount, payment_method, payment_date) VALUES (%L, 1, 'cash', CURRENT_DATE)$q$, inv_fin),
    -- prevent_overpayment's row lock (invoker) already finds no lockable
    -- invoice for a read-only role; RLS would refuse the row next
    'row-level security|invoice does not exist');
  PERFORM pg_temp.expect_fail('accountant posts a movement',
    format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
              VALUES (%L, %L, 'inflow', 'stock_in', 1, 'manual', 'purchase', auth.uid())$q$, o_a, it_a),
    'row-level security');
  RAISE NOTICE '043 part 4 (accountant) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 5: as a DEACTIVATED manager with a leftover token
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('v043.dead'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  o_a uuid := pg_temp.v('o_a');
  it_a uuid := pg_temp.v('it_a');
BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE outlet_id = o_a)
     OR EXISTS (SELECT 1 FROM inventory_audits WHERE outlet_id = o_a)
     OR EXISTS (SELECT 1 FROM inventory_audit_line_items)
     OR EXISTS (SELECT 1 FROM inventory_allocations WHERE outlet_id = o_a) THEN
    RAISE EXCEPTION '043 FAILED: a deactivated user can still read outlet data';
  END IF;
  PERFORM pg_temp.expect_rows('deactivated user edits own profile',
    format($q$UPDATE user_profiles SET full_name = 'Still here' WHERE id = %L$q$, pg_temp.v('dead')), 0);
  PERFORM pg_temp.expect_fail('deactivated user posts a movement',
    format($q$INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_category, movement_type, quantity, reference_type, reason_code, created_by)
              VALUES (%L, %L, 'inflow', 'stock_in', 1, 'manual', 'purchase', auth.uid())$q$, o_a, it_a),
    'row-level security|inactive user');
  RAISE NOTICE '043 part 5 (deactivated) OK';
END $$;

RESET ROLE;

-- ----------------------------------------------------------------
-- Part 6: as ANON (public anon key, no session)
-- ----------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '', true);

DO $$
BEGIN
  IF to_regprocedure('public.get_invoice_balance(uuid)') IS NOT NULL THEN
    PERFORM pg_temp.expect_fail('anon reads an invoice balance by id',
      format('SELECT get_invoice_balance(%L)', pg_temp.v('inv_fin')), 'permission denied');
  END IF;
  PERFORM pg_temp.expect_fail('anon calls record_login', 'SELECT record_login()', 'permission denied');
  PERFORM pg_temp.expect_fail('anon calls an audit RPC',
    format('SELECT create_inventory_audit(%L, ''2020-01'', NULL)', pg_temp.v('o_a')), 'permission denied');
  IF EXISTS (SELECT 1 FROM invoices) OR EXISTS (SELECT 1 FROM payments) THEN
    RAISE EXCEPTION '043 FAILED: anon can read invoices/payments';
  END IF;
  RAISE NOTICE '043 part 6 (anon) OK';
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

-- ----------------------------------------------------------------
-- Part 7: the ledger and the derived rows agree (owner)
-- ----------------------------------------------------------------
DO $$
DECLARE
  it_a uuid := pg_temp.v('it_a');
  v_item record;
  v_alloc record;
BEGIN
  -- it_a: 100 in, 10 out, +5 in (manager), 3 back, +1 audit surplus
  SELECT * INTO v_item FROM inventory_items WHERE id = it_a;
  IF v_item.available_quantity <> 99 OR v_item.allocated_quantity <> 7 OR v_item.total_quantity <> 106 THEN
    RAISE EXCEPTION '043 FAILED: item quantities %/%/% (expected available 99, allocated 7, total 106)',
      v_item.available_quantity, v_item.allocated_quantity, v_item.total_quantity;
  END IF;

  SELECT * INTO v_alloc FROM inventory_allocations WHERE reference_id = pg_temp.v('ev_p');
  IF v_alloc.allocated_quantity <> 10 OR NOT v_alloc.is_active THEN
    RAISE EXCEPTION '043 FAILED: allocation % / active % (expected 10 / true)', v_alloc.allocated_quantity, v_alloc.is_active;
  END IF;

  IF (SELECT available_quantity FROM inventory_items WHERE id = pg_temp.v('item_new')) <> 1 THEN
    RAISE EXCEPTION '043 FAILED: audit surplus on the new item not applied';
  END IF;

  IF (SELECT status FROM invoices WHERE id = pg_temp.v('inv_fin')) <> 'paid' THEN
    RAISE EXCEPTION '043 FAILED: fully paid invoice is not paid';
  END IF;

  RAISE NOTICE '043 part 7 (ledger) OK';
END $$;

ROLLBACK;
