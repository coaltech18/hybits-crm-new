#!/bin/bash
# ============================================================================
# VERIFY SUPABASE EDGE FUNCTIONS
# ============================================================================
# This script verifies that all required Edge Functions exist and are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FUNCTIONS_DIR="supabase/functions"
REQUIRED_FUNCTIONS=(
    "manage-users"
    "generate-invoice-pdf"
    "run-mark-overdue"
)

echo -e "${YELLOW}Verifying Edge Functions...${NC}"
echo ""

ALL_OK=true

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    FUNC_PATH="${FUNCTIONS_DIR}/${func}"
    INDEX_FILE="${FUNC_PATH}/index.ts"
    
    if [ -d "$FUNC_PATH" ]; then
        if [ -f "$INDEX_FILE" ]; then
            echo -e "${GREEN}✓ ${func} - exists and has index.ts${NC}"
        else
            echo -e "${RED}✗ ${func} - directory exists but index.ts is missing${NC}"
            ALL_OK=false
        fi
    else
        echo -e "${RED}✗ ${func} - directory not found${NC}"
        ALL_OK=false
    fi
done

echo ""

# Check shared utilities
SHARED_PATH="${FUNCTIONS_DIR}/_shared"
if [ -d "$SHARED_PATH" ]; then
    echo -e "${GREEN}✓ _shared directory exists${NC}"
else
    echo -e "${YELLOW}⚠ _shared directory not found (optional)${NC}"
fi

# Check deno.json
DENO_JSON="${FUNCTIONS_DIR}/deno.json"
if [ -f "$DENO_JSON" ]; then
    echo -e "${GREEN}✓ deno.json exists${NC}"
else
    echo -e "${YELLOW}⚠ deno.json not found${NC}"
fi

echo ""

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}All required Edge Functions are present!${NC}"
    exit 0
else
    echo -e "${RED}Some Edge Functions are missing or incomplete.${NC}"
    exit 1
fi

