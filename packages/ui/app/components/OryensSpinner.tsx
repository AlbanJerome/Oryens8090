'use client';

/** Branded Oryens loading spinner. Use for inline "Loading…" replacement. */
export function OryensSpinner({ className }: { className?: string }) {
  return <div className={className ?? 'oryens-spinner'} role="status" aria-label="Loading" />;
}
