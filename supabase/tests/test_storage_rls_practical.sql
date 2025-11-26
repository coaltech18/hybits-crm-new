-- ===================================================================
-- HYBITS CRM — Practical Storage RLS Test Script
-- Run this in Supabase SQL Editor to test storage policies
-- ===================================================================

-- STEP 1: Get your actual user IDs and outlets
-- Run this first to see what users/outlets exist
SELECT 
  up.id as user_id,
  up.email,
  up.role,
  up.outlet_id,
  l.code as outlet_code,
  l.name as outlet_name
FROM public.user_profiles up
LEFT JOIN public.locations l ON l.id = up.outlet_id
ORDER BY up.role, up.created_at DESC
LIMIT 20;

-- STEP 2: Verify RLS policies are in place
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (policyname LIKE '%inventory%' OR policyname LIKE '%document%')
ORDER BY policyname;

-- STEP 3: Test inventory images access
-- Replace USER_ID_1 and USER_ID_2 with actual user IDs from Step 1
-- Replace OUTLET_ID_1 and OUTLET_ID_2 with actual outlet IDs

-- Example: Test if a manager can access their outlet's images
-- SELECT * FROM test_storage_access(
--   'USER_ID_1'::UUID,  -- Replace with actual manager user ID
--   'inventory-images',
--   'OUTLET_ID_1/ITEM-001/test.jpg'  -- Replace with actual outlet ID
-- );

-- Example: Test if a manager CANNOT access another outlet's images
-- SELECT * FROM test_storage_access(
--   'USER_ID_1'::UUID,  -- Manager from outlet 1
--   'inventory-images',
--   'OUTLET_ID_2/ITEM-002/test.jpg'  -- File from outlet 2 (should fail)
-- );

-- STEP 4: Test document access
-- First, check what invoices exist with PDF keys
SELECT 
  i.id,
  i.invoice_number,
  i.outlet_id,
  i.invoice_pdf_key,
  l.code as outlet_code
FROM public.invoices i
LEFT JOIN public.locations l ON l.id = i.outlet_id
WHERE i.invoice_pdf_key IS NOT NULL
ORDER BY i.created_at DESC
LIMIT 10;

-- Example: Test if a manager can access their outlet's invoice PDF
-- SELECT * FROM test_storage_access(
--   'USER_ID_1'::UUID,  -- Replace with actual manager user ID
--   'documents',
--   'INV-KAR-001_1234567890.pdf'  -- Replace with actual invoice_pdf_key
-- );

-- STEP 5: Verify buckets exist and are private
SELECT 
  id,
  name,
  public as is_public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('inventory-images', 'documents');

-- Expected: is_public should be FALSE for both buckets

-- STEP 6: Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Expected: rls_enabled should be TRUE

-- STEP 7: Manual test - Try to list files (run as authenticated user)
-- This will show what files the current user can see
-- SELECT 
--   bucket_id,
--   name,
--   created_at
-- FROM storage.objects
-- WHERE bucket_id = 'inventory-images'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- STEP 8: Test cross-outlet access prevention
-- Create a test scenario:
-- 1. Get a manager user ID from outlet A
-- 2. Get a file path from outlet B
-- 3. Test access - should return FALSE

-- Example:
-- SELECT 
--   'Cross-outlet access test' as test_name,
--   * 
-- FROM test_storage_access(
--   'MANAGER_FROM_OUTLET_A'::UUID,
--   'inventory-images',
--   'OUTLET_B_ID/ITEM-001/image.jpg'
-- );
-- Expected: can_access = FALSE

-- STEP 9: Verify admin access
-- Get an admin user ID and test
-- SELECT * FROM test_storage_access(
--   'ADMIN_USER_ID'::UUID,
--   'inventory-images',
--   'ANY_OUTLET_ID/ITEM-001/image.jpg'
-- );
-- Expected: can_access = TRUE (admin override)

-- ===================================================================
-- QUICK VALIDATION CHECKLIST
-- ===================================================================
-- [ ] RLS policies exist (Step 2 shows 8 policies)
-- [ ] Buckets are private (Step 5 shows is_public = FALSE)
-- [ ] RLS is enabled (Step 6 shows rls_enabled = TRUE)
-- [ ] Managers can access their outlet's files
-- [ ] Managers CANNOT access other outlets' files
-- [ ] Admins can access all files
-- [ ] Documents access based on invoice ownership

-- ===================================================================
-- TROUBLESHOOTING
-- ===================================================================
-- If tests fail:
-- 1. Verify user_profiles table has correct outlet_id
-- 2. Verify invoices table has correct outlet_id and invoice_pdf_key
-- 3. Check file paths match expected format: {outlet_id}/{item_code}/{filename}
-- 4. Ensure RLS policies were applied (check Step 2)
-- 5. Verify buckets exist (check Step 5)
