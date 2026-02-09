-- ================================================================
-- INVENTORY V2.0 - PHASE 1: FOUNDATION (Non-Breaking Schema Extension)
-- ================================================================
-- Hybits Billing Software
-- Migration: 024_inventory_v2_phase1_foundation.sql
-- Created: 2026-02-09
--
-- PURPOSE:
--   Extend the existing inventory schema with new columns for v2.0
--   WITHOUT changing any existing runtime behaviour.
--
-- PHASE 1 GUARANTEES:
--   ✓ Backward compatible (existing code works unchanged)
--   ✓ Non-breaking (all new columns have safe defaults)
--   ✓ Does not affect billing, subscriptions, or events
--   ✓ Does not replace existing triggers
--   ✓ Safe to deploy to production
--
-- CHANGES IN THIS MIGRATION:
--   1. Add lifecycle_status to inventory_items
--   2. Add opening_balance_confirmed flag to inventory_items
--   3. Add in_repair_quantity column to inventory_items
--   4. Add movement_category to inventory_movements
--   5. Add reason_code to inventory_movements
--   6. Backfill all new columns from existing data
--   7. Create indexes for new columns
--   8. Create migration logging table for audit
--
-- WHAT THIS DOES NOT CHANGE:
--   - Existing triggers remain active and unchanged
--   - is_active column remains and keeps working
--   - movement_type enum remains and keeps working
--   - All RLS policies remain unchanged
--
-- RUN ORDER: After 023_block_hard_deletes.sql
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 0: PRE-FLIGHT CHECKS
-- ================================================================
-- Verify we're working with the expected schema

DO $$
BEGIN
  -- Check inventory_items table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'inventory_items'
  ) THEN
    RAISE EXCEPTION 'inventory_items table not found. Run 008_phase8_inventory.sql first.';
  END IF;
  
  -- Check inventory_movements table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'inventory_movements'
  ) THEN
    RAISE EXCEPTION 'inventory_movements table not found. Run 008_phase8_inventory.sql first.';
  END IF;
  
  RAISE NOTICE 'Pre-flight checks passed. Proceeding with Phase 1 migration.';
END $$;

-- ================================================================
-- STEP 1: CREATE MIGRATION LOGGING TABLE
-- ================================================================
-- Track all changes during migration for audit and potential rollback

CREATE TABLE IF NOT EXISTS inventory_migration_log (
  id SERIAL PRIMARY KEY,
  migration_version TEXT NOT NULL DEFAULT '2.0-phase1',
  table_name TEXT NOT NULL,
  record_id UUID,
  operation TEXT NOT NULL,  -- 'ADD_COLUMN', 'BACKFILL', 'ADD_INDEX', etc.
  column_name TEXT,
  old_value TEXT,
  new_value TEXT,
  affected_rows INTEGER,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by TEXT DEFAULT current_user,
  notes TEXT
);

COMMENT ON TABLE inventory_migration_log IS 'Audit log for Inventory v2.0 migration operations';

-- Log migration start
INSERT INTO inventory_migration_log (table_name, operation, notes)
VALUES ('_migration_', 'START', 'Inventory v2.0 Phase 1 migration started');

-- ================================================================
-- STEP 2: ADD lifecycle_status TO inventory_items
-- ================================================================
-- New lifecycle states: draft, active, discontinued, archived
-- Default 'active' for backward compatibility (existing items are active)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' 
    AND column_name = 'lifecycle_status'
  ) THEN
    -- Add the column with default for new records
    ALTER TABLE inventory_items 
    ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
    
    -- Add check constraint for valid values
    ALTER TABLE inventory_items 
    ADD CONSTRAINT check_lifecycle_status 
    CHECK (lifecycle_status IN ('draft', 'active', 'discontinued', 'archived'));
    
    -- Log the change
    INSERT INTO inventory_migration_log (table_name, operation, column_name, new_value, notes)
    VALUES ('inventory_items', 'ADD_COLUMN', 'lifecycle_status', 'TEXT NOT NULL DEFAULT active', 
            'Added lifecycle_status column with CHECK constraint');
    
    RAISE NOTICE 'Added lifecycle_status column to inventory_items';
  ELSE
    RAISE NOTICE 'lifecycle_status column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN inventory_items.lifecycle_status IS 'Item lifecycle state: draft (new, editable), active (in use), discontinued (phasing out), archived (read-only history)';

-- ================================================================
-- STEP 3: BACKFILL lifecycle_status FROM is_active
-- ================================================================
-- Existing items: is_active=true → 'active', is_active=false → 'discontinued'

DO $$
DECLARE
  v_active_count INTEGER;
  v_discontinued_count INTEGER;
BEGIN
  -- Count items to backfill
  SELECT 
    COUNT(*) FILTER (WHERE is_active = true),
    COUNT(*) FILTER (WHERE is_active = false)
  INTO v_active_count, v_discontinued_count
  FROM inventory_items;
  
  -- Backfill based on is_active
  -- Note: Default is 'active', so only need to update discontinued items
  UPDATE inventory_items 
  SET lifecycle_status = 'discontinued'
  WHERE is_active = false
    AND lifecycle_status = 'active';  -- Only if not already set
  
  -- Log the backfill
  INSERT INTO inventory_migration_log (table_name, operation, column_name, affected_rows, notes)
  VALUES ('inventory_items', 'BACKFILL', 'lifecycle_status', v_discontinued_count,
          format('Backfilled lifecycle_status: %s active, %s discontinued', v_active_count, v_discontinued_count));
  
  RAISE NOTICE 'Backfilled lifecycle_status: % active, % discontinued', v_active_count, v_discontinued_count;
END $$;

-- ================================================================
-- STEP 4: ADD opening_balance_confirmed FLAG
-- ================================================================
-- TRUE = opening balance is locked (cannot be freely corrected)
-- FALSE = still in setup phase (can correct opening balance)
-- Default TRUE for existing items (they're already in production use)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' 
    AND column_name = 'opening_balance_confirmed'
  ) THEN
    ALTER TABLE inventory_items 
    ADD COLUMN opening_balance_confirmed BOOLEAN NOT NULL DEFAULT true;
    
    -- Log the change
    INSERT INTO inventory_migration_log (table_name, operation, column_name, new_value, notes)
    VALUES ('inventory_items', 'ADD_COLUMN', 'opening_balance_confirmed', 'BOOLEAN NOT NULL DEFAULT true',
            'All existing items marked as confirmed (already in use)');
    
    RAISE NOTICE 'Added opening_balance_confirmed column to inventory_items';
  ELSE
    RAISE NOTICE 'opening_balance_confirmed column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN inventory_items.opening_balance_confirmed IS 'TRUE = opening balance locked (in production use), FALSE = can still correct opening balance';

-- ================================================================
-- STEP 5: ADD in_repair_quantity COLUMN
-- ================================================================
-- Track items currently sent for repair
-- Part of the extended quantity balance equation

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' 
    AND column_name = 'in_repair_quantity'
  ) THEN
    ALTER TABLE inventory_items 
    ADD COLUMN in_repair_quantity INTEGER NOT NULL DEFAULT 0;
    
    -- Add check constraint
    ALTER TABLE inventory_items 
    ADD CONSTRAINT check_in_repair_quantity_non_negative 
    CHECK (in_repair_quantity >= 0);
    
    -- Log the change
    INSERT INTO inventory_migration_log (table_name, operation, column_name, new_value, notes)
    VALUES ('inventory_items', 'ADD_COLUMN', 'in_repair_quantity', 'INTEGER NOT NULL DEFAULT 0',
            'Added with CHECK >= 0. Will be included in balance equation in Phase 2.');
    
    RAISE NOTICE 'Added in_repair_quantity column to inventory_items';
  ELSE
    RAISE NOTICE 'in_repair_quantity column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN inventory_items.in_repair_quantity IS 'Items currently sent for repair (not available, not with client)';

-- ================================================================
-- STEP 6: ADD movement_category TO inventory_movements
-- ================================================================
-- New classification layer above movement_type
-- Categories: inflow, outflow, return, writeoff, adjustment, repair

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_movements' 
    AND column_name = 'movement_category'
  ) THEN
    ALTER TABLE inventory_movements 
    ADD COLUMN movement_category TEXT;
    
    -- Log the change
    INSERT INTO inventory_migration_log (table_name, operation, column_name, new_value, notes)
    VALUES ('inventory_movements', 'ADD_COLUMN', 'movement_category', 'TEXT (nullable for backfill)',
            'Will be made NOT NULL after backfill in Phase 2');
    
    RAISE NOTICE 'Added movement_category column to inventory_movements';
  ELSE
    RAISE NOTICE 'movement_category column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN inventory_movements.movement_category IS 'High-level movement classification: inflow, outflow, return, writeoff, adjustment, repair';

-- ================================================================
-- STEP 7: ADD reason_code TO inventory_movements
-- ================================================================
-- Detailed reason for the movement (e.g., opening_balance, client_damage)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_movements' 
    AND column_name = 'reason_code'
  ) THEN
    ALTER TABLE inventory_movements 
    ADD COLUMN reason_code TEXT;
    
    -- Log the change
    INSERT INTO inventory_migration_log (table_name, operation, column_name, new_value, notes)
    VALUES ('inventory_movements', 'ADD_COLUMN', 'reason_code', 'TEXT (nullable)',
            'Optional reason code for detailed classification');
    
    RAISE NOTICE 'Added reason_code column to inventory_movements';
  ELSE
    RAISE NOTICE 'reason_code column already exists, skipping';
  END IF;
END $$;

COMMENT ON COLUMN inventory_movements.reason_code IS 'Specific reason code for the movement (e.g., opening_balance, client_damage, audit_surplus)';

-- ================================================================
-- STEP 8: BACKFILL movement_category FROM movement_type
-- ================================================================
-- Map existing movement_type values to movement_category

DO $$
DECLARE
  v_inflow_count INTEGER;
  v_outflow_count INTEGER;
  v_return_count INTEGER;
  v_writeoff_count INTEGER;
  v_adjustment_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Backfill movement_category based on existing movement_type
  -- Using CASE to map old types to new categories
  UPDATE inventory_movements 
  SET movement_category = CASE
    -- stock_in → inflow
    WHEN movement_type::TEXT = 'stock_in' THEN 'inflow'
    
    -- allocation → outflow
    WHEN movement_type::TEXT = 'allocation' THEN 'outflow'
    
    -- return → return
    WHEN movement_type::TEXT = 'return' THEN 'return'
    
    -- damage, loss → writeoff
    WHEN movement_type::TEXT IN ('damage', 'loss') THEN 'writeoff'
    
    -- adjustment → adjustment
    WHEN movement_type::TEXT = 'adjustment' THEN 'adjustment'
    
    -- Fallback (should never happen)
    ELSE 'unknown'
  END
  WHERE movement_category IS NULL;
  
  -- Count results for logging
  SELECT 
    COUNT(*) FILTER (WHERE movement_category = 'inflow'),
    COUNT(*) FILTER (WHERE movement_category = 'outflow'),
    COUNT(*) FILTER (WHERE movement_category = 'return'),
    COUNT(*) FILTER (WHERE movement_category = 'writeoff'),
    COUNT(*) FILTER (WHERE movement_category = 'adjustment'),
    COUNT(*)
  INTO v_inflow_count, v_outflow_count, v_return_count, v_writeoff_count, v_adjustment_count, v_total_count
  FROM inventory_movements;
  
  -- Log the backfill
  INSERT INTO inventory_migration_log (table_name, operation, column_name, affected_rows, notes)
  VALUES ('inventory_movements', 'BACKFILL', 'movement_category', v_total_count,
          format('Backfilled: inflow=%s, outflow=%s, return=%s, writeoff=%s, adjustment=%s',
                 v_inflow_count, v_outflow_count, v_return_count, v_writeoff_count, v_adjustment_count));
  
  RAISE NOTICE 'Backfilled movement_category: total=%, inflow=%, outflow=%, return=%, writeoff=%, adjustment=%',
    v_total_count, v_inflow_count, v_outflow_count, v_return_count, v_writeoff_count, v_adjustment_count;
END $$;

-- ================================================================
-- STEP 9: BACKFILL reason_code FOR stock_in MOVEMENTS
-- ================================================================
-- For historical stock_in movements, set reason as 'opening_balance' or 'legacy_stock_in'

DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Set reason_code for stock_in movements that don't have one
  -- Assume all existing stock_in are legacy (before we had reason codes)
  UPDATE inventory_movements 
  SET reason_code = 'legacy_stock_in'
  WHERE movement_type::TEXT = 'stock_in'
    AND reason_code IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the backfill
  INSERT INTO inventory_migration_log (table_name, operation, column_name, affected_rows, notes)
  VALUES ('inventory_movements', 'BACKFILL', 'reason_code', v_updated_count,
          'Set reason_code to legacy_stock_in for existing stock_in movements');
  
  RAISE NOTICE 'Backfilled reason_code for % stock_in movements', v_updated_count;
END $$;

-- ================================================================
-- STEP 10: CREATE INDEXES FOR NEW COLUMNS
-- ================================================================

-- Index on lifecycle_status (most queries will filter by status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_inventory_items_lifecycle_status'
  ) THEN
    CREATE INDEX idx_inventory_items_lifecycle_status 
    ON inventory_items(lifecycle_status);
    
    INSERT INTO inventory_migration_log (table_name, operation, column_name, notes)
    VALUES ('inventory_items', 'ADD_INDEX', 'lifecycle_status', 
            'Created index idx_inventory_items_lifecycle_status');
    
    RAISE NOTICE 'Created index idx_inventory_items_lifecycle_status';
  ELSE
    RAISE NOTICE 'Index idx_inventory_items_lifecycle_status already exists, skipping';
  END IF;
END $$;

-- Partial index for active items (most common query pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_inventory_items_active_lifecycle'
  ) THEN
    CREATE INDEX idx_inventory_items_active_lifecycle 
    ON inventory_items(outlet_id, lifecycle_status) 
    WHERE lifecycle_status = 'active';
    
    INSERT INTO inventory_migration_log (table_name, operation, column_name, notes)
    VALUES ('inventory_items', 'ADD_INDEX', 'lifecycle_status', 
            'Created partial index idx_inventory_items_active_lifecycle for active items');
    
    RAISE NOTICE 'Created index idx_inventory_items_active_lifecycle';
  ELSE
    RAISE NOTICE 'Index idx_inventory_items_active_lifecycle already exists, skipping';
  END IF;
END $$;

-- Index on movement_category
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_inventory_movements_category'
  ) THEN
    CREATE INDEX idx_inventory_movements_category 
    ON inventory_movements(movement_category);
    
    INSERT INTO inventory_migration_log (table_name, operation, column_name, notes)
    VALUES ('inventory_movements', 'ADD_INDEX', 'movement_category', 
            'Created index idx_inventory_movements_category');
    
    RAISE NOTICE 'Created index idx_inventory_movements_category';
  ELSE
    RAISE NOTICE 'Index idx_inventory_movements_category already exists, skipping';
  END IF;
END $$;

-- Composite index for movement queries by category and date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_inventory_movements_category_created'
  ) THEN
    CREATE INDEX idx_inventory_movements_category_created 
    ON inventory_movements(movement_category, created_at DESC);
    
    INSERT INTO inventory_migration_log (table_name, operation, column_name, notes)
    VALUES ('inventory_movements', 'ADD_INDEX', 'movement_category, created_at', 
            'Created composite index for category + date queries');
    
    RAISE NOTICE 'Created index idx_inventory_movements_category_created';
  ELSE
    RAISE NOTICE 'Index idx_inventory_movements_category_created already exists, skipping';
  END IF;
END $$;

-- Index on reason_code (for filtering/reporting)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_inventory_movements_reason_code'
  ) THEN
    CREATE INDEX idx_inventory_movements_reason_code 
    ON inventory_movements(reason_code) 
    WHERE reason_code IS NOT NULL;
    
    INSERT INTO inventory_migration_log (table_name, operation, column_name, notes)
    VALUES ('inventory_movements', 'ADD_INDEX', 'reason_code', 
            'Created partial index for non-null reason_code');
    
    RAISE NOTICE 'Created index idx_inventory_movements_reason_code';
  ELSE
    RAISE NOTICE 'Index idx_inventory_movements_reason_code already exists, skipping';
  END IF;
END $$;

-- ================================================================
-- STEP 11: VALIDATION QUERIES
-- ================================================================
-- Verify the migration completed successfully

DO $$
DECLARE
  v_items_with_lifecycle INTEGER;
  v_items_without_lifecycle INTEGER;
  v_movements_with_category INTEGER;
  v_movements_without_category INTEGER;
  v_constraint_exists BOOLEAN;
BEGIN
  -- Check all items have lifecycle_status
  SELECT 
    COUNT(*) FILTER (WHERE lifecycle_status IS NOT NULL),
    COUNT(*) FILTER (WHERE lifecycle_status IS NULL)
  INTO v_items_with_lifecycle, v_items_without_lifecycle
  FROM inventory_items;
  
  IF v_items_without_lifecycle > 0 THEN
    RAISE WARNING 'Found % items without lifecycle_status', v_items_without_lifecycle;
  END IF;
  
  -- Check all movements have movement_category
  SELECT 
    COUNT(*) FILTER (WHERE movement_category IS NOT NULL),
    COUNT(*) FILTER (WHERE movement_category IS NULL)
  INTO v_movements_with_category, v_movements_without_category
  FROM inventory_movements;
  
  IF v_movements_without_category > 0 THEN
    RAISE WARNING 'Found % movements without movement_category', v_movements_without_category;
  END IF;
  
  -- Verify constraint exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'check_lifecycle_status'
  ) INTO v_constraint_exists;
  
  IF NOT v_constraint_exists THEN
    RAISE WARNING 'check_lifecycle_status constraint not found';
  END IF;
  
  -- Log validation results
  INSERT INTO inventory_migration_log (table_name, operation, notes)
  VALUES ('_validation_', 'VALIDATE', 
          format('Items: %s with lifecycle, %s without. Movements: %s with category, %s without. Constraint exists: %s',
                 v_items_with_lifecycle, v_items_without_lifecycle,
                 v_movements_with_category, v_movements_without_category,
                 v_constraint_exists));
  
  RAISE NOTICE 'Validation complete: Items lifecycle=%, Movements category=%', 
    v_items_with_lifecycle, v_movements_with_category;
END $$;

-- ================================================================
-- STEP 12: SUMMARY AND COMPLETION
-- ================================================================

-- Log migration completion
INSERT INTO inventory_migration_log (table_name, operation, notes)
VALUES ('_migration_', 'COMPLETE', 'Inventory v2.0 Phase 1 migration completed successfully');

-- Final summary
DO $$
DECLARE
  v_item_count INTEGER;
  v_movement_count INTEGER;
  v_log_entries INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_item_count FROM inventory_items;
  SELECT COUNT(*) INTO v_movement_count FROM inventory_movements;
  SELECT COUNT(*) INTO v_log_entries FROM inventory_migration_log WHERE migration_version = '2.0-phase1';
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'INVENTORY V2.0 PHASE 1 MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'CHANGES APPLIED:';
  RAISE NOTICE '  ✓ Added lifecycle_status to inventory_items (% items)', v_item_count;
  RAISE NOTICE '  ✓ Added opening_balance_confirmed to inventory_items';
  RAISE NOTICE '  ✓ Added in_repair_quantity to inventory_items';
  RAISE NOTICE '  ✓ Added movement_category to inventory_movements (% movements)', v_movement_count;
  RAISE NOTICE '  ✓ Added reason_code to inventory_movements';
  RAISE NOTICE '  ✓ Created % new indexes', 5;
  RAISE NOTICE '  ✓ Backfilled all new columns from existing data';
  RAISE NOTICE '  ✓ Created migration_log with % entries', v_log_entries;
  RAISE NOTICE '';
  RAISE NOTICE 'WHAT REMAINS UNCHANGED:';
  RAISE NOTICE '  • All existing triggers (validate_movement, update_inventory_quantities, etc.)';
  RAISE NOTICE '  • is_active column (still works, deprecated in Phase 2)';
  RAISE NOTICE '  • movement_type enum (still works)';
  RAISE NOTICE '  • All RLS policies';
  RAISE NOTICE '  • quantity_balance constraint (updated in Phase 2 with in_repair)';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS (Phase 2):';
  RAISE NOTICE '  • Replace triggers to use lifecycle_status and movement_category';
  RAISE NOTICE '  • Update quantity_balance constraint to include in_repair_quantity';
  RAISE NOTICE '  • Deprecate is_active column';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- ================================================================
-- Uncomment and run this section to rollback Phase 1 changes
-- 
-- BEGIN;
-- 
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_inventory_movements_reason_code;
-- DROP INDEX IF EXISTS idx_inventory_movements_category_created;
-- DROP INDEX IF EXISTS idx_inventory_movements_category;
-- DROP INDEX IF EXISTS idx_inventory_items_active_lifecycle;
-- DROP INDEX IF EXISTS idx_inventory_items_lifecycle_status;
-- 
-- -- Drop constraints
-- ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS check_in_repair_quantity_non_negative;
-- ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS check_lifecycle_status;
-- 
-- -- Drop columns from inventory_movements
-- ALTER TABLE inventory_movements DROP COLUMN IF EXISTS reason_code;
-- ALTER TABLE inventory_movements DROP COLUMN IF EXISTS movement_category;
-- 
-- -- Drop columns from inventory_items
-- ALTER TABLE inventory_items DROP COLUMN IF EXISTS in_repair_quantity;
-- ALTER TABLE inventory_items DROP COLUMN IF EXISTS opening_balance_confirmed;
-- ALTER TABLE inventory_items DROP COLUMN IF EXISTS lifecycle_status;
-- 
-- -- Keep migration log for audit trail
-- -- DROP TABLE IF EXISTS inventory_migration_log;
-- 
-- COMMIT;
-- ================================================================
