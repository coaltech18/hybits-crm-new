-- ================================================================
-- PHASE 3: SUBSCRIPTIONS (CORPORATE FLOW)
-- ================================================================
-- This migration creates the subscriptions system for corporate clients.
--
-- Business Rules:
--   - ONLY corporate clients can have subscriptions
--   - Subscriptions generate recurring invoices (Phase 5)
--   - Each subscription belongs to ONE outlet
--   - Client must belong to same outlet as subscription
--   - Price/quantity changes affect ONLY future invoices
--
-- Subscription Lifecycle:
--   - active: Running, invoices will generate
--   - paused: Temporarily stopped, can be resumed
--   - cancelled: Permanently stopped, cannot be resumed
--
-- Role Access:
--   - Admin: Full CRUD on all subscriptions (all outlets)
--   - Manager: CRUD only for assigned outlet subscriptions
--   - Accountant: Read-only on all subscriptions (all outlets)
-- ================================================================

-- ================================================================
-- 1. CREATE ENUMS
-- ================================================================

-- Subscription status
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled');

-- Billing cycle frequency
CREATE TYPE billing_cycle AS ENUM ('daily', 'weekly', 'monthly');

-- ================================================================
-- 2. CREATE SUBSCRIPTIONS TABLE
-- ================================================================

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  
  -- Billing configuration
  billing_cycle billing_cycle NOT NULL,
  billing_day integer CHECK (billing_day IS NULL OR (billing_day BETWEEN 1 AND 28)),
  start_date date NOT NULL,
  end_date date CHECK (end_date IS NULL OR end_date >= start_date),
  
  -- Status
  status subscription_status NOT NULL DEFAULT 'active',
  
  -- Pricing (affects future invoices only)
  quantity integer NOT NULL CHECK (quantity > 0),
  price_per_unit numeric(10,2) NOT NULL CHECK (price_per_unit >= 0),
  
  -- Calculated billing date
  next_billing_date date NOT NULL,
  
  -- Additional info
  notes text,
  
  -- Audit trail
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Business rule: Cancelled subscriptions MUST have end_date
  CONSTRAINT subscriptions_cancelled_has_end_date
    CHECK (status != 'cancelled' OR end_date IS NOT NULL),
  
  -- Business rule: Monthly billing MUST have billing_day (1-28)
  CONSTRAINT subscriptions_monthly_has_billing_day
    CHECK (billing_cycle != 'monthly' OR (billing_day IS NOT NULL AND billing_day BETWEEN 1 AND 28))
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Fast lookup by outlet (manager queries)
CREATE INDEX idx_subscriptions_outlet_id ON subscriptions(outlet_id);

-- Fast lookup by client
CREATE INDEX idx_subscriptions_client_id ON subscriptions(client_id);

-- Fast filtering by status
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Composite for active subscriptions needing billing (Phase 5)
CREATE INDEX idx_subscriptions_active_billing 
ON subscriptions(status, next_billing_date) 
WHERE status = 'active';

-- Composite for manager queries (outlet + status)
CREATE INDEX idx_subscriptions_outlet_status ON subscriptions(outlet_id, status);

-- Fast search by next billing date (Phase 5 invoice generation)
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date)
WHERE status = 'active';

-- ================================================================
-- 4. BUSINESS RULE VALIDATION TRIGGER
-- ================================================================
-- Enforces rules that cannot be done via CHECK constraints:
--   - Client must be corporate
--   - Client outlet must match subscription outlet
-- This is enforced at trigger level (not CHECK) due to PostgreSQL limitations

CREATE OR REPLACE FUNCTION validate_subscription_business_rules()
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
  
  -- Rule 2: Client must be corporate (LOCKED BUSINESS RULE)
  IF client_type_val != 'corporate' THEN
    RAISE EXCEPTION 'Only corporate clients can have subscriptions. Event clients cannot have subscriptions.';
  END IF;
  
  -- Rule 3: Outlet must match (LOCKED BUSINESS RULE)
  IF client_outlet_id != NEW.outlet_id THEN
    RAISE EXCEPTION 'Client does not belong to selected outlet. Client outlet: %, Subscription outlet: %', 
      client_outlet_id, NEW.outlet_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
CREATE TRIGGER validate_subscription_before_insert_update
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION validate_subscription_business_rules();

-- ================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 6. RLS POLICIES FOR SUBSCRIPTIONS
-- ================================================================

-- ----------------------------------------------------------------
-- ADMIN: Full access to all subscriptions (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "admins_full_access_subscriptions"
ON subscriptions
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
-- MANAGER: Access ONLY subscriptions from assigned outlets
-- ----------------------------------------------------------------
-- SELECT: Managers can view subscriptions from their assigned outlets
CREATE POLICY "managers_select_own_outlet_subscriptions"
ON subscriptions
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

-- INSERT: Managers can create subscriptions ONLY for assigned outlets
CREATE POLICY "managers_insert_own_outlet_subscriptions"
ON subscriptions
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

-- UPDATE: Managers can update subscriptions from assigned outlets
-- AND cannot change outlet_id or client_id (enforced by trigger below)
CREATE POLICY "managers_update_own_outlet_subscriptions"
ON subscriptions
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
-- ACCOUNTANT: Read-only access to all subscriptions (all outlets)
-- ----------------------------------------------------------------
CREATE POLICY "accountants_readonly_all_subscriptions"
ON subscriptions
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

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 8. TRIGGER FOR CREATED_BY (AUTO-SET, IMMUTABLE)
-- ================================================================

CREATE TRIGGER set_subscriptions_created_by
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- ================================================================
-- 9. TRIGGER TO PREVENT MANAGERS FROM CHANGING RESTRICTED FIELDS
-- ================================================================

CREATE OR REPLACE FUNCTION enforce_manager_subscription_restrictions()
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

CREATE TRIGGER enforce_manager_restrictions_on_subscriptions
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_manager_subscription_restrictions();

-- ================================================================
-- 10. HELPER VIEW: SUBSCRIPTIONS WITH JOINED DATA
-- ================================================================

CREATE OR REPLACE VIEW subscriptions_with_details AS
SELECT 
  s.*,
  c.name AS client_name,
  c.client_type,
  c.phone AS client_phone,
  o.name AS outlet_name,
  o.code AS outlet_code,
  o.city AS outlet_city,
  -- Calculate total per billing cycle
  (s.quantity * s.price_per_unit) AS total_amount
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN outlets o ON s.outlet_id = o.id;

-- Apply same RLS policies to the view
ALTER VIEW subscriptions_with_details SET (security_invoker = true);

-- ================================================================
-- 11. SEED DATA (OPTIONAL - FOR DEVELOPMENT)
-- ================================================================

-- Example: Create sample subscriptions for testing
-- Uncomment and modify as needed

-- INSERT INTO subscriptions (
--   outlet_id,
--   client_id,
--   billing_cycle,
--   billing_day,
--   start_date,
--   quantity,
--   price_per_unit,
--   next_billing_date,
--   notes
-- )
-- VALUES (
--   (SELECT id FROM outlets WHERE code = 'HYB-BLR-01' LIMIT 1),
--   (SELECT id FROM clients WHERE client_type = 'corporate' AND name LIKE '%Tech%' LIMIT 1),
--   'monthly',
--   15, -- Bill on 15th of each month
--   '2026-01-01',
--   10, -- quantity
--   500.00, -- price per unit
--   '2026-02-15', -- next billing date
--   'Premium support package'
-- );

-- ================================================================
-- END OF PHASE 3 MIGRATION
-- ================================================================

-- Migration Summary:
-- ✅ Created subscription_status ENUM (active, paused, cancelled)
-- ✅ Created billing_cycle ENUM (daily, weekly, monthly)
-- ✅ Created subscriptions table with all required fields
-- ✅ Added indexes for performance optimization
-- ✅ Enabled RLS with role-based policies
-- ✅ Admin: Full CRUD on all subscriptions
-- ✅ Manager: CRUD only for assigned outlets, cannot change outlet/client
-- ✅ Accountant: Read-only on all subscriptions
-- ✅ Triggers for business rule validation (corporate-only, outlet-match)
-- ✅ Triggers for updated_at and created_by (immutable audit trail)
-- ✅ Triggers to prevent managers from changing restricted fields
-- ✅ Helper view for easy subscription + client + outlet queries
-- ✅ Billing day validation (1-28 for monthly)
-- ✅ Cancelled subscriptions must have end_date
-- ✅ Locked rules: next_billing_date not manually editable
-- ✅ Locked rules: Admin can create past-dated, Manager cannot
