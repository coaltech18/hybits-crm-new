#!/bin/bash
# ===================================================================
# HOTFIX VERIFICATION — API & Edge Function Tests
# ===================================================================
#
# Prerequisites:
# 1. Set these environment variables:
#    export SUPABASE_URL="https://your-project.supabase.co"
#    export SUPABASE_ANON_KEY="your-anon-key"
#    export MANAGER_A_EMAIL="manager-a@example.com"
#    export MANAGER_A_PASSWORD="password"
#    export MANAGER_B_EMAIL="manager-b@example.com"
#    export MANAGER_B_PASSWORD="password"
#    export ADMIN_EMAIL="admin@example.com"
#    export ADMIN_PASSWORD="password"
#
# 2. Install jq for JSON parsing: brew install jq (Mac) or apt-get install jq (Linux)
#
# ===================================================================

set -e  # Exit on error

echo "=========================================="
echo "HOTFIX API VERIFICATION TESTS"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test result
print_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        exit 1
    fi
}

# Function to get auth token
get_token() {
    local email=$1
    local password=$2
    curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" | jq -r '.access_token'
}

# Function to get user profile
get_user_profile() {
    local token=$1
    curl -s -X GET "${SUPABASE_URL}/rest/v1/user_profiles?select=*" \
        -H "Authorization: Bearer ${token}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" | jq '.[0]'
}

echo ""
echo "B.1: Testing Customer List API (Manager A)"
echo "-------------------------------------------"

MANAGER_A_TOKEN=$(get_token "${MANAGER_A_EMAIL}" "${MANAGER_A_PASSWORD}")
if [ -z "$MANAGER_A_TOKEN" ] || [ "$MANAGER_A_TOKEN" = "null" ]; then
    echo -e "${RED}✗ FAIL${NC}: Could not get Manager A token"
    exit 1
fi

MANAGER_A_PROFILE=$(get_user_profile "${MANAGER_A_TOKEN}")
MANAGER_A_OUTLET_ID=$(echo "${MANAGER_A_PROFILE}" | jq -r '.outlet_id')

echo "Manager A Outlet ID: ${MANAGER_A_OUTLET_ID}"

# Get customers via REST API (simulating frontend call)
CUSTOMERS_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/customers?select=*&order=created_at.desc&limit=50" \
    -H "Authorization: Bearer ${MANAGER_A_TOKEN}" \
    -H "apikey: ${SUPABASE_ANON_KEY}")

CUSTOMER_COUNT=$(echo "${CUSTOMERS_RESPONSE}" | jq '. | length')
echo "Customers returned: ${CUSTOMER_COUNT}"

# Verify all customers belong to Manager A's outlet
ALL_SAME_OUTLET=$(echo "${CUSTOMERS_RESPONSE}" | jq --arg outlet_id "${MANAGER_A_OUTLET_ID}" \
    '[.[] | select(.outlet_id != $outlet_id)] | length == 0')

if [ "$ALL_SAME_OUTLET" = "true" ]; then
    print_test 0 "All customers belong to Manager A's outlet"
else
    echo -e "${RED}✗ FAIL${NC}: Some customers belong to different outlets"
    echo "${CUSTOMERS_RESPONSE}" | jq '[.[] | select(.outlet_id != "'"${MANAGER_A_OUTLET_ID}"'")]'
    exit 1
fi

echo ""
echo "B.2: Testing PDF Generation Edge Function"
echo "------------------------------------------"

# Get an invoice ID from Manager A's outlet
INVOICE_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/invoices?select=id,invoice_number,outlet_id&outlet_id=eq.${MANAGER_A_OUTLET_ID}&limit=1" \
    -H "Authorization: Bearer ${MANAGER_A_TOKEN}" \
    -H "apikey: ${SUPABASE_ANON_KEY}")

INVOICE_ID=$(echo "${INVOICE_RESPONSE}" | jq -r '.[0].id')
INVOICE_NUMBER=$(echo "${INVOICE_RESPONSE}" | jq -r '.[0].invoice_number')

if [ -z "$INVOICE_ID" ] || [ "$INVOICE_ID" = "null" ]; then
    echo -e "${YELLOW}⚠ SKIP${NC}: No invoices found for Manager A's outlet. Create an invoice first."
else
    echo "Testing with Invoice ID: ${INVOICE_ID} (${INVOICE_NUMBER})"
    
    # Call Edge Function
    EDGE_FN_URL="${SUPABASE_URL}/functions/v1/generate-invoice-pdf"
    PDF_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${EDGE_FN_URL}" \
        -H "Authorization: Bearer ${MANAGER_A_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"invoice_id\":\"${INVOICE_ID}\"}")
    
    HTTP_CODE=$(echo "${PDF_RESPONSE}" | tail -n1)
    PDF_BODY=$(echo "${PDF_RESPONSE}" | head -n-1)
    
    echo "HTTP Status: ${HTTP_CODE}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        PDF_URL=$(echo "${PDF_BODY}" | jq -r '.url')
        PDF_KEY=$(echo "${PDF_BODY}" | jq -r '.key')
        
        print_test 0 "PDF generation successful"
        echo "  PDF URL: ${PDF_URL}"
        echo "  PDF Key: ${PDF_KEY}"
        
        # Test signed URL HEAD request
        echo ""
        echo "B.3: Testing Signed URL Access"
        echo "------------------------------------------"
        HEAD_RESPONSE=$(curl -s -I "${PDF_URL}" | head -n1)
        echo "HEAD Response: ${HEAD_RESPONSE}"
        
        if echo "${HEAD_RESPONSE}" | grep -q "200 OK"; then
            CONTENT_TYPE=$(curl -s -I "${PDF_URL}" | grep -i "content-type" | cut -d' ' -f2 | tr -d '\r')
            print_test 0 "Signed URL accessible"
            echo "  Content-Type: ${CONTENT_TYPE}"
            
            if echo "${CONTENT_TYPE}" | grep -q "application/pdf"; then
                print_test 0 "Content-Type is application/pdf"
            else
                print_test 1 "Content-Type should be application/pdf, got: ${CONTENT_TYPE}"
            fi
        else
            print_test 1 "Signed URL returned non-200 status"
        fi
    else
        ERROR_MSG=$(echo "${PDF_BODY}" | jq -r '.error // .message // "Unknown error"')
        print_test 1 "PDF generation failed: ${ERROR_MSG}"
        exit 1
    fi
fi

echo ""
echo "B.4: Testing Cross-Outlet Access Prevention"
echo "------------------------------------------"

# Get Manager B token
MANAGER_B_TOKEN=$(get_token "${MANAGER_B_EMAIL}" "${MANAGER_B_PASSWORD}")
if [ -z "$MANAGER_B_TOKEN" ] || [ "$MANAGER_B_TOKEN" = "null" ]; then
    echo -e "${YELLOW}⚠ SKIP${NC}: Manager B credentials not set or invalid"
else
    MANAGER_B_PROFILE=$(get_user_profile "${MANAGER_B_TOKEN}")
    MANAGER_B_OUTLET_ID=$(echo "${MANAGER_B_PROFILE}" | jq -r '.outlet_id')
    
    echo "Manager B Outlet ID: ${MANAGER_B_OUTLET_ID}"
    
    if [ "$MANAGER_B_OUTLET_ID" != "$MANAGER_A_OUTLET_ID" ] && [ -n "$INVOICE_ID" ]; then
        # Try to access Manager A's invoice as Manager B
        CROSS_OUTLET_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${EDGE_FN_URL}" \
            -H "Authorization: Bearer ${MANAGER_B_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"invoice_id\":\"${INVOICE_ID}\"}")
        
        CROSS_HTTP_CODE=$(echo "${CROSS_OUTLET_RESPONSE}" | tail -n1)
        CROSS_BODY=$(echo "${CROSS_OUTLET_RESPONSE}" | head -n-1)
        
        if [ "$CROSS_HTTP_CODE" = "403" ] || [ "$CROSS_HTTP_CODE" = "404" ]; then
            print_test 0 "Cross-outlet access correctly blocked (HTTP ${CROSS_HTTP_CODE})"
        else
            echo -e "${RED}✗ FAIL${NC}: Cross-outlet access should be blocked, got HTTP ${CROSS_HTTP_CODE}"
            echo "Response: ${CROSS_BODY}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠ SKIP${NC}: Managers have same outlet or no test invoice available"
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}All API tests passed!${NC}"
echo "=========================================="

