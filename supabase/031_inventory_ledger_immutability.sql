-- ============================================================================
-- MIGRATION: 031_inventory_ledger_immutability.sql
-- ============================================================================
-- PURPOSE: Enforce append-only (ledger immutability) on inventory_movements
--
-- CONTEXT:
--   The inventory_movements table is documented as "SINGLE SOURCE OF TRUTH"
--   and "immutable audit trail" (008_phase8_inventory.sql, line 113-114).
--   However, no BEFORE UPDATE trigger existed to enforce this.
--
--   DELETE was already blocked by 023_block_hard_deletes.sql.
--   UPDATE was completely unprotected — admin RLS granted FOR ALL access.
--
-- WHAT THIS DOES:
--   1. Adds BEFORE UPDATE trigger → blocks all updates with clear error
--   2. Narrows admin RLS from FOR ALL to INSERT + SELECT only
--   3. Adds performance indexes for outstanding calculation queries
--
-- WHAT THIS DOES NOT CHANGE:
--   - Existing triggers (validate_v2, quantity_update_v2, sync_allocation, etc.)
--   - INSERT behavior (completely unchanged)
--   - SELECT behavior (completely unchanged)
--   - DELETE block trigger from 023 (remains active)
--   - Manager and accountant RLS policies (already correct)
--
-- DEPENDENCIES VERIFIED:
--   - inventoryMovementService.ts: INSERT + SELECT only ✓
--   - inventoryMovementServiceV2.ts: INSERT + SELECT only ✓
--   - inventoryService.ts: INSERT only (stock_in) ✓
--   - submit_inventory_audit(): INSERT only ✓
--   - approve_inventory_audit(): INSERT only ✓
--   Zero breaking changes.
--
-- RUN ORDER: After 030b_migrate_data.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: BLOCK UPDATE ON INVENTORY_MOVEMENTS
-- ============================================================================
-- This is the critical missing piece. The DELETE trigger from 023 blocks
-- deletions, but UPDATE was completely open. This seals that gap.
--
-- Error message guides the user toward the correct pattern: create a new
-- corrective movement (adjustment) instead of mutating history.

CREATE OR REPLACE FUNCTION prevent_inventory_movement_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 
      'Inventory movements are immutable and cannot be updated. '
      'Create a new corrective movement (adjustment) instead. '
      'Movement ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_inventory_movement_update() IS 
    'Blocks all UPDATE operations on inventory_movements to enforce ledger immutability';

DROP TRIGGER IF EXISTS block_inventory_movement_update ON inventory_movements;

CREATE TRIGGER block_inventory_movement_update
    BEFORE UPDATE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_movement_update();

COMMENT ON TRIGGER block_inventory_movement_update ON inventory_movements IS 
    'Enforces ledger immutability: movements cannot be modified after creation. Use corrective movements instead.';

-- ============================================================================
-- STEP 2: NARROW ADMIN RLS POLICY
-- ============================================================================
-- The existing admin_inventory_movements_all policy uses FOR ALL, which
-- grants SELECT, INSERT, UPDATE, and DELETE at the RLS level.
--
-- Even with the trigger blocking UPDATE and DELETE, belt-and-suspenders
-- security means RLS should also restrict to only the operations needed.
--
-- Admin needs: INSERT (create movements) + SELECT (read all movements)
-- Admin does NOT need: UPDATE (immutable) or DELETE (blocked by 023)

DROP POLICY IF EXISTS admin_inventory_movements_all ON inventory_movements;

-- Admin: INSERT new movements
CREATE POLICY admin_inventory_movements_insert
  ON inventory_movements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- Admin: SELECT all movements (read-only access to full history)
CREATE POLICY admin_inventory_movements_select
  ON inventory_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- ============================================================================
-- STEP 3: ADD PERFORMANCE INDEXES
-- ============================================================================
-- As the movements table grows (append-only = monotonically growing),
-- these indexes optimize the most common query patterns.

-- 3a: Covering index for outstanding quantity derivation
-- Used by: validate_movement_v2(), sync_allocation_on_movement(),
--          inventory_allocations_with_details view
-- These queries filter on all 4 columns simultaneously.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_movements_outstanding_calc'
  ) THEN
    CREATE INDEX idx_movements_outstanding_calc
      ON inventory_movements(inventory_item_id, reference_type, reference_id, movement_category);
    
    RAISE NOTICE 'Created index idx_movements_outstanding_calc';
  ELSE
    RAISE NOTICE 'Index idx_movements_outstanding_calc already exists, skipping';
  END IF;
END $$;

-- 3b: BRIN index for time-range scans
-- Since movements are append-only, created_at is monotonically increasing.
-- BRIN indexes are ~100x smaller than B-tree for this pattern and perform
-- comparably for range scans (date filters on reports/movements page).
-- Coexists with the existing B-tree index on created_at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_movements_created_brin'
  ) THEN
    CREATE INDEX idx_movements_created_brin
      ON inventory_movements USING BRIN (created_at);
    
    RAISE NOTICE 'Created index idx_movements_created_brin';
  ELSE
    RAISE NOTICE 'Index idx_movements_created_brin already exists, skipping';
  END IF;
END $$;

-- 3c: Composite index for outlet-scoped item lookups
-- Used by: reports page, movement history filtered by outlet + item
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_movements_outlet_item'
  ) THEN
    CREATE INDEX idx_movements_outlet_item
      ON inventory_movements(outlet_id, inventory_item_id);
    
    RAISE NOTICE 'Created index idx_movements_outlet_item';
  ELSE
    RAISE NOTICE 'Index idx_movements_outlet_item already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: LOG MIGRATION
-- ============================================================================

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('hardening-1', 'inventory_movements', 'ADD_TRIGGER', 
        'Added BEFORE UPDATE trigger (block_inventory_movement_update) to enforce ledger immutability');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('hardening-1', 'inventory_movements', 'NARROW_RLS', 
        'Replaced admin_inventory_movements_all (FOR ALL) with separate INSERT + SELECT policies');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('hardening-1', 'inventory_movements', 'ADD_INDEX', 
        'Added idx_movements_outstanding_calc (composite covering index for outstanding derivation)');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('hardening-1', 'inventory_movements', 'ADD_INDEX', 
        'Added idx_movements_created_brin (BRIN index for time-range scans on append-only table)');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('hardening-1', 'inventory_movements', 'ADD_INDEX', 
        'Added idx_movements_outlet_item (composite for outlet-scoped item queries)');

-- ============================================================================
-- STEP 5: VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_update_trigger BOOLEAN;
  v_delete_trigger BOOLEAN;
  v_admin_all_exists BOOLEAN;
  v_admin_insert_exists BOOLEAN;
  v_admin_select_exists BOOLEAN;
  v_idx_outstanding BOOLEAN;
  v_idx_brin BOOLEAN;
  v_idx_outlet_item BOOLEAN;
BEGIN
  -- Verify UPDATE trigger exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'block_inventory_movement_update'
      AND event_manipulation = 'UPDATE'
      AND event_object_table = 'inventory_movements'
  ) INTO v_update_trigger;
  
  -- Verify DELETE trigger still exists (from 023)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'block_inventory_movement_delete'
      AND event_manipulation = 'DELETE'
      AND event_object_table = 'inventory_movements'
  ) INTO v_delete_trigger;
  
  -- Verify admin FOR ALL policy is gone
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_movements'
      AND policyname = 'admin_inventory_movements_all'
  ) INTO v_admin_all_exists;
  
  -- Verify new admin policies exist
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_movements'
      AND policyname = 'admin_inventory_movements_insert'
  ) INTO v_admin_insert_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_movements'
      AND policyname = 'admin_inventory_movements_select'
  ) INTO v_admin_select_exists;
  
  -- Verify indexes
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_movements_outstanding_calc'
  ) INTO v_idx_outstanding;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_movements_created_brin'
  ) INTO v_idx_brin;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_movements_outlet_item'
  ) INTO v_idx_outlet_item;
  
  -- Report results
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'INVENTORY LEDGER IMMUTABILITY MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'TRIGGERS:';
  
  IF v_update_trigger THEN
    RAISE NOTICE '  ✓ UPDATE blocked (block_inventory_movement_update)';
  ELSE
    RAISE WARNING '  ✗ UPDATE trigger NOT FOUND';
  END IF;
  
  IF v_delete_trigger THEN
    RAISE NOTICE '  ✓ DELETE blocked (block_inventory_movement_delete from 023)';
  ELSE
    RAISE WARNING '  ✗ DELETE trigger NOT FOUND';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'RLS POLICIES:';
  
  IF NOT v_admin_all_exists THEN
    RAISE NOTICE '  ✓ admin FOR ALL policy removed';
  ELSE
    RAISE WARNING '  ✗ admin FOR ALL policy still exists!';
  END IF;
  
  IF v_admin_insert_exists THEN
    RAISE NOTICE '  ✓ admin INSERT policy created';
  ELSE
    RAISE WARNING '  ✗ admin INSERT policy NOT FOUND';
  END IF;
  
  IF v_admin_select_exists THEN
    RAISE NOTICE '  ✓ admin SELECT policy created';
  ELSE
    RAISE WARNING '  ✗ admin SELECT policy NOT FOUND';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'INDEXES:';
  
  IF v_idx_outstanding THEN
    RAISE NOTICE '  ✓ idx_movements_outstanding_calc';
  ELSE
    RAISE WARNING '  ✗ idx_movements_outstanding_calc NOT FOUND';
  END IF;
  
  IF v_idx_brin THEN
    RAISE NOTICE '  ✓ idx_movements_created_brin';
  ELSE
    RAISE WARNING '  ✗ idx_movements_created_brin NOT FOUND';
  END IF;
  
  IF v_idx_outlet_item THEN
    RAISE NOTICE '  ✓ idx_movements_outlet_item';
  ELSE
    RAISE WARNING '  ✗ idx_movements_outlet_item NOT FOUND';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'INVENTORY_MOVEMENTS PROTECTION SUMMARY:';
  RAISE NOTICE '  INSERT:  ✓ Allowed (validated by validate_movement_v2)';
  RAISE NOTICE '  SELECT:  ✓ Allowed (all roles via RLS)';
  RAISE NOTICE '  UPDATE:  ✗ Blocked (trigger + RLS)';
  RAISE NOTICE '  DELETE:  ✗ Blocked (trigger from 023 + RLS)';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- ============================================================================
-- Uncomment and run to reverse this migration:
--
-- BEGIN;
--
-- -- Remove UPDATE trigger
-- DROP TRIGGER IF EXISTS block_inventory_movement_update ON inventory_movements;
-- DROP FUNCTION IF EXISTS prevent_inventory_movement_update();
--
-- -- Remove new admin policies
-- DROP POLICY IF EXISTS admin_inventory_movements_insert ON inventory_movements;
-- DROP POLICY IF EXISTS admin_inventory_movements_select ON inventory_movements;
--
-- -- Restore original admin FOR ALL policy
-- CREATE POLICY admin_inventory_movements_all
--   ON inventory_movements
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_profiles
--       WHERE id = auth.uid()
--         AND role = 'admin'
--         AND is_active = true
--     )
--   );
--
-- -- Drop performance indexes
-- DROP INDEX IF EXISTS idx_movements_outstanding_calc;
-- DROP INDEX IF EXISTS idx_movements_created_brin;
-- DROP INDEX IF EXISTS idx_movements_outlet_item;
--
-- COMMIT;
-- ============================================================================
