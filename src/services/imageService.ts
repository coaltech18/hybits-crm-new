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
  
  // Try the exact path first
  let { data, error } = await supabase.storage
    .from('inventory-images')
    .createSignedUrl(normalizedKey, expires);
  
  // Log the full error response for debugging
  if (error) {
    console.log('  Initial error response:', {
      message: error.message,
      statusCode: (error as any).statusCode,
      status: (error as any).status,
      error: error
    });
  }
  
  // If exact path fails, try alternative path formats
  if (error) {
    const filename = normalizedKey.split('/').pop() || normalizedKey;
    const alternativePaths = new Set<string>(); // Use Set to avoid duplicates
    
    // If path contains "inventory/default/", try alternative formats
    if (normalizedKey.includes('inventory/default/')) {
      alternativePaths.add(`default/${filename}`);
      alternativePaths.add(filename); // Try root level
    }
    
    // If path contains "default/", try just the filename
    if (normalizedKey.includes('default/') && !normalizedKey.includes('inventory/')) {
      alternativePaths.add(filename);
    }
    
    // If path has multiple segments, try just the filename (for files uploaded directly)
    if (normalizedKey.includes('/')) {
      alternativePaths.add(filename);
    }
    
    // Convert Set to array and try each alternative path
    const uniquePaths = Array.from(alternativePaths);
    for (const altPath of uniquePaths) {
      console.log(`  → Trying alternative path: ${altPath}`);
      const altResult = await supabase.storage
        .from('inventory-images')
        .createSignedUrl(altPath, expires);
      
      if (!altResult.error && altResult.data?.signedUrl) {
        console.log(`  ✓ Found file at alternative path: ${altPath}`);
        return { url: altResult.data.signedUrl, error: null };
      }
    }
    
    // If all alternative paths fail, try searching by filename
    console.log(`  → Searching for file by filename: ${filename}`);
    const foundPath = await findFileByFilename(filename);
    if (foundPath) {
      const searchResult = await supabase.storage
        .from('inventory-images')
        .createSignedUrl(foundPath, expires);
      
      if (!searchResult.error && searchResult.data?.signedUrl) {
        console.log(`  ✓ Found file by search: ${foundPath}`);
        return { url: searchResult.data.signedUrl, error: null };
      }
    }
    
    // If all paths fail, log detailed error
    const errorDetails = {
      message: error.message || 'Failed to create signed URL',
      statusCode: (error as any).statusCode || (error as any).status,
      originalError: error
    };
    
    console.error('❌ Error creating signed URL:', {
      key: normalizedKey,
      error: errorDetails.message,
      statusCode: errorDetails.statusCode,
      triedAlternatives: uniquePaths
    });
    
    // If it's a 400/404, the file likely doesn't exist at this path
    if (errorDetails.statusCode === 400 || errorDetails.statusCode === 404) {
      console.warn('  → File not found in storage. Tried paths:');
      console.warn('    1. Original:', normalizedKey);
      uniquePaths.forEach((path, idx) => {
        console.warn(`    ${idx + 2}. Alternative: ${path}`);
      });
      console.warn('  → Please check the file exists in Supabase Storage and update the database path if needed.');
    }
    
    return { 
      url: null, 
      error: errorDetails
    };
  }
  
  return { url: data?.signedUrl || null, error: null };
}

/**
 * Search for a file by filename across the storage bucket
 * Useful when the exact path is unknown
 */
async function findFileByFilename(filename: string): Promise<string | null> {
  try {
    // Clean filename - remove any path components
    const cleanFilename = filename.split('/').pop() || filename;
    
    // Try searching in common locations
    const searchPaths = ['', 'default', 'inventory', 'inventory/default'];
    
    for (const basePath of searchPaths) {
      try {
        const { data, error } = await supabase.storage
          .from('inventory-images')
          .list(basePath, {
            limit: 1000
          });
        
        if (!error && data) {
          // Search through the files for a match
          const foundFile = data.find(file => 
            file.name === cleanFilename || 
            file.name.includes(cleanFilename) ||
            cleanFilename.includes(file.name)
          );
          
          if (foundFile) {
            const foundPath = basePath ? `${basePath}/${foundFile.name}` : foundFile.name;
            console.log(`  ✓ Found file by searching in "${basePath || 'root'}": ${foundPath}`);
            return foundPath;
          }
        }
      } catch (listError) {
        // Continue to next path if listing fails
        continue;
      }
    }
    
    return null;
  } catch (err) {
    console.warn('Error searching for file:', err);
    return null;
  }
}

export async function deleteImage(key: string): Promise<{ error?: any }> {
  const { error } = await supabase.storage
    .from('inventory-images')
    .remove([key]);
  
  return { error };
}
