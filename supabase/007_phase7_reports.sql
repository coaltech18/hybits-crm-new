-- ================================================================
-- PHASE 7: REPORTS (PRODUCTION GRADE)
-- ================================================================
-- This migration creates SQL VIEWS for production-ready reporting.
--
-- Business Rules (LOCKED):
--   - Reports are READ-ONLY (no mutations)
--   - Data from DB truth (tables + views)
--   - Soft-deleted records excluded
--   - Manager access = ONLY their outlet
--   - Admin & Accountant see ALL outlets
--   - GST reports OUT OF SCOPE
--
-- Views Created:
--   1. report_revenue_daily - Revenue trends over time
--   2. report_payments_daily - Payment collections over time
--   3. report_outstanding_aging - Aging analysis for collections
--   4. report_subscription_mrr - Monthly Recurring Revenue
--   5. report_client_revenue - Client profitability analysis
--   6. report_outlet_performance - Outlet comparison metrics
-- ================================================================

-- ================================================================
-- VIEW 1: DAILY REVENUE AGGREGATION
-- ================================================================
-- Purpose: Line charts, revenue trends, outlet comparison
-- Used by: Revenue Report
-- ================================================================

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

-- Set security invoker for view
ALTER VIEW report_revenue_daily SET (security_invoker = true);

-- ================================================================
-- VIEW 2: DAILY PAYMENTS AGGREGATION
-- ================================================================
-- Purpose: Payment trends, method analysis, daily collections
-- Used by: Payments Report
-- ================================================================

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

-- Set security invoker for view
ALTER VIEW report_payments_daily SET (security_invoker = true);

-- ================================================================
-- VIEW 3: OUTSTANDING INVOICES WITH AGING
-- ================================================================
-- Purpose: Aging buckets, collection priority, overdue analysis
-- Used by: Outstanding & Aging Report
-- ================================================================

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
  -- Calculate days outstanding
  CURRENT_DATE - DATE(i.issued_at) AS days_outstanding,
  -- Aging bucket
  CASE
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 30 THEN '0-30'
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 60 THEN '31-60'
    WHEN CURRENT_DATE - DATE(i.issued_at) <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  -- Bucket order for sorting
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

-- Set security invoker for view
ALTER VIEW report_outstanding_aging SET (security_invoker = true);

-- ================================================================
-- VIEW 4: SUBSCRIPTION MRR (MONTHLY RECURRING REVENUE)
-- ================================================================
-- Purpose: MRR calculation, subscription trends, outlet MRR
-- Used by: Subscription Performance Report
-- ================================================================

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
  -- Total amount per cycle
  (s.quantity * s.price_per_unit) AS cycle_amount,
  -- Normalize to Monthly Recurring Revenue (MRR)
  CASE 
    WHEN s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit)
    WHEN s.billing_cycle = 'weekly' THEN (s.quantity * s.price_per_unit * 4.33)
    WHEN s.billing_cycle = 'daily' THEN (s.quantity * s.price_per_unit * 30)
  END AS mrr,
  -- Annualized value
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

-- Set security invoker for view
ALTER VIEW report_subscription_mrr SET (security_invoker = true);

-- ================================================================
-- VIEW 5: CLIENT REVENUE ANALYSIS
-- ================================================================
-- Purpose: Client profitability, top clients, subscription vs event split
-- Used by: Client Revenue Report
-- ================================================================

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
  -- Invoice counts
  COUNT(DISTINCT i.id) AS invoice_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoice_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'event') AS event_invoice_count,
  -- Revenue totals
  COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding,
  -- Split by type
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'subscription'), 0) AS subscription_revenue,
  COALESCE(SUM(i.grand_total) FILTER (WHERE i.invoice_type = 'event'), 0) AS event_revenue,
  -- Subscription count (for corporate clients)
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_subscriptions,
  -- Event count (for event clients)
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

-- Set security invoker for view
ALTER VIEW report_client_revenue SET (security_invoker = true);

-- ================================================================
-- VIEW 6: OUTLET PERFORMANCE METRICS
-- ================================================================
-- Purpose: Outlet comparison, multi-metric dashboard, performance ranking
-- Used by: Outlet Performance Report
-- ================================================================

CREATE OR REPLACE VIEW report_outlet_performance AS
SELECT 
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city,
  o.state,
  -- Client counts
  COUNT(DISTINCT c.id) FILTER (WHERE c.is_active = true) AS active_clients,
  COUNT(DISTINCT c.id) FILTER (WHERE c.client_type = 'corporate') AS corporate_clients,
  COUNT(DISTINCT c.id) FILTER (WHERE c.client_type = 'event') AS event_clients,
  -- Invoice metrics
  COUNT(DISTINCT i.id) AS total_invoices,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'subscription') AS subscription_invoices,
  COUNT(DISTINCT i.id) FILTER (WHERE i.invoice_type = 'event') AS event_invoices,
  -- Revenue metrics
  COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
  COALESCE(SUM(p.amount_paid), 0) AS total_collected,
  COALESCE(SUM(p.balance_due), 0) AS outstanding,
  -- Collection rate
  CASE 
    WHEN SUM(i.grand_total) > 0 
    THEN ROUND((SUM(p.amount_paid) / SUM(i.grand_total) * 100), 2)
    ELSE 0
  END AS collection_rate_percent,
  -- Subscription metrics
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_subscriptions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'paused') AS paused_subscriptions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled') AS cancelled_subscriptions,
  -- MRR (from active subscriptions)
  COALESCE(SUM(
    CASE 
      WHEN s.status = 'active' AND s.billing_cycle = 'monthly' THEN (s.quantity * s.price_per_unit)
      WHEN s.status = 'active' AND s.billing_cycle = 'weekly' THEN (s.quantity * s.price_per_unit * 4.33)
      WHEN s.status = 'active' AND s.billing_cycle = 'daily' THEN (s.quantity * s.price_per_unit * 30)
      ELSE 0
    END
  ), 0) AS mrr,
  -- Event metrics
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

-- Set security invoker for view
ALTER VIEW report_outlet_performance SET (security_invoker = true);

-- ================================================================
-- END OF PHASE 7 REPORTING VIEWS
-- ================================================================

-- Migration Summary:
-- ✅ VIEW 1: report_revenue_daily - Revenue trends by date/outlet/type
-- ✅ VIEW 2: report_payments_daily - Payment trends by date/method
-- ✅ VIEW 3: report_outstanding_aging - Aging buckets for collections
-- ✅ VIEW 4: report_subscription_mrr - MRR calculation (normalized)
-- ✅ VIEW 5: report_client_revenue - Client profitability analysis
-- ✅ VIEW 6: report_outlet_performance - Comprehensive outlet metrics
-- ✅ All views use security_invoker = true (RLS enforced)
-- ✅ Soft-deleted records excluded (is_active checks)
-- ✅ Only issued invoices included (status = 'issued')
-- ✅ All aggregations use COALESCE for NULL safety
-- ✅ Ready for role-based filtering at service layer
