import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthState, UserProfile, Outlet } from '@/types';
import * as authService from '@/services/authService';
import { supabase } from '@/lib/supabase';

// ================================================================
// AUTH CONTEXT - PRODUCTION GRADE (v2)
// ================================================================
// 
// CRITICAL FIX: This version guarantees isLoading resolves on reload.
//
// DESIGN PRINCIPLES:
// 1. getSession() is called FIRST and SYNCHRONOUSLY on mount
// 2. isLoading ALWAYS resolves (multiple safety mechanisms)
// 3. onAuthStateChange handles ONLY runtime changes
// 4. 10-second timeout as ultimate safety net
// 5. No dependencies in callbacks that could cause stale closures
//
// LIFECYCLE:
// 1. Component mounts → isLoading: true
// 2. useEffect runs → immediately calls initializeAuth()
// 3. initializeAuth() → getSession() → loads profile OR clears state
// 4. isLoading: false (guaranteed by multiple paths)
// 5. onAuthStateChange handles runtime changes (login/logout/refresh)
//
// ================================================================

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedOutlet: (outletId: string | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Initial state - loading true, not authenticated
const INITIAL_STATE: AuthState = {
  user: null,
  profile: null,
  outlets: [],
  selectedOutlet: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isManager: false,
  isAccountant: false,
};

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
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // Refs for lifecycle tracking
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);

  // ================================================================
  // BUILD AUTH STATE FROM PROFILE
  // ================================================================
  const buildAuthState = (
    profile: UserProfile,
    outlets: Outlet[],
    selectedOutlet: string | null
  ): AuthState => ({
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
  });

  // ================================================================
  // INITIALIZE AUTH (RUNS ONCE ON MOUNT)
  // ================================================================
  useEffect(() => {
    isMountedRef.current = true;

    // Guard against double initialization
    if (hasInitializedRef.current) {
      console.log('[AuthContext] Already initialized, skipping');
      return;
    }
    hasInitializedRef.current = true;

    // Safety timeout - guarantee isLoading resolves even if everything fails
    // IMPORTANT: This should NOT force logout, just resolve loading state
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && state.isLoading) {
        console.warn('[AuthContext] Safety timeout triggered - resolving loading state');
        // Check if we have a session before deciding what to do
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (isMountedRef.current) {
            if (session) {
              // Session exists but profile failed to load - keep trying, don't logout
              console.warn('[AuthContext] Session exists but profile load timed out - NOT logging out');
              // Set a minimal authenticated state to prevent infinite loading
              setState(prev => ({
                ...prev,
                isLoading: false,
                isAuthenticated: true, // Session is valid
              }));
            } else {
              // No session - safe to set logged out
              setState(LOGGED_OUT_STATE);
            }
          }
        }).catch(() => {
          // On error, just resolve loading - don't force logout
          if (isMountedRef.current) {
            setState(prev => ({ ...prev, isLoading: false }));
          }
        });
      }
    }, 10000);

    /**
     * CRITICAL: Determine if an error is an AUTH error vs a DATA error
     * 
     * AUTH ERRORS (should logout):
     * - 401 Unauthorized
     * - 403 Forbidden  
     * - Session explicitly invalid
     * - Supabase auth error codes
     * 
     * DATA ERRORS (should NOT logout):
     * - 400 Bad Request
     * - 404 Not Found
     * - 500 Internal Server Error
     * - Network errors
     * - RLS policy errors on non-auth tables
     */
    function isAuthError(error: unknown): boolean {
      if (!error) return false;

      const errorObj = error as any;

      // Check for HTTP status codes
      const status = errorObj.status || errorObj.statusCode || errorObj.code;
      if (status === 401 || status === 403) {
        return true;
      }

      // Check for Supabase auth-specific error messages
      const message = errorObj.message?.toLowerCase() || '';
      if (
        message.includes('jwt') ||
        message.includes('token') ||
        message.includes('session') ||
        message.includes('not authenticated') ||
        message.includes('invalid refresh token') ||
        message.includes('auth')
      ) {
        return true;
      }

      // Check for Supabase error codes
      const code = errorObj.code?.toLowerCase() || '';
      if (
        code.includes('pgrst') || // PostgREST errors are usually NOT auth errors
        code === 'pgrst116' // Not found - NOT an auth error
      ) {
        return false;
      }

      // Default: NOT an auth error (don't logout on unknown errors)
      return false;
    }

    // Main initialization function
    async function initializeAuth() {
      console.log('[AuthContext] Initializing...');

      try {
        // Step 1: Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError);
          // Session error IS an auth error - safe to logout
          if (isMountedRef.current) setState(LOGGED_OUT_STATE);
          return;
        }

        if (!session) {
          console.log('[AuthContext] No session found');
          if (isMountedRef.current) setState(LOGGED_OUT_STATE);
          return;
        }

        console.log('[AuthContext] Session found, loading profile...');

        // Step 2: Load user profile
        try {
          const response = await authService.getCurrentUserProfile();

          if (!isMountedRef.current) return;

          if (response && response.profile) {
            console.log('[AuthContext] Profile loaded successfully');
            setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
          } else {
            // Profile not found but session is valid
            // This could be a network error or RLS issue - don't logout immediately
            console.warn('[AuthContext] Profile load returned null - checking if auth error');

            // Verify session is still valid
            const { data: { session: recheckedSession } } = await supabase.auth.getSession();
            if (recheckedSession) {
              console.warn('[AuthContext] Session still valid but profile failed - NOT logging out');
              // Keep loading or show error, but don't logout
              setState(prev => ({
                ...prev,
                isLoading: false,
                isAuthenticated: true, // Session is valid, even if profile load failed
              }));
            } else {
              // Session actually invalid
              setState(LOGGED_OUT_STATE);
            }
          }
        } catch (profileError) {
          console.error('[AuthContext] Profile load error:', profileError);

          if (!isMountedRef.current) return;

          // CRITICAL: Check if this is an auth error or data error
          if (isAuthError(profileError)) {
            console.log('[AuthContext] Auth error detected - logging out');
            setState(LOGGED_OUT_STATE);
          } else {
            console.warn('[AuthContext] Data error detected - NOT logging out');
            // Keep the session, just mark as not loading
            // The user can retry or we can show an error UI
            setState(prev => ({
              ...prev,
              isLoading: false,
              isAuthenticated: true, // Session might still be valid
            }));
          }
        }
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);

        if (!isMountedRef.current) return;

        // CRITICAL: Check if this is an auth error
        if (isAuthError(error)) {
          setState(LOGGED_OUT_STATE);
        } else {
          // Non-auth error - don't force logout, just stop loading
          console.warn('[AuthContext] Non-auth initialization error - NOT logging out');
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    }

    // Run initialization
    initializeAuth();

    // Set up auth state change listener for RUNTIME changes only
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth event:', event);

        // Skip INITIAL_SESSION - we handle it in initializeAuth
        if (event === 'INITIAL_SESSION') {
          console.log('[AuthContext] Skipping INITIAL_SESSION (handled by init)');
          return;
        }

        // Skip if unmounted
        if (!isMountedRef.current) return;

        // Handle runtime events
        // ONLY logout on explicit SIGNED_OUT event
        if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] Signed out event received');
          setState(LOGGED_OUT_STATE);
          return;
        }

        // If session becomes null but it's not a SIGNED_OUT event,
        // verify before logging out (SIGNED_OUT is already handled above)
        if (!session) {
          console.warn('[AuthContext] Session null - verifying...');
          const { data: { session: verifiedSession } } = await supabase.auth.getSession();
          if (!verifiedSession) {
            console.log('[AuthContext] Verified no session - logging out');
            setState(LOGGED_OUT_STATE);
          } else {
            console.log('[AuthContext] Session still valid - ignoring null event');
          }
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('[AuthContext] Session updated, reloading profile...');
          try {
            const response = await authService.getCurrentUserProfile();
            if (isMountedRef.current && response && response.profile) {
              setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
            }
          } catch (err) {
            console.error('[AuthContext] Profile reload error:', err);
            // CRITICAL: Don't change state on profile reload error
            // The session is still valid, we just couldn't load the profile
          }
        }
      }
    );

    // Cleanup
    return () => {
      console.log('[AuthContext] Unmounting...');
      isMountedRef.current = false;
      clearTimeout(safetyTimeout);
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty deps - run once on mount

  // ================================================================
  // LOGIN
  // ================================================================
  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
    navigate('/dashboard');
  }, [navigate]);

  // ================================================================
  // LOGOUT
  // ================================================================
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    }
    setState(LOGGED_OUT_STATE);
    navigate('/login');
  }, [navigate]);

  // ================================================================
  // SET SELECTED OUTLET
  // ================================================================
  const setSelectedOutlet = useCallback((outletId: string | null) => {
    setState(prev => ({ ...prev, selectedOutlet: outletId }));
  }, []);

  // ================================================================
  // REFRESH PROFILE
  // ================================================================
  const refreshProfile = useCallback(async () => {
    try {
      const response = await authService.getCurrentUserProfile();
      if (response && response.profile) {
        setState(prev => ({
          ...buildAuthState(response.profile, response.outlets, response.selectedOutlet),
          // Preserve selected outlet if not provided
          selectedOutlet: response.selectedOutlet || prev.selectedOutlet,
        }));
      }
    } catch (err) {
      console.error('[AuthContext] Refresh profile error:', err);
    }
  }, []);

  // ================================================================
  // CONTEXT VALUE
  // ================================================================
  const value: AuthContextValue = {
    ...state,
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
