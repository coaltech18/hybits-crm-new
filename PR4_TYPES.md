# PR: chore/types-critical - Improve Type Safety

## Summary
Replace `any` types in critical orderService module with proper TypeScript types. Create database payload types and extend OrderItemFormData to include missing fields.

## What Changed
- Created `src/types/database.ts` with payload types for database operations:
  - `RentalOrderInsertPayload`
  - `RentalOrderItemInsertPayload`
  - `InvoiceInsertPayload`
  - `InvoiceItemInsertPayload`
- Extended `OrderItemFormData` to include `rental_days` and `gst_rate` (optional fields)
- Replaced `any` types in orderService.ts with proper types
- Added null checks for `createdInvoice` to satisfy TypeScript strict mode
- Fixed type inference issues with date strings

## Files Changed
- `src/types/database.ts` (NEW)
- `src/types/forms.ts` (extended OrderItemFormData)
- `src/services/orderService.ts` (replaced ~15 `any` usages)

## Manual Smoke Tests

1. **Verify Build:**
   - Run `npm run build` - must pass
   - Run `npm run type-check` - must pass
   - No TypeScript errors

2. **Test Order Creation:**
   - Create order via UI with items that have rental_days and gst_rate
   - Verify order creates successfully
   - Verify invoice is generated correctly
   - Check database: verify order and invoice records are correct

3. **Test Type Safety:**
   - Try to pass invalid data types to orderService functions
   - Verify TypeScript catches errors at compile time

## Risk Level
**Low** - Type-only changes, no runtime behavior changes. Improves type safety.

## Rollout Plan
1. Merge to `develop` or `staging` branch
2. Run manual smoke tests on staging
3. Verify order creation/invoice generation works
4. Monitor for 24-48 hours
5. If stable, merge to `main` and deploy

## Rollback Steps
```bash
git revert <commit-hash>
```

## Notes
- Build passes: ✓ (`npm run build` successful)
- Type-check passes: ✓ (no TypeScript errors)
- Incremental improvement - more `any` types can be replaced in future PRs
- Focused on high-impact orderService module first

