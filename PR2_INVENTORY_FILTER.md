# PR: fix/inventory-filter - Secure Inventory Outlet Filtering

## Summary
Prevent managers from seeing items with `outlet_id IS NULL` unless explicitly authorized. Fixes critical security vulnerability where managers could see shared items from other outlets.

## What Changed
- Updated `getInventoryItems` signature to accept `userRole` and `includeSharedItems` options
- Removed insecure OR query that allowed managers to see NULL outlet_id items
- Removed fallback logic that fetched all items when query failed (security risk)
- Implemented strict outlet filtering: managers only see items matching their outlet_id
- Only admins with explicit `includeSharedItems: true` flag can see NULL items
- Updated callers (NewOrderPage, InventoryPage) to pass userRole from auth context

## Files Changed
- `src/services/inventoryService.ts` (lines 13-56)
- `src/pages/orders/NewOrderPage.tsx` (line 164)
- `src/pages/inventory/InventoryPage.tsx` (lines 5, 145, 159-164)

## Manual Smoke Tests

1. **Test Manager Access Control:**
   - Create an item with `outlet_id = NULL` (via SQL: `UPDATE inventory_items SET outlet_id = NULL WHERE id = '<some-id>'`)
   - Login as manager for outlet A
   - Navigate to Inventory page
   - Verify NULL item is NOT visible
   - Navigate to New Order page
   - Verify NULL item is NOT visible in item selector

2. **Test Admin Access (without flag):**
   - Login as admin
   - Navigate to Inventory page (without includeSharedItems flag)
   - Verify all items are visible (including NULL items - default admin behavior)

3. **Test Admin Access (with flag):**
   - If admin UI supports includeSharedItems flag, test with flag enabled
   - Verify NULL items are visible when flag is true

4. **Test Normal Items Visibility:**
   - Create item with `outlet_id = 'outlet-a-id'`
   - Login as manager for outlet A
   - Verify item IS visible
   - Login as manager for outlet B
   - Verify item is NOT visible

5. **Test Error Handling:**
   - Verify that query errors are properly thrown (no fallback to insecure behavior)
   - Check that error messages are user-friendly

## Risk Level
**Medium** - Changes access control behavior. Managers will no longer see shared items, which may affect workflows if shared items were intentionally visible before.

## Rollout Plan
1. Merge to `develop` or `staging` branch
2. Run manual smoke tests on staging environment
3. Verify managers cannot see NULL outlet items
4. Verify admins can still see all items
5. Monitor for 24-48 hours
6. If stable, merge to `main` and deploy to production
7. Notify team of security fix

## Rollback Steps
```bash
git revert <commit-hash>
```
Or revert the merge commit if already merged.

## Notes
- Build passes: ✓ (`npm run build` successful)
- This is a security fix - managers should not see items from other outlets
- If shared items need to be visible to managers, business logic should be updated separately
- Admin behavior unchanged (can see all items by default)

