-- ================================================================
-- FIX PAYMENT SETTLEMENT ROUNDING
-- ================================================================
-- Issue: Tiny balance amounts (₹0.01, ₹0.02) appear after full payment
-- due to floating-point arithmetic errors.
--
-- Solution: 
-- 1. If ABS(balance_due) <= ₹0.05, treat as fully paid
-- 2. Display balance_due as ₹0.00 for these cases
-- 3. Set payment_status to 'paid' when within tolerance
--
-- Rules:
-- - balance_due = ROUND(grand_total - total_paid, 2)
-- - If ABS(balance_due) <= 0.05 → balance_due = 0.00, status = 'paid'
-- - Ledger reflects exact invoice total as final truth
-- ================================================================

-- ================================================================
-- 1. UPDATE invoices_with_payment_status VIEW
-- ================================================================
-- Apply settlement tolerance of ₹0.05 for marking invoices as paid

CREATE OR REPLACE VIEW invoices_with_payment_status AS
SELECT 
  i.*,
  -- Calculate raw amount paid (only active payments)
  ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) AS amount_paid,
  
  -- Calculate balance_due with settlement tolerance
  -- If raw balance is within ₹0.05, treat as zero (fully settled)
  CASE
    WHEN ABS(
      ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
    ) <= 0.05 
    THEN 0.00
    ELSE ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  END AS balance_due,
  
  -- Derive payment status with settlement tolerance
  -- Invoices within ₹0.05 of being paid are marked as 'paid'
  CASE
    WHEN ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) = 0 
      THEN 'unpaid'
    WHEN ABS(
      ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
    ) <= 0.05 
      THEN 'paid'
    ELSE 'partially_paid'
  END AS payment_status
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoice_id
GROUP BY i.id;

-- Re-set security invoker for view
ALTER VIEW invoices_with_payment_status SET (security_invoker = true);

-- ================================================================
-- 2. UPDATE prevent_overpayment FUNCTION
-- ================================================================
-- Update tolerance to match the new settlement threshold

CREATE OR REPLACE FUNCTION prevent_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric(12,2);
  existing_payments numeric(12,2);
  new_total numeric(12,2);
  tolerance numeric(12,2) := 0.05; -- ₹0.05 settlement tolerance (matches view)
BEGIN
  -- Get invoice grand total
  SELECT grand_total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  IF invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice does not exist';
  END IF;
  
  -- Calculate existing active payments for this invoice
  SELECT ROUND(COALESCE(SUM(amount), 0), 2) INTO existing_payments
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Calculate new total with this payment
  new_total := ROUND(existing_payments + NEW.amount, 2);
  
  -- Allow payments that settle the invoice exactly or with tiny overage
  -- The settlement tolerance is ₹0.05
  IF new_total > (invoice_total + tolerance) THEN
    RAISE EXCEPTION 'Payment rejected: Total payments (₹% + ₹%) = ₹% exceeds invoice total ₹%',
      existing_payments, NEW.amount, new_total, invoice_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 3. CREATE HELPER FUNCTION FOR SETTLEMENT CHECK
-- ================================================================
-- Can be used in application code via RPC if needed

CREATE OR REPLACE FUNCTION is_invoice_settled(p_invoice_id uuid)
RETURNS boolean AS $$
DECLARE
  balance numeric(12,2);
BEGIN
  SELECT 
    ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  INTO balance
  FROM invoices i
  LEFT JOIN payments p ON i.id = p.invoice_id
  WHERE i.id = p_invoice_id
  GROUP BY i.id;
  
  -- Invoice is settled if balance is within ₹0.05 tolerance
  RETURN ABS(COALESCE(balance, 0)) <= 0.05;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- ✅ invoices_with_payment_status view now applies ₹0.05 settlement tolerance
-- ✅ balance_due shows ₹0.00 when within tolerance (not ₹0.01 or ₹0.02)
-- ✅ payment_status shows 'paid' when within tolerance
-- ✅ prevent_overpayment uses consistent ₹0.05 tolerance
-- ✅ Helper function is_invoice_settled() for application use
--
-- Rules enforced:
-- 1. balance_due = ROUND(grand_total - amount_paid, 2)
-- 2. If ABS(balance_due) <= 0.05 → balance_due = 0.00, status = 'paid'
-- 3. Never show ₹0.01 or ₹0.02 balance in UI
-- 4. Ledger (grand_total) is preserved as final truth
-- ================================================================
