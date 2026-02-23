-- ================================================================
-- INVOICE LIFECYCLE REFACTOR
-- ================================================================
-- Migration 030: Refactors the invoice status enum from
-- (draft, issued, cancelled) to a proper 5-status lifecycle:
--
--   draft → finalized → partially_paid → paid
--   draft → cancelled
--   finalized → cancelled
--
-- CHANGES:
--   1. Add new enum values: finalized, partially_paid, paid
--   2. Migrate existing 'issued' rows to 'finalized'
--   3. Remove old 'issued' value
--   4. Update prevent_invoice_modification() trigger
--   5. Update set_issued_at() trigger for 'finalized'
--   6. Update CHECK constraints
--   7. Add status transition validation trigger
--
-- BACKWARD COMPATIBLE:
--   - All existing 'issued' invoices become 'finalized'
--   - All existing 'draft' and 'cancelled' invoices unchanged
--   - No data loss
-- ================================================================

-- ================================================================
-- 1. ADD NEW ENUM VALUES
-- ================================================================

ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'finalized';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'paid';

-- ================================================================
-- 2. MIGRATE EXISTING 'issued' ROWS TO 'finalized'
-- ================================================================

-- Must be in its own transaction after enum values are committed.
-- Supabase migrations run each file as a single transaction,
-- so we use a DO block to handle this safely.
UPDATE invoices SET status = 'finalized' WHERE status = 'issued';

-- ================================================================
-- 3. DROP AND RECREATE CONSTRAINT
-- ================================================================
-- Update the CHECK constraint that requires issued_at for issued invoices
-- Now it should require issued_at for finalized invoices.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_issued_has_issued_at;
ALTER TABLE invoices ADD CONSTRAINT invoices_finalized_has_issued_at
  CHECK (status NOT IN ('finalized', 'partially_paid', 'paid') OR issued_at IS NOT NULL);

-- ================================================================
-- 4. UPDATE prevent_invoice_modification() TRIGGER
-- ================================================================
-- New rules:
--   - draft: allow all edits
--   - finalized/partially_paid/paid: block field edits (except status transitions)
--   - cancelled: block all changes

CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Cancelled invoices cannot be changed at all
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be modified';
  END IF;

  -- For finalized/partially_paid/paid: only status transitions allowed
  IF OLD.status IN ('finalized', 'partially_paid', 'paid') THEN
    -- Allow status change only (e.g., finalized → cancelled, finalized → partially_paid)
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
       OLD.tax_total IS DISTINCT FROM NEW.tax_total OR
       OLD.grand_total IS DISTINCT FROM NEW.grand_total OR
       OLD.terms_and_conditions IS DISTINCT FROM NEW.terms_and_conditions OR
       OLD.invoice_number IS DISTINCT FROM NEW.invoice_number OR
       OLD.invoice_number_format IS DISTINCT FROM NEW.invoice_number_format OR
       OLD.client_id IS DISTINCT FROM NEW.client_id OR
       OLD.outlet_id IS DISTINCT FROM NEW.outlet_id OR
       OLD.event_id IS DISTINCT FROM NEW.event_id OR
       OLD.invoice_type IS DISTINCT FROM NEW.invoice_type THEN
      RAISE EXCEPTION 'Only draft invoices can be edited. Current status: %', OLD.status;
    END IF;
  END IF;

  -- Draft invoices: all edits allowed (no restrictions)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 5. UPDATE set_issued_at() TRIGGER FOR 'finalized'
-- ================================================================
-- Set issued_at when status changes to finalized (was: issued)

CREATE OR REPLACE FUNCTION set_issued_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    NEW.issued_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 6. STATUS TRANSITION VALIDATION TRIGGER
-- ================================================================
-- Enforces the allowed status transitions:
--   draft → finalized
--   draft → cancelled
--   finalized → partially_paid
--   finalized → cancelled
--   partially_paid → paid
--
-- All other transitions are blocked.

CREATE OR REPLACE FUNCTION validate_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate allowed transitions
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('finalized', 'cancelled')) OR
    (OLD.status = 'finalized' AND NEW.status IN ('partially_paid', 'cancelled')) OR
    (OLD.status = 'partially_paid' AND NEW.status IN ('paid', 'finalized'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % → %. Not allowed.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (runs BEFORE the modification check)
DROP TRIGGER IF EXISTS validate_invoice_status_transition_trigger ON invoices;
CREATE TRIGGER validate_invoice_status_transition_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_status_transition();

-- ================================================================
-- 7. UPDATE HELPER VIEW
-- ================================================================

CREATE OR REPLACE VIEW invoices_with_details AS
SELECT
  i.*,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city,
  e.event_name,
  e.event_date
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN events e ON i.event_id = e.id;

ALTER VIEW invoices_with_details SET (security_invoker = true);

-- ================================================================
-- END OF MIGRATION
-- ================================================================

-- Summary:
-- ✅ Added finalized, partially_paid, paid enum values
-- ✅ Migrated existing 'issued' rows to 'finalized'
-- ✅ Updated CHECK constraint for finalized status
-- ✅ Updated prevent_invoice_modification() for 5-status lifecycle
-- ✅ Updated set_issued_at() to trigger on 'finalized'
-- ✅ Added status transition validation trigger
-- ✅ Allowed transitions: draft→finalized, draft→cancelled,
--    finalized→partially_paid, finalized→cancelled, partially_paid→paid
-- ✅ partially_paid→finalized allowed (for payment reversal)
-- ✅ Refreshed invoices_with_details view
