-- ============================================================================
-- USER MANAGEMENT TRIGGERS & HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_outlet UUID;
  target_outlet_name TEXT;
  requested_outlet TEXT;
  requested_role TEXT;
  resolved_role public.user_role;
  is_active_flag BOOLEAN;
  phone_value TEXT;
BEGIN
  requested_outlet := COALESCE(NEW.raw_user_meta_data->>'outlet_id', NULL);
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'manager');
  phone_value := COALESCE(NEW.raw_user_meta_data->>'phone', NULL);
  is_active_flag := COALESCE((NEW.raw_user_meta_data->>'is_active')::BOOLEAN, TRUE);

  BEGIN
    resolved_role := requested_role::public.user_role;
  EXCEPTION WHEN others THEN
    resolved_role := 'manager';
  END;

  IF requested_outlet IS NOT NULL THEN
    SELECT id, name
      INTO target_outlet, target_outlet_name
    FROM public.locations
    WHERE id = requested_outlet::uuid
    LIMIT 1;
  END IF;

  IF target_outlet IS NULL THEN
    SELECT id, name
      INTO target_outlet, target_outlet_name
    FROM public.locations
    ORDER BY created_at
    LIMIT 1;
  END IF;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    phone,
    outlet_id,
    outlet_name,
    is_active,
    created_at,
    updated_at,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    resolved_role,
    phone_value,
    target_outlet,
    target_outlet_name,
    is_active_flag,
    NOW(),
    NOW(),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

