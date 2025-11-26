-- ===================================================================
-- HYBITS CRM — Storage RLS Test Helper Functions
-- Provides secure functions for testing storage RLS policies
-- ===================================================================

-- Function to create test user profile (for testing only)
-- This bypasses auth.users creation and creates profile directly
CREATE OR REPLACE FUNCTION create_test_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'manager',
  p_outlet_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, outlet_id)
  VALUES (p_user_id, p_email, p_role::public.user_role, p_outlet_id)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      outlet_id = EXCLUDED.outlet_id;
  
  RETURN p_user_id;
END;
$$;

-- Function to test storage access with simulated user context
CREATE OR REPLACE FUNCTION test_storage_access(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_file_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  can_access BOOLEAN,
  reason TEXT,
  policy_applied TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_user_role TEXT;
  v_user_outlet_id UUID;
  v_file_outlet_id TEXT;
  v_invoice_outlet_id UUID;
  v_policy_name TEXT;
BEGIN
  -- Get user profile
  SELECT role, outlet_id INTO v_user_role, v_user_outlet_id
  FROM public.user_profiles
  WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Admin can access everything
  IF v_user_role = 'admin' THEN
    RETURN QUERY SELECT TRUE, 'Admin access granted'::TEXT, 'Admin override'::TEXT;
    RETURN;
  END IF;
  
  -- Test inventory images access
  IF p_bucket_id = 'inventory-images' THEN
    v_policy_name := 'Inventory images outlet isolation - select';
    
    IF p_file_path IS NULL THEN
      -- Listing: check if user can list files
      IF v_user_outlet_id IS NOT NULL THEN
        RETURN QUERY SELECT TRUE, 
          'Can list files for outlet: ' || v_user_outlet_id::TEXT, 
          v_policy_name;
      ELSE
        RETURN QUERY SELECT FALSE, 'No outlet assigned to user'::TEXT, v_policy_name;
      END IF;
      RETURN;
    END IF;
    
    -- Extract outlet_id from path (first segment)
    v_file_outlet_id := split_part(p_file_path, '/', 1);
    
    IF v_user_outlet_id::TEXT = v_file_outlet_id THEN
      RETURN QUERY SELECT TRUE, 
        'Outlet match: ' || v_file_outlet_id::TEXT, 
        v_policy_name;
    ELSE
      RETURN QUERY SELECT FALSE, 
        'Outlet mismatch. User outlet: ' || COALESCE(v_user_outlet_id::TEXT, 'NULL') || 
        ', File outlet: ' || v_file_outlet_id::TEXT, 
        v_policy_name;
    END IF;
    RETURN;
  END IF;
  
  -- Test documents access
  IF p_bucket_id = 'documents' THEN
    v_policy_name := 'Documents access by invoice ownership - select';
    
    IF p_file_path IS NULL THEN
      RETURN QUERY SELECT FALSE, 
        'Document listing requires invoice ownership check'::TEXT, 
        v_policy_name;
      RETURN;
    END IF;
    
    -- Check if invoice exists and belongs to user's outlet
    SELECT i.outlet_id INTO v_invoice_outlet_id
    FROM public.invoices i
    WHERE i.invoice_pdf_key = p_file_path;
    
    IF v_invoice_outlet_id IS NULL THEN
      RETURN QUERY SELECT FALSE, 
        'Invoice not found for PDF key: ' || p_file_path::TEXT, 
        v_policy_name;
      RETURN;
    END IF;
    
    IF v_invoice_outlet_id = v_user_outlet_id THEN
      RETURN QUERY SELECT TRUE, 
        'Invoice belongs to user outlet'::TEXT, 
        v_policy_name;
    ELSE
      RETURN QUERY SELECT FALSE, 
        'Invoice belongs to different outlet. Invoice outlet: ' || 
        v_invoice_outlet_id::TEXT || ', User outlet: ' || 
        COALESCE(v_user_outlet_id::TEXT, 'NULL')::TEXT, 
        v_policy_name;
    END IF;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT FALSE, 
    'Unknown bucket: ' || p_bucket_id::TEXT, 
    NULL::TEXT;
END;
$$;

-- Function to create test storage objects (for testing only)
CREATE OR REPLACE FUNCTION create_test_storage_object(
  p_bucket_id TEXT,
  p_file_path TEXT,
  p_owner_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage
AS $$
DECLARE
  v_object_id UUID;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    p_bucket_id,
    p_file_path,
    p_owner_id,
    jsonb_build_object('created_by', 'test_function')
  )
  ON CONFLICT (bucket_id, name) DO NOTHING
  RETURNING id INTO v_object_id;
  
  RETURN COALESCE(v_object_id::TEXT, 'Object already exists');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_test_user_profile TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION test_storage_access TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_test_storage_object TO authenticated, service_role;

-- End of 012_storage_test_helpers.sql
