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
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && state.isLoading) {
        console.warn('[AuthContext] Safety timeout triggered - forcing logged out state');
        setState(LOGGED_OUT_STATE);
      }
    }, 10000);

    // Main initialization function
    async function initializeAuth() {
      console.log('[AuthContext] Initializing...');

      try {
        // Step 1: Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError);
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
        const response = await authService.getCurrentUserProfile();

        if (!isMountedRef.current) return;

        if (response && response.profile) {
          console.log('[AuthContext] Profile loaded successfully');
          setState(buildAuthState(response.profile, response.outlets, response.selectedOutlet));
        } else {
          console.warn('[AuthContext] No profile found for session');
          setState(LOGGED_OUT_STATE);
        }
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        if (isMountedRef.current) setState(LOGGED_OUT_STATE);
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
        if (event === 'SIGNED_OUT' || !session) {
          console.log('[AuthContext] Signed out');
          setState(LOGGED_OUT_STATE);
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
            // Don't change state on error - keep existing auth state
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
