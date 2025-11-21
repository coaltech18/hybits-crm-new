# Stage 3 Implementation Status

## ✅ Completed

1. **Replace .single() with .maybeSingle()** - DONE
   - Updated `src/pages/api/create-profile.ts`

2. **TODO Implementations** - IN PROGRESS
   - ✅ NewInvoicePage - Updated to use InvoiceService
   - ✅ AddOutletPage - Updated to use OutletService
   - ⏳ NewOrderPage - Needs inventory item selection implementation

3. **Service Updates** - IN PROGRESS
   - ✅ OutletService - Removed code generation, updated field mappings
   - ⏳ InvoiceService - Needs outlet_id and code generation removal
   - ⏳ CustomerService - Needs outlet_id and code generation removal
   - ⏳ OrderService - Needs outlet_id and code generation removal
   - ⏳ InventoryService - Needs outlet_id and code generation removal

4. **Image Service** - PENDING
   - ⏳ Implement signed URL flow

5. **AuthContext** - PENDING
   - ⏳ Add outlet helpers (isAdmin, isManager, isAccountant, getCurrentOutletId)

6. **Sidebar & Routes** - MOSTLY DONE
   - ✅ Routes already have accounting role guards
   - ✅ Routes already have requireAdmin flags
   - ⏳ Sidebar needs accounting permission check update

7. **Vendor & Subscriptions** - PENDING
   - ⏳ Update billingService with outlet_id logic

8. **Payments & Invoices** - PENDING
   - ⏳ Update invoiceService payment creation
   - ⏳ Add RLS-safe refetch after payment

9. **GST Report Service** - PENDING
   - ⏳ Add outlet_id filter for non-admin users

## Remaining Work

This is a comprehensive update. The critical path items are:
1. Remove all code generation from services (DB triggers handle it)
2. Add outlet_id to all INSERT operations
3. Add outlet filters to all SELECT operations (unless admin)
4. Update image service for signed URLs
5. Update AuthContext with outlet helpers

