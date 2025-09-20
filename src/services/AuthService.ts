// ============================================================================
// AUTH SERVICE - Updated
// ============================================================================

import { User, RegisterData } from '@/types';
import { supabase } from '@/lib/supabase';

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

      // Map Supabase user to our User interface
      const user: User = {
        id: data.user.id,
        email: data.user.email || '',
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
      
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

      // Create user profile in user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          phone: userData.phone,
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        throw new Error('Failed to create user profile');
      }

      // Map to our User interface
      const user: User = {
        id: authData.user.id,
        email: authData.user.email || '',
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
      
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

      const user: User = {
        id: data.session.user.id,
        email: data.session.user.email || '',
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };

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

      return data.map((profile: any) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }));
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
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        phone: data.phone,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      // Delete from user_profiles first (this will cascade to auth.users)
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}