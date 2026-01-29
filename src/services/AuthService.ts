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
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('Login failed. No user data returned.');
  }

  // 2. Fetch user profile from user_profiles table
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found. Please contact support.');
  }

  // Check if user is active
  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error('Your account has been deactivated. Please contact admin.');
  }

  // 3. If manager, fetch assigned outlets
  let outlets: Outlet[] = [];
  let selectedOutlet: string | null = null;

  if (profile.role === 'manager') {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id, outlets(*)')
      .eq('user_id', authData.user.id);

    if (assignmentsError) {
      console.error('Error fetching outlet assignments:', assignmentsError);
    } else if (assignments && assignments.length > 0) {
      outlets = assignments
        .map((a: any) => a.outlets)
        .filter((o: Outlet | null) => o !== null) as Outlet[];

      // Auto-select first outlet if only one assigned
      if (outlets.length === 1) {
        selectedOutlet = outlets[0].id;
      }
    }
  }

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
  const { error } = await supabase.auth.signOut();
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
 * Get current user profile with outlets
 */
export async function getCurrentUserProfile(): Promise<LoginResponse | null> {
  const session = await getCurrentSession();

  if (!session?.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // If manager, fetch assigned outlets
  let outlets: Outlet[] = [];
  let selectedOutlet: string | null = null;

  if (profile.role === 'manager') {
    const { data: assignments } = await supabase
      .from('user_outlet_assignments')
      .select('outlet_id, outlets(*)')
      .eq('user_id', session.user.id);

    if (assignments && assignments.length > 0) {
      outlets = assignments
        .map((a: any) => a.outlets)
        .filter((o: Outlet | null) => o !== null) as Outlet[];

      if (outlets.length === 1) {
        selectedOutlet = outlets[0].id;
      }
    }
  }

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
