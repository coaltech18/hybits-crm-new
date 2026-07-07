-- Fix RLS infinite recursion on user_profiles
-- The admin policy queried user_profiles inside its own RLS check.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_active, false) FROM user_profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "admins_full_access_user_profiles" ON user_profiles;
CREATE POLICY "admins_full_access_user_profiles"
ON user_profiles
FOR ALL
USING (
  current_user_role() = 'admin'::user_role
  AND current_user_is_active() = true
);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile"
ON user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = current_user_role()
);
