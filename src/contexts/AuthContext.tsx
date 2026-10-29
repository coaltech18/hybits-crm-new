import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthState, UserProfile, Outlet, UserRole } from '@/types';
import * as authService from '@/services/authService';
import type { LoginResponse } from '@/services/authService';
import { supabase, SUPABASE_AUTH_STORAGE_KEY } from '@/lib/supabase';

// ================================================================
// AUTH CONTEXT
// ================================================================
//
// RULES:
// 1. Profile fetch has a 15-second timeout. On timeout or a network/query
//    error at startup, the stored session is kept and `authError` is set;
//    ProtectedRoute shows a "Couldn't load your profile" screen (Retry /
//    Sign out). isAuthenticated is never true without a loaded user.
// 2. A missing profile, missing/invalid role or deactivated account (at
//    startup, login, or a later re-check) signs out globally and redirects
//    to /login.
// 3. The onAuthStateChange callback is synchronous and never awaits a
//    Supabase call: the client runs it while holding its auth lock, so any
//    nested getSession()/query would deadlock until the timeout. Work is
//    deferred with setTimeout (per the Supabase docs).
// 4. On SIGNED_IN for a different user, USER_UPDATED, or a SIGNED_IN /
//    TOKEN_REFRESHED more than 10 minutes after the last check, the profile
//    is re-loaded and re-validated (catches deactivation without reload).
//
// ================================================================

const PROFILE_FETCH_TIMEOUT_MS = 15000;
const PROFILE_REVALIDATE_MS = 10 * 60 * 1000;
const VALID_ROLES: UserRole[] = ['admin', 'manager', 'accountant'];

type LogoutScope = 'local' | 'global';

interface AuthContextValue extends AuthState {
  isAuthReady: boolean;
  /** `redirectTo` must be a same-origin path; anything else falls back to /dashboard. */
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedOutlet: (outletId: string | null) => void;
  /** Re-fetch profile + outlets. Rejects on network/timeout errors (state is kept). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Logged out state - loading false, not authenticated
const LOGGED_OUT_STATE: AuthState = {
  user: null,
  profile: null,
  outlets: [],
  selectedOutlet: null,
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
  isManager: false,
  isAccountant: false,
  authError: null,
};

// Initial state - loading true, not authenticated
const INITIAL_STATE: AuthState = { ...LOGGED_OUT_STATE, isLoading: true };

function buildAuthState(
  profile: UserProfile,
  outlets: Outlet[],
  selectedOutlet: string | null
): AuthState {
  return {
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      is_active: profile.is_active,
    },
    profile,
    outlets,
    selectedOutlet,
    isLoading: false,
    isAuthenticated: true,
    isAdmin: profile.role === 'admin',
    isManager: profile.role === 'manager',
    isAccountant: profile.role === 'accountant',
    authError: null,
  };
}

/** Returns a user-facing logout reason, or null when the profile may use the app. */
function validateProfile(profile: UserProfile | null | undefined): string | null {
  if (!profile) return 'User profile not found. Please contact support.';
  if (!profile.role) return 'Your account has no role assigned. Please contact admin.';
  if (!VALID_ROLES.includes(profile.role)) return 'Your account has an invalid role. Please contact admin.';
  if (!profile.is_active) return 'Your account has been deactivated. Please contact admin.';
  return null;
}

/** Fetch the profile; rejects on timeout or network/query error, resolves null when there is no profile. */
function fetchProfileWithTimeout(userId?: string): Promise<LoginResponse | null> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Profile fetch timed out after ${PROFILE_FETCH_TIMEOUT_MS / 1000}s`));
    }, PROFILE_FETCH_TIMEOUT_MS);

    authService.getCurrentUserProfile(userId).then(
      (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

/** Remove only the Supabase auth keys (session, PKCE verifier, user) from localStorage. */
function clearSupabaseAuthStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === SUPABASE_AUTH_STORAGE_KEY || key.startsWith(SUPABASE_AUTH_STORAGE_KEY + '-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.error('[AuthContext] Error clearing auth storage:', err);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // Lifecycle / bookkeeping refs
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const initDoneRef = useRef(false);
  const isLoginInProgressRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const lastProfileCheckRef = useRef(0);
  const hasRecordedRestoreRef = useRef(false);

  // useNavigate() changes identity on every navigation under BrowserRouter;
  // keep the latest in a ref so the callbacks below stay stable.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // ================================================================
  // FORCE LOGOUT - Clears the session and redirects to login.
  // 'local' ends only this browser's session; 'global' revokes every
  // device (used when the account itself is unusable).
  // ================================================================
  const forceLogout = useCallback(async (reason: string, scope: LogoutScope = 'local') => {
    console.warn('[AuthContext] Logout:', reason, `(scope: ${scope})`);

    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error) console.error('[AuthContext] signOut error:', error.message);
    } catch (err) {
      console.error('[AuthContext] Error during signOut:', err);
    }

    // signOut keeps the session when the network call fails; make sure it is gone.
    clearSupabaseAuthStorage();
    loadedUserIdRef.current = null;
    lastProfileCheckRef.current = 0;

    if (isMountedRef.current) {
      setState(LOGGED_OUT_STATE);
    }

    navigateRef.current('/login', { replace: true });
  }, []);

  // ================================================================
  // APPLY A LOADED PROFILE (keeps the chosen outlet when still valid)
  // ================================================================
  const applyProfile = useCallback((response: LoginResponse) => {
    loadedUserIdRef.current = response.profile.id;
    lastProfileCheckRef.current = Date.now();
    setState((prev) => {
      const keepSelected =
        prev.user?.id === response.profile.id &&
        prev.selectedOutlet !== null &&
        response.outlets.some((o) => o.id === prev.selectedOutlet);
      return buildAuthState(
        response.profile,
        response.outlets,
        keepSelected ? prev.selectedOutlet : response.selectedOutlet
      );
    });
  }, []);

  // ================================================================
  // INITIALIZE AUTH + SUBSCRIBE TO AUTH EVENTS
  // ================================================================
  useEffect(() => {
    isMountedRef.current = true;

    async function initializeAuth() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (isMountedRef.current) {
            await forceLogout('Session error: ' + sessionError.message);
          }
          return;
        }

        if (!session) {
          if (isMountedRef.current) setState(LOGGED_OUT_STATE);
          return;
        }

        let response: LoginResponse | null;
        try {
          response = await fetchProfileWithTimeout(session.user.id);
        } catch (profileError) {
          // Network/timeout: keep the stored session and let the user retry.
          console.error('[AuthContext] Profile load failed', profileError);
          if (isMountedRef.current) {
            setState({
              ...LOGGED_OUT_STATE,
              authError: errorMessage(profileError, 'Could not load your profile.'),
            });
          }
          return;
        }

        if (!isMountedRef.current) return;

        const reason = validateProfile(response?.profile);
        if (reason || !response) {
          await forceLogout(reason ?? 'User profile not found.', 'global');
          return;
        }

        applyProfile(response);

        // Restored sessions also count as a login (fire-and-forget, once).
        if (!hasRecordedRestoreRef.current) {
          hasRecordedRestoreRef.current = true;
          setTimeout(() => {
            void authService.recordLogin();
          }, 0);
        }
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        if (!isMountedRef.current) return;
        await forceLogout('Initialization failed: ' + errorMessage(error, 'Unknown error'));
      } finally {
        initDoneRef.current = true;
      }
    }

    // Deferred profile re-check, run outside the auth lock.
    async function reloadProfile(userId: string) {
      if (!isMountedRef.current || isLoginInProgressRef.current) return;
      try {
        const response = await fetchProfileWithTimeout(userId);
        if (!isMountedRef.current || isLoginInProgressRef.current) return;
        const reason = validateProfile(response?.profile);
        if (reason || !response) {
          await forceLogout(reason ?? 'User profile not found.', 'global');
          return;
        }
        applyProfile(response);
      } catch (err) {
        // Network/timeout: keep the current session and state.
        console.error('[AuthContext] Profile re-check failed, keeping current session:', err);
      }
    }

    // StrictMode mounts effects twice; run the one-time init once but always
    // (re)subscribe, since the cleanup below unsubscribes.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      void initializeAuth();
    }

    // IMPORTANT: synchronous callback; never await Supabase calls here.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled by initializeAuth
      if (!isMountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null;
        lastProfileCheckRef.current = 0;
        setState(LOGGED_OUT_STATE);
        navigateRef.current('/login', { replace: true });
        return;
      }

      if (!session) {
        setTimeout(() => {
          void forceLogout('Session became null');
        }, 0);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => {
          navigateRef.current('/reset-password', { replace: true });
        }, 0);
      }

      // initializeAuth / login() load the profile themselves.
      if (!initDoneRef.current || isLoginInProgressRef.current) return;

      const userId = session.user.id;
      const isDifferentUser = userId !== loadedUserIdRef.current;
      const isStale = Date.now() - lastProfileCheckRef.current > PROFILE_REVALIDATE_MS;

      const shouldReload =
        event === 'USER_UPDATED' ||
        ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && isDifferentUser) ||
        ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && isStale);

      if (shouldReload) {
        // Throttle repeated events while the reload is in flight.
        lastProfileCheckRef.current = Date.now();
        setTimeout(() => {
          void reloadProfile(userId);
        }, 0);
      }
    });

    return () => {
      isMountedRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [forceLogout, applyProfile]);

  // ================================================================
  // LOGIN - Only navigates AFTER the profile is loaded and valid
  // ================================================================
  const login = useCallback(async (email: string, password: string, redirectTo?: string) => {
    isLoginInProgressRef.current = true;

    try {
      const response = await authService.login({ email, password });

      const reason = validateProfile(response.profile);
      if (reason) {
        throw new authService.AccountUnavailableError(reason);
      }

      applyProfile(response);
      navigateRef.current(authService.safeRedirectPath(redirectTo), { replace: true });
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      if (!(error instanceof authService.SignInError)) {
        // A session was created but cannot be used: end it.
        const scope: LogoutScope = error instanceof authService.AccountUnavailableError ? 'global' : 'local';
        await forceLogout(errorMessage(error, 'Login failed'), scope);
      }
      throw error; // let the login form display the error
    } finally {
      isLoginInProgressRef.current = false;
    }
  }, [forceLogout, applyProfile]);

  // ================================================================
  // LOGOUT (this device only)
  // ================================================================
  const logout = useCallback(async () => {
    await forceLogout('User initiated logout', 'local');
  }, [forceLogout]);

  // ================================================================
  // REFRESH PROFILE - re-fetch profile + outlets (e.g. after an admin
  // changes outlets). Logs out only if the profile is now unusable; on a
  // network/timeout error keeps the current state, sets authError and
  // rethrows so the caller can tell the user.
  // ================================================================
  const refreshProfile = useCallback(async () => {
    let response: LoginResponse | null;
    try {
      response = await fetchProfileWithTimeout(loadedUserIdRef.current ?? undefined);
    } catch (err) {
      console.error('[AuthContext] Profile refresh failed, keeping current state:', err);
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, authError: errorMessage(err, 'Could not refresh your profile.') }));
      }
      throw err;
    }

    if (!isMountedRef.current) return;
    const reason = validateProfile(response?.profile);
    if (reason || !response) {
      await forceLogout(reason ?? 'User profile not found.', 'global');
      return;
    }
    applyProfile(response);
  }, [forceLogout, applyProfile]);

  // ================================================================
  // SET SELECTED OUTLET (must be one of the user's outlets)
  // ================================================================
  const setSelectedOutlet = useCallback((outletId: string | null) => {
    setState((prev) =>
      outletId === null || prev.outlets.some((o) => o.id === outletId)
        ? { ...prev, selectedOutlet: outletId }
        : prev
    );
  }, []);

  const value: AuthContextValue = {
    ...state,
    isAuthReady: !state.isLoading && state.isAuthenticated && state.user !== null,
    login,
    logout,
    setSelectedOutlet,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ================================================================
// USE AUTH HOOK
// ================================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
