// Playwright fixture that opens the SPA against the in-memory Supabase mock.
//
//   const app = await openApp(page, '/invoices', { mode: 'empty' });
//   await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
//   await app.expectHealthy();
//
// Signed-in pages get a fake session in localStorage (under the key the app
// derives from the fake project URL) before any app script runs. Every
// *.supabase.co request is answered from fixtures.mjs; anything else that is
// not the dev server is aborted, and Google Fonts get an empty stylesheet.
import { expect, type Page } from '@playwright/test';
// Plain JS so plain Node scripts (e.g. a screenshot capture) can reuse them.
import { buildDb } from './fixtures.mjs';
import { buildSession, createHandler } from './mock-supabase.mjs';
import { AUTH_STORAGE_KEY, FIXED_NOW } from './env';

export type MockMode = 'normal' | 'empty' | 'error';

export interface OpenOptions {
  /** 'empty': every data table returns no rows. 'error': every data request fails with a 500. */
  mode?: MockMode;
  /** Open without a session (login, reset password). */
  signedOut?: boolean;
}

export const { db, refs } = buildDb();
const admin = db.user_profiles.find((u: { id: string }) => u.id === refs.U.admin);
const session = buildSession(admin);

/** Console noise that is not an app error. */
const IGNORED_CONSOLE = [/React Router Future Flag Warning/, /Download the React DevTools/];
/**
 * In error mode the browser logs every simulated 500, and the app logs the
 * failures it handled; both are expected there. Uncaught exceptions are not.
 */
const SIMULATED_500 = /status of 500|Simulated server error \(e2e mock\)|\(HTTP 500\)/;

export async function openApp(page: Page, path: string, { mode = 'normal', signedOut = false }: OpenOptions = {}) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    if (mode === 'error' && SIMULATED_500.test(text)) return;
    problems.push(`console.error: ${text}`);
  });
  page.on('pageerror', (e) => problems.push(`uncaught: ${e.stack || e.message}`));

  await page.clock.setFixedTime(FIXED_NOW);
  if (!signedOut) {
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: AUTH_STORAGE_KEY, value: JSON.stringify(session) },
    );
  }

  await page.route(
    (url) => !/^https?:\/\/localhost[:/]/.test(url.href) && !/^(data|blob):/.test(url.href),
    (route) => {
      const url = route.request().url();
      if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      if (/^https:\/\/[^/]+\.supabase\.co\//.test(url)) return createHandler({ db, session, mode })(route);
      problems.push(`unexpected network request: ${url}`);
      return route.abort();
    },
  );

  await page.goto(path);

  return {
    problems,
    /** No ErrorBoundary, no console errors, no uncaught exceptions, no stray requests. */
    async expectHealthy() {
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
      await expect(page.locator('.animate-pulse, .animate-spin, [aria-busy="true"]')).toHaveCount(0);
      expect(problems, 'console errors / uncaught exceptions / unexpected requests').toEqual([]);
    },
  };
}
