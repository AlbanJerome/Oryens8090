'use client';

/** Oryens 8090: Emerald-500 #10b981, Slate-400 #94a3b8 */
const EMERALD_500 = '#10b981';
const SLATE_400 = '#94a3b8';

/**
 * Minimalist Prism icon for bitemporal data. Emerald-500 and Slate-400 SVG paths.
 */
export function OryensLogo({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      {/* Prism: outer ring (O) — emerald */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke={EMERALD_500}
        strokeWidth="2.5"
        fill="none"
      />
      {/* Inner prism diamond — slate */}
      <path
        d="M24 8 L38 24 L24 40 L10 24 Z"
        fill={SLATE_400}
        fillOpacity="0.9"
      />
      {/* Prism center accent — emerald */}
      <circle cx="24" cy="24" r="3" fill={EMERALD_500} />
    </svg>
  );
}
