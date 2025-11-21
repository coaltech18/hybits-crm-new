# 🔐 RBAC Changes Log

**Date:** November 15, 2025

---

## ✅ Changes Made

### 1. Removed 'viewer' Role
- **File:** `src/types/index.ts`
- **Change:** Removed 'viewer' from `UserRole` type definition
- **Before:** `export type UserRole = 'admin' | 'manager' | 'accountant' | 'viewer';`
- **After:** `export type UserRole = 'admin' | 'manager' | 'accountant';`
- **Status:** ✅ Complete

---

## 📋 Current Role Status

### Active Roles
1. **admin** - Full access to all modules and outlets
2. **manager** - Limited to assigned outlet
3. **accountant** - (To be implemented - accounting module only)

### Removed Roles
1. ~~**viewer**~~ - Removed as per requirements

---

## ⏳ Pending Actions

- [ ] Implement accountant role permissions
- [ ] Restrict accounting module to accountant only
- [ ] Add route protection for accounting routes
- [ ] Update Sidebar to show Accounting only for accountant

---

**Last Updated:** November 15, 2025

