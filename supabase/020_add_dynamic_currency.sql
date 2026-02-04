-- ================================================================
-- ADD DYNAMIC CURRENCY SUPPORT
-- ================================================================
-- 
-- PROBLEM:
-- Currency is hardcoded as 'USD' in GST export views and 'INR' in format utilities.
-- This doesn't support outlets operating in different currencies.
--
-- SOLUTION:
-- 1. Add currency field to outlets table (default 'INR')
-- 2. Update GST export view to use outlet currency
-- 3. Backward compatible: all existing outlets get 'INR'
--
-- SUPPORTED CURRENCIES:
-- - INR (Indian Rupee) - default
-- - USD (US Dollar)
-- - EUR (Euro)
-- - GBP (British Pound)
-- - AED (UAE Dirham)
-- - SGD (Singapore Dollar)
-- ================================================================

-- ================================================================
-- 1. ADD CURRENCY COLUMN TO OUTLETS
-- ================================================================

-- Add currency column with default INR (backward compatible)
ALTER TABLE outlets 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Add check constraint for valid currency codes
ALTER TABLE outlets 
ADD CONSTRAINT outlets_valid_currency 
CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'));

-- Add comment
COMMENT ON COLUMN outlets.currency IS 
  'ISO 4217 currency code for this outlet. Default: INR. Supported: INR, USD, EUR, GBP, AED, SGD';

-- ================================================================
-- 2. UPDATE GST EXPORT VIEW TO USE DYNAMIC CURRENCY
-- ================================================================
-- The export view currently hardcodes 'USD'. Update to use outlet.currency.

DROP VIEW IF EXISTS gst_working_export_totals CASCADE;
DROP VIEW IF EXISTS gst_working_export CASCADE;

-- Recreate with dynamic currency from outlet
CREATE OR REPLACE VIEW gst_working_export AS
SELECT
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  '' AS hsn_code,
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  COALESCE(
    (SELECT tax_rate FROM invoice_items WHERE invoice_id = i.id LIMIT 1),
    0
  ) AS rate,
  i.tax_total AS igst,
  0.00::numeric(12,2) AS cgst,
  0.00::numeric(12,2) AS sgst,
  i.grand_total AS total,
  -- DYNAMIC: Use outlet's currency instead of hardcoded 'USD'
  COALESCE(o.currency, 'INR') AS currency,
  i.outlet_id,
  o.name AS outlet_name
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'export'
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_export SET (security_invoker = true);

-- Recreate totals view
CREATE OR REPLACE VIEW gst_working_export_totals AS
SELECT
  outlet_id,
  SUM(taxable_value) AS total_taxable_value,
  SUM(igst) AS total_igst,
  SUM(cgst) AS total_cgst,
  SUM(sgst) AS total_sgst,
  SUM(total) AS grand_total
FROM gst_working_export
GROUP BY outlet_id;

ALTER VIEW gst_working_export_totals SET (security_invoker = true);

-- ================================================================
-- 3. CREATE CURRENCY FORMATTING HELPER FUNCTION
-- ================================================================
-- Returns currency symbol for display

CREATE OR REPLACE FUNCTION get_currency_symbol(currency_code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE currency_code
    WHEN 'INR' THEN 'Rs.'
    WHEN 'USD' THEN '$'
    WHEN 'EUR' THEN '€'
    WHEN 'GBP' THEN '£'
    WHEN 'AED' THEN 'AED'
    WHEN 'SGD' THEN 'S$'
    ELSE currency_code
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_currency_symbol(TEXT) IS 
  'Returns display symbol for a currency code. E.g., INR → Rs., USD → $';

-- ================================================================
-- 4. CREATE HELPER VIEW FOR INVOICE WITH CURRENCY
-- ================================================================
-- Adds currency information to invoice queries

CREATE OR REPLACE VIEW invoices_with_currency AS
SELECT 
  i.*,
  COALESCE(o.currency, 'INR') AS currency,
  get_currency_symbol(COALESCE(o.currency, 'INR')) AS currency_symbol
FROM invoices i
JOIN outlets o ON i.outlet_id = o.id;

ALTER VIEW invoices_with_currency SET (security_invoker = true);

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- 
-- ✅ ADDED: outlets.currency column (default 'INR')
-- ✅ FIXED: gst_working_export view now uses outlet.currency
-- ✅ ADDED: get_currency_symbol() helper function
-- ✅ ADDED: invoices_with_currency view for easy access
--
-- BACKWARD COMPATIBILITY:
-- - All existing outlets automatically get currency = 'INR'
-- - UI continues to work without changes (default INR)
-- - Only export invoices were previously showing 'USD', now fixed
--
-- TO USE DIFFERENT CURRENCY:
-- UPDATE outlets SET currency = 'USD' WHERE id = 'outlet-id';
-- ================================================================
