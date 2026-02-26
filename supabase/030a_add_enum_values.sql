-- ================================================================
-- STEP 1 OF 2: ADD NEW ENUM VALUES
-- ================================================================
-- RUN THIS FIRST, then run 030b_migrate_data.sql
--
-- Postgres requires ALTER TYPE ADD VALUE to commit before
-- the new values can be used in DML statements.
-- ================================================================

ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'finalized';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'paid';

-- ================================================================
-- VERIFY: Run this after the above completes:
--   SELECT unnest(enum_range(NULL::invoice_status));
-- You should see: draft, issued, cancelled, finalized, partially_paid, paid
-- ================================================================
