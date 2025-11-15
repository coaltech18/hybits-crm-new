// ============================================================================
// SUPABASE HELPERS
// ============================================================================
// Helper functions for safe Supabase queries

import { supabase } from './supabase';

/**
 * Safely fetch a single row that may or may not exist
 * @param table - The table name to query
 * @param filter - Filter conditions (e.g., { id: '123' })
 * @returns { data, error } - Returns null data if row not found (no error)
 */
export async function fetchMaybeSingle(
  table: string,
  filter: Record<string, any>
): Promise<{ data: any | null; error: any | null }> {
  try {
    let query = supabase.from(table).select('*');

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(`DB error fetching ${table}:`, error);
      return { data: null, error };
    }

    if (!data) {
      console.warn(`${table} row not found for filter`, filter);
      return { data: null, error: null };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error(`Error in fetchMaybeSingle for ${table}:`, error);
    return { data: null, error };
  }
}

