-- ==============================================================
-- 002 - Auth & RBAC
-- ==============================================================

-- Base roles
CREATE TYPE user_role AS ENUM ('admin','manager','accountant','viewer');

ALTER TABLE public.users_meta
  ALTER COLUMN role TYPE user_role USING role::user_role;

-- Policies
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access" ON public.users_meta
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.users_meta WHERE role = 'admin')
  );

CREATE POLICY "Allow self read/update" ON public.users_meta
  FOR SELECT, UPDATE USING (auth.uid() = user_id);

-- Link user_id to Supabase session
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users_meta WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;
