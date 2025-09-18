import { supabase } from '../lib/supabase';

interface UserData {
  full_name?: string;
  role?: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  user: any;
  session: any;
}

export class AuthService {
  static async signIn(email: string, password: string): Promise<AuthResponse> {
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

  static async signUp(email: string, password: string, userData: UserData = {}): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData?.full_name || '',
            role: userData?.role || 'manager'
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

  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase?.auth?.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  static async getSession(): Promise<any> {
    try {
      const { data: { session }, error } = await supabase?.auth?.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('id', userId)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading user profile:', error);
      throw error;
    }
  }

  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
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

  static async changePassword(newPassword: string): Promise<any> {
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

  static async resetPassword(email: string): Promise<any> {
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

  static async getAllUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('is_active', true)?.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading users:', error);
      throw error;
    }
  }

  static async updateUserRole(userId: string, role: string): Promise<UserProfile> {
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

  static async deactivateUser(userId: string): Promise<UserProfile> {
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
