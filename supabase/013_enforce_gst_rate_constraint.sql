-- ================================================================
-- MIGRATION 013: ENFORCE GST RATE CONSTRAINT
-- ================================================================
-- This migration adds a CHECK constraint to invoice_items.tax_rate
-- to ensure only valid Indian GST rates are allowed: 0%, 5%, 12%, 18%
--
-- Reason:
--   - Previously, tax_rate accepted any numeric value 0-100
--   - This caused data inconsistency and user errors
--   - Indian GST regulations only allow these specific rates
-- ================================================================

-- ================================================================
-- 1. ADD CHECK CONSTRAINT FOR ALLOWED GST RATES
-- ================================================================

-- First, verify no existing data violates the constraint
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM invoice_items
  WHERE tax_rate NOT IN (0, 5, 12, 18);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % invoice items with non-standard GST rates. These will need to be corrected before the constraint can be enforced.', invalid_count;
    
    -- Update existing invalid rates to closest allowed value
    -- 0-2.5 -> 0, 2.5-8.5 -> 5, 8.5-15 -> 12, 15+ -> 18
    UPDATE invoice_items
    SET tax_rate = CASE
      WHEN tax_rate < 2.5 THEN 0
      WHEN tax_rate < 8.5 THEN 5
      WHEN tax_rate < 15 THEN 12
      ELSE 18
    END
    WHERE tax_rate NOT IN (0, 5, 12, 18);
    
    RAISE NOTICE 'Corrected % invoice items to use standard GST rates.', invalid_count;
  END IF;
END $$;

-- Drop the old constraint if it exists (for re-runnability)
ALTER TABLE invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_valid_gst_rate;

-- Add the new constraint for allowed GST rates
ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_valid_gst_rate
  CHECK (tax_rate IN (0, 5, 12, 18));

-- ================================================================
-- 2. ADD COMMENT FOR DOCUMENTATION
-- ================================================================

COMMENT ON CONSTRAINT invoice_items_valid_gst_rate ON invoice_items IS 
  'Enforces valid Indian GST rates: 0% (exempt), 5% (essential), 12% (standard), 18% (luxury/services)';

COMMENT ON COLUMN invoice_items.tax_rate IS 
  'GST tax rate percentage. Must be one of: 0, 5, 12, 18 (Indian GST slabs)';

-- ================================================================
-- END OF MIGRATION 013
-- ================================================================

-- Migration Summary:
-- ✅ Added CHECK constraint to enforce GST rates: 0%, 5%, 12%, 18%
-- ✅ Auto-corrects any existing non-standard rates
-- ✅ Added documentation comments
