// ============================================================================
// APP IMAGE COMPONENT
// ============================================================================

import React, { useState, ImgHTMLAttributes } from 'react';

interface AppImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
  onLoad?: () => void;
}

const AppImage: React.FC<AppImageProps> = ({
  src,
  alt,
  fallbackSrc = '/assets/images/no_image.png',
  className = '',
  loading = 'lazy',
  onError,
  onLoad,
  ...props
}) => {
  // Initialize with fallback if src is empty or invalid
  const [imageSrc, setImageSrc] = useState<string>(src && src.trim() !== '' ? src : fallbackSrc);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Update image source when src prop changes
  React.useEffect(() => {
    if (src && src.trim() !== '') {
      setImageSrc(src);
      setHasError(false);
      setIsLoading(true);
    } else {
      setImageSrc(fallbackSrc);
      setHasError(true);
      setIsLoading(false);
    }
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasError && fallbackSrc) {
      setImageSrc(fallbackSrc);
      setHasError(true);
    }
    setIsLoading(false);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading={loading}
        onError={handleError}
        onLoad={handleLoad}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        {...props}
      />
    </div>
  );
};

export default AppImage;
