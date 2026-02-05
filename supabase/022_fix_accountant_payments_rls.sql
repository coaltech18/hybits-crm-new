-- ================================================================
-- MIGRATION 022: Fix Accountant Payments RLS Policy
-- ================================================================
-- Issue: Accountants were granted FULL ACCESS (INSERT/UPDATE/DELETE)
-- to payments table, but they should only have READ-ONLY access.
--
-- This migration:
--   1. Drops the incorrect "accountants_full_access_payments" policy
--   2. Creates correct "accountants_readonly_all_payments" policy
--
-- Accountant Role Clarification:
--   - ONE type of accountant (no sub-types)
--   - READ-ONLY access to ALL outlets (no outlet restriction)
--   - NO entries in user_outlet_assignments
--   - Can view all financial data for reporting
-- ================================================================

-- Step 1: Drop the incorrect policy
DROP POLICY IF EXISTS "accountants_full_access_payments" ON payments;

-- Step 2: Create correct read-only policy
CREATE POLICY "accountants_readonly_all_payments"
ON payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() 
      AND role = 'accountant' 
      AND is_active = true
  )
);

-- ================================================================
-- VERIFICATION QUERY (Run after migration)
-- ================================================================
-- This query should show the new policy:
--
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE tablename = 'payments' AND policyname LIKE '%accountant%';
--
-- Expected result:
-- policyname                        | cmd
-- ----------------------------------|--------
-- accountants_readonly_all_payments | SELECT
-- ================================================================

-- ================================================================
-- END OF MIGRATION 022
-- ================================================================
