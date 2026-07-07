-- ================================================================
-- MIGRATION 037: HARDEN users_update_own_profile RLS POLICY
-- ================================================================
-- PREREQUISITE: 033_fix_user_profiles_rls_recursion.sql
--   (provides current_user_role() and current_user_is_active()).
--
-- BUG:
--   The users_update_own_profile policy pins `role` in WITH CHECK
--   but NOT `is_active`. A deactivated user whose JWT has not yet
--   expired can call the REST API directly and set their own
--   is_active back to true, re-entering the system without an
--   admin's involvement.
--
-- FIX:
--   Pin is_active the same way role is pinned. Users can still
--   update harmless own-profile fields (full_name, phone,
--   last_login) but can no longer change their own role OR their
--   own active status. Admins are unaffected (the separate
--   admins_full_access_user_profiles policy covers them).
--
-- RUN ORDER: after 033.
-- ================================================================

BEGIN;

-- Safety check: the helper functions from 033 must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'current_user_role'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'current_user_is_active'
  ) THEN
    RAISE EXCEPTION 'Prerequisite missing: run 033_fix_user_profiles_rls_recursion.sql first';
  END IF;
END $$;

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;

CREATE POLICY "users_update_own_profile"
ON user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = current_user_role()          -- cannot change own role
  AND is_active = current_user_is_active() -- cannot reactivate self
);

COMMIT;

-- ================================================================
-- Summary:
-- ✅ Deactivated users can no longer reactivate themselves via the
--    REST API with a still-valid session token.
-- ✅ last_login updates on login keep working (field not pinned).
-- ================================================================
