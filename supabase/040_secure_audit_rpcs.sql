-- ================================================================
-- MIGRATION 040: DERIVE AUDIT IDENTITY FROM THE SESSION
-- ================================================================
-- BUG:
--   create/submit/approve_inventory_audit are SECURITY DEFINER (so
--   they bypass RLS) and are GRANTed to authenticated, yet they took
--   the acting user as a PARAMETER:
--
--       approve_inventory_audit(p_audit_id, p_approved_by, ...)
--
--   The admin check read the role of p_approved_by, not of the
--   caller. Any authenticated user could pass an admin's UUID and
--   approve an audit -- writing inventory adjustment movements
--   attributed to that admin. Admin UUIDs are readable from the
--   created_by columns a manager can legitimately see.
--
--   submit_inventory_audit had no authorization check at all, and it
--   auto-approves when no variance is negative.
--
-- FIX:
--   New helper audit_actor() resolves the caller from auth.uid(),
--   verifies the account is active, enforces role, and for managers
--   verifies assignment to the outlet in question. The three RPCs now
--   attribute every write to that resolved uid.
--
--   Signatures are UNCHANGED so no frontend edit is required. The
--   identity parameters (p_created_by / p_submitted_by /
--   p_approved_by) are now IGNORED -- kept only for compatibility.
--
-- RUN ORDER: after 033 (uses current_user_role/current_user_is_active).
-- ================================================================

-- ----------------------------------------------------------------
-- Resolve and authorize the acting user from the session.
-- Returns the caller's uid, or raises.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_actor(
  p_outlet_id UUID,
  p_require_admin BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_role user_role;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT current_user_is_active() THEN
    RAISE EXCEPTION 'Your account has been deactivated';
  END IF;

  v_role := current_user_role();

  IF p_require_admin AND v_role IS DISTINCT FROM 'admin'::user_role THEN
    RAISE EXCEPTION 'Only admins can approve or reject audits';
  END IF;

  IF v_role = 'admin'::user_role THEN
    RETURN v_uid;
  END IF;

  IF v_role = 'manager'::user_role THEN
    IF p_outlet_id IS NULL THEN
      RAISE EXCEPTION 'Only admins can approve or reject audits';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM user_outlet_assignments
      WHERE user_id = v_uid AND outlet_id = p_outlet_id
    ) THEN
      RAISE EXCEPTION 'You are not assigned to this outlet';
    END IF;
    RETURN v_uid;
  END IF;

  RAISE EXCEPTION 'Role % cannot perform inventory audit actions', v_role;
END;
$fn$;

REVOKE ALL ON FUNCTION audit_actor(UUID, BOOLEAN) FROM PUBLIC;

-- ---------------- create_inventory_audit ----------------
CREATE OR REPLACE FUNCTION create_inventory_audit(
  p_outlet_id UUID,
  p_period VARCHAR(7),
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_item_count INTEGER;
  v_actor UUID;
BEGIN
  -- Authorize from the session, not from a caller-supplied parameter
  v_actor := audit_actor(p_outlet_id);

  -- Check if audit already exists for this period
  IF EXISTS (
    SELECT 1 FROM inventory_audits
    WHERE outlet_id = p_outlet_id AND period = p_period
  ) THEN
    RAISE EXCEPTION 'Audit already exists for outlet % and period %', p_outlet_id, p_period;
  END IF;
  
  -- Check if there's an active audit for this outlet
  IF check_active_audit(p_outlet_id) THEN
    RAISE EXCEPTION 'Cannot create new audit while another audit is in progress';
  END IF;
  
  -- Create the audit
  INSERT INTO inventory_audits (outlet_id, period, created_by)
  VALUES (p_outlet_id, p_period, v_actor)
  RETURNING id INTO v_audit_id;
  
  -- Create line items for all active items in this outlet
  INSERT INTO inventory_audit_line_items (audit_id, inventory_item_id, system_quantity)
  SELECT 
    v_audit_id,
    id,
    available_quantity  -- Snapshot of available stock
  FROM inventory_items
  WHERE outlet_id = p_outlet_id
    AND lifecycle_status IN ('draft', 'active')
  ORDER BY name;
  
  GET DIAGNOSTICS v_item_count = ROW_COUNT;
  
  -- Update items_total
  UPDATE inventory_audits
  SET items_total = v_item_count,
      status = 'counting'
  WHERE id = v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------- submit_inventory_audit ----------------
CREATE OR REPLACE FUNCTION submit_inventory_audit(
  p_audit_id UUID,
  p_submitted_by UUID
)
RETURNS TABLE (
  audit_id UUID,
  auto_approved BOOLEAN,
  movements_created INTEGER
) AS $$
DECLARE
  v_audit RECORD;
  v_has_negative BOOLEAN;
  v_movement_count INTEGER := 0;
  v_line RECORD;
  v_actor UUID;
BEGIN
  -- Get audit
  SELECT * INTO v_audit FROM inventory_audits WHERE id = p_audit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;
  
  -- Authorize against the audit's own outlet, from the session
  v_actor := audit_actor(v_audit.outlet_id);

  IF v_audit.status NOT IN ('counting', 'review') THEN
    RAISE EXCEPTION 'Audit cannot be submitted in current status: %', v_audit.status;
  END IF;
  
  -- Check all items are counted
  IF v_audit.items_counted < v_audit.items_total THEN
    RAISE EXCEPTION 'All items must be counted before submitting. Counted: %, Total: %',
      v_audit.items_counted, v_audit.items_total;
  END IF;
  
  -- Check all variances have reasons
  IF EXISTS (
    SELECT 1 FROM inventory_audit_line_items
    WHERE audit_id = p_audit_id
      AND variance != 0
      AND (reason_code IS NULL OR reason_code = '')
  ) THEN
    RAISE EXCEPTION 'All variances must have a reason code';
  END IF;
  
  -- Calculate totals
  UPDATE inventory_audits
  SET 
    variance_positive = (
      SELECT COALESCE(SUM(variance), 0)
      FROM inventory_audit_line_items
      WHERE audit_id = p_audit_id AND variance > 0
    ),
    variance_negative = (
      SELECT COALESCE(SUM(variance), 0)
      FROM inventory_audit_line_items
      WHERE audit_id = p_audit_id AND variance < 0
    ),
    submitted_at = now()
  WHERE id = p_audit_id
  RETURNING * INTO v_audit;
  
  -- Check if there are negative variances
  v_has_negative := v_audit.variance_negative < 0;
  
  IF v_has_negative THEN
    -- Needs admin approval
    UPDATE inventory_audits
    SET status = 'pending_approval'
    WHERE id = p_audit_id;
    
    RETURN QUERY SELECT p_audit_id, false, 0;
  ELSE
    -- Auto-approve and create movements
    UPDATE inventory_audits
    SET status = 'approved',
        approved_by = v_actor,
        approved_at = now()
    WHERE id = p_audit_id;
    
    -- Create adjustment movements for positive variances
    FOR v_line IN
      SELECT * FROM inventory_audit_line_items
      WHERE audit_id = p_audit_id AND variance > 0
    LOOP
      INSERT INTO inventory_movements (
        outlet_id,
        inventory_item_id,
        movement_category,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        reason_code,
        notes,
        created_by
      ) VALUES (
        v_audit.outlet_id,
        v_line.inventory_item_id,
        'adjustment',
        'adjustment',
        v_line.variance,
        'manual',
        p_audit_id::TEXT,
        v_line.reason_code,
        COALESCE(v_line.notes, '') || ' [Audit: ' || v_audit.period || ']',
        v_actor
      );
      
      v_movement_count := v_movement_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT p_audit_id, true, v_movement_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------- approve_inventory_audit ----------------
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
) AS $$
DECLARE
  v_audit RECORD;
  v_movement_count INTEGER := 0;
  v_line RECORD;
  v_actor UUID;
BEGIN
  -- Authorize BEFORE touching the audit, so an unauthenticated or
  -- non-admin caller cannot use this to probe whether an audit id
  -- exists. Approval is admin-only and admins are not outlet-scoped,
  -- so no outlet is needed here.
  v_actor := audit_actor(NULL, true);

  SELECT * INTO v_audit FROM inventory_audits WHERE id = p_audit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;
  
  IF v_audit.status != 'pending_approval' THEN
    RAISE EXCEPTION 'Audit is not pending approval';
  END IF;
  
  IF NOT p_approved THEN
    -- Reject
    UPDATE inventory_audits
    SET status = 'rejected',
        approved_by = v_actor,
        approved_at = now(),
        rejection_reason = p_rejection_reason
    WHERE id = p_audit_id;
    
    RETURN QUERY SELECT p_audit_id, true, 0;
    RETURN;
  END IF;
  
  -- Approve and create movements
  UPDATE inventory_audits
  SET status = 'approved',
      approved_by = v_actor,
      approved_at = now()
  WHERE id = p_audit_id;
  
  -- Create adjustment movements for ALL variances
  FOR v_line IN
    SELECT * FROM inventory_audit_line_items
    WHERE audit_id = p_audit_id AND variance != 0
  LOOP
    IF v_line.variance > 0 THEN
      -- Positive adjustment
      INSERT INTO inventory_movements (
        outlet_id,
        inventory_item_id,
        movement_category,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        reason_code,
        notes,
        created_by
      ) VALUES (
        v_audit.outlet_id,
        v_line.inventory_item_id,
        'adjustment',
        'adjustment',
        v_line.variance,
        'manual',
        p_audit_id::TEXT,
        v_line.reason_code,
        COALESCE(v_line.notes, '') || ' [Audit: ' || v_audit.period || ']',
        v_actor
      );
    ELSE
      -- Negative adjustment (with negative marker in reason)
      INSERT INTO inventory_movements (
        outlet_id,
        inventory_item_id,
        movement_category,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        reason_code,
        notes,
        created_by
      ) VALUES (
        v_audit.outlet_id,
        v_line.inventory_item_id,
        'adjustment',
        'adjustment',
        ABS(v_line.variance),  -- Quantity is always positive
        'manual',
        p_audit_id::TEXT,
        'count_correction_negative',  -- Use negative marker
        COALESCE(v_line.notes, '') || ' [Audit: ' || v_audit.period || ' - NEGATIVE]',
        v_actor
      );
    END IF;
    
    v_movement_count := v_movement_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT p_audit_id, true, v_movement_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_inventory_audit(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_inventory_audit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_inventory_audit(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ================================================================
-- Summary:
-- ✅ Identity comes from auth.uid(), never from a parameter
-- ✅ Managers restricted to their assigned outlets
-- ✅ Deactivated accounts rejected
-- ✅ Only admins can approve/reject
-- ✅ Signatures unchanged -- no frontend change needed
-- ================================================================
