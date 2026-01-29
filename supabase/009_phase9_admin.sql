-- ================================================================
-- PHASE 9: ADMIN & SYSTEM UTILITIES — STEP 1: ADMIN SQL VIEWS
-- ================================================================
-- Purpose: Create READ-ONLY admin views for governance, audit, and system visibility
-- Date: 2026-01-29
-- Rules:
--   - NO modification to existing tables
--   - NO business logic changes
--   - ALL views are READ-ONLY
--   - RLS enforced on all admin access
-- ================================================================

-- ================================================================
-- TABLE: system_settings (ONLY NEW TABLE ALLOWED)
-- ================================================================
-- Purpose: Admin-controlled system configuration (key-value store)
-- Rules:
--   - Admin only access
--   - All changes auditable
--   - JSONB for flexible value storage
-- ================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES user_profiles(id)
);

COMMENT ON TABLE system_settings IS 'Admin-controlled system configuration settings (key-value store)';
COMMENT ON COLUMN system_settings.key IS 'Unique setting identifier';
COMMENT ON COLUMN system_settings.value IS 'Setting value stored as JSONB for flexibility';
COMMENT ON COLUMN system_settings.description IS 'Human-readable description of the setting';
COMMENT ON COLUMN system_settings.updated_by IS 'User who last updated this setting';

-- Index for audit queries
CREATE INDEX idx_system_settings_updated_at ON system_settings(updated_at DESC);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin ONLY (SELECT, UPDATE)
CREATE POLICY admin_select_system_settings
  ON system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND up.is_active = true
    )
  );

CREATE POLICY admin_update_system_settings
  ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND up.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND up.is_active = true
    )
  );

CREATE POLICY admin_insert_system_settings
  ON system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND up.is_active = true
    )
  );

-- ================================================================
-- VIEW 1: admin_users_summary
-- ================================================================
-- Purpose: Admin overview of all users with role, status, and outlet assignments
-- Columns: user_id, full_name, email, role, is_active, assigned_outlets, last_login
-- ================================================================

CREATE OR REPLACE VIEW admin_users_summary
WITH (security_invoker = true)
AS
SELECT
  up.id AS user_id,
  up.full_name,
  up.email,
  up.role,
  up.is_active,
  COALESCE(
    ARRAY_AGG(o.name ORDER BY o.name) FILTER (WHERE o.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS assigned_outlets,
  up.created_at,
  up.updated_at,
  au.last_sign_in_at AS last_login
FROM
  user_profiles up
LEFT JOIN
  user_outlet_assignments uoa ON up.id = uoa.user_id
LEFT JOIN
  outlets o ON uoa.outlet_id = o.id AND o.is_active = true
LEFT JOIN
  auth.users au ON up.id = au.id
GROUP BY
  up.id, up.full_name, up.email, up.role, up.is_active, up.created_at, up.updated_at, au.last_sign_in_at
ORDER BY
  up.created_at DESC;

COMMENT ON VIEW admin_users_summary IS 'Admin view: User list with roles, status, and outlet assignments';

-- ================================================================
-- VIEW 2: admin_outlets_summary
-- ================================================================
-- Purpose: Admin overview of outlets with operational metrics
-- Columns: outlet_id, outlet_name, outlet_code, city, is_active,
--          user_count, client_count, active_subscription_count, allocated_inventory_count
-- ================================================================

CREATE OR REPLACE VIEW admin_outlets_summary
WITH (security_invoker = true)
AS
SELECT
  o.id AS outlet_id,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city,
  o.address,
  o.is_active,
  o.created_at,
  
  -- User count: Number of users assigned to this outlet
  COALESCE(
    (SELECT COUNT(DISTINCT uoa.user_id)
     FROM user_outlet_assignments uoa
     JOIN user_profiles up ON uoa.user_id = up.id
     WHERE uoa.outlet_id = o.id
       AND up.is_active = true),
    0
  ) AS user_count,
  
  -- Client count: Number of active clients at this outlet
  COALESCE(
    (SELECT COUNT(*)
     FROM clients c
     WHERE c.outlet_id = o.id
       AND c.is_active = true),
    0
  ) AS client_count,
  
  -- Active subscription count
  COALESCE(
    (SELECT COUNT(*)
     FROM subscriptions s
     WHERE s.outlet_id = o.id
       AND s.status = 'active'),
    0
  ) AS active_subscription_count,
  
  -- Allocated inventory count (items currently allocated)
  COALESCE(
    (SELECT COUNT(*)
     FROM inventory_allocations ia
     WHERE ia.outlet_id = o.id
       AND ia.is_active = true),
    0
  ) AS allocated_inventory_count,
  
  -- Active event count
  COALESCE(
    (SELECT COUNT(*)
     FROM events e
     WHERE e.outlet_id = o.id
       AND e.status = 'planned'),
    0
  ) AS active_event_count

FROM
  outlets o
ORDER BY
  o.is_active DESC, o.name;

COMMENT ON VIEW admin_outlets_summary IS 'Admin view: Outlet list with operational metrics for governance';

-- ================================================================
-- VIEW 3: admin_activity_log_unified
-- ================================================================
-- Purpose: Unified audit trail across all system modules
-- Data Sources: inventory_movements, payments, subscriptions, events, invoices, user_profiles, outlets
-- Standardized Columns: occurred_at, user_id, user_name, outlet_id, outlet_name, 
--                       module, action_type, entity_id, description
-- ================================================================

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

COMMENT ON VIEW admin_activity_log_unified IS 'Unified audit trail: All system activities across modules for governance and compliance';

-- ================================================================
-- VIEW 4 (OPTIONAL): admin_role_permission_matrix
-- ================================================================
-- Purpose: Static reference table showing role-based permissions
-- This is READ-ONLY and hardcoded for documentation/transparency
-- ================================================================

CREATE OR REPLACE VIEW admin_role_permission_matrix
WITH (security_invoker = true)
AS
SELECT * FROM (VALUES
  -- Clients Module
  ('admin', 'clients', true, true, true, false),
  ('manager', 'clients', true, true, true, false),
  ('accountant', 'clients', true, false, false, false),
  
  -- Subscriptions Module
  ('admin', 'subscriptions', true, true, true, false),
  ('manager', 'subscriptions', true, true, true, false),
  ('accountant', 'subscriptions', true, false, false, false),
  
  -- Events Module
  ('admin', 'events', true, true, true, false),
  ('manager', 'events', true, true, true, false),
  ('accountant', 'events', true, false, false, false),
  
  -- Invoices Module
  ('admin', 'invoices', true, true, true, false),
  ('manager', 'invoices', true, true, true, false),
  ('accountant', 'invoices', true, false, false, false),
  
  -- Payments Module
  ('admin', 'payments', true, true, true, false),
  ('manager', 'payments', true, true, true, false),
  ('accountant', 'payments', true, false, false, false),
  
  -- Inventory Module
  ('admin', 'inventory', true, true, true, false),
  ('manager', 'inventory', true, true, true, false),
  ('accountant', 'inventory', true, false, false, false),
  
  -- Reports Module
  ('admin', 'reports', true, false, false, false),
  ('manager', 'reports', true, false, false, false),
  ('accountant', 'reports', true, false, false, false),
  
  -- Admin Module
  ('admin', 'admin_users', true, true, true, false),
  ('manager', 'admin_users', false, false, false, false),
  ('accountant', 'admin_users', false, false, false, false),
  
  ('admin', 'admin_outlets', true, true, true, false),
  ('manager', 'admin_outlets', false, false, false, false),
  ('accountant', 'admin_outlets', false, false, false, false),
  
  ('admin', 'admin_activity_logs', true, false, false, false),
  ('manager', 'admin_activity_logs', true, false, false, false),
  ('accountant', 'admin_activity_logs', true, false, false, false),
  
  ('admin', 'admin_settings', true, false, true, false),
  ('manager', 'admin_settings', false, false, false, false),
  ('accountant', 'admin_settings', false, false, false, false)
  
) AS permissions(role, module, can_view, can_create, can_edit, can_delete);

COMMENT ON VIEW admin_role_permission_matrix IS 'Static permission reference: Role-based access control matrix for documentation and transparency';

-- ================================================================
-- RLS POLICIES FOR ADMIN VIEWS
-- ================================================================
-- Purpose: Ensure admin views respect role-based access
-- Rules:
--   - Admin: Full access to all views
--   - Accountant: Read-only access to activity logs
--   - Manager: Access to activity logs (outlet-filtered via underlying RLS)
-- ================================================================

-- Grant SELECT on views to authenticated users (RLS will filter)
GRANT SELECT ON admin_users_summary TO authenticated;
GRANT SELECT ON admin_outlets_summary TO authenticated;
GRANT SELECT ON admin_activity_log_unified TO authenticated;
GRANT SELECT ON admin_role_permission_matrix TO authenticated;

-- Note: Views use security_invoker = true, so RLS policies from underlying tables apply
-- Additional service-layer checks will enforce:
--   - admin_users_summary: Admin only
--   - admin_outlets_summary: Admin only
--   - admin_activity_log_unified: Admin (all), Accountant (all), Manager (outlet-filtered)
--   - admin_role_permission_matrix: Admin, Accountant (read-only)

-- ================================================================
-- INITIAL SYSTEM SETTINGS (OPTIONAL SEED DATA)
-- ================================================================
-- Purpose: Pre-populate system_settings with default values
-- Note: These can be updated by admins via UI
-- ================================================================

INSERT INTO system_settings (key, value, description, updated_by)
VALUES
  ('inventory_negative_stock_tolerance', '0', 'Inventory negative stock tolerance (locked to 0 for production safety)', NULL),
  ('payment_edit_window_days', '7', 'Number of days after payment creation during which edits are allowed', NULL),
  ('invoice_auto_number', 'true', 'Enable automatic invoice numbering', NULL),
  ('subscription_auto_renewal', 'true', 'Enable automatic subscription renewal notifications', NULL)
ON CONFLICT (key) DO NOTHING;

-- ================================================================
-- PHASE 9 STEP 1 COMPLETE
-- ================================================================
-- Summary:
--   - Created system_settings table (admin-controlled key-value store)
--   - Created admin_users_summary view (user list with roles and outlets)
--   - Created admin_outlets_summary view (outlet list with operational metrics)
--   - Created admin_activity_log_unified view (unified audit trail)
--   - Created admin_role_permission_matrix view (static permission reference)
--   - Enabled RLS on system_settings (admin only)
--   - Granted SELECT on views to authenticated users (service layer enforces role checks)
--   - Seeded initial system settings
--
-- Next Steps:
--   - STEP 2: Create admin services (adminUserService, adminOutletService, activityLogService, systemSettingsService)
--   - STEP 3: Create admin UI pages
--   - STEP 4: Implement activity logs + CSV exports
--   - STEP 5: Final verification
--
-- PHASE 9 STEP 1 COMPLETE
-- ================================================================
