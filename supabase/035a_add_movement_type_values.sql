-- ================================================================
-- MIGRATION 035a: ADD MISSING movement_type ENUM VALUES
-- ================================================================
-- RUN THIS FIRST (alone), then run 035b.
-- Postgres requires ALTER TYPE ADD VALUE to commit before the new
-- values can be used in DML — same pattern as 030a/030b.
--
-- BUG:
--   The movement_type enum (008) only has:
--     stock_in, allocation, return, damage, loss, adjustment
--   but the V2 frontend services insert:
--     'return_damaged'      (ReceiveBackModal, damaged return)
--     'disposal'            (DisposeDamagedModal)
--     'send_to_repair'      (repair flow)
--     'return_from_repair'  (repair flow)
--   Those inserts currently FAIL with a raw enum error, so damaged
--   returns, disposals, and the repair flow are broken in the UI.
-- ================================================================

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'return_damaged';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'disposal';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'send_to_repair';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'return_from_repair';

-- ================================================================
-- VERIFY: after this completes, run:
--   SELECT unnest(enum_range(NULL::movement_type));
-- Expected: stock_in, allocation, return, damage, loss, adjustment,
--           return_damaged, disposal, send_to_repair, return_from_repair
-- ================================================================
