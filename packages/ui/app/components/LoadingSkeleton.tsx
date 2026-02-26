'use client';

import { OryensSpinner } from './OryensSpinner';

/** Branded Oryens loading skeleton: CSS shimmer + spinner for dashboard and company context. */
export function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50" aria-label="Loading">
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="oryens-shimmer-light h-8 w-32 rounded-lg bg-slate-200" />
          <div className="oryens-shimmer-light h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="mt-8 space-y-4">
          <div className="oryens-shimmer-light h-10 w-full rounded-xl bg-slate-200/80" />
          <div className="oryens-shimmer-light h-10 w-full rounded-xl bg-slate-200/80" />
          <div className="oryens-shimmer-light h-10 w-3/4 rounded-xl bg-slate-200/80" />
        </div>
        <div className="mt-10 rounded-xl border border-slate-200/80 bg-white/95 p-4">
          <div className="flex gap-4 border-b border-slate-200 pb-3">
            <div className="oryens-shimmer-light h-5 w-28 rounded bg-slate-200" />
            <div className="oryens-shimmer-light h-5 w-20 rounded bg-slate-200" />
            <div className="oryens-shimmer-light h-5 w-24 rounded bg-slate-200" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 border-b border-slate-100 py-3">
              <div className="oryens-shimmer-light h-4 flex-1 rounded bg-slate-100" />
              <div className="oryens-shimmer-light h-4 w-16 rounded bg-slate-100" />
              <div className="oryens-shimmer-light h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--oryens-slate-muted)]">
          <OryensSpinner className="oryens-spinner shrink-0" />
          <span>Loading…</span>
        </div>
      </div>
    </div>
  );
}
