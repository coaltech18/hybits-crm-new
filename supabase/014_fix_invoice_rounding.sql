-- ================================================================
-- FIX INVOICE CALCULATION ROUNDING
-- ================================================================
-- This migration fixes rounding constraints on invoice_items to ensure
-- decimal-safe arithmetic matches the application logic.
--
-- Problem:
-- - CHECK constraint `line_total = quantity * unit_price` fails when
--   the multiplication produces floating-point precision errors
-- - Also needs to ensure proper 2-decimal rounding
--
-- Solution:
-- - Use ROUND(..., 2) in constraints to match application logic
-- - Ensure all values are properly rounded to 2 decimal places
-- ================================================================

-- ================================================================
-- 1. DROP OLD CONSTRAINTS
-- ================================================================

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_line_total_matches;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_tax_matches;

-- ================================================================
-- 2. ADD NEW ROUNDED CONSTRAINTS
-- ================================================================

-- Rule 1: line_total = ROUND(quantity * unit_price, 2)
-- This allows for proper 2-decimal rounding
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_line_total_matches
  CHECK (line_total = ROUND(quantity * unit_price, 2));

-- Rule 2: tax_amount = ROUND(line_total * (tax_rate / 100), 2)
-- Tax is calculated from the ALREADY ROUNDED line_total
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_tax_matches
  CHECK (tax_amount = ROUND(line_total * (tax_rate / 100), 2));

-- ================================================================
-- 3. ADD HELPER FUNCTION FOR CONSISTENT ROUNDING
-- ================================================================

-- Helper function to round currency values consistently
CREATE OR REPLACE FUNCTION round_currency(amount NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND(amount, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- END OF MIGRATION
-- ================================================================

-- Summary:
-- ✅ Fixed line_total constraint to use ROUND(quantity * unit_price, 2)
-- ✅ Tax constraint now explicitly requires rounded line_total
-- ✅ Added round_currency helper function for consistency
--
-- Calculation rules enforced:
-- 1. line_total = ROUND(qty * unit_price, 2)
-- 2. tax_amount = ROUND(line_total * (tax_rate / 100), 2)
-- 3. subtotal = SUM(line_total) -- summed at application level
-- 4. tax_total = SUM(tax_amount) -- summed at application level
-- 5. grand_total = subtotal + tax_total
