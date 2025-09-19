// ============================================================================
// DATABASE TEST UTILITY
// ============================================================================

import { supabase } from '@/lib/supabase';

export const testDatabaseConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('inventory_items')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Database connection failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Database connection successful!');
    return { success: true, data };
  } catch (error: any) {
    console.error('Database test error:', error);
    return { success: false, error: error.message };
  }
};

export const testStorageConnection = async () => {
  try {
    console.log('Testing storage connection...');
    
    // Test storage bucket access
    const { data, error } = await supabase.storage
      .from('inventory-images')
      .list('', { limit: 1 });

    if (error) {
      console.error('Storage connection failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Storage connection successful!');
    return { success: true, data };
  } catch (error: any) {
    console.error('Storage test error:', error);
    return { success: false, error: error.message };
  }
};
