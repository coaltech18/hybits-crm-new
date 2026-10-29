import { supabase } from '@/lib/supabase';
import type { UserProfile, Outlet } from '@/types';

// ================================================================
// AUTHENTICATION SERVICE
// ================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  profile: UserProfile;
  outlets: Outlet[];
  selectedOutlet: string | null;
}

/**
 * signInWithPassword itself failed (wrong password, rate limit, network).
 * No new session was created, so callers must not sign the user out.
 */
export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInError';
  }
}

/**
 * The account cannot use the app (profile missing or deactivated).
 * Callers should revoke the session everywhere.
 */
export class AccountUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountUnavailableError';
  }
}

/**
 * Returns `path` when it is a same-origin relative path that is safe to
 * navigate to after login, otherwise '/dashboard'.
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !path.startsWith('/login') &&
    !path.startsWith('/reset-password')
  ) {
    return path;
  }
  return '/dashboard';
}

/**
 * Record a successful sign-in (SECURITY DEFINER RPC from migration 042).
 * Fire-and-forget: a failure is logged, never shown to the user.
 */
export async function recordLogin(): Promise<void> {
  const { error } = await supabase.rpc('record_login');
  if (error) {
    console.warn('record_login failed', error.message);
  }
}

interface AssignmentRow {
  outlet_id: string;
  outlets: Outlet | Outlet[] | null;
}

/**
 * Load the outlets a user may work with. Throws on query errors so the caller
 * can surface them instead of silently showing zero outlets.
 */
async function loadOutletsForProfile(
  profile: UserProfile
): Promise<{ outlets: Outlet[]; selectedOutlet: string | null }> {
  if (profile.role === 'admin' || profile.role === 'accountant') {
    // Admin and Accountant: all active outlets
    const { data: allOutlets, error: outletsError } = await supabase
      .from('outlets')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (outletsError) {
      throw new Error('Failed to load outlets: ' + outletsError.message);
    }
    return { outlets: (allOutlets ?? []) as Outlet[], selectedOutlet: null };
  }

  if (profile.role === 'manager') {
    // Manager: only assigned outlets
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id, outlets(*)')
      .eq('user_id', profile.id);

    if (assignmentsError) {
      throw new Error('Failed to load outlets: ' + assignmentsError.message);
    }

    const outlets = ((assignments ?? []) as AssignmentRow[])
      .flatMap((a) => (Array.isArray(a.outlets) ? a.outlets : a.outlets ? [a.outlets] : []))
      .filter((o) => o.is_active);

    // Auto-select the outlet when only one is assigned
    return { outlets, selectedOutlet: outlets.length === 1 ? outlets[0].id : null };
  }

  return { outlets: [], selectedOutlet: null };
}

/**
 * Login user with email and password
 * Returns user profile with role and assigned outlets (for managers)
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (authError) {
    throw new SignInError(authError.message);
  }

  if (!authData.user) {
    throw new SignInError('Login failed. No user data returned.');
  }

  // 2. Fetch user profile from user_profiles table
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Could not load your profile: ' + profileError.message);
  }

  if (!profile) {
    throw new AccountUnavailableError('User profile not found. Please contact support.');
  }

  // Check if user is active (the caller signs the session out)
  if (!profile.is_active) {
    throw new AccountUnavailableError('Your account has been deactivated. Please contact admin.');
  }

  // 3. Record last_login (fire-and-forget; must not block or fail the login)
  void recordLogin();

  // 4. Fetch outlets based on role
  const { outlets, selectedOutlet } = await loadOutletsForProfile(profile as UserProfile);

  return {
    profile,
    outlets,
    selectedOutlet,
  };
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get current authenticated user session
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return session;
}

/**
 * Get current user profile with outlets.
 *
 * Pass `userId` when it is already known (e.g. from an auth event) to skip the
 * extra getSession() call. Returns null when there is no session or no profile
 * row; throws on network/query errors.
 */
export async function getCurrentUserProfile(userId?: string): Promise<LoginResponse | null> {
  let id = userId;
  if (!id) {
    const session = await getCurrentSession();
    id = session?.user?.id;
  }

  if (!id) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Could not load your profile: ' + profileError.message);
  }

  if (!profile) {
    return null;
  }

  // A deactivated profile is returned as-is so the caller's validation logs
  // the user out; RLS may refuse the outlet queries for inactive users.
  if (!profile.is_active) {
    return { profile, outlets: [], selectedOutlet: null };
  }

  const { outlets, selectedOutlet } = await loadOutletsForProfile(profile as UserProfile);

  return {
    profile,
    outlets,
    selectedOutlet,
  };
}

/**
 * Reset password (send reset email)
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
