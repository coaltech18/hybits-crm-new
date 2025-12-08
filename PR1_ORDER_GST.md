# PR: fix/order-gst - Compute Order GST Amount

## Summary
Calculate `gst_amount` at order creation time using the existing tax engine, ensuring orders display accurate GST totals instead of always being 0.

## What Changed
- Modified `src/services/orderService.ts` to compute GST amount before order insertion
- Uses existing `calculateInvoiceFromLines` function from tax engine
- Maps order items to tax input lines and calculates CGST/SGST/IGST
- Rounds result to 2 decimals
- Non-blocking: falls back to 0 if computation fails (with warning log)

## Files Changed
- `src/services/orderService.ts` (lines 44-60)

## Manual Smoke Tests

1. **Test Standard GST Calculation:**
   - Create order via UI with 2 items:
     - Item A: rate 1000, quantity 2, GST 18%
     - Item B: rate 500, quantity 1, GST 5%
   - Verify in database: `gst_amount` = (2000 * 0.18) + (500 * 0.05) = 360 + 25 = 385.00
   - Check order display shows correct GST amount

2. **Test Non-Standard GST Rate:**
   - Create order with item having GST rate 12%
   - Verify GST calculation works correctly
   - Verify order displays correct GST amount

3. **Test Error Handling:**
   - Simulate tax calculation failure (if possible)
   - Check browser console for warning: "Order GST compute failed — proceeding with gst_amount=0"
   - Verify order still creates successfully with gst_amount=0

4. **Verify Invoice GST Matches:**
   - Create order and verify automatic invoice creation
   - Compare order `gst_amount` with invoice total GST
   - Note: They may differ slightly due to state-based calculation in invoice (CGST/SGST vs IGST)

## Risk Level
**Low** - Non-breaking change, fallback to 0 if computation fails. Order creation remains functional even if GST calculation fails.

## Rollout Plan
1. Merge to `develop` or `staging` branch
2. Run manual smoke tests on staging environment
3. Monitor for 24-48 hours
4. If stable, merge to `main` and deploy to production
5. Notify team of change

## Rollback Steps
```bash
git revert <commit-hash>
```
Or revert the merge commit if already merged.

## Notes
- Build passes: ✓ (`npm run build` successful)
- Lint note: Pre-existing ESLint configuration issue (not related to this change)
- This fix ensures data accuracy for order GST amounts
- Invoice creation logic unchanged (still uses state-based calculation)

