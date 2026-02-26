'use client';

/**
 * Oryens logo: stylized geometric "O" (ledger ring) with optional wordmark.
 * Uses brand indigo for app shell; use className to override (e.g. white on dark).
 */
export function Logo({
  className,
  showWordmark = true,
  size = 'md',
}: {
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className ?? 'text-[var(--oryens-indigo)]'}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        {/* Outer ring (O) + inner cut = ledger book / temporal loop */}
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M16 6v20M8 16h16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark && <span>Oryens</span>}
    </span>
  );
}
