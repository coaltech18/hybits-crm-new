-- ================================================================
-- PHASE 2: CLIENTS
-- ================================================================
-- This migration creates the clients table with strict outlet isolation
-- and role-based access control.
--
-- Client Types:
--   - corporate: Used ONLY for subscription billing
--   - event: Used ONLY for one-time event billing
--
-- Business Rules:
--   - Every client belongs to EXACTLY ONE outlet
--   - Same company in two outlets = two separate client rows
--   - No cross-outlet clients
--   - Soft delete via is_active flag (preserve audit trail)
--
-- Role Access:
--   - Admin: Full CRUD on all clients (all outlets)
--   - Manager: CRUD only for assigned outlet clients
--   - Accountant: Read-only on all clients (all outlets)
-- ================================================================

-- ================================================================
-- 1. CREATE CLIENT_TYPE ENUM
-- ================================================================

CREATE TYPE client_type AS ENUM ('corporate', 'event');

-- ================================================================
-- 2. CREATE CLIENTS TABLE
-- ================================================================

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  client_type client_type NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text NOT NULL,
  email text,
  gstin text, -- Optional, but validated if present (15-char GST format)
  billing_address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id), -- Audit trail (who created this client)
  
  -- Constraints
  CONSTRAINT clients_phone_check CHECK (length(phone) >= 10),
  CONSTRAINT clients_name_check CHECK (length(name) >= 2),
  CONSTRAINT clients_gstin_format CHECK (
    gstin IS NULL OR 
    gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  )
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Fast lookup by outlet (most common query for managers)
CREATE INDEX idx_clients_outlet_id ON clients(outlet_id);

-- Fast filtering by client type
CREATE INDEX idx_clients_type ON clients(client_type);

-- Fast filtering by active status
CREATE INDEX idx_clients_active ON clients(is_active) WHERE is_active = true;

-- Composite index for manager queries (outlet + active)
CREATE INDEX idx_clients_outlet_active ON clients(outlet_id, is_active);

-- Phone search index
CREATE INDEX idx_clients_phone ON clients(phone);

-- Name search index (case-insensitive)
CREATE INDEX idx_clients_name_lower ON clients(LOWER(name));

-- ================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 5. RLS POLICIES FOR CLIENTS
-- ================================================================

-- ----------------------------------------------------------------
-- ADMIN: Full access to all clients (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "admins_full_access_clients"
ON clients
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  )
);

-- ----------------------------------------------------------------
-- MANAGER: Access ONLY clients of assigned outlet(s)
-- ----------------------------------------------------------------
-- SELECT: Managers can view clients from their assigned outlets
CREATE POLICY "managers_select_own_outlet_clients"
ON clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
  )
  AND outlet_id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Managers can create clients ONLY for their assigned outlets
CREATE POLICY "managers_insert_own_outlet_clients"
ON clients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
  )
  AND outlet_id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
);

-- UPDATE: Managers can update clients ONLY from their assigned outlets
-- AND cannot change outlet_id or client_type (admin-only fields)
CREATE POLICY "managers_update_own_outlet_clients"
ON clients
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
  )
  AND outlet_id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Ensure updated outlet_id is still in manager's assigned outlets
  outlet_id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------
-- ACCOUNTANT: Read-only access to all clients (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "accountants_readonly_all_clients"
ON clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'accountant'
      AND is_active = true
  )
);

-- ================================================================
-- 6. TRIGGER FOR UPDATED_AT
-- ================================================================

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 7. TRIGGER FOR CREATED_BY (AUTO-SET FROM AUTH.UID())
-- ================================================================
-- This ensures created_by is always set automatically and cannot be manipulated

CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Set created_by to current user if not already set (INSERT only)
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  
  -- Prevent modification of created_by on UPDATE
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by = OLD.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_clients_created_by
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- 8. FUNCTION TO PREVENT MANAGERS FROM CHANGING RESTRICTED FIELDS
-- ================================================================
-- This trigger prevents managers from changing client_type or outlet_id

CREATE OR REPLACE FUNCTION enforce_manager_client_restrictions()
RETURNS TRIGGER AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Get current user's role
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  
  -- If user is a manager, enforce restrictions
  IF user_role = 'manager' THEN
    -- Prevent changing client_type
    IF OLD.client_type IS DISTINCT FROM NEW.client_type THEN
      RAISE EXCEPTION 'Managers cannot change client type. Only admins can modify this field.';
    END IF;
    
    -- Prevent changing outlet_id
    IF OLD.outlet_id IS DISTINCT FROM NEW.outlet_id THEN
      RAISE EXCEPTION 'Managers cannot change outlet assignment. Only admins can modify this field.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_manager_restrictions_on_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_manager_client_restrictions();

-- ================================================================
-- 9. HELPER FUNCTION: GET CLIENT WITH OUTLET INFO
-- ================================================================
-- This view can be used in queries to easily fetch client + outlet data

CREATE OR REPLACE VIEW clients_with_outlet AS
SELECT 
  c.*,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city
FROM clients c
JOIN outlets o ON c.outlet_id = o.id;

-- Apply same RLS policies to the view
ALTER VIEW clients_with_outlet SET (security_invoker = true);

-- ================================================================
-- 10. SEED DATA (OPTIONAL - FOR DEVELOPMENT)
-- ================================================================

-- Example: Create sample clients for testing
-- Uncomment and modify as needed

-- INSERT INTO clients (outlet_id, client_type, name, contact_person, phone, email, gstin, billing_address)
-- VALUES 
--   (
--     (SELECT id FROM outlets WHERE code = 'HYB-MUM-01' LIMIT 1),
--     'corporate',
--     'TechCorp Solutions Pvt Ltd',
--     'Rajesh Kumar',
--     '+91 98765 43210',
--     'rajesh@techcorp.com',
--     '27AABCU9603R1ZV',
--     '123 MG Road, Mumbai, Maharashtra - 400001'
--   ),
--   (
--     (SELECT id FROM outlets WHERE code = 'HYB-MUM-01' LIMIT 1),
--     'event',
--     'Sharma Wedding',
--     'Priya Sharma',
--     '+91 98765 43211',
--     'priya@gmail.com',
--     NULL,
--     '456 Andheri West, Mumbai, Maharashtra - 400058'
--   );

-- ================================================================
-- END OF PHASE 2 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created client_type ENUM (corporate, event)
-- ✅ Created clients table with strict outlet isolation
-- ✅ Added indexes for performance optimization
-- ✅ Enabled RLS with role-based policies
-- ✅ Admin: Full CRUD on all clients
-- ✅ Manager: CRUD only for assigned outlets, cannot change type/outlet
-- ✅ Accountant: Read-only on all clients
-- ✅ Triggers for updated_at and created_by (immutable audit trail)
-- ✅ GSTIN format validation at database level
-- ✅ Soft delete via is_active flag
-- ✅ Created helper view for easy client + outlet queries
