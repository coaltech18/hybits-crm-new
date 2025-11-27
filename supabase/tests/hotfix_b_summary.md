# HOTFIX B — PDF Edge Function Security & Audit Summary

## ✅ Changes Applied

### 1. Edge Function Auth Fix & Outlet Ownership Enforcement
**File:** `supabase/functions/generate-invoice-pdf/index.ts`

**Changes:**
- ✅ Fixed profile lookup: Uses `.eq('id', user.id)` (was already fixed in previous hotfix)
- ✅ Enhanced profile fetch: Now selects `id, role, outlet_id` (was only `role`)
- ✅ Added invoice ownership check: Fetches invoice `outlet_id` before generating PDF
- ✅ Enforced outlet isolation: Non-admin users can only generate PDFs for their outlet's invoices
- ✅ Used service role client (`supabaseAdmin`) for all database operations after auth check
- ✅ Added configurable signed URL expiry: Default 1 hour (3600s), configurable via `PDF_SIGNED_URL_EXPIRY` env var

**Security Flow:**
1. Authenticate user via JWT token
2. Fetch user profile with `outlet_id`
3. Verify role (admin/manager/accountant)
4. Fetch invoice `outlet_id` separately
5. **Check ownership:** `profile.role !== 'admin' && profile.outlet_id !== invoice.outlet_id` → 403
6. Only then fetch full invoice data and generate PDF

### 2. Audit Table Migration
**File:** `supabase/migrations/013_invoice_pdf_audit.sql` (NEW)

**Created:**
- ✅ `invoice_pdf_audit` table with:
  - `id` (UUID, primary key)
  - `invoice_id` (references invoices, CASCADE delete)
  - `generated_by` (references user_profiles)
  - `generated_at` (timestamp, default NOW())
  - `pdf_key` (storage path)
- ✅ Indexes on `invoice_id`, `generated_by`, `generated_at`
- ✅ RLS enabled with policy: Users can only see audit logs for invoices they can access
- ✅ Grants: SELECT to authenticated, INSERT to service_role

### 3. Audit Logging
**File:** `supabase/functions/generate-invoice-pdf/index.ts`

**Added:**
- ✅ Audit log insertion after PDF upload
- ✅ Non-blocking: Audit failures don't fail PDF generation
- ✅ Logs: `invoice_id`, `generated_by`, `pdf_key`

### 4. Secure Response
**File:** `supabase/functions/generate-invoice-pdf/index.ts`

**Ensured:**
- ✅ Response only contains `url`, `key`, `expiresIn` (no service role keys)
- ✅ Signed URL expiry documented in code comments
- ✅ All database operations use service role client after auth verification

---

## Security Improvements

| Before | After |
|--------|-------|
| Profile fetch only checked role | Profile fetch includes `outlet_id` |
| No outlet ownership check | Outlet ownership enforced before PDF generation |
| No audit trail | All PDF generations logged |
| No visibility into PDF access | Audit table tracks who generated what |

---

## Testing Checklist

### Database Migration
- [ ] Run `013_invoice_pdf_audit.sql` in Supabase SQL Editor
- [ ] Verify table created: `SELECT * FROM invoice_pdf_audit LIMIT 1;`
- [ ] Verify RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'invoice_pdf_audit';`

### Edge Function
- [ ] Deploy updated Edge Function
- [ ] Test as Manager A: Generate PDF for Outlet A invoice → ✅ Should succeed
- [ ] Test as Manager A: Generate PDF for Outlet B invoice → ❌ Should return 403
- [ ] Test as Admin: Generate PDF for any invoice → ✅ Should succeed
- [ ] Verify audit log created: `SELECT * FROM invoice_pdf_audit ORDER BY generated_at DESC LIMIT 5;`

### Response Security
- [ ] Verify response doesn't contain service role keys
- [ ] Verify signed URL expires after 1 hour (or configured time)
- [ ] Test signed URL access: `curl -I "<signed-url>"` → Should return 200

---

## Migration Order

Run migrations in this order:
1. `013_invoice_pdf_audit.sql` (creates audit table)
2. Deploy updated Edge Function
3. Test PDF generation

---

## Environment Variables

Optional (defaults to 3600 seconds = 1 hour):
```bash
PDF_SIGNED_URL_EXPIRY=3600  # Signed URL expiry in seconds
```

---

## Files Modified

1. ✅ `supabase/functions/generate-invoice-pdf/index.ts` - Enhanced auth & audit
2. ✅ `supabase/migrations/013_invoice_pdf_audit.sql` - NEW audit table

## Files Verified (No Changes Needed)

- ✅ `src/pages/accounting/InvoiceDetailPage.tsx` - Already calls Edge Function correctly

---

## Status: ✅ COMPLETE

All changes applied idempotently. Ready for testing and deployment.

