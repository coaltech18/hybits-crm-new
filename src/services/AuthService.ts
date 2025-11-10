// ============================================================================
// AUTH SERVICE - Updated
// ============================================================================

import { User, RegisterData, CreateUserInput, UpdateUserInput } from '@/types';
import { supabase } from '@/lib/supabase';

interface UserProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  outlet_id?: string | null;
  outlet_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string | null;
}

const mapProfileToUser = (profile: UserProfileRow, fallbackEmail?: string): User => {
  const user: User = {
    id: profile.id,
    email: profile.email || fallbackEmail || '',
    full_name: profile.full_name,
    role: profile.role as User['role'],
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  if (profile.phone) {
    user.phone = profile.phone;
  }

  if (profile.outlet_id) {
    user.outlet_id = profile.outlet_id;
  }

  if (profile.outlet_name) {
    user.outlet_name = profile.outlet_name;
  }

  if (profile.last_login) {
    user.last_login = profile.last_login;
  }

  return user;
};

export class AuthService {
  /**
   * Sign in with email and password
   */
  static async login(email: string, password: string): Promise<{ user: User; session: any }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      if (!data.user) {
        throw new Error('No user data returned');
      }

      // Get user profile from user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      const user = mapProfileToUser(profile as UserProfileRow, data.user.email || '');

      return { user, session: data.session };
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   */
  static async register(userData: RegisterData): Promise<{ user: User; session: any }> {
    try {
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            role: userData.role
          }
        }
      });

      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('No user data returned from registration');
      }

      // Fetch user profile created by trigger
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching created user profile:', profileError);
        throw new Error('Failed to load user profile after registration');
      }

      const user = mapProfileToUser(profile as UserProfileRow, authData.user.email || '');
      
      return { user, session: authData.session };
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  static async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { user } = await this.getCurrentSession();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  static async getCurrentSession(): Promise<{ user: User | null; session: any }> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (!data.session || !data.session.user) {
        return { user: null, session: null };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return { user: null, session: null };
      }

      const user = mapProfileToUser(profile as UserProfileRow, data.session.user.email || '');

      return { user, session: data.session };
    } catch (error) {
      console.error('Error getting current session:', error);
      return { user: null, session: null };
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Reset password for email
   */
  static async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data as UserProfileRow[]).map((profile) => mapProfileToUser(profile));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Update user profile (alias for updateUserProfile)
   */
  static async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    return this.updateUserProfile(userId, updates);
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: updates.full_name,
          role: updates.role,
          phone: updates.phone,
          is_active: updates.is_active,
          outlet_id: updates.outlet_id,
          outlet_name: updates.outlet_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return mapProfileToUser(data as UserProfileRow);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Admin create user
   */
  static async createUser(payload: CreateUserInput): Promise<User> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'createUser',
          payload
        }
      });

      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Failed to create user');
      }

      return data.user as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Admin update user
   */
  static async adminUpdateUser(updates: UpdateUserInput): Promise<User> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'updateUser',
          payload: {
            user_id: updates.user_id,
            updates: {
              full_name: updates.full_name,
              role: updates.role,
              phone: updates.phone,
              outlet_id: updates.outlet_id,
              is_active: updates.is_active
            }
          }
        }
      });

      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Failed to update user');
      }

      return data.user as User;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Toggle user active status
   */
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    return this.adminUpdateUser({ user_id: userId, is_active: isActive });
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'deleteUser',
          payload: { user_id: userId }
        }
      });

      if (error || data?.success === false) {
        throw new Error(data?.error || error?.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}