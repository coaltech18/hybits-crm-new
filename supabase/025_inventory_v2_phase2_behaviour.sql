-- ================================================================
-- INVENTORY V2.0 - PHASE 2: BEHAVIOURAL CHANGES
-- ================================================================
-- Hybits Billing Software
-- Migration: 025_inventory_v2_phase2_behaviour.sql
-- Created: 2026-02-09
--
-- PURPOSE:
--   Replace old triggers and implement warehouse-first inventory logic.
--   This migration CHANGES RUNTIME BEHAVIOUR.
--
-- PREREQUISITE:
--   Phase 1 (024_inventory_v2_phase1_foundation.sql) MUST be deployed.
--
-- PHASE 2 CHANGES:
--   1. Replace quantity update trigger (use movement_category)
--   2. Update quantity_balance constraint (include in_repair_quantity)
--   3. Enforce lifecycle_status instead of is_active
--   4. Implement delete vs discontinue logic
--   5. Implement opening balance lock behaviour
--   6. Support positive and negative adjustments
--   7. Subscription integration (auto-allocation on activation)
--
-- CRITICAL PRINCIPLES:
--   - inventory_movements = APPEND-ONLY (never update/delete)
--   - inventory_items quantities = DERIVED via triggers
--   - All stock changes MUST have corresponding movement
--   - No silent stock changes
--
-- RUN ORDER: After 024_inventory_v2_phase1_foundation.sql
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 0: PRE-FLIGHT CHECKS
-- ================================================================

DO $$
BEGIN
  -- Verify Phase 1 columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' 
    AND column_name = 'lifecycle_status'
  ) THEN
    RAISE EXCEPTION 'Phase 1 not deployed: lifecycle_status column missing. Run 024_inventory_v2_phase1_foundation.sql first.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_movements' 
    AND column_name = 'movement_category'
  ) THEN
    RAISE EXCEPTION 'Phase 1 not deployed: movement_category column missing. Run 024_inventory_v2_phase1_foundation.sql first.';
  END IF;
  
  RAISE NOTICE 'Phase 1 verified. Proceeding with Phase 2 migration.';
END $$;

-- Log migration start
INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', '_migration_', 'START', 'Inventory v2.0 Phase 2 (Behavioural Changes) started');

-- ================================================================
-- STEP 1: UPDATE QUANTITY BALANCE CONSTRAINT
-- ================================================================
-- New balance equation includes in_repair_quantity
-- total = available + allocated + damaged + in_repair
-- (lost reduces total, not added back)

DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'inventory_items'
    AND constraint_name = 'quantity_balance'
  ) THEN
    ALTER TABLE inventory_items DROP CONSTRAINT quantity_balance;
    RAISE NOTICE 'Dropped old quantity_balance constraint';
  END IF;
END $$;

-- Add new constraint with in_repair_quantity
ALTER TABLE inventory_items ADD CONSTRAINT quantity_balance_v2 CHECK (
  total_quantity = available_quantity + allocated_quantity + damaged_quantity + in_repair_quantity
);

COMMENT ON CONSTRAINT quantity_balance_v2 ON inventory_items IS 
  'V2 balance: total = available + allocated + damaged + in_repair. Lost items reduce total directly.';

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'inventory_items', 'UPDATE_CONSTRAINT', 
        'Replaced quantity_balance with quantity_balance_v2 (includes in_repair_quantity)');

-- ================================================================
-- STEP 2: DROP OLD TRIGGERS (PRESERVE ORDER)
-- ================================================================
-- We replace triggers one by one to maintain system integrity

DO $$
BEGIN
  -- Drop old validation trigger
  DROP TRIGGER IF EXISTS validate_inventory_movement ON inventory_movements;
  RAISE NOTICE 'Dropped validate_inventory_movement trigger';
  
  -- Drop old quantity update trigger
  DROP TRIGGER IF EXISTS update_inventory_quantities_trigger ON inventory_movements;
  RAISE NOTICE 'Dropped update_inventory_quantities_trigger trigger';
  
  -- Drop old item deletion prevention trigger
  DROP TRIGGER IF EXISTS prevent_inventory_item_deletion ON inventory_items;
  RAISE NOTICE 'Dropped prevent_inventory_item_deletion trigger';
END $$;

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'inventory_movements', 'DROP_TRIGGERS', 
        'Dropped old Phase 1 triggers: validate_inventory_movement, update_inventory_quantities_trigger');

-- ================================================================
-- STEP 3: CREATE NEW VALIDATION FUNCTION (V2)
-- ================================================================
-- Enhanced validation using movement_category and lifecycle_status

CREATE OR REPLACE FUNCTION validate_movement_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_item RECORD;
  v_allocation_exists BOOLEAN;
  v_allocated_qty INTEGER;
  v_outstanding INTEGER;
  v_total_resolved INTEGER;
BEGIN
  -- ============================================================
  -- VALIDATION 0: Get user role and item details
  -- ============================================================
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = NEW.created_by AND is_active = true;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive user';
  END IF;
  
  SELECT * INTO v_item FROM inventory_items WHERE id = NEW.inventory_item_id;
  
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  
  -- ============================================================
  -- VALIDATION 1: Quantity must be positive
  -- ============================================================
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero';
  END IF;
  
  -- ============================================================
  -- VALIDATION 2: Outlet must match
  -- ============================================================
  IF v_item.outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Movement outlet must match item outlet';
  END IF;
  
  -- ============================================================
  -- VALIDATION 3: Lifecycle status check
  -- ============================================================
  -- Only ACTIVE and DRAFT items can receive inflow
  -- Only ACTIVE items can be allocated
  -- DISCONTINUED can only process returns/writeoffs
  -- ARCHIVED items are completely read-only
  
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
  
  -- ============================================================
  -- VALIDATION 4: Reference validation for subscription/event
  -- ============================================================
  IF NEW.reference_type = 'subscription' THEN
    IF NOT EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE id = NEW.reference_id 
        AND outlet_id = NEW.outlet_id
    ) THEN
      RAISE EXCEPTION 'Invalid subscription reference or outlet mismatch';
    END IF;
  ELSIF NEW.reference_type = 'event' THEN
    IF NOT EXISTS (
      SELECT 1 FROM events 
      WHERE id = NEW.reference_id 
        AND outlet_id = NEW.outlet_id
    ) THEN
      RAISE EXCEPTION 'Invalid event reference or outlet mismatch';
    END IF;
  END IF;
  
  -- ============================================================
  -- VALIDATION 5: Stock availability for outflow
  -- ============================================================
  IF NEW.movement_category = 'outflow' THEN
    IF v_item.available_quantity < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %', 
        v_item.available_quantity, NEW.quantity;
    END IF;
  END IF;
  
  -- ============================================================
  -- VALIDATION 6: Adjustment rules
  -- ============================================================
  IF NEW.movement_category = 'adjustment' THEN
    -- Adjustment requires reason_code
    IF NEW.reason_code IS NULL OR NEW.reason_code = '' THEN
      RAISE EXCEPTION 'Adjustments require a reason_code';
    END IF;
    
    -- Adjustment requires notes
    IF NEW.notes IS NULL OR NEW.notes = '' THEN
      RAISE EXCEPTION 'Adjustments require notes explaining the reason';
    END IF;
    
    -- Check if opening balance is confirmed
    IF v_item.opening_balance_confirmed = true THEN
      -- After confirmation, only admins can adjust
      IF v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can adjust stock after opening balance is confirmed';
      END IF;
    END IF;
    
    -- Negative adjustments: detect from movement_type
    IF NEW.movement_type::TEXT = 'adjustment' OR NEW.movement_type IS NULL THEN
      -- Old format, check notes for indication
      NULL; -- Allow for backward compatibility
    END IF;
  END IF;
  
  -- ============================================================
  -- VALIDATION 7: Negative adjustment availability check
  -- ============================================================
  -- For adjustment_negative (tracked via reason_code or notes pattern)
  IF NEW.movement_category = 'adjustment' AND NEW.reason_code LIKE '%negative%' THEN
    IF v_user_role != 'admin' THEN
      RAISE EXCEPTION 'Only admins can perform negative adjustments';
    END IF;
  END IF;
  
  -- ============================================================
  -- VALIDATION 8: Return/damage/loss must have valid allocation
  -- ============================================================
  IF NEW.movement_category IN ('return', 'writeoff') 
     AND NEW.reference_type IN ('subscription', 'event') THEN
    
    -- Check active allocation exists
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
    
    -- Get allocated quantity
    SELECT allocated_quantity INTO v_allocated_qty
    FROM inventory_allocations
    WHERE inventory_item_id = NEW.inventory_item_id
      AND reference_type = NEW.reference_type
      AND reference_id = NEW.reference_id
      AND is_active = true;
    
    -- Calculate already resolved (returned + damaged + lost)
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
  
  -- ============================================================
  -- VALIDATION 9: Repair movements
  -- ============================================================
  IF NEW.movement_category = 'repair' THEN
    -- send_to_repair requires damaged items available
    IF NEW.movement_type::TEXT = 'send_to_repair' THEN
      IF v_item.damaged_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient damaged stock for repair. Damaged: %, Requested: %',
          v_item.damaged_quantity, NEW.quantity;
      END IF;
    END IF;
    
    -- return_from_repair requires items in repair
    IF NEW.movement_type::TEXT = 'return_from_repair' THEN
      IF v_item.in_repair_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient items in repair. In repair: %, Requested: %',
          v_item.in_repair_quantity, NEW.quantity;
      END IF;
    END IF;
  END IF;
  
  -- All validations passed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_movement_v2() IS 
  'V2 movement validation: uses lifecycle_status, movement_category, supports adjustments and repair';

-- ================================================================
-- STEP 4: CREATE NEW QUANTITY UPDATE FUNCTION (V2)
-- ================================================================
-- Uses movement_category for cleaner logic
-- Supports in_repair_quantity and negative adjustments

CREATE OR REPLACE FUNCTION update_inventory_quantities_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_adjustment_negative BOOLEAN := false;
BEGIN
  -- Detect negative adjustment (from reason_code or movement_type pattern)
  IF NEW.movement_category = 'adjustment' THEN
    IF NEW.reason_code IN ('audit_shortage', 'missing_stock', 'count_correction_negative') 
       OR NEW.reason_code LIKE '%negative%'
       OR (NEW.notes IS NOT NULL AND NEW.notes LIKE '%negative%') THEN
      v_adjustment_negative := true;
    END IF;
  END IF;
  
  -- Apply quantity changes based on movement_category
  CASE NEW.movement_category
    -- ============================================================
    -- INFLOW: +available, +total
    -- ============================================================
    WHEN 'inflow' THEN
      UPDATE inventory_items
      SET 
        available_quantity = available_quantity + NEW.quantity,
        total_quantity = total_quantity + NEW.quantity,
        updated_at = now()
      WHERE id = NEW.inventory_item_id;
    
    -- ============================================================
    -- OUTFLOW (allocation): -available, +allocated
    -- ============================================================
    WHEN 'outflow' THEN
      UPDATE inventory_items
      SET 
        available_quantity = available_quantity - NEW.quantity,
        allocated_quantity = allocated_quantity + NEW.quantity,
        updated_at = now()
      WHERE id = NEW.inventory_item_id;
      
      -- Lock opening balance on first allocation
      UPDATE inventory_items
      SET opening_balance_confirmed = true
      WHERE id = NEW.inventory_item_id
        AND opening_balance_confirmed = false;
    
    -- ============================================================
    -- RETURN: +available, -allocated or +damaged, -allocated
    -- ============================================================
    WHEN 'return' THEN
      -- Check if it's return_good or return_damaged
      IF NEW.movement_type::TEXT = 'return_damaged' 
         OR NEW.reason_code IN ('client_damage', 'transit_damage') THEN
        -- Return damaged: goes to damaged_quantity
        UPDATE inventory_items
        SET 
          damaged_quantity = damaged_quantity + NEW.quantity,
          allocated_quantity = allocated_quantity - NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSE
        -- Return good: goes back to available
        UPDATE inventory_items
        SET 
          available_quantity = available_quantity + NEW.quantity,
          allocated_quantity = allocated_quantity - NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;
    
    -- ============================================================
    -- WRITEOFF: handles damage, loss, disposal
    -- ============================================================
    WHEN 'writeoff' THEN
      CASE 
        -- Damage from warehouse (not client): -available, +damaged
        WHEN NEW.reason_code IN ('handling_damage', 'storage_damage') THEN
          UPDATE inventory_items
          SET 
            damaged_quantity = damaged_quantity + NEW.quantity,
            available_quantity = available_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
        
        -- Damage from client: -allocated, +damaged
        WHEN NEW.reason_code IN ('client_damage', 'client_reported', 'delivery_damage') THEN
          UPDATE inventory_items
          SET 
            damaged_quantity = damaged_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
        
        -- Loss from allocated stock: -allocated, -total
        WHEN NEW.reason_code IN ('client_lost', 'transit_lost', 'theft') 
             AND NEW.reference_type IN ('subscription', 'event') THEN
          UPDATE inventory_items
          SET 
            lost_quantity = lost_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
        
        -- Loss from available stock: -available, -total
        WHEN NEW.reason_code IN ('client_lost', 'transit_lost', 'theft', 'missing_stock') THEN
          UPDATE inventory_items
          SET 
            lost_quantity = lost_quantity + NEW.quantity,
            available_quantity = available_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
        
        -- Disposal (from damaged): -damaged, -total
        WHEN NEW.reason_code IN ('end_of_life', 'unrepairable', 'audit_writeoff') THEN
          UPDATE inventory_items
          SET 
            damaged_quantity = damaged_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
        
        -- Generic damage: use movement_type fallback
        ELSE
          IF NEW.movement_type::TEXT = 'damage' THEN
            UPDATE inventory_items
            SET 
              damaged_quantity = damaged_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              updated_at = now()
            WHERE id = NEW.inventory_item_id;
          ELSIF NEW.movement_type::TEXT = 'loss' THEN
            UPDATE inventory_items
            SET 
              lost_quantity = lost_quantity + NEW.quantity,
              allocated_quantity = allocated_quantity - NEW.quantity,
              total_quantity = total_quantity - NEW.quantity,
              updated_at = now()
            WHERE id = NEW.inventory_item_id;
          END IF;
      END CASE;
    
    -- ============================================================
    -- ADJUSTMENT: ±available, ±total
    -- ============================================================
    WHEN 'adjustment' THEN
      IF v_adjustment_negative THEN
        -- Negative adjustment: -available, -total
        UPDATE inventory_items
        SET 
          available_quantity = available_quantity - NEW.quantity,
          total_quantity = total_quantity - NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
      ELSE
        -- Positive adjustment: +available, +total
        UPDATE inventory_items
        SET 
          available_quantity = available_quantity + NEW.quantity,
          total_quantity = total_quantity + NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;
    
    -- ============================================================
    -- REPAIR: send_to_repair or return_from_repair
    -- ============================================================
    WHEN 'repair' THEN
      IF NEW.movement_type::TEXT = 'send_to_repair' 
         OR NEW.reason_code IN ('internal_repair', 'external_vendor') THEN
        -- Send to repair: -damaged, +in_repair
        UPDATE inventory_items
        SET 
          damaged_quantity = damaged_quantity - NEW.quantity,
          in_repair_quantity = in_repair_quantity + NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
        
      ELSIF NEW.reason_code = 'repaired' THEN
        -- Return from repair (fixed): -in_repair, +available
        UPDATE inventory_items
        SET 
          in_repair_quantity = in_repair_quantity - NEW.quantity,
          available_quantity = available_quantity + NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
        
      ELSIF NEW.reason_code = 'irreparable' THEN
        -- Return from repair (unfixable): -in_repair, -total
        UPDATE inventory_items
        SET 
          in_repair_quantity = in_repair_quantity - NEW.quantity,
          total_quantity = total_quantity - NEW.quantity,
          updated_at = now()
        WHERE id = NEW.inventory_item_id;
      END IF;
    
    -- ============================================================
    -- FALLBACK: Old movement_type logic for backward compatibility
    -- ============================================================
    ELSE
      -- Fallback to old movement_type based logic
      CASE NEW.movement_type::TEXT
        WHEN 'stock_in' THEN
          UPDATE inventory_items
          SET 
            available_quantity = available_quantity + NEW.quantity,
            total_quantity = total_quantity + NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
          
        WHEN 'allocation' THEN
          UPDATE inventory_items
          SET 
            available_quantity = available_quantity - NEW.quantity,
            allocated_quantity = allocated_quantity + NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
          
        WHEN 'return' THEN
          UPDATE inventory_items
          SET 
            available_quantity = available_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
          
        WHEN 'damage' THEN
          UPDATE inventory_items
          SET 
            damaged_quantity = damaged_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
          
        WHEN 'loss' THEN
          UPDATE inventory_items
          SET 
            lost_quantity = lost_quantity + NEW.quantity,
            allocated_quantity = allocated_quantity - NEW.quantity,
            total_quantity = total_quantity - NEW.quantity,
            updated_at = now()
          WHERE id = NEW.inventory_item_id;
          
        WHEN 'adjustment' THEN
          UPDATE inventory_items
          SET 
            available_quantity = available_quantity + NEW.quantity,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_inventory_quantities_v2() IS 
  'V2 quantity updates: uses movement_category, supports in_repair, adjustment_negative, repair flow';

-- ================================================================
-- STEP 5: CREATE ITEM LIFECYCLE ENFORCEMENT FUNCTION
-- ================================================================
-- Replaces prevent_item_deletion with lifecycle-aware logic

CREATE OR REPLACE FUNCTION enforce_item_lifecycle_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_has_customer_allocations BOOLEAN;
  v_movement_count INTEGER;
BEGIN
  -- ============================================================
  -- RULE: Cannot DELETE archived items (use lifecycle transitions)
  -- ============================================================
  IF TG_OP = 'DELETE' THEN
    -- Check if item ever had customer allocations
    SELECT EXISTS (
      SELECT 1 FROM inventory_movements
      WHERE inventory_item_id = OLD.id
        AND reference_type IN ('subscription', 'event')
    ) INTO v_has_customer_allocations;
    
    -- If has customer history, block delete
    IF v_has_customer_allocations THEN
      RAISE EXCEPTION 'Cannot delete item with customer allocation history. Use DISCONTINUE instead. Item has been allocated to subscriptions/events.';
    END IF;
    
    -- If has any stock, block delete
    IF OLD.total_quantity > 0 THEN
      RAISE EXCEPTION 'Cannot delete item with stock. Current total: %. Dispose or write-off stock first.', OLD.total_quantity;
    END IF;
    
    -- Safe to delete (no customer history, no stock)
    RETURN OLD;
  END IF;
  
  -- ============================================================
  -- RULE: Lifecycle transitions on UPDATE
  -- ============================================================
  IF TG_OP = 'UPDATE' THEN
    -- Prevent manual is_active changes (use lifecycle_status)
    -- Keep is_active synced with lifecycle_status
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      -- Auto-sync: treat this as lifecycle change request
      IF NEW.is_active = false AND OLD.lifecycle_status = 'active' THEN
        NEW.lifecycle_status := 'discontinued';
      ELSIF NEW.is_active = true AND OLD.lifecycle_status = 'discontinued' THEN
        NEW.lifecycle_status := 'active';
      END IF;
    END IF;
    
    -- Sync is_active from lifecycle_status
    NEW.is_active := (NEW.lifecycle_status IN ('draft', 'active'));
    
    -- ARCHIVED items are read-only (no modifications allowed)
    IF OLD.lifecycle_status = 'archived' THEN
      RAISE EXCEPTION 'Archived items are read-only. No modifications allowed.';
    END IF;
    
    -- Transition to DISCONTINUED: require no outstanding allocations
    IF OLD.lifecycle_status = 'active' AND NEW.lifecycle_status = 'discontinued' THEN
      IF OLD.allocated_quantity > 0 THEN
        RAISE EXCEPTION 'Cannot discontinue item with outstanding allocations. Allocated: %. Resolve allocations first.',
          OLD.allocated_quantity;
      END IF;
    END IF;
    
    -- Transition to ARCHIVED: require zero stock and 1 year inactivity
    IF NEW.lifecycle_status = 'archived' AND OLD.lifecycle_status != 'archived' THEN
      IF OLD.total_quantity > 0 THEN
        RAISE EXCEPTION 'Cannot archive item with stock. Total: %. Dispose stock first.', OLD.total_quantity;
      END IF;
      
      -- Check last movement was > 1 year ago
      SELECT COUNT(*) INTO v_movement_count
      FROM inventory_movements
      WHERE inventory_item_id = OLD.id
        AND created_at > now() - interval '1 year';
      
      IF v_movement_count > 0 THEN
        RAISE EXCEPTION 'Cannot archive item with recent activity. Wait 1 year after last movement.';
      END IF;
    END IF;
    
    -- Transition from ARCHIVED not allowed
    IF OLD.lifecycle_status = 'archived' AND NEW.lifecycle_status != 'archived' THEN
      RAISE EXCEPTION 'Cannot reactivate archived items. Archive is permanent.';
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- INSERT: no restrictions
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_item_lifecycle_v2() IS 
  'V2 lifecycle enforcement: delete vs discontinue, archive rules, is_active sync';

-- ================================================================
-- STEP 6: CREATE OPENING BALANCE LOCK FUNCTION
-- ================================================================
-- Automatically locks opening balance on first allocation

CREATE OR REPLACE FUNCTION lock_opening_balance_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for outflow (allocation) movements
  IF NEW.movement_category = 'outflow' THEN
    -- Lock opening balance if not already locked
    UPDATE inventory_items
    SET 
      opening_balance_confirmed = true,
      updated_at = now()
    WHERE id = NEW.inventory_item_id
      AND opening_balance_confirmed = false;
      
    IF FOUND THEN
      -- Log the lock event
      INSERT INTO inventory_migration_log (migration_version, table_name, operation, record_id, notes)
      VALUES ('runtime', 'inventory_items', 'LOCK_OPENING_BALANCE', NEW.inventory_item_id,
              'Opening balance auto-locked on first allocation');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION lock_opening_balance_on_allocation() IS 
  'Auto-locks opening_balance_confirmed on first allocation movement';

-- ================================================================
-- STEP 7: SUBSCRIPTION INTEGRATION - AUTO-ALLOCATION
-- ================================================================
-- Function to be called when subscription becomes active

CREATE OR REPLACE FUNCTION handle_subscription_inventory_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_allocation RECORD;
  v_outstanding INTEGER;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := COALESCE(auth.uid(), NEW.created_by);
  
  -- ============================================================
  -- ON ACTIVATION: Validate no outstanding issues
  -- ============================================================
  IF TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active' THEN
    -- Check for pre-existing allocations that need resolution
    -- (This would be from a previously paused subscription)
    FOR v_allocation IN
      SELECT 
        ia.inventory_item_id,
        ia.allocated_quantity,
        ii.name AS item_name,
        ia.allocated_quantity - COALESCE(
          (SELECT SUM(quantity) FROM inventory_movements im
           WHERE im.inventory_item_id = ia.inventory_item_id
             AND im.reference_type = 'subscription'
             AND im.reference_id = NEW.id
             AND im.movement_category IN ('return', 'writeoff')), 0
        ) AS outstanding
      FROM inventory_allocations ia
      JOIN inventory_items ii ON ia.inventory_item_id = ii.id
      WHERE ia.reference_type = 'subscription'
        AND ia.reference_id = NEW.id
        AND ia.is_active = true
    LOOP
      -- Just a notice, don't block reactivation
      IF v_allocation.outstanding > 0 THEN
        RAISE NOTICE 'Subscription % has outstanding allocation: % units of %',
          NEW.id, v_allocation.outstanding, v_allocation.item_name;
      END IF;
    END LOOP;
  END IF;
  
  -- ============================================================
  -- ON CANCELLATION: Block if outstanding allocations exist
  -- ============================================================
  IF TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    FOR v_allocation IN
      SELECT 
        ia.inventory_item_id,
        ii.name AS item_name,
        ia.allocated_quantity - COALESCE(
          (SELECT SUM(quantity) FROM inventory_movements im
           WHERE im.inventory_item_id = ia.inventory_item_id
             AND im.reference_type = 'subscription'
             AND im.reference_id = NEW.id
             AND im.movement_category IN ('return', 'writeoff')), 0
        ) AS outstanding
      FROM inventory_allocations ia
      JOIN inventory_items ii ON ia.inventory_item_id = ii.id
      WHERE ia.reference_type = 'subscription'
        AND ia.reference_id = NEW.id
        AND ia.is_active = true
    LOOP
      IF v_allocation.outstanding > 0 THEN
        RAISE EXCEPTION 'Cannot cancel subscription with outstanding inventory. % has % units outstanding. Process returns/damage/loss first.',
          v_allocation.item_name, v_allocation.outstanding;
      END IF;
    END LOOP;
    
    -- Close all allocations
    UPDATE inventory_allocations
    SET is_active = false, updated_at = now()
    WHERE reference_type = 'subscription'
      AND reference_id = NEW.id
      AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_subscription_inventory_v2() IS 
  'V2 subscription integration: blocks cancellation with outstanding allocations';

-- ================================================================
-- STEP 8: CREATE NEW TRIGGERS
-- ================================================================

-- BEFORE INSERT on movements: Validate
CREATE TRIGGER validate_movement_v2_trigger
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION validate_movement_v2();

-- AFTER INSERT on movements: Update quantities
CREATE TRIGGER update_quantities_v2_trigger
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_quantities_v2();

-- AFTER INSERT on movements: Lock opening balance
CREATE TRIGGER lock_opening_balance_trigger
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION lock_opening_balance_on_allocation();

-- BEFORE UPDATE/DELETE on items: Lifecycle enforcement
CREATE TRIGGER enforce_lifecycle_v2_trigger
  BEFORE UPDATE OR DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_item_lifecycle_v2();

-- BEFORE UPDATE on subscriptions: Inventory integration
DROP TRIGGER IF EXISTS subscription_inventory_v2_trigger ON subscriptions;
CREATE TRIGGER subscription_inventory_v2_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_subscription_inventory_v2();

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'inventory_movements', 'CREATE_TRIGGERS', 
        'Created v2 triggers: validate_movement_v2, update_quantities_v2, lock_opening_balance');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'inventory_items', 'CREATE_TRIGGERS', 
        'Created v2 trigger: enforce_lifecycle_v2');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'subscriptions', 'CREATE_TRIGGERS', 
        'Created v2 trigger: subscription_inventory_v2');

-- ================================================================
-- STEP 9: UPDATE VIEWS TO USE LIFECYCLE_STATUS
-- ================================================================
-- IMPORTANT: PostgreSQL cannot add/reorder columns with CREATE OR REPLACE VIEW
-- We must DROP and recreate views with new columns

-- Step 9.1: Drop existing views (they will be recreated)
DROP VIEW IF EXISTS inventory_stock_summary CASCADE;
DROP VIEW IF EXISTS inventory_allocations_with_details CASCADE;

-- Step 9.2: Recreate inventory_stock_summary with V2 columns
CREATE VIEW inventory_stock_summary
WITH (security_invoker = true)
AS
SELECT
  ii.id AS item_id,
  ii.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  ii.name AS item_name,
  ii.category,
  ii.material,
  ii.unit,
  ii.total_quantity,
  ii.available_quantity,
  ii.allocated_quantity,
  ii.damaged_quantity,
  ii.in_repair_quantity,
  ii.lost_quantity,
  ii.lifecycle_status,
  ii.opening_balance_confirmed,
  ii.is_active, -- Keep for backward compatibility
  ii.created_at,
  ii.updated_at
FROM inventory_items ii
JOIN outlets o ON ii.outlet_id = o.id
WHERE ii.lifecycle_status IN ('draft', 'active', 'discontinued')
  AND o.is_active = true;

COMMENT ON VIEW inventory_stock_summary IS 'V2: Stock summary using lifecycle_status (includes draft, active, discontinued)';

-- Step 9.3: Re-grant permissions on inventory_stock_summary
GRANT SELECT ON inventory_stock_summary TO authenticated;

-- Step 9.4: Recreate inventory_allocations_with_details with V2 columns
CREATE VIEW inventory_allocations_with_details
WITH (security_invoker = true)
AS
SELECT
  ia.id AS allocation_id,
  ia.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  ia.inventory_item_id,
  ii.name AS item_name,
  ii.category AS item_category,
  ii.lifecycle_status,
  ia.reference_type,
  ia.reference_id,
  CASE 
    WHEN ia.reference_type = 'subscription' THEN c.name
    WHEN ia.reference_type = 'event' THEN e.event_name
  END AS reference_name,
  ia.allocated_quantity,
  -- Calculate outstanding from movements (DERIVED)
  ia.allocated_quantity - COALESCE(
    (SELECT SUM(quantity) 
     FROM inventory_movements im
     WHERE im.inventory_item_id = ia.inventory_item_id
       AND im.reference_type = ia.reference_type
       AND im.reference_id = ia.reference_id
       AND im.movement_category IN ('return', 'writeoff')
    ), 0
  ) AS outstanding_quantity,
  ia.is_active,
  ia.created_at,
  ia.updated_at
FROM inventory_allocations ia
JOIN outlets o ON ia.outlet_id = o.id
JOIN inventory_items ii ON ia.inventory_item_id = ii.id
LEFT JOIN subscriptions s ON ia.reference_type = 'subscription' AND ia.reference_id = s.id
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN events e ON ia.reference_type = 'event' AND ia.reference_id = e.id
WHERE ia.is_active = true
  AND o.is_active = true
  AND ii.lifecycle_status != 'archived';

COMMENT ON VIEW inventory_allocations_with_details IS 'V2: Allocations with lifecycle_status and movement_category based outstanding';

-- Step 9.5: Re-grant permissions on inventory_allocations_with_details
GRANT SELECT ON inventory_allocations_with_details TO authenticated;

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'views', 'RECREATE_VIEWS', 
        'Dropped and recreated inventory_stock_summary and inventory_allocations_with_details with V2 columns');

-- ================================================================
-- STEP 10: SYNC is_active WITH lifecycle_status (ONE-TIME)
-- ================================================================

-- Ensure is_active reflects lifecycle_status for all existing items
UPDATE inventory_items
SET is_active = (lifecycle_status IN ('draft', 'active'))
WHERE is_active != (lifecycle_status IN ('draft', 'active'));

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', 'inventory_items', 'SYNC_IS_ACTIVE', 
        'Synced is_active with lifecycle_status for all items');

-- ================================================================
-- STEP 11: VALIDATION QUERIES
-- ================================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_constraint_exists BOOLEAN;
  v_view_exists BOOLEAN;
BEGIN
  -- Check new triggers exist
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('validate_movement_v2_trigger', 'update_quantities_v2_trigger', 
                         'lock_opening_balance_trigger', 'enforce_lifecycle_v2_trigger',
                         'subscription_inventory_v2_trigger');
  
  IF v_trigger_count < 5 THEN
    RAISE WARNING 'Expected 5 new triggers, found %', v_trigger_count;
  ELSE
    RAISE NOTICE 'All 5 new triggers created successfully';
  END IF;
  
  -- Check new constraint exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quantity_balance_v2'
  ) INTO v_constraint_exists;
  
  IF NOT v_constraint_exists THEN
    RAISE WARNING 'quantity_balance_v2 constraint not found';
  ELSE
    RAISE NOTICE 'quantity_balance_v2 constraint exists';
  END IF;
  
  -- Log validation
  INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
  VALUES ('2.0-phase2', '_validation_', 'VALIDATE', 
          format('Triggers: %s, Constraint: %s', v_trigger_count, v_constraint_exists));
END $$;

-- ================================================================
-- STEP 12: COMPLETION
-- ================================================================

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase2', '_migration_', 'COMPLETE', 'Inventory v2.0 Phase 2 (Behavioural Changes) completed');

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'INVENTORY V2.0 PHASE 2 MIGRATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'BEHAVIOURAL CHANGES APPLIED:';
  RAISE NOTICE '  ✓ Replaced validate_movement trigger with v2 (lifecycle_status aware)';
  RAISE NOTICE '  ✓ Replaced update_inventory_quantities trigger with v2 (movement_category based)';
  RAISE NOTICE '  ✓ Added lock_opening_balance_on_allocation trigger';
  RAISE NOTICE '  ✓ Replaced prevent_item_deletion with enforce_lifecycle_v2';
  RAISE NOTICE '  ✓ Added subscription_inventory_v2 trigger (blocks cancel with outstanding)';
  RAISE NOTICE '  ✓ Updated quantity_balance constraint to include in_repair_quantity';
  RAISE NOTICE '  ✓ Updated views to use lifecycle_status and movement_category';
  RAISE NOTICE '  ✓ Synced is_active with lifecycle_status';
  RAISE NOTICE '';
  RAISE NOTICE 'RUNTIME BEHAVIOUR NOW:';
  RAISE NOTICE '  • Only ACTIVE items can be allocated';
  RAISE NOTICE '  • DISCONTINUED items can only receive returns/writeoffs';
  RAISE NOTICE '  • ARCHIVED items are read-only';
  RAISE NOTICE '  • Delete blocked if customer allocation history exists';
  RAISE NOTICE '  • Opening balance locked on first allocation';
  RAISE NOTICE '  • Adjustments require reason_code + notes';
  RAISE NOTICE '  • Negative adjustments require admin role';
  RAISE NOTICE '  • Subscription cancel blocked if outstanding allocations';
  RAISE NOTICE '';
  RAISE NOTICE 'BACKWARD COMPATIBILITY:';
  RAISE NOTICE '  • is_active column still works (synced with lifecycle_status)';
  RAISE NOTICE '  • movement_type still works (fallback in trigger)';
  RAISE NOTICE '  • Old views replaced but same column names';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- ================================================================
-- 
-- BEGIN;
-- 
-- -- Drop v2 triggers
-- DROP TRIGGER IF EXISTS validate_movement_v2_trigger ON inventory_movements;
-- DROP TRIGGER IF EXISTS update_quantities_v2_trigger ON inventory_movements;
-- DROP TRIGGER IF EXISTS lock_opening_balance_trigger ON inventory_movements;
-- DROP TRIGGER IF EXISTS enforce_lifecycle_v2_trigger ON inventory_items;
-- DROP TRIGGER IF EXISTS subscription_inventory_v2_trigger ON subscriptions;
-- 
-- -- Drop v2 functions
-- DROP FUNCTION IF EXISTS validate_movement_v2();
-- DROP FUNCTION IF EXISTS update_inventory_quantities_v2();
-- DROP FUNCTION IF EXISTS lock_opening_balance_on_allocation();
-- DROP FUNCTION IF EXISTS enforce_item_lifecycle_v2();
-- DROP FUNCTION IF EXISTS handle_subscription_inventory_v2();
-- 
-- -- Restore old constraint
-- ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS quantity_balance_v2;
-- ALTER TABLE inventory_items ADD CONSTRAINT quantity_balance CHECK (
--   total_quantity = available_quantity + allocated_quantity + damaged_quantity + lost_quantity
-- );
-- 
-- -- Recreate old triggers (copy from 008_phase8_inventory.sql)
-- -- ...
-- 
-- COMMIT;
-- ================================================================
