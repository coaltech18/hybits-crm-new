// ============================================================================
// IMAGE SERVICE - Updated for signed URL flow
// ============================================================================

import { supabase } from '@/lib/supabase';

export async function uploadImage(file: File, outletId: string): Promise<{ key: string; error?: any }> {
  const key = `inventory/${outletId}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('inventory-images')
    .upload(key, file, {
      cacheControl: '3600',
      upsert: false,
      metadata: { outlet_id: outletId }
    });
  
  return { key: data?.path || key, error };
}

export async function getSignedUrl(key: string, expires: number = 3600): Promise<{ url: string | null; error?: any }> {
  const { data, error } = await supabase.storage
    .from('inventory-images')
    .createSignedUrl(key, expires);
  
  return { url: data?.signedUrl || data?.signedURL || null, error };
}

export async function deleteImage(key: string): Promise<{ error?: any }> {
  const { error } = await supabase.storage
    .from('inventory-images')
    .remove([key]);
  
  return { error };
}
