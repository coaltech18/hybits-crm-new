-- ================================================================
-- FIX AUDIT ATTRIBUTION - ENFORCE auth.uid() FOR ALL AUDIT FIELDS
-- ================================================================
-- 
-- PROBLEM:
-- Some tables allow client to pass created_by/changed_by values,
-- which could be spoofed. We should always use auth.uid() internally.
--
-- SOLUTION:
-- 1. Update validate_movement() to ALWAYS use auth.uid()
-- 2. Create generic trigger for enforcing auth.uid() on created_by
-- 3. Apply to all tables with audit fields
--
-- CORRECT BEHAVIOR:
-- - All audit attribution comes from auth.uid() (server-side)
-- - Client cannot spoof who performed an action
-- - NULL auth.uid() = anonymous/service role (logged as such)
-- ================================================================

-- ================================================================
-- 1. FIX INVENTORY MOVEMENTS - ENFORCE auth.uid()
-- ================================================================
-- Replace client-passed created_by with auth.uid()

CREATE OR REPLACE FUNCTION validate_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_current_available INTEGER;
  v_current_allocated INTEGER;
  v_outlet_match BOOLEAN;
  v_allocation_exists BOOLEAN;
  v_allocated_qty INTEGER;
  v_auth_uid UUID;
BEGIN
  -- CRITICAL: Always use auth.uid() for attribution
  -- Never trust client-passed created_by
  v_auth_uid := auth.uid();
  
  -- Override any client-passed created_by with auth.uid()
  -- This prevents spoofing of who created the movement
  IF v_auth_uid IS NOT NULL THEN
    NEW.created_by := v_auth_uid;
  END IF;
  
  -- If no auth context (service role), created_by must be provided
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required (no auth context and no value provided)';
  END IF;
  
  -- Get user role (using the corrected created_by)
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = NEW.created_by AND is_active = true;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Invalid user or inactive user';
  END IF;
  
  -- VALIDATION 1: Adjustment movements are ADMIN ONLY
  IF NEW.movement_type = 'adjustment' AND v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can perform inventory adjustments';
  END IF;
  
  -- VALIDATION 2: Notes are MANDATORY for adjustments
  IF NEW.movement_type = 'adjustment' AND (NEW.notes IS NULL OR NEW.notes = '') THEN
    RAISE EXCEPTION 'Adjustment movements require notes explaining the reason';
  END IF;
  
  -- VALIDATION 3: Outlet must match between item and movement
  SELECT (outlet_id = NEW.outlet_id) INTO v_outlet_match
  FROM inventory_items
  WHERE id = NEW.inventory_item_id;
  
  IF NOT v_outlet_match THEN
    RAISE EXCEPTION 'Movement outlet must match item outlet';
  END IF;
  
  -- VALIDATION 4: Reference validation for subscription/event
  IF NEW.reference_type = 'subscription' THEN
    IF NOT EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE id = NEW.reference_id 
        AND outlet_id = NEW.outlet_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid subscription reference or outlet mismatch';
    END IF;
  ELSIF NEW.reference_type = 'event' THEN
    IF NOT EXISTS (
      SELECT 1 FROM events 
      WHERE id = NEW.reference_id 
        AND outlet_id = NEW.outlet_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid event reference or outlet mismatch';
    END IF;
  END IF;
  
  -- VALIDATION 5: Stock availability check (CRITICAL)
  SELECT available_quantity, allocated_quantity
  INTO v_current_available, v_current_allocated
  FROM inventory_items
  WHERE id = NEW.inventory_item_id;
  
  -- For allocation movements: check if enough stock available
  IF NEW.movement_type = 'allocation' THEN
    IF v_current_available < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock available. Available: %, Requested: %', 
        v_current_available, NEW.quantity;
    END IF;
  END IF;
  
  -- For return/damage/loss movements: check if allocation exists
  IF NEW.movement_type IN ('return', 'damage', 'loss') THEN
    -- Check if there's an active allocation for this reference
    SELECT EXISTS (
      SELECT 1 FROM inventory_allocations
      WHERE inventory_item_id = NEW.inventory_item_id
        AND reference_type = NEW.reference_type
        AND reference_id = NEW.reference_id
        AND is_active = true
    ), COALESCE(allocated_quantity, 0)
    INTO v_allocation_exists, v_allocated_qty
    FROM inventory_allocations
    WHERE inventory_item_id = NEW.inventory_item_id
      AND reference_type = NEW.reference_type
      AND reference_id = NEW.reference_id
      AND is_active = true;
    
    IF NOT v_allocation_exists THEN
      RAISE EXCEPTION 'No active allocation found for this reference';
    END IF;
    
    -- Calculate outstanding quantity from movements
    DECLARE
      v_total_returned INTEGER;
      v_total_damaged INTEGER;
      v_total_lost INTEGER;
      v_outstanding INTEGER;
    BEGIN
      SELECT 
        COALESCE(SUM(CASE WHEN movement_type = 'return' THEN quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN movement_type = 'damage' THEN quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN movement_type = 'loss' THEN quantity ELSE 0 END), 0)
      INTO v_total_returned, v_total_damaged, v_total_lost
      FROM inventory_movements
      WHERE inventory_item_id = NEW.inventory_item_id
        AND reference_type = NEW.reference_type
        AND reference_id = NEW.reference_id
        AND movement_type IN ('return', 'damage', 'loss');
      
      v_outstanding := v_allocated_qty - v_total_returned - v_total_damaged - v_total_lost;
      
      -- Check if trying to return/damage/loss more than outstanding
      IF NEW.quantity > v_outstanding THEN
        RAISE EXCEPTION 'Cannot % more than outstanding. Outstanding: %, Requested: %',
          NEW.movement_type, v_outstanding, NEW.quantity;
      END IF;
    END;
  END IF;
  
  -- All validations passed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_movement() IS 
  'BEFORE trigger: Validates inventory movements. ALWAYS uses auth.uid() for created_by attribution.';

-- ================================================================
-- 2. UPDATE set_created_by TO ENFORCE auth.uid()
-- ================================================================
-- This ensures created_by is ALWAYS auth.uid(), not client-provided

CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_uid UUID;
BEGIN
  v_auth_uid := auth.uid();
  
  -- On INSERT: ALWAYS set created_by to auth.uid() if available
  IF TG_OP = 'INSERT' THEN
    IF v_auth_uid IS NOT NULL THEN
      -- Override any client-passed value with auth.uid()
      NEW.created_by = v_auth_uid;
    END IF;
    -- If no auth context (service role), allow client-passed value
  END IF;
  
  -- ON UPDATE: NEVER allow modification of created_by
  IF TG_OP = 'UPDATE' THEN
    -- Preserve original created_by, ignore any attempt to change
    NEW.created_by = OLD.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_created_by() IS 
  'Ensures created_by is ALWAYS set from auth.uid() on INSERT. Prevents modification on UPDATE.';

-- ================================================================
-- 3. ADD TRIGGER FOR INVENTORY_ITEMS (if not exists)
-- ================================================================

-- Drop and recreate to ensure correct behavior
DROP TRIGGER IF EXISTS set_inventory_items_created_by ON inventory_items;

CREATE TRIGGER set_inventory_items_created_by
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- 
-- ✅ FIXED: validate_movement() now ALWAYS uses auth.uid()
--    - Overrides any client-passed created_by value
--    - Prevents spoofing of who created inventory movements
--
-- ✅ FIXED: set_created_by() enforces auth.uid()
--    - Always uses auth.uid() when available
--    - Falls back to client value only for service role (no auth context)
--
-- ✅ ADDED: Trigger on inventory_items
--    - Ensures created_by is properly attributed
--
-- WHY THIS MATTERS:
--
-- BEFORE (Vulnerable):
--   Client sends: { created_by: 'other-users-id' }
--   DB stores: created_by = 'other-users-id' ❌ (spoofed!)
--
-- AFTER (Secure):
--   Client sends: { created_by: 'other-users-id' }
--   Trigger runs: NEW.created_by = auth.uid()
--   DB stores: created_by = 'actual-auth-users-id' ✅
--
-- CORRECT ATTRIBUTION BEHAVIOR:
-- 1. auth.uid() is the ONLY source of truth for user attribution
-- 2. Client-passed values are IGNORED when auth context exists
-- 3. Service role operations (no auth context) can specify created_by
-- 4. created_by is IMMUTABLE after INSERT
-- ================================================================
