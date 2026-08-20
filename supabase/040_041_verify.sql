-- ================================================================
-- VERIFY 040 + 041 — runnable check, rolls back, changes nothing.
-- Paste into the Supabase SQL editor AFTER applying both.
-- Expected: "040+041 OK".
--
-- NOTE ON COVERAGE: the SQL editor runs with auth.uid() = NULL and a
-- single session, so this proves (a) the audit RPCs no longer accept
-- a caller-supplied identity, and (b) the guards behave. It CANNOT
-- prove the payment race is fixed -- that needs two concurrent
-- sessions and belongs in an integration test.
-- ================================================================
BEGIN;

DO $$
DECLARE
  v_outlet uuid;
  v_client uuid;
  v_inv uuid;
  v_item uuid;
  v_admin uuid;
  v_ok boolean;
  v_msg text;
BEGIN
  INSERT INTO outlets (name, code)
  VALUES ('Verify 041 Outlet', 'ZZ-VERIFY-041') RETURNING id INTO v_outlet;

  INSERT INTO clients (outlet_id, client_type, name, phone)
  VALUES (v_outlet, 'corporate', 'Verify 041 Client', '9999999999') RETURNING id INTO v_client;

  -- ============================================================
  -- 040: audit RPCs must reject a caller-supplied identity
  -- ============================================================
  -- Pick any real admin uuid. Before 040, passing it here was enough
  -- to be treated as that admin. After 040 the session decides, and
  -- this session has no auth.uid(), so it must be rejected.
  SELECT id INTO v_admin FROM user_profiles WHERE role = 'admin' LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE NOTICE 'skipped 040 check: no admin user exists yet';
  ELSE
    v_ok := false;
    BEGIN
      PERFORM approve_inventory_audit(gen_random_uuid(), v_admin, true);
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      v_ok := true;
    END;

    IF NOT v_ok THEN
      RAISE EXCEPTION '040 FAILED: approve_inventory_audit accepted a supplied admin uuid';
    END IF;

    -- Must fail on authentication, NOT on "audit not found" -- that
    -- ordering is what stops the existence oracle.
    IF v_msg NOT LIKE '%Not authenticated%' THEN
      RAISE EXCEPTION '040 FAILED: expected an auth error, got: %', v_msg;
    END IF;
  END IF;

  -- ============================================================
  -- 041.2: inventory item delete guard actually runs
  -- ============================================================
  INSERT INTO inventory_items (outlet_id, name, category, unit,
                               total_quantity, available_quantity)
  VALUES (v_outlet, 'Verify Plate 041', 'Plate', 'pcs', 0, 0)
  RETURNING id INTO v_item;

  -- No movements yet, so this must SUCCEED (before 041 it errored on
  -- a column that does not exist)
  BEGIN
    DELETE FROM inventory_items WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '041 FAILED: delete guard still broken: %', SQLERRM;
  END;

  -- ============================================================
  -- 041.3: every table has RLS
  -- ============================================================
  SELECT relrowsecurity INTO v_ok
  FROM pg_class WHERE relname = 'inventory_migration_log';
  IF NOT v_ok THEN
    RAISE EXCEPTION '041 FAILED: RLS not enabled on inventory_migration_log';
  END IF;

  -- ============================================================
  -- 041.4: invoice_items manager policy requires the manager role
  -- ============================================================
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoice_items'
      AND policyname = 'managers_access_own_outlet_invoice_items'
      AND qual LIKE '%current_user_role%'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION '041 FAILED: invoice_items policy has no role check';
  END IF;

  -- ============================================================
  -- 041.1: overpayment still rejected (guard intact after rewrite)
  -- ============================================================
  INSERT INTO invoices (invoice_type, client_id, outlet_id, status,
                        subtotal, tax_total, grand_total)
  VALUES ('subscription', v_client, v_outlet, 'draft', 100, 18, 118)
  RETURNING id INTO v_inv;
  UPDATE invoices SET status = 'finalized' WHERE id = v_inv;

  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 100, 'cash', CURRENT_DATE);

  v_ok := false;
  BEGIN
    -- 100 already paid on a 118 invoice; 50 more must be rejected
    INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
    VALUES (v_inv, 50, 'cash', CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION '041 FAILED: overpayment was accepted';
  END IF;

  -- Exact settlement must still be allowed
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES (v_inv, 18, 'cash', CURRENT_DATE);

  RAISE NOTICE '040+041 OK';
END $$;

ROLLBACK;
