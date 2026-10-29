-- ================================================================
-- MIGRATION 042: CONFIRMED DB-LAYER BUG FIXES
-- ================================================================
-- One transaction. Paste the whole file into the Supabase SQL editor
-- AFTER 041. If any statement fails, nothing is applied.
--
-- No new enum values (no 042a/042b split needed).
--
-- Every function below starts from the LATEST definition of that
-- object in 001..041 (file named in each section). Bodies change;
-- names, argument lists and return shapes of existing RPCs do NOT.
-- Every view keeps its existing column names (and, for CREATE OR
-- REPLACE views, their order and types); new columns are appended.
--
-- NOTE ON 039 (do not edit 039): its closing comment says
--   "CREATE OR REPLACE keeps [security_invoker]". That is WRONG.
--   CREATE OR REPLACE VIEW replaces the view's reloptions with the
--   WITH (...) list it is given -- an omitted list clears them. 039
--   is safe only because every view there is followed by
--   ALTER VIEW ... SET (security_invoker = true). This migration
--   restates security_invoker after EVERY view it creates/replaces.
--
-- "Today" / dates: business dates are the IST calendar date,
--   (now() AT TIME ZONE 'Asia/Kolkata')::date, and timestamps are
--   bucketed into days with (ts AT TIME ZONE 'Asia/Kolkata')::date.
--   Date-only values the app stores as midnight UTC map to the same
--   IST date, so existing rows do not move.
--
-- SECTIONS
--   A  Invoices   (item/draft delete, amounts, numbering, rules,
--                  snapshot, subscription link)
--   B  Payments   (IST date rule, view column, summary RPC)
--   C  Reports    (fan-out, IST dates, GST split/rate/HSN, activity)
--   D  Inventory  (audit RPCs, movement validation, views, repair)
--   E  CRM        (event + subscription lifecycle, reclassification,
--                  price-history names)
--   F  Users      (record_login, outlet assignment RPC)
--
-- FRONTEND CONTRACTS DELIVERED (see MIGRATION_ORDER.md row 42)
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- 0. PREREQUISITES
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_role')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_is_active') THEN
    RAISE EXCEPTION 'Prerequisite missing: run 033 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_actor') THEN
    RAISE EXCEPTION 'Prerequisite missing: run 040 first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_movements' AND column_name = 'movement_category'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Prerequisite missing: run 035b first';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 0.1 Shared helper: display name of a user, readable by any active
--     signed-in user. Non-admins can only SELECT their own
--     user_profiles row, so views that JOINed user_profiles showed
--     blank names (or, with an INNER JOIN, dropped rows entirely).
--     Exposes only full_name.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_display_name(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT up.full_name
  FROM user_profiles up
  WHERE up.id = p_id
    AND COALESCE(current_user_is_active(), false);
$fn$;

REVOKE ALL ON FUNCTION public.user_display_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_display_name(uuid) TO authenticated;

-- ----------------------------------------------------------------
-- 0.2 Shared helper: is an adjustment reason a DECREASE?
--     Single source of truth for update_inventory_quantities_v2,
--     validate_movement_v2 and the audit RPCs. Decided by reason_code
--     only -- never by free-text notes.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_adjustment_is_negative(p_reason text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(
    p_reason IN ('audit_shortage', 'missing_stock', 'count_correction_negative',
                 'unrecorded_damage', 'unrecorded_loss')
    OR p_reason LIKE '%negative%',
    false);
$fn$;


-- ================================================================
-- A. INVOICES
-- ================================================================

-- ----------------------------------------------------------------
-- A1. invoice_items: INSERT / UPDATE / DELETE only while the parent
--     invoice is a draft -- for everyone (trigger, not RLS).
--     DELETE was blocked outright by 023, so editing any draft with
--     line items failed; INSERT/UPDATE were allowed even on issued
--     invoices. Same delete trigger (block_invoice_item_delete) with
--     a new body, plus a new write guard.
--     If the parent row is already gone, this is the ON DELETE
--     CASCADE from a draft-invoice delete that A2 already allowed.
--     SECURITY DEFINER so "parent not found" can only mean deleted,
--     never "hidden by RLS".
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_invoice_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_status invoice_status;
BEGIN
  SELECT i.status INTO v_status
  FROM invoices i
  WHERE i.id = OLD.invoice_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN OLD;  -- cascade from an allowed draft-invoice delete
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Invoice items cannot be deleted once the invoice is %. Only draft invoices can be edited.', v_status;
  END IF;

  RETURN OLD;
END;
$fn$;

REVOKE ALL ON FUNCTION prevent_invoice_item_delete() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION guard_invoice_item_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_status invoice_status;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'An invoice item cannot be moved to another invoice';
  END IF;

  SELECT i.status INTO v_status
  FROM invoices i
  WHERE i.id = NEW.invoice_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % does not exist', NEW.invoice_id;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Invoice items can only be added or changed while the invoice is a draft (status: %)', v_status;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION guard_invoice_item_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_invoice_item_write_trigger ON invoice_items;
CREATE TRIGGER guard_invoice_item_write_trigger
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION guard_invoice_item_write();

-- ----------------------------------------------------------------
-- A2. invoices: DELETE allowed only for a draft with no payments
--     (create-rollback). Everything else stays undeletable.
--     Managers had no DELETE policy at all, so their rollback
--     silently deleted 0 rows: add one, limited to drafts in their
--     assigned outlets. Admins already have FOR ALL.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_invoice_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.status = 'draft'
     AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = OLD.id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Invoices cannot be deleted. They are legal GST documents. Use void, cancel, or credit note functionality instead. (Only an unpaid draft can be discarded.)';
END;
$fn$;

REVOKE ALL ON FUNCTION prevent_invoice_delete() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "managers_delete_own_outlet_draft_invoices" ON invoices;
CREATE POLICY "managers_delete_own_outlet_draft_invoices"
ON invoices FOR DELETE TO authenticated
USING (
  current_user_role() = 'manager'::user_role
  AND current_user_is_active() = true
  AND status = 'draft'
  AND outlet_id IN (
    SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
  )
  -- No payments sub-query here: payments' RLS policies read invoices,
  -- so referencing payments from an invoices policy is "infinite
  -- recursion detected in policy for relation invoices" on EVERY
  -- invoice DELETE (admins too -- all DELETE policies are expanded).
  -- The "no payments" rule is enforced by prevent_invoice_delete()
  -- (SECURITY DEFINER), which raises instead of deleting 0 rows.
);

-- ----------------------------------------------------------------
-- A3. invoice_items amounts are computed by the DB.
--     The CHECKs (014/017) require exact numeric ROUND; the browser
--     used binary floats and sometimes disagreed by a paisa, so the
--     INSERT failed. BEFORE triggers run before CHECKs, so a
--     client value can no longer trip them.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_invoice_item_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.line_total := ROUND(NEW.quantity * NEW.unit_price, 2);
  NEW.tax_amount := ROUND(NEW.line_total * (NEW.tax_rate / 100.0), 2);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS compute_invoice_item_amounts_trigger ON invoice_items;
CREATE TRIGGER compute_invoice_item_amounts_trigger
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_invoice_item_amounts();

-- ----------------------------------------------------------------
-- A4. INVOICE NUMBERING   (latest: 038 generate_invoice_number)
-- ----------------------------------------------------------------
-- Bugs fixed:
--   * The scan ran under the caller's RLS: a manager could not see
--     other outlets' numbers, so the global 'default' and 'fy_only'
--     counters collided. -> sequences are computed in a SECURITY
--     DEFINER helper (owner sees every row).
--   * 'outlet_short' (INV-<CODE>-NNNN) restarted every day although
--     the number has no date in it -> day 2 always collided.
--     DECISION: it is now ONE running counter per outlet that never
--     resets (matches its documented shape "INV-OUTLET-NNNN"; no
--     visible format change; existing numbers are continued).
--   * LPAD(seq, 4) truncated 5-digit counters ('10000' -> '1000').
--     -> pad to at least 4, never truncate.
--   * LIKE prefix || '%' treated '_' / '%' in outlet codes as
--     wildcards and broke on non-numeric tails. -> exact left()
--     prefix match + numeric-tail regex; no LIKE at all.
--   * Legacy floor (029): the old system's 30 invoices belong to the
--     single legacy series of FY 2025-26. The floor (next = 0031) now
--     applies to the all-time counters ('default', 'outlet_short')
--     exactly as before, and to the FY-based formats ONLY for FY
--     2025-26. Any other FY (new FYs, back-dated FYs) starts at 0001.
--     Existing series already above 30 are unaffected.
--   * The date / FY segment followed the UTC calendar; now IST.
--     The date filters inside the FY scans were dropped: the prefix
--     already contains the FY, and the filter could hide rows.
--   * Advisory lock from 036 kept (same key), so concurrent inserts
--     still serialize.
--   * A draft whose date changes into another day/FY now gets a new
--     number for the new date (only if its current number's prefix
--     no longer matches). Numbering follows the invoice's own date
--     (038). Finalized numbers never change (prevent_invoice_modification).

CREATE OR REPLACE FUNCTION public.invoice_number_prefix(
  p_format text,
  p_outlet_id uuid,
  p_invoice_date timestamptz
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_fmt text := COALESCE(NULLIF(p_format, ''), 'default');
  v_local timestamp := COALESCE(p_invoice_date, now()) AT TIME ZONE 'Asia/Kolkata';
  v_fy_start integer;
  v_fy text;
  v_code text;
BEGIN
  v_fy_start := CASE WHEN EXTRACT(MONTH FROM v_local) >= 4
                     THEN EXTRACT(YEAR FROM v_local)::integer
                     ELSE EXTRACT(YEAR FROM v_local)::integer - 1 END;
  v_fy := v_fy_start::text || '-' || lpad(((v_fy_start + 1) % 100)::text, 2, '0');

  IF v_fmt IN ('outlet_fy', 'outlet_short') THEN
    SELECT o.code INTO v_code FROM outlets o WHERE o.id = p_outlet_id;
    v_code := COALESCE(v_code, 'UNKNOWN');
  END IF;

  RETURN CASE v_fmt
    WHEN 'outlet_fy'    THEN 'INV/' || v_code || '/' || v_fy || '/'
    WHEN 'outlet_short' THEN 'INV-' || v_code || '-'
    WHEN 'fy_only'      THEN 'INV/' || v_fy || '/'
    ELSE                     'INV-' || to_char(v_local, 'YYYYMMDD') || '-'
  END;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.next_invoice_number(
  p_format text,
  p_outlet_id uuid,
  p_invoice_date timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_fmt text := COALESCE(NULLIF(p_format, ''), 'default');
  v_prefix text;
  v_plen integer;
  v_floor bigint;
  v_seq bigint;
BEGIN
  -- Same key as 036: serializes every number allocation.
  PERFORM pg_advisory_xact_lock(hashtext('hybits_generate_invoice_number'));

  v_prefix := invoice_number_prefix(v_fmt, p_outlet_id, p_invoice_date);
  v_plen := length(v_prefix);

  IF v_fmt IN ('outlet_fy', 'outlet_short', 'fy_only') THEN
    -- Legacy floor: all-time per-outlet counter keeps it; FY formats
    -- only for FY 2025-26 (the legacy system's FY).
    v_floor := CASE
      WHEN v_fmt = 'outlet_short' THEN 30
      WHEN v_prefix LIKE '%/2025-26/' THEN 30
      ELSE 0
    END;

    SELECT MAX(substr(i.invoice_number, v_plen + 1)::bigint)
    INTO v_seq
    FROM invoices i
    WHERE left(i.invoice_number, v_plen) = v_prefix
      AND substr(i.invoice_number, v_plen + 1) ~ '^[0-9]{1,15}$';
  ELSE
    -- 'default': INV-YYYYMMDD-NNNN, one global running counter
    -- (as 029/036/038); only the date part follows the invoice date.
    v_floor := 30;

    SELECT MAX((substring(i.invoice_number FROM '^INV-[0-9]{8}-([0-9]{1,15})$'))::bigint)
    INTO v_seq
    FROM invoices i
    WHERE i.invoice_number ~ '^INV-[0-9]{8}-[0-9]{1,15}$';
  END IF;

  v_seq := GREATEST(COALESCE(v_seq, 0), v_floor) + 1;

  RETURN v_prefix || lpad(v_seq::text, GREATEST(4, length(v_seq::text)), '0');
END;
$fn$;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- An explicitly supplied number is kept (locked numbers).
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN
    RETURN NEW;
  END IF;

  NEW.invoice_number := next_invoice_number(
    NEW.invoice_number_format, NEW.outlet_id, COALESCE(NEW.issued_at, now()));
  RETURN NEW;
END;
$fn$;

-- Renumber a DRAFT whose invoice date moved into another day / FY.
CREATE OR REPLACE FUNCTION renumber_draft_invoice_on_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_prefix text;
BEGIN
  IF OLD.status = 'draft'
     AND NEW.issued_at IS DISTINCT FROM OLD.issued_at
     AND NEW.invoice_number IS NOT DISTINCT FROM OLD.invoice_number THEN
    v_prefix := invoice_number_prefix(
      NEW.invoice_number_format, NEW.outlet_id, COALESCE(NEW.issued_at, now()));
    IF left(NEW.invoice_number, length(v_prefix)) <> v_prefix THEN
      NEW.invoice_number := next_invoice_number(
        NEW.invoice_number_format, NEW.outlet_id, COALESCE(NEW.issued_at, now()));
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS renumber_draft_invoice_trigger ON invoices;
CREATE TRIGGER renumber_draft_invoice_trigger
  BEFORE UPDATE OF issued_at ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION renumber_draft_invoice_on_date_change();

-- None of these are called by the app directly. Trigger firing does
-- not check EXECUTE; the definer functions run as the owner.
REVOKE ALL ON FUNCTION public.invoice_number_prefix(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION generate_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION renumber_draft_invoice_on_date_change() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- A5. invoices.subscription_id (nullable link; no backfill)
-- ----------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id
  ON invoices(subscription_id) WHERE subscription_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'invoices_subscription_ref_type'
                   AND conrelid = 'public.invoices'::regclass) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_subscription_ref_type
      CHECK (subscription_id IS NULL OR invoice_type = 'subscription');
  END IF;
END $$;

-- ----------------------------------------------------------------
-- A6. validate_invoice_business_rules   (latest: 005)
--     * Event invoices: the event's client must be the invoice's
--       client (was only checked in the browser).
--     * subscription_id (A5) must be the same client and outlet.
--     * Client/event checks run on INSERT or when a referenced column
--       changes. They used to re-run on every UPDATE, so an event
--       moved off 'completed' (or a client moved) froze its invoice:
--       even the payment-status sync and cancellation failed.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_invoice_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  client_outlet_id uuid;
  event_outlet_id uuid;
  event_client_id uuid;
  event_status_val event_status;
  sub_client_id uuid;
  sub_outlet_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NEW.outlet_id IS NOT DISTINCT FROM OLD.outlet_id
     AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
     AND NEW.invoice_type IS NOT DISTINCT FROM OLD.invoice_type
     AND NEW.subscription_id IS NOT DISTINCT FROM OLD.subscription_id THEN
    RETURN NEW;
  END IF;

  SELECT outlet_id INTO client_outlet_id
  FROM clients
  WHERE id = NEW.client_id;

  IF client_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Client does not exist';
  END IF;

  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet';
  END IF;

  IF NEW.invoice_type = 'event' THEN
    IF NEW.event_id IS NULL THEN
      RAISE EXCEPTION 'Event invoices must have an event_id';
    END IF;

    SELECT outlet_id, client_id, status
    INTO event_outlet_id, event_client_id, event_status_val
    FROM events
    WHERE id = NEW.event_id;

    IF event_outlet_id IS NULL THEN
      RAISE EXCEPTION 'Event does not exist';
    END IF;

    IF event_outlet_id != NEW.outlet_id THEN
      RAISE EXCEPTION 'Event does not belong to selected outlet';
    END IF;

    IF event_client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Event does not belong to selected client';
    END IF;

    -- Only when the event is (re)attached; an already-issued invoice
    -- must stay updatable whatever happens to the event later.
    IF (TG_OP = 'INSERT' OR NEW.event_id IS DISTINCT FROM OLD.event_id)
       AND event_status_val != 'completed' THEN
      RAISE EXCEPTION 'Only completed events can be invoiced. Event status: %', event_status_val;
    END IF;
  END IF;

  IF NEW.invoice_type = 'subscription' AND NEW.event_id IS NOT NULL THEN
    RAISE EXCEPTION 'Subscription invoices cannot have an event_id';
  END IF;

  IF NEW.subscription_id IS NOT NULL THEN
    SELECT client_id, outlet_id INTO sub_client_id, sub_outlet_id
    FROM subscriptions
    WHERE id = NEW.subscription_id;

    IF sub_client_id IS NULL THEN
      RAISE EXCEPTION 'Subscription does not exist';
    END IF;
    IF sub_client_id <> NEW.client_id OR sub_outlet_id <> NEW.outlet_id THEN
      RAISE EXCEPTION 'Subscription does not belong to the selected client/outlet';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- A7. One live invoice per event.
--     Created only if existing data allows it; otherwise the
--     duplicates are listed in a NOTICE and the index is skipped
--     (resolve them, then re-run this block).
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_dupes text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'invoices_one_live_invoice_per_event') THEN
    RETURN;
  END IF;

  SELECT string_agg(event_id::text || ' (' || n || ')', ', ')
  INTO v_dupes
  FROM (
    SELECT event_id, count(*) AS n
    FROM invoices
    WHERE event_id IS NOT NULL AND status <> 'cancelled'
    GROUP BY event_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes IS NULL THEN
    CREATE UNIQUE INDEX invoices_one_live_invoice_per_event
      ON invoices(event_id)
      WHERE event_id IS NOT NULL AND status <> 'cancelled';
  ELSE
    RAISE NOTICE 'SKIPPED invoices_one_live_invoice_per_event: events already invoiced more than once: %', v_dupes;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- A8. validate_invoice_status_transition   (latest: 034)
--     Same transition map, plus: a draft with no line items cannot
--     be finalized (an orphan from a failed create could otherwise
--     become a tax invoice with no lines).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'          AND NEW.status IN ('finalized', 'cancelled')) OR
    (OLD.status = 'finalized'      AND NEW.status IN ('partially_paid', 'paid', 'cancelled')) OR
    (OLD.status = 'partially_paid' AND NEW.status IN ('paid', 'finalized')) OR
    (OLD.status = 'paid'           AND NEW.status IN ('partially_paid', 'finalized'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % → %. Not allowed.', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'finalized'
     AND NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot finalize an invoice with no line items';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- A9. PARTY SNAPSHOT
--     Finalized invoices printed and filed (GST sheets) the LIVE
--     client name/GSTIN/address/GST type, so editing a client
--     rewrote issued invoices and could move them between sheets.
--     Snapshot at draft -> finalized; frozen afterwards.
--     Columns (names the app reads): client_name_snap,
--     client_gstin_snap, client_address_snap, client_gst_type_snap,
--     supplier_gstin_snap (= outlets.gstin at finalize; NULL if the
--     outlet has none -- the app then falls back to the company GSTIN).
--     Backfill: already-issued invoices get the CURRENT client/outlet
--     values (exactly what they display today). gst_type NULL is
--     stored as 'domestic' (the domestic sheet treats NULL that way).
-- ----------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_name_snap text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_gstin_snap text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_address_snap text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_gst_type_snap client_gst_type;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_gstin_snap text;

-- Backfill with invoice triggers off: these rows are finalized, so
-- prevent_invoice_modification would (correctly) refuse, and
-- updated_at must not move. Idempotent (only NULL snapshots).
ALTER TABLE invoices DISABLE TRIGGER USER;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE invoices i
  SET client_name_snap     = c.name,
      client_gstin_snap    = c.gstin,
      client_address_snap  = c.billing_address,
      client_gst_type_snap = COALESCE(c.gst_type, 'domestic'),
      supplier_gstin_snap  = o.gstin
  FROM clients c, outlets o
  WHERE c.id = i.client_id
    AND o.id = i.outlet_id
    AND i.status IN ('finalized', 'partially_paid', 'paid')
    AND i.client_name_snap IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Party snapshot backfilled on % issued invoice(s)', v_n;
END $$;

ALTER TABLE invoices ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION snapshot_invoice_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.status IN ('finalized', 'partially_paid', 'paid')
     AND NEW.client_name_snap IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    SELECT c.name, c.gstin, c.billing_address, COALESCE(c.gst_type, 'domestic')
    INTO NEW.client_name_snap, NEW.client_gstin_snap, NEW.client_address_snap, NEW.client_gst_type_snap
    FROM clients c
    WHERE c.id = NEW.client_id;

    SELECT o.gstin INTO NEW.supplier_gstin_snap
    FROM outlets o
    WHERE o.id = NEW.outlet_id;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION snapshot_invoice_parties() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS snapshot_invoice_parties_trigger ON invoices;
CREATE TRIGGER snapshot_invoice_parties_trigger
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_invoice_parties();

-- prevent_invoice_modification   (latest: 030b) + the new columns
CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be modified';
  END IF;

  IF OLD.status IN ('finalized', 'partially_paid', 'paid') THEN
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
       OLD.tax_total IS DISTINCT FROM NEW.tax_total OR
       OLD.grand_total IS DISTINCT FROM NEW.grand_total OR
       OLD.terms_and_conditions IS DISTINCT FROM NEW.terms_and_conditions OR
       OLD.invoice_number IS DISTINCT FROM NEW.invoice_number OR
       OLD.invoice_number_format IS DISTINCT FROM NEW.invoice_number_format OR
       OLD.client_id IS DISTINCT FROM NEW.client_id OR
       OLD.outlet_id IS DISTINCT FROM NEW.outlet_id OR
       OLD.event_id IS DISTINCT FROM NEW.event_id OR
       OLD.invoice_type IS DISTINCT FROM NEW.invoice_type OR
       OLD.subscription_id IS DISTINCT FROM NEW.subscription_id OR
       OLD.client_name_snap IS DISTINCT FROM NEW.client_name_snap OR
       OLD.client_gstin_snap IS DISTINCT FROM NEW.client_gstin_snap OR
       OLD.client_address_snap IS DISTINCT FROM NEW.client_address_snap OR
       OLD.client_gst_type_snap IS DISTINCT FROM NEW.client_gst_type_snap OR
       OLD.supplier_gstin_snap IS DISTINCT FROM NEW.supplier_gstin_snap THEN
      RAISE EXCEPTION 'Only draft invoices can be edited. Current status: %', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- B. PAYMENTS
-- ================================================================

-- ----------------------------------------------------------------
-- B1. payment_date <= today, in IST.
--     006's CHECK (payment_date <= CURRENT_DATE) used the UTC date,
--     rejecting today's payments between 00:00 and 05:30 IST.
--     A CHECK cannot use now(), so it becomes a trigger. On UPDATE it
--     only re-checks when payment_date actually changes.
-- ----------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_date%CURRENT_DATE%'
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION validate_payment_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_date IS NOT DISTINCT FROM OLD.payment_date THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS validate_payment_date_trigger ON payments;
CREATE TRIGGER validate_payment_date_trigger
  BEFORE INSERT OR UPDATE OF payment_date ON payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_date();

-- ----------------------------------------------------------------
-- B2. payments_with_details   (latest: 016)
--     + outlet_id (the invoice's outlet) appended at the END.
--     recorded_by_name now resolves for non-admins too (was a
--     user_profiles join that RLS blanked); same name and type.
--     payments has had no new columns since 006, so p.* expands to
--     the same leading columns as in 016.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW payments_with_details AS
SELECT
  p.*,
  i.invoice_number,
  i.invoice_type,
  i.grand_total AS invoice_total,
  i.status AS invoice_status,
  c.name AS client_name,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  user_display_name(p.created_by) AS recorded_by_name,
  i.outlet_id AS outlet_id
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id;

ALTER VIEW payments_with_details SET (security_invoker = true);

-- ----------------------------------------------------------------
-- B3. payments_summary(...)  -- server-side totals for the Payments
--     page cards (the browser summed a list capped at 1000 rows).
--     SECURITY INVOKER: RLS on payments/invoices scopes it exactly
--     like the list. NULL argument = no filter. Voids are
--     payments.is_active = false.
--       total_*      active payments matching date range/method/outlet
--       voided_count voided payments matching the same filters
--       today_*      active payments dated p_today (default: IST
--                    today) matching method/outlet, ignoring the range
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_summary(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_method payment_method DEFAULT NULL,
  p_outlet uuid DEFAULT NULL,
  p_today date DEFAULT NULL
)
RETURNS TABLE (
  total_amount numeric,
  total_count bigint,
  today_amount numeric,
  today_count bigint,
  voided_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  WITH f AS (
    SELECT
      p.amount,
      p.is_active,
      p.payment_date,
      ((p_date_from IS NULL OR p.payment_date >= p_date_from)
       AND (p_date_to IS NULL OR p.payment_date <= p_date_to)) AS in_range,
      (p.payment_date = COALESCE(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date)) AS is_today
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE (p_method IS NULL OR p.payment_method = p_method)
      AND (p_outlet IS NULL OR i.outlet_id = p_outlet)
  )
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE is_active AND in_range), 0)::numeric,
    COUNT(*) FILTER (WHERE is_active AND in_range),
    COALESCE(SUM(amount) FILTER (WHERE is_active AND is_today), 0)::numeric,
    COUNT(*) FILTER (WHERE is_active AND is_today),
    COUNT(*) FILTER (WHERE NOT is_active AND in_range)
  FROM f;
$fn$;

REVOKE ALL ON FUNCTION public.payments_summary(date, date, payment_method, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payments_summary(date, date, payment_method, uuid, date) TO authenticated;


-- ================================================================
-- C. REPORT + GST VIEWS
-- ================================================================
-- Views without dependents are DROPped and re-CREATEd (immune to
-- column type drift); gst_working_* have *_totals dependents so they
-- use CREATE OR REPLACE with identical leading columns/types.

-- ----------------------------------------------------------------
-- C1. report_revenue_daily / report_outstanding_aging  (latest: 039)
--     Day buckets and "today" in IST (was UTC DATE()/CURRENT_DATE:
--     off by a day between 00:00 and 05:30 IST).
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS report_revenue_daily;
CREATE VIEW report_revenue_daily WITH (security_invoker = true) AS
SELECT
  (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS report_date,
  i.outlet_id,
  o.name AS outlet_name,
  i.invoice_type,
  COUNT(i.id) AS invoice_count,
  SUM(i.grand_total) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding
FROM invoices i
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
GROUP BY (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date, i.outlet_id, o.name, i.invoice_type
ORDER BY report_date DESC, outlet_name;
ALTER VIEW report_revenue_daily SET (security_invoker = true);
GRANT SELECT ON report_revenue_daily TO authenticated;

DROP VIEW IF EXISTS report_outstanding_aging;
CREATE VIEW report_outstanding_aging WITH (security_invoker = true) AS
SELECT
  x.invoice_id, x.invoice_number, x.invoice_type, x.invoice_date,
  x.grand_total, x.amount_paid, x.balance_due,
  x.client_id, x.client_name, x.client_phone,
  x.outlet_id, x.outlet_name, x.outlet_code,
  x.days_outstanding,
  CASE
    WHEN x.days_outstanding <= 30 THEN '0-30'
    WHEN x.days_outstanding <= 60 THEN '31-60'
    WHEN x.days_outstanding <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CASE
    WHEN x.days_outstanding <= 30 THEN 1
    WHEN x.days_outstanding <= 60 THEN 2
    WHEN x.days_outstanding <= 90 THEN 3
    ELSE 4
  END AS bucket_order
FROM (
  SELECT
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_type,
    (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS invoice_date,
    i.grand_total,
    p.amount_paid,
    p.balance_due,
    i.client_id,
    c.name AS client_name,
    c.phone AS client_phone,
    i.outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    (now() AT TIME ZONE 'Asia/Kolkata')::date
      - (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS days_outstanding
  FROM invoices i
  JOIN invoices_with_payment_status p ON i.id = p.id
  JOIN clients c ON i.client_id = c.id
  JOIN outlets o ON i.outlet_id = o.id
  WHERE i.status IN ('finalized', 'partially_paid', 'paid')
    AND i.issued_at IS NOT NULL
    AND p.balance_due > 0
) x
ORDER BY x.days_outstanding DESC, x.balance_due DESC;
ALTER VIEW report_outstanding_aging SET (security_invoker = true);
GRANT SELECT ON report_outstanding_aging TO authenticated;

-- ----------------------------------------------------------------
-- C2. report_client_revenue / report_outlet_performance (latest: 039)
--     FAN-OUT FIX: invoices, subscriptions, events (and clients) were
--     LEFT JOINed side by side, so every SUM was multiplied by the
--     other children's row counts. Each child is now aggregated per
--     key BEFORE joining. Same columns, same order.
--     MRR: weekly x 52/12 and daily x 365/12 (was 4.33 / 30, which
--     disagreed with annual_value's 52 / 365); inactive clients'
--     subscriptions excluded from MRR. Outlet client-type counts now
--     count active clients only (active_clients already did).
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS report_client_revenue;
CREATE VIEW report_client_revenue WITH (security_invoker = true) AS
WITH inv AS (
  SELECT
    i.client_id,
    COUNT(*) AS invoice_count,
    COUNT(*) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoice_count,
    COUNT(*) FILTER (WHERE i.invoice_type = 'event') AS event_invoice_count,
    SUM(i.grand_total) AS total_invoiced,
    SUM(p.amount_paid) AS total_collected,
    SUM(p.balance_due) AS outstanding,
    SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_revenue,
    SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'event') AS event_revenue
  FROM invoices i
  LEFT JOIN invoices_with_payment_status p ON p.id = i.id
  WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  GROUP BY i.client_id
),
sub AS (
  SELECT client_id, COUNT(*) FILTER (WHERE status = 'active') AS active_subscriptions
  FROM subscriptions
  GROUP BY client_id
),
ev AS (
  SELECT client_id, COUNT(*) FILTER (WHERE status = 'completed') AS completed_events
  FROM events
  GROUP BY client_id
)
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  c.email AS client_email,
  c.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  COALESCE(inv.invoice_count, 0) AS invoice_count,
  COALESCE(inv.subscription_invoice_count, 0) AS subscription_invoice_count,
  COALESCE(inv.event_invoice_count, 0) AS event_invoice_count,
  COALESCE(inv.total_invoiced, 0) AS total_invoiced,
  COALESCE(inv.total_collected, 0) AS total_collected,
  COALESCE(inv.outstanding, 0) AS outstanding,
  COALESCE(inv.subscription_revenue, 0) AS subscription_revenue,
  COALESCE(inv.event_revenue, 0) AS event_revenue,
  COALESCE(sub.active_subscriptions, 0) AS active_subscriptions,
  COALESCE(ev.completed_events, 0) AS completed_events
FROM clients c
JOIN outlets o ON c.outlet_id = o.id
LEFT JOIN inv ON inv.client_id = c.id
LEFT JOIN sub ON sub.client_id = c.id
LEFT JOIN ev ON ev.client_id = c.id
WHERE c.is_active = true
ORDER BY total_invoiced DESC;
ALTER VIEW report_client_revenue SET (security_invoker = true);
GRANT SELECT ON report_client_revenue TO authenticated;

DROP VIEW IF EXISTS report_outlet_performance;
CREATE VIEW report_outlet_performance WITH (security_invoker = true) AS
WITH cli AS (
  SELECT
    outlet_id,
    COUNT(*) FILTER (WHERE is_active) AS active_clients,
    COUNT(*) FILTER (WHERE is_active AND client_type = 'corporate') AS corporate_clients,
    COUNT(*) FILTER (WHERE is_active AND client_type = 'event') AS event_clients
  FROM clients
  GROUP BY outlet_id
),
inv AS (
  SELECT
    i.outlet_id,
    COUNT(*) AS total_invoices,
    COUNT(*) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoices,
    COUNT(*) FILTER (WHERE i.invoice_type = 'event') AS event_invoices,
    SUM(i.grand_total) AS total_invoiced,
    SUM(p.amount_paid) AS total_collected,
    SUM(p.balance_due) AS outstanding
  FROM invoices i
  LEFT JOIN invoices_with_payment_status p ON p.id = i.id
  WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  GROUP BY i.outlet_id
),
sub AS (
  SELECT
    s.outlet_id,
    COUNT(*) FILTER (WHERE s.status = 'active') AS active_subscriptions,
    COUNT(*) FILTER (WHERE s.status = 'paused') AS paused_subscriptions,
    COUNT(*) FILTER (WHERE s.status = 'cancelled') AS cancelled_subscriptions,
    SUM(
      CASE
        WHEN s.status <> 'active' OR NOT c.is_active THEN 0
        WHEN s.billing_cycle = 'monthly' THEN s.quantity * s.price_per_unit
        WHEN s.billing_cycle = 'weekly'  THEN s.quantity * s.price_per_unit * 52 / 12.0
        WHEN s.billing_cycle = 'daily'   THEN s.quantity * s.price_per_unit * 365 / 12.0
        ELSE 0
      END
    ) AS mrr
  FROM subscriptions s
  JOIN clients c ON c.id = s.client_id
  GROUP BY s.outlet_id
),
ev AS (
  SELECT
    outlet_id,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_events,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_events,
    COUNT(*) FILTER (WHERE status = 'planned') AS planned_events
  FROM events
  GROUP BY outlet_id
)
SELECT
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city,
  o.state,
  COALESCE(cli.active_clients, 0) AS active_clients,
  COALESCE(cli.corporate_clients, 0) AS corporate_clients,
  COALESCE(cli.event_clients, 0) AS event_clients,
  COALESCE(inv.total_invoices, 0) AS total_invoices,
  COALESCE(inv.subscription_invoices, 0) AS subscription_invoices,
  COALESCE(inv.event_invoices, 0) AS event_invoices,
  COALESCE(inv.total_invoiced, 0) AS total_invoiced,
  COALESCE(inv.total_collected, 0) AS total_collected,
  COALESCE(inv.outstanding, 0) AS outstanding,
  CASE
    WHEN COALESCE(inv.total_invoiced, 0) > 0
    THEN ROUND(COALESCE(inv.total_collected, 0) / inv.total_invoiced * 100, 2)
    ELSE 0
  END AS collection_rate_percent,
  COALESCE(sub.active_subscriptions, 0) AS active_subscriptions,
  COALESCE(sub.paused_subscriptions, 0) AS paused_subscriptions,
  COALESCE(sub.cancelled_subscriptions, 0) AS cancelled_subscriptions,
  ROUND(COALESCE(sub.mrr, 0), 2) AS mrr,
  COALESCE(ev.completed_events, 0) AS completed_events,
  COALESCE(ev.cancelled_events, 0) AS cancelled_events,
  COALESCE(ev.planned_events, 0) AS planned_events
FROM outlets o
LEFT JOIN cli ON cli.outlet_id = o.id
LEFT JOIN inv ON inv.outlet_id = o.id
LEFT JOIN sub ON sub.outlet_id = o.id
LEFT JOIN ev  ON ev.outlet_id = o.id
WHERE o.is_active = true
ORDER BY total_invoiced DESC;
ALTER VIEW report_outlet_performance SET (security_invoker = true);
GRANT SELECT ON report_outlet_performance TO authenticated;

-- ----------------------------------------------------------------
-- C3. report_payments_daily / report_subscription_mrr (latest: 016)
--     payments_daily was grouped per INVOICE, so the "daily" table
--     repeated date/outlet/method rows. Now one row per day x outlet
--     x method. invoice_id is KEPT for compatibility but is always
--     NULL (it cannot be meaningful on a per-day row).
--     subscription_mrr: same multipliers as annual_value; inactive
--     clients excluded.
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS report_payments_daily;
CREATE VIEW report_payments_daily WITH (security_invoker = true) AS
SELECT
  p.payment_date AS report_date,
  NULL::uuid AS invoice_id,
  i.outlet_id,
  o.name AS outlet_name,
  p.payment_method,
  COUNT(p.id) AS payment_count,
  SUM(p.amount) AS total_amount
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN outlets o ON i.outlet_id = o.id
WHERE p.is_active = true
GROUP BY p.payment_date, i.outlet_id, o.name, p.payment_method
ORDER BY report_date DESC, outlet_name, p.payment_method;
ALTER VIEW report_payments_daily SET (security_invoker = true);
GRANT SELECT ON report_payments_daily TO authenticated;

DROP VIEW IF EXISTS report_subscription_mrr;
CREATE VIEW report_subscription_mrr WITH (security_invoker = true) AS
SELECT
  s.id AS subscription_id,
  s.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  s.client_id,
  c.name AS client_name,
  s.billing_cycle,
  s.status,
  s.quantity,
  s.price_per_unit,
  s.start_date,
  s.next_billing_date,
  (s.quantity * s.price_per_unit) AS cycle_amount,
  ROUND(CASE
    WHEN s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit)
    WHEN s.billing_cycle = 'weekly'  THEN (s.quantity * s.price_per_unit * 52 / 12.0)
    WHEN s.billing_cycle = 'daily'   THEN (s.quantity * s.price_per_unit * 365 / 12.0)
  END, 2) AS mrr,
  CASE
    WHEN s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit * 12)
    WHEN s.billing_cycle = 'weekly'  THEN (s.quantity * s.price_per_unit * 52)
    WHEN s.billing_cycle = 'daily'   THEN (s.quantity * s.price_per_unit * 365)
  END AS annual_value
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN outlets o ON s.outlet_id = o.id
WHERE s.status = 'active'
  AND c.is_active = true
ORDER BY mrr DESC;
ALTER VIEW report_subscription_mrr SET (security_invoker = true);
GRANT SELECT ON report_subscription_mrr TO authenticated;

-- ----------------------------------------------------------------
-- C4. GST working sheets   (latest: 039)
--     * invoice_date in IST.
--     * party / GSTIN / sheet routing from the party snapshot (A9),
--       falling back to the live client for drafts-turned-legacy.
--     * Domestic: sgst = tax_total - cgst, so CGST + SGST = tax_total
--       exactly (both were ROUND(tax/2), over-totalling by Rs 0.01).
--     * rate: deterministic MAX(tax_rate) (was LIMIT 1, no ORDER BY).
--       Appended rate_label: distinct rates, ascending, e.g. '5% / 18%'.
--     * SEZ/Export: appended hsn_sac_code (same value as hsn_code;
--       the app reads hsn_sac_code). hsn_code kept.
--     Leading columns keep the exact names/order/types of 039 so the
--     *_totals views stay valid.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW gst_working_domestic AS
SELECT
  i.id AS invoice_id,
  (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS invoice_date,
  i.invoice_number,
  COALESCE(i.client_name_snap, c.name) AS party_name,
  COALESCE(i.client_gstin_snap, c.gstin, '') AS gst_number,
  '9985'::text AS hsn_sac_code,
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  COALESCE(
    (SELECT MAX(it.tax_rate) FROM invoice_items it WHERE it.invoice_id = i.id),
    0
  ) AS rate,
  0.00::numeric(12,2) AS igst,
  ROUND(i.tax_total / 2.0, 2) AS cgst,
  i.tax_total - ROUND(i.tax_total / 2.0, 2) AS sgst,
  i.grand_total AS total,
  i.outlet_id,
  o.name AS outlet_name,
  (SELECT string_agg(trim_scale(d.r)::text || '%', ' / ' ORDER BY d.r)
   FROM (SELECT DISTINCT it.tax_rate AS r FROM invoice_items it WHERE it.invoice_id = i.id) d
  ) AS rate_label
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND (COALESCE(i.client_gst_type_snap, c.gst_type) = 'domestic'
       OR COALESCE(i.client_gst_type_snap, c.gst_type) IS NULL)
ORDER BY i.issued_at DESC, i.invoice_number;
ALTER VIEW gst_working_domestic SET (security_invoker = true);

CREATE OR REPLACE VIEW gst_working_sez AS
SELECT
  i.id AS invoice_id,
  (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS invoice_date,
  i.invoice_number,
  COALESCE(i.client_name_snap, c.name) AS party_name,
  COALESCE(i.client_gstin_snap, c.gstin, '') AS gst_number,
  '9985'::text AS hsn_code,
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  COALESCE(
    (SELECT MAX(it.tax_rate) FROM invoice_items it WHERE it.invoice_id = i.id),
    0
  ) AS rate,
  i.tax_total AS igst,
  0.00::numeric(12,2) AS cgst,
  0.00::numeric(12,2) AS sgst,
  i.grand_total AS total,
  i.outlet_id,
  o.name AS outlet_name,
  '9985'::text AS hsn_sac_code,
  (SELECT string_agg(trim_scale(d.r)::text || '%', ' / ' ORDER BY d.r)
   FROM (SELECT DISTINCT it.tax_rate AS r FROM invoice_items it WHERE it.invoice_id = i.id) d
  ) AS rate_label
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND COALESCE(i.client_gst_type_snap, c.gst_type) = 'sez'
ORDER BY i.issued_at DESC, i.invoice_number;
ALTER VIEW gst_working_sez SET (security_invoker = true);

CREATE OR REPLACE VIEW gst_working_export AS
SELECT
  i.id AS invoice_id,
  (i.issued_at AT TIME ZONE 'Asia/Kolkata')::date AS invoice_date,
  i.invoice_number,
  COALESCE(i.client_name_snap, c.name) AS party_name,
  COALESCE(i.client_gstin_snap, c.gstin, '') AS gst_number,
  '9985'::text AS hsn_code,
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  COALESCE(
    (SELECT MAX(it.tax_rate) FROM invoice_items it WHERE it.invoice_id = i.id),
    0
  ) AS rate,
  i.tax_total AS igst,
  0.00::numeric(12,2) AS cgst,
  0.00::numeric(12,2) AS sgst,
  i.grand_total AS total,
  COALESCE(o.currency, 'INR') AS currency,
  i.outlet_id,
  o.name AS outlet_name,
  '9985'::text AS hsn_sac_code,
  (SELECT string_agg(trim_scale(d.r)::text || '%', ' / ' ORDER BY d.r)
   FROM (SELECT DISTINCT it.tax_rate AS r FROM invoice_items it WHERE it.invoice_id = i.id) d
  ) AS rate_label
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND COALESCE(i.client_gst_type_snap, c.gst_type) = 'export'
ORDER BY i.issued_at DESC, i.invoice_number;
ALTER VIEW gst_working_export SET (security_invoker = true);

-- ----------------------------------------------------------------
-- C5. admin_activity_log_unified   (latest: 016) -- same 9 columns
--     * Invoices: labelled with their real status ("created (DRAFT)")
--       instead of claiming every draft was "issued".
--     * Payments: voided ones marked " [VOIDED]".
--     * Subscription/event "status" rows: there is no updated_by
--       column, so they are no longer attributed to the CREATOR and
--       no longer claim a status change; they say "Last updated".
--     * NULL event_type no longer renders "()".
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS admin_activity_log_unified;
CREATE VIEW admin_activity_log_unified WITH (security_invoker = true) AS

SELECT
  im.created_at AS occurred_at,
  im.created_by AS user_id,
  up.full_name AS user_name,
  im.outlet_id,
  o.name AS outlet_name,
  'inventory'::text AS module,
  im.movement_type::text AS action_type,
  im.id::text AS entity_id,
  CONCAT(
    UPPER(im.movement_type::text), ' - ',
    ii.name, ' (', im.quantity, ' ', ii.unit, ')',
    CASE
      WHEN im.reference_type = 'subscription' THEN ' for Subscription'
      WHEN im.reference_type = 'event' THEN ' for Event'
      ELSE ''
    END,
    CASE WHEN im.notes IS NOT NULL THEN CONCAT(' - ', im.notes) ELSE '' END
  ) AS description
FROM inventory_movements im
JOIN inventory_items ii ON im.inventory_item_id = ii.id
JOIN outlets o ON im.outlet_id = o.id
LEFT JOIN user_profiles up ON im.created_by = up.id

UNION ALL

SELECT
  p.created_at,
  p.created_by,
  up.full_name,
  i.outlet_id,
  o.name,
  'payment'::text,
  CONCAT('payment_', p.payment_method),
  p.id::text,
  CONCAT(
    'Payment of ₹', p.amount,
    ' via ', UPPER(p.payment_method::text),
    ' for Invoice #', i.invoice_number,
    CASE WHEN p.reference_number IS NOT NULL THEN CONCAT(' (Ref: ', p.reference_number, ')') ELSE '' END,
    CASE WHEN p.is_active = false THEN ' [VOIDED]' ELSE '' END
  )
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN user_profiles up ON p.created_by = up.id

UNION ALL

SELECT
  s.created_at,
  s.created_by,
  up.full_name,
  s.outlet_id,
  o.name,
  'subscription'::text,
  'subscription_created'::text,
  s.id::text,
  CONCAT('Subscription created for ', c.name, ' (', s.billing_cycle, ')',
         ' - Status: ', UPPER(s.status::text))
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN outlets o ON s.outlet_id = o.id
LEFT JOIN user_profiles up ON s.created_by = up.id

UNION ALL

SELECT
  s.updated_at,
  NULL::uuid,
  NULL::text,
  s.outlet_id,
  o.name,
  'subscription'::text,
  CONCAT('subscription_status_', s.status::text),
  s.id::text,
  CONCAT('Subscription last updated (current status: ', UPPER(s.status::text), ') for ', c.name)
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN outlets o ON s.outlet_id = o.id
WHERE s.updated_at > s.created_at

UNION ALL

SELECT
  e.created_at,
  e.created_by,
  up.full_name,
  e.outlet_id,
  o.name,
  'event'::text,
  'event_created'::text,
  e.id::text,
  CONCAT('Event created: ', e.event_name,
         CASE WHEN e.event_type IS NOT NULL AND e.event_type <> '' THEN CONCAT(' (', e.event_type, ')') ELSE '' END,
         ' for ', c.name, ' on ', TO_CHAR(e.event_date, 'DD Mon YYYY'))
FROM events e
JOIN clients c ON e.client_id = c.id
JOIN outlets o ON e.outlet_id = o.id
LEFT JOIN user_profiles up ON e.created_by = up.id

UNION ALL

SELECT
  e.updated_at,
  NULL::uuid,
  NULL::text,
  e.outlet_id,
  o.name,
  'event'::text,
  CONCAT('event_status_', e.status::text),
  e.id::text,
  CONCAT('Event last updated (current status: ', UPPER(e.status::text), ') - ', e.event_name)
FROM events e
JOIN outlets o ON e.outlet_id = o.id
WHERE e.updated_at > e.created_at

UNION ALL

SELECT
  i.created_at,
  i.created_by,
  up.full_name,
  i.outlet_id,
  o.name,
  'invoice'::text,
  CONCAT('invoice_', i.invoice_type),
  i.id::text,
  CONCAT('Invoice #', i.invoice_number, ' created (', UPPER(i.status::text), ') for ',
         c.name, ' - ₹', i.grand_total, ' (', UPPER(i.invoice_type::text), ')')
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN user_profiles up ON i.created_by = up.id

ORDER BY occurred_at DESC;

ALTER VIEW admin_activity_log_unified SET (security_invoker = true);
GRANT SELECT ON admin_activity_log_unified TO authenticated;


-- ================================================================
-- D. INVENTORY
-- ================================================================

-- ----------------------------------------------------------------
-- D1. derive_movement_category   (latest: 035b)
--     ALWAYS derive the category from movement_type (was: only when
--     NULL), so a client-supplied mismatched category can no longer
--     route a movement past the category-based validation.
--     Every movement_type maps to exactly one category; the app
--     already sends matching pairs.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION derive_movement_category()
RETURNS TRIGGER AS $$
DECLARE
  v_derived text;
BEGIN
  v_derived := CASE NEW.movement_type::TEXT
    WHEN 'stock_in'           THEN 'inflow'
    WHEN 'allocation'         THEN 'outflow'
    WHEN 'return'             THEN 'return'
    WHEN 'return_damaged'     THEN 'return'
    WHEN 'damage'             THEN 'writeoff'
    WHEN 'loss'               THEN 'writeoff'
    WHEN 'disposal'           THEN 'writeoff'
    WHEN 'adjustment'         THEN 'adjustment'
    WHEN 'send_to_repair'     THEN 'repair'
    WHEN 'return_from_repair' THEN 'repair'
    ELSE NULL
  END;

  IF v_derived IS NULL THEN
    RAISE EXCEPTION 'Cannot derive movement_category from movement_type "%".', NEW.movement_type;
  END IF;

  NEW.movement_category := v_derived;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- D2. validate_movement_v2   (latest: 032) -- 032 body plus:
--     * outflow/return must reference a subscription or event
--     * OUTFLOW only to an ACTIVE subscription or a PLANNED event
--       (returns/write-offs against any status still accepted, so
--       outstanding dishes can always be recovered)
--     * negative adjustment = inventory_adjustment_is_negative(reason)
--       (same rule as the quantity trigger; notes no longer matter):
--       admin only, and cannot take available below zero
--     * write-off reason must match the reference kind, and the
--       movement_type must match the reason (otherwise the buckets
--       were picked from free text); friendly stock pre-checks
--     * return_from_repair needs reason 'repaired' or 'irreparable'
--       (anything else silently changed no quantities)
--     Identity: still role of NEW.created_by (unchanged; 043's scope).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_movement_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_user_role TEXT;
  v_item RECORD;
  v_allocation_exists BOOLEAN;
  v_allocated_qty INTEGER;
  v_outstanding INTEGER;
  v_total_resolved INTEGER;
  v_ref_status TEXT;
  v_reason TEXT := COALESCE(NEW.reason_code, '');
BEGIN
  -- VALIDATION 0: user role + item (row-locked, as 032)
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = NEW.created_by AND is_active = true;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive user';
  END IF;

  SELECT * INTO v_item
  FROM inventory_items
  WHERE id = NEW.inventory_item_id
  FOR UPDATE;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  -- VALIDATION 1
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero';
  END IF;

  -- VALIDATION 2
  IF v_item.outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Movement outlet must match item outlet';
  END IF;

  -- VALIDATION 3: lifecycle
  IF v_item.lifecycle_status = 'archived' THEN
    RAISE EXCEPTION 'Cannot create movements for archived items. Item is read-only.';
  END IF;

  IF v_item.lifecycle_status = 'discontinued' THEN
    IF NEW.movement_category NOT IN ('return', 'writeoff') THEN
      RAISE EXCEPTION 'Discontinued items can only receive returns or writeoffs. Cannot add stock or allocate.';
    END IF;
  END IF;

  IF NEW.movement_category = 'outflow' THEN
    IF v_item.lifecycle_status != 'active' THEN
      RAISE EXCEPTION 'Can only allocate from ACTIVE items. Current status: %', v_item.lifecycle_status;
    END IF;
  END IF;

  -- VALIDATION 3b: dispatches/returns need a customer reference
  IF NEW.movement_category IN ('outflow', 'return')
     AND NEW.reference_type NOT IN ('subscription', 'event') THEN
    RAISE EXCEPTION 'Dispatches and returns must reference a subscription or event';
  END IF;

  -- VALIDATION 4: reference exists in this outlet; outflow needs a live reference
  IF NEW.reference_type = 'subscription' THEN
    SELECT status::text INTO v_ref_status
    FROM subscriptions
    WHERE id = NEW.reference_id AND outlet_id = NEW.outlet_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid subscription reference or outlet mismatch';
    END IF;

    IF NEW.movement_category = 'outflow' AND v_ref_status <> 'active' THEN
      RAISE EXCEPTION 'Can only dispatch to an active subscription (this one is %)', v_ref_status;
    END IF;
  ELSIF NEW.reference_type = 'event' THEN
    SELECT status::text INTO v_ref_status
    FROM events
    WHERE id = NEW.reference_id AND outlet_id = NEW.outlet_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid event reference or outlet mismatch';
    END IF;

    IF NEW.movement_category = 'outflow' AND v_ref_status <> 'planned' THEN
      RAISE EXCEPTION 'Can only dispatch to a planned event (this one is %)', v_ref_status;
    END IF;
  END IF;

  -- VALIDATION 5: stock for outflow
  IF NEW.movement_category = 'outflow' THEN
    IF v_item.available_quantity < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %',
        v_item.available_quantity, NEW.quantity;
    END IF;
  END IF;

  -- VALIDATION 6: adjustment rules
  IF NEW.movement_category = 'adjustment' THEN
    IF NEW.reason_code IS NULL OR NEW.reason_code = '' THEN
      RAISE EXCEPTION 'Adjustments require a reason_code';
    END IF;

    IF NEW.notes IS NULL OR NEW.notes = '' THEN
      RAISE EXCEPTION 'Adjustments require notes explaining the reason';
    END IF;

    IF v_item.opening_balance_confirmed = true AND v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Only admins can adjust stock after opening balance is confirmed';
    END IF;

    -- VALIDATION 7: negative adjustments (same rule as the quantity trigger)
    IF inventory_adjustment_is_negative(NEW.reason_code) THEN
      IF v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can perform negative adjustments';
      END IF;
      IF v_item.available_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Cannot adjust below zero. Available: %, Decrease requested: %',
          v_item.available_quantity, NEW.quantity;
      END IF;
    END IF;
  END IF;

  -- VALIDATION 8: return/write-off against a reference needs an
  -- active allocation with enough outstanding (as 032)
  IF NEW.movement_category IN ('return', 'writeoff')
     AND NEW.reference_type IN ('subscription', 'event') THEN

    SELECT EXISTS (
      SELECT 1 FROM inventory_allocations
      WHERE inventory_item_id = NEW.inventory_item_id
        AND reference_type = NEW.reference_type
        AND reference_id = NEW.reference_id
        AND is_active = true
    ) INTO v_allocation_exists;

    IF NOT v_allocation_exists THEN
      RAISE EXCEPTION 'No active allocation found for this reference';
    END IF;

    SELECT allocated_quantity INTO v_allocated_qty
    FROM inventory_allocations
    WHERE inventory_item_id = NEW.inventory_item_id
      AND reference_type = NEW.reference_type
      AND reference_id = NEW.reference_id
      AND is_active = true
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity), 0) INTO v_total_resolved
    FROM inventory_movements
    WHERE inventory_item_id = NEW.inventory_item_id
      AND reference_type = NEW.reference_type
      AND reference_id = NEW.reference_id
      AND movement_category IN ('return', 'writeoff');

    v_outstanding := v_allocated_qty - v_total_resolved;

    IF NEW.quantity > v_outstanding THEN
      RAISE EXCEPTION 'Cannot process more than outstanding. Outstanding: %, Requested: %',
        v_outstanding, NEW.quantity;
    END IF;
  END IF;

  -- VALIDATION 8b: write-off reason vs reference and type
  IF NEW.movement_category = 'writeoff' THEN
    IF NEW.reference_type IN ('subscription', 'event') THEN
      IF v_reason NOT IN ('client_damage', 'client_reported', 'delivery_damage',
                          'client_lost', 'transit_lost', 'theft') THEN
        RAISE EXCEPTION 'Write-off reason "%" is not valid against a subscription/event', NEW.reason_code;
      END IF;
    ELSE
      IF v_reason NOT IN ('handling_damage', 'storage_damage', 'missing_stock', 'theft',
                          'end_of_life', 'unrepairable', 'audit_writeoff') THEN
        RAISE EXCEPTION 'Write-off reason "%" is not valid for warehouse stock', NEW.reason_code;
      END IF;

      IF v_reason IN ('end_of_life', 'unrepairable', 'audit_writeoff') THEN
        IF v_item.damaged_quantity < NEW.quantity THEN
          RAISE EXCEPTION 'Insufficient damaged stock to dispose. Damaged: %, Requested: %',
            v_item.damaged_quantity, NEW.quantity;
        END IF;
      ELSIF v_item.available_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %',
          v_item.available_quantity, NEW.quantity;
      END IF;
    END IF;

    IF (v_reason IN ('handling_damage', 'storage_damage', 'client_damage',
                     'client_reported', 'delivery_damage')
        AND NEW.movement_type::text <> 'damage')
       OR (v_reason IN ('client_lost', 'transit_lost', 'theft', 'missing_stock')
           AND NEW.movement_type::text <> 'loss')
       OR (v_reason IN ('end_of_life', 'unrepairable', 'audit_writeoff')
           AND NEW.movement_type::text <> 'disposal') THEN
      RAISE EXCEPTION 'Movement type % does not match write-off reason %',
        NEW.movement_type, NEW.reason_code;
    END IF;
  END IF;

  -- VALIDATION 9: repair (as 032) + reason for return_from_repair
  IF NEW.movement_category = 'repair' THEN
    IF NEW.movement_type::TEXT = 'send_to_repair' THEN
      IF v_item.damaged_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient damaged stock for repair. Damaged: %, Requested: %',
          v_item.damaged_quantity, NEW.quantity;
      END IF;
    END IF;

    IF NEW.movement_type::TEXT = 'return_from_repair' THEN
      IF v_reason NOT IN ('repaired', 'irreparable') THEN
        RAISE EXCEPTION 'Return from repair needs reason "repaired" or "irreparable"';
      END IF;
      IF v_item.in_repair_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient items in repair. In repair: %, Requested: %',
          v_item.in_repair_quantity, NEW.quantity;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION validate_movement_v2() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- D3. update_inventory_quantities_v2   (latest: 025)
--     Identical to 025 except the negative-adjustment detection:
--     was reason heuristics OR notes LIKE '%negative%', so an
--     "Increase" whose note said "negative" LOWERED stock.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_inventory_quantities_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_adjustment_negative BOOLEAN := false;
BEGIN
  IF NEW.movement_category = 'adjustment' THEN
    v_adjustment_negative := inventory_adjustment_is_negative(NEW.reason_code);
  END IF;

  CASE NEW.movement_category
    WHEN 'inflow' THEN
      UPDATE inventory_items
      SET available_quantity = available_quantity + NEW.quantity,
          total_quantity = total_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.inventory_item_id;

    WHEN 'outflow' THEN
      UPDATE inventory_items
      SET available_quantity = available_quantity - NEW.quantity,
          allocated_quantity = allocated_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.inventory_item_id;

      UPDATE inventory_items
      SET opening_balance_confirmed = true
      WHERE id = NEW.inventory_item_id
        AND opening_balance_confirmed = false;

    WHEN 'return' THEN
      IF NEW.movement_type::TEXT = 'return_damaged'
         OR NEW.reason_code IN ('client_damage', 'transit_damage') THEN
        UPDATE inventory_items
        SET damaged_quantity = damaged_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSE
        UPDATE inventory_items
        SET available_quantity = available_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;

    WHEN 'writeoff' THEN
      CASE
        WHEN NEW.reason_code IN ('handling_damage', 'storage_damage') THEN
          UPDATE inventory_items
          SET damaged_quantity = damaged_quantity + NEW.quantity,
              available_quantity = available_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;

        WHEN NEW.reason_code IN ('client_damage', 'client_reported', 'delivery_damage') THEN
          UPDATE inventory_items
          SET damaged_quantity = damaged_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;

        WHEN NEW.reason_code IN ('client_lost', 'transit_lost', 'theft')
             AND NEW.reference_type IN ('subscription', 'event') THEN
          UPDATE inventory_items
          SET lost_quantity = lost_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              total_quantity = total_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;

        WHEN NEW.reason_code IN ('client_lost', 'transit_lost', 'theft', 'missing_stock') THEN
          UPDATE inventory_items
          SET lost_quantity = lost_quantity + NEW.quantity,
              available_quantity = available_quantity - NEW.quantity,
              total_quantity = total_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;

        WHEN NEW.reason_code IN ('end_of_life', 'unrepairable', 'audit_writeoff') THEN
          UPDATE inventory_items
          SET damaged_quantity = damaged_quantity - NEW.quantity,
              total_quantity = total_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;

        ELSE
          IF NEW.movement_type::TEXT = 'damage' THEN
            UPDATE inventory_items
            SET damaged_quantity = damaged_quantity + NEW.quantity,
                allocated_quantity = allocated_quantity - NEW.quantity,
                updated_at = now()
            WHERE id = NEW.inventory_item_id;
          ELSIF NEW.movement_type::TEXT = 'loss' THEN
            UPDATE inventory_items
            SET lost_quantity = lost_quantity + NEW.quantity,
                allocated_quantity = allocated_quantity - NEW.quantity,
                total_quantity = total_quantity - NEW.quantity,
                updated_at = now()
            WHERE id = NEW.inventory_item_id;
          END IF;
      END CASE;

    WHEN 'adjustment' THEN
      IF v_adjustment_negative THEN
        UPDATE inventory_items
        SET available_quantity = available_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSE
        UPDATE inventory_items
        SET available_quantity = available_quantity + NEW.quantity,
            total_quantity = total_quantity + NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;

    WHEN 'repair' THEN
      IF NEW.movement_type::TEXT = 'send_to_repair'
         OR NEW.reason_code IN ('internal_repair', 'external_vendor') THEN
        UPDATE inventory_items
        SET damaged_quantity = damaged_quantity - NEW.quantity,
            in_repair_quantity = in_repair_quantity + NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSIF NEW.reason_code = 'repaired' THEN
        UPDATE inventory_items
        SET in_repair_quantity = in_repair_quantity - NEW.quantity,
            available_quantity = available_quantity + NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSIF NEW.reason_code = 'irreparable' THEN
        UPDATE inventory_items
        SET in_repair_quantity = in_repair_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;

    ELSE
      CASE NEW.movement_type::TEXT
        WHEN 'stock_in' THEN
          UPDATE inventory_items
          SET available_quantity = available_quantity + NEW.quantity,
              total_quantity = total_quantity + NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        WHEN 'allocation' THEN
          UPDATE inventory_items
          SET available_quantity = available_quantity - NEW.quantity,
              allocated_quantity = allocated_quantity + NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        WHEN 'return' THEN
          UPDATE inventory_items
          SET available_quantity = available_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        WHEN 'damage' THEN
          UPDATE inventory_items
          SET damaged_quantity = damaged_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        WHEN 'loss' THEN
          UPDATE inventory_items
          SET lost_quantity = lost_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              total_quantity = total_quantity - NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        WHEN 'adjustment' THEN
          UPDATE inventory_items
          SET available_quantity = available_quantity + NEW.quantity,
              total_quantity = total_quantity + NEW.quantity,
              updated_at = now()
          WHERE id = NEW.inventory_item_id;
        ELSE
          RAISE WARNING 'Unknown movement_category: %, movement_type: %',
            NEW.movement_category, NEW.movement_type;
      END CASE;
  END CASE;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION update_inventory_quantities_v2() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- D4. lock_opening_balance_on_allocation   (latest: 025)
--     041 enabled RLS on inventory_migration_log with no INSERT
--     policy, so this (invoker) trigger's log INSERT failed and
--     rolled back the first allocation of any unlocked item.
--     Same body, now SECURITY DEFINER.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_opening_balance_on_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.movement_category = 'outflow' THEN
    UPDATE inventory_items
    SET opening_balance_confirmed = true,
        updated_at = now()
    WHERE id = NEW.inventory_item_id
      AND opening_balance_confirmed = false;

    IF FOUND THEN
      INSERT INTO inventory_migration_log (migration_version, table_name, operation, record_id, notes)
      VALUES ('runtime', 'inventory_items', 'LOCK_OPENING_BALANCE', NEW.inventory_item_id,
              'Opening balance auto-locked on first allocation');
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION lock_opening_balance_on_allocation() FROM PUBLIC, anon, authenticated;

-- New items start UNLOCKED (024 defaulted the flag to true "for
-- existing rows" and never reset it, so every new item was born
-- locked). Existing rows are not changed. The app also sends false
-- explicitly. Negative adjustments stay admin-only (D2) either way.
ALTER TABLE inventory_items ALTER COLUMN opening_balance_confirmed SET DEFAULT false;

-- ----------------------------------------------------------------
-- D5. sync_allocation_on_movement   (latest: 035b)
--     Re-activating a CLOSED allocation used to add the new dispatch
--     on top of the old allocated_quantity. For a phantom (never
--     dispatched) row that resurrected the phantom quantity. Now a
--     closed row restarts at (already resolved) + new quantity, so
--     outstanding = exactly the new dispatch. For legitimately closed
--     rows (allocated = resolved) the result is identical to before.
--     Still SECURITY INVOKER (table lockdown is 043's scope).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_allocation_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_allocated_qty INTEGER;
  v_total_resolved INTEGER;
BEGIN
  IF NEW.reference_type IN ('subscription', 'event') THEN

    IF NEW.movement_category = 'outflow' THEN
      SELECT COALESCE(SUM(quantity), 0) INTO v_total_resolved
      FROM inventory_movements
      WHERE inventory_item_id = NEW.inventory_item_id
        AND reference_type = NEW.reference_type
        AND reference_id = NEW.reference_id
        AND movement_category IN ('return', 'writeoff');

      INSERT INTO inventory_allocations (
        outlet_id, inventory_item_id, reference_type, reference_id,
        allocated_quantity, is_active
      ) VALUES (
        NEW.outlet_id, NEW.inventory_item_id, NEW.reference_type, NEW.reference_id,
        v_total_resolved + NEW.quantity, true
      )
      ON CONFLICT (inventory_item_id, reference_type, reference_id)
      DO UPDATE SET
        allocated_quantity = CASE
          WHEN inventory_allocations.is_active
            THEN inventory_allocations.allocated_quantity + NEW.quantity
          ELSE v_total_resolved + NEW.quantity
        END,
        is_active = true,
        updated_at = now();
    END IF;

    IF NEW.movement_category IN ('return', 'writeoff') THEN
      SELECT allocated_quantity INTO v_allocated_qty
      FROM inventory_allocations
      WHERE inventory_item_id = NEW.inventory_item_id
        AND reference_type = NEW.reference_type
        AND reference_id = NEW.reference_id
        AND is_active = true;

      IF v_allocated_qty IS NOT NULL THEN
        SELECT COALESCE(SUM(quantity), 0) INTO v_total_resolved
        FROM inventory_movements
        WHERE inventory_item_id = NEW.inventory_item_id
          AND reference_type = NEW.reference_type
          AND reference_id = NEW.reference_id
          AND movement_category IN ('return', 'writeoff');

        IF v_allocated_qty - v_total_resolved <= 0 THEN
          UPDATE inventory_allocations
          SET is_active = false, updated_at = now()
          WHERE inventory_item_id = NEW.inventory_item_id
            AND reference_type = NEW.reference_type
            AND reference_id = NEW.reference_id
            AND is_active = true;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- D7. INVENTORY VIEWS
-- ----------------------------------------------------------------

-- inventory_movements_with_details   (latest: 008)
--   * INNER JOIN user_profiles dropped every movement created by
--     someone else for managers, and all of them for accountants.
--   * No longer hides discontinued items or deactivated outlets
--     (RLS still scopes rows).
--   * Appended: id, movement_category, reason_code, lifecycle_status.
DROP VIEW IF EXISTS inventory_movements_with_details;
CREATE VIEW inventory_movements_with_details WITH (security_invoker = true) AS
SELECT
  im.id AS movement_id,
  im.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  im.inventory_item_id,
  ii.name AS item_name,
  ii.category AS item_category,
  im.movement_type,
  im.quantity,
  im.reference_type,
  im.reference_id,
  CASE
    WHEN im.reference_type = 'subscription' THEN c.name
    WHEN im.reference_type = 'event' THEN e.event_name
    ELSE 'Manual'
  END AS reference_name,
  im.notes,
  im.created_by,
  user_display_name(im.created_by) AS created_by_name,
  im.created_at,
  im.id AS id,
  im.movement_category,
  im.reason_code,
  ii.lifecycle_status
FROM inventory_movements im
JOIN outlets o ON im.outlet_id = o.id
JOIN inventory_items ii ON im.inventory_item_id = ii.id
LEFT JOIN subscriptions s ON im.reference_type = 'subscription' AND im.reference_id = s.id
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN events e ON im.reference_type = 'event' AND im.reference_id = e.id;
ALTER VIEW inventory_movements_with_details SET (security_invoker = true);
GRANT SELECT ON inventory_movements_with_details TO authenticated;

-- inventory_damage_loss_report   (latest: 008)
--   * includes damaged client returns (return_damaged, or a return
--     with reason client_damage/transit_damage) as 'damage'
--   * report_date is the IST date; rows are now actually aggregated
--     per day (created_at was in the GROUP BY, so every movement was
--     its own row)
--   * no longer hides discontinued items
--   Same columns; movement_type stays 'damage' / 'loss'.
DROP VIEW IF EXISTS inventory_damage_loss_report;
CREATE VIEW inventory_damage_loss_report WITH (security_invoker = true) AS
SELECT
  im.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  im.inventory_item_id,
  ii.name AS item_name,
  ii.category AS item_category,
  (CASE WHEN im.movement_type::text = 'loss' THEN 'loss' ELSE 'damage' END)::movement_type AS movement_type,
  COUNT(*) AS incident_count,
  SUM(im.quantity) AS total_quantity,
  (im.created_at AT TIME ZONE 'Asia/Kolkata')::date AS report_date,
  im.reference_type,
  im.reference_id,
  CASE
    WHEN im.reference_type = 'subscription' THEN c.name
    WHEN im.reference_type = 'event' THEN e.event_name
    ELSE 'Manual'
  END AS reference_name
FROM inventory_movements im
JOIN outlets o ON im.outlet_id = o.id
JOIN inventory_items ii ON im.inventory_item_id = ii.id
LEFT JOIN subscriptions s ON im.reference_type = 'subscription' AND im.reference_id = s.id
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN events e ON im.reference_type = 'event' AND im.reference_id = e.id
WHERE o.is_active = true
  AND (
    (im.movement_category = 'writeoff' AND im.movement_type::text IN ('damage', 'loss'))
    OR im.movement_type::text = 'return_damaged'
    OR (im.movement_category = 'return' AND im.reason_code IN ('client_damage', 'transit_damage'))
  )
GROUP BY 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13
ORDER BY report_date DESC;
ALTER VIEW inventory_damage_loss_report SET (security_invoker = true);
GRANT SELECT ON inventory_damage_loss_report TO authenticated;

-- inventory_audit_summary   (latest: 026) -- names visible to non-admins
DROP VIEW IF EXISTS inventory_audit_summary;
CREATE VIEW inventory_audit_summary WITH (security_invoker = true) AS
SELECT
  ia.id AS audit_id,
  ia.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  ia.period,
  ia.status,
  ia.items_total,
  ia.items_counted,
  ia.variance_positive,
  ia.variance_negative,
  ia.created_by,
  user_display_name(ia.created_by) AS created_by_name,
  ia.approved_by,
  user_display_name(ia.approved_by) AS approved_by_name,
  ia.rejection_reason,
  ia.created_at,
  ia.submitted_at,
  ia.approved_at,
  CASE
    WHEN ia.items_total = 0 THEN 0
    ELSE ROUND((ia.items_counted::NUMERIC / ia.items_total) * 100, 1)
  END AS progress_percentage,
  CASE ia.status
    WHEN 'draft' THEN 'Draft'
    WHEN 'counting' THEN 'Counting'
    WHEN 'review' THEN 'Under Review'
    WHEN 'pending_approval' THEN 'Pending Approval'
    WHEN 'approved' THEN 'Approved'
    WHEN 'rejected' THEN 'Rejected'
  END AS status_label
FROM inventory_audits ia
JOIN outlets o ON ia.outlet_id = o.id;
ALTER VIEW inventory_audit_summary SET (security_invoker = true);
GRANT SELECT ON inventory_audit_summary TO authenticated;

-- reference_allocation_history  (NEW) -- every allocation, active or
--   fully resolved, with the resolution broken down. Uses the same
--   movement matching as inventory_allocations_with_details (025) and
--   the same damaged-return rule as update_inventory_quantities_v2.
--   outstanding_quantity: allocated - (returns + write-offs) for an
--   active row, never below 0; 0 for a closed row.
CREATE OR REPLACE VIEW reference_allocation_history WITH (security_invoker = true) AS
SELECT
  ia.id AS allocation_id,
  ia.outlet_id,
  ia.inventory_item_id,
  ii.name AS item_name,
  ii.category AS item_category,
  ia.reference_type,
  ia.reference_id,
  ia.allocated_quantity,
  ia.is_active,
  COALESCE(m.returned_good, 0)::integer AS returned_good,
  COALESCE(m.returned_damaged, 0)::integer AS returned_damaged,
  COALESCE(m.lost, 0)::integer AS lost,
  COALESCE(m.disposed, 0)::integer AS disposed,
  CASE
    WHEN ia.is_active THEN GREATEST(ia.allocated_quantity - COALESCE(m.resolved, 0), 0)::integer
    ELSE 0
  END AS outstanding_quantity,
  ia.created_at,
  ia.updated_at
FROM inventory_allocations ia
JOIN inventory_items ii ON ii.id = ia.inventory_item_id
LEFT JOIN LATERAL (
  SELECT
    SUM(im.quantity) FILTER (
      WHERE im.movement_category = 'return'
        AND im.movement_type::text <> 'return_damaged'
        AND COALESCE(im.reason_code, '') NOT IN ('client_damage', 'transit_damage')
    ) AS returned_good,
    SUM(im.quantity) FILTER (
      WHERE (im.movement_category = 'return'
             AND (im.movement_type::text = 'return_damaged'
                  OR COALESCE(im.reason_code, '') IN ('client_damage', 'transit_damage')))
         OR (im.movement_category = 'writeoff' AND im.movement_type::text = 'damage')
    ) AS returned_damaged,
    SUM(im.quantity) FILTER (
      WHERE im.movement_category = 'writeoff' AND im.movement_type::text = 'loss'
    ) AS lost,
    SUM(im.quantity) FILTER (
      WHERE im.movement_category = 'writeoff' AND im.movement_type::text = 'disposal'
    ) AS disposed,
    SUM(im.quantity) FILTER (
      WHERE im.movement_category IN ('return', 'writeoff')
    ) AS resolved
  FROM inventory_movements im
  WHERE im.inventory_item_id = ia.inventory_item_id
    AND im.reference_type = ia.reference_type
    AND im.reference_id = ia.reference_id
) m ON true;
ALTER VIEW reference_allocation_history SET (security_invoker = true);
GRANT SELECT ON reference_allocation_history TO authenticated;

-- ----------------------------------------------------------------
-- D8. INVENTORY AUDITS   (latest: 040)
-- ----------------------------------------------------------------
-- Schema: a REJECTED audit no longer blocks its outlet/period forever
-- (UNIQUE(outlet, period) -> partial unique WHERE status <> rejected);
-- at most one open audit per outlet (race-proof); period format.
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.inventory_audits'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (outlet_id, period)';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inventory_audits DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_audits_outlet_period_live_uq
  ON inventory_audits(outlet_id, period)
  WHERE status <> 'rejected';

DO $$
DECLARE
  v_dupes text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'inventory_audits_one_open_per_outlet') THEN
    RETURN;
  END IF;
  SELECT string_agg(outlet_id::text, ', ') INTO v_dupes
  FROM (
    SELECT outlet_id FROM inventory_audits
    WHERE status IN ('draft', 'counting', 'review', 'pending_approval')
    GROUP BY outlet_id HAVING count(*) > 1
  ) d;
  IF v_dupes IS NULL THEN
    CREATE UNIQUE INDEX inventory_audits_one_open_per_outlet
      ON inventory_audits(outlet_id)
      WHERE status IN ('draft', 'counting', 'review', 'pending_approval');
  ELSE
    RAISE NOTICE 'SKIPPED inventory_audits_one_open_per_outlet: outlets with several open audits: %', v_dupes;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'inventory_audits_period_format'
                   AND conrelid = 'public.inventory_audits'::regclass) THEN
    -- NOT VALID: enforced for new/changed rows; legacy rows untouched
    ALTER TABLE inventory_audits ADD CONSTRAINT inventory_audits_period_format
      CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') NOT VALID;
  END IF;
END $$;

-- create_inventory_audit -- same signature/return. Changes: period
-- validated, creation serialized per outlet, rejected audits do not
-- block a re-run for the same period.
CREATE OR REPLACE FUNCTION create_inventory_audit(
  p_outlet_id UUID,
  p_period VARCHAR(7),
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_audit_id UUID;
  v_item_count INTEGER;
  v_actor UUID;
BEGIN
  -- Identity from the session (040); p_created_by is ignored.
  v_actor := audit_actor(p_outlet_id);

  IF p_period IS NULL OR p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Audit period must be in YYYY-MM format';
  END IF;

  IF p_period > to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') THEN
    RAISE EXCEPTION 'Audit period % is in the future', p_period;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('hybits_inventory_audit_' || p_outlet_id::text));

  IF EXISTS (
    SELECT 1 FROM inventory_audits a
    WHERE a.outlet_id = p_outlet_id
      AND a.period = p_period
      AND a.status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'Audit already exists for outlet % and period %', p_outlet_id, p_period;
  END IF;

  IF check_active_audit(p_outlet_id) THEN
    RAISE EXCEPTION 'Cannot create new audit while another audit is in progress';
  END IF;

  INSERT INTO inventory_audits (outlet_id, period, created_by)
  VALUES (p_outlet_id, p_period, v_actor)
  RETURNING id INTO v_audit_id;

  INSERT INTO inventory_audit_line_items (audit_id, inventory_item_id, system_quantity)
  SELECT v_audit_id, ii.id, ii.available_quantity
  FROM inventory_items ii
  WHERE ii.outlet_id = p_outlet_id
    AND ii.lifecycle_status IN ('draft', 'active')
  ORDER BY ii.name;

  GET DIAGNOSTICS v_item_count = ROW_COUNT;

  UPDATE inventory_audits
  SET items_total = v_item_count,
      status = 'counting'
  WHERE id = v_audit_id;

  RETURN v_audit_id;
END;
$fn$;

-- submit_inventory_audit -- same signature/return. Fixes:
--   * "column reference audit_id is ambiguous" (RETURNS TABLE column
--     vs table column) failed EVERY submit: table aliases + directive
--   * reference_id was audit_id::TEXT with type 'manual' (uuid column,
--     CHECK requires NULL for manual): now NULL, audit id in notes
--   * row lock + status predicate: concurrent submits cannot
--     double-post
--   * a MANAGER with any non-zero variance now goes to admin approval
--     (auto-approve posted manager adjustments that the movement
--     validation rejects on locked items); auto-approve only for
--     all-zero variance or an admin submitter with no shortages
--   * direction always follows the variance sign: a stale negative
--     reason on a positive line is posted as 'audit_surplus'
CREATE OR REPLACE FUNCTION submit_inventory_audit(
  p_audit_id UUID,
  p_submitted_by UUID
)
RETURNS TABLE (
  audit_id UUID,
  auto_approved BOOLEAN,
  movements_created INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  v_audit inventory_audits%ROWTYPE;
  v_movement_count INTEGER := 0;
  v_line RECORD;
  v_actor UUID;
  v_role user_role;
  v_pos INTEGER;
  v_neg INTEGER;
BEGIN
  SELECT a.* INTO v_audit
  FROM inventory_audits a
  WHERE a.id = p_audit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;

  v_actor := audit_actor(v_audit.outlet_id);
  v_role := current_user_role();

  IF v_audit.status NOT IN ('counting', 'review') THEN
    RAISE EXCEPTION 'Audit cannot be submitted in current status: %', v_audit.status;
  END IF;

  IF v_audit.items_counted < v_audit.items_total THEN
    RAISE EXCEPTION 'All items must be counted before submitting. Counted: %, Total: %',
      v_audit.items_counted, v_audit.items_total;
  END IF;

  IF EXISTS (
    SELECT 1 FROM inventory_audit_line_items li
    WHERE li.audit_id = p_audit_id
      AND li.variance <> 0
      AND (li.reason_code IS NULL OR li.reason_code = '')
  ) THEN
    RAISE EXCEPTION 'All variances must have a reason code';
  END IF;

  SELECT COALESCE(SUM(li.variance) FILTER (WHERE li.variance > 0), 0),
         COALESCE(SUM(li.variance) FILTER (WHERE li.variance < 0), 0)
  INTO v_pos, v_neg
  FROM inventory_audit_line_items li
  WHERE li.audit_id = p_audit_id;

  UPDATE inventory_audits a
  SET variance_positive = v_pos,
      variance_negative = v_neg,
      submitted_at = now()
  WHERE a.id = p_audit_id;

  IF v_neg < 0 OR (v_pos > 0 AND v_role IS DISTINCT FROM 'admin'::user_role) THEN
    UPDATE inventory_audits a
    SET status = 'pending_approval'
    WHERE a.id = p_audit_id
      AND a.status IN ('counting', 'review');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit status changed concurrently; reload and try again';
    END IF;

    RETURN QUERY SELECT p_audit_id, false, 0;
    RETURN;
  END IF;

  UPDATE inventory_audits a
  SET status = 'approved',
      approved_by = v_actor,
      approved_at = now()
  WHERE a.id = p_audit_id
    AND a.status IN ('counting', 'review');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit status changed concurrently; reload and try again';
  END IF;

  FOR v_line IN
    SELECT li.* FROM inventory_audit_line_items li
    WHERE li.audit_id = p_audit_id AND li.variance > 0
  LOOP
    INSERT INTO inventory_movements (
      outlet_id, inventory_item_id, movement_category, movement_type,
      quantity, reference_type, reference_id, reason_code, notes, created_by
    ) VALUES (
      v_audit.outlet_id,
      v_line.inventory_item_id,
      'adjustment',
      'adjustment',
      v_line.variance,
      'manual',
      NULL,
      CASE WHEN inventory_adjustment_is_negative(v_line.reason_code)
           THEN 'audit_surplus' ELSE v_line.reason_code END,
      btrim(COALESCE(v_line.notes, '') || ' [Audit ' || v_audit.period || ' ' || p_audit_id || ']'),
      v_actor
    );

    v_movement_count := v_movement_count + 1;
  END LOOP;

  RETURN QUERY SELECT p_audit_id, true, v_movement_count;
END;
$fn$;

-- approve_inventory_audit -- same signature/return. Same fixes as
-- submit (ambiguity, reference_id, row lock + status predicate,
-- direction from the variance sign).
CREATE OR REPLACE FUNCTION approve_inventory_audit(
  p_audit_id UUID,
  p_approved_by UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  audit_id UUID,
  success BOOLEAN,
  movements_created INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  v_audit inventory_audits%ROWTYPE;
  v_movement_count INTEGER := 0;
  v_line RECORD;
  v_actor UUID;
BEGIN
  -- Authorize before touching the audit (040: no existence oracle)
  v_actor := audit_actor(NULL, true);

  SELECT a.* INTO v_audit
  FROM inventory_audits a
  WHERE a.id = p_audit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;

  IF v_audit.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Audit is not pending approval';
  END IF;

  IF NOT p_approved THEN
    UPDATE inventory_audits a
    SET status = 'rejected',
        approved_by = v_actor,
        approved_at = now(),
        rejection_reason = p_rejection_reason
    WHERE a.id = p_audit_id
      AND a.status = 'pending_approval';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit status changed concurrently; reload and try again';
    END IF;

    RETURN QUERY SELECT p_audit_id, true, 0;
    RETURN;
  END IF;

  UPDATE inventory_audits a
  SET status = 'approved',
      approved_by = v_actor,
      approved_at = now()
  WHERE a.id = p_audit_id
    AND a.status = 'pending_approval';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit status changed concurrently; reload and try again';
  END IF;

  FOR v_line IN
    SELECT li.* FROM inventory_audit_line_items li
    WHERE li.audit_id = p_audit_id AND li.variance <> 0
  LOOP
    IF v_line.variance > 0 THEN
      INSERT INTO inventory_movements (
        outlet_id, inventory_item_id, movement_category, movement_type,
        quantity, reference_type, reference_id, reason_code, notes, created_by
      ) VALUES (
        v_audit.outlet_id,
        v_line.inventory_item_id,
        'adjustment',
        'adjustment',
        v_line.variance,
        'manual',
        NULL,
        CASE WHEN inventory_adjustment_is_negative(v_line.reason_code)
             THEN 'audit_surplus' ELSE v_line.reason_code END,
        btrim(COALESCE(v_line.notes, '') || ' [Audit ' || v_audit.period || ' ' || p_audit_id || ']'),
        v_actor
      );
    ELSE
      INSERT INTO inventory_movements (
        outlet_id, inventory_item_id, movement_category, movement_type,
        quantity, reference_type, reference_id, reason_code, notes, created_by
      ) VALUES (
        v_audit.outlet_id,
        v_line.inventory_item_id,
        'adjustment',
        'adjustment',
        ABS(v_line.variance),
        'manual',
        NULL,
        'count_correction_negative',
        btrim(COALESCE(v_line.notes, '') || ' [Audit ' || v_audit.period || ' ' || p_audit_id
              || ' - NEGATIVE, reason: ' || COALESCE(v_line.reason_code, '-') || ']'),
        v_actor
      );
    END IF;

    v_movement_count := v_movement_count + 1;
  END LOOP;

  RETURN QUERY SELECT p_audit_id, true, v_movement_count;
END;
$fn$;

REVOKE ALL ON FUNCTION create_inventory_audit(UUID, VARCHAR, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION submit_inventory_audit(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION approve_inventory_audit(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_inventory_audit(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_inventory_audit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_inventory_audit(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ----------------------------------------------------------------
-- D9. Dead code: validate_movement() (019) references columns that
--     do not exist; its trigger was dropped in 025. Dropped only if
--     nothing uses it.
-- ----------------------------------------------------------------
DO $$
BEGIN
  DROP FUNCTION IF EXISTS validate_movement();
EXCEPTION WHEN dependent_objects_still_exist THEN
  RAISE NOTICE 'validate_movement() still referenced; left in place';
END $$;


-- ================================================================
-- E. CRM: EVENTS, SUBSCRIPTIONS, CLIENTS
-- ================================================================

-- ----------------------------------------------------------------
-- E1. enforce_event_lifecycle  (NEW trigger on events)
--     * status: planned -> completed | cancelled only (exactly what
--       eventService does); completed/cancelled are terminal
--     * cannot cancel while dishware is outstanding (mirrors
--       handle_subscription_inventory_v2); on cancel the (fully
--       resolved) allocations are closed
--     * an event with a live invoice cannot change client or outlet
--     SQL-editor / service-role sessions (auth.uid() IS NULL) may
--     still correct a status by hand; the dishware check always runs.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_event_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_alloc RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    IF NOT (OLD.status = 'planned' AND NEW.status IN ('completed', 'cancelled')) THEN
      RAISE EXCEPTION 'Invalid event status change: % → %. Only a planned event can be completed or cancelled.',
        OLD.status, NEW.status;
    END IF;
  END IF;

  IF (NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.outlet_id IS DISTINCT FROM OLD.outlet_id)
     AND EXISTS (SELECT 1 FROM invoices i WHERE i.event_id = OLD.id AND i.status <> 'cancelled') THEN
    RAISE EXCEPTION 'This event has been invoiced; its client and outlet can no longer change';
  END IF;

  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    FOR v_alloc IN
      SELECT
        ii.name AS item_name,
        ia.allocated_quantity - COALESCE((
          SELECT SUM(im.quantity) FROM inventory_movements im
          WHERE im.inventory_item_id = ia.inventory_item_id
            AND im.reference_type = 'event'
            AND im.reference_id = NEW.id
            AND im.movement_category IN ('return', 'writeoff')
        ), 0) AS outstanding
      FROM inventory_allocations ia
      JOIN inventory_items ii ON ia.inventory_item_id = ii.id
      WHERE ia.reference_type = 'event'
        AND ia.reference_id = NEW.id
        AND ia.is_active = true
    LOOP
      IF v_alloc.outstanding > 0 THEN
        RAISE EXCEPTION 'Cannot cancel event with outstanding inventory. % has % units outstanding. Process returns/damage/loss first.',
          v_alloc.item_name, v_alloc.outstanding;
      END IF;
    END LOOP;

    UPDATE inventory_allocations
    SET is_active = false, updated_at = now()
    WHERE reference_type = 'event'
      AND reference_id = NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION enforce_event_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_event_lifecycle ON events;
CREATE TRIGGER enforce_event_lifecycle
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_event_lifecycle();

-- ----------------------------------------------------------------
-- E2. check_event_delete   (latest: 023) + inventory history
--     Deleting an event with dishware movements/allocations stranded
--     the stock (references are plain uuids, the ledger is
--     undeletable).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_event_delete()
RETURNS TRIGGER AS $$
DECLARE
  invoice_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invoice_count
  FROM invoices
  WHERE event_id = OLD.id;

  IF invoice_count > 0 THEN
    RAISE EXCEPTION 'This event has % invoice(s) and cannot be deleted. Archive or cancel the event instead.', invoice_count;
  END IF;

  IF EXISTS (SELECT 1 FROM inventory_movements WHERE reference_type = 'event' AND reference_id = OLD.id)
     OR EXISTS (SELECT 1 FROM inventory_allocations WHERE reference_type = 'event' AND reference_id = OLD.id) THEN
    RAISE EXCEPTION 'This event has inventory history and cannot be deleted. Cancel it instead.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- E3. enforce_subscription_lifecycle  (NEW trigger on subscriptions)
--     active <-> paused, active -> cancelled, paused -> cancelled.
--     cancelled is terminal: no status change and no commercial
--     edits (client, outlet, cycle, billing day, dates, quantity,
--     price, next billing date). Notes/questionnaire stay editable.
--     SQL-editor / service-role sessions (auth.uid() IS NULL) exempt.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_subscription_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.outlet_id IS DISTINCT FROM OLD.outlet_id
       OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
       OR NEW.billing_day IS DISTINCT FROM OLD.billing_day
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit
       OR NEW.next_billing_date IS DISTINCT FROM OLD.next_billing_date THEN
      RAISE EXCEPTION 'Cancelled subscriptions cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (OLD.status = 'active' AND NEW.status IN ('paused', 'cancelled')) OR
       (OLD.status = 'paused' AND NEW.status IN ('active', 'cancelled'))
     ) THEN
    RAISE EXCEPTION 'Invalid subscription status change: % → %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS enforce_subscription_lifecycle ON subscriptions;
CREATE TRIGGER enforce_subscription_lifecycle
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_subscription_lifecycle();

-- ----------------------------------------------------------------
-- E4. Client reclassification + validators   (latest: 003 / 004)
--     Changing a client's type or outlet while it has subscriptions,
--     events or invoices left those rows failing their validators on
--     every later UPDATE (even cancellation). Block the change, and
--     make the validators re-check only on INSERT or when client_id /
--     outlet_id change. New/re-pointed rows also require an ACTIVE
--     client.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_client_reclassification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF (NEW.client_type IS DISTINCT FROM OLD.client_type
      OR NEW.outlet_id IS DISTINCT FROM OLD.outlet_id)
     AND (EXISTS (SELECT 1 FROM subscriptions WHERE client_id = OLD.id)
          OR EXISTS (SELECT 1 FROM events WHERE client_id = OLD.id)
          OR EXISTS (SELECT 1 FROM invoices WHERE client_id = OLD.id)) THEN
    RAISE EXCEPTION 'Cannot change the type or outlet of a client that has subscriptions, events or invoices';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION prevent_client_reclassification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_client_reclassification ON clients;
CREATE TRIGGER prevent_client_reclassification
  BEFORE UPDATE OF client_type, outlet_id ON clients
  FOR EACH ROW
  EXECUTE FUNCTION prevent_client_reclassification();

CREATE OR REPLACE FUNCTION validate_subscription_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  client_outlet_id uuid;
  client_type_val client_type;
  client_active boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NEW.outlet_id IS NOT DISTINCT FROM OLD.outlet_id THEN
    RETURN NEW;
  END IF;

  SELECT outlet_id, client_type, is_active
  INTO client_outlet_id, client_type_val, client_active
  FROM clients
  WHERE id = NEW.client_id;

  IF client_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Client does not exist';
  END IF;

  IF NOT client_active THEN
    RAISE EXCEPTION 'Client is inactive';
  END IF;

  IF client_type_val != 'corporate' THEN
    RAISE EXCEPTION 'Only corporate clients can have subscriptions. Event clients cannot have subscriptions.';
  END IF;

  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet. Client outlet: %, Subscription outlet: %',
      client_outlet_id, NEW.outlet_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_event_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  client_outlet_id uuid;
  client_type_val client_type;
  client_active boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NEW.outlet_id IS NOT DISTINCT FROM OLD.outlet_id THEN
    RETURN NEW;
  END IF;

  SELECT outlet_id, client_type, is_active
  INTO client_outlet_id, client_type_val, client_active
  FROM clients
  WHERE id = NEW.client_id;

  IF client_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Client does not exist';
  END IF;

  IF NOT client_active THEN
    RAISE EXCEPTION 'Client is inactive';
  END IF;

  IF client_type_val != 'event' THEN
    RAISE EXCEPTION 'Only event clients can have events. Corporate clients cannot have events.';
  END IF;

  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet. Client outlet: %, Event outlet: %',
      client_outlet_id, NEW.outlet_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- E4b. DATA REPAIR: phantom subscription allocations
--     (runs after E4 so the relaxed subscription validator is in
--     place when the kit is copied onto subscriptions)
--     The old "dishware kit" code inserted inventory_allocations rows
--     for subscriptions WITHOUT an outflow movement, so no stock ever
--     moved, yet the rows showed as pending returns and blocked
--     cancellation. Every real allocation is created by an outflow
--     movement (D5), so allocated_quantity must equal the sum of
--     outflows. Only subscription rows with allocated > outflows are
--     touched. Idempotent.
--       * no outflow at all  -> kit copied to
--         subscriptions.questionnaire->'standard_kit' (only if absent),
--         row closed (is_active = false)
--       * some real outflow  -> allocated_quantity trimmed to
--         GREATEST(outflow, already resolved); closed if nothing is
--         outstanding
--     inventory_items quantities are NOT touched (phantom rows never
--     moved them). If returns were ever booked against phantom stock,
--     allocated_quantity on the item may be understated; that is not
--     guessable and is reported per item in the NOTICE.
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_kits integer;
  v_closed integer;
  v_trimmed integer;
  v_suspect text;
BEGIN
  DROP TABLE IF EXISTS pg_temp._phantom_alloc;
  CREATE TEMP TABLE _phantom_alloc ON COMMIT DROP AS
  SELECT
    ia.id,
    ia.reference_id AS subscription_id,
    ia.inventory_item_id,
    ii.name AS item_name,
    ia.allocated_quantity,
    COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_category = 'outflow'), 0) AS outflow_qty,
    COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_category IN ('return', 'writeoff')), 0) AS resolved_qty
  FROM inventory_allocations ia
  JOIN inventory_items ii ON ii.id = ia.inventory_item_id
  LEFT JOIN inventory_movements im
    ON im.inventory_item_id = ia.inventory_item_id
   AND im.reference_type = ia.reference_type
   AND im.reference_id = ia.reference_id
  WHERE ia.reference_type = 'subscription'
  GROUP BY ia.id, ii.name
  HAVING ia.allocated_quantity >
         COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_category = 'outflow'), 0);

  -- Keep the planned kit as reference data before closing the rows
  UPDATE subscriptions s
  SET questionnaire = COALESCE(s.questionnaire, '{}'::jsonb)
                      || jsonb_build_object('standard_kit', k.kit)
  FROM (
    SELECT subscription_id,
           jsonb_agg(jsonb_build_object(
             'inventory_item_id', inventory_item_id,
             'item_name', item_name,
             'quantity', allocated_quantity) ORDER BY item_name) AS kit
    FROM _phantom_alloc
    WHERE outflow_qty = 0
    GROUP BY subscription_id
  ) k
  WHERE s.id = k.subscription_id
    AND (s.questionnaire IS NULL
         OR (jsonb_typeof(s.questionnaire) = 'object' AND NOT (s.questionnaire ? 'standard_kit')));
  GET DIAGNOSTICS v_kits = ROW_COUNT;

  UPDATE inventory_allocations ia
  SET is_active = false, updated_at = now()
  FROM _phantom_alloc p
  WHERE ia.id = p.id
    AND p.outflow_qty = 0
    AND ia.is_active = true;
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  UPDATE inventory_allocations ia
  SET allocated_quantity = GREATEST(p.outflow_qty, p.resolved_qty),
      is_active = GREATEST(p.outflow_qty, p.resolved_qty) - p.resolved_qty > 0,
      updated_at = now()
  FROM _phantom_alloc p
  WHERE ia.id = p.id
    AND p.outflow_qty > 0
    AND ia.allocated_quantity <> GREATEST(p.outflow_qty, p.resolved_qty);
  GET DIAGNOSTICS v_trimmed = ROW_COUNT;

  SELECT string_agg(DISTINCT item_name || ' (sub ' || subscription_id || ')', ', ')
  INTO v_suspect
  FROM _phantom_alloc
  WHERE resolved_qty > outflow_qty;

  RAISE NOTICE 'Phantom subscription allocations: % kit(s) saved to questionnaire, % row(s) closed, % row(s) trimmed',
    v_kits, v_closed, v_trimmed;
  IF v_suspect IS NOT NULL THEN
    RAISE NOTICE 'Returns were booked against never-dispatched stock for: % -- check those items'' allocated_quantity by hand', v_suspect;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- E5. subscription_price_history.changed_by_name
--     The page embedded user_profiles, which RLS blanks for
--     non-admins. The (SECURITY DEFINER) logging trigger now stores
--     the name. Backfill from user_profiles (idempotent; the
--     append-only guard is lifted only for this one UPDATE).
-- ----------------------------------------------------------------
ALTER TABLE subscription_price_history ADD COLUMN IF NOT EXISTS changed_by_name text;

ALTER TABLE subscription_price_history DISABLE TRIGGER trg_prevent_price_history_update;
UPDATE subscription_price_history h
SET changed_by_name = up.full_name
FROM user_profiles up
WHERE up.id = h.changed_by
  AND h.changed_by_name IS NULL;
ALTER TABLE subscription_price_history ENABLE TRIGGER trg_prevent_price_history_update;

CREATE OR REPLACE FUNCTION log_subscription_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.price_per_unit IS DISTINCT FROM NEW.price_per_unit THEN
    INSERT INTO subscription_price_history (
      subscription_id, old_price, new_price, changed_by, changed_by_name, reason
    ) VALUES (
      NEW.id,
      COALESCE(OLD.price_per_unit, 0),
      COALESCE(NEW.price_per_unit, 0),
      auth.uid(),
      (SELECT up.full_name FROM user_profiles up WHERE up.id = auth.uid()),
      COALESCE(NEW.price_change_reason, 'Price updated')
    );
  END IF;

  NEW.price_change_reason := NULL;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION log_subscription_price_change() FROM PUBLIC, anon, authenticated;


-- ================================================================
-- F. USERS
-- ================================================================

-- ----------------------------------------------------------------
-- F1. record_login()  -- the app calls rpc('record_login') after
--     login and on session restore (was a direct UPDATE whose error
--     was ignored, and restored sessions never recorded a login).
--     Does not bump updated_at: user_profiles gets its own
--     updated_at trigger that ignores last_login-only updates.
--     NOTE for 043: once this ships, users no longer need to write
--     last_login directly; the own-profile UPDATE policy can stop
--     allowing it.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_profiles_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF (to_jsonb(NEW) - 'last_login' - 'updated_at')
     = (to_jsonb(OLD) - 'last_login' - 'updated_at') THEN
    NEW.updated_at := OLD.updated_at;   -- only last_login changed
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION user_profiles_touch_updated_at();

CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE user_profiles
  SET last_login = now()
  WHERE id = auth.uid()
    AND is_active;
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;

-- ----------------------------------------------------------------
-- F2. set_user_outlet_assignments(user, outlets[])
--     Atomic replacement for the browser's delete-then-insert (which
--     could leave a manager with no outlets) and the first writer of
--     assigned_by. Active admins only; target must be a manager;
--     list must be non-empty and every outlet must exist.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_outlet_assignments(
  p_user_id uuid,
  p_outlet_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_target_role user_role;
BEGIN
  IF current_user_role() IS DISTINCT FROM 'admin'::user_role
     OR NOT COALESCE(current_user_is_active(), false) THEN
    RAISE EXCEPTION 'Only active admins can change outlet assignments';
  END IF;

  SELECT role INTO v_target_role
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;              -- serializes concurrent edits of one user

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_role <> 'manager'::user_role THEN
    RAISE EXCEPTION 'Outlets can only be assigned to managers (this user is %)', v_target_role;
  END IF;

  IF p_outlet_ids IS NULL OR cardinality(p_outlet_ids) = 0 THEN
    RAISE EXCEPTION 'At least one outlet is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_outlet_ids) AS x(outlet_id)
    WHERE x.outlet_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM outlets o WHERE o.id = x.outlet_id)
  ) THEN
    RAISE EXCEPTION 'One or more outlets do not exist';
  END IF;

  DELETE FROM user_outlet_assignments
  WHERE user_id = p_user_id
    AND outlet_id <> ALL (p_outlet_ids);

  INSERT INTO user_outlet_assignments (user_id, outlet_id, assigned_by)
  SELECT DISTINCT p_user_id, x.outlet_id, auth.uid()
  FROM unnest(p_outlet_ids) AS x(outlet_id)
  ON CONFLICT (user_id, outlet_id) DO NOTHING;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_user_outlet_assignments(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_outlet_assignments(uuid, uuid[]) TO authenticated;

COMMIT;

-- ================================================================
-- Summary (details in each section header):
-- A  draft-only item writes / draft invoice discard; DB-computed item
--    amounts; collision-free numbering (definer scan, outlet_short
--    running counter, no truncation, exact prefix, scoped legacy
--    floor, IST, draft renumber on date change); event-client and
--    subscription checks; one live invoice per event; no empty
--    finalize; party snapshot; invoices.subscription_id
-- B  IST payment-date rule; payments_with_details.outlet_id;
--    payments_summary()
-- C  fan-out-free client/outlet reports; IST dates; per-day payments;
--    consistent MRR; exact CGST/SGST split; deterministic rate +
--    rate_label; hsn_sac_code on SEZ/Export; honest activity log
-- D  audit RPCs work (ambiguity, reference_id, locks, manager
--    approval, direction); movement validation (live references,
--    reasons, category forced from type); negative adjustments by
--    reason only; opening-balance lock under RLS + default false;
--    movement/damage/audit views; reference_allocation_history
-- E  event + subscription lifecycles; event delete guard; client
--    reclassification guard; phantom kit allocation repair (E4b);
--    price-history names
-- F  record_login(); set_user_outlet_assignments()
-- ================================================================
