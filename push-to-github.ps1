# PowerShell script to push to GitHub
# Run this script: .\push-to-github.ps1

Write-Host "=== Checking Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Checking Remote Configuration ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== Current Branch ===" -ForegroundColor Cyan
git branch --show-current

Write-Host "`n=== Recent Commits ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Checking if main branch is up to date ===" -ForegroundColor Cyan
git checkout main
git status

Write-Host "`n=== Attempting to Push ===" -ForegroundColor Yellow
Write-Host "If you see an error, you may need to:" -ForegroundColor Yellow
Write-Host "1. Add remote: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git" -ForegroundColor Yellow
Write-Host "2. Or authenticate with GitHub" -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Do you want to push now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    git push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Successfully pushed to GitHub!" -ForegroundColor Green
    } else {
        Write-Host "`n✗ Push failed. Check the error above." -ForegroundColor Red
    }
} else {
    Write-Host "Push cancelled." -ForegroundColor Yellow
}

