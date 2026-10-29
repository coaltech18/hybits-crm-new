import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// main.tsx checks these before importing the app and shows a configuration
// error screen; this throw is a last-resort guard for other entry points.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

/**
 * localStorage key the Supabase client stores the session under. This is the
 * same value supabase-js derives by default (`sb-<project-ref>-auth-token`),
 * set explicitly so logout can remove exactly these keys and nothing else.
 */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl.trim()).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
  },
});
