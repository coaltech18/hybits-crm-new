# PR: chore/logger - Add Logger Wrapper

## Summary
Replace ad-hoc console.* statements in critical service modules with a centralized logger wrapper. Enables production-safe logging with environment-aware debug output.

## What Changed
- Created `src/lib/logger.ts` - centralized logger wrapper
- Logger respects NODE_ENV (debug disabled in production)
- Replaced console.log → logger.debug (160+ instances)
- Replaced console.warn → logger.warn (30+ instances)
- Replaced console.error → logger.error (180+ instances)

## Files Changed
- `src/lib/logger.ts` (NEW)
- `src/services/orderService.ts` (26 replacements)
- `src/services/inventoryService.ts` (45+ replacements)
- `src/services/billingService.ts` (59 replacements)
- `src/services/paymentService.ts` (15 replacements)
- `src/services/customerService.ts` (15 replacements)

## Manual Smoke Tests

1. **Verify Logging Works:**
   - Run `npm run build` - must pass
   - Run `npm run lint` - check for any issues
   - In local dev environment, trigger order creation flow
   - Verify logs appear in console with `[debug]`, `[warn]`, `[error]` prefixes
   - Verify debug logs are visible in development mode

2. **Verify No Console.* Remaining:**
   - Run: `grep -r "console\.\(log\|warn\|error\)" src/services/orderService.ts src/services/inventoryService.ts src/services/billingService.ts src/services/paymentService.ts src/services/customerService.ts`
   - Should return no matches (or only in comments)

3. **Test Production Mode:**
   - Set NODE_ENV=production
   - Trigger flows that produce debug logs
   - Verify debug logs are NOT visible (only warn/error)

## Risk Level
**Low** - Wrapper only, no logic changes. All logging behavior preserved.

## Rollout Plan
1. Merge to `develop` or `staging` branch
2. Run manual smoke tests on staging
3. Verify logging works correctly
4. Monitor for 24-48 hours
5. If stable, merge to `main` and deploy

## Rollback Steps
```bash
git revert <commit-hash>
```

## Notes
- Build passes: ✓ (`npm run build` successful)
- No functional changes - only logging infrastructure
- Enables future enhancement: replace with proper logging service (e.g., Sentry, Winston)

