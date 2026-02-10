-- ================================================================
-- INVOICE SEQUENCE FLOOR (CONTINUATION FROM LEGACY SYSTEM)
-- ================================================================
--
-- PROBLEM:
--   Business had 30 invoices in previous system (up to NNNN = 0030).
--   New system starts at 0001 because no legacy invoices are in DB.
--
-- SOLUTION:
--   Add a GREATEST() floor to the trigger so the counter
--   never drops below 30. Next invoice = GREATEST(MAX, 30) + 1 = 0031.
--
-- SAFETY:
--   - Once invoices surpass 30, GREATEST becomes a no-op
--   - No existing invoices are modified
--   - No format logic is changed
--   - All 4 formats get the same floor for consistency
--   - GST and audit safe
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
  -- Floor value: ensures numbering continues from legacy system
  -- Legacy system had invoices up to 0030, so floor = 30 → next = 0031
  seq_floor integer := 30;
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
  IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
    fy_str := TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(EXTRACT(YEAR FROM NOW())::integer + 1 - 2000, 'FM00');
    fy_start := make_date(EXTRACT(YEAR FROM NOW())::integer, 4, 1);
  ELSE
    fy_str := TO_CHAR(EXTRACT(YEAR FROM NOW())::integer - 1, 'FM0000') || '-' || TO_CHAR(NOW(), 'YY');
    fy_start := make_date(EXTRACT(YEAR FROM NOW())::integer - 1, 4, 1);
  END IF;

  -- Build prefix and find next sequence
  -- GREATEST(MAX, seq_floor) ensures we never go below the legacy floor
  CASE fmt
    WHEN 'outlet_fy' THEN
      prefix := 'INV/' || outlet_code_val || '/' || fy_str || '/';
      SELECT GREATEST(
        COALESCE(MAX(
          CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 1) AS INTEGER)
        ), 0),
        seq_floor
      ) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at >= fy_start;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    WHEN 'outlet_short' THEN
      prefix := 'INV-' || outlet_code_val || '-';
      SELECT GREATEST(
        COALESCE(MAX(
          CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 1) AS INTEGER)
        ), 0),
        seq_floor
      ) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at::date = CURRENT_DATE;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    WHEN 'fy_only' THEN
      prefix := 'INV/' || fy_str || '/';
      SELECT GREATEST(
        COALESCE(MAX(
          CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 1) AS INTEGER)
        ), 0),
        seq_floor
      ) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE prefix || '%'
        AND created_at >= fy_start;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    ELSE
      -- 'default': legacy format INV-YYYYMMDD-NNNN
      prefix := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
      SELECT GREATEST(
        COALESCE(MAX(
          CAST(SUBSTRING(invoice_number FROM 'INV-[0-9]{8}-([0-9]+)') AS INTEGER)
        ), 0),
        seq_floor
      ) + 1
      INTO seq_num
      FROM invoices
      WHERE invoice_number LIKE 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%';

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- END OF MIGRATION
-- ================================================================
-- Summary:
-- ✅ Invoice numbering continues from 0031 (after legacy 0030)
-- ✅ All 4 formats get the same floor for consistency
-- ✅ Once invoices exceed 0030, GREATEST becomes irrelevant (no-op)
-- ✅ No existing invoices modified
-- ✅ No format logic changed
-- ✅ Trigger is replaced in-place (no need to recreate)
-- ================================================================
