// Empty and error states for the two busiest pages. 'empty' answers every data
// query with no rows; 'error' fails every data request with a 500 (the session
// and profile still load, so the app shell renders).
import { expect, test } from '@playwright/test';
import { openApp } from './support/harness';

test.describe('dashboard', () => {
  test('empty: no balances, zero figures', async ({ page }) => {
    const app = await openApp(page, '/dashboard', { mode: 'empty' });
    await expect(page.getByRole('heading', { level: 1, name: 'Good afternoon, Anil' })).toBeVisible();
    await expect(page.getByText('Every issued invoice is paid.')).toBeVisible();
    await expect(page.getByText('HYB/IND/2026-27/0042')).toHaveCount(0);
    await app.expectHealthy();
  });

  test('error: warns that figures could not load', async ({ page }) => {
    const app = await openApp(page, '/dashboard', { mode: 'error' });
    await expect(page.getByRole('heading', { level: 1, name: 'Good afternoon, Anil' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Some figures could not load' })).toBeVisible();
    await expect(page.getByText('Unpaid invoices could not load. Use refresh to try again.')).toBeVisible();
    await app.expectHealthy();
  });
});

test.describe('invoices', () => {
  test('empty: first-run empty state', async ({ page }) => {
    const app = await openApp(page, '/invoices', { mode: 'empty' });
    await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
    await expect(page.getByText('No invoices yet')).toBeVisible();
    await app.expectHealthy();
  });

  test('error: shows the error with a retry button', async ({ page }) => {
    const app = await openApp(page, '/invoices', { mode: 'error' });
    await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Try again' }) });
    await expect(alert).toBeVisible();
    await app.expectHealthy();
  });

  test('error: does not claim there are no invoices', async ({ page }) => {
    await openApp(page, '/invoices', { mode: 'error' });
    await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Try again' }) })).toBeVisible();
    await expect(page.getByText('Invoices could not be loaded. Check the message above and try again.')).toBeVisible();
    await expect(page.getByText('No invoices yet')).toHaveCount(0);
    await expect(page.getByText(/^\d+ invoices?$/)).toHaveCount(0);
  });
});
