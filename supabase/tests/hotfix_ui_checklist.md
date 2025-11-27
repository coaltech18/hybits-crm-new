# HOTFIX VERIFICATION — UI Manual Checklist

## Prerequisites
- [ ] Staging/development environment running
- [ ] Test users created:
  - Manager A (assigned to Outlet A)
  - Manager B (assigned to Outlet B)
  - Admin (no outlet restriction)

---

## C. UI Manual Checks

### C.1: Login as Manager A
- [ ] Navigate to `/login`
- [ ] Login with Manager A credentials
- [ ] Verify redirect to dashboard
- [ ] Verify current outlet shows "Outlet A" in header
- [ ] Verify sidebar shows only Outlet A data

**Expected:** Manager A sees only their outlet's data

---

### C.2: Create a Customer
- [ ] Navigate to `/customers/new`
- [ ] Fill in customer form:
  - Name: "Test Customer A"
  - Email: "test@example.com"
  - Phone: "9876543210"
  - Address fields
- [ ] Submit form
- [ ] Verify customer created successfully
- [ ] Check customer list shows new customer

**Expected:** Customer created with `outlet_id = Manager A's outlet`

**Verify in DB:**
```sql
SELECT customer_code, contact_person, outlet_id 
FROM customers 
WHERE contact_person = 'Test Customer A';
-- Should show outlet_id matching Manager A's outlet
```

---

### C.3: Create Invoice Using CustomerSelector
- [ ] Navigate to `/accounting/invoice/new`
- [ ] **CRITICAL:** Click on Customer field
- [ ] Verify CustomerSelector dropdown appears
- [ ] Type customer name in search box
- [ ] Verify only customers from Outlet A appear
- [ ] Select "Test Customer A" from dropdown
- [ ] Verify customer details populate below selector
- [ ] Add invoice items:
  - Description: "Test Item 1"
  - Quantity: 2
  - Rate: 1000
  - GST Rate: 18%
  - HSN Code: "12345678" (optional)
- [ ] Verify totals calculate correctly:
  - Subtotal: ₹2,000
  - GST: ₹360
  - Total: ₹2,360
- [ ] Click "Create Invoice"
- [ ] Verify redirect to invoice detail page
- [ ] Verify invoice number generated (format: INVOICE-OUTCODE-001)

**Expected:** 
- CustomerSelector shows only Outlet A customers
- Invoice created with `customer_id` populated (NOT empty)
- Invoice has correct totals

**Verify in DB:**
```sql
SELECT id, invoice_number, customer_id, outlet_id, total_amount
FROM invoices 
ORDER BY created_at DESC 
LIMIT 1;
-- customer_id should NOT be NULL
-- outlet_id should match Manager A's outlet
```

---

### C.4: Record Payments
- [ ] On invoice detail page, click "Record Payment"
- [ ] Enter payment:
  - Amount: ₹1,000
  - Payment Method: Cash
  - Date: Today
- [ ] Submit payment
- [ ] Verify payment status shows "Partial"
- [ ] Verify payment received: ₹1,000
- [ ] Verify balance due: ₹1,360
- [ ] Record second payment:
  - Amount: ₹1,360
  - Payment Method: UPI
- [ ] Submit payment
- [ ] Verify payment status shows "Paid"
- [ ] Verify payment received: ₹2,360
- [ ] Verify balance due: ₹0

**Expected:** 
- Status transitions: pending → partial → paid
- Payment history shows both payments

**Verify in DB:**
```sql
SELECT payment_status, payment_received, total_amount, balance_due
FROM invoices 
WHERE invoice_number = '<your-invoice-number>';
-- payment_status should be 'paid'
-- payment_received should equal total_amount
```

---

### C.5: Upload Item Image
- [ ] Navigate to `/inventory/new`
- [ ] Fill in item details:
  - Name: "Test Item with Image"
  - Category: "Plates"
  - Location: Select Outlet A
  - Quantity: 10
  - Unit Price: 500
- [ ] Scroll to "Item Image" section
- [ ] Click upload area or drag & drop an image
- [ ] Select image file (JPG/PNG, < 5MB)
- [ ] Verify upload progress indicator
- [ ] Verify image preview appears
- [ ] Submit form
- [ ] Verify item created successfully

**Expected:** 
- Image uploads without errors
- Image path follows format: `{outlet_id}/{item_code}/{filename}`

**Verify in Supabase Dashboard:**
1. Go to Storage > inventory-images bucket
2. Find the uploaded file
3. Verify path structure: `{outlet-uuid}/{ITEM-OUTCODE-001}/{timestamp_filename.jpg}`

**Verify in DB:**
```sql
SELECT item_code, name, image_url, outlet_id
FROM inventory_items 
WHERE name = 'Test Item with Image';
-- image_url should contain the storage path
-- outlet_id should match Manager A's outlet
```

---

### C.6: GST Report Generation
- [ ] Navigate to `/reports/gst`
- [ ] Select current month and year
- [ ] Click "Generate Report"
- [ ] Verify report loads
- [ ] Check "Domestic" section
- [ ] Verify only invoices from Outlet A appear
- [ ] Verify totals match Outlet A invoices only
- [ ] Click "Export to Excel"
- [ ] Verify Excel file downloads
- [ ] Open Excel file
- [ ] Verify data matches report

**Expected:** 
- Report shows only Outlet A invoices
- Totals match Outlet A data only
- Export includes correct data

**Verify in DB:**
```sql
-- Count invoices per outlet for current month
SELECT 
  l.code as outlet_code,
  COUNT(i.id) as invoice_count
FROM locations l
LEFT JOIN invoices i ON i.outlet_id = l.id
WHERE DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY l.id, l.code;
-- Manager A should only see their outlet's count
```

---

### C.7: Admin Access Verification
- [ ] Logout from Manager A
- [ ] Login as Admin
- [ ] Navigate to `/customers`
- [ ] Verify ALL customers from ALL outlets appear
- [ ] Navigate to `/reports/gst`
- [ ] Generate GST report
- [ ] Verify report shows data from ALL outlets
- [ ] Navigate to `/accounting/invoices`
- [ ] Verify all invoices from all outlets appear

**Expected:** 
- Admin sees all outlets' data
- No outlet filtering applied for admin

**Verify in DB:**
```sql
-- Admin should see all customers
SELECT COUNT(*) as total_customers FROM customers;
-- Should match count shown in UI
```

---

### C.8: PDF Generation
- [ ] Navigate to `/accounting/invoices`
- [ ] Click on an invoice (preferably one with items and payments)
- [ ] Scroll to PDF section
- [ ] Click "Generate PDF" button
- [ ] Verify loading spinner appears
- [ ] Wait for PDF generation (may take 5-10 seconds)
- [ ] Verify PDF viewer appears with invoice
- [ ] Verify PDF contains:
  - [ ] Company/Outlet header
  - [ ] Invoice number and date
  - [ ] Customer details (name, address, GSTIN)
  - [ ] Items table with:
    - [ ] Description
    - [ ] HSN/SAC code
    - [ ] Quantity
    - [ ] Rate
    - [ ] GST %
    - [ ] Amount
  - [ ] Totals section:
    - [ ] Subtotal
    - [ ] CGST (if intra-state)
    - [ ] SGST (if intra-state)
    - [ ] IGST (if inter-state)
    - [ ] Total Amount
  - [ ] Payment status
- [ ] Click "Download PDF"
- [ ] Verify PDF downloads
- [ ] Open downloaded PDF locally
- [ ] Verify all numbers match invoice detail page
- [ ] Verify PDF is readable and formatted correctly

**Expected:** 
- PDF generates successfully
- All invoice data matches
- PDF is properly formatted
- Signed URL works and expires after 1 hour

**Verify in DB:**
```sql
SELECT invoice_number, invoice_pdf_url, invoice_pdf_key
FROM invoices 
WHERE invoice_pdf_url IS NOT NULL
ORDER BY updated_at DESC 
LIMIT 1;
-- invoice_pdf_url should be a valid signed URL
-- invoice_pdf_key should follow pattern: invoices/{invoice_number}_{timestamp}.pdf
```

---

## Summary Checklist

### Critical Path (Must Pass)
- [x] CustomerService filters by outlet_id
- [x] CustomerSelector shows only current outlet customers
- [x] Invoice creation includes customer_id
- [x] Image upload uses outlet-aware path
- [x] GST report filters by outlet
- [x] PDF generation works with correct auth

### Data Integrity
- [ ] No orphaned customers (all have outlet_id)
- [ ] No orphaned invoices (all have outlet_id and customer_id)
- [ ] Storage paths follow correct format
- [ ] Payment calculations correct

### Security
- [ ] Manager A cannot see Manager B's customers
- [ ] Manager A cannot access Manager B's invoices
- [ ] Manager A cannot generate PDFs for other outlets
- [ ] Storage RLS policies prevent cross-outlet access

---

## Test Results

**Date:** _______________
**Tester:** _______________
**Environment:** _______________

**Overall Status:** ☐ PASS  ☐ FAIL  ☐ PARTIAL

**Notes:**
_________________________________________________
_________________________________________________
_________________________________________________

