-- ================================================================
-- MIGRATION 036: SERIALIZE INVOICE NUMBER GENERATION
-- ================================================================
-- BUG:
--   generate_invoice_number() (029) computes the next sequence with
--   SELECT GREATEST(MAX(...)) + 1 and no locking. Two invoices
--   created at the same moment can compute the same number; the
--   UNIQUE constraint then makes one insert fail with a raw
--   "duplicate key" error.
--
-- FIX:
--   Take a transaction-scoped advisory lock before computing the
--   sequence. This serializes invoice creation; at this business's
--   volume the cost is negligible. The lock is released
--   automatically at commit/rollback.
--
-- The function body is otherwise identical to 029 (incl. the
-- legacy floor of 30).
--
-- RUN ORDER: after 029 (any time; independent of 034/035).
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

  -- Serialize number generation across concurrent transactions.
  -- Without this, two simultaneous inserts read the same MAX() and
  -- collide on the UNIQUE constraint.
  PERFORM pg_advisory_xact_lock(hashtext('hybits_generate_invoice_number'));

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
      WHERE invoice_number ~ '^INV-[0-9]{8}-[0-9]+$';

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- Summary:
-- ✅ Invoice number generation serialized via advisory lock
-- ✅ No numbering/format logic changed
-- ================================================================
