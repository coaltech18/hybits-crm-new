// Fake Supabase project the dev server is started with (playwright.config.ts).
// The app derives its session storage key from the project ref in the URL.
export const FAKE_SUPABASE_URL = 'https://hybits-e2e.supabase.co';
export const FAKE_SUPABASE_ANON_KEY = 'e2e-anon-key-not-a-real-key';
export const AUTH_STORAGE_KEY = `sb-${new URL(FAKE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/** "Today" for every test: the fixtures are dated around it. */
export const FIXED_NOW = new Date('2026-10-29T14:30:00+05:30');
