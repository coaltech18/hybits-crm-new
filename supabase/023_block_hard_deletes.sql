-- ============================================================================
-- MIGRATION: 023_block_hard_deletes.sql
-- ============================================================================
-- PURPOSE: Enforce deletion rules at DATABASE LEVEL
-- 
-- BUSINESS RATIONALE:
-- - This is a billing & GST system
-- - Hard deletes are NOT allowed for audit/legal compliance
-- - Database is the final authority - UI bugs cannot destroy data
--
-- RULES:
-- 1. clients          → BLOCK ALWAYS
-- 2. subscriptions    → BLOCK ALWAYS  
-- 3. events           → CONDITIONAL (block if has invoices)
-- 4. invoices         → BLOCK ALWAYS (GST legal document)
-- 5. inventory_items  → CONDITIONAL (block if has movements)
-- 6. inventory_movements → BLOCK ALWAYS
-- 7. payments         → BLOCK ALWAYS
--
-- ============================================================================

-- ============================================================================
-- 1. CLIENTS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Clients are referenced by subscriptions, events, invoices.
-- Alternative: UPDATE clients SET is_active = false

CREATE OR REPLACE FUNCTION prevent_client_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Clients cannot be deleted. Use deactivate instead. Set is_active = false to deactivate a client.';
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS block_client_delete ON clients;

-- Create trigger
CREATE TRIGGER block_client_delete
    BEFORE DELETE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION prevent_client_delete();

COMMENT ON TRIGGER block_client_delete ON clients IS 
    'Prevents hard deletion of clients. Use UPDATE is_active = false instead.';

-- ============================================================================
-- 2. SUBSCRIPTIONS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Subscriptions generate invoices & payment history.
-- Alternative: UPDATE status = 'cancelled', set end_date

CREATE OR REPLACE FUNCTION prevent_subscription_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Subscriptions cannot be deleted. Cancel the subscription instead by setting status to cancelled and providing an end_date.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_subscription_delete ON subscriptions;

CREATE TRIGGER block_subscription_delete
    BEFORE DELETE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_subscription_delete();

COMMENT ON TRIGGER block_subscription_delete ON subscriptions IS 
    'Prevents hard deletion of subscriptions. Use UPDATE status = cancelled instead.';

-- ============================================================================
-- 3. EVENTS - CONDITIONAL DELETE
-- ============================================================================
-- Rules:
-- - If event has ANY invoice → BLOCK DELETE
-- - If event has NO invoice → ALLOW DELETE
-- Alternative: UPDATE status = 'cancelled' or 'archived'

CREATE OR REPLACE FUNCTION check_event_delete()
RETURNS TRIGGER AS $$
DECLARE
    invoice_count INTEGER;
BEGIN
    -- Check if event has any invoices
    SELECT COUNT(*) INTO invoice_count
    FROM invoices
    WHERE event_id = OLD.id;
    
    IF invoice_count > 0 THEN
        RAISE EXCEPTION 'This event has % invoice(s) and cannot be deleted. Archive or cancel the event instead.', invoice_count;
    END IF;
    
    -- No invoices - allow deletion
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_event_delete_allowed ON events;

CREATE TRIGGER check_event_delete_allowed
    BEFORE DELETE ON events
    FOR EACH ROW
    EXECUTE FUNCTION check_event_delete();

COMMENT ON TRIGGER check_event_delete_allowed ON events IS 
    'Allows event deletion only if no invoices exist. Otherwise blocks with helpful message.';

-- ============================================================================
-- 4. INVOICES - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Invoices are GST legal documents and cannot be deleted.
-- Alternative (future): Void, Cancel, or issue Credit Note

CREATE OR REPLACE FUNCTION prevent_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Invoices cannot be deleted. They are legal GST documents. Use void, cancel, or credit note functionality instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_invoice_delete ON invoices;

CREATE TRIGGER block_invoice_delete
    BEFORE DELETE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION prevent_invoice_delete();

COMMENT ON TRIGGER block_invoice_delete ON invoices IS 
    'Prevents hard deletion of invoices. Invoices are immutable GST legal documents.';

-- ============================================================================
-- 5. INVOICE ITEMS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Invoice items are part of the invoice (legal document)
-- They should not be deleted independently

CREATE OR REPLACE FUNCTION prevent_invoice_item_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Invoice items cannot be deleted. They are part of a legal GST document.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_invoice_item_delete ON invoice_items;

CREATE TRIGGER block_invoice_item_delete
    BEFORE DELETE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_invoice_item_delete();

COMMENT ON TRIGGER block_invoice_item_delete ON invoice_items IS 
    'Prevents hard deletion of invoice items. They are part of immutable invoices.';

-- ============================================================================
-- 6. INVENTORY ITEMS - CONDITIONAL DELETE
-- ============================================================================
-- Rules:
-- - If NO inventory_movements → ALLOW DELETE
-- - If ANY movement exists → BLOCK DELETE
-- Alternative: UPDATE is_active = false

CREATE OR REPLACE FUNCTION check_inventory_item_delete()
RETURNS TRIGGER AS $$
DECLARE
    movement_count INTEGER;
BEGIN
    -- Check if item has any movements
    SELECT COUNT(*) INTO movement_count
    FROM inventory_movements
    WHERE item_id = OLD.id;
    
    IF movement_count > 0 THEN
        RAISE EXCEPTION 'This inventory item has % movement record(s) and cannot be deleted. Mark the item as inactive instead by setting is_active = false.', movement_count;
    END IF;
    
    -- No movements - allow deletion
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_inventory_item_delete_allowed ON inventory_items;

CREATE TRIGGER check_inventory_item_delete_allowed
    BEFORE DELETE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION check_inventory_item_delete();

COMMENT ON TRIGGER check_inventory_item_delete_allowed ON inventory_items IS 
    'Allows inventory item deletion only if no movements exist. Otherwise blocks with helpful message.';

-- ============================================================================
-- 7. INVENTORY MOVEMENTS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Movement history is audit-critical and must be preserved.

CREATE OR REPLACE FUNCTION prevent_inventory_movement_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Inventory movements cannot be deleted. Movement history is required for audit purposes.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_inventory_movement_delete ON inventory_movements;

CREATE TRIGGER block_inventory_movement_delete
    BEFORE DELETE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_movement_delete();

COMMENT ON TRIGGER block_inventory_movement_delete ON inventory_movements IS 
    'Prevents hard deletion of inventory movements. Audit history must be preserved.';

-- ============================================================================
-- 8. PAYMENTS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Financial audit integrity - payments are legal records.

CREATE OR REPLACE FUNCTION prevent_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Payments cannot be deleted. They are financial records required for audit. Use refund or adjustment functionality instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_payment_delete ON payments;

CREATE TRIGGER block_payment_delete
    BEFORE DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_payment_delete();

COMMENT ON TRIGGER block_payment_delete ON payments IS 
    'Prevents hard deletion of payments. Financial records must be preserved for audit.';

-- ============================================================================
-- 9. PAYMENT ALLOCATIONS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Payment allocations link payments to invoices - audit critical

CREATE OR REPLACE FUNCTION prevent_payment_allocation_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Payment allocations cannot be deleted. They are part of the financial audit trail.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_payment_allocation_delete ON payment_allocations;

CREATE TRIGGER block_payment_allocation_delete
    BEFORE DELETE ON payment_allocations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_payment_allocation_delete();

COMMENT ON TRIGGER block_payment_allocation_delete ON payment_allocations IS 
    'Prevents hard deletion of payment allocations. Audit trail must be preserved.';

-- ============================================================================
-- 10. USER PROFILES - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: User profiles are referenced in audit trails (created_by, updated_by)

CREATE OR REPLACE FUNCTION prevent_user_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'User profiles cannot be deleted. Deactivate the user instead by setting is_active = false.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_user_profile_delete ON user_profiles;

CREATE TRIGGER block_user_profile_delete
    BEFORE DELETE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_profile_delete();

COMMENT ON TRIGGER block_user_profile_delete ON user_profiles IS 
    'Prevents hard deletion of user profiles. Use is_active = false to deactivate.';

-- ============================================================================
-- 11. OUTLETS - BLOCK DELETE ALWAYS
-- ============================================================================
-- Reason: Outlets are referenced by clients, subscriptions, events, invoices

CREATE OR REPLACE FUNCTION prevent_outlet_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Outlets cannot be deleted. Deactivate the outlet instead by setting is_active = false.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_outlet_delete ON outlets;

CREATE TRIGGER block_outlet_delete
    BEFORE DELETE ON outlets
    FOR EACH ROW
    EXECUTE FUNCTION prevent_outlet_delete();

COMMENT ON TRIGGER block_outlet_delete ON outlets IS 
    'Prevents hard deletion of outlets. Use is_active = false to deactivate.';

-- ============================================================================
-- VERIFICATION QUERIES (for testing - run manually)
-- ============================================================================
-- 
-- These queries should be run after applying the migration to verify triggers work:
--
-- TEST 1: Delete client (should FAIL)
-- DELETE FROM clients WHERE id = 'any-uuid' LIMIT 1;
-- Expected: "Clients cannot be deleted..."
--
-- TEST 2: Delete subscription (should FAIL)
-- DELETE FROM subscriptions WHERE id = 'any-uuid' LIMIT 1;
-- Expected: "Subscriptions cannot be deleted..."
--
-- TEST 3: Delete event with invoice (should FAIL)
-- DELETE FROM events WHERE id IN (SELECT DISTINCT event_id FROM invoices WHERE event_id IS NOT NULL LIMIT 1);
-- Expected: "This event has X invoice(s)..."
--
-- TEST 4: Delete event without invoice (should SUCCEED)
-- DELETE FROM events WHERE id NOT IN (SELECT DISTINCT event_id FROM invoices WHERE event_id IS NOT NULL);
-- Expected: Success (if such event exists)
--
-- TEST 5: Delete inventory item with movements (should FAIL)
-- DELETE FROM inventory_items WHERE id IN (SELECT DISTINCT item_id FROM inventory_movements LIMIT 1);
-- Expected: "This inventory item has X movement record(s)..."
--
-- TEST 6: Delete invoice (should FAIL)
-- DELETE FROM invoices WHERE id = 'any-uuid' LIMIT 1;
-- Expected: "Invoices cannot be deleted..."
--
-- TEST 7: Delete payment (should FAIL)
-- DELETE FROM payments WHERE id = 'any-uuid' LIMIT 1;
-- Expected: "Payments cannot be deleted..."
--
-- ============================================================================

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 
-- This migration creates the following protection:
--
-- | Table                | Delete Behavior      | Alternative Action          |
-- |----------------------|---------------------|----------------------------|
-- | clients              | BLOCKED ALWAYS      | is_active = false          |
-- | subscriptions        | BLOCKED ALWAYS      | status = 'cancelled'       |
-- | events               | CONDITIONAL*        | status = 'archived'        |
-- | invoices             | BLOCKED ALWAYS      | (future: void/cancel)      |
-- | invoice_items        | BLOCKED ALWAYS      | (part of invoice)          |
-- | inventory_items      | CONDITIONAL**       | is_active = false          |
-- | inventory_movements  | BLOCKED ALWAYS      | (audit history)            |
-- | payments             | BLOCKED ALWAYS      | (future: refund)           |
-- | payment_allocations  | BLOCKED ALWAYS      | (audit history)            |
-- | user_profiles        | BLOCKED ALWAYS      | is_active = false          |
-- | outlets              | BLOCKED ALWAYS      | is_active = false          |
--
-- * Events: Allowed if no invoices exist
-- ** Inventory Items: Allowed if no movements exist
--
-- ============================================================================
