// ============================================================================
// IMAGE SERVICE
// ============================================================================

import { supabase } from '@/lib/supabase';

export interface ImageUploadResult {
  url: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface ImageUploadOptions {
  file: File;
  bucket: string;
  folder?: string;
  generateThumbnail?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

class ImageService {
  private readonly DEFAULT_BUCKET = 'inventory-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /**
   * Upload an image to Supabase Storage
   */
  async uploadImage(options: ImageUploadOptions): Promise<ImageUploadResult> {
    try {
      const { file, bucket = this.DEFAULT_BUCKET, folder = 'items' } = options;

      // Validate file
      const validationError = this.validateFile(file);
      if (validationError) {
        return { url: '', error: validationError };
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      // Upload file to Supabase Storage
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { url: '', error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const result: ImageUploadResult = {
        url: urlData.publicUrl
      };

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailResult = await this.generateThumbnail(file, bucket, folder);
        if (thumbnailResult && !thumbnailResult.error) {
          result.thumbnailUrl = thumbnailResult.url;
        }
      }

      return result;
    } catch (error: any) {
      return { url: '', error: error.message || 'Failed to upload image' };
    }
  }

  /**
   * Delete an image from Supabase Storage
   */
  async deleteImage(bucket: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to delete image' };
    }
  }

  /**
   * Generate a thumbnail version of an image
   */
  private async generateThumbnail(
    file: File,
    bucket: string,
    folder: string,
    maxWidth: number = 400,
    maxHeight: number = 300
  ): Promise<ImageUploadResult> {
    try {
      // Create canvas for thumbnail generation
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      return new Promise((resolve) => {
        img.onload = async () => {
          // Calculate thumbnail dimensions
          const { width, height } = this.calculateThumbnailDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Draw thumbnail
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve({ url: '', error: 'Failed to generate thumbnail' });
              return;
            }

            // Upload thumbnail
            const fileExt = file.name.split('.').pop();
            const fileName = `thumb_${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = folder ? `${folder}/${fileName}` : fileName;

            const { error } = await supabase.storage
              .from(bucket)
              .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: false
              });

            if (error) {
              resolve({ url: '', error: error.message });
              return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(filePath);

            resolve({ url: urlData.publicUrl });
          }, file.type, 0.8);
        };

        img.onerror = () => {
          resolve({ url: '', error: 'Failed to load image for thumbnail generation' });
        };

        img.src = URL.createObjectURL(file);
      });
    } catch (error: any) {
      return { url: '', error: error.message || 'Failed to generate thumbnail' };
    }
  }

  /**
   * Calculate thumbnail dimensions while maintaining aspect ratio
   */
  private calculateThumbnailDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = maxWidth;
    let height = maxWidth / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File): string | null {
    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return `File type not supported. Please upload ${this.ALLOWED_TYPES.map(type => type.split('/')[1]?.toUpperCase()).join(', ')} files.`;
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return `File size must be less than ${this.MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }

    return null;
  }

  /**
   * Get optimized image URL with transformations
   */
  getOptimizedImageUrl(url: string, width?: number, height?: number, quality?: number): string {
    if (!url) return url;

    // For Supabase Storage URLs, we can add transformation parameters
    // This is a placeholder - actual implementation depends on your image processing setup
    const params = new URLSearchParams();
    
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (quality) params.append('quality', quality.toString());

    const separator = url.includes('?') ? '&' : '?';
    return params.toString() ? `${url}${separator}${params.toString()}` : url;
  }
}

export default new ImageService();
