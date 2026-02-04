-- ================================================================
-- FIX: FLOATING-POINT ROUNDING IN PAYMENT CALCULATIONS
-- ================================================================
-- Issue: Payment amounts stored with floating-point precision caused
-- discrepancies like:
--   - Invoice total: ₹23,600.00
--   - Payment recorded: ₹23,600.00
--   - System stores: ₹23,599.98
--   - Balance shows: ₹0.02
--
-- Root Cause: JavaScript floating-point arithmetic + inconsistent
-- rounding at service layer caused drift when values pass through
-- frontend -> service -> database.
--
-- Fix: Ensure all monetary calculations use ROUND(..., 2) at the
-- database level for defense-in-depth.
-- ================================================================

-- ================================================================
-- 1. UPDATE invoices_with_payment_status VIEW
-- ================================================================
-- Add explicit ROUND() to balance_due calculation to prevent
-- accumulated floating-point errors in the database result.

CREATE OR REPLACE VIEW invoices_with_payment_status AS
SELECT 
  i.*,
  -- Calculate amount paid (only active payments) - ROUND for safety
  ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) AS amount_paid,
  -- Calculate balance due - CRITICAL: Use ROUND to prevent floating-point drift
  ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) AS balance_due,
  -- Derive payment status - use ROUND for comparison to handle edge cases
  CASE
    WHEN ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) = 0 THEN 'unpaid'
    WHEN ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) >= i.grand_total THEN 'paid'
    ELSE 'partially_paid'
  END AS payment_status
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoice_id
GROUP BY i.id;

-- Re-set security invoker for view
ALTER VIEW invoices_with_payment_status SET (security_invoker = true);

-- ================================================================
-- 2. ADD TRIGGER TO ROUND PAYMENT AMOUNTS ON INSERT/UPDATE
-- ================================================================
-- Defense-in-depth: Even if frontend/service fails to round,
-- the database will ensure payment amounts are stored with
-- exactly 2 decimal places.

CREATE OR REPLACE FUNCTION round_payment_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Round amount to exactly 2 decimal places
  -- This catches any floating-point drift from the application layer
  NEW.amount := ROUND(NEW.amount, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS round_payment_amount_trigger ON payments;

-- Create trigger - runs BEFORE insert/update to ensure clean data
CREATE TRIGGER round_payment_amount_trigger
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION round_payment_amount();

-- ================================================================
-- 3. UPDATE prevent_overpayment FUNCTION TO USE ROUND
-- ================================================================
-- Ensure overpayment check uses consistent rounding

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
  
  -- Calculate existing active payments for this invoice - USE ROUND
  SELECT ROUND(COALESCE(SUM(amount), 0), 2) INTO existing_payments
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- Exclude current payment on UPDATE
  
  -- Calculate new total with this payment - USE ROUND
  new_total := ROUND(existing_payments + NEW.amount, 2);
  
  -- STRICT CHECK: Allow only ₹1 tolerance for rounding
  IF new_total > (invoice_total + tolerance) THEN
    RAISE EXCEPTION 'Payment rejected: Total payments (₹% + ₹%) = ₹% exceeds invoice total ₹% (tolerance: ₹%)',
      existing_payments, NEW.amount, new_total, invoice_total, tolerance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 4. ONE-TIME FIX: ROUND ANY EXISTING PAYMENT AMOUNTS
-- ================================================================
-- Clean up any existing payments that may have floating-point drift

UPDATE payments 
SET amount = ROUND(amount, 2)
WHERE amount != ROUND(amount, 2);

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- ✅ invoices_with_payment_status view now uses ROUND() for all calculations
-- ✅ New trigger round_payment_amount() ensures clean data on insert/update
-- ✅ prevent_overpayment() function updated with ROUND() for consistency
-- ✅ One-time cleanup of any existing floating-point drift in payments
--
-- Combined with application-layer fixes (roundCurrency utility),
-- this provides defense-in-depth against floating-point rounding errors.
-- ================================================================
