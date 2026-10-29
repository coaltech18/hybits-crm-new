-- ================================================================
-- MIGRATION 043: SECURITY HARDENING (RLS / triggers / privileges)
-- ================================================================
-- One transaction. Paste the whole file into the Supabase SQL editor
-- AFTER 042. If any statement fails, nothing is applied.
-- No new enum values (no 043a/043b split needed).
--
-- Threat model: an authenticated manager / accountant calling
-- PostgREST or RPC directly with their own JWT; a deactivated user
-- with a leftover token; anon with the public anon key.
--
-- HOW "WHO IS WRITING" IS DECIDED
--   * "client session"  = auth.uid() IS NOT NULL (a signed-in app
--     user, directly or through any trigger/RPC). SQL-editor and
--     service-role sessions (auth.uid() IS NULL) stay exempt so data
--     can still be repaired by hand.
--   * "direct client write" = current_user IN ('authenticated','anon').
--     Inside a SECURITY DEFINER function (owner = postgres) current_user
--     is the owner, so the ledger triggers, the audit RPCs and the
--     subscription/event triggers can still maintain derived tables
--     (allocations, item quantities, audit headers) while a PostgREST
--     request for the same row is refused. Guard trigger functions that
--     rely on this are therefore SECURITY INVOKER on purpose.
--
-- SECTIONS
--   0  prerequisites
--   1  inventory: allocations read-only, item quantity/outlet/lock
--      guard, movement actor forced to auth.uid()
--   2  inventory audits: read + count-only writes, status only via RPC
--   3  invoices: status derived from payments, header totals from
--      items, number/party/date locks, client-type rule
--   4  payments: immutable except voiding; voided_by/at/reason
--   5  events + subscriptions: insert/edit rules not covered by 042
--   6  users: own-profile column guard, last-admin invariant
--   7  created_at not client-writable
--   8  SECURITY DEFINER sweep + unused settlement helpers + TRUNCATE
--
-- FRONTEND: no change required. The app's flows (movement inserts,
-- audit RPCs + count updates + cancel of an unsubmitted audit, draft
-- invoice + item writes, finalize/cancel, payment insert + void,
-- event/subscription lifecycle, record_login, outlet RPC) all pass.
-- Optional clean-ups are listed in MIGRATION_ORDER.md row 43.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- 0. PREREQUISITES
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.current_user_role()') IS NULL
     OR to_regprocedure('public.current_user_is_active()') IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: run 033 first';
  END IF;
  IF to_regprocedure('public.record_login()') IS NULL
     OR to_regprocedure('public.snapshot_invoice_parties()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'invoices'
                      AND column_name = 'subscription_id') THEN
    RAISE EXCEPTION 'Prerequisite missing: run 042 first';
  END IF;
END $$;


-- ================================================================
-- 1. INVENTORY
-- ================================================================

-- ----------------------------------------------------------------
-- 1.1 inventory_allocations: SELECT only for clients. Every write
--     comes from the movement ledger (sync_allocation_on_movement)
--     or the event/subscription cancel triggers, which run as the
--     owner. Before: FOR ALL for admins and managers (close, delete
--     or inflate what a client owes).
-- ----------------------------------------------------------------
-- The movement AFTER trigger must keep writing allocations once
-- clients lose the privilege: run it as the owner. (Body unchanged
-- from 042 D5; ALTER keeps it.)
ALTER FUNCTION sync_allocation_on_movement() SECURITY DEFINER;
ALTER FUNCTION sync_allocation_on_movement() SET search_path = public, pg_temp;
ALTER FUNCTION handle_subscription_inventory_v2() SECURITY DEFINER;
ALTER FUNCTION handle_subscription_inventory_v2() SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "admin_inventory_allocations_all" ON inventory_allocations;
DROP POLICY IF EXISTS "manager_inventory_allocations_assigned" ON inventory_allocations;
DROP POLICY IF EXISTS "admin_inventory_allocations_read" ON inventory_allocations;
DROP POLICY IF EXISTS "manager_inventory_allocations_read" ON inventory_allocations;

CREATE POLICY "admin_inventory_allocations_read"
ON inventory_allocations FOR SELECT TO authenticated
USING (
  current_user_role() = 'admin'::user_role
  AND COALESCE(current_user_is_active(), false)
);

CREATE POLICY "manager_inventory_allocations_read"
ON inventory_allocations FOR SELECT TO authenticated
USING (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
);
-- accountant_inventory_allocations_read (008) is unchanged (checks is_active).

REVOKE INSERT, UPDATE, DELETE ON inventory_allocations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION guard_inventory_allocation_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- SECURITY INVOKER on purpose: current_user is the owner when the
  -- write comes from a (definer) ledger trigger.
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Allocations are derived from inventory movements and cannot be edited directly';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_inventory_allocation_write ON inventory_allocations;
CREATE TRIGGER guard_inventory_allocation_write
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_allocations
  FOR EACH ROW
  EXECUTE FUNCTION guard_inventory_allocation_write();

-- ----------------------------------------------------------------
-- 1.2 inventory_items: quantities, outlet and the opening-balance
--     lock are not client-writable. They change only through the
--     movement triggers (update_inventory_quantities_v2,
--     lock_opening_balance_on_allocation: both SECURITY DEFINER).
--     New items start at zero stock and unlocked. Managers lose
--     DELETE (FOR ALL split into SELECT / INSERT / UPDATE).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_inventory_item_direct_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;   -- ledger trigger (owner) or SQL editor
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.total_quantity, 0) <> 0 OR COALESCE(NEW.available_quantity, 0) <> 0
       OR COALESCE(NEW.allocated_quantity, 0) <> 0 OR COALESCE(NEW.damaged_quantity, 0) <> 0
       OR COALESCE(NEW.in_repair_quantity, 0) <> 0 OR COALESCE(NEW.lost_quantity, 0) <> 0 THEN
      RAISE EXCEPTION 'New inventory items start with zero stock. Record a stock-in movement instead.';
    END IF;
    NEW.opening_balance_confirmed := false;
    NEW.created_at := now();
    RETURN NEW;
  END IF;

  IF (NEW.total_quantity, NEW.available_quantity, NEW.allocated_quantity,
      NEW.damaged_quantity, NEW.in_repair_quantity, NEW.lost_quantity)
     IS DISTINCT FROM
     (OLD.total_quantity, OLD.available_quantity, OLD.allocated_quantity,
      OLD.damaged_quantity, OLD.in_repair_quantity, OLD.lost_quantity) THEN
    RAISE EXCEPTION 'Stock quantities change only through inventory movements';
  END IF;

  IF NEW.outlet_id IS DISTINCT FROM OLD.outlet_id THEN
    RAISE EXCEPTION 'An inventory item cannot be moved to another outlet';
  END IF;

  IF NEW.opening_balance_confirmed IS DISTINCT FROM OLD.opening_balance_confirmed THEN
    RAISE EXCEPTION 'The opening-balance lock is set automatically on the first allocation and cannot be changed directly';
  END IF;

  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_inventory_item_direct_write ON inventory_items;
CREATE TRIGGER guard_inventory_item_direct_write
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION guard_inventory_item_direct_write();

DROP POLICY IF EXISTS "manager_inventory_items_assigned" ON inventory_items;
DROP POLICY IF EXISTS "manager_inventory_items_select" ON inventory_items;
DROP POLICY IF EXISTS "manager_inventory_items_insert" ON inventory_items;
DROP POLICY IF EXISTS "manager_inventory_items_update" ON inventory_items;

CREATE POLICY "manager_inventory_items_select"
ON inventory_items FOR SELECT TO authenticated
USING (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
);

CREATE POLICY "manager_inventory_items_insert"
ON inventory_items FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
);

CREATE POLICY "manager_inventory_items_update"
ON inventory_items FOR UPDATE TO authenticated
USING (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
)
WITH CHECK (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
);
-- admin_inventory_items_all / accountant_inventory_items_read unchanged
-- (both check is_active); the guard trigger applies to admins too.

-- ----------------------------------------------------------------
-- 1.3 inventory_movements: the acting user is the session user.
--     validate_movement_v2 authorizes on NEW.created_by, which the
--     client used to send itself (a manager could post admin-only
--     adjustments as any admin). Forced here, in a trigger that
--     fires before derive_movement_category / validate_movement_v2
--     (BEFORE triggers fire in name order). Inside the audit RPCs
--     auth.uid() is still the caller (= their v_actor).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION force_movement_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS aa_force_movement_actor ON inventory_movements;
CREATE TRIGGER aa_force_movement_actor
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION force_movement_actor();

-- Defence in depth: the row must be attributed to the inserting user
-- (WITH CHECK is evaluated after BEFORE triggers).
DROP POLICY IF EXISTS "admin_inventory_movements_insert" ON inventory_movements;
CREATE POLICY "admin_inventory_movements_insert"
ON inventory_movements FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'admin'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "manager_inventory_movements_insert" ON inventory_movements;
CREATE POLICY "manager_inventory_movements_insert"
ON inventory_movements FOR INSERT TO authenticated
WITH CHECK (
  current_user_role() = 'manager'::user_role
  AND COALESCE(current_user_is_active(), false)
  AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid())
  AND created_by = auth.uid()
);


-- ================================================================
-- 2. INVENTORY AUDITS
-- ================================================================
-- Before: FOR ALL policies for managers/admins, no is_active check,
-- no column or status guard: a manager could forge an approval, edit
-- system/physical quantities after submission, rewind an approved
-- audit and replay its adjustments, or delete an approved audit.
-- After:
--   inventory_audits            SELECT (active users, managers: own
--                               outlets); DELETE only while not yet
--                               submitted (the app's "cancel audit");
--                               no INSERT/UPDATE -- create / submit /
--                               approve are the SECURITY DEFINER RPCs.
--   inventory_audit_line_items  SELECT; UPDATE of physical_quantity,
--                               reason_code, notes, status only, only
--                               while the audit is counting/review.
-- ----------------------------------------------------------------
-- The items_counted trigger writes inventory_audits; it must run as
-- the owner now that clients cannot update that table.
ALTER FUNCTION update_audit_items_counted() SECURITY DEFINER;
ALTER FUNCTION update_audit_items_counted() SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "audits_admin_all" ON inventory_audits;
DROP POLICY IF EXISTS "audits_manager_assigned" ON inventory_audits;
DROP POLICY IF EXISTS "audits_accountant_read" ON inventory_audits;
DROP POLICY IF EXISTS "audits_read" ON inventory_audits;
DROP POLICY IF EXISTS "audits_cancel_unsubmitted" ON inventory_audits;

CREATE POLICY "audits_read"
ON inventory_audits FOR SELECT TO authenticated
USING (
  COALESCE(current_user_is_active(), false)
  AND (
    current_user_role() IN ('admin'::user_role, 'accountant'::user_role)
    OR (current_user_role() = 'manager'::user_role
        AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid()))
  )
);

CREATE POLICY "audits_cancel_unsubmitted"
ON inventory_audits FOR DELETE TO authenticated
USING (
  COALESCE(current_user_is_active(), false)
  AND status IN ('draft', 'counting', 'review')
  AND (
    current_user_role() = 'admin'::user_role
    OR (current_user_role() = 'manager'::user_role
        AND outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "audit_items_admin_all" ON inventory_audit_line_items;
DROP POLICY IF EXISTS "audit_items_manager" ON inventory_audit_line_items;
DROP POLICY IF EXISTS "audit_items_accountant_read" ON inventory_audit_line_items;
DROP POLICY IF EXISTS "audit_items_read" ON inventory_audit_line_items;
DROP POLICY IF EXISTS "audit_items_count_update" ON inventory_audit_line_items;

CREATE POLICY "audit_items_read"
ON inventory_audit_line_items FOR SELECT TO authenticated
USING (
  COALESCE(current_user_is_active(), false)
  AND EXISTS (
    SELECT 1 FROM inventory_audits ia
    WHERE ia.id = inventory_audit_line_items.audit_id
      AND (
        current_user_role() IN ('admin'::user_role, 'accountant'::user_role)
        OR (current_user_role() = 'manager'::user_role
            AND ia.outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid()))
      )
  )
);

CREATE POLICY "audit_items_count_update"
ON inventory_audit_line_items FOR UPDATE TO authenticated
USING (
  COALESCE(current_user_is_active(), false)
  AND EXISTS (
    SELECT 1 FROM inventory_audits ia
    WHERE ia.id = inventory_audit_line_items.audit_id
      AND ia.status IN ('counting', 'review')
      AND (
        current_user_role() = 'admin'::user_role
        OR (current_user_role() = 'manager'::user_role
            AND ia.outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid()))
      )
  )
)
WITH CHECK (
  COALESCE(current_user_is_active(), false)
  AND EXISTS (
    SELECT 1 FROM inventory_audits ia
    WHERE ia.id = inventory_audit_line_items.audit_id
      AND ia.status IN ('counting', 'review')
      AND (
        current_user_role() = 'admin'::user_role
        OR (current_user_role() = 'manager'::user_role
            AND ia.outlet_id IN (SELECT uoa.outlet_id FROM user_outlet_assignments uoa WHERE uoa.user_id = auth.uid()))
      )
  )
);

-- Privileges: not relying on RLS alone.
REVOKE INSERT, UPDATE ON inventory_audits FROM authenticated, anon;
REVOKE DELETE ON inventory_audits FROM anon;
REVOKE INSERT, UPDATE, DELETE ON inventory_audit_line_items FROM authenticated, anon;
GRANT UPDATE (physical_quantity, reason_code, notes, status) ON inventory_audit_line_items TO authenticated;

CREATE OR REPLACE FUNCTION guard_inventory_audit_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;   -- audit RPCs / items_counted trigger (owner)
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('draft', 'counting', 'review') THEN
      RAISE EXCEPTION 'Only an audit that has not been submitted can be cancelled (this one is %)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Audits change only through create_inventory_audit / submit_inventory_audit / approve_inventory_audit';
END;
$fn$;

DROP TRIGGER IF EXISTS guard_inventory_audit_write ON inventory_audits;
CREATE TRIGGER guard_inventory_audit_write
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_audits
  FOR EACH ROW
  EXECUTE FUNCTION guard_inventory_audit_write();

CREATE OR REPLACE FUNCTION guard_inventory_audit_line_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_status audit_status;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;   -- create_inventory_audit / cascade from a cancel (owner)
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Audit lines are created with the audit and cannot be added or removed directly';
  END IF;

  IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
     OR NEW.inventory_item_id IS DISTINCT FROM OLD.inventory_item_id
     OR NEW.system_quantity IS DISTINCT FROM OLD.system_quantity
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the counted quantity, reason, notes and line status can be changed';
  END IF;

  SELECT ia.status INTO v_status FROM inventory_audits ia WHERE ia.id = OLD.audit_id;
  IF v_status IS NULL OR v_status NOT IN ('counting', 'review') THEN
    RAISE EXCEPTION 'Counts can only be changed while the audit is being counted (status: %)', COALESCE(v_status::text, 'unknown');
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_inventory_audit_line_write ON inventory_audit_line_items;
CREATE TRIGGER guard_inventory_audit_line_write
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_audit_line_items
  FOR EACH ROW
  EXECUTE FUNCTION guard_inventory_audit_line_write();

-- physical counts cannot be negative (NOT VALID first, validated when
-- existing rows allow it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'audit_line_physical_qty_nonneg'
                   AND conrelid = 'public.inventory_audit_line_items'::regclass) THEN
    ALTER TABLE inventory_audit_line_items
      ADD CONSTRAINT audit_line_physical_qty_nonneg
      CHECK (physical_quantity IS NULL OR physical_quantity >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventory_audit_line_items WHERE physical_quantity < 0) THEN
    ALTER TABLE inventory_audit_line_items VALIDATE CONSTRAINT audit_line_physical_qty_nonneg;
  ELSE
    RAISE NOTICE 'audit_line_physical_qty_nonneg left NOT VALID: negative counts exist';
  END IF;
END $$;


-- ================================================================
-- 3. INVOICES
-- ================================================================

-- ----------------------------------------------------------------
-- 3.1 Payment-derived status (single definition). Same rule as
--     invoices_with_payment_status and the app: paid when the active
--     payments cover grand_total within Rs 0.05, partially_paid when
--     anything is paid, else finalized. SECURITY INVOKER and not
--     executable by clients (only called by owner-run triggers).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_derived_payment_status(p_invoice_id uuid)
RETURNS invoice_status
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE
           WHEN x.paid > 0 AND i.grand_total - x.paid <= 0.05 THEN 'paid'::invoice_status
           WHEN x.paid > 0 THEN 'partially_paid'::invoice_status
           ELSE 'finalized'::invoice_status
         END
  FROM invoices i
  CROSS JOIN LATERAL (
    SELECT ROUND(COALESCE(SUM(p.amount), 0), 2) AS paid
    FROM payments p
    WHERE p.invoice_id = i.id AND p.is_active
  ) x
  WHERE i.id = p_invoice_id;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_derived_payment_status(uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- 3.2 enforce_invoice_integrity  (BEFORE INSERT OR UPDATE; the "aa_"
--     name makes it fire before generate_invoice_number,
--     prevent_invoice_modification, renumber_draft_invoice,
--     set_issued_at and snapshot_invoice_parties)
--   Client sessions:
--     INSERT  status must be draft; invoice_number / created_at /
--             totals / party snapshot are server-set (number by the
--             generator, totals from the items); number format must
--             be one of the four; client type must match the invoice
--             type (event -> event client, subscription -> corporate);
--             invoice date in range.
--     UPDATE  number, format, client, outlet, event, type,
--             subscription link and created_at never change; the
--             invoice date is locked once issued and range-checked when
--             it changes; snapshot columns of a draft are cleared (the
--             snapshot trigger re-takes them from the live client at
--             finalize, so they cannot be forged on the draft);
--             cancelling needs zero active payments; finalized <->
--             partially_paid <-> paid must equal the payment-derived
--             status (so the only working writer is the payments
--             trigger, and the app's own sync, which computes the same
--             value).
--   Every session: while the invoice is a draft (including the
--   draft -> finalized step) subtotal / tax_total / grand_total are
--   recomputed from invoice_items.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_invoice_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_client_type client_type;
  v_sub numeric(12,2);
  v_tax numeric(12,2);
  v_target invoice_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL THEN
      IF NEW.status IS DISTINCT FROM 'draft'::invoice_status THEN
        RAISE EXCEPTION 'New invoices must be created as draft (got %)', NEW.status;
      END IF;

      NEW.invoice_number := NULL;            -- generate_invoice_number assigns it
      NEW.invoice_number_format := NULLIF(NEW.invoice_number_format, '');
      IF NEW.invoice_number_format IS NOT NULL
         AND NEW.invoice_number_format NOT IN ('default', 'outlet_fy', 'outlet_short', 'fy_only') THEN
        RAISE EXCEPTION 'Unknown invoice number format "%"', NEW.invoice_number_format;
      END IF;

      NEW.created_at := now();
      NEW.subtotal := 0;                     -- recomputed from the items
      NEW.tax_total := 0;
      NEW.grand_total := 0;
      NEW.client_name_snap := NULL;
      NEW.client_gstin_snap := NULL;
      NEW.client_address_snap := NULL;
      NEW.client_gst_type_snap := NULL;
      NEW.supplier_gstin_snap := NULL;

      SELECT c.client_type INTO v_client_type FROM clients c WHERE c.id = NEW.client_id;
      IF NEW.invoice_type = 'event' AND v_client_type IS DISTINCT FROM 'event'::client_type THEN
        RAISE EXCEPTION 'Event invoices can only be issued to event clients';
      END IF;
      IF NEW.invoice_type = 'subscription' AND v_client_type IS DISTINCT FROM 'corporate'::client_type THEN
        RAISE EXCEPTION 'Subscription invoices can only be issued to corporate clients';
      END IF;

      IF NEW.issued_at IS NOT NULL
         AND ((NEW.issued_at AT TIME ZONE 'Asia/Kolkata')::date > v_today
              OR (NEW.issued_at AT TIME ZONE 'Asia/Kolkata')::date < DATE '2017-07-01') THEN
        RAISE EXCEPTION 'Invoice date must be between 2017-07-01 and today';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF v_uid IS NOT NULL THEN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice numbers are system-assigned and cannot be changed';
    END IF;

    IF NEW.invoice_number_format IS DISTINCT FROM OLD.invoice_number_format
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.outlet_id IS DISTINCT FROM OLD.outlet_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.invoice_type IS DISTINCT FROM OLD.invoice_type
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id THEN
      RAISE EXCEPTION 'The client, outlet, event, type and number format of an invoice are fixed when it is created';
    END IF;

    NEW.created_at := OLD.created_at;

    IF NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
      IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION 'The invoice date is locked once the invoice is issued';
      END IF;
      IF NEW.issued_at IS NOT NULL
         AND ((NEW.issued_at AT TIME ZONE 'Asia/Kolkata')::date > v_today
              OR (NEW.issued_at AT TIME ZONE 'Asia/Kolkata')::date < DATE '2017-07-01') THEN
        RAISE EXCEPTION 'Invoice date must be between 2017-07-01 and today';
      END IF;
    END IF;

    IF OLD.status = 'draft' THEN
      NEW.client_name_snap := NULL;
      NEW.client_gstin_snap := NULL;
      NEW.client_address_snap := NULL;
      NEW.client_gst_type_snap := NULL;
      NEW.supplier_gstin_snap := NULL;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'cancelled'
         AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = OLD.id AND p.is_active) THEN
        RAISE EXCEPTION 'Void all payments on this invoice before cancelling it';
      END IF;

      IF OLD.status IN ('finalized', 'partially_paid', 'paid')
         AND NEW.status IN ('finalized', 'partially_paid', 'paid') THEN
        v_target := invoice_derived_payment_status(OLD.id);
        IF NEW.status IS DISTINCT FROM v_target THEN
          RAISE EXCEPTION 'Invoice payment status follows its payments (expected %, got %)', v_target, NEW.status;
        END IF;
      END IF;
    END IF;
  END IF;

  IF OLD.status = 'draft' THEN
    SELECT COALESCE(SUM(ii.line_total), 0), COALESCE(SUM(ii.tax_amount), 0)
    INTO v_sub, v_tax
    FROM invoice_items ii
    WHERE ii.invoice_id = OLD.id;

    NEW.subtotal := v_sub;
    NEW.tax_total := v_tax;
    NEW.grand_total := v_sub + v_tax;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS aa_enforce_invoice_integrity ON invoices;
CREATE TRIGGER aa_enforce_invoice_integrity
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_integrity();

-- ----------------------------------------------------------------
-- 3.3 Draft header totals follow the items on every item write
--     (042 already restricts item writes to drafts and computes the
--     line amounts).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_invoice_totals_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.invoice_id;
  ELSE
    v_id := NEW.invoice_id;
  END IF;

  -- The BEFORE UPDATE trigger above recomputes the sums; this UPDATE
  -- just makes it run. A cascade from a deleted draft finds no row.
  UPDATE invoices i
  SET subtotal = s.st, tax_total = s.tt, grand_total = s.st + s.tt
  FROM (
    SELECT COALESCE(SUM(ii.line_total), 0) AS st, COALESCE(SUM(ii.tax_amount), 0) AS tt
    FROM invoice_items ii
    WHERE ii.invoice_id = v_id
  ) s
  WHERE i.id = v_id
    AND i.status = 'draft'
    AND (i.subtotal, i.tax_total, i.grand_total) IS DISTINCT FROM (s.st, s.tt, s.st + s.tt);

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS sync_invoice_totals_from_items ON invoice_items;
CREATE TRIGGER sync_invoice_totals_from_items
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_totals_from_items();

-- ----------------------------------------------------------------
-- 3.4 Number format values (CHECK only if existing rows allow it;
--     otherwise listed and skipped, like 042 A7).
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'invoices_number_format_known'
               AND conrelid = 'public.invoices'::regclass) THEN
    RETURN;
  END IF;
  SELECT string_agg(DISTINCT quote_literal(invoice_number_format), ', ') INTO v_bad
  FROM invoices
  WHERE invoice_number_format IS NOT NULL
    AND invoice_number_format NOT IN ('default', 'outlet_fy', 'outlet_short', 'fy_only');
  IF v_bad IS NULL THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_number_format_known
      CHECK (invoice_number_format IS NULL
             OR invoice_number_format IN ('default', 'outlet_fy', 'outlet_short', 'fy_only'));
  ELSE
    RAISE NOTICE 'SKIPPED invoices_number_format_known: unknown formats in use: %', v_bad;
  END IF;
END $$;


-- ================================================================
-- 4. PAYMENTS
-- ================================================================

-- ----------------------------------------------------------------
-- 4.1 Void trail
-- ----------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES user_profiles(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason text;

-- ----------------------------------------------------------------
-- 4.2 enforce_payment_integrity (BEFORE INSERT OR UPDATE)
--   Client sessions:
--     INSERT  created_at = now(), active, no void data; payment date
--             not before the invoice date (IST).
--     UPDATE  a voided payment never changes again (no reactivation);
--             an active payment may only be voided: is_active
--             true -> false by an active admin/manager, which stamps
--             voided_at / voided_by and keeps an optional void_reason.
--             amount, date, method, invoice, reference, notes and
--             created_at are frozen for everyone -- corrections are
--             void + re-record.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_payment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_issued timestamptz;
  v_fixed text[] := ARRAY['is_active', 'void_reason', 'voided_at', 'voided_by', 'updated_at', 'created_by'];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.is_active := true;
    NEW.voided_at := NULL;
    NEW.voided_by := NULL;
    NEW.void_reason := NULL;

    SELECT i.issued_at INTO v_issued FROM invoices i WHERE i.id = NEW.invoice_id;
    IF v_issued IS NOT NULL
       AND NEW.payment_date < (v_issued AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'Payment date cannot be before the invoice date';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT OLD.is_active THEN
    IF (to_jsonb(NEW) - 'updated_at' - 'created_by') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'created_by') THEN
      RAISE EXCEPTION 'A voided payment cannot be changed or reactivated. Record a new payment instead.';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_fixed) IS DISTINCT FROM (to_jsonb(OLD) - v_fixed) THEN
    RAISE EXCEPTION 'Payments cannot be edited. Void this payment and record a new one instead.';
  END IF;

  IF NOT NEW.is_active THEN
    IF current_user_role() NOT IN ('admin'::user_role, 'manager'::user_role)
       OR NOT COALESCE(current_user_is_active(), false) THEN
      RAISE EXCEPTION 'Only active admins and managers can void payments';
    END IF;
    NEW.voided_at := now();
    NEW.voided_by := auth.uid();
    NEW.void_reason := NULLIF(btrim(NEW.void_reason), '');
  ELSIF NEW.void_reason IS DISTINCT FROM OLD.void_reason
        OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
        OR NEW.voided_by IS DISTINCT FROM OLD.voided_by THEN
    RAISE EXCEPTION 'Void details are recorded only when a payment is voided';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS aa_enforce_payment_integrity ON payments;
CREATE TRIGGER aa_enforce_payment_integrity
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_payment_integrity();

-- ----------------------------------------------------------------
-- 4.3 Invoice status follows the payments, in the payment's own
--     transaction (was: a separate browser request after the
--     payment, which could fail, race, or be skipped). Row lock
--     first, then a fresh read of the sum. The app's
--     syncInvoicePaymentStatus becomes a no-op (same target).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_invoice_status_from_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_status invoice_status;
  v_target invoice_status;
BEGIN
  v_ids := ARRAY[NEW.invoice_id];
  IF TG_OP = 'UPDATE' THEN
    IF OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
      v_ids := v_ids || OLD.invoice_id;
    END IF;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT i.status INTO v_status FROM invoices i WHERE i.id = v_id FOR UPDATE;
    CONTINUE WHEN NOT FOUND;
    CONTINUE WHEN v_status NOT IN ('finalized', 'partially_paid', 'paid');

    v_target := invoice_derived_payment_status(v_id);
    IF v_target IS DISTINCT FROM v_status THEN
      UPDATE invoices SET status = v_target WHERE id = v_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS sync_invoice_status_from_payments ON payments;
CREATE TRIGGER sync_invoice_status_from_payments
  AFTER INSERT OR UPDATE OF is_active, amount, invoice_id ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_status_from_payments();

-- ----------------------------------------------------------------
-- 4.4 One-time repair: issued invoices whose status disagrees with
--     their payments. Cancelled invoices that still carry active
--     payments are only listed (they need a human decision).
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_n integer;
  v_list text;
BEGIN
  UPDATE invoices i
  SET status = invoice_derived_payment_status(i.id)
  WHERE i.status IN ('finalized', 'partially_paid', 'paid')
    AND i.status IS DISTINCT FROM invoice_derived_payment_status(i.id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Invoice status repaired from payments on % invoice(s)', v_n;

  SELECT string_agg(DISTINCT i.invoice_number, ', ') INTO v_list
  FROM invoices i
  JOIN payments p ON p.invoice_id = i.id AND p.is_active
  WHERE i.status = 'cancelled';
  IF v_list IS NOT NULL THEN
    RAISE NOTICE 'CHECK BY HAND: cancelled invoices with active payments: %', v_list;
  END IF;
END $$;


-- ================================================================
-- 5. EVENTS + SUBSCRIPTIONS (what 042 E1/E3 do not cover)
-- ================================================================

-- ----------------------------------------------------------------
-- 5.1 Events: created as planned; once completed/cancelled, the
--     invoiced facts (name, type, date, guests, client, outlet) are
--     frozen (notes stay editable). 042 E1 already restricts status
--     changes to planned -> completed | cancelled.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_event_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'planned'::event_status THEN
      RAISE EXCEPTION 'New events must start as planned';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'planned'
     AND (NEW.event_name, NEW.event_type, NEW.event_date, NEW.guest_count, NEW.client_id, NEW.outlet_id)
         IS DISTINCT FROM
         (OLD.event_name, OLD.event_type, OLD.event_date, OLD.guest_count, OLD.client_id, OLD.outlet_id) THEN
    RAISE EXCEPTION 'Only planned events can be edited (this one is %)', OLD.status;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_event_integrity ON events;
CREATE TRIGGER enforce_event_integrity
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_event_integrity();

-- ----------------------------------------------------------------
-- 5.2 Subscriptions (mirrors subscriptionService, now enforced):
--     INSERT  active, no end date; non-admins cannot back-date.
--     UPDATE  end_date only set when cancelling; start_date admin
--             only; a price change needs a reason and is refused once
--             finalized subscription invoices exist for the client
--             since the subscription was created (same predicate as
--             isSubscriptionPriceLocked); non-admins cannot set
--             next_billing_date except with a cycle/billing-day change
--             or on resume.
--     The name sorts before trg_subscription_price_change, which
--     clears price_change_reason.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_subscription_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role user_role;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_role := current_user_role();

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'active'::subscription_status OR NEW.end_date IS NOT NULL THEN
      RAISE EXCEPTION 'New subscriptions must start active, without an end date';
    END IF;
    IF v_role IS DISTINCT FROM 'admin'::user_role AND NEW.start_date < v_today THEN
      RAISE EXCEPTION 'Managers cannot create subscriptions with past start dates';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' THEN
    RETURN NEW;   -- 042 enforce_subscription_lifecycle freezes cancelled rows
  END IF;

  IF NEW.end_date IS DISTINCT FROM OLD.end_date AND NEW.status IS DISTINCT FROM 'cancelled'::subscription_status THEN
    RAISE EXCEPTION 'The end date is set only when the subscription is cancelled';
  END IF;

  IF v_role IS DISTINCT FROM 'admin'::user_role AND NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'Only admins can change the start date';
  END IF;

  IF NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit THEN
    IF NULLIF(btrim(COALESCE(NEW.price_change_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Price change reason is required when updating the price';
    END IF;
    IF EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.client_id = OLD.client_id
        AND i.invoice_type = 'subscription'
        AND i.created_at >= OLD.created_at
        AND i.status IN ('finalized', 'partially_paid', 'paid')
    ) THEN
      RAISE EXCEPTION 'Cannot change price: finalized invoices exist for this client''s subscription billing';
    END IF;
  END IF;

  IF v_role IS DISTINCT FROM 'admin'::user_role
     AND NEW.next_billing_date IS DISTINCT FROM OLD.next_billing_date
     AND NEW.billing_cycle IS NOT DISTINCT FROM OLD.billing_cycle
     AND NEW.billing_day IS NOT DISTINCT FROM OLD.billing_day
     AND NOT (OLD.status = 'paused' AND NEW.status = 'active') THEN
    RAISE EXCEPTION 'The next billing date follows the billing schedule and cannot be set directly';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_subscription_rules ON subscriptions;
CREATE TRIGGER enforce_subscription_rules
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_rules();


-- ================================================================
-- 6. USERS
-- ================================================================

-- ----------------------------------------------------------------
-- 6.1 Own profile: deactivated users cannot update at all; a
--     non-admin can change only full_name and phone (record_login()
--     maintains last_login as the owner). Admin policy restated
--     TO authenticated (anon no longer needs EXECUTE on the helper).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile"
ON user_profiles FOR UPDATE TO authenticated
USING (id = auth.uid() AND COALESCE(current_user_is_active(), false))
WITH CHECK (
  id = auth.uid()
  AND role = current_user_role()
  AND is_active = current_user_is_active()
);

DROP POLICY IF EXISTS "admins_full_access_user_profiles" ON user_profiles;
CREATE POLICY "admins_full_access_user_profiles"
ON user_profiles FOR ALL TO authenticated
USING (
  current_user_role() = 'admin'::user_role
  AND current_user_is_active() = true
);

CREATE OR REPLACE FUNCTION guard_own_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- INVOKER on purpose: record_login() (owner) passes.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF current_user_role() = 'admin'::user_role AND COALESCE(current_user_is_active(), false) THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'full_name' - 'phone' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'full_name' - 'phone' - 'updated_at') THEN
    RAISE EXCEPTION 'You can only change your own name and phone number';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_own_profile_update ON user_profiles;
CREATE TRIGGER guard_own_profile_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_own_profile_update();

-- ----------------------------------------------------------------
-- 6.2 Admin invariants: never zero active admins; nobody deactivates
--     their own account. Serialized so two admins cannot deactivate
--     each other at the same time. Applies to SQL-editor sessions too
--     (the last-admin part).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_admin_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.id = auth.uid()
     AND OLD.is_active AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  IF OLD.role = 'admin' AND OLD.is_active
     AND (NEW.role IS DISTINCT FROM 'admin'::user_role OR NOT NEW.is_active) THEN
    PERFORM pg_advisory_xact_lock(hashtext('hybits_last_active_admin'));
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.role = 'admin' AND up.is_active AND up.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot deactivate or demote the last active admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_admin_invariants ON user_profiles;
CREATE TRIGGER enforce_admin_invariants
  BEFORE UPDATE OF role, is_active ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_admin_invariants();


-- ================================================================
-- 7. created_at IS NOT CLIENT-WRITABLE
--    INSERT from a client session: now(). UPDATE: always the old
--    value. (invoices, payments, inventory_items, inventory_movements
--    are handled by their own triggers above.)
-- ================================================================
CREATE OR REPLACE FUNCTION protect_created_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_at := now();
    END IF;
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$fn$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'subscriptions', 'events', 'outlets', 'user_profiles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aa_protect_created_at ON %I', t);
    EXECUTE format('CREATE TRIGGER aa_protect_created_at BEFORE INSERT OR UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION protect_created_at()', t);
  END LOOP;
END $$;


-- ================================================================
-- 8. PRIVILEGES
-- ================================================================

-- ----------------------------------------------------------------
-- 8.1 Unused SECURITY DEFINER settlement helpers (018): callable by
--     anon with any invoice id, bypassing RLS. Nothing in src/ or in
--     the schema calls them. Kept (in case of hand-written SQL), but
--     not executable by any API role, and invoker from now on.
-- ----------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.is_invoice_settled(uuid)',
                           'public.get_invoice_balance(uuid)',
                           'public.get_invoice_payment_status(uuid)'] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f);
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- 8.2 Every SECURITY DEFINER function in public:
--       * SET search_path = public, pg_temp
--       * no EXECUTE for PUBLIC / anon
--       * trigger functions: no EXECUTE for authenticated either
--         (triggers do not check EXECUTE)
--       * other functions keep EXECUTE for authenticated only if the
--         app calls them via rpc() or a policy / view / invoker
--         function uses them (they run as the querying user there);
--         otherwise revoked (e.g. audit_actor).
--     New invoker helpers / guards of this migration: no grants.
-- ----------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_keep boolean;
  v_kept text := '';
  v_revoked text := '';
  v_app_rpcs text[] := ARRAY['record_login', 'set_user_outlet_assignments',
                             'create_inventory_audit', 'submit_inventory_audit',
                             'approve_inventory_audit'];
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure::text AS sig, p.proname,
           (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
    ORDER BY p.proname
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);

      IF r.is_trigger THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
      ELSE
        v_keep := r.proname = ANY (v_app_rpcs)
          OR EXISTS (SELECT 1 FROM pg_policies pol
                     WHERE pol.schemaname = 'public'
                       AND (COALESCE(pol.qual, '') ~ ('\m' || r.proname || '\M')
                            OR COALESCE(pol.with_check, '') ~ ('\m' || r.proname || '\M')))
          OR EXISTS (SELECT 1 FROM pg_views v
                     WHERE v.schemaname = 'public'
                       AND v.definition ~ ('\m' || r.proname || '\M'))
          OR EXISTS (SELECT 1 FROM pg_proc q
                     JOIN pg_namespace qn ON qn.oid = q.pronamespace
                     WHERE qn.nspname = 'public'
                       AND NOT q.prosecdef
                       AND q.oid <> r.oid
                       AND q.prosrc ~ ('\m' || r.proname || '\M'));
        IF v_keep THEN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
          v_kept := v_kept || r.proname || ' ';
        ELSE
          EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
          v_revoked := v_revoked || r.proname || ' ';
        END IF;
      END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'SKIPPED % (not owned by the migration role)', r.sig;
    END;
  END LOOP;

  RAISE NOTICE 'SECURITY DEFINER callable by authenticated: %', NULLIF(v_kept, '');
  RAISE NOTICE 'SECURITY DEFINER no longer callable by authenticated: %', NULLIF(v_revoked, '');
END $$;

-- invoker functions added by this migration (triggers + helper)
REVOKE ALL ON FUNCTION guard_inventory_allocation_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_inventory_item_direct_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION force_movement_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_inventory_audit_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_inventory_audit_line_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_event_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guard_own_profile_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION protect_created_at() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- 8.3 PostgREST never issues TRUNCATE or CREATE TRIGGER; the API
--     roles do not need them (TRUNCATE skips RLS and row triggers).
-- ----------------------------------------------------------------
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

COMMIT;

-- ================================================================
-- Summary
-- 1 allocations SELECT-only (writes only from the ledger); item
--   quantities / outlet / opening-balance lock only via movements,
--   managers cannot delete items; movement created_by = auth.uid()
-- 2 audits: read + count-only line updates while counting/review;
--   status/approval only through the RPCs; delete only unsubmitted;
--   is_active everywhere
-- 3 invoices: created as draft; status derived from payments (DB
--   trigger + repair); cancel needs zero active payments; totals from
--   items; number/format/party/type/client/outlet/event/created_at
--   fixed; invoice date locked once issued and range-checked;
--   snapshot not forgeable; client type matches invoice type
-- 4 payments immutable except void (voided_at/by/reason), no
--   reactivation, payment date not before invoice date
-- 5 events start planned, frozen after planned; subscriptions start
--   active, no back-dating by managers, end/start/next-billing/price
--   rules
-- 6 own profile: name/phone only, active users only; last-admin and
--   self-deactivation guards
-- 7 created_at not client-writable
-- 8 definer functions: pinned search_path, no anon/PUBLIC EXECUTE,
--   authenticated only where used; settlement helpers locked;
--   no TRUNCATE/TRIGGER for API roles
-- ================================================================
