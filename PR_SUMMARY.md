# Pull Request: Fix Order → Invoice Tax Engine Integration

## Branch
`fix/order-invoice-tax-default-18`

## Summary
This PR fixes the order-to-invoice flow to use the central tax engine, defaults GST to 18%, surfaces invoice creation errors, and adds overdue invoice marking functionality.

## Changes Made

### 1. **Order Service (`src/services/orderService.ts`)**
- ✅ Replaced manual GST calculation with `calculateInvoiceFromLines()` from tax engine
- ✅ Fetches outlet and customer state information for proper CGST/SGST/IGST calculation
- ✅ Creates invoice items from tax engine breakdown with proper tax splits
- ✅ Default GST rate changed from 0% to 18%
- ✅ Invoice creation errors now throw (no silent failures)
- ✅ Proper error handling with cleanup on invoice items failure

### 2. **New Order Page (`src/pages/orders/NewOrderPage.tsx`)**
- ✅ Added `gst_rate` field to OrderItem interface (optional, defaults to 18%)
- ✅ Passes `gst_rate` in order payload (defaults to 18% if not specified)
- ✅ Fixed TypeScript linting error for outletId

### 3. **Migration (`supabase/migrations/016_mark_overdue_routine.sql`)**
- ✅ Created `mark_overdue_invoices()` function
- ✅ Marks invoices as overdue if past due date and not fully paid
- ✅ Returns summary of updated invoices
- ✅ Includes optional cron job setup (commented out)

## Testing

### Manual Testing Steps
1. ✅ Create a new order with items
2. ✅ Verify invoice is created automatically
3. ✅ Verify invoice has correct GST calculation (18% default)
4. ✅ Verify CGST+SGST for intra-state (Karnataka → Karnataka)
5. ✅ Verify IGST for inter-state (Karnataka → Other state)
6. ✅ Verify invoice items have correct tax breakdown
7. ✅ Verify error handling (test with invalid data)

### Test Results
- ✅ No linting errors
- ✅ TypeScript compilation successful
- ✅ Code follows existing patterns

## Breaking Changes
⚠️ **Invoice creation errors now throw instead of failing silently.** Order creation will fail if invoice creation fails. This ensures data consistency but may require error handling updates in calling code.

## Migration Required
Run migration `016_mark_overdue_routine.sql` to add the overdue invoice marking function.

## Files Changed
- `src/services/orderService.ts` - Tax engine integration
- `src/pages/orders/NewOrderPage.tsx` - GST rate default
- `supabase/migrations/016_mark_overdue_routine.sql` - Overdue function

## Related Issues
- Fixes order → invoice GST calculation
- Implements default 18% GST rate
- Surfaces invoice creation errors
- Adds overdue invoice marking capability

---

**Ready for Review** ✅

