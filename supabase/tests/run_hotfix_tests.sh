#!/bin/bash
# ===================================================================
# HOTFIX VERIFICATION — Master Test Runner
# ===================================================================
#
# This script runs all verification tests for the hotfixes
#
# Usage:
#   chmod +x run_hotfix_tests.sh
#   ./run_hotfix_tests.sh
#
# ===================================================================

set -e

echo "=========================================="
echo "HYBITS CRM — HOTFIX VERIFICATION"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/tests/hotfix_verification.sql" ]; then
    echo "Error: Run this script from the project root directory"
    exit 1
fi

echo "Step 1: Database Schema Checks"
echo "--------------------------------"
echo "Please run the SQL queries from: supabase/tests/hotfix_verification.sql"
echo "in your Supabase SQL Editor or psql connection"
echo ""
read -p "Press Enter after completing SQL checks..."

echo ""
echo "Step 2: API & Edge Function Tests"
echo "-----------------------------------"
if [ -f "supabase/tests/hotfix_api_tests.sh" ]; then
    echo "Running API tests..."
    chmod +x supabase/tests/hotfix_api_tests.sh
    
    # Check if required env vars are set
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        echo "Warning: SUPABASE_URL and SUPABASE_ANON_KEY not set"
        echo "Please set environment variables before running API tests:"
        echo "  export SUPABASE_URL='https://your-project.supabase.co'"
        echo "  export SUPABASE_ANON_KEY='your-anon-key'"
        echo "  export MANAGER_A_EMAIL='manager-a@example.com'"
        echo "  export MANAGER_A_PASSWORD='password'"
        echo ""
        read -p "Press Enter to continue anyway (tests will fail)..."
    fi
    
    ./supabase/tests/hotfix_api_tests.sh
else
    echo "Error: hotfix_api_tests.sh not found"
    exit 1
fi

echo ""
echo "Step 3: UI Manual Checks"
echo "------------------------"
echo "Please follow the checklist in: supabase/tests/hotfix_ui_checklist.md"
echo ""
read -p "Press Enter after completing UI checks..."

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Review the results above and check:"
echo "  ✓ All SQL queries return expected results"
echo "  ✓ API tests pass"
echo "  ✓ UI manual checks completed"
echo ""

