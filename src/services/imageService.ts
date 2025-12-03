// ============================================================================
// IMAGE SERVICE - Updated for signed URL flow
// ============================================================================

import { supabase } from '@/lib/supabase';

export async function uploadImage(file: File, outletId: string, itemCode?: string): Promise<{ key: string; error?: any }> {
  // Path structure: {outlet_id}/{item_code}/{filename}
  // This matches the RLS policy expectation: split_part(name, '/', 1) = outlet_id
  const itemFolder = itemCode || 'general';
  const key = `${outletId}/${itemFolder}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('inventory-images')
    .upload(key, file, {
      cacheControl: '3600',
      upsert: false,
      metadata: { outlet_id: outletId, item_code: itemCode }
    });
  
  return { key: data?.path || key, error };
}

export async function getSignedUrl(key: string, expires: number = 3600): Promise<{ url: string | null; error?: any }> {
  // Normalize the key - remove any leading slashes or bucket name prefixes
  let normalizedKey = key.trim();
  
  // Remove bucket name prefix if present (e.g., "inventory-images/")
  if (normalizedKey.startsWith('inventory-images/')) {
    normalizedKey = normalizedKey.replace('inventory-images/', '');
  }
  
  // Remove leading slash
  if (normalizedKey.startsWith('/')) {
    normalizedKey = normalizedKey.substring(1);
  }
  
  // Skip if key is empty or invalid
  if (!normalizedKey || normalizedKey.length === 0) {
    console.warn('Invalid storage key for signed URL:', key);
    return { url: null, error: 'Invalid storage key' };
  }
  
  console.log('Getting signed URL for key:', normalizedKey);
  
  const { data, error } = await supabase.storage
    .from('inventory-images')
    .createSignedUrl(normalizedKey, expires);
  
  if (error) {
    console.error('Error creating signed URL for key:', normalizedKey, 'Error:', error);
    return { url: null, error };
  }
  
  return { url: data?.signedUrl || null, error: null };
}

export async function deleteImage(key: string): Promise<{ error?: any }> {
  const { error } = await supabase.storage
    .from('inventory-images')
    .remove([key]);
  
  return { error };
}
