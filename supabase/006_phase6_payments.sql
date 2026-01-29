-- ================================================================
-- PHASE 6: PAYMENTS (ACCOUNTING CORE)
-- ================================================================
-- This migration creates the payment tracking system for invoices.
--
-- Business Rules (LOCKED):
--   - Payments ALWAYS linked to an invoice
--   - Multiple payments per invoice (partial payments allowed)
--   - Overpayment NOT allowed (strict ₹1 tolerance for rounding)
--   - No payments on cancelled invoices
--   - Soft deletes only (is_active flag)
--   - Payment status DERIVED, never stored
--
-- Payment Flow:
--   - Invoice issued → can receive payments
--   - Payment recorded → balance decreases
--   - Multiple partial payments → balance updates
--   - When balance = 0 → invoice fully paid
--
-- Role Access:
--   - Admin: Full CRUD on all payments (all outlets)
--   - Manager: CRUD only for assigned outlet payments
--   - Accountant: Full CRUD on all payments (all outlets)
-- ================================================================

-- ================================================================
-- 1. CREATE ENUM FOR PAYMENT METHOD
-- ================================================================

CREATE TYPE payment_method AS ENUM (
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'cheque'
);

-- ================================================================
-- 2. CREATE PAYMENTS TABLE
-- ================================================================

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invoice link (MANDATORY)
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  
  -- Payment details
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method payment_method NOT NULL,
  payment_date date NOT NULL CHECK (payment_date <= CURRENT_DATE),
  reference_number text,
  notes text,
  
  -- Soft delete
  is_active boolean NOT NULL DEFAULT true,
  
  -- Audit trail
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Fast lookup by invoice
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

-- Fast filtering by date
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Fast filtering by method
CREATE INDEX idx_payments_payment_method ON payments(payment_method);

-- Fast lookup for active payments only
CREATE INDEX idx_payments_is_active ON payments(is_active) WHERE is_active = true;

-- Composite for common queries (invoice + active)
CREATE INDEX idx_payments_invoice_active ON payments(invoice_id, is_active) WHERE is_active = true;

-- Fast lookup by creator (audit)
CREATE INDEX idx_payments_created_by ON payments(created_by);

-- ================================================================
-- 4. PREVENT OVERPAYMENT (CRITICAL TRIGGER)
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric(12,2);
  existing_payments numeric(12,2);
  new_total numeric(12,2);
  tolerance numeric(12,2) := 1.00; -- ₹1 rounding tolerance
BEGIN
  -- Get invoice grand total
  SELECT grand_total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  IF invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice does not exist';
  END IF;
  
  -- Calculate existing active payments for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO existing_payments
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- Exclude current payment on UPDATE
  
  -- Calculate new total with this payment
  new_total := existing_payments + NEW.amount;
  
  -- STRICT CHECK: Allow only ₹1 tolerance for rounding
  IF new_total > (invoice_total + tolerance) THEN
    RAISE EXCEPTION 'Payment rejected: Total payments (₹% + ₹%) = ₹% exceeds invoice total ₹% (tolerance: ₹%)',
      existing_payments, NEW.amount, new_total, invoice_total, tolerance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_overpayment_trigger
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION prevent_overpayment();

-- ================================================================
-- 5. VALIDATE PAYMENT AGAINST INVOICE STATUS
-- ================================================================

CREATE OR REPLACE FUNCTION validate_payment_against_invoice()
RETURNS TRIGGER AS $$
DECLARE
  invoice_status_val invoice_status;
BEGIN
  -- Get invoice status
  SELECT status INTO invoice_status_val
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Cannot add payments to draft invoices
  IF invoice_status_val = 'draft' THEN
    RAISE EXCEPTION 'Cannot record payment for draft invoice. Issue the invoice first.';
  END IF;
  
  -- Cannot add payments to cancelled invoices
  IF invoice_status_val = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record payment for cancelled invoice.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_against_invoice_trigger
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION validate_payment_against_invoice();

-- ================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 7. RLS POLICIES FOR PAYMENTS
-- ================================================================

-- Admin: Full access to all payments
CREATE POLICY "admins_full_access_payments"
ON payments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

-- Manager: Access payments for their outlet invoices only
CREATE POLICY "managers_select_own_outlet_payments"
ON payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND invoice_id IN (
    SELECT i.id FROM invoices i
    WHERE i.outlet_id IN (
      SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "managers_insert_own_outlet_payments"
ON payments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND invoice_id IN (
    SELECT i.id FROM invoices i
    WHERE i.outlet_id IN (
      SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "managers_update_own_outlet_payments"
ON payments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'manager' AND up.is_active = true
  ) AND invoice_id IN (
    SELECT i.id FROM invoices i
    WHERE i.outlet_id IN (
      SELECT outlet_id FROM user_outlet_assignments WHERE user_id = auth.uid()
    )
  )
);

-- Accountant: Full access to all payments (all outlets)
CREATE POLICY "accountants_full_access_payments"
ON payments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'accountant' AND is_active = true
  )
);

-- ================================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ================================================================

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 9. TRIGGER FOR CREATED_BY
-- ================================================================

CREATE TRIGGER set_payments_created_by
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- 10. VIEW: INVOICES WITH PAYMENT STATUS (DERIVED)
-- ================================================================

CREATE OR REPLACE VIEW invoices_with_payment_status AS
SELECT 
  i.*,
  -- Calculate amount paid (only active payments)
  COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0) AS amount_paid,
  -- Calculate balance due
  i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0) AS balance_due,
  -- Derive payment status
  CASE
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0) = 0 THEN 'unpaid'
    WHEN COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0) >= i.grand_total THEN 'paid'
    ELSE 'partially_paid'
  END AS payment_status
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoice_id
GROUP BY i.id;

-- Set security invoker for view
ALTER VIEW invoices_with_payment_status SET (security_invoker = true);

-- ================================================================
-- 11. VIEW: PAYMENTS WITH INVOICE DETAILS
-- ================================================================

CREATE OR REPLACE VIEW payments_with_details AS
SELECT 
  p.*,
  i.invoice_number,
  i.invoice_type,
  i.grand_total AS invoice_total,
  i.status AS invoice_status,
  c.name AS client_name,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  up.full_name AS recorded_by_name
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN user_profiles up ON p.created_by = up.id;

-- Set security invoker for view
ALTER VIEW payments_with_details SET (security_invoker = true);

-- ================================================================
-- END OF PHASE 6 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created payment_method ENUM (cash, upi, bank_transfer, card, cheque)
-- ✅ Created payments table with soft delete (is_active)
-- ✅ Added indexes for performance optimization
-- ✅ Trigger: prevent_overpayment() - STRICT ₹1 tolerance
-- ✅ Trigger: validate_payment_against_invoice() - blocks draft/cancelled
-- ✅ Enabled RLS with role-based policies
-- ✅ Admin: Full access all outlets
-- ✅ Manager: Outlet-restricted access
-- ✅ Accountant: Full access all outlets
-- ✅ Triggers for updated_at and created_by
-- ✅ VIEW: invoices_with_payment_status (derived payment_status, amount_paid, balance_due)
-- ✅ VIEW: payments_with_details (for easy queries with joined data)
-- ✅ No modifications to invoices table (invoices remain immutable)
-- ✅ Balance and payment status calculated on-the-fly
-- ✅ Audit trail: created_at, updated_at, created_by, is_active
