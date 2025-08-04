import { supabase } from '../lib/supabase';

export class AuthService {
  static async signIn(email, password) {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  static async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData?.full_name || '',
            role: userData?.role || 'staff'
          }
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  static async signOut() {
    try {
      const { error } = await supabase?.auth?.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  static async getSession() {
    try {
      const { data: { session }, error } = await supabase?.auth?.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  static async getUserProfile(userId) {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('id', userId)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading user profile:', error);
      throw error;
    }
  }

  static async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.update({
          ...updates,
          updated_at: new Date()
        })?.eq('id', userId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  static async changePassword(currentPassword, newPassword) {
    try {
      const { data, error } = await supabase?.auth?.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  static async resetPassword(email) {
    try {
      const { data, error } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: `${window.location?.origin}/reset-password`
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  static async getAllUsers() {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('is_active', true)?.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading users:', error);
      throw error;
    }
  }

  static async updateUserRole(userId, role) {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.update({ 
          role,
          updated_at: new Date()
        })?.eq('id', userId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  static async deactivateUser(userId) {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.update({ 
          is_active: false,
          updated_at: new Date()
        })?.eq('id', userId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }
}