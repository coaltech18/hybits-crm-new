-- ================================================================
-- FIX: Add created_by column to outlets and user_profiles tables
-- ================================================================
-- ISSUE: Frontend services send created_by but columns don't exist
-- SOLUTION: Add created_by for audit trail consistency with other tables
-- 
-- RUN THIS IN SUPABASE SQL EDITOR
-- ================================================================

-- ================================================================
-- STEP 1: Add created_by to OUTLETS table
-- ================================================================

-- Add created_by column to outlets table
ALTER TABLE outlets 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_outlets_created_by ON outlets(created_by);

-- Add trigger for created_by (uses existing function from Phase 2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_outlets_created_by' 
    AND tgrelid = 'outlets'::regclass
  ) THEN
    CREATE TRIGGER set_outlets_created_by
      BEFORE INSERT OR UPDATE ON outlets
      FOR EACH ROW
      EXECUTE FUNCTION set_created_by();
  END IF;
END $$;

-- ================================================================
-- STEP 2: Add created_by to USER_PROFILES table
-- ================================================================

-- Add created_by column to user_profiles table
-- Note: This is optional for user_profiles since self-registration doesn't have a creator
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by ON user_profiles(created_by);

-- Note: We don't add the set_created_by trigger to user_profiles because:
-- 1. Users can self-register (no creator)
-- 2. The trigger uses auth.uid() which might cause circular references
-- 3. created_by for user_profiles is optional and set manually when admin creates user

-- ================================================================
-- VERIFICATION
-- ================================================================
-- Run this to confirm the columns were added:
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('outlets', 'user_profiles')
  AND column_name = 'created_by'
ORDER BY table_name;

-- ================================================================
-- END OF FIX
-- ================================================================

