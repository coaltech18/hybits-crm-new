// ============================================================================
// AUTH SERVICE
// ============================================================================

import { User, RegisterData } from '@/types';

// Mock Supabase client for development
const createMockSupabase = () => ({
  auth: {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      // Mock authentication logic
        if (email === 'admin@hybits.in' && password === 'admin123') {
        return {
          data: {
            user: {
              id: '1',
              email: 'admin@hybits.in',
              full_name: 'Rajesh Kumar',
              role: 'admin' as const,
              is_active: true,
              // Admin has no outlet_id - can access all outlets
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            session: { access_token: 'mock-token' }
          },
          error: null
        };
      }
      
      if (email === 'manager@hybits.in' && password === 'manager123') {
        return {
          data: {
            user: {
              id: '2',
              email: 'manager@hybits.in',
              full_name: 'Priya Sharma',
              role: 'manager' as const,
              is_active: true,
              outlet_id: '1', // Manager is assigned to Central Mall outlet
              outlet_name: 'Hybits Central Mall',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            session: { access_token: 'mock-token' }
          },
          error: null
        };
      }
      
      throw new Error('Invalid credentials');
    },
    
    signUp: async ({ email, password: _password, options }: { email: string; password: string; options: any }) => {
      return {
        data: {
          user: {
            id: Date.now().toString(),
            email,
            full_name: options?.data?.full_name || 'New User',
            role: options?.data?.role || 'manager',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: { access_token: 'mock-token' }
        },
        error: null
      };
    },
    
    signOut: async () => {
      return { error: null };
    },
    
    getSession: async () => {
      const user = localStorage.getItem('mock-user');
      return {
        data: { session: user ? { user: JSON.parse(user) } : null },
        error: null
      };
    },
    
    updateUser: async ({ password: _password }: { password: string }) => {
      return { data: { user: null }, error: null };
    },
    
    resetPasswordForEmail: async (_email: string) => {
      return { data: {}, error: null };
    }
  },
  
  from: (_table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null })
      })
    }),
    update: (_updates: any) => ({
      eq: (_field: string, _value: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: null })
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: null })
      })
    })
  })
});

// Use environment variables if available, otherwise use mock
const supabase = import.meta.env.VITE_SUPABASE_URL 
  ? createMockSupabase() // In real implementation, this would be the actual Supabase client
  : createMockSupabase();

export class AuthService {
  static async login(email: string, password: string): Promise<{ user: User; session: any }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      // Store user in localStorage for mock persistence
      if (data.user) {
        localStorage.setItem('mock-user', JSON.stringify(data.user));
      }
      
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  static async register(userData: RegisterData): Promise<{ user: User; session: any }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            role: userData.role
          }
        }
      });

      if (error) throw error;
      
      // Store user in localStorage for mock persistence
      if (data.user) {
        localStorage.setItem('mock-user', JSON.stringify(data.user));
      }
      
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  static async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear localStorage
      localStorage.removeItem('mock-user');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.user) {
        return session.user as User;
      }
      
      // Check localStorage for mock user
      const mockUser = localStorage.getItem('mock-user');
      return mockUser ? JSON.parse(mockUser) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data, error } = await supabase.from('user_profiles').update({
        ...updates,
        updated_at: new Date().toISOString()
      }).eq('id', userId).select().single();

      if (error) throw error;
      
      // Update localStorage for mock persistence
      const currentUser = localStorage.getItem('mock-user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        const updatedUser = { ...user, ...updates };
        localStorage.setItem('mock-user', JSON.stringify(updatedUser));
        return updatedUser;
      }
      
      return data || (currentUser ? JSON.parse(currentUser) : null);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  static async changePassword(newPassword: string): Promise<any> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  static async resetPassword(email: string): Promise<any> {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }
}
