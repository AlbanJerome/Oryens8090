'use client';

/** Bitemporal Timeline: two axes (transaction time + valid time) with nodes. For login left panel. */
const EMERALD = '#10b981';
const SLATE = '#94a3b8';

export function BitemporalTimelineGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      {/* Horizontal axis — transaction time */}
      <line x1="40" y1="80" x2="240" y2="80" stroke={SLATE} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* Vertical axis — valid time */}
      <line x1="140" y1="20" x2="140" y2="140" stroke={SLATE} strokeWidth="1.5" strokeOpacity="0.7" />
      {/* Timeline nodes (emerald) */}
      <circle cx="80" cy="80" r="5" fill={EMERALD} opacity="0.9" />
      <circle cx="140" cy="50" r="5" fill={EMERALD} opacity="0.9" />
      <circle cx="200" cy="110" r="5" fill={EMERALD} opacity="0.9" />
      <circle cx="140" cy="80" r="6" fill={EMERALD} />
      {/* Connector lines (slate) */}
      <path d="M80 80 L140 50" stroke={SLATE} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 2" />
      <path d="M140 50 L140 80" stroke={SLATE} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 2" />
      <path d="M140 80 L200 110" stroke={SLATE} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 2" />
      {/* Axis labels (subtle) */}
      <text x="235" y="88" fill={SLATE} fontSize="10" opacity="0.8">tx</text>
      <text x="128" y="22" fill={SLATE} fontSize="10" opacity="0.8">valid</text>
    </svg>
  );
}
