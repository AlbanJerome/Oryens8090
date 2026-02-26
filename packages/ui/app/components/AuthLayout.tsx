'use client';

import Link from 'next/link';
import { OryensLogo } from './brand/OryensLogo';
import { BitemporalTimelineGraphic } from './brand/BitemporalTimelineGraphic';

const VALUE_PROP = "The World's First AI-Native Bitemporal Ledger";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: Branded slate-950 + Bitemporal Timeline SVG */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-10 bg-slate-950 px-12 py-16">
        <Link href="/" className="flex flex-col items-center gap-6">
          <OryensLogo size={80} className="shrink-0" />
          <p className="max-w-sm text-center text-xl font-semibold leading-snug text-white">
            {VALUE_PROP}
          </p>
        </Link>
        <BitemporalTimelineGraphic className="w-full max-w-[280px] shrink-0 opacity-90" />
        <p className="mt-auto text-xs text-slate-500">Oryens © 2026</p>
      </div>

      {/* Right: Auth block — clean white, Supabase auth form */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-6 flex justify-center" aria-label="Oryens home">
            <OryensLogo size={56} className="shrink-0" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
