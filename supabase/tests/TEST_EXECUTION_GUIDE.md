# Hotfix Verification — Test Execution Guide

## ✅ Code Verification Complete

All hotfix code changes have been verified:

- ✅ `CustomersPage.tsx` passes `currentOutletId` to `CustomerService.getCustomers()`
- ✅ `NewItemPage.tsx` passes `outletId` to `ImageUpload` component
- ✅ `NewInvoicePage.tsx` uses `selectedCustomer.id` for `customer_id`
- ✅ `GSTReportPage.tsx` passes `currentOutletId` to `getGSTReport()`
- ✅ `generate-invoice-pdf/index.ts` uses `.eq('id', user.id)` instead of `user_id`

---

## Test Execution Steps

### A. Database Schema Checks

**Location:** `supabase/tests/hotfix_verification.sql`

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste queries from `hotfix_verification.sql`
3. Run each query sequentially
4. Verify results match expected outcomes

**Expected Results:**

| Query | Expected Result |
|-------|----------------|
| A.1: Customer outlet filter | All customers have `outlet_id` populated |
| A.2: Invoice customer_id | All invoices have non-null `customer_id` |
| A.3: Invoice PDF fields | Recent invoices have `invoice_pdf_url` and `invoice_pdf_key` |
| A.4: Storage paths | Paths follow `{outlet_id}/{item_code}/{filename}` format |
| A.7: Orphaned records | Should return 0 rows (or intentional NULLs) |

---

### B. API & Edge Function Tests

**Location:** `supabase/tests/hotfix_api_tests.sh`

**Prerequisites:**
```bash
# Set environment variables (PowerShell)
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY = "your-anon-key"
$env:MANAGER_A_EMAIL = "manager-a@example.com"
$env:MANAGER_A_PASSWORD = "password"
$env:MANAGER_B_EMAIL = "manager-b@example.com"
$env:MANAGER_B_PASSWORD = "password"
```

**How to run (Linux/Mac/Git Bash):**
```bash
chmod +x supabase/tests/hotfix_api_tests.sh
./supabase/tests/hotfix_api_tests.sh
```

**How to run (Windows PowerShell):**
```powershell
# Install Git Bash or use WSL, then run:
bash supabase/tests/hotfix_api_tests.sh
```

**Or manually test with curl:**

```powershell
# 1. Get Manager A token
$response = Invoke-RestMethod -Uri "$env:SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Method Post -Headers @{
    "apikey" = $env:SUPABASE_ANON_KEY
    "Content-Type" = "application/json"
  } -Body (@{
    email = $env:MANAGER_A_EMAIL
    password = $env:MANAGER_A_PASSWORD
  } | ConvertTo-Json)

$token = $response.access_token

# 2. Get customers (should only return Manager A's outlet)
Invoke-RestMethod -Uri "$env:SUPABASE_URL/rest/v1/customers?select=*&order=created_at.desc&limit=50" `
  -Headers @{
    "Authorization" = "Bearer $token"
    "apikey" = $env:SUPABASE_ANON_KEY
  }

# 3. Generate PDF (replace INVOICE_ID)
Invoke-RestMethod -Uri "$env:SUPABASE_URL/functions/v1/generate-invoice-pdf" `
  -Method Post -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  } -Body (@{
    invoice_id = "YOUR_INVOICE_ID"
  } | ConvertTo-Json)
```

**Expected Results:**
- ✅ Manager A only sees customers from their outlet
- ✅ PDF generation returns 200 with `{url, key}`
- ✅ Cross-outlet access returns 403/404

---

### C. UI Manual Checks

**Location:** `supabase/tests/hotfix_ui_checklist.md`

**How to run:**
1. Open the checklist in your browser/editor
2. Follow each step in your staging environment
3. Check off items as you complete them
4. Note any failures or issues

**Critical Path:**
1. Login as Manager A
2. Create customer → Verify outlet_id set
3. Create invoice with CustomerSelector → Verify customer_id populated
4. Upload item image → Verify storage path format
5. Generate GST report → Verify only Outlet A data
6. Generate PDF → Verify PDF accessible

---

## Quick Verification Commands

### PowerShell (Windows)

```powershell
# Verify code changes
Select-String -Path "src/pages/customers/CustomersPage.tsx" -Pattern "getCustomers\(currentOutletId\)"
Select-String -Path "src/pages/inventory/NewItemPage.tsx" -Pattern "outletId=\{" 
Select-String -Path "src/pages/billing/NewInvoicePage.tsx" -Pattern "customer_id: selectedCustomer\.id"
Select-String -Path "src/pages/reports/GSTReportPage.tsx" -Pattern "getGSTReport\(month, year, currentOutletId\)"
Select-String -Path "supabase/functions/generate-invoice-pdf/index.ts" -Pattern "\.eq\('id', user\.id\)"
```

### Bash (Linux/Mac/Git Bash)

```bash
# Run code verification
bash supabase/tests/verify_hotfix_code.sh

# Run API tests (after setting env vars)
bash supabase/tests/hotfix_api_tests.sh
```

---

## Test Results Template

```
Date: _______________
Tester: _______________
Environment: _______________

A. Database Checks: ☐ PASS  ☐ FAIL
B. API Tests: ☐ PASS  ☐ FAIL  
C. UI Checks: ☐ PASS  ☐ FAIL

Issues Found:
_________________________________________________
_________________________________________________

Overall Status: ☐ READY FOR PRODUCTION  ☐ NEEDS FIXES
```

---

## Troubleshooting

### Database Queries Return Empty Results
- Ensure test data exists
- Check RLS policies allow your user to see data
- Verify outlet_id values match user's outlet

### API Tests Fail with 401/403
- Verify JWT token is valid
- Check user_profiles table has correct role
- Ensure RLS policies allow access

### UI Tests Fail
- Clear browser cache
- Check browser console for errors
- Verify environment variables are set
- Check network tab for API calls

---

## Next Steps After Verification

If all tests pass:
1. ✅ Deploy to staging
2. ✅ Run smoke tests
3. ✅ Get stakeholder approval
4. ✅ Deploy to production

If tests fail:
1. Review error messages
2. Check code changes are deployed
3. Verify database migrations applied
4. Check RLS policies are active

