// ============================================================================
// STORAGE HELPERS - Outlet-aware path management
// ============================================================================

import { supabase } from '@/lib/supabase';

/**
 * Generate outlet-aware storage path for inventory images
 * Path structure: {outlet_id}/{item_code}/{filename}
 */
export function generateInventoryImagePath(
  outletId: string, 
  itemCode: string, 
  filename: string
): string {
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${outletId}/${itemCode}/${Date.now()}_${sanitizedFilename}`;
}

/**
 * Generate document path for PDFs (typically invoice PDFs)
 * Path structure: {invoice_number}_{timestamp}.pdf
 */
export function generateDocumentPath(
  invoiceNumber: string,
  extension: string = 'pdf'
): string {
  const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  return `${sanitizedInvoiceNumber}_${Date.now()}.${extension}`;
}

/**
 * Extract outlet ID from inventory image path
 * Returns null if path doesn't match expected format
 */
export function extractOutletIdFromPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length >= 3 && parts[0]) {
    return parts[0]; // First part should be outlet_id
  }
  return null;
}

/**
 * Validate if user can access inventory image based on path
 */
export async function canAccessInventoryImage(
  imagePath: string, 
  userRole: string, 
  userOutletId?: string
): Promise<boolean> {
  if (userRole === 'admin') {
    return true;
  }
  
  const pathOutletId = extractOutletIdFromPath(imagePath);
  return pathOutletId === userOutletId;
}

/**
 * Upload inventory image with proper outlet-aware path
 */
export async function uploadInventoryImage(
  file: File,
  outletId: string,
  itemCode: string
): Promise<{ path: string | null; error: any }> {
  try {
    const path = generateInventoryImagePath(outletId, itemCode, file.name);
    
    const { data, error } = await supabase.storage
      .from('inventory-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        metadata: { 
          outlet_id: outletId, 
          item_code: itemCode,
          original_filename: file.name
        }
      });

    if (error) {
      console.error('Error uploading inventory image:', error);
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (error) {
    console.error('Error in uploadInventoryImage:', error);
    return { path: null, error };
  }
}

/**
 * Get signed URL for inventory image with access validation
 */
export async function getInventoryImageSignedUrl(
  imagePath: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error: any }> {
  try {
    const { data, error } = await supabase.storage
      .from('inventory-images')
      .createSignedUrl(imagePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: null, error };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error in getInventoryImageSignedUrl:', error);
    return { url: null, error };
  }
}

/**
 * Upload document (PDF) - restricted to service role and admins
 */
export async function uploadDocument(
  file: File,
  documentPath: string
): Promise<{ path: string | null; error: any }> {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(documentPath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting for PDF regeneration
        metadata: { 
          original_filename: file.name,
          content_type: file.type
        }
      });

    if (error) {
      console.error('Error uploading document:', error);
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    return { path: null, error };
  }
}

/**
 * Get signed URL for document with ownership validation
 */
export async function getDocumentSignedUrl(
  documentPath: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error: any }> {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(documentPath, expiresIn);

    if (error) {
      console.error('Error creating document signed URL:', error);
      return { url: null, error };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Error in getDocumentSignedUrl:', error);
    return { url: null, error };
  }
}

/**
 * Delete inventory image with access validation
 */
export async function deleteInventoryImage(
  imagePath: string
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.storage
      .from('inventory-images')
      .remove([imagePath]);

    if (error) {
      console.error('Error deleting inventory image:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error in deleteInventoryImage:', error);
    return { error };
  }
}

/**
 * List inventory images for a specific outlet (admin only or own outlet)
 */
export async function listInventoryImages(
  outletId?: string,
  itemCode?: string
): Promise<{ files: any[] | null; error: any }> {
  try {
    let path = '';
    if (outletId && itemCode) {
      path = `${outletId}/${itemCode}`;
    } else if (outletId) {
      path = `${outletId}`;
    }

    const { data, error } = await supabase.storage
      .from('inventory-images')
      .list(path, {
        limit: 100,
        offset: 0
      });

    if (error) {
      console.error('Error listing inventory images:', error);
      return { files: null, error };
    }

    return { files: data, error: null };
  } catch (error) {
    console.error('Error in listInventoryImages:', error);
    return { files: null, error };
  }
}

/**
 * Validate storage path format
 */
export function validateInventoryImagePath(path: string): {
  isValid: boolean;
  outletId?: string;
  itemCode?: string;
  filename?: string;
} {
  const parts = path.split('/');
  
  if (parts.length !== 3) {
    return { isValid: false };
  }

  const [outletId, itemCode, filename] = parts;
  
  // Basic validation
  if (!outletId || !itemCode || !filename) {
    return { isValid: false };
  }

  // UUID format validation for outlet ID (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(outletId)) {
    return { isValid: false };
  }

  return {
    isValid: true,
    outletId,
    itemCode,
    filename
  };
}
