-- ================================================================
-- INVENTORY V2.0 PHASE 3: AUDIT TABLES
-- ================================================================
-- 
-- This migration adds the audit workflow tables for
-- monthly inventory reconciliation.
--
-- Part of Phase 3 (UI, Audit, Reports)
-- 
-- PREREQUISITES:
-- - Phase 1 (024_inventory_v2_phase1_foundation.sql) applied
-- - Phase 2 (025_inventory_v2_phase2_behaviour.sql) applied
--
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 1: CREATE AUDIT STATUS TYPE
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status') THEN
    CREATE TYPE audit_status AS ENUM (
      'draft',
      'counting',
      'review',
      'pending_approval',
      'approved',
      'rejected'
    );
  END IF;
END $$;

-- ================================================================
-- STEP 2: CREATE INVENTORY AUDITS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS inventory_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  period VARCHAR(7) NOT NULL,  -- YYYY-MM format
  
  -- Status
  status audit_status NOT NULL DEFAULT 'draft',
  
  -- Counts
  items_total INTEGER NOT NULL DEFAULT 0,
  items_counted INTEGER NOT NULL DEFAULT 0,
  
  -- Summary (calculated on submit)
  variance_positive INTEGER DEFAULT 0,
  variance_negative INTEGER DEFAULT 0,
  
  -- Audit trail
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  
  -- Only one audit per outlet per period
  UNIQUE (outlet_id, period),
  
  -- Constraints
  CONSTRAINT items_counted_check CHECK (items_counted >= 0 AND items_counted <= items_total),
  CONSTRAINT variance_check CHECK (variance_positive >= 0 AND variance_negative <= 0)
);

COMMENT ON TABLE inventory_audits IS 'Monthly inventory audit records for physical count reconciliation';
COMMENT ON COLUMN inventory_audits.period IS 'Audit period in YYYY-MM format';
COMMENT ON COLUMN inventory_audits.variance_positive IS 'Total positive variance (surplus found)';
COMMENT ON COLUMN inventory_audits.variance_negative IS 'Total negative variance (shortage found, as negative number)';

-- ================================================================
-- STEP 3: CREATE AUDIT LINE ITEMS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS inventory_audit_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parent reference
  audit_id UUID NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  
  -- Item reference
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  
  -- Quantities
  system_quantity INTEGER NOT NULL,  -- Snapshot at audit creation
  physical_quantity INTEGER,         -- Entered by user
  
  -- Variance (computed column)
  variance INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN physical_quantity IS NOT NULL THEN physical_quantity - system_quantity
      ELSE NULL
    END
  ) STORED,
  
  -- Reason for variance
  reason_code VARCHAR(50),
  notes TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'counted', 'reviewed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One line per item per audit
  UNIQUE (audit_id, inventory_item_id)
);

COMMENT ON TABLE inventory_audit_line_items IS 'Individual item counts for inventory audits';
COMMENT ON COLUMN inventory_audit_line_items.system_quantity IS 'System quantity snapshot at audit creation';
COMMENT ON COLUMN inventory_audit_line_items.physical_quantity IS 'Physical count entered by user';
COMMENT ON COLUMN inventory_audit_line_items.variance IS 'Computed: physical_quantity - system_quantity';

-- ================================================================
-- STEP 4: CREATE INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_audits_outlet_period 
  ON inventory_audits(outlet_id, period);
  
CREATE INDEX IF NOT EXISTS idx_audits_status 
  ON inventory_audits(status);
  
CREATE INDEX IF NOT EXISTS idx_audits_created_by 
  ON inventory_audits(created_by);
  
CREATE INDEX IF NOT EXISTS idx_audit_items_audit_id 
  ON inventory_audit_line_items(audit_id);
  
CREATE INDEX IF NOT EXISTS idx_audit_items_item_id 
  ON inventory_audit_line_items(inventory_item_id);
  
CREATE INDEX IF NOT EXISTS idx_audit_items_status 
  ON inventory_audit_line_items(status);

-- ================================================================
-- STEP 5: RLS POLICIES
-- ================================================================

ALTER TABLE inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_line_items ENABLE ROW LEVEL SECURITY;

-- Audits: Admin sees all, Manager sees assigned outlets
CREATE POLICY audits_admin_all ON inventory_audits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY audits_manager_assigned ON inventory_audits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
        AND up.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM user_outlet_assignments uoa
          WHERE uoa.user_id = up.id 
            AND uoa.outlet_id = inventory_audits.outlet_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
        AND up.role = 'manager'
        AND EXISTS (
          SELECT 1 FROM user_outlet_assignments uoa
          WHERE uoa.user_id = up.id 
            AND uoa.outlet_id = inventory_audits.outlet_id
        )
    )
  );

-- Audits: Accountant read-only
CREATE POLICY audits_accountant_read ON inventory_audits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'accountant'
    )
  );

-- Line items: Follow parent audit policy
CREATE POLICY audit_items_admin_all ON inventory_audit_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY audit_items_manager ON inventory_audit_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_audits ia
      JOIN user_outlet_assignments uoa ON ia.outlet_id = uoa.outlet_id
      JOIN user_profiles up ON up.id = uoa.user_id
      WHERE ia.id = inventory_audit_line_items.audit_id
        AND up.id = auth.uid()
        AND up.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_audits ia
      JOIN user_outlet_assignments uoa ON ia.outlet_id = uoa.outlet_id
      JOIN user_profiles up ON up.id = uoa.user_id
      WHERE ia.id = inventory_audit_line_items.audit_id
        AND up.id = auth.uid()
        AND up.role = 'manager'
    )
  );

CREATE POLICY audit_items_accountant_read ON inventory_audit_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'accountant'
    )
  );

-- ================================================================
-- STEP 6: TRIGGER TO UPDATE updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION update_audit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audits_timestamp
  BEFORE UPDATE ON inventory_audits
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_at();

CREATE TRIGGER update_audit_items_timestamp
  BEFORE UPDATE ON inventory_audit_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_updated_at();

-- ================================================================
-- STEP 7: FUNCTION TO CHECK ACTIVE AUDIT
-- ================================================================
-- Used by movement triggers to warn/block during active audit

CREATE OR REPLACE FUNCTION check_active_audit(p_outlet_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_audit BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM inventory_audits
    WHERE outlet_id = p_outlet_id
      AND status IN ('counting', 'review', 'pending_approval')
  ) INTO v_active_audit;
  
  RETURN v_active_audit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_active_audit(UUID) IS 
  'Returns true if there is an active audit (counting/review/pending) for the outlet';

-- ================================================================
-- STEP 8: VIEW FOR AUDIT DASHBOARD
-- ================================================================

CREATE OR REPLACE VIEW inventory_audit_summary
WITH (security_invoker = true)
AS
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
  up_created.full_name AS created_by_name,
  ia.approved_by,
  up_approved.full_name AS approved_by_name,
  ia.rejection_reason,
  ia.created_at,
  ia.submitted_at,
  ia.approved_at,
  -- Progress percentage
  CASE 
    WHEN ia.items_total = 0 THEN 0
    ELSE ROUND((ia.items_counted::NUMERIC / ia.items_total) * 100, 1)
  END AS progress_percentage,
  -- Status label
  CASE ia.status
    WHEN 'draft' THEN 'Draft'
    WHEN 'counting' THEN 'Counting'
    WHEN 'review' THEN 'Under Review'
    WHEN 'pending_approval' THEN 'Pending Approval'
    WHEN 'approved' THEN 'Approved'
    WHEN 'rejected' THEN 'Rejected'
  END AS status_label
FROM inventory_audits ia
JOIN outlets o ON ia.outlet_id = o.id
LEFT JOIN user_profiles up_created ON ia.created_by = up_created.id
LEFT JOIN user_profiles up_approved ON ia.approved_by = up_approved.id;

COMMENT ON VIEW inventory_audit_summary IS 'Audit list with joined outlet and user details';

-- Grant access
GRANT SELECT ON inventory_audit_summary TO authenticated;

-- ================================================================
-- STEP 9: FUNCTION TO CREATE AUDIT WITH LINE ITEMS
-- ================================================================

CREATE OR REPLACE FUNCTION create_inventory_audit(
  p_outlet_id UUID,
  p_period VARCHAR(7),
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_item_count INTEGER;
BEGIN
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
  VALUES (p_outlet_id, p_period, p_created_by)
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

COMMENT ON FUNCTION create_inventory_audit IS 
  'Creates an audit with line items for all active inventory in the outlet';

-- ================================================================
-- STEP 10: FUNCTION TO SUBMIT AUDIT
-- ================================================================

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
BEGIN
  -- Get audit
  SELECT * INTO v_audit FROM inventory_audits WHERE id = p_audit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit not found';
  END IF;
  
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
        approved_by = p_submitted_by,
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
        p_submitted_by
      );
      
      v_movement_count := v_movement_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT p_audit_id, true, v_movement_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_inventory_audit IS 
  'Submits audit. Auto-approves if all variances positive, else routes to admin';

-- ================================================================
-- STEP 11: FUNCTION TO APPROVE/REJECT AUDIT
-- ================================================================

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
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM user_profiles WHERE id = p_approved_by;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can approve/reject audits';
  END IF;
  
  -- Get audit
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
        approved_by = p_approved_by,
        approved_at = now(),
        rejection_reason = p_rejection_reason
    WHERE id = p_audit_id;
    
    RETURN QUERY SELECT p_audit_id, true, 0;
    RETURN;
  END IF;
  
  -- Approve and create movements
  UPDATE inventory_audits
  SET status = 'approved',
      approved_by = p_approved_by,
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
        p_approved_by
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
        p_approved_by
      );
    END IF;
    
    v_movement_count := v_movement_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT p_audit_id, true, v_movement_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_inventory_audit IS 
  'Admin approves or rejects audit. On approval, creates adjustment movements.';

-- ================================================================
-- STEP 12: TRIGGER TO UPDATE ITEMS_COUNTED
-- ================================================================

CREATE OR REPLACE FUNCTION update_audit_items_counted()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the parent audit's items_counted
  UPDATE inventory_audits
  SET items_counted = (
    SELECT COUNT(*) 
    FROM inventory_audit_line_items
    WHERE audit_id = NEW.audit_id
      AND physical_quantity IS NOT NULL
  )
  WHERE id = NEW.audit_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_items_counted_trigger
  AFTER INSERT OR UPDATE OF physical_quantity ON inventory_audit_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_items_counted();

-- ================================================================
-- STEP 13: GRANT EXECUTE ON FUNCTIONS
-- ================================================================

GRANT EXECUTE ON FUNCTION check_active_audit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_audit(UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_inventory_audit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_inventory_audit(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ================================================================
-- STEP 14: LOG MIGRATION
-- ================================================================

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase3', 'inventory_audits', 'CREATE_TABLE', 'Created audit tables for Phase 3');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase3', 'inventory_audit_line_items', 'CREATE_TABLE', 'Created audit line items table');

INSERT INTO inventory_migration_log (migration_version, table_name, operation, notes)
VALUES ('2.0-phase3', 'functions', 'CREATE_FUNCTIONS', 
        'Created audit functions: create_inventory_audit, submit_inventory_audit, approve_inventory_audit');

-- ================================================================
-- COMPLETION
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'INVENTORY V2.0 PHASE 3 AUDIT TABLES CREATED';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLES CREATED:';
  RAISE NOTICE '  ✓ inventory_audits - Monthly audit records';
  RAISE NOTICE '  ✓ inventory_audit_line_items - Individual item counts';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS CREATED:';
  RAISE NOTICE '  ✓ check_active_audit() - Check if audit in progress';
  RAISE NOTICE '  ✓ create_inventory_audit() - Create audit with line items';
  RAISE NOTICE '  ✓ submit_inventory_audit() - Submit and auto-approve if eligible';
  RAISE NOTICE '  ✓ approve_inventory_audit() - Admin approve/reject';
  RAISE NOTICE '';
  RAISE NOTICE 'VIEWS CREATED:';
  RAISE NOTICE '  ✓ inventory_audit_summary - Audit list with details';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS POLICIES APPLIED:';
  RAISE NOTICE '  ✓ Admin: full access';
  RAISE NOTICE '  ✓ Manager: assigned outlets only';
  RAISE NOTICE '  ✓ Accountant: read-only';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;
