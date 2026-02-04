-- ================================================================
-- FIX INVOICE SETTLEMENT FALSE POSITIVES
-- ================================================================
-- PROBLEM:
-- The is_invoice_settled() function returns TRUE for non-existent invoices
-- because COALESCE(NULL, 0) <= 0.05 evaluates to TRUE.
--
-- SOLUTION:
-- 1. Explicitly verify invoice existence BEFORE checking balance
-- 2. Return FALSE for non-existent invoices
-- 3. Use safer patterns: EXISTS check, explicit NULL handling
--
-- FALSE POSITIVE SCENARIO (BEFORE FIX):
--   is_invoice_settled('non-existent-uuid') → TRUE ❌
--
-- CORRECT BEHAVIOR (AFTER FIX):
--   is_invoice_settled('non-existent-uuid') → FALSE ✅
-- ================================================================

-- ================================================================
-- 1. FIX is_invoice_settled FUNCTION
-- ================================================================
-- Add explicit invoice existence check

CREATE OR REPLACE FUNCTION is_invoice_settled(p_invoice_id uuid)
RETURNS boolean AS $$
DECLARE
  invoice_exists boolean;
  balance numeric(12,2);
BEGIN
  -- CRITICAL: First verify the invoice exists
  -- If invoice doesn't exist, it is NOT settled
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE id = p_invoice_id
  ) INTO invoice_exists;
  
  IF NOT invoice_exists THEN
    -- Non-existent invoice is NOT settled
    RETURN FALSE;
  END IF;
  
  -- Invoice exists, now calculate balance
  SELECT 
    ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  INTO balance
  FROM invoices i
  LEFT JOIN payments p ON i.id = p.invoice_id
  WHERE i.id = p_invoice_id
  GROUP BY i.id;
  
  -- Invoice is settled if balance is within ₹0.05 tolerance
  -- balance cannot be NULL here because we verified invoice exists
  RETURN ABS(balance) <= 0.05;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_invoice_settled(uuid) IS 
  'Check if an invoice is fully settled (paid within ₹0.05 tolerance). Returns FALSE for non-existent invoices.';

-- ================================================================
-- 2. CREATE SAFE INVOICE BALANCE FUNCTION
-- ================================================================
-- Returns NULL if invoice doesn't exist (explicit handling required)

CREATE OR REPLACE FUNCTION get_invoice_balance(p_invoice_id uuid)
RETURNS numeric(12,2) AS $$
DECLARE
  invoice_exists boolean;
  balance numeric(12,2);
BEGIN
  -- Check invoice existence first
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE id = p_invoice_id
  ) INTO invoice_exists;
  
  IF NOT invoice_exists THEN
    -- Return NULL for non-existent invoice
    -- Caller must handle this explicitly
    RETURN NULL;
  END IF;
  
  -- Calculate balance
  SELECT 
    ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  INTO balance
  FROM invoices i
  LEFT JOIN payments p ON i.id = p.invoice_id
  WHERE i.id = p_invoice_id
  GROUP BY i.id;
  
  -- Apply settlement tolerance
  IF ABS(balance) <= 0.05 THEN
    RETURN 0.00;
  END IF;
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_invoice_balance(uuid) IS 
  'Get invoice balance due with ₹0.05 settlement tolerance. Returns NULL if invoice does not exist.';

-- ================================================================
-- 3. CREATE SAFE PAYMENT STATUS FUNCTION
-- ================================================================
-- Returns NULL if invoice doesn't exist (not 'unpaid')

CREATE OR REPLACE FUNCTION get_invoice_payment_status(p_invoice_id uuid)
RETURNS text AS $$
DECLARE
  invoice_exists boolean;
  amount_paid numeric(12,2);
  grand_total numeric(12,2);
  balance numeric(12,2);
BEGIN
  -- Check invoice existence first
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE id = p_invoice_id
  ) INTO invoice_exists;
  
  IF NOT invoice_exists THEN
    -- Return NULL for non-existent invoice
    -- This is explicit: NULL means "unknown" not "unpaid"
    RETURN NULL;
  END IF;
  
  -- Get invoice total and calculate payments
  SELECT 
    i.grand_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  INTO grand_total, amount_paid
  FROM invoices i
  LEFT JOIN payments p ON i.id = p.invoice_id
  WHERE i.id = p_invoice_id
  GROUP BY i.id;
  
  -- Calculate balance
  balance := ROUND(grand_total - amount_paid, 2);
  
  -- Determine status
  IF amount_paid = 0 THEN
    RETURN 'unpaid';
  ELSIF ABS(balance) <= 0.05 THEN
    RETURN 'paid';
  ELSE
    RETURN 'partially_paid';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_invoice_payment_status(uuid) IS 
  'Get invoice payment status (unpaid/partially_paid/paid). Returns NULL if invoice does not exist.';

-- ================================================================
-- 4. UPDATE prevent_overpayment TRIGGER
-- ================================================================
-- Already has proper NULL check, but let's make it explicit

CREATE OR REPLACE FUNCTION prevent_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_exists boolean;
  invoice_total numeric(12,2);
  existing_payments numeric(12,2);
  new_total numeric(12,2);
  tolerance numeric(12,2) := 0.05;
BEGIN
  -- CRITICAL: Verify invoice exists first
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE id = NEW.invoice_id
  ) INTO invoice_exists;
  
  IF NOT invoice_exists THEN
    RAISE EXCEPTION 'Invoice does not exist: %', NEW.invoice_id;
  END IF;
  
  -- Get invoice grand total (guaranteed to exist now)
  SELECT grand_total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Calculate existing active payments for this invoice
  SELECT ROUND(COALESCE(SUM(amount), 0), 2) INTO existing_payments
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND is_active = true
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Calculate new total with this payment
  new_total := ROUND(existing_payments + NEW.amount, 2);
  
  -- Reject overpayments beyond tolerance
  IF new_total > (invoice_total + tolerance) THEN
    RAISE EXCEPTION 'Payment rejected: Total payments (₹% + ₹%) = ₹% exceeds invoice total ₹%',
      existing_payments, NEW.amount, new_total, invoice_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- 
-- ✅ FIXED: is_invoice_settled() now returns FALSE for non-existent invoices
-- ✅ ADDED: get_invoice_balance() returns NULL for non-existent invoices
-- ✅ ADDED: get_invoice_payment_status() returns NULL for non-existent invoices
-- ✅ UPDATED: prevent_overpayment() has explicit existence check
--
-- WHY FALSE POSITIVES CAN NO LONGER HAPPEN:
--
-- BEFORE (BUG):
--   is_invoice_settled('bad-uuid')
--   → Query returns no rows → balance = NULL
--   → COALESCE(NULL, 0) = 0
--   → ABS(0) <= 0.05 = TRUE ❌ (false positive!)
--
-- AFTER (FIX):
--   is_invoice_settled('bad-uuid')
--   → EXISTS check returns FALSE
--   → Function returns FALSE immediately ✅
--   → No false positive possible
--
-- SAFE PATTERNS USED:
-- 1. EXISTS(...) - Boolean check that never returns NULL
-- 2. Explicit "IF NOT invoice_exists THEN RETURN FALSE"
-- 3. NULL return for functions where caller must handle missing data
-- ================================================================
