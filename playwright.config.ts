import { defineConfig, devices } from '@playwright/test';
import { FAKE_SUPABASE_ANON_KEY, FAKE_SUPABASE_URL } from './tests/e2e/support/env';

// Smoke tests render every page against an in-memory Supabase mock
// (tests/e2e/support). The dev server gets a fake project URL and key, so the
// app never talks to a real Supabase project; any request that reaches the
// network anyway is aborted by the test fixture.
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  // A production build, as users get it: no on-demand compiling, so the first
  // page load in each parallel test is as fast as the rest.
  webServer: {
    command: `npx vite build --outDir build-e2e --emptyOutDir && npx vite preview --outDir build-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    // Never attach to a server started by hand: it would carry the real .env.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: FAKE_SUPABASE_ANON_KEY,
    },
  },
});
