-- ================================================================
-- MIGRATION 034: FIX INVOICE PAYMENT STATUS TRANSITIONS
-- ================================================================
-- BUG:
--   validate_invoice_status_transition() (from 030) does not allow
--   finalized → paid. When a single payment settles an invoice in
--   full, syncInvoicePaymentStatus tries exactly that transition,
--   the trigger raises, the frontend swallowed the error, and the
--   invoice stayed 'finalized' forever.
--
--   It also does not allow any transition OUT of 'paid', so
--   deactivating (soft-deleting) a payment on a paid invoice could
--   not revert the status.
--
-- FIX:
--   1. Allow finalized → paid          (single full payment)
--   2. Allow paid → partially_paid     (payment reversal, partial remains)
--   3. Allow paid → finalized          (payment reversal, nothing remains)
--   4. Data repair: move already-stuck invoices to their correct status.
--
-- Allowed transitions after this migration:
--   draft          → finalized, cancelled
--   finalized      → partially_paid, paid, cancelled
--   partially_paid → paid, finalized
--   paid           → partially_paid, finalized
--   cancelled      → (none)
--
-- RUN ORDER: after 033. Frontend change ships together
-- (src/services/invoiceService.ts mirrors this map and no longer
-- swallows sync errors).
-- ================================================================

BEGIN;

-- ================================================================
-- 1. REPLACE THE TRANSITION VALIDATION FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION validate_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'          AND NEW.status IN ('finalized', 'cancelled')) OR
    (OLD.status = 'finalized'      AND NEW.status IN ('partially_paid', 'paid', 'cancelled')) OR
    (OLD.status = 'partially_paid' AND NEW.status IN ('paid', 'finalized')) OR
    (OLD.status = 'paid'           AND NEW.status IN ('partially_paid', 'finalized'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % → %. Not allowed.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 2. DATA REPAIR: UNSTICK INVOICES THAT SHOULD BE 'paid'
-- ================================================================
-- Invoices whose active payments already cover the grand total
-- (within the ₹0.05 settlement tolerance used by the app) but whose
-- status is still finalized/partially_paid because the old trigger
-- rejected the transition.

DO $$
DECLARE
  v_fixed integer;
BEGIN
  UPDATE invoices i
  SET status = 'paid'
  FROM invoices_with_payment_status v
  WHERE v.id = i.id
    AND i.status IN ('finalized', 'partially_paid')
    AND v.amount_paid > 0
    AND (i.grand_total - v.amount_paid) <= 0.05;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE 'Repaired % invoice(s) stuck below ''paid'' status', v_fixed;
END $$;

-- Also: invoices sitting at 'finalized' that have partial payments
-- recorded (sync failed for the same reason on some paths).
DO $$
DECLARE
  v_fixed integer;
BEGIN
  UPDATE invoices i
  SET status = 'partially_paid'
  FROM invoices_with_payment_status v
  WHERE v.id = i.id
    AND i.status = 'finalized'
    AND v.amount_paid > 0
    AND (i.grand_total - v.amount_paid) > 0.05;

  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RAISE NOTICE 'Repaired % invoice(s) stuck at finalized with partial payments', v_fixed;
END $$;

COMMIT;

-- ================================================================
-- Summary:
-- ✅ finalized → paid now allowed (single full payment works)
-- ✅ paid → partially_paid / finalized allowed (payment reversal)
-- ✅ Historical stuck invoices repaired to correct status
-- ================================================================
