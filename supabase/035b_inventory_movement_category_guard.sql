-- ================================================================
-- MIGRATION 035b: MOVEMENT_CATEGORY GUARD + DATA REPAIR
-- ================================================================
-- PREREQUISITE: 035a_add_movement_type_values.sql must be committed.
--
-- BUG BEING FIXED:
--   Since the V2 behaviour migration (025), every trigger branches on
--   movement_category — but the column was left NULLable and the old
--   V1 frontend services insert movements WITHOUT it. For those rows:
--     • validate_movement_v2()  → every category check silently skipped
--       (no stock-availability check, no lifecycle check, no
--       outstanding-quantity check)
--     • quantity updates        → still applied via the movement_type
--       fallback (so bucket counts stayed correct)
--     • outstanding math        → views and validations compute
--       "resolved" as SUM(...) WHERE movement_category IN
--       ('return','writeoff'), so V1 returns/damage/loss are INVISIBLE:
--       outstanding stays too high, allocations never auto-close, and
--       over-returning becomes possible
--     • opening-balance lock    → skipped for V1 allocations
--
-- FIX (defence in depth):
--   1. BEFORE INSERT trigger derives movement_category from
--      movement_type whenever it is missing → a V1-style insert can
--      never bypass V2 logic again.
--   2. Backfill existing NULL movement_category rows.
--   3. Make movement_category NOT NULL.
--   4. Rewrite sync_allocation_on_movement() (008) to use
--      movement_category, so allocation auto-close agrees with the
--      V2 outstanding math (incl. return_damaged and disposal).
--   5. Data repair: close allocations that are already fully resolved
--      but were left open because V1 returns were invisible.
--
-- The frontend is also being repointed to the V2 services in the same
-- release, so this migration is the safety net, not the only fix.
-- ================================================================

BEGIN;

-- ================================================================
-- 1. DERIVE movement_category ON INSERT WHEN MISSING
-- ================================================================
-- Trigger name starts with 'derive' so it fires before
-- 'validate_movement_v2_trigger' (BEFORE INSERT triggers fire in
-- alphabetical order).

CREATE OR REPLACE FUNCTION derive_movement_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_category IS NULL THEN
    NEW.movement_category := CASE NEW.movement_type::TEXT
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

    IF NEW.movement_category IS NULL THEN
      RAISE EXCEPTION 'Cannot derive movement_category from movement_type "%". Provide movement_category explicitly.',
        NEW.movement_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION derive_movement_category() IS
  'Fills movement_category from movement_type when omitted, so no insert can bypass V2 category-based triggers.';

DROP TRIGGER IF EXISTS derive_movement_category_trigger ON inventory_movements;
CREATE TRIGGER derive_movement_category_trigger
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION derive_movement_category();

-- ================================================================
-- 2. BACKFILL EXISTING NULL ROWS
-- ================================================================
-- The ledger is UPDATE-blocked (031). This is a metadata-only
-- classification fix (quantities and audit facts untouched), so we
-- disable the immutability trigger for the duration of this
-- transaction only.

ALTER TABLE inventory_movements DISABLE TRIGGER block_inventory_movement_update;

DO $$
DECLARE
  v_backfilled integer;
BEGIN
  UPDATE inventory_movements
  SET movement_category = CASE movement_type::TEXT
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
    ELSE 'adjustment'  -- unreachable given the enum; satisfies NOT NULL
  END
  WHERE movement_category IS NULL;

  GET DIAGNOSTICS v_backfilled = ROW_COUNT;

  INSERT INTO inventory_migration_log (migration_version, table_name, operation, column_name, affected_rows, notes)
  VALUES ('guard-1', 'inventory_movements', 'BACKFILL', 'movement_category', v_backfilled,
          'Backfilled NULL movement_category rows created by V1 code paths after 025');

  RAISE NOTICE 'Backfilled movement_category on % movement(s)', v_backfilled;
END $$;

ALTER TABLE inventory_movements ENABLE TRIGGER block_inventory_movement_update;

-- ================================================================
-- 3. ENFORCE NOT NULL
-- ================================================================

ALTER TABLE inventory_movements
  ALTER COLUMN movement_category SET NOT NULL;

-- ================================================================
-- 4. ALIGN ALLOCATION SYNC WITH V2 OUTSTANDING MATH
-- ================================================================
-- The 008 version keyed on movement_type IN ('allocation','return',
-- 'damage','loss') — it missed 'return_damaged' and 'disposal', so
-- allocations would never auto-close once a damaged return was
-- involved. Rewritten on movement_category to match the view and
-- validate_movement_v2() exactly. Same function name; the existing
-- sync_allocation_trigger keeps pointing at it.

CREATE OR REPLACE FUNCTION sync_allocation_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_allocated_qty INTEGER;
  v_total_resolved INTEGER;
BEGIN
  IF NEW.reference_type IN ('subscription', 'event') THEN

    -- New allocation: create or top up the allocation record
    IF NEW.movement_category = 'outflow' THEN
      INSERT INTO inventory_allocations (
        outlet_id,
        inventory_item_id,
        reference_type,
        reference_id,
        allocated_quantity,
        is_active
      ) VALUES (
        NEW.outlet_id,
        NEW.inventory_item_id,
        NEW.reference_type,
        NEW.reference_id,
        NEW.quantity,
        true
      )
      ON CONFLICT (inventory_item_id, reference_type, reference_id)
      DO UPDATE SET
        allocated_quantity = inventory_allocations.allocated_quantity + NEW.quantity,
        is_active = true,
        updated_at = now();
    END IF;

    -- Return / writeoff: close the allocation once fully resolved
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

        -- <= 0 (not = 0) so historical over-returns still close out
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

COMMENT ON FUNCTION sync_allocation_on_movement() IS
  'Synchronizes inventory_allocations with movements (movement_category based, matches V2 outstanding math)';

-- ================================================================
-- 5. DATA REPAIR: CLOSE ALREADY-RESOLVED ALLOCATIONS
-- ================================================================
-- Now that V1 returns/damage/loss rows are classified, close any
-- allocation whose resolved total already covers the allocated
-- quantity but which was left open.

DO $$
DECLARE
  v_closed integer;
BEGIN
  UPDATE inventory_allocations ia
  SET is_active = false, updated_at = now()
  WHERE ia.is_active = true
    AND ia.allocated_quantity <= COALESCE((
      SELECT SUM(im.quantity)
      FROM inventory_movements im
      WHERE im.inventory_item_id = ia.inventory_item_id
        AND im.reference_type = ia.reference_type
        AND im.reference_id = ia.reference_id
        AND im.movement_category IN ('return', 'writeoff')
    ), 0);

  GET DIAGNOSTICS v_closed = ROW_COUNT;

  INSERT INTO inventory_migration_log (migration_version, table_name, operation, affected_rows, notes)
  VALUES ('guard-1', 'inventory_allocations', 'REPAIR', v_closed,
          'Closed allocations already fully resolved (V1 returns were invisible to outstanding math)');

  RAISE NOTICE 'Closed % fully-resolved allocation(s)', v_closed;
END $$;

-- ================================================================
-- 6. VERIFICATION
-- ================================================================

DO $$
DECLARE
  v_null_count integer;
  v_derive_trigger boolean;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM inventory_movements
  WHERE movement_category IS NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'derive_movement_category_trigger'
      AND event_object_table = 'inventory_movements'
  ) INTO v_derive_trigger;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Verification failed: % movements still have NULL movement_category', v_null_count;
  END IF;

  IF NOT v_derive_trigger THEN
    RAISE EXCEPTION 'Verification failed: derive_movement_category_trigger not found';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'MOVEMENT_CATEGORY GUARD MIGRATION COMPLETE';
  RAISE NOTICE '  ✓ derive trigger active (fires before validation)';
  RAISE NOTICE '  ✓ all movements classified, column NOT NULL';
  RAISE NOTICE '  ✓ allocation sync aligned with V2 outstanding math';
  RAISE NOTICE '  ✓ fully-resolved allocations closed';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

COMMIT;
