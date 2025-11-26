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
  const { data, error } = await supabase.storage
    .from('inventory-images')
    .createSignedUrl(key, expires);
  
  return { url: data?.signedUrl || null, error };
}

export async function deleteImage(key: string): Promise<{ error?: any }> {
  const { error } = await supabase.storage
    .from('inventory-images')
    .remove([key]);
  
  return { error };
}
