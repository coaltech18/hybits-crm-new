#!/bin/bash
# ===================================================================
# HOTFIX CODE VERIFICATION — Static Code Checks
# ===================================================================
#
# This script verifies the hotfix code changes are in place
# Run from project root: ./supabase/tests/verify_hotfix_code.sh
#
# ===================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

check_pattern() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        echo "  File: $file"
        echo "  Pattern: $pattern"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo "=========================================="
echo "HOTFIX CODE VERIFICATION"
echo "=========================================="
echo ""

echo "1. CustomerService Outlet Filtering"
echo "-------------------------------------"
check_pattern "src/services/customerService.ts" "getCustomers(outletId" "getCustomers accepts outletId parameter"
check_pattern "src/pages/customers/CustomersPage.tsx" "getCurrentOutletId" "CustomersPage uses getCurrentOutletId"
check_pattern "src/pages/customers/CustomersPage.tsx" "CustomerService.getCustomers(currentOutletId)" "CustomersPage passes outletId to service"

echo ""
echo "2. ImageUpload Outlet-Aware Path"
echo "---------------------------------"
check_pattern "src/components/ui/ImageUpload.tsx" "outletId\?:" "ImageUpload has outletId prop"
check_pattern "src/components/ui/ImageUpload.tsx" "if \(!outletId\)" "ImageUpload validates outletId"
check_pattern "src/pages/inventory/NewItemPage.tsx" "outletId=\{" "NewItemPage passes outletId to ImageUpload"
check_pattern "src/pages/inventory/NewItemPage.tsx" "getCurrentOutletId" "NewItemPage uses getCurrentOutletId"

echo ""
echo "3. NewInvoicePage Customer Selection"
echo "-------------------------------------"
check_pattern "src/pages/billing/NewInvoicePage.tsx" "CustomerSelector" "NewInvoicePage uses CustomerSelector"
check_pattern "src/pages/billing/NewInvoicePage.tsx" "customer_id: selectedCustomer.id" "NewInvoicePage sets customer_id from selectedCustomer"
check_pattern "src/pages/billing/NewInvoicePage.tsx" "if \(!selectedCustomer" "NewInvoicePage validates customer selection"
check_pattern "src/components/ui/CustomerSelector.tsx" "getCurrentOutletId" "CustomerSelector uses getCurrentOutletId"
check_pattern "src/components/ui/CustomerSelector.tsx" "CustomerService.getCustomers(outletId)" "CustomerSelector passes outletId to service"

echo ""
echo "4. GST Report Outlet Filtering"
echo "-------------------------------"
check_pattern "src/pages/reports/GSTReportPage.tsx" "getCurrentOutletId" "GSTReportPage uses getCurrentOutletId"
check_pattern "src/pages/reports/GSTReportPage.tsx" "getGSTReport(month, year, currentOutletId)" "GSTReportPage passes outletId to service"

echo ""
echo "5. PDF Generation Auth Fix"
echo "---------------------------"
check_pattern "supabase/functions/generate-invoice-pdf/index.ts" "\.eq\('id', user\.id\)" "PDF function uses correct column (id not user_id)"

echo ""
echo "=========================================="
echo "RESULTS"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASS_COUNT"
echo -e "${RED}Failed:${NC} $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All code checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please review the code.${NC}"
    exit 1
fi

