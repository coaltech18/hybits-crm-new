# ✅ PRODUCTION DEPLOYMENT ACTION CHECKLIST
**Date:** November 15, 2025  
**Target:** Tomorrow  
**Priority:** CRITICAL

---

## 🚨 CRITICAL ACTIONS (MUST DO BEFORE DEPLOYMENT)

### 1. Database Setup (30-45 minutes)

#### ✅ Step 1.1: Run Database Migrations
- [ ] Open Supabase Dashboard > SQL Editor
- [ ] Run `supabase/001_Core_Base_Schema.sql`
- [ ] Run `supabase/002_auth_and_rbac.sql`
- [ ] Run `supabase/003_customers_and_contacts.sql`
- [ ] Run `supabase/004_inventory_and_movements.sql`
- [ ] Run `supabase/005_orders_and_invoices.sql`
- [ ] Run `supabase/010_user_management_triggers.sql`
- [ ] **CRITICAL:** Run `supabase/011_fix_user_profiles_rls.sql` (MUST BE LAST)
- [ ] Verify all tables exist: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
- [ ] Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

#### ✅ Step 1.2: Create Missing Tables (if using billing/subscription features)
- [ ] Create `vendors` table migration
- [ ] Create `vendor_subscriptions` table migration
- [ ] Create `vendor_subscription_items` table migration
- [ ] Create `vendor_payments` table migration
- [ ] Create `vendor_deposit_ledger` table migration
- [ ] Create `gst_reports_final` view migration
- [ ] **OR:** Remove billing/subscription features if not needed

#### ✅ Step 1.3: Fix Schema Mismatches
**Option A: Add Missing Columns (Recommended)**
- [ ] Add missing columns to `rental_orders` table:
  - `event_type TEXT`
  - `event_duration NUMERIC(12,2)`
  - `guest_count NUMERIC(12,2)`
  - `location_type TEXT`
  - `payment_status TEXT`
  - `delivery_date DATE`
  - `return_date DATE`
  - `delivery_address TEXT`
  - `security_deposit NUMERIC(12,2)`
  - `gst_amount NUMERIC(12,2)`
  - `created_by UUID`
  - `updated_at TIMESTAMP DEFAULT NOW()`

- [ ] Add missing columns to `inventory_items` table:
  - `rental_price_per_day NUMERIC(12,2)`
  - `available_quantity NUMERIC(12,2) DEFAULT 0`
  - `reserved_quantity NUMERIC(12,2) DEFAULT 0`
  - `reorder_point NUMERIC(12,2)`
  - `image_url TEXT`
  - `thumbnail_url TEXT`
  - `image_alt_text TEXT`
  - `condition TEXT`

- [ ] Add missing columns to `locations` table:
  - `location_code TEXT UNIQUE`
  - `manager_id UUID`
  - `phone TEXT`
  - `email TEXT`
  - `gstin TEXT`
  - `is_active BOOLEAN DEFAULT true`
  - `settings JSONB DEFAULT '{}'`
  - `updated_at TIMESTAMP DEFAULT NOW()`

- [ ] Add missing columns to `invoices` table:
  - `subtotal NUMERIC(12,2)`
  - `total_gst NUMERIC(12,2)`
  - `due_date DATE`
  - `payment_status TEXT DEFAULT 'pending'`
  - `notes TEXT`
  - `created_by UUID`
  - `updated_at TIMESTAMP DEFAULT NOW()`

**Option B: Update Service Code (Alternative)**
- [ ] Update `orderService.ts` to match existing schema
- [ ] Update `inventoryService.ts` to match existing schema
- [ ] Update `outletService.ts` to match existing schema
- [ ] Update `invoiceService.ts` to match existing schema

#### ✅ Step 1.4: Add Missing RLS Policies
- [ ] Add RLS policies for `inventory_items`
- [ ] Add RLS policies for `rental_orders`
- [ ] Add RLS policies for `rental_order_items`
- [ ] Add RLS policies for `invoices`
- [ ] Add RLS policies for `invoice_items`
- [ ] Add RLS policies for `stock_movements`
- [ ] Test policies with different user roles

---

### 2. Environment Configuration (5 minutes)

#### ✅ Step 2.1: Set Environment Variables in Render
- [ ] Go to Render Dashboard > Your Service > Environment
- [ ] Add `VITE_SUPABASE_URL` = Your Supabase project URL
- [ ] Add `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
- [ ] Verify `render.yaml` lists these variables
- [ ] Save and redeploy

---

### 3. Code Verification (15 minutes)

#### ✅ Step 3.1: Verify Build
- [ ] Run `npm install --legacy-peer-deps`
- [ ] Run `npm run build`
- [ ] Verify build succeeds without errors
- [ ] Check build output size

#### ✅ Step 3.2: Verify TypeScript
- [ ] Run `npx tsc --noEmit`
- [ ] Verify no TypeScript errors
- [ ] Fix any errors found

---

### 4. Testing (2-3 hours)

#### ✅ Step 4.1: Authentication Testing
- [ ] Test login with valid credentials
- [ ] Test login with invalid credentials
- [ ] Test logout
- [ ] Test session persistence
- [ ] Test protected routes redirect

#### ✅ Step 4.2: Database Function Testing
- [ ] Test user creation (trigger should create profile)
- [ ] Test stock movement (trigger should update inventory)
- [ ] Test code generation for all entity types
- [ ] Test RLS policies with different roles

#### ✅ Step 4.3: CRUD Operations Testing
- [ ] Test customer CRUD
- [ ] Test inventory CRUD
- [ ] Test order creation with items
- [ ] Test invoice creation with items
- [ ] Test location/outlet CRUD
- [ ] Test user management (if admin)

#### ✅ Step 4.4: Integration Testing
- [ ] Test creating order with customer
- [ ] Test creating invoice from order
- [ ] Test inventory updates on order creation
- [ ] Test all user roles and permissions

---

### 5. Deployment (30 minutes)

#### ✅ Step 5.1: Pre-Deployment
- [ ] Review all changes
- [ ] Commit changes: `git add .`
- [ ] Commit message: `git commit -m "Production ready: Fix RLS, schema, migrations"`
- [ ] Push to repository: `git push origin main`

#### ✅ Step 5.2: Deploy
- [ ] Monitor Render deployment logs
- [ ] Verify build succeeds
- [ ] Verify deployment completes

#### ✅ Step 5.3: Post-Deployment Verification
- [ ] Test application loads
- [ ] Test login works
- [ ] Test all core features
- [ ] Check browser console for errors
- [ ] Check Supabase logs for errors
- [ ] Verify performance is acceptable

---

## ⚠️ HIGH PRIORITY ACTIONS (SHOULD DO)

### 6. Code Cleanup (Optional - Can do post-deployment)
- [ ] Remove or wrap console.log statements (233 found)
- [ ] Implement production logging service
- [ ] Clean up unused imports
- [ ] Optimize bundle size if needed

### 7. Monitoring Setup (Optional - Can do post-deployment)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up performance monitoring
- [ ] Set up Supabase usage monitoring
- [ ] Set up Render metrics monitoring

---

## 📋 VERIFICATION QUERIES

### Database Verification
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check user_profiles policies
SELECT * FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Check trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

### Application Verification
- [ ] Login works
- [ ] Dashboard loads
- [ ] All modules accessible
- [ ] No console errors
- [ ] No network errors
- [ ] Performance acceptable

---

## 🚨 ROLLBACK PLAN

### If Deployment Fails:
1. **Immediate Rollback**
   - Render: Go to Dashboard > Manual Deploy > Previous version
   - Or: Revert git commit and push

2. **Database Rollback**
   - Supabase: Restore from backup (if available)
   - Or: Manually revert migrations

3. **Environment Rollback**
   - Revert environment variables
   - Check Render logs for errors

---

## ✅ FINAL CHECKLIST

### Before Deployment:
- [ ] All migrations run successfully
- [ ] RLS policies fixed
- [ ] Schema mismatches resolved
- [ ] Environment variables set
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Code reviewed

### After Deployment:
- [ ] Application loads
- [ ] Login works
- [ ] All features functional
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Monitoring active

---

## 📞 EMERGENCY CONTACTS

- **Supabase Support:** Dashboard > Support
- **Render Support:** Dashboard > Support
- **GitHub:** Repository for code

---

**Estimated Total Time:** 4-6 hours  
**Confidence Level:** Medium-High (after completing checklist)  
**Risk Level:** Low-Medium (after fixes)

---

**END OF CHECKLIST**

