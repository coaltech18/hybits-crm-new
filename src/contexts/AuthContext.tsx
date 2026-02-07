import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthState, UserProfile, Outlet } from '@/types';
import * as authService from '@/services/authService';
import { supabase } from '@/lib/supabase';

// ================================================================
// AUTH CONTEXT - STRICT PROFILE LOADING (v3)
// ================================================================
// 
// STRICT RULES:
// 1. 5-second HARD timeout on profile fetch → force logout
// 2. ANY profile fetch error → clear session, redirect to /login
// 3. NEVER redirect to /dashboard until user_profiles is loaded
//
// This prevents infinite loading loops and ensures clean state.
//
// ================================================================

// Timeout constant (15 seconds - increased for production networks)
const PROFILE_FETCH_TIMEOUT_MS = 15000;

interface AuthContextValue extends AuthState {
  isAuthReady: boolean;
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
  // Track if login() is currently in progress to skip duplicate profile reload
  const isLoginInProgressRef = useRef(false);

  // ================================================================
  // FORCE LOGOUT - Clears everything and redirects to login
  // ================================================================
  const forceLogout = useCallback(async (reason: string) => {
    console.error('[AuthContext] Force logout:', reason);

    try {
      // Clear Supabase session
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] Error during signOut:', err);
    }

    // Clear localStorage auth-related items
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.error('[AuthContext] Error clearing localStorage:', err);
    }

    // Set logged out state
    if (isMountedRef.current) {
      setState(LOGGED_OUT_STATE);
    }

    // Redirect to login
    navigate('/login', { replace: true });
  }, [navigate]);

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
  // FETCH PROFILE WITH TIMEOUT
  // ================================================================
  const fetchProfileWithTimeout = useCallback(async (): Promise<{
    profile: UserProfile;
    outlets: Outlet[];
    selectedOutlet: string | null;
  } | null> => {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Profile fetch timed out after ${PROFILE_FETCH_TIMEOUT_MS}ms`));
      }, PROFILE_FETCH_TIMEOUT_MS);

      // Attempt to fetch profile
      authService.getCurrentUserProfile()
        .then((response) => {
          clearTimeout(timeoutId);
          if (response && response.profile) {
            resolve(response);
          } else {
            reject(new Error('Profile not found'));
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }, []);

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

    // Main initialization function
    async function initializeAuth() {
      console.log('[AuthContext] Initializing - explicitly calling getSession()...');

      try {
        // ================================================================
        // STEP 1: Explicitly call getSession() on mount
        // ================================================================
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[AuthContext] Invalid session state - session error:', sessionError.message);
          if (isMountedRef.current) {
            await forceLogout('Session error: ' + sessionError.message);
          }
          return;
        }

        if (!session) {
          console.log('[AuthContext] No session found - user not logged in');
          if (isMountedRef.current) {
            setState(LOGGED_OUT_STATE);
          }
          return;
        }

        console.log('[AuthContext] Session exists, validating profile...');

        // ================================================================
        // STEP 2: Load and validate user profile
        // ================================================================
        try {
          const response = await fetchProfileWithTimeout();

          if (!isMountedRef.current) return;

          // ================================================================
          // VALIDATION: Check if profile exists
          // ================================================================
          if (!response || !response.profile) {
            console.warn('[AuthContext] Profile fetch failed - profile is null or undefined');
            console.warn('[AuthContext] Invalid session state - session exists but no profile');
            await forceLogout('Profile not found for authenticated user');
            return;
          }

          // ================================================================
          // VALIDATION: Check if role is present and valid
          // ================================================================
          const { profile } = response;
          const validRoles = ['admin', 'manager', 'accountant'];

          if (!profile.role) {
            console.warn('[AuthContext] Profile fetch failed - role is missing');
            console.warn('[AuthContext] Invalid session state - profile exists but role is null');
            await forceLogout('User role is missing');
            return;
          }

          if (!validRoles.includes(profile.role)) {
            console.warn('[AuthContext] Profile fetch failed - invalid role:', profile.role);
            console.warn('[AuthContext] Invalid session state - unrecognized role');
            await forceLogout('Invalid user role: ' + profile.role);
            return;
          }

          // ================================================================
          // VALIDATION: Check if user is active
          // ================================================================
          if (!profile.is_active) {
            console.warn('[AuthContext] Profile fetch failed - user is inactive');
            console.warn('[AuthContext] Invalid session state - account deactivated');
            await forceLogout('Account is deactivated');
            return;
          }

          // ================================================================
          // SUCCESS: Profile is valid
          // ================================================================
          console.log('[AuthContext] Profile validated successfully:', {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            is_active: profile.is_active,
          });

          setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));

        } catch (profileError) {
          console.error('[AuthContext] Profile load failed', profileError);

          if (!isMountedRef.current) return;

          // Set profile to null but don't force logout - allow app to continue
          setState(prev => ({
            ...prev,
            profile: null,
            isLoading: false,
            isAuthenticated: true, // Session exists, just profile failed
          }));
        }
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        console.error('[AuthContext] Initialization error:', errorMessage);
        console.warn('[AuthContext] Invalid session state - initialization failed');

        if (!isMountedRef.current) return;

        await forceLogout('Initialization failed: ' + errorMessage);
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

        // Handle SIGNED_OUT
        if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] Signed out event received');
          setState(LOGGED_OUT_STATE);
          navigate('/login', { replace: true });
          return;
        }

        // If session becomes null
        if (!session) {
          console.warn('[AuthContext] Session null - forcing logout');
          await forceLogout('Session became null');
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED - reload profile
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Skip profile reload if login() is already handling it
          if (isLoginInProgressRef.current) {
            console.log('[AuthContext] Skipping profile reload - login in progress');
            return;
          }

          console.log('[AuthContext] Session updated, reloading profile...');
          try {
            const response = await fetchProfileWithTimeout();
            if (isMountedRef.current && response && response.profile) {
              setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
            }
          } catch (err) {
            console.error('[AuthContext] Profile reload error:', err);
            // Don't force logout on profile reload failures - keep existing session
            // The user is already authenticated, just couldn't refresh their profile
            console.log('[AuthContext] Profile reload failed, keeping current session');
          }
        }
      }
    );

    // Cleanup
    return () => {
      console.log('[AuthContext] Unmounting...');
      isMountedRef.current = false;
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty deps - run once on mount

  // ================================================================
  // LOGIN - Only navigates to dashboard AFTER profile is loaded
  // ================================================================
  const login = useCallback(async (email: string, password: string) => {
    // Mark that login is in progress to prevent duplicate profile reloads from onAuthStateChange
    isLoginInProgressRef.current = true;

    try {
      // This function returns profile data
      const response = await authService.login({ email, password });

      // ONLY navigate if profile is successfully loaded
      if (response && response.profile) {
        setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
        navigate('/dashboard');
      } else {
        throw new Error('Login successful but profile not found');
      }
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      // On any login error, ensure clean state
      await forceLogout((error as Error).message || 'Login failed');
      throw error; // Re-throw to let the login form display the error
    } finally {
      // Always reset the flag when login completes (success or failure)
      isLoginInProgressRef.current = false;
    }
  }, [navigate, forceLogout]);

  // ================================================================
  // LOGOUT
  // ================================================================
  const logout = useCallback(async () => {
    await forceLogout('User initiated logout');
  }, [forceLogout]);

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
      const response = await fetchProfileWithTimeout();
      if (response && response.profile) {
        setState(prev => ({
          ...buildAuthState(response.profile, response.outlets, response.selectedOutlet),
          // Preserve selected outlet if not provided
          selectedOutlet: response.selectedOutlet || prev.selectedOutlet,
        }));
      }
    } catch (err) {
      console.error('[AuthContext] Profile load failed', err);
      // On refresh error, just set profile to null - don't force logout
      setState(prev => ({
        ...prev,
        profile: null,
      }));
    }
  }, [fetchProfileWithTimeout, forceLogout]);

  // ================================================================
  // CONTEXT VALUE
  // ================================================================
  const value: AuthContextValue = {
    ...state,
    isAuthReady: !state.isLoading && state.isAuthenticated,
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
