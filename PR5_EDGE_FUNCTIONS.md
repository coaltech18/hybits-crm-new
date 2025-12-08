# PR: ops/edge-functions - Edge Functions Deployment & Scheduling

## Summary
Add deployment scripts and scheduling instructions for Supabase Edge Functions. Verify all required functions exist and provide automation for deployment.

## What Changed
- Created `scripts/deploy_supabase_functions.sh` - automated deployment script
- Created `scripts/verify_edge_functions.sh` - verification script
- Created `scripts/schedule_mark_overdue.md` - scheduling guide with 3 options:
  - Supabase cron jobs (pg_cron) - recommended
  - GitHub Actions
  - External cron services

## Files Changed
- `scripts/deploy_supabase_functions.sh` (NEW)
- `scripts/verify_edge_functions.sh` (NEW)
- `scripts/schedule_mark_overdue.md` (NEW)

## Verified Functions
All required Edge Functions exist:
- ✓ `manage-users` - User management function
- ✓ `generate-invoice-pdf` - PDF generation function
- ✓ `run-mark-overdue` - Overdue marking function

## Manual Smoke Tests

1. **Verify Functions Exist:**
   - Run: `./scripts/verify_edge_functions.sh`
   - Should show all functions as present

2. **Test Deployment (if Supabase CLI available):**
   - Run: `./scripts/deploy_supabase_functions.sh --project-ref YOUR_PROJECT_REF`
   - Verify functions deploy successfully
   - Check Supabase dashboard for deployed functions

3. **Test run-mark-overdue:**
   - Call function via curl (see schedule_mark_overdue.md)
   - Verify invoices/orders are marked overdue correctly
   - Check logs in Supabase dashboard

4. **Set Up Scheduling:**
   - Choose scheduling option from schedule_mark_overdue.md
   - Set up cron job for daily execution
   - Monitor first few runs

## Risk Level
**Low** - Scripts and documentation only. No code changes to functions themselves.

## Rollout Plan
1. Merge to `develop` or `staging` branch
2. Review deployment scripts
3. Deploy functions to staging using scripts
4. Set up scheduling for run-mark-overdue
5. Monitor for 1 week
6. Deploy to production

## Rollback Steps
```bash
git revert <commit-hash>
```
Functions remain deployed - only scripts/docs are reverted.

## Notes
- Scripts are Unix-compatible (use Git Bash on Windows)
- Scheduling should be set up after deployment
- Monitor function logs regularly
- Consider adding authentication to run-mark-overdue endpoint

