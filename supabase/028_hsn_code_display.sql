-- ================================================================
-- HSN CODE DISPLAY IN GST VIEWS
-- ================================================================
-- Migration 028: Adds HSN/SAC code (9985) to all GST working views.
--
-- BUSINESS RULE (LOCKED):
--   - ALL invoice line items use the same HSN/SAC code: 9985
--   - HSN code is NOT item-specific and NOT user-editable
--   - HSN is DISPLAY-ONLY — no tax calculation depends on it
--
-- WHAT CHANGES:
--   - gst_working_domestic:  '' AS hsn_sac_code → '9985' AS hsn_sac_code
--   - gst_working_sez:       '' AS hsn_code     → '9985' AS hsn_code
--   - gst_working_export:    '' AS hsn_code     → '9985' AS hsn_code
--
-- BACKWARD COMPATIBLE:
--   - No table schema changes
--   - No data backfill
--   - No tax calculation changes
--   - Historical invoices automatically display HSN via views
--   - Totals views are unchanged (HSN not aggregated)
-- ================================================================

-- ================================================================
-- 1. UPDATE gst_working_domestic VIEW
-- ================================================================
-- Only change: '' → '9985' for hsn_sac_code
-- All other columns and logic remain identical to migration 017

CREATE OR REPLACE VIEW gst_working_domestic AS
SELECT
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  '9985' AS hsn_sac_code,  -- was: '' (empty placeholder)
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  COALESCE(
    (SELECT tax_rate FROM invoice_items WHERE invoice_id = i.id LIMIT 1),
    0
  ) AS rate,
  0.00::numeric(12,2) AS igst,
  ROUND(i.tax_total / 2.0, 2) AS cgst,
  ROUND(i.tax_total / 2.0, 2) AS sgst,
  i.grand_total AS total,
  i.outlet_id,
  o.name AS outlet_name
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND (c.gst_type = 'domestic' OR c.gst_type IS NULL)
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_domestic SET (security_invoker = true);

-- ================================================================
-- 2. UPDATE gst_working_sez VIEW
-- ================================================================
-- Only change: '' → '9985' for hsn_code
-- All other columns and logic remain identical to migration 017

CREATE OR REPLACE VIEW gst_working_sez AS
SELECT
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  '9985' AS hsn_code,  -- was: '' (empty placeholder)
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
  i.outlet_id,
  o.name AS outlet_name
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'sez'
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_sez SET (security_invoker = true);

-- ================================================================
-- 3. UPDATE gst_working_export VIEW
-- ================================================================
-- Only change: '' → '9985' for hsn_code
-- All other columns and logic remain identical to migration 020
-- (Dynamic currency from outlet is preserved)

DROP VIEW IF EXISTS gst_working_export_totals CASCADE;
DROP VIEW IF EXISTS gst_working_export CASCADE;

CREATE OR REPLACE VIEW gst_working_export AS
SELECT
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  '9985' AS hsn_code,  -- was: '' (empty placeholder)
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

-- Recreate export totals view (dropped above due to dependency)
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
-- END OF MIGRATION
-- ================================================================
-- Summary:
-- ✅ gst_working_domestic: hsn_sac_code = '9985'
-- ✅ gst_working_sez:      hsn_code     = '9985'
-- ✅ gst_working_export:   hsn_code     = '9985'
-- ✅ No table changes, no backfill, no tax logic changes
-- ✅ All totals views preserved (domestic/sez unchanged, export recreated)
-- ✅ Dynamic currency from migration 020 preserved in export view
-- ✅ Historical invoices automatically show HSN via views
-- ================================================================
