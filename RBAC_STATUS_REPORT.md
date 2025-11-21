# 🔐 RBAC (Role-Based Access Control) Status Report

**Date:** November 15, 2025  
**Required Roles:** admin, manager, accountant (NO viewer)

---

## ✅ WHAT'S WORKING

### 1. **Admin Role** ✅
- ✅ Full access to all modules
- ✅ Can access all outlets
- ✅ Can manage users
- ✅ Can manage settings
- ✅ Permissions defined in `src/utils/permissions.ts`

### 2. **Manager Role** ✅
- ✅ Limited to their assigned outlet
- ✅ Can access: Dashboard, Inventory, Customers, Orders, Billing
- ✅ Cannot access: Users, Settings (admin only)
- ✅ `canAccessOutlet()` function exists to enforce outlet restriction
- ⚠️ **NEEDS VERIFICATION:** Database queries should filter by outlet_id

---

## ❌ WHAT'S MISSING/BROKEN

### 1. **Accountant Role** ❌ NOT IMPLEMENTED
- ❌ Permissions NOT defined in `ROLE_PERMISSIONS`
- ❌ Accounting module shows for admin/manager (should be accountant ONLY)
- ❌ Accounting routes NOT protected
- ❌ Sidebar shows Accounting for admin/manager (should be accountant only)

### 2. **Viewer Role** ✅ REMOVED
- ✅ Removed from `UserRole` type definition
- ✅ No references found in codebase

### 3. **Manager Outlet Filtering** ⚠️ NEEDS VERIFICATION
- ✅ `canAccessOutlet()` function exists
- ⚠️ Need to verify database queries filter by `outlet_id` for managers
- ⚠️ Need to verify RLS policies enforce outlet restrictions

---

## 📋 REQUIRED FIXES

### Fix 1: Remove 'viewer' Role
- Remove from `UserRole` type definition
- Update any references

### Fix 2: Add Accountant Permissions
- Add accountant permissions to `ROLE_PERMISSIONS`
- Only access to accounting module

### Fix 3: Restrict Accounting Module to Accountant Only
- Update Sidebar to show Accounting only for accountant
- Add route protection for accounting routes
- Add permission checks in AccountingPage

### Fix 4: Verify Manager Outlet Filtering
- Ensure all database queries filter by outlet_id for managers
- Ensure RLS policies enforce outlet restrictions

---

## 🎯 EXPECTED BEHAVIOR

### Admin
- ✅ Access to ALL modules
- ✅ Access to ALL outlets
- ✅ Can manage users and settings

### Manager
- ✅ Access to: Dashboard, Inventory, Customers, Orders, Billing
- ✅ Limited to their assigned outlet only
- ❌ Cannot access: Users, Settings, Accounting

### Accountant
- ✅ Access ONLY to: Accounting module
- ❌ Cannot access: Dashboard, Inventory, Customers, Orders, Billing, Users, Settings, Outlets

---

## 📝 FILES THAT NEED UPDATES

1. `src/types/index.ts` - Remove 'viewer' from UserRole
2. `src/utils/permissions.ts` - Add accountant permissions
3. `src/components/ui/Sidebar.tsx` - Update Accounting menu item
4. `src/routes/AppRoutes.tsx` - Add route protection for accounting
5. `src/pages/AccountingPage.tsx` - Add permission check
6. Database migrations - Ensure RLS policies enforce outlet restrictions

---

**Status:** ⚠️ **NOT READY** - Accountant role not implemented, viewer should be removed

