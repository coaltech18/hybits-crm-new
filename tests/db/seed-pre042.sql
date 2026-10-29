-- =====================================================================
-- Harness seed: production-like data in the post-041 schema, applied
-- BEFORE 042 so 042's backfills / repairs / index builds run on real rows
-- (production was not empty when 042 was applied). Committed (no
-- rollback); later steps and smoke checks rely on these fixed ids.
-- Runs as the owner (RLS bypassed) with the admin's JWT so created_by
-- triggers see a user.
-- =====================================================================
BEGIN;

SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

INSERT INTO auth.users (id, aud, role, email, last_sign_in_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'seed-admin@example.invalid', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'seed-mgr@example.invalid',   now() - interval '2 day'),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'seed-acct@example.invalid',  NULL),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'seed-mgr2@example.invalid',  NULL);

INSERT INTO user_profiles (id, email, full_name, role, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'seed-admin@example.invalid', 'Seed Admin',      'admin',      true),
  ('a0000000-0000-0000-0000-000000000002', 'seed-mgr@example.invalid',   'Seed Manager',    'manager',    true),
  ('a0000000-0000-0000-0000-000000000003', 'seed-acct@example.invalid',  'Seed Accountant', 'accountant', true),
  ('a0000000-0000-0000-0000-000000000004', 'seed-mgr2@example.invalid',  'Seed Manager 2',  'manager',    true);

INSERT INTO outlets (id, name, code, gstin) VALUES
  ('b0000000-0000-0000-0000-00000000000a', 'Seed Outlet A', 'SA',  '29AAAAA0000A1Z5'),
  ('b0000000-0000-0000-0000-00000000000b', 'Seed Outlet B', 'SB',  NULL);

-- manager 1 -> A only; manager 2 -> A and B
INSERT INTO user_outlet_assignments (user_id, outlet_id) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000a'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000b');

INSERT INTO clients (id, outlet_id, client_type, name, phone, gstin, billing_address, gst_type) VALUES
  ('c0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'corporate', 'Seed Corp A1', '9000000001', '29BBBBB0000B1Z5', 'Addr A1', 'domestic'),
  ('c0000000-0000-0000-0000-0000000000a2', 'b0000000-0000-0000-0000-00000000000a', 'corporate', 'Seed SEZ A2',  '9000000002', '29CCCCC0000C1Z5', 'Addr A2', 'sez'),
  ('c0000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-00000000000a', 'event',     'Seed Event A3','9000000003', NULL, NULL, NULL),
  ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'corporate', 'Seed Corp B1', '9000000004', NULL, 'Addr B1', NULL);

INSERT INTO subscriptions (id, outlet_id, client_id, billing_cycle, billing_day, start_date, quantity, price_per_unit, next_billing_date) VALUES
  ('d0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1', 'monthly', 1, '2025-06-01', 100, 10, '2025-07-01');
-- price change -> subscription_price_history row with changed_by
UPDATE subscriptions SET price_per_unit = 12, price_change_reason = 'Annual revision'
WHERE id = 'd0000000-0000-0000-0000-0000000000a1';

INSERT INTO events (id, outlet_id, client_id, event_name, event_date, status) VALUES
  ('e0000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a3', 'Seed Wedding', '2025-08-10', 'planned');

-- ---- invoices issued under the pre-042 numbering (038) ----
DO $$
DECLARE v_inv uuid;
BEGIN
  -- finalized outlet_short at A, then paid in part
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at, subtotal, tax_total, grand_total)
  VALUES ('f0000000-0000-0000-0000-000000000001', 'subscription', 'c0000000-0000-0000-0000-0000000000a1',
          'b0000000-0000-0000-0000-00000000000a', 'draft', 'outlet_short', '2025-09-01', 1200, 216, 1416);
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-000000000001', 'Plates Sep', 100, 12, 1200, 18, 216);
  UPDATE invoices SET status = 'finalized' WHERE id = 'f0000000-0000-0000-0000-000000000001';
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES ('f0000000-0000-0000-0000-000000000001', 500, 'upi', '2025-09-05');

  -- finalized SEZ invoice at A (fy_only), fully paid
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status, invoice_number_format, issued_at, subtotal, tax_total, grand_total)
  VALUES ('f0000000-0000-0000-0000-000000000002', 'subscription', 'c0000000-0000-0000-0000-0000000000a2',
          'b0000000-0000-0000-0000-00000000000a', 'draft', 'fy_only', '2025-10-01', 1000, 0, 1000);
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-000000000002', 'SEZ supply', 10, 100, 1000, 0, 0);
  UPDATE invoices SET status = 'finalized' WHERE id = 'f0000000-0000-0000-0000-000000000002';
  INSERT INTO payments (invoice_id, amount, payment_method, payment_date)
  VALUES ('f0000000-0000-0000-0000-000000000002', 1000, 'bank_transfer', '2025-10-03');

  -- finalized default-format invoice at B (client with NULL gst_type)
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status, issued_at, subtotal, tax_total, grand_total)
  VALUES ('f0000000-0000-0000-0000-000000000003', 'subscription', 'c0000000-0000-0000-0000-0000000000b1',
          'b0000000-0000-0000-0000-00000000000b', 'draft', '2025-11-01', 500, 90, 590);
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-000000000003', 'Bowls', 50, 10, 500, 18, 90);
  UPDATE invoices SET status = 'finalized' WHERE id = 'f0000000-0000-0000-0000-000000000003';

  -- a draft with items left open (pre-042 these items could not be deleted)
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, status, invoice_number_format, subtotal, tax_total, grand_total)
  VALUES ('f0000000-0000-0000-0000-000000000004', 'subscription', 'c0000000-0000-0000-0000-0000000000a1',
          'b0000000-0000-0000-0000-00000000000a', 'draft', 'fy_only', 120, 21.6, 141.6);  -- outlet_short would hit the very pre-042 day-reset collision
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-000000000004', 'Draft line', 10, 12, 120, 18, 21.6);

END $$;

-- ---- inventory: stock in, dispatch to the event, partial return ----
INSERT INTO inventory_items (id, outlet_id, name, category, unit, total_quantity, available_quantity, lifecycle_status)
VALUES ('10000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000a', 'Seed Steel Plate', 'Plate', 'pcs', 0, 0, 'active');

INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reason_code, notes, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'stock_in', 100, 'manual', 'purchase', 'Opening purchase',
        'a0000000-0000-0000-0000-000000000001');
INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reference_id, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'allocation', 40, 'event',
        'e0000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001');
INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reference_id, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'return', 30, 'event',
        'e0000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001');

UPDATE events SET status = 'completed' WHERE id = 'e0000000-0000-0000-0000-0000000000a3';

DO $$
BEGIN
  -- event invoice (finalized) for the event client
  INSERT INTO invoices (id, invoice_type, client_id, outlet_id, event_id, status, issued_at, subtotal, tax_total, grand_total)
  VALUES ('f0000000-0000-0000-0000-000000000005', 'event', 'c0000000-0000-0000-0000-0000000000a3',
          'b0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000a3', 'draft', '2025-08-11', 300, 54, 354);
  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total, tax_rate, tax_amount)
  VALUES ('f0000000-0000-0000-0000-000000000005', 'Event plates', 30, 10, 300, 18, 54);
  UPDATE invoices SET status = 'finalized' WHERE id = 'f0000000-0000-0000-0000-000000000005';
END $$;

-- ---- phantom "dishware kit" allocations (old kit code: allocation rows
--      with no outflow movement) -> repaired by 042 E4b ----
INSERT INTO subscriptions (id, outlet_id, client_id, billing_cycle, billing_day, start_date, quantity, price_per_unit, next_billing_date, questionnaire) VALUES
  ('d0000000-0000-0000-0000-0000000000a2', 'b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1', 'weekly', NULL, '2025-07-01', 10, 50, '2025-07-08', '{"notes":"kit only"}'),
  ('d0000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a2', 'monthly', 1, '2025-07-01', 5, 80, '2025-08-01', NULL);
-- sub a2: kit only, never dispatched
INSERT INTO inventory_allocations (outlet_id, inventory_item_id, reference_type, reference_id, allocated_quantity, is_active)
VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'subscription', 'd0000000-0000-0000-0000-0000000000a2', 25, true);
-- sub a3: 5 really dispatched, then the kit code bumped the row by 15
INSERT INTO inventory_movements (outlet_id, inventory_item_id, movement_type, quantity, reference_type, reference_id, created_by)
VALUES ('b0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1', 'allocation', 5, 'subscription',
        'd0000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001');
UPDATE inventory_allocations SET allocated_quantity = allocated_quantity + 15
WHERE reference_type = 'subscription' AND reference_id = 'd0000000-0000-0000-0000-0000000000a3';

COMMIT;
