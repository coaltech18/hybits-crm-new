-- ================================================================
-- MIGRATION 041: PAYMENT CONCURRENCY + RLS / GUARD HARDENING
-- ================================================================
-- Four independent fixes, smallest-first. All are idempotent.
--
-- 1. prevent_overpayment() had no row lock.
-- 2. check_inventory_item_delete() queried a column that does not exist.
-- 3. inventory_migration_log was the only table without RLS.
-- 4. The invoice_items manager policy checked outlet but not role.
--
-- RUN ORDER: after 023 and 035b. Independent of 038/039/040.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. SERIALIZE PAYMENTS AGAINST THE SAME INVOICE
-- ----------------------------------------------------------------
-- BUG: the current version (018) reads the invoice total and the sum
--   of existing payments with plain SELECTs. Two payments inserted
--   concurrently against one invoice both read the same
--   existing_payments, both pass the check, and the invoice ends up
--   overpaid. 032 fixed exactly this class of race for inventory and
--   036 for invoice numbers; payments were the money path that never
--   got it.
--
-- FIX: lock the invoice row with FOR UPDATE before summing. The
--   second transaction blocks until the first commits, then re-reads
--   and sees the committed payment. The lock releases at commit.
--   FOR UPDATE also gives us the existence check for free, so 018's
--   separate EXISTS query is folded in.

CREATE OR REPLACE FUNCTION prevent_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric(12,2);
  existing_payments numeric(12,2);
  new_total numeric(12,2);
  tolerance numeric(12,2) := 0.05;
BEGIN
  -- Lock the invoice row. Serializes concurrent payments against it
  -- and confirms the invoice exists in one statement.
  SELECT grand_total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice does not exist: %', NEW.invoice_id;
  END IF;

  -- Safe to sum now: no other payment for this invoice can commit
  -- between this read and our commit.
  SELECT ROUND(COALESCE(SUM(amount), 0), 2) INTO existing_payments
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  new_total := ROUND(existing_payments + NEW.amount, 2);

  IF new_total > (invoice_total + tolerance) THEN
    RAISE EXCEPTION 'Payment rejected: Total payments (% + %) = % exceeds invoice total %',
      existing_payments, NEW.amount, new_total, invoice_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 2. FIX THE INVENTORY ITEM DELETE GUARD
-- ----------------------------------------------------------------
-- BUG: 023 wrote "WHERE item_id = OLD.id". inventory_movements has
--   no item_id column -- it is inventory_item_id. Every delete of an
--   inventory item therefore failed with "column item_id does not
--   exist" instead of either succeeding or giving the intended
--   message. Accidentally safe, but the legitimate delete path (an
--   item with no movements) was unreachable.

CREATE OR REPLACE FUNCTION check_inventory_item_delete()
RETURNS TRIGGER AS $$
DECLARE
    movement_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO movement_count
    FROM inventory_movements
    WHERE inventory_item_id = OLD.id;   -- was: item_id

    IF movement_count > 0 THEN
        RAISE EXCEPTION 'This inventory item has % movement record(s) and cannot be deleted. Mark the item as inactive instead by setting is_active = false.', movement_count;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 3. RLS ON inventory_migration_log
-- ----------------------------------------------------------------
-- The only table in the schema with RLS never enabled. It holds
-- migration bookkeeping rather than tenant data, so the exposure is
-- low, but "every table has RLS" should be true without exceptions
-- so the gap is never mistaken for intent.

ALTER TABLE inventory_migration_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_migration_log ON inventory_migration_log;
CREATE POLICY admins_read_migration_log
ON inventory_migration_log
FOR SELECT
USING (
  current_user_role() = 'admin'::user_role
  AND current_user_is_active() = true
);

-- No INSERT/UPDATE/DELETE policy: writes come from migration scripts
-- running as the table owner, which bypasses RLS.

-- ----------------------------------------------------------------
-- 4. ROLE CHECK ON THE invoice_items MANAGER POLICY
-- ----------------------------------------------------------------
-- The existing policy is FOR ALL TO authenticated and gates only on
-- the outlet-assignment subquery. It is safe today purely because
-- non-managers have no rows in user_outlet_assignments -- so the
-- moment anyone assigns an outlet to an accountant, that accountant
-- silently gains write access to invoice line items. Make the role
-- requirement explicit rather than emergent.

DROP POLICY IF EXISTS "managers_access_own_outlet_invoice_items" ON invoice_items;
CREATE POLICY "managers_access_own_outlet_invoice_items"
ON invoice_items FOR ALL TO authenticated
USING (
  current_user_role() = 'manager'::user_role
  AND current_user_is_active() = true
  AND invoice_id IN (
    SELECT id FROM invoices
    WHERE outlet_id IN (
      SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
    )
  )
);

-- ================================================================
-- Summary:
-- ✅ Concurrent payments against one invoice are serialized
-- ✅ Inventory item delete guard actually runs
-- ✅ Every table now has RLS enabled
-- ✅ invoice_items manager access requires the manager role
-- ================================================================
