-- ================================================================
-- PHASE 10: GST WORKING REPORTS
-- ================================================================
-- This migration adds GST classification to clients and creates
-- SQL VIEWS for GST working reports matching accountant's Excel format.
--
-- Business Rules (LOCKED):
--   - GST type is manually set per client (no auto-inference)
--   - Historical invoices: GST breakup derived at report time
--   - New invoices: GST breakup stored in invoice_items (future)
--   - All three sheets generated even if data is zero
--
-- GST Logic:
--   - tax_rate = total GST %
--   - Domestic intra-state → CGST + SGST (50/50 split)
--   - Inter-state / Export / SEZ → IGST
--
-- Excel Sheets:
--   1. Domestic (with Credit Notes section)
--   2. SEZ (with Credit Notes section)  
--   3. Export (with Currency column)
-- ================================================================

-- ================================================================
-- 1. CREATE GST TYPE ENUM (IDEMPOTENT)
-- ================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_gst_type') THEN
    CREATE TYPE client_gst_type AS ENUM ('domestic', 'sez', 'export');
  END IF;
END $$;

-- ================================================================
-- 2. ALTER CLIENTS TABLE - ADD GST TYPE (IDEMPOTENT)
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'gst_type'
  ) THEN
    ALTER TABLE clients ADD COLUMN gst_type client_gst_type;
  END IF;
END $$;

-- Add index for GST type filtering (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_clients_gst_type ON clients(gst_type) WHERE gst_type IS NOT NULL;

-- ================================================================
-- 3. VIEW: GST WORKING - DOMESTIC
-- ================================================================
-- Columns: Invoice Date, Invoice Number, Party Name, GST NUMBER,
--          HSN/SAC CODE, As per your Invoice, Taxable Value, RATE,
--          IGST, CGST, SGST, TOTAL
-- ================================================================

CREATE OR REPLACE VIEW gst_working_domestic AS
SELECT
  -- Invoice identification
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  
  -- Party details
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  
  -- Line item details (HSN/SAC code not stored, placeholder)
  '' AS hsn_sac_code,
  
  -- Invoice totals
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  
  -- GST Rate (derived from first item or invoice-level)
  COALESCE(
    (SELECT tax_rate FROM invoice_items WHERE invoice_id = i.id LIMIT 1),
    0
  ) AS rate,
  
  -- GST Breakup (Domestic = CGST + SGST, so IGST = 0)
  -- FIXED: Use 0.00 and 2.0 for proper decimal types
  0.00::numeric(12,2) AS igst,
  ROUND(i.tax_total / 2.0, 2) AS cgst,
  ROUND(i.tax_total / 2.0, 2) AS sgst,
  
  -- Total (grand_total includes tax)
  i.grand_total AS total,
  
  -- Outlet for filtering
  i.outlet_id,
  o.name AS outlet_name

FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND (c.gst_type = 'domestic' OR c.gst_type IS NULL)
ORDER BY i.issued_at DESC, i.invoice_number;

-- Apply RLS
ALTER VIEW gst_working_domestic SET (security_invoker = true);

-- ================================================================
-- 4. VIEW: GST WORKING - SEZ
-- ================================================================
-- Same columns as Domestic but for SEZ clients
-- SEZ = Inter-state, so IGST applies (CGST/SGST = 0)
-- ================================================================

CREATE OR REPLACE VIEW gst_working_sez AS
SELECT
  -- Invoice identification
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  
  -- Party details
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  
  -- Line item details
  '' AS hsn_code,
  
  -- Invoice totals
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  
  -- GST Rate
  COALESCE(
    (SELECT tax_rate FROM invoice_items WHERE invoice_id = i.id LIMIT 1),
    0
  ) AS rate,
  
  -- GST Breakup (SEZ = IGST only)
  i.tax_total AS igst,
  0::numeric(12,2) AS cgst,
  0::numeric(12,2) AS sgst,
  
  -- Total
  i.grand_total AS total,
  
  -- Outlet for filtering
  i.outlet_id,
  o.name AS outlet_name

FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'sez'
ORDER BY i.issued_at DESC, i.invoice_number;

-- Apply RLS
ALTER VIEW gst_working_sez SET (security_invoker = true);

-- ================================================================
-- 5. VIEW: GST WORKING - EXPORT
-- ================================================================
-- Same columns + Currency column
-- Export = IGST (zero-rated or with payment)
-- ================================================================

CREATE OR REPLACE VIEW gst_working_export AS
SELECT
  -- Invoice identification
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  
  -- Party details
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  
  -- Line item details
  '' AS hsn_code,
  
  -- Invoice totals
  i.grand_total AS as_per_your_invoice,
  i.subtotal AS taxable_value,
  
  -- GST Rate
  COALESCE(
    (SELECT tax_rate FROM invoice_items WHERE invoice_id = i.id LIMIT 1),
    0
  ) AS rate,
  
  -- GST Breakup (Export = IGST, typically zero-rated)
  i.tax_total AS igst,
  0::numeric(12,2) AS cgst,
  0::numeric(12,2) AS sgst,
  
  -- Total
  i.grand_total AS total,
  
  -- Currency (Export specific - default USD)
  'USD' AS currency,
  
  -- Outlet for filtering
  i.outlet_id,
  o.name AS outlet_name

FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'export'
ORDER BY i.issued_at DESC, i.invoice_number;

-- Apply RLS
ALTER VIEW gst_working_export SET (security_invoker = true);

-- ================================================================
-- 6. AGGREGATED VIEWS FOR TOTALS ROW
-- ================================================================

-- Domestic Totals
CREATE OR REPLACE VIEW gst_working_domestic_totals AS
SELECT
  outlet_id,
  SUM(taxable_value) AS total_taxable_value,
  SUM(igst) AS total_igst,
  SUM(cgst) AS total_cgst,
  SUM(sgst) AS total_sgst,
  SUM(total) AS grand_total
FROM gst_working_domestic
GROUP BY outlet_id;

ALTER VIEW gst_working_domestic_totals SET (security_invoker = true);

-- SEZ Totals
CREATE OR REPLACE VIEW gst_working_sez_totals AS
SELECT
  outlet_id,
  SUM(taxable_value) AS total_taxable_value,
  SUM(igst) AS total_igst,
  SUM(cgst) AS total_cgst,
  SUM(sgst) AS total_sgst,
  SUM(total) AS grand_total
FROM gst_working_sez
GROUP BY outlet_id;

ALTER VIEW gst_working_sez_totals SET (security_invoker = true);

-- Export Totals
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
-- END OF PHASE 10 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created client_gst_type ENUM (domestic, sez, export)
-- ✅ Added gst_type column to clients table
-- ✅ Created gst_working_domestic view (CGST+SGST split)
-- ✅ Created gst_working_sez view (IGST only)
-- ✅ Created gst_working_export view (IGST + Currency)
-- ✅ Created totals views for each GST type
-- ✅ All views use security_invoker = true (RLS enforced)
-- ✅ Accountant read-only access via existing RLS policies
