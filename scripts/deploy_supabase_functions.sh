#!/bin/bash
# ============================================================================
# DEPLOY SUPABASE EDGE FUNCTIONS
# ============================================================================
# This script deploys all Edge Functions to Supabase
# Usage: ./scripts/deploy_supabase_functions.sh [--project-ref PROJECT_REF]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed.${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}Warning: Not logged in to Supabase.${NC}"
    echo "Run: supabase login"
    exit 1
fi

# Get project ref from argument or prompt
PROJECT_REF="${1#--project-ref=}"
if [ -z "$PROJECT_REF" ]; then
    echo -e "${YELLOW}Enter your Supabase project reference ID:${NC}"
    read PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}Error: Project reference ID is required${NC}"
    exit 1
fi

echo -e "${GREEN}Deploying Edge Functions to Supabase project: ${PROJECT_REF}${NC}"
echo ""

# List of functions to deploy
FUNCTIONS=(
    "manage-users"
    "generate-invoice-pdf"
    "run-mark-overdue"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}Deploying ${func}...${NC}"
    if supabase functions deploy "$func" --project-ref "$PROJECT_REF"; then
        echo -e "${GREEN}✓ ${func} deployed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to deploy ${func}${NC}"
        exit 1
    fi
    echo ""
done

echo -e "${GREEN}All Edge Functions deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set up cron job for run-mark-overdue (see scripts/schedule_mark_overdue.md)"
echo "2. Test functions using Supabase dashboard or curl"
echo "3. Monitor function logs in Supabase dashboard"

