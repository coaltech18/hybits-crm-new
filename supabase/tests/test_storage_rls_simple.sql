-- ===================================================================
-- HYBITS CRM — Storage RLS Policy Test Script (Simplified)
-- Tests multi-tenant isolation for storage buckets
-- Run this in Supabase SQL Editor with service_role or authenticated user
-- ===================================================================

-- NOTE: This test assumes you have existing users and outlets in your database
-- For a full test, create test users via Supabase Auth UI first, then run this script

-- Step 1: Verify RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%inventory%' OR policyname LIKE '%document%'
ORDER BY policyname;

-- Step 2: Check existing user profiles and outlets
SELECT 
  up.id as user_id,
  up.email,
  up.role,
  up.outlet_id,
  l.code as outlet_code,
  l.name as outlet_name
FROM public.user_profiles up
LEFT JOIN public.locations l ON l.id = up.outlet_id
ORDER BY up.role, up.outlet_id
LIMIT 10;

-- Step 3: Test inventory images access (run as authenticated user)
-- Replace the user_id below with an actual user ID from your database

-- Test as Manager (replace with actual manager user_id)
-- SELECT COUNT(*) as manager_inventory_count
-- FROM storage.objects 
-- WHERE bucket_id = 'inventory-images';

-- Test as Admin (replace with actual admin user_id)  
-- SELECT COUNT(*) as admin_inventory_count
-- FROM storage.objects 
-- WHERE bucket_id = 'inventory-images';

-- Step 4: Verify document access (requires invoices with invoice_pdf_key)
SELECT 
  i.id,
  i.invoice_number,
  i.outlet_id,
  i.invoice_pdf_key,
  l.code as outlet_code
FROM public.invoices i
LEFT JOIN public.locations l ON l.id = i.outlet_id
WHERE i.invoice_pdf_key IS NOT NULL
LIMIT 10;

-- Step 5: Check storage bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('inventory-images', 'documents');

-- Step 6: Manual RLS Policy Test Function
-- This function simulates what happens when a user tries to access storage
CREATE OR REPLACE FUNCTION test_storage_rls_access(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_file_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  can_access BOOLEAN,
  reason TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_outlet_id UUID;
  v_file_outlet_id TEXT;
  v_invoice_outlet_id UUID;
BEGIN
  -- Get user profile
  SELECT role, outlet_id INTO v_user_role, v_user_outlet_id
  FROM public.user_profiles
  WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT;
    RETURN;
  END IF;
  
  -- Admin can access everything
  IF v_user_role = 'admin' THEN
    RETURN QUERY SELECT TRUE, 'Admin access granted'::TEXT;
    RETURN;
  END IF;
  
  -- Test inventory images access
  IF p_bucket_id = 'inventory-images' THEN
    IF p_file_path IS NULL THEN
      RETURN QUERY SELECT TRUE, 'Listing allowed for outlet: ' || COALESCE(v_user_outlet_id::TEXT, 'NULL')::TEXT;
      RETURN;
    END IF;
    
    -- Extract outlet_id from path (first segment)
    v_file_outlet_id := split_part(p_file_path, '/', 1);
    
    IF v_user_outlet_id::TEXT = v_file_outlet_id THEN
      RETURN QUERY SELECT TRUE, 'Outlet match: ' || v_file_outlet_id::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, 'Outlet mismatch. User outlet: ' || COALESCE(v_user_outlet_id::TEXT, 'NULL') || ', File outlet: ' || v_file_outlet_id::TEXT;
    END IF;
    RETURN;
  END IF;
  
  -- Test documents access
  IF p_bucket_id = 'documents' THEN
    IF p_file_path IS NULL THEN
      RETURN QUERY SELECT FALSE, 'Document listing requires invoice ownership check'::TEXT;
      RETURN;
    END IF;
    
    -- Check if invoice exists and belongs to user's outlet
    SELECT i.outlet_id INTO v_invoice_outlet_id
    FROM public.invoices i
    WHERE i.invoice_pdf_key = p_file_path;
    
    IF v_invoice_outlet_id IS NULL THEN
      RETURN QUERY SELECT FALSE, 'Invoice not found for PDF key: ' || p_file_path::TEXT;
      RETURN;
    END IF;
    
    IF v_invoice_outlet_id = v_user_outlet_id THEN
      RETURN QUERY SELECT TRUE, 'Invoice belongs to user outlet'::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, 'Invoice belongs to different outlet'::TEXT;
    END IF;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT FALSE, 'Unknown bucket: ' || p_bucket_id::TEXT;
END;
$$;

-- Step 7: Example usage of test function
-- Replace user IDs with actual IDs from your database

-- Test inventory image access for a manager
-- SELECT * FROM test_storage_rls_access(
--   'YOUR_MANAGER_USER_ID'::UUID,
--   'inventory-images',
--   'YOUR_OUTLET_ID/ITEM-001/image.jpg'
-- );

-- Test document access for a manager  
-- SELECT * FROM test_storage_rls_access(
--   'YOUR_MANAGER_USER_ID'::UUID,
--   'documents',
--   'INV-KAR-001_1234567890.pdf'
-- );

-- Step 8: Verify RLS is enabled on storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Expected Results:
-- rowsecurity should be TRUE
-- All policies should be listed in Step 1
-- Test function should return correct access decisions based on outlet matching
