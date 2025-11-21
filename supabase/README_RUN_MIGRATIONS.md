# Run Hybits CRM Supabase Migrations

This project includes SQL migrations for the Hybits CRM schema. Because migrations affect your Supabase database, run them manually in the Supabase SQL editor.

Steps:

1. Open Supabase Console → SQL Editor.

2. Copy the contents of supabase/migrations/001_full_production_schema.sql and run it. Wait until complete.

3. Copy the contents of supabase/migrations/002_entity_sequences_and_triggers.sql and run it. Wait until complete.

4. Verify (Optional but Recommended):

   - Run `supabase/verify_migrations.sql` in the SQL Editor to check all objects were created correctly
   
   - Or manually verify:
     - Tables exist (locations, user_profiles, customers, inventory_items, rental_orders, invoices, payments, vendors, vendor_subscriptions, vendor_payments, vendor_deposit_ledger, entity_sequences)
     - RLS policies are present and enabled
     - Triggers exist (on auth.users, inventory, invoices, payments etc.)
     - Bucket inventory-images exists in Storage and is private

5. Create test outlets (HYBITS-001, HYBITS-002) or let the triggers generate codes automatically and then update locations.code to friendly name if desired.

6. Create admin user via Supabase Auth Console and verify user_profiles row is created by trigger.

7. Run smoke-tests after wiring environment variables and deploying app.

Notes:

- This migration contains DROP statements to provide a clean database state for a new project. Do NOT run on an active production DB with live data.

