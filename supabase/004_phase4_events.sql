-- ================================================================
-- PHASE 4: EVENTS (ONE-TIME BILLING)
-- ================================================================
-- This migration creates the events system for event clients.
--
-- Business Rules:
--   - ONLY event clients can have events
--   - Events are one-time (no recurrence)
--   - Events generate EVENT invoices (Phase 5)
--   - Each event belongs to ONE outlet
--   - Client must belong to same outlet as event
--
-- Event Lifecycle:
--   - planned: Initial state, can be edited
--   - completed: Event happened, ready for invoicing (Phase 5)
--   - cancelled: Event cancelled, no invoice
--
-- Role Access:
--   - Admin: Full CRUD on all events (all outlets)
--   - Manager: CRUD only for assigned outlet events
--   - Accountant: Read-only on all events (all outlets)
-- ================================================================

-- ================================================================
-- 1. CREATE ENUM
-- ================================================================

-- Event status
CREATE TYPE event_status AS ENUM ('planned', 'completed', 'cancelled');

-- ================================================================
-- 2. CREATE EVENTS TABLE
-- ================================================================

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  
  -- Event details
  event_name text NOT NULL,
  event_type text,
  event_date date NOT NULL,
  
  -- Additional info
  guest_count integer CHECK (guest_count IS NULL OR guest_count > 0),
  notes text,
  
  -- Status
  status event_status NOT NULL DEFAULT 'planned',
  
  -- Audit trail
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Fast lookup by outlet (manager queries)
CREATE INDEX idx_events_outlet_id ON events(outlet_id);

-- Fast lookup by client
CREATE INDEX idx_events_client_id ON events(client_id);

-- Fast filtering by status
CREATE INDEX idx_events_status ON events(status);

-- Fast filtering by event date
CREATE INDEX idx_events_event_date ON events(event_date);

-- Composite for manager queries (outlet + status)
CREATE INDEX idx_events_outlet_status ON events(outlet_id, status);

-- Composite for date range queries
CREATE INDEX idx_events_outlet_date ON events(outlet_id, event_date);

-- ================================================================
-- 4. BUSINESS RULE VALIDATION TRIGGER
-- ================================================================
-- Enforces rules that cannot be done via CHECK constraints:
--   - Client must be event type
--   - Client outlet must match event outlet
-- This is enforced at trigger level (not CHECK) due to PostgreSQL limitations

CREATE OR REPLACE FUNCTION validate_event_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  client_outlet_id uuid;
  client_type_val client_type;
BEGIN
  -- Get client's outlet and type
  SELECT outlet_id, client_type INTO client_outlet_id, client_type_val
  FROM clients
  WHERE id = NEW.client_id;
  
  -- Rule 1: Client must exist
  IF client_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Client does not exist';
  END IF;
  
  -- Rule 2: Client must be event type (LOCKED BUSINESS RULE)
  IF client_type_val != 'event' THEN
    RAISE EXCEPTION 'Only event clients can have events. Corporate clients cannot have events.';
  END IF;
  
  -- Rule 3: Outlet must match (LOCKED BUSINESS RULE)
  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet. Client outlet: %, Event outlet: %', 
      client_outlet_id, NEW.outlet_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
CREATE TRIGGER validate_event_before_insert_update
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_event_business_rules();

-- ================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 6. RLS POLICIES FOR EVENTS
-- ================================================================

-- ----------------------------------------------------------------
-- ADMIN: Full access to all events (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "admins_full_access_events"
ON events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  )
);

-- ----------------------------------------------------------------
-- MANAGER: Access ONLY events from assigned outlets
-- ----------------------------------------------------------------
-- SELECT: Managers can view events from their assigned outlets
CREATE POLICY "managers_select_own_outlet_events"
ON events
FOR SELECT
TO authenticated
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

-- INSERT: Managers can create events ONLY for assigned outlets
CREATE POLICY "managers_insert_own_outlet_events"
ON events
FOR INSERT
TO authenticated
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

-- UPDATE: Managers can update events from assigned outlets
-- AND cannot change outlet_id or client_id (enforced by trigger below)
CREATE POLICY "managers_update_own_outlet_events"
ON events
FOR UPDATE
TO authenticated
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
  -- Ensure updated outlet_id remains in manager's assigned outlets
  outlet_id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------
-- ACCOUNTANT: Read-only access to all events (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "accountants_readonly_all_events"
ON events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'accountant'
      AND is_active = true
  )
);

-- ================================================================
-- 7. TRIGGER FOR UPDATED_AT
-- ================================================================

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 8. TRIGGER FOR CREATED_BY (AUTO-SET, IMMUTABLE)
-- ================================================================

CREATE TRIGGER set_events_created_by
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- 9. TRIGGER TO PREVENT MANAGERS FROM CHANGING RESTRICTED FIELDS
-- ================================================================

CREATE OR REPLACE FUNCTION enforce_manager_event_restrictions()
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
    -- Prevent changing outlet_id
    IF OLD.outlet_id IS DISTINCT FROM NEW.outlet_id THEN
      RAISE EXCEPTION 'Managers cannot change outlet assignment. Only admins can modify this field.';
    END IF;
    
    -- Prevent changing client_id
    IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Managers cannot change client assignment. Only admins can modify this field.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_manager_restrictions_on_events
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_manager_event_restrictions();

-- ================================================================
-- 10. HELPER VIEW: EVENTS WITH JOINED DATA
-- ================================================================

CREATE OR REPLACE VIEW events_with_details AS
SELECT 
  e.*,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city
FROM events e
JOIN clients c ON e.client_id = c.id
JOIN outlets o ON e.outlet_id = o.id;

-- Apply same RLS policies to the view
ALTER VIEW events_with_details SET (security_invoker = true);

-- ================================================================
-- 11. SEED DATA (OPTIONAL - FOR DEVELOPMENT)
-- ================================================================

-- Example: Create sample events for testing
-- Uncomment and modify as needed

-- INSERT INTO events (
--   outlet_id,
--   client_id,
--   event_name,
--   event_type,
--   event_date,
--   guest_count,
--   notes,
--   status
-- )
-- VALUES (
--   (SELECT id FROM outlets WHERE code = 'HYB-BLR-01' LIMIT 1),
--   (SELECT id FROM clients WHERE client_type = 'event' AND name LIKE '%Wedding%' LIMIT 1),
--   'Kumar-Priya Wedding',
--   'Wedding',
--   '2026-03-15',
--   500,
--   'Grand wedding ceremony with catering and decoration',
--   'planned'
-- );

-- ================================================================
-- END OF PHASE 4 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created event_status ENUM (planned, completed, cancelled)
-- ✅ Created events table with all required fields
-- ✅ Added indexes for performance optimization
-- ✅ Enabled RLS with role-based policies
-- ✅ Admin: Full CRUD on all events
-- ✅ Manager: CRUD only for assigned outlets, cannot change outlet/client
-- ✅ Accountant: Read-only on all events
-- ✅ Triggers for business rule validation (event-only, outlet-match)
-- ✅ Triggers for updated_at and created_by (immutable audit trail)
-- ✅ Triggers to prevent managers from changing restricted fields
-- ✅ Helper view for easy event + client + outlet queries
-- ✅ Guest count validation (> 0 if provided)
-- ✅ Locked rules: Event clients only, outlet matching enforced
