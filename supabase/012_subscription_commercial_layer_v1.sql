-- ================================================================
-- SUBSCRIPTION COMMERCIAL LAYER V1 - DATABASE SCHEMA
-- ================================================================
-- 
-- PURPOSE:
-- - Add questionnaire JSONB field for reference data
-- - Add price_change_reason field for trigger-based audit
-- - Create price change audit trail table
-- - Add trigger for automatic price history tracking
-- - Set up RLS for price history
--
-- DESIGN DECISIONS:
-- - Single composite manual price (price_per_unit)
-- - Questionnaire is reference-only (no validation)
-- - Price history is append-only
-- - Trigger reads price_change_reason from UPDATE payload
-- - price_change_reason is cleared by trigger (never persisted)
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ================================================================

-- ================================================================
-- STEP 1: EXTEND SUBSCRIPTIONS TABLE
-- ================================================================

-- Add questionnaire JSONB column for storing client survey/reference data
-- This is reference-only in V1 - NOT used for price calculation
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS questionnaire JSONB;

COMMENT ON COLUMN subscriptions.questionnaire IS 
  'Client questionnaire data for reference, ops planning, ESG context. NOT used for price calculation in V1.';

-- Add price_change_reason column for trigger-based audit
-- This column is used to pass the reason from service to trigger
-- The trigger CLEARS this field before the row is persisted
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS price_change_reason TEXT;

COMMENT ON COLUMN subscriptions.price_change_reason IS 
  'Transient field: Used to pass price change reason to trigger. Always NULL in stored data.';

-- ================================================================
-- STEP 2: CREATE SUBSCRIPTION_PRICE_HISTORY TABLE
-- ================================================================
-- Append-only audit trail for price changes
-- Initial subscription creation does NOT create history (trigger handles updates only)

CREATE TABLE IF NOT EXISTS subscription_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_price numeric NOT NULL,
  new_price numeric NOT NULL,
  changed_by uuid REFERENCES user_profiles(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups by subscription
CREATE INDEX IF NOT EXISTS idx_subscription_price_history_subscription_id 
  ON subscription_price_history(subscription_id);

-- Index for efficient lookups by changed_by (for audit queries)
CREATE INDEX IF NOT EXISTS idx_subscription_price_history_changed_by 
  ON subscription_price_history(changed_by);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_subscription_price_history_created_at 
  ON subscription_price_history(created_at DESC);

COMMENT ON TABLE subscription_price_history IS 
  'Append-only audit trail for subscription price changes. No updates or deletes allowed.';

-- ================================================================
-- STEP 3: PRICE CHANGE TRIGGER (BEFORE UPDATE)
-- ================================================================
-- Fires ONLY when price_per_unit actually changes
-- Reads reason from NEW.price_change_reason (passed by service layer)
-- Clears price_change_reason so it's never persisted

-- Drop existing trigger if it exists (to update the logic)
DROP TRIGGER IF EXISTS trg_subscription_price_change ON subscriptions;
DROP FUNCTION IF EXISTS log_subscription_price_change();

-- Create function to handle price change logging
CREATE OR REPLACE FUNCTION log_subscription_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if price actually changed
  -- Using IS DISTINCT FROM to handle NULL comparisons correctly
  IF OLD.price_per_unit IS DISTINCT FROM NEW.price_per_unit THEN
    -- Insert into price history
    -- Reason comes from the UPDATE payload via NEW.price_change_reason
    INSERT INTO subscription_price_history (
      subscription_id,
      old_price,
      new_price,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      COALESCE(OLD.price_per_unit, 0),
      COALESCE(NEW.price_per_unit, 0),
      auth.uid(),
      COALESCE(NEW.price_change_reason, 'Price updated')
    );
  END IF;
  
  -- CRITICAL: Always clear price_change_reason so it's never persisted
  -- This makes it a "virtual" field that only exists during the transaction
  NEW.price_change_reason := NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on subscriptions table (BEFORE UPDATE - so we can modify NEW)
CREATE TRIGGER trg_subscription_price_change
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION log_subscription_price_change();

COMMENT ON FUNCTION log_subscription_price_change() IS 
  'Logs price changes to subscription_price_history. Reads reason from NEW.price_change_reason, then clears it.';

-- ================================================================
-- STEP 4: RLS POLICIES FOR SUBSCRIPTION_PRICE_HISTORY
-- ================================================================

-- Enable RLS
ALTER TABLE subscription_price_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "admin_read_all_price_history" ON subscription_price_history;
DROP POLICY IF EXISTS "manager_read_assigned_outlet_price_history" ON subscription_price_history;
DROP POLICY IF EXISTS "accountant_read_all_price_history" ON subscription_price_history;

-- Policy: Admin can read all price history
CREATE POLICY "admin_read_all_price_history"
  ON subscription_price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- Policy: Manager can read price history for subscriptions in their assigned outlets
CREATE POLICY "manager_read_assigned_outlet_price_history"
  ON subscription_price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.is_active = true
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        JOIN user_outlet_assignments uoa ON uoa.outlet_id = s.outlet_id
        WHERE s.id = subscription_price_history.subscription_id
        AND uoa.user_id = auth.uid()
      )
    )
  );

-- Policy: Accountant can read all price history (read-only role)
CREATE POLICY "accountant_read_all_price_history"
  ON subscription_price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'accountant'
      AND is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users
-- Writes are handled via trigger (SECURITY DEFINER) which bypasses RLS

-- ================================================================
-- STEP 5: PREVENT UPDATES AND DELETES ON PRICE HISTORY
-- ================================================================
-- Append-only enforcement via trigger

-- Drop existing triggers/functions for idempotency
DROP TRIGGER IF EXISTS trg_prevent_price_history_update ON subscription_price_history;
DROP TRIGGER IF EXISTS trg_prevent_price_history_delete ON subscription_price_history;
DROP FUNCTION IF EXISTS prevent_price_history_modification();

CREATE OR REPLACE FUNCTION prevent_price_history_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'subscription_price_history is append-only. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Prevent updates
CREATE TRIGGER trg_prevent_price_history_update
  BEFORE UPDATE ON subscription_price_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_price_history_modification();

-- Prevent deletes (except cascade from subscription deletion)
CREATE TRIGGER trg_prevent_price_history_delete
  BEFORE DELETE ON subscription_price_history
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)  -- Allow cascade deletes, block direct deletes
  EXECUTE FUNCTION prevent_price_history_modification();

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these to verify the migration was successful:

-- 1. Check questionnaire and price_change_reason columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN ('questionnaire', 'price_change_reason');

-- 2. Check subscription_price_history table exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscription_price_history'
ORDER BY ordinal_position;

-- 3. Check triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing
FROM information_schema.triggers 
WHERE event_object_table IN ('subscriptions', 'subscription_price_history')
ORDER BY event_object_table, trigger_name;

-- 4. Check RLS policies
SELECT 
  tablename, 
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'subscription_price_history';

-- ================================================================
-- END OF MIGRATION
-- ================================================================
