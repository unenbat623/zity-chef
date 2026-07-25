import React, { useState, useCallback } from 'react';
import { getEmojiGradient } from '../lib/imageService';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  emoji?: string;
  className?: string;
  fallbackLabel?: string;
}

/**
 * SmartImage — Battle-tested responsive image component:
 * 1. Shimmer skeleton while loading
 * 2. Smooth fade-in on load complete
 * 3. Graceful emoji+gradient fallback if image fails or src is null
 * 4. Native browser lazy loading
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  emoji = '📦',
  className = '',
  fallbackLabel,
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  const handleLoad = useCallback(() => setStatus('loaded'), []);
  const handleError = useCallback(() => setStatus('error'), []);

  const gradient = getEmojiGradient(emoji);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Shimmer skeleton shown while image loads */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-pestle-border/60 via-pestle-border/20 to-pestle-border/60 animate-shimmer" />
      )}

      {/* Actual image - forced 100% width and height object-cover */}
      {src && status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Emoji + gradient fallback */}
      {(status === 'error' || !src) && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-1`}
        >
          <span className="text-4xl drop-shadow-sm select-none">{emoji}</span>
          {fallbackLabel && (
            <span className="text-[10px] font-bold text-white/80 px-2 text-center leading-tight">
              {fallbackLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * IngredientCard image — 100% responsive cover image
 */
interface IngredientImageProps {
  src?: string | null;
  emoji: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export const IngredientImage: React.FC<IngredientImageProps> = ({
  src,
  emoji,
  name,
  size = 'full',
}) => {
  if (size === 'full') {
    return <SmartImage src={src} alt={name} emoji={emoji} className="w-full h-full rounded-xl" />;
  }

  const sizeClass =
    size === 'sm'
      ? 'w-12 h-12 text-2xl'
      : size === 'lg'
        ? 'w-full h-full text-4xl'
        : 'w-16 h-16 text-3xl';

  return (
    <SmartImage
      src={src}
      alt={name}
      emoji={emoji}
      className={`${sizeClass} rounded-xl shrink-0 w-full h-full`}
    />
  );
};
