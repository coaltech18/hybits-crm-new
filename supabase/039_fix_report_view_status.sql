-- ================================================================
-- MIGRATION 039: POINT REPORT + GST VIEWS AT THE CURRENT STATUSES
-- ================================================================
-- BUG:
--   007/010/016/017/020/028 all defined these views with
--   WHERE i.status = 'issued'. Migration 030b then migrated every
--   invoice off 'issued' to 'finalized', and nothing through 038
--   redefined the views. Result: every report and every GST working
--   sheet returns ZERO rows for any invoice created after 030b.
--
-- FIX:
--   Replace the predicate with the set of statuses that mean "this
--   invoice was actually issued to the customer":
--       finalized | partially_paid | paid
--   'cancelled' and 'draft' stay excluded, which was the original
--   intent. Legacy 'issued' rows do not exist (030b migrated them).
--
-- SCOPE:
--   7 views. The gst_working_*_totals views aggregate FROM these
--   base views, so they inherit the fix and are not redefined here.
--   report_payments_daily and report_subscription_mrr never filtered
--   on invoice status and are untouched.
--
-- Each view below is its LAST definition (from the file named in the
-- comment), reproduced verbatim except for the status predicate.
--
-- RUN ORDER: after 030b. Safe to run any time after that.
-- ================================================================

-- ----------------------------------------------------------------
-- report_revenue_daily   (was: 016_harden_monetary_columns.sql)
-- ----------------------------------------------------------------
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
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
GROUP BY DATE(i.issued_at), i.outlet_id, o.name, i.invoice_type
ORDER BY report_date DESC, outlet_name;

ALTER VIEW report_revenue_daily SET (security_invoker = true);

-- ----------------------------------------------------------------
-- report_outstanding_aging   (was: 016_harden_monetary_columns.sql)
-- ----------------------------------------------------------------
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
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND p.balance_due > 0
ORDER BY days_outstanding DESC, balance_due DESC;

ALTER VIEW report_outstanding_aging SET (security_invoker = true);

-- ----------------------------------------------------------------
-- report_client_revenue   (was: 016_harden_monetary_columns.sql)
-- ----------------------------------------------------------------
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
LEFT JOIN invoices i ON c.id = i.client_id AND i.status IN ('finalized', 'partially_paid', 'paid')
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
LEFT JOIN subscriptions s ON c.id = s.client_id
LEFT JOIN events e ON c.id = e.client_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.client_type, c.phone, c.email, c.outlet_id, o.name, o.code
ORDER BY total_invoiced DESC;

ALTER VIEW report_client_revenue SET (security_invoker = true);

-- ----------------------------------------------------------------
-- report_outlet_performance   (was: 016_harden_monetary_columns.sql)
-- ----------------------------------------------------------------
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
LEFT JOIN invoices i ON o.id = i.outlet_id AND i.status IN ('finalized', 'partially_paid', 'paid')
LEFT JOIN invoices_with_payment_status p ON i.id = p.id
LEFT JOIN subscriptions s ON o.id = s.outlet_id
LEFT JOIN events e ON o.id = e.outlet_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.code, o.city, o.state
ORDER BY total_invoiced DESC;

ALTER VIEW report_outlet_performance SET (security_invoker = true);

-- ----------------------------------------------------------------
-- gst_working_domestic   (was: 028_hsn_code_display.sql)
-- ----------------------------------------------------------------
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
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND (c.gst_type = 'domestic' OR c.gst_type IS NULL)
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_domestic SET (security_invoker = true);

-- ----------------------------------------------------------------
-- gst_working_sez   (was: 028_hsn_code_display.sql)
-- ----------------------------------------------------------------
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
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'sez'
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_sez SET (security_invoker = true);

-- ----------------------------------------------------------------
-- gst_working_export   (was: 028_hsn_code_display.sql)
-- ----------------------------------------------------------------
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
WHERE i.status IN ('finalized', 'partially_paid', 'paid')
  AND i.issued_at IS NOT NULL
  AND c.gst_type = 'export'
ORDER BY i.issued_at DESC, i.invoice_number;

ALTER VIEW gst_working_export SET (security_invoker = true);

-- ================================================================
-- Summary:
-- ✅ 7 views now include finalized / partially_paid / paid
-- ✅ draft and cancelled still excluded
-- ✅ security_invoker re-asserted on each (CREATE OR REPLACE keeps it,
--    but it is restated so the property can never be lost silently)
-- ================================================================
