-- ================================================================
-- HARDEN MONETARY COLUMNS
-- ================================================================
-- This migration ensures all monetary columns in the database:
-- 1. Use NUMERIC(12,2) for precision (up to ₹9,99,99,99,999.99)
-- 2. Have appropriate CHECK constraints (>= 0 or > 0)
-- 3. Are explicitly documented for clarity
--
-- Target Tables:
-- - invoices (subtotal, tax_total, grand_total)
-- - invoice_items (unit_price, line_total, tax_amount)
-- - payments (amount)
--
-- IMPORTANT: Must drop ALL dependent views before altering column types
-- ================================================================

-- ================================================================
-- 1. DROP ALL DEPENDENT VIEWS (will be recreated after)
-- ================================================================
-- Using CASCADE to handle nested dependencies

-- Admin Views (Phase 9) - depends on invoices.grand_total
DROP VIEW IF EXISTS admin_activity_log_unified CASCADE;

-- GST Report Views (Phase 10)
DROP VIEW IF EXISTS gst_working_domestic_totals CASCADE;
DROP VIEW IF EXISTS gst_working_sez_totals CASCADE;
DROP VIEW IF EXISTS gst_working_export_totals CASCADE;
DROP VIEW IF EXISTS gst_working_domestic CASCADE;
DROP VIEW IF EXISTS gst_working_sez CASCADE;
DROP VIEW IF EXISTS gst_working_export CASCADE;

-- Report Views (Phase 7)
DROP VIEW IF EXISTS report_revenue_daily CASCADE;
DROP VIEW IF EXISTS report_payments_daily CASCADE;
DROP VIEW IF EXISTS report_outstanding_aging CASCADE;
DROP VIEW IF EXISTS report_subscription_mrr CASCADE;
DROP VIEW IF EXISTS report_client_revenue CASCADE;
DROP VIEW IF EXISTS report_outlet_performance CASCADE;

-- Core Views (Phase 5 & 6)
DROP VIEW IF EXISTS invoices_with_details CASCADE;
DROP VIEW IF EXISTS invoices_with_payment_status CASCADE;
DROP VIEW IF EXISTS payments_with_details CASCADE;

-- ================================================================
-- 2. HARDEN INVOICE COLUMNS
-- ================================================================

-- Drop any existing unnamed constraints that might conflict
DO $$
BEGIN
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subtotal_check';
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_tax_total_check';
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_grand_total_check';
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subtotal_non_negative';
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_tax_total_non_negative';
  EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_grand_total_non_negative';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Ensure correct types (idempotent)
ALTER TABLE invoices
  ALTER COLUMN subtotal TYPE NUMERIC(12,2),
  ALTER COLUMN tax_total TYPE NUMERIC(12,2),
  ALTER COLUMN grand_total TYPE NUMERIC(12,2);

-- Add explicit named constraints
ALTER TABLE invoices
  ADD CONSTRAINT invoices_subtotal_non_negative CHECK (subtotal >= 0),
  ADD CONSTRAINT invoices_tax_total_non_negative CHECK (tax_total >= 0),
  ADD CONSTRAINT invoices_grand_total_non_negative CHECK (grand_total >= 0);

-- ================================================================
-- 3. HARDEN INVOICE_ITEMS COLUMNS
-- ================================================================

DO $$
BEGIN
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_unit_price_check';
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_line_total_check';
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_tax_amount_check';
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_unit_price_non_negative';
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_line_total_non_negative';
  EXECUTE 'ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_tax_amount_non_negative';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE invoice_items
  ALTER COLUMN unit_price TYPE NUMERIC(12,2),
  ALTER COLUMN line_total TYPE NUMERIC(12,2),
  ALTER COLUMN tax_amount TYPE NUMERIC(12,2);

ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_unit_price_non_negative CHECK (unit_price >= 0),
  ADD CONSTRAINT invoice_items_line_total_non_negative CHECK (line_total >= 0),
  ADD CONSTRAINT invoice_items_tax_amount_non_negative CHECK (tax_amount >= 0);

-- ================================================================
-- 4. HARDEN PAYMENTS COLUMNS
-- ================================================================

DO $$
BEGIN
  EXECUTE 'ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check';
  EXECUTE 'ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE payments
  ALTER COLUMN amount TYPE NUMERIC(12,2);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- ================================================================
-- 5. RECREATE CORE VIEWS (Phase 5 & 6)
-- ================================================================

-- 5a. invoices_with_details (from 005_phase5_invoices.sql)
CREATE OR REPLACE VIEW invoices_with_details AS
SELECT 
  i.*,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city,
  e.event_name,
  e.event_date
FROM invoices i
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN events e ON i.event_id = e.id;

ALTER VIEW invoices_with_details SET (security_invoker = true);

-- 5b. invoices_with_payment_status (from 015_fix_payment_settlement_rounding.sql)
CREATE OR REPLACE VIEW invoices_with_payment_status AS
SELECT 
  i.*,
  ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2) AS amount_paid,
  CASE
    WHEN ABS(
      ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
    ) <= 0.05 
    THEN 0.00
    ELSE ROUND(i.grand_total - COALESCE(SUM(p.amount) FILTER (WHERE p.is_active = true), 0), 2)
  END AS balance_due,
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

ALTER VIEW invoices_with_payment_status SET (security_invoker = true);

-- 5c. payments_with_details (from 006_phase6_payments.sql)
CREATE OR REPLACE VIEW payments_with_details AS
SELECT 
  p.*,
  i.invoice_number,
  i.invoice_type,
  i.grand_total AS invoice_total,
  i.status AS invoice_status,
  c.name AS client_name,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  up.full_name AS recorded_by_name
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN user_profiles up ON p.created_by = up.id;

ALTER VIEW payments_with_details SET (security_invoker = true);

-- ================================================================
-- 6. RECREATE REPORT VIEWS (Phase 7)
-- ================================================================

-- 6a. report_revenue_daily
CREATE OR REPLACE VIEW report_revenue_daily AS
SELECT 
  DATE(i.issued_at) AS report_date,
  i.outlet_id,
  o.name AS outlet_name,
  i.invoice_type,
  COUNT(i.id) AS invoice_count,
  SUM(i.grand_total) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding
FROM invoices i
JOIN outlets o ON i.outlet_id = o.id
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
GROUP BY DATE(i.issued_at), i.outlet_id, o.name, i.invoice_type
ORDER BY report_date DESC, outlet_name;

ALTER VIEW report_revenue_daily SET (security_invoker = true);

-- 6b. report_payments_daily
CREATE OR REPLACE VIEW report_payments_daily AS
SELECT 
  p.payment_date AS report_date,
  p.invoice_id,
  i.outlet_id,
  o.name AS outlet_name,
  p.payment_method,
  COUNT(p.id) AS payment_count,
  SUM(p.amount) AS total_amount
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN outlets o ON i.outlet_id = o.id
WHERE p.is_active = true
GROUP BY p.payment_date, p.invoice_id, i.outlet_id, o.name, p.payment_method
ORDER BY report_date DESC;

ALTER VIEW report_payments_daily SET (security_invoker = true);

-- 6c. report_outstanding_aging
CREATE OR REPLACE VIEW report_outstanding_aging AS
SELECT 
  i.id AS invoice_id,
  i.invoice_number,
  i.invoice_type,
  DATE(i.issued_at) AS invoice_date,
  i.grand_total,
  p.amount_paid,
  p.balance_due,
  i.client_id,
  c.name AS client_name,
  c.phone AS client_phone,
  i.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  CURRENT_DATE - DATE(i.issued_at) AS days_outstanding,
  CASE
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 30 THEN '0-30'
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 60 THEN '31-60'
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CASE
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 30 THEN 1
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 60 THEN 2
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 90 THEN 3
    ELSE 4
  END AS bucket_order
FROM invoices i
JOIN invoices_with_payment_status p ON i.id = p.id
JOIN clients c ON i.client_id = c.id
JOIN outlets o ON i.outlet_id = o.id
WHERE i.status = 'issued'
  AND i.issued_at IS NOT NULL
  AND p.balance_due > 0
ORDER BY days_outstanding DESC, balance_due DESC;

ALTER VIEW report_outstanding_aging SET (security_invoker = true);

-- 6d. report_subscription_mrr
CREATE OR REPLACE VIEW report_subscription_mrr AS
SELECT 
  s.id AS subscription_id,
  s.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  s.client_id,
  c.name AS client_name,
  s.billing_cycle,
  s.status,
  s.quantity,
  s.price_per_unit,
  s.start_date,
  s.next_billing_date,
  (s.quantity * s.price_per_unit) AS cycle_amount,
  CASE 
    WHEN s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit)
    WHEN s.billing_cycle = 'weekly' THEN (s.quantity * s.price_per_unit * 4.33)
    WHEN s.billing_cycle = 'daily' THEN (s.quantity * s.price_per_unit * 30)
  END AS mrr,
  CASE 
    WHEN s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit * 12)
    WHEN s.billing_cycle = 'weekly' THEN (s.quantity * s.price_per_unit * 52)
    WHEN s.billing_cycle = 'daily' THEN (s.quantity * s.price_per_unit * 365)
  END AS annual_value
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN outlets o ON s.outlet_id = o.id
WHERE s.status = 'active'
ORDER BY mrr DESC;

ALTER VIEW report_subscription_mrr SET (security_invoker = true);

-- 6e. report_client_revenue
CREATE OR REPLACE VIEW report_client_revenue AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  c.email AS client_email,
  c.outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  COUNT(DISTINCT i.id) AS invoice_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoice_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'event') AS event_invoice_count,
  COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding,
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'subscription'), 0) AS subscription_revenue,
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'event'), 0) AS event_revenue,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_subscriptions,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') AS completed_events
FROM clients c
JOIN outlets o ON c.outlet_id = o.id
LEFT JOIN invoices i ON c.id = i.client_id AND i.status = 'issued'
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
LEFT JOIN subscriptions s ON c.id = s.client_id
LEFT JOIN events e ON c.id = e.client_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.client_type, c.phone, c.email, c.outlet_id, o.name, o.code
ORDER BY total_invoiced DESC;

ALTER VIEW report_client_revenue SET (security_invoker = true);

-- 6f. report_outlet_performance
CREATE OR REPLACE VIEW report_outlet_performance AS
SELECT 
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city,
  o.state,
  COUNT(DISTINCT c.id) FILTER (WHERE c.is_active = true) AS active_clients,
  COUNT(DISTINCT c.id) FILTER (WHERE c.client_type = 'corporate') AS corporate_clients,
  COUNT(DISTINCT c.id) FILTER (WHERE c.client_type = 'event') AS event_clients,
  COUNT(DISTINCT i.id) AS total_invoices,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoices,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'event') AS event_invoices,
  COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding,
  CASE 
    WHEN SUM(i.grand_total) > 0 
    THEN ROUND((SUM(p.amount_paid) / SUM(i.grand_total) * 100), 2)
    ELSE 0
  END AS collection_rate_percent,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_subscriptions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'paused') AS paused_subscriptions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled') AS cancelled_subscriptions,
  COALESCE(SUM(
    CASE 
      WHEN s.status = 'active' AND s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit)
      WHEN s.status = 'active' AND s.billing_cycle = 'weekly' THEN (s.quantity * s.price_per_unit * 4.33)
      WHEN s.status = 'active' AND s.billing_cycle = 'daily' THEN (s.quantity * s.price_per_unit * 30)
      ELSE 0
    END
  ), 0) AS mrr,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') AS completed_events,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'cancelled') AS cancelled_events,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'planned') AS planned_events
FROM outlets o
LEFT JOIN clients c ON o.id = c.outlet_id
LEFT JOIN invoices i ON o.id = i.outlet_id AND i.status = 'issued'
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
LEFT JOIN subscriptions s ON o.id = s.outlet_id
LEFT JOIN events e ON o.id = e.outlet_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.code, o.city, o.state
ORDER BY total_invoiced DESC;

ALTER VIEW report_outlet_performance SET (security_invoker = true);

-- ================================================================
-- 7. RECREATE GST REPORT VIEWS (Phase 10)
-- ================================================================

-- 7a. gst_working_domestic
CREATE OR REPLACE VIEW gst_working_domestic AS
SELECT
  i.id AS invoice_id,
  DATE(i.issued_at) AS invoice_date,
  i.invoice_number,
  c.name AS party_name,
  COALESCE(c.gstin, '') AS gst_number,
  '' AS hsn_sac_code,
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

-- 7b. gst_working_sez
CREATE OR REPLACE VIEW gst_working_sez AS
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

-- 7c. gst_working_export
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
  'USD' AS currency,
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

-- 7d. gst_working_domestic_totals
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

-- 7e. gst_working_sez_totals
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

-- 7f. gst_working_export_totals
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
-- 8. RECREATE ADMIN VIEWS (Phase 9)
-- ================================================================

-- 8a. admin_activity_log_unified
CREATE OR REPLACE VIEW admin_activity_log_unified
WITH (security_invoker = true)
AS

-- Inventory Movements
SELECT
  im.created_at AS occurred_at,
  im.created_by AS user_id,
  up.full_name AS user_name,
  im.outlet_id,
  o.name AS outlet_name,
  'inventory' AS module,
  im.movement_type::TEXT AS action_type,
  im.id::TEXT AS entity_id,
  CONCAT(
    UPPER(im.movement_type::TEXT), ' - ',
    ii.name, ' (', im.quantity, ' ', ii.unit, ')',
    CASE 
      WHEN im.reference_type = 'subscription' THEN ' for Subscription'
      WHEN im.reference_type = 'event' THEN ' for Event'
      ELSE ''
    END,
    CASE WHEN im.notes IS NOT NULL THEN CONCAT(' - ', im.notes) ELSE '' END
  ) AS description
FROM
  inventory_movements im
JOIN
  inventory_items ii ON im.inventory_item_id = ii.id
JOIN
  outlets o ON im.outlet_id = o.id
LEFT JOIN
  user_profiles up ON im.created_by = up.id

UNION ALL

-- Payments
SELECT
  p.created_at AS occurred_at,
  p.created_by AS user_id,
  up.full_name AS user_name,
  i.outlet_id,
  o.name AS outlet_name,
  'payment' AS module,
  CONCAT('payment_', p.payment_method) AS action_type,
  p.id::TEXT AS entity_id,
  CONCAT(
    'Payment of ₹', p.amount,
    ' via ', UPPER(p.payment_method::TEXT),
    ' for Invoice #', i.invoice_number,
    CASE WHEN p.reference_number IS NOT NULL THEN CONCAT(' (Ref: ', p.reference_number, ')') ELSE '' END
  ) AS description
FROM
  payments p
JOIN
  invoices i ON p.invoice_id = i.id
JOIN
  outlets o ON i.outlet_id = o.id
LEFT JOIN
  user_profiles up ON p.created_by = up.id

UNION ALL

-- Subscriptions (Created)
SELECT
  s.created_at AS occurred_at,
  s.created_by AS user_id,
  up.full_name AS user_name,
  s.outlet_id,
  o.name AS outlet_name,
  'subscription' AS module,
  'subscription_created' AS action_type,
  s.id::TEXT AS entity_id,
  CONCAT(
    'Subscription created for ',
    c.name,
    ' (', s.billing_cycle, ')',
    ' - Status: ', UPPER(s.status::TEXT)
  ) AS description
FROM
  subscriptions s
JOIN
  clients c ON s.client_id = c.id
JOIN
  outlets o ON s.outlet_id = o.id
LEFT JOIN
  user_profiles up ON s.created_by = up.id

UNION ALL

-- Subscriptions (Status Updates)
SELECT
  s.updated_at AS occurred_at,
  s.created_by AS user_id,
  up.full_name AS user_name,
  s.outlet_id,
  o.name AS outlet_name,
  'subscription' AS module,
  CONCAT('subscription_status_', s.status::TEXT) AS action_type,
  s.id::TEXT AS entity_id,
  CONCAT(
    'Subscription status changed to ',
    UPPER(s.status::TEXT),
    ' for ',
    c.name
  ) AS description
FROM
  subscriptions s
JOIN
  clients c ON s.client_id = c.id
JOIN
  outlets o ON s.outlet_id = o.id
LEFT JOIN
  user_profiles up ON s.created_by = up.id
WHERE
  s.updated_at > s.created_at

UNION ALL

-- Events (Created)
SELECT
  e.created_at AS occurred_at,
  e.created_by AS user_id,
  up.full_name AS user_name,
  e.outlet_id,
  o.name AS outlet_name,
  'event' AS module,
  'event_created' AS action_type,
  e.id::TEXT AS entity_id,
  CONCAT(
    'Event created: ',
    e.event_name,
    ' (',
    e.event_type,
    ') for ',
    c.name,
    ' on ',
    TO_CHAR(e.event_date, 'DD Mon YYYY')
  ) AS description
FROM
  events e
JOIN
  clients c ON e.client_id = c.id
JOIN
  outlets o ON e.outlet_id = o.id
LEFT JOIN
  user_profiles up ON e.created_by = up.id

UNION ALL

-- Events (Status Updates)
SELECT
  e.updated_at AS occurred_at,
  e.created_by AS user_id,
  up.full_name AS user_name,
  e.outlet_id,
  o.name AS outlet_name,
  'event' AS module,
  CONCAT('event_status_', e.status::TEXT) AS action_type,
  e.id::TEXT AS entity_id,
  CONCAT(
    'Event status changed to ',
    UPPER(e.status::TEXT),
    ' - ',
    e.event_name
  ) AS description
FROM
  events e
JOIN
  clients c ON e.client_id = c.id
JOIN
  outlets o ON e.outlet_id = o.id
LEFT JOIN
  user_profiles up ON e.created_by = up.id
WHERE
  e.updated_at > e.created_at

UNION ALL

-- Invoices (Issued)
SELECT
  i.created_at AS occurred_at,
  i.created_by AS user_id,
  up.full_name AS user_name,
  i.outlet_id,
  o.name AS outlet_name,
  'invoice' AS module,
  CONCAT('invoice_', i.invoice_type) AS action_type,
  i.id::TEXT AS entity_id,
  CONCAT(
    'Invoice #',
    i.invoice_number,
    ' issued for ',
    c.name,
    ' - ₹',
    i.grand_total,
    ' (',
    UPPER(i.invoice_type::TEXT),
    ')'
  ) AS description
FROM
  invoices i
JOIN
  clients c ON i.client_id = c.id
JOIN
  outlets o ON i.outlet_id = o.id
LEFT JOIN
  user_profiles up ON i.created_by = up.id

ORDER BY
  occurred_at DESC;

-- Grant access (was originally granted in Phase 9)
GRANT SELECT ON admin_activity_log_unified TO authenticated;

-- ================================================================
-- 9. DOCUMENT COLUMN PURPOSES
-- ================================================================

COMMENT ON COLUMN invoices.subtotal IS 'Sum of all line_total from invoice_items. NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN invoices.tax_total IS 'Sum of all tax_amount from invoice_items. NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN invoices.grand_total IS 'subtotal + tax_total. NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN invoice_items.unit_price IS 'Price per unit before tax. NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN invoice_items.line_total IS 'ROUND(quantity * unit_price, 2). NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN invoice_items.tax_amount IS 'ROUND(line_total * tax_rate/100, 2). NUMERIC(12,2), non-negative.';
COMMENT ON COLUMN payments.amount IS 'Payment amount. NUMERIC(12,2), must be positive (> 0).';

-- ================================================================
-- 10. VERIFY DATA INTEGRITY
-- ================================================================

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM invoices
  WHERE subtotal < 0 OR tax_total < 0 OR grand_total < 0;
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % invoices with negative monetary values', invalid_count;
  END IF;
  
  SELECT COUNT(*) INTO invalid_count
  FROM invoice_items
  WHERE unit_price < 0 OR line_total < 0 OR tax_amount < 0;
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % invoice_items with negative monetary values', invalid_count;
  END IF;
  
  SELECT COUNT(*) INTO invalid_count
  FROM payments
  WHERE amount <= 0;
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % payments with non-positive amounts', invalid_count;
  END IF;
  
  RAISE NOTICE 'All monetary data validated successfully';
END $$;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- ✅ Dropped all dependent views (Core, Reports, GST, Admin)
-- ✅ invoices.subtotal - NUMERIC(12,2), CHECK >= 0
-- ✅ invoices.tax_total - NUMERIC(12,2), CHECK >= 0
-- ✅ invoices.grand_total - NUMERIC(12,2), CHECK >= 0
-- ✅ invoice_items.unit_price - NUMERIC(12,2), CHECK >= 0
-- ✅ invoice_items.line_total - NUMERIC(12,2), CHECK >= 0
-- ✅ invoice_items.tax_amount - NUMERIC(12,2), CHECK >= 0
-- ✅ payments.amount - NUMERIC(12,2), CHECK > 0
-- ✅ Recreated all core views (invoices_with_details, invoices_with_payment_status, payments_with_details)
-- ✅ Recreated all report views (6 views from Phase 7)
-- ✅ Recreated all GST views (6 views from Phase 10)
-- ✅ Recreated admin_activity_log_unified view (Phase 9)
-- ✅ All columns documented with COMMENT
-- ✅ Existing data integrity verified
-- ================================================================

