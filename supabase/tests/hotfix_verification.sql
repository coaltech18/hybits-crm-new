-- ===================================================================
-- HOTFIX VERIFICATION — Database Schema Checks
-- Run these queries in Supabase SQL Editor or psql
-- ===================================================================

-- A.1: Customer outlet filter check
-- Expected: All customers have outlet_id populated
SELECT 
  id, 
  customer_code,
  contact_person as name, 
  outlet_id,
  created_at
FROM public.customers 
ORDER BY created_at DESC 
LIMIT 10;

-- A.2: Invoice created has customer_id populated
-- Expected: customer_id is NOT NULL for all recent invoices
SELECT 
  id, 
  invoice_number, 
  customer_id, 
  outlet_id,
  subtotal, 
  total_amount,
  created_at
FROM public.invoices
ORDER BY created_at DESC 
LIMIT 10;

-- A.3: Invoice PDF fields exist
-- Expected: invoice_pdf_url and invoice_pdf_key populated after PDF generation
SELECT 
  id, 
  invoice_number,
  invoice_pdf_url, 
  invoice_pdf_key,
  updated_at
FROM public.invoices
WHERE invoice_pdf_url IS NOT NULL
ORDER BY updated_at DESC 
LIMIT 5;

-- A.4: Inventory storage objects sample (requires service role)
-- Expected: Paths follow format {outlet_id}/{item_code}/{filename}
-- Note: Run this with service_role key or in Supabase Dashboard > Storage
SELECT 
  name, 
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'inventory-images' 
ORDER BY created_at DESC
LIMIT 20;

-- A.5: Verify outlet isolation - Count customers per outlet
SELECT 
  l.code as outlet_code,
  l.name as outlet_name,
  COUNT(c.id) as customer_count
FROM public.locations l
LEFT JOIN public.customers c ON c.outlet_id = l.id
GROUP BY l.id, l.code, l.name
ORDER BY customer_count DESC;

-- A.6: Verify invoice outlet isolation
SELECT 
  l.code as outlet_code,
  l.name as outlet_name,
  COUNT(i.id) as invoice_count,
  SUM(i.total_amount) as total_revenue
FROM public.locations l
LEFT JOIN public.invoices i ON i.outlet_id = l.id
GROUP BY l.id, l.code, l.name
ORDER BY invoice_count DESC;

-- A.7: Check for orphaned records (customers/invoices without outlet_id)
-- Expected: Should return 0 rows (or NULL outlet_id should be intentional)
SELECT 'customers' as table_name, COUNT(*) as null_outlet_count
FROM public.customers WHERE outlet_id IS NULL
UNION ALL
SELECT 'invoices' as table_name, COUNT(*) as null_outlet_count
FROM public.invoices WHERE outlet_id IS NULL;

-- A.8: Verify user_profiles outlet assignments
SELECT 
  up.id as user_id,
  up.email,
  up.role,
  up.outlet_id,
  l.code as outlet_code,
  l.name as outlet_name
FROM public.user_profiles up
LEFT JOIN public.locations l ON l.id = up.outlet_id
ORDER BY up.created_at DESC
LIMIT 20;

