-- ================================================================
-- INVOICE ENHANCEMENTS: T&C + NUMBER FORMAT
-- ================================================================
-- Migration 027: Adds Terms & Conditions snapshot and configurable
-- invoice number formatting.
--
-- BACKWARD COMPATIBLE:
--   - terms_and_conditions is nullable (old invoices stay NULL)
--   - invoice_number_format is nullable (old invoices keep existing numbers)
--   - Existing invoice_number trigger is replaced with format-aware version
--   - Existing invoice numbers are NEVER modified
--
-- Business Rules:
--   - T&C is snapshotted at creation time (immutable once saved)
--   - Invoice number format is chosen at creation time
--   - System controls the sequence counter (no user override)
--   - invoice_number remains UNIQUE and locked once generated
-- ================================================================

-- ================================================================
-- 1. ADD TERMS & CONDITIONS COLUMN
-- ================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;

COMMENT ON COLUMN invoices.terms_and_conditions IS
  'Snapshot of terms & conditions at time of invoice creation. NULL for legacy invoices.';

-- ================================================================
-- 2. ADD INVOICE NUMBER FORMAT COLUMN
-- ================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number_format text;

COMMENT ON COLUMN invoices.invoice_number_format IS
  'The format template used to generate this invoice number. NULL for legacy (INV-YYYYMMDD-NNNN).';

-- ================================================================
-- 3. REPLACE INVOICE NUMBER TRIGGER
-- ================================================================
-- The new trigger supports configurable formats:
--   'default'       => INV-YYYYMMDD-NNNN           (legacy)
--   'outlet_fy'     => INV/HYB_001/2025-26/NNNN
--   'outlet_short'  => INV-HYB_001-NNNN
--   'fy_only'       => INV/2025-26/NNNN
--
-- The sequence (NNNN) increments per format-prefix per day or FY.
-- If invoice_number is already set, it is NOT overwritten.
-- ================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  outlet_code_val text;
  fy_str text;
  fy_start date;
  prefix text;
  seq_num integer;
  fmt text;
BEGIN
  -- If invoice_number is already set, do nothing (locked numbers)
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number != '' THEN
    RETURN NEW;
  END IF;

  -- Determine format (default to legacy if NULL)
  fmt := COALESCE(NEW.invoice_number_format, 'default');

  -- Get outlet code for outlet-based formats
  IF fmt IN ('outlet_fy', 'outlet_short') THEN
    SELECT code INTO outlet_code_val
    FROM outlets
    WHERE id = NEW.outlet_id;

    IF outlet_code_val IS NULL THEN
      outlet_code_val := 'UNKNOWN';
    END IF;
  END IF;

  -- Calculate financial year string (Apr-Mar cycle)
  -- If month >= April, FY = YYYY-(YY+1). If month < April, FY = (YYYY-1)-YY.
  IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
    fy_str := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(EXTRACT(YEAR FROM NOW())::integer + 1 - 2000, 'FM00');
    fy_start := make_date(EXTRACT(YEAR FROM NOW())::integer, 4, 1);
  ELSE
    fy_str := TO_CHAR(EXTRACT(YEAR FROM NOW())::integer - 1, 'FM0000') || '-' || TO_CHAR(NOW(), 'YY');
    fy_start := make_date(EXTRACT(YEAR FROM NOW())::integer - 1, 4, 1);
  END IF;

  -- Build prefix and find next sequence
  CASE fmt
    WHEN 'outlet_fy' THEN
      prefix := 'INV/' || outlet_code_val || '/' || fy_str || '/';
      -- Sequence per FY per outlet
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(invoice_number FROM LENGTH(prefix) + 1)
          AS INTEGER
        )
      ), 0) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at >= fy_start;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    WHEN 'outlet_short' THEN
      prefix := 'INV-' || outlet_code_val || '-';
      -- Sequence per day per outlet
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(invoice_number FROM LENGTH(prefix) + 1)
          AS INTEGER
        )
      ), 0) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at::date = CURRENT_DATE;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    WHEN 'fy_only' THEN
      prefix := 'INV/' || fy_str || '/';
      -- Sequence per FY
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(invoice_number FROM LENGTH(prefix) + 1)
          AS INTEGER
        )
      ), 0) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at >= fy_start;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    ELSE
      -- 'default': legacy format INV-YYYYMMDD-NNNN
      prefix := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'INV-[0-9]{8}-([0-9]+)') AS INTEGER)
      ), 0) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%';

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists; the function is replaced in-place.
-- No need to re-create the trigger.

-- ================================================================
-- 4. PROTECT T&C AND FORMAT ON ISSUED INVOICES
-- ================================================================
-- Extend the existing prevent_invoice_modification trigger function
-- to also guard terms_and_conditions and invoice_number_format.

CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent editing issued invoices (except status change to cancelled)
  IF OLD.status = 'issued' AND NEW.status = 'issued' THEN
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
       OLD.tax_total IS DISTINCT FROM NEW.tax_total OR
       OLD.grand_total IS DISTINCT FROM NEW.grand_total OR
       OLD.terms_and_conditions IS DISTINCT FROM NEW.terms_and_conditions OR
       OLD.invoice_number IS DISTINCT FROM NEW.invoice_number OR
       OLD.invoice_number_format IS DISTINCT FROM NEW.invoice_number_format THEN
      RAISE EXCEPTION 'Issued invoices cannot be modified';
    END IF;
  END IF;
  
  -- Prevent issuing cancelled invoices
  IF OLD.status = 'cancelled' AND NEW.status = 'issued' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be issued';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- END OF MIGRATION
-- ================================================================

-- Summary:
-- ✅ Added terms_and_conditions column (nullable, backward compatible)
-- ✅ Added invoice_number_format column (nullable, backward compatible)
-- ✅ Replaced invoice number trigger with format-aware version
-- ✅ Supported formats: default, outlet_fy, outlet_short, fy_only
-- ✅ Extended modification protection to new columns
-- ✅ Old invoices untouched (NULL defaults)
-- ✅ Sequence controlled by system (no user override)
-- ✅ Invoice numbers locked once generated
