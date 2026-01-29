import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthState, UserProfile, Outlet } from '@/types';
import * as authService from '@/services/authService';
import { supabase } from '@/lib/supabase';

// ================================================================
// AUTH CONTEXT
// ================================================================
// Manages authentication state and provides role-based access control
// ================================================================

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedOutlet: (outletId: string | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    outlets: [],
    selectedOutlet: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    isManager: false,
    isAccountant: false,
  });

  // Initialize auth state on mount
  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await loadUserProfile();
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            profile: null,
            outlets: [],
            selectedOutlet: null,
            isLoading: false,
            isAuthenticated: false,
            isAdmin: false,
            isManager: false,
            isAccountant: false,
          });
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  /**
   * Check if user is already authenticated
   */
  async function checkAuth() {
    try {
      const response = await authService.getCurrentUserProfile();

      if (response) {
        updateAuthState(response.profile, response.outlets, response.selectedOutlet);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }

  /**
   * Load user profile after authentication
   */
  async function loadUserProfile() {
    try {
      const response = await authService.getCurrentUserProfile();

      if (response) {
        updateAuthState(response.profile, response.outlets, response.selectedOutlet);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  /**
   * Update auth state with profile data
   */
  function updateAuthState(
    profile: UserProfile,
    outlets: Outlet[],
    selectedOutlet: string | null
  ) {
    setState({
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
  }

  /**
   * Login user
   */
  async function login(email: string, password: string) {
    try {
      const response = await authService.login({ email, password });
      updateAuthState(response.profile, response.outlets, response.selectedOutlet);

      // Redirect based on role - all go to dashboard for now
      navigate('/dashboard');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user
   */
  async function logout() {
    try {
      await authService.logout();
      setState({
        user: null,
        profile: null,
        outlets: [],
        selectedOutlet: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        isManager: false,
        isAccountant: false,
      });
      navigate('/login');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set selected outlet (for managers with multiple outlets)
   */
  function setSelectedOutlet(outletId: string | null) {
    setState(prev => ({ ...prev, selectedOutlet: outletId }));
  }

  /**
   * Refresh user profile (useful after updates)
   */
  async function refreshProfile() {
    await loadUserProfile();
  }

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    setSelectedOutlet,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
