-- ================================================================
-- STEP 2 OF 2: MIGRATE DATA + UPDATE TRIGGERS
-- ================================================================
-- RUN THIS AFTER 030a_add_enum_values.sql has been applied.
-- The new enum values (finalized, partially_paid, paid) must
-- already exist before this script can use them.
-- ================================================================

-- ================================================================
-- 1. MIGRATE EXISTING 'issued' ROWS → 'finalized'
-- ================================================================

UPDATE invoices SET status = 'finalized' WHERE status = 'issued';

-- ================================================================
-- 2. UPDATE CHECK CONSTRAINT
-- ================================================================

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_issued_has_issued_at;
ALTER TABLE invoices ADD CONSTRAINT invoices_finalized_has_issued_at
  CHECK (status NOT IN ('finalized', 'partially_paid', 'paid') OR issued_at IS NOT NULL);

-- ================================================================
-- 3. UPDATE prevent_invoice_modification() TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Cancelled invoices cannot be changed at all
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be modified';
  END IF;

  -- For finalized/partially_paid/paid: only status transitions allowed
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
       OLD.invoice_type IS DISTINCT FROM NEW.invoice_type THEN
      RAISE EXCEPTION 'Only draft invoices can be edited. Current status: %', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 4. UPDATE set_issued_at() TRIGGER FOR 'finalized'
-- ================================================================

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
-- 5. STATUS TRANSITION VALIDATION TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION validate_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS validate_invoice_status_transition_trigger ON invoices;
CREATE TRIGGER validate_invoice_status_transition_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_status_transition();

-- ================================================================
-- 6. REFRESH HELPER VIEW
-- ================================================================

DROP VIEW IF EXISTS invoices_with_details;
CREATE VIEW invoices_with_details AS
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
-- VERIFICATION
-- ================================================================
-- Run after this script completes:
--
--   SELECT unnest(enum_range(NULL::invoice_status));
--   -- Should return: draft, issued, cancelled, finalized, partially_paid, paid
--
--   SELECT status, count(*) FROM invoices GROUP BY status;
--   -- Should show NO rows with 'issued' status
-- ================================================================
