-- ================================================================
-- MIGRATION 021: Fix admin_users_summary View
-- ================================================================
-- Purpose: Remove dependency on auth.users table which is not
--          accessible from frontend clients.
--
-- Changes:
--   1. Add last_login column to user_profiles table
--   2. Recreate admin_users_summary view WITHOUT auth.users join
--   3. Ensure RLS allows frontend access
--
-- Date: 2026-02-05
-- ================================================================

-- ================================================================
-- STEP 1: Add last_login column to user_profiles
-- ================================================================
-- This column will be populated by the application on successful login
-- instead of reading from auth.users.last_sign_in_at

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_profiles.last_login IS 'Last successful login timestamp, updated by application on auth success';

-- Create index for performance on login queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login 
ON user_profiles(last_login DESC NULLS LAST);

-- ================================================================
-- STEP 2: Recreate admin_users_summary view WITHOUT auth.users
-- ================================================================
-- CRITICAL: The previous view joined auth.users which is NOT accessible
-- from frontend clients. This caused permission denied errors.

DROP VIEW IF EXISTS admin_users_summary;

CREATE VIEW admin_users_summary
WITH (security_invoker = true)
AS
SELECT
  up.id AS user_id,
  up.full_name,
  up.email,
  up.role::TEXT AS role,
  up.is_active,
  COALESCE(
    ARRAY_AGG(o.name ORDER BY o.name) FILTER (WHERE o.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS assigned_outlets,
  up.created_at,
  up.updated_at,
  up.last_login  -- Now from user_profiles, NOT auth.users
FROM
  user_profiles up
LEFT JOIN
  user_outlet_assignments uoa ON up.id = uoa.user_id
LEFT JOIN
  outlets o ON uoa.outlet_id = o.id AND o.is_active = true
GROUP BY
  up.id, up.full_name, up.email, up.role, up.is_active, 
  up.created_at, up.updated_at, up.last_login
ORDER BY
  up.created_at DESC;

COMMENT ON VIEW admin_users_summary IS 'Admin view: User list with roles, status, and outlet assignments. No auth.users dependency.';

-- ================================================================
-- STEP 3: Grant SELECT on view to authenticated users
-- ================================================================
-- RLS on underlying tables will filter data appropriately

GRANT SELECT ON admin_users_summary TO authenticated;

-- ================================================================
-- STEP 4: Migrate existing last_sign_in_at data (ONE-TIME)
-- ================================================================
-- This migrates existing last_sign_in_at from auth.users to user_profiles.
-- This runs once during migration. Future updates happen on login.
--
-- NOTE: This requires being run by a user with access to auth.users
-- (typically via Supabase dashboard SQL editor or service role).

DO $$
BEGIN
  -- Only run if auth.users is accessible (won't work from anon client)
  UPDATE user_profiles up
  SET last_login = au.last_sign_in_at
  FROM auth.users au
  WHERE up.id = au.id
    AND up.last_login IS NULL
    AND au.last_sign_in_at IS NOT NULL;
    
  RAISE NOTICE 'Migrated last_sign_in_at to user_profiles.last_login';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Cannot migrate last_sign_in_at - run this migration with service role';
  WHEN OTHERS THEN
    RAISE NOTICE 'Migration of last_sign_in_at skipped: %', SQLERRM;
END;
$$;

-- ================================================================
-- DONE
-- ================================================================
-- Summary:
--   - Added user_profiles.last_login column
--   - Recreated admin_users_summary WITHOUT auth.users dependency
--   - View now readable by frontend with existing RLS
--   - Application must update last_login on successful login
--
-- NEXT STEP (Application Code):
--   Update authService.ts to set last_login on successful login
-- ================================================================
