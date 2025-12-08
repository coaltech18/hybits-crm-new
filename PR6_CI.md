# PR: ci/infra - CI Pipeline & Branch Protection

## Summary
Add GitHub Actions CI pipeline for automated build, lint, and type-check on PRs. Include PR template and branch protection documentation.

## What Changed
- Created `.github/workflows/ci.yml`:
  - Runs on PRs and pushes to `main`/`develop`
  - Executes: `npm ci`, `npm run lint`, `npm run type-check`, `npm run build`
  - Uploads build artifacts for debugging
- Created `.github/PULL_REQUEST_TEMPLATE.md`:
  - Standard PR template
  - Sections for manual smoke tests, risk level, rollback steps
- Created `.github/BRANCH_PROTECTION.md`:
  - Instructions for protecting `main` branch
  - Requires CI checks to pass and PR approval

## Files Changed
- `.github/workflows/ci.yml` (NEW)
- `.github/PULL_REQUEST_TEMPLATE.md` (NEW)
- `.github/BRANCH_PROTECTION.md` (NEW)

## Manual Smoke Tests

1. **Test CI Workflow:**
   - Create a test PR to `main` or `develop`
   - Verify GitHub Actions runs automatically
   - Check that all steps pass:
     - Install dependencies
     - Run linter
     - Type check
     - Build
   - Verify build artifacts are uploaded

2. **Test PR Template:**
   - Create a new PR
   - Verify template is pre-filled
   - Fill in required sections
   - Submit PR

3. **Set Up Branch Protection:**
   - Follow instructions in `.github/BRANCH_PROTECTION.md`
   - Configure branch protection rules
   - Test by trying to merge without approval (should fail)
   - Test by merging with approval and passing CI (should succeed)

## Risk Level
**Low** - CI configuration only. No code changes. Can be disabled if issues arise.

## Rollout Plan
1. Merge to `main` branch
2. CI will run automatically on next PR
3. Set up branch protection using provided instructions
4. Monitor CI runs for first few PRs
5. Adjust workflow if needed

## Rollback Steps
```bash
git revert <commit-hash>
```
Or disable workflow in GitHub Actions settings.

## Notes
- CI workflow requires GitHub Actions to be enabled
- Branch protection must be configured manually in GitHub settings
- PR template will be used automatically for new PRs
- Consider adding more checks (e.g., test coverage) in future

