-- ===================================================================
-- HYBITS CRM — Storage RLS Policy Test Script
-- Tests multi-tenant isolation for storage buckets
-- ===================================================================

-- This script should be run with different user contexts to test isolation
-- Run with: supabase db test --file tests/test_storage_rls.sql

BEGIN;

-- Test setup: Create test data
INSERT INTO public.locations (id, code, name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'KAR', 'Karnataka Outlet'),
  ('22222222-2222-2222-2222-222222222222', 'MUM', 'Mumbai Outlet')
ON CONFLICT (id) DO NOTHING;

-- Create test users
INSERT INTO auth.users (id, email) VALUES 
  ('33333333-3333-3333-3333-333333333333', 'manager1@test.com'),
  ('44444444-4444-4444-4444-444444444444', 'manager2@test.com'),
  ('55555555-5555-5555-5555-555555555555', 'admin@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, role, outlet_id) VALUES 
  ('33333333-3333-3333-3333-333333333333', 'manager1@test.com', 'manager', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'manager2@test.com', 'manager', '22222222-2222-2222-2222-222222222222'),
  ('55555555-5555-5555-5555-555555555555', 'admin@test.com', 'admin', NULL)
ON CONFLICT (id) DO NOTHING;

-- Create test invoices
INSERT INTO public.customers (id, customer_code, phone, outlet_id) VALUES 
  ('66666666-6666-6666-6666-666666666666', 'CUST-KAR-001', '9876543210', '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777777777', 'CUST-MUM-001', '9876543211', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoices (id, invoice_number, customer_id, outlet_id, invoice_pdf_key) VALUES 
  ('88888888-8888-8888-8888-888888888888', 'INV-KAR-001', '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'invoice_kar_001.pdf'),
  ('99999999-9999-9999-9999-999999999999', 'INV-MUM-001', '77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'invoice_mum_001.pdf')
ON CONFLICT (id) DO NOTHING;

-- Test storage objects (simulate files)
INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES 
  ('inventory-images', '11111111-1111-1111-1111-111111111111/ITEM-001/image1.jpg', '33333333-3333-3333-3333-333333333333', '{}'),
  ('inventory-images', '22222222-2222-2222-2222-222222222222/ITEM-002/image2.jpg', '44444444-4444-4444-4444-444444444444', '{}'),
  ('documents', 'invoice_kar_001.pdf', NULL, '{}'),
  ('documents', 'invoice_mum_001.pdf', NULL, '{}')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Test 1: Manager 1 (KAR outlet) should only see KAR inventory images
SELECT 'Test 1: KAR manager inventory access' as test_name;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';

-- Should return 1 row (KAR image only)
SELECT COUNT(*) as kar_manager_inventory_count 
FROM storage.objects 
WHERE bucket_id = 'inventory-images';

-- Test 2: Manager 2 (MUM outlet) should only see MUM inventory images  
SELECT 'Test 2: MUM manager inventory access' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444"}';

-- Should return 1 row (MUM image only)
SELECT COUNT(*) as mum_manager_inventory_count 
FROM storage.objects 
WHERE bucket_id = 'inventory-images';

-- Test 3: Admin should see all inventory images
SELECT 'Test 3: Admin inventory access' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555"}';

-- Should return 2 rows (all images)
SELECT COUNT(*) as admin_inventory_count 
FROM storage.objects 
WHERE bucket_id = 'inventory-images';

-- Test 4: Manager 1 should only see KAR invoice PDFs
SELECT 'Test 4: KAR manager document access' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';

-- Should return 1 row (KAR invoice PDF only)
SELECT COUNT(*) as kar_manager_document_count 
FROM storage.objects 
WHERE bucket_id = 'documents';

-- Test 5: Manager 2 should only see MUM invoice PDFs
SELECT 'Test 5: MUM manager document access' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444"}';

-- Should return 1 row (MUM invoice PDF only)
SELECT COUNT(*) as mum_manager_document_count 
FROM storage.objects 
WHERE bucket_id = 'documents';

-- Test 6: Admin should see all documents
SELECT 'Test 6: Admin document access' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "55555555-5555-5555-5555-555555555555"}';

-- Should return 2 rows (all PDFs)
SELECT COUNT(*) as admin_document_count 
FROM storage.objects 
WHERE bucket_id = 'documents';

-- Test 7: Cross-outlet access should be denied
SELECT 'Test 7: Cross-outlet access denial' as test_name;
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';

-- KAR manager trying to access MUM image - should return 0
SELECT COUNT(*) as cross_outlet_access_count 
FROM storage.objects 
WHERE bucket_id = 'inventory-images' 
AND name = '22222222-2222-2222-2222-222222222222/ITEM-002/image2.jpg';

-- Cleanup
DELETE FROM storage.objects WHERE bucket_id IN ('inventory-images', 'documents');
DELETE FROM public.invoices WHERE id IN ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999');
DELETE FROM public.customers WHERE id IN ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777');
DELETE FROM public.user_profiles WHERE id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');
DELETE FROM auth.users WHERE id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');
DELETE FROM public.locations WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

ROLLBACK;

-- Expected Results:
-- Test 1: kar_manager_inventory_count = 1
-- Test 2: mum_manager_inventory_count = 1  
-- Test 3: admin_inventory_count = 2
-- Test 4: kar_manager_document_count = 1
-- Test 5: mum_manager_document_count = 1
-- Test 6: admin_document_count = 2
-- Test 7: cross_outlet_access_count = 0
