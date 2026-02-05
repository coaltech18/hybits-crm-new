import { test, expect } from '@playwright/test';

test('Phase 0: App loads and login page is visible', async ({ page }) => {
    await page.goto('/login');

    // Page heading visible?
    await expect(page.getByText('Sign In')).toBeVisible();

    // Login button visible?
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();

    // Email input visible?
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Password input visible?
    await expect(page.locator('input[type="password"]')).toBeVisible();
});
