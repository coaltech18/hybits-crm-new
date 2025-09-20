// ============================================================================
// AUTH CONTEXT PROVIDER
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContextType, User, RegisterData, Outlet } from '@/types';
import { AuthService } from '@/services/AuthService';
import OutletService from '@/services/outletService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        // Load available outlets for the user
        const outlets = await OutletService.getAllOutlets();
        setAvailableOutlets(outlets);
        
        // Set current outlet
        if (currentUser.outlet_id) {
          const outlet = outlets.find((o: any) => o.id === currentUser.outlet_id);
          setCurrentOutlet(outlet || null);
        } else if (outlets.length > 0) {
          // Admin can choose any outlet, default to first one
          setCurrentOutlet(outlets[0] || null);
        }
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setCurrentOutlet(null);
      setAvailableOutlets([]);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const { user: loggedInUser } = await AuthService.login(email, password);
      setUser(loggedInUser);
      
      // Load available outlets for the user
      const outlets = await OutletService.getAllOutlets();
      setAvailableOutlets(outlets);
      
      // Set current outlet
      if (loggedInUser.outlet_id) {
        const outlet = outlets.find((o: any) => o.id === loggedInUser.outlet_id);
        setCurrentOutlet(outlet || null);
      } else if (outlets.length > 0) {
        // Admin can choose any outlet, default to first one
        setCurrentOutlet(outlets[0] || null);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      await AuthService.logout();
      setUser(null);
      setCurrentOutlet(null);
      setAvailableOutlets([]);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setLoading(true);
      const { user: newUser } = await AuthService.register(userData);
      setUser(newUser);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');
      
      setLoading(true);
      const updatedUser = await AuthService.updateProfile(user.id, updates);
      setUser(updatedUser);
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const switchOutlet = async (outletId: string): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');
      
      // Check if user can access this outlet
      const outlet = availableOutlets.find(o => o.id === outletId);
      if (!outlet) {
        throw new Error('Outlet not accessible');
      }
      
      setCurrentOutlet(outlet);
      
      // Store current outlet in localStorage for persistence
      localStorage.setItem('current-outlet', outletId);
    } catch (error) {
      console.error('Outlet switch failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    currentOutlet,
    availableOutlets,
    loading,
    login,
    logout,
    register,
    updateProfile,
    switchOutlet,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
