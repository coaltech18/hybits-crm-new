-- ================================================================
-- PHASE 1: Authentication, Roles, and Outlet Access
-- ================================================================
-- This migration creates the foundational tables for user management,
-- role-based access control, and multi-outlet support.
-- 
-- Tables Created:
--   1. user_profiles (authorization & business identity)
--   2. outlets (business locations/branches)
--   3. user_outlet_assignments (manager-to-outlet mapping)
--
-- Role-based access: admin, manager, accountant
-- ================================================================

-- ================================================================
-- 1. CREATE ENUMS
-- ================================================================

-- User roles enum (admin, manager, accountant)
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'accountant');

-- ================================================================
-- 2. CREATE OUTLETS TABLE
-- ================================================================
-- Outlets represent physical locations/branches of Hybits operations.
-- Each outlet is an independent billing entity with its own GSTIN.

CREATE TABLE outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL, -- Human-readable identifier (e.g., "HYB-MUM-01")
  address text,
  city text,
  state text,
  pincode text,
  gstin text, -- GST number for this outlet (mandatory for tax compliance)
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_outlets_active ON outlets(is_active) WHERE is_active = true;
CREATE INDEX idx_outlets_code ON outlets(code);

-- ================================================================
-- 3. CREATE USER_PROFILES TABLE
-- ================================================================
-- Renamed from 'users' to avoid conflict with auth.users (Supabase built-in).
-- Separation of concerns:
--   - auth.users = authentication (Supabase managed)
--   - user_profiles = authorization & business identity (our domain)

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ================================================================
-- 4. CREATE USER_OUTLET_ASSIGNMENTS TABLE
-- ================================================================
-- Maps managers to their assigned outlets (many-to-many relationship).
-- ONLY managers get entries here.
-- Admins and Accountants have implicit access to ALL outlets (no rows needed).

CREATE TABLE user_outlet_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES user_profiles(id), -- Tracks who assigned (audit trail)
  UNIQUE(user_id, outlet_id) -- Prevent duplicate assignments
);

-- Indexes for performance
CREATE INDEX idx_user_outlet_assignments_user ON user_outlet_assignments(user_id);
CREATE INDEX idx_user_outlet_assignments_outlet ON user_outlet_assignments(outlet_id);

-- ================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_outlet_assignments ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 6. RLS POLICIES FOR USER_PROFILES
-- ================================================================

-- Admins can see and manage all user profiles
CREATE POLICY "admins_full_access_user_profiles"
ON user_profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.is_active = true
  )
);

-- Users can see their own profile
CREATE POLICY "users_see_own_profile"
ON user_profiles
FOR SELECT
USING (id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own_profile"
ON user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()) -- Cannot change own role
);

-- ================================================================
-- 7. RLS POLICIES FOR OUTLETS
-- ================================================================

-- Admins have full access to all outlets
CREATE POLICY "admins_full_access_outlets"
ON outlets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  )
);

-- Managers can see their assigned outlets
CREATE POLICY "managers_see_assigned_outlets"
ON outlets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
  )
  AND id IN (
    SELECT outlet_id
    FROM user_outlet_assignments
    WHERE user_id = auth.uid()
  )
);

-- Accountants can see all outlets
CREATE POLICY "accountants_see_all_outlets"
ON outlets
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
-- 8. RLS POLICIES FOR USER_OUTLET_ASSIGNMENTS
-- ================================================================

-- Admins can manage all assignments
CREATE POLICY "admins_full_access_assignments"
ON user_outlet_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  )
);

-- Managers can see their own assignments
CREATE POLICY "managers_see_own_assignments"
ON user_outlet_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'manager'
      AND is_active = true
  )
);

-- ================================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_outlets_updated_at
  BEFORE UPDATE ON outlets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 10. SEED DATA (OPTIONAL - FOR DEVELOPMENT)
-- ================================================================

-- Create a sample outlet (you can add more as needed)
-- INSERT INTO outlets (name, code, city, state, gstin, phone, email)
-- VALUES 
--   ('Mumbai Headquarters', 'HYB-MUM-01', 'Mumbai', 'Maharashtra', '27AABCU9603R1ZV', '+91 22 1234 5678', 'mumbai@hybits.com'),
--   ('Delhi Branch', 'HYB-DEL-01', 'New Delhi', 'Delhi', '07AABCU9603R1ZV', '+91 11 1234 5678', 'delhi@hybits.com');

-- Note: First admin user must be created manually:
-- 1. Sign up via Supabase Auth (creates auth.users entry)
-- 2. Insert into user_profiles with role='admin'
-- Example:
-- INSERT INTO user_profiles (id, email, full_name, role)
-- VALUES ('auth-user-uuid-here', 'admin@hybits.com', 'Admin User', 'admin');

-- ================================================================
-- END OF PHASE 1 MIGRATION
-- ================================================================
