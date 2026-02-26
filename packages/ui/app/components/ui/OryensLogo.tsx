'use client';

const EMERALD_500 = '#10b981';
const SLATE_400 = '#94a3b8';

/**
 * Oryens logo: modern SVG "O" with an inner prism detail representing bitemporal data.
 * Colors: Emerald-500 (#10b981) and Slate-400 (#94a3b8).
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
      {/* Outer "O" ring — emerald */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke={EMERALD_500}
        strokeWidth="2.5"
        fill="none"
      />
      {/* Inner prism: diamond for bitemporal (transaction + valid time axes) */}
      <g transform="translate(24, 24)">
        <path
          d="M0 -10 L9 0 L0 10 L-9 0 Z"
          fill={SLATE_400}
          fillOpacity="0.85"
        />
        <circle cx="0" cy="0" r="2.5" fill={EMERALD_500} />
      </g>
    </svg>
  );
}
