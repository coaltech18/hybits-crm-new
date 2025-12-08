# Branch Protection Setup

## Required Settings for `main` Branch

To protect the main branch, configure the following in GitHub repository settings:

### Path: Settings → Branches → Branch protection rules → Add rule

**Branch name pattern:** `main`

**Protect matching branches:**
- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners (if CODEOWNERS file exists)
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - ✅ Status checks:
    - `build-and-lint` (from CI workflow)
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

**Restrict who can push to matching branches:**
- ✅ Restrict pushes that create files larger than 100 MB

## Optional: Protect `develop` Branch

Apply similar rules to `develop` branch with:
- Require 1 approval
- Require CI checks to pass
- Allow force pushes (for hotfixes)

## Setup Instructions

1. Go to repository Settings → Branches
2. Click "Add rule"
3. Enter branch name: `main`
4. Configure settings as above
5. Click "Create"
6. Repeat for `develop` if desired

## Notes

- CI workflow must be enabled in Actions settings
- Status checks will appear after first PR is created
- Admins can still merge with bypass (consider disabling for stricter control)

