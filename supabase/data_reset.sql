-- ================================================================
-- DATA-ONLY RESET SCRIPT FOR HYBITS CRM
-- ================================================================
-- Purpose: Delete all transactional and test data while preserving:
--   - Database schema (tables, views, functions, triggers)
--   - All RLS policies
--   - Migrations structure
--   - Admin user only
--
-- EXECUTION ORDER IS CRITICAL due to foreign key constraints
-- Run this in Supabase SQL Editor with admin privileges
-- ================================================================

-- Start transaction for safety
BEGIN;

-- ================================================================
-- STEP 1: DELETE INVENTORY DATA (Most dependent)
-- ================================================================
-- Delete in correct order: movements → allocations → items

DELETE FROM inventory_movements;
DELETE FROM inventory_allocations;
DELETE FROM inventory_items;

-- ================================================================
-- STEP 2: DELETE PAYMENT DATA
-- ================================================================

DELETE FROM payments;

-- ================================================================
-- STEP 3: DELETE INVOICE DATA
-- ================================================================
-- Delete items first, then invoices

DELETE FROM invoice_items;
DELETE FROM invoices;

-- ================================================================
-- STEP 4: DELETE EVENT DATA
-- ================================================================

DELETE FROM events;

-- ================================================================
-- STEP 5: DELETE SUBSCRIPTION DATA
-- ================================================================

DELETE FROM subscriptions;

-- ================================================================
-- STEP 6: DELETE CLIENT DATA
-- ================================================================

DELETE FROM clients;

-- ================================================================
-- STEP 7: DELETE OUTLET ASSIGNMENTS
-- ================================================================
-- This removes manager-to-outlet mappings

DELETE FROM user_outlet_assignments;

-- ================================================================
-- STEP 8: DELETE USER PROFILES (EXCEPT ADMIN)
-- ================================================================
-- Keep only admin users in user_profiles
-- This preserves the admin role for system access

DELETE FROM user_profiles 
WHERE role != 'admin';

-- ================================================================
-- STEP 9: DELETE OUTLETS
-- ================================================================
-- Clear all outlets (admin can recreate them)

DELETE FROM outlets;

-- ================================================================
-- STEP 10: VERIFY DATA RESET
-- ================================================================
-- Display counts to confirm reset

SELECT 'inventory_movements' AS table_name, COUNT(*) AS row_count FROM inventory_movements
UNION ALL
SELECT 'inventory_allocations', COUNT(*) FROM inventory_allocations
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'user_outlet_assignments', COUNT(*) FROM user_outlet_assignments
UNION ALL
SELECT 'outlets', COUNT(*) FROM outlets
UNION ALL
SELECT 'user_profiles (should be >= 1 admin)', COUNT(*) FROM user_profiles;

-- ================================================================
-- COMMIT THE TRANSACTION
-- ================================================================
-- Uncomment the line below to commit the changes
-- If you want to review first, leave it commented and use ROLLBACK instead

COMMIT;

-- ================================================================
-- POST-RESET NOTES
-- ================================================================
-- After running this script:
-- 
-- 1. Verify admin user exists:
--    SELECT id, email, full_name, role FROM user_profiles WHERE role = 'admin';
--
-- 2. If no admin exists, create one:
--    - First sign up via Supabase Auth (creates auth.users entry)
--    - Then insert into user_profiles:
--    INSERT INTO user_profiles (id, email, full_name, role)
--    VALUES ('auth-user-uuid-here', 'admin@hybits.com', 'Admin User', 'admin');
--
-- 3. Create initial outlets for testing:
--    INSERT INTO outlets (name, code, city, state, gstin)
--    VALUES ('Test Outlet 1', 'HYB-TEST-01', 'Mumbai', 'Maharashtra', NULL);
--
-- 4. Assign managers to outlets as needed:
--    INSERT INTO user_outlet_assignments (user_id, outlet_id)
--    VALUES ('<manager-user-id>', '<outlet-id>');
-- ================================================================
