-- ============================================================================
-- FIX: User Profiles RLS Policies - Remove Infinite Recursion
-- ============================================================================
-- This migration fixes the infinite recursion error in user_profiles RLS policies
-- The issue occurs when a policy queries the same table it protects

-- Drop existing policies on user_profiles (if they exist)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow admin full access" ON public.user_profiles;

-- Enable RLS on user_profiles (if not already enabled)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own profile
-- Uses auth.uid() directly - no recursion
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
-- Uses auth.uid() directly - no recursion
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy 3: Service role can do everything (for triggers and server-side operations)
-- This uses SECURITY DEFINER functions, so it bypasses RLS
-- No policy needed for INSERT/DELETE as those should be handled by SECURITY DEFINER functions

-- Policy 4: Allow authenticated users to insert their own profile (for initial creation)
-- Only if the id matches auth.uid()
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Helper function to check if current user is admin (SECURITY DEFINER bypasses RLS)
-- This prevents infinite recursion when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policy 5: Admins can view all profiles
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT
  USING (public.is_admin());

-- Policy 6: Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE
  USING (public.is_admin());

-- Policy 7: Admins can delete profiles (if needed)
CREATE POLICY "Admins can delete profiles" ON public.user_profiles
  FOR DELETE
  USING (public.is_admin());

