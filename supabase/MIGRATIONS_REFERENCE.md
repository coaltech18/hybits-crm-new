# 📋 Database Migrations Reference

**Status:** Migrations removed - to be implemented when ready

---

## 📝 Migration Files Removed

The following migration files were removed to avoid confusion:

1. ~~`001_Core_Base_Schema.sql`~~ - Core base schema (locations table)
2. ~~`002_auth_and_rbac.sql`~~ - Auth & RBAC (user_role enum, RLS)
3. ~~`003_customers_and_contacts.sql`~~ - Customers table
4. ~~`004_inventory_and_movements.sql`~~ - Inventory items table
5. ~~`005_orders_and_invoices.sql`~~ - Orders and invoices tables
6. ~~`010_user_management_triggers.sql`~~ - User profiles table and trigger
7. ~~`011_fix_user_profiles_rls.sql`~~ - RLS policy fixes
8. ~~`012_cleanup_unused_tables.sql`~~ - Cleanup unused tables

---

## 🗄️ Database Schema Summary

### Tables Needed (Based on Application Code)

1. **`locations`** - Location/outlet management
2. **`user_profiles`** - User profiles (created by trigger)
3. **`customers`** - Customer management
4. **`inventory_items`** - Inventory management
5. **`rental_orders`** - Order management
6. **`rental_order_items`** - Order items
7. **`invoices`** - Invoice management
8. **`invoice_items`** - Invoice line items

### Optional Tables (If using billing/subscription features)

- `vendors`
- `vendor_subscriptions`
- `vendor_subscription_items`
- `vendor_payments`
- `vendor_deposit_ledger`
- `gst_reports_final` (VIEW)

---

## 📚 Reference Documents

When ready to implement migrations, refer to:

- `PRODUCTION_REVIEW_CONSOLIDATED.md` - Comprehensive database review
- `DATABASE_CLEANUP_SUMMARY.md` - Cleanup summary and final schema
- `DEPLOYMENT_ACTION_CHECKLIST.md` - Step-by-step migration guide

---

## ✅ What Remains

- `functions/manage-users/index.ts` - Supabase Edge Function (kept)

---

**Note:** All migration SQL files have been removed. Create new migrations when ready to implement the database schema.

---

**Last Updated:** November 15, 2025

