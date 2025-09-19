// ============================================================================
// IMAGE UPLOAD COMPONENT
// ============================================================================

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import ImageService from '@/services/imageService';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onError?: (error: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  showPreview?: boolean;
  aspectRatio?: 'square' | '4:3' | '16:9' | 'auto';
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onError,
  label,
  required = false,
  disabled = false,
  error,
  className,
  maxSize = 5, // 5MB default
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  showPreview = true,
  aspectRatio = '4:3',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '16:9': return 'aspect-[16/9]';
      default: return '';
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `File type not supported. Please upload ${acceptedTypes.map(type => type.split('/')[1]?.toUpperCase()).join(', ')} files.`;
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB.`;
    }

    return null;
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      onError?.(validationError);
      return;
    }

    setIsUploading(true);
    
    try {
      // Create preview URL
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Upload to Supabase Storage
      const result = await ImageService.uploadImage({
        file,
        bucket: 'inventory-images',
        folder: 'items',
        generateThumbnail: true,
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8
      });

      if (result.error) {
        onError?.(result.error);
        setPreviewUrl(null);
        return;
      }

      onChange(result.url);
      
    } catch (error: any) {
      onError?.(error.message || 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  }, [maxSize, acceptedTypes, onChange, onError]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-border',
          error ? 'border-destructive' : '',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          showPreview && previewUrl ? 'p-2' : 'p-6'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {showPreview && previewUrl ? (
          <div className="relative">
            <div className={cn('relative overflow-hidden rounded-md bg-muted', getAspectRatioClass())}>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            {!disabled && !isUploading && (
              <button
                type="button"
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md p-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload size={24} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {acceptedTypes.map(type => type.split('/')[1]?.toUpperCase()).join(', ')} up to {maxSize}MB
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-1 text-sm text-destructive">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {value && !previewUrl && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <ImageIcon size={16} />
          <span>Image uploaded successfully</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
