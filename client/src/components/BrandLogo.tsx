import React, { useId } from 'react';

interface BrandLogoProps {
  /** Tailwind sizing/extra classes, e.g. "w-9 h-9". */
  className?: string;
  /** Accessible label; pass "" to render it purely decorative. */
  title?: string;
}

/**
 * Zity Chef app mark — an emerald squircle with a chef hat and an AI sparkle.
 *
 * Single source of truth for the in-app logo (mobile header + desktop sidebar);
 * the same geometry is mirrored in `client/public/favicon.svg`, which the PWA
 * icons are rendered from, so the home-screen icon and the in-app mark match.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'w-9 h-9', title = 'Zity Chef' }) => {
  // Gradient ids must stay unique — the logo renders more than once per page.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bg = `zc-bg-${uid}`;
  const hat = `zc-hat-${uid}`;
  const clip = `zc-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id={hat} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E6FBF2" />
        </linearGradient>
        <clipPath id={clip}>
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill={`url(#${bg})`} />
        {/* soft top light */}
        <ellipse cx="26" cy="2" rx="40" ry="20" fill="#FFFFFF" opacity="0.14" />
      </g>

      {/* chef hat */}
      <g fill={`url(#${hat})`}>
        <path d="M16.6 33.8C13.4 32.1 11.2 28.8 11.2 25c0-5.5 4.4-9.9 9.9-9.9.9 0 1.8.1 2.6.4C25.5 12 28.5 10 32 10s6.5 2 8.3 5.5c.8-.3 1.7-.4 2.6-.4 5.5 0 9.9 4.4 9.9 9.9 0 3.8-2.2 7.1-5.4 8.8V42H16.6V33.8Z" />
        <rect x="16.6" y="44.2" width="30.8" height="9.4" rx="4.7" />
      </g>

      {/* pleats + band shading keep the mark readable at 24px */}
      <g stroke="#047857" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round">
        <path d="M25.5 34.5v7" />
        <path d="M38.5 34.5v7" />
      </g>
      <rect x="16.6" y="44.2" width="30.8" height="3.2" rx="1.6" fill="#047857" opacity="0.1" />

      {/* AI sparkle */}
      <path
        d="M52 8.8l1.55 3.65L57.2 14l-3.65 1.55L52 19.2l-1.55-3.65L46.8 14l3.65-1.55L52 8.8Z"
        fill="#FFFFFF"
        opacity="0.92"
      />
    </svg>
  );
};
