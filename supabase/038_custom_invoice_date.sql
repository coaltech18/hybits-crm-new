-- ================================================================
-- MIGRATION 038: CUSTOM (BACK-DATED) INVOICE DATE
-- ================================================================
-- WHY:
--   Historical invoice data was lost (server + laptop). The manager
--   needs to re-enter past invoices carrying their ORIGINAL dates so
--   that reports, aging and the GST working sheets reconstruct
--   correctly. issued_at is the invoice date everywhere downstream
--   (report_*, gst_working_*, invoice PDF), so it is the only field
--   that has to become user-settable.
--
-- WHAT CHANGES:
--   1. set_issued_at() no longer clobbers a date the app supplied.
--      It only defaults to NOW() when issued_at is still NULL.
--   2. generate_invoice_number() derives the date / financial year
--      from the invoice's own date instead of NOW(), so a back-dated
--      invoice gets a number in the correct day and FY sequence
--      rather than today's.
--
-- NOT CHANGED:
--   - Number format logic, legacy floor of 30, advisory lock (036).
--   - Only drafts are editable, so the UI can only set the date
--     before finalization. Correcting a finalized invoice still
--     means cancel + reissue.
--
-- RUN ORDER: after 036. Independent of 037.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. PRESERVE AN EXPLICIT INVOICE DATE
-- ----------------------------------------------------------------
-- Trigger is BEFORE UPDATE only, so an INSERT that carries issued_at
-- already survives; this stops the finalize step from overwriting it.

CREATE OR REPLACE FUNCTION set_issued_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    NEW.issued_at := COALESCE(NEW.issued_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 2. NUMBER THE INVOICE BY ITS OWN DATE
-- ----------------------------------------------------------------
-- Identical to 036 except every NOW() / CURRENT_DATE / created_at
-- reference becomes inv_date, i.e. the invoice's own date.

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  outlet_code_val text;
  fy_str text;
  fy_start date;
  prefix text;
  seq_num integer;
  fmt text;
  -- The invoice's own date; falls back to now for normal same-day billing
  inv_date timestamptz;
  -- Floor value: ensures numbering continues from legacy system
  -- Legacy system had invoices up to 0030, so floor = 30 → next = 0031
  seq_floor integer := 30;
BEGIN
  -- If invoice_number is already set, do nothing (locked numbers)
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number != '' THEN
    RETURN NEW;
  END IF;

  inv_date := COALESCE(NEW.issued_at, NOW());

  -- Serialize number generation across concurrent transactions.
  PERFORM pg_advisory_xact_lock(hashtext('hybits_generate_invoice_number'));

  fmt := COALESCE(NEW.invoice_number_format, 'default');

  IF fmt IN ('outlet_fy', 'outlet_short') THEN
    SELECT code INTO outlet_code_val
    FROM outlets
    WHERE id = NEW.outlet_id;

    IF outlet_code_val IS NULL THEN
      outlet_code_val := 'UNKNOWN';
    END IF;
  END IF;

  -- Financial year of the INVOICE date (Apr-Mar cycle)
  IF EXTRACT(MONTH FROM inv_date) >= 4 THEN
    fy_str := TO_CHAR(inv_date, 'YYYY') || '-' || TO_CHAR(EXTRACT(YEAR FROM inv_date)::integer + 1 - 2000, 'FM00');
    fy_start := make_date(EXTRACT(YEAR FROM inv_date)::integer, 4, 1);
  ELSE
    fy_str := TO_CHAR(EXTRACT(YEAR FROM inv_date)::integer - 1, 'FM0000') || '-' || TO_CHAR(inv_date, 'YY');
    fy_start := make_date(EXTRACT(YEAR FROM inv_date)::integer - 1, 4, 1);
  END IF;

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
        AND COALESCE(issued_at, created_at) >= fy_start;

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
        AND COALESCE(issued_at, created_at)::date = inv_date::date;

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
        AND COALESCE(issued_at, created_at) >= fy_start;

      NEW.invoice_number := prefix || LPAD(seq_num::TEXT, 4, '0');

    ELSE
      -- 'default': legacy format INV-YYYYMMDD-NNNN
      -- Sequence stays a single global running counter (as in 029/036);
      -- only the date portion follows the invoice date.
      prefix := 'INV-' || TO_CHAR(inv_date, 'YYYYMMDD') || '-';
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
-- ✅ App-supplied issued_at survives finalization
-- ✅ Invoice number + FY derived from the invoice's own date
-- ✅ Same-day billing behaviour unchanged (issued_at NULL → NOW())
-- ================================================================
