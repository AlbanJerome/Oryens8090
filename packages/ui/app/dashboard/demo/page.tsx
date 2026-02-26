'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AIEntryReview } from '@/app/components/AIEntryReview';
import { PermissionGuard } from '@/app/components/PermissionGuard';
import { calculateLineTotals } from '@/app/lib/engine/formula-plugin';
import { useCascadingSelect } from '@/app/hooks/useCascadingSelect';
import { useTenantStore } from '@/app/store/tenant-store';
import type { AIExtractResult } from '@/app/lib/ai-client';
import type { TenantRole } from '@/app/store/tenant-store';

const MOCK_CLOUD_BILL: AIExtractResult = {
  description: 'Cloud Server — February 2026',
  postingDate: new Date().toISOString().slice(0, 10),
  lines: [
    {
      accountCode: '6100-Cloud',
      debitAmountCents: 125000,
      creditAmountCents: 0,
      quantity: 1,
      unit_price: 1250,
      tax_rate: 0,
      description: 'Cloud Server',
    },
    {
      accountCode: '2000-AP',
      debitAmountCents: 0,
      creditAmountCents: 125000,
      quantity: 1,
      unit_price: 1250,
      tax_rate: 0,
      description: 'Accounts Payable',
    },
  ],
  reasoning: 'Matched vendor "CloudCorp" from history; single line item $1,250; no tax per prior 12 invoices.',
  confidence: 0.92,
  suggestedSubtotal: 1250,
  suggestedTaxAmount: 0,
  suggestedGrandTotal: 1250,
};

export default function DemoPage() {
  const discovery = useTenantStore((s) => s.discovery);
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const setDemoRoleOverride = useTenantStore((s) => s.setDemoRoleOverride);

  const [touchlessStep, setTouchlessStep] = useState<'idle' | 'extract' | 'verify' | 'success'>('idle');
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [mockResult, setMockResult] = useState<AIExtractResult | null>(null);
  const [demoRole, setDemoRole] = useState<TenantRole>('OWNER');

  const [qty, setQty] = useState(2);
  const [unitPrice, setUnitPrice] = useState(99.5);
  const [taxRate, setTaxRate] = useState(8.5);
  const formulaTotals = calculateLineTotals([{ quantity: qty, unit_price: unitPrice, tax_rate: taxRate }]);

  const [customer, setCustomer] = useState<string>('');
  const fetchTerms = useCallback(async (customerId: string) => {
    await new Promise((r) => setTimeout(r, 300));
    if (customerId === 'customer-a') return { paymentTerms: 'Net 30' };
    if (customerId === 'customer-b') return { paymentTerms: 'Net 15' };
    return { paymentTerms: 'Due on receipt' };
  }, []);
  const { childValues: terms } = useCascadingSelect({
    parentValue: customer || null,
    fetchChildren: fetchTerms,
    enabled: !!customer,
  });

  const [auditEntries, setAuditEntries] = useState<Array<{ id: string; action: string; createdAt: string; payload: Record<string, unknown> }>>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    setDemoRoleOverride(demoRole);
    return () => setDemoRoleOverride(null);
  }, [demoRole, setDemoRoleOverride]);

  useEffect(() => {
    if (!activeTenantId) return;
    setAuditLoading(true);
    fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/audit?limit=10`)
      .then((r) => r.json())
      .then((d) => setAuditEntries(d.entries ?? []))
      .catch(() => setAuditEntries([]))
      .finally(() => setAuditLoading(false));
  }, [activeTenantId]);

  const runTouchlessDemo = async () => {
    setTouchlessStep('extract');
    await new Promise((r) => setTimeout(r, 1200));
    setTouchlessStep('verify');
    await new Promise((r) => setTimeout(r, 800));
    setTouchlessStep('success');
    await new Promise((r) => setTimeout(r, 400));
    setMockResult(MOCK_CLOUD_BILL);
    setAiReviewOpen(true);
    setTouchlessStep('idle');
  };

  const tenantId = discovery?.tenantId ?? activeTenantId ?? 'demo-tenant';
  const entityId = discovery?.parentEntityId ?? 'demo-entity';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Dashboard
          </Link>
          <span className="text-slate-400">|</span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Oryens — Full Feature Demo</h1>
        </header>

        <div className="space-y-10">
          {/* 1. Touchless Demo */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">1. Touchless (AI + Formula)</h2>
            <p className="mb-4 text-sm text-slate-500">Simulate invoice upload and open AI Entry Review with mock data.</p>
            <button
              type="button"
              onClick={runTouchlessDemo}
              disabled={touchlessStep !== 'idle'}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Simulate Invoice Upload
            </button>
            {touchlessStep !== 'idle' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className={touchlessStep === 'extract' ? 'font-medium text-indigo-600' : 'text-slate-400'}>
                  {touchlessStep === 'extract' ? '●' : '○'} AI (8090) Extracting...
                </span>
                <span className={touchlessStep === 'verify' ? 'font-medium text-indigo-600' : touchlessStep === 'success' ? 'text-emerald-600' : 'text-slate-400'}>
                  {touchlessStep === 'verify' ? '●' : touchlessStep === 'success' ? '✓' : '○'} Formula Engine Verifying...
                </span>
                <span className={touchlessStep === 'success' ? 'font-medium text-emerald-600' : 'text-slate-400'}>
                  {touchlessStep === 'success' ? '✓ Success' : '○ Success'}
                </span>
              </div>
            )}
          </section>

          {/* 2. RBAC Demo */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">2. RBAC (Role-Based Access)</h2>
            <p className="mb-4 text-sm text-slate-500">Toggle role to see Post and Invite buttons appear or disappear via PermissionGuard.</p>
            <div className="mb-4 flex items-center gap-4">
              <span className="text-sm text-slate-600">View as:</span>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="demoRole"
                  checked={demoRole === 'OWNER'}
                  onChange={() => setDemoRole('OWNER')}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm font-medium">OWNER</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="demoRole"
                  checked={demoRole === 'VIEWER'}
                  onChange={() => setDemoRole('VIEWER')}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm font-medium">VIEWER</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <PermissionGuard requiredRole="EDITOR">
                <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Post
                </button>
              </PermissionGuard>
              <PermissionGuard requiredRole="OWNER">
                <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Invite
                </button>
              </PermissionGuard>
            </div>
          </section>

          {/* 3. Formula & Depends On */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">3. Formula & Depends On</h2>
            <p className="mb-4 text-sm text-slate-500">Quantity updates Grand Total (formula-plugin). Customer selection auto-fills terms (useCascadingSelect).</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="mb-3 text-xs font-medium uppercase text-slate-500">Mini invoice</p>
                <div className="space-y-2">
                  <label className="block text-sm">
                    Quantity
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value) || 0)}
                      className="ml-2 w-20 rounded border border-slate-200 px-2 py-1"
                    />
                  </label>
                  <label className="block text-sm">
                    Unit price
                    <input
                      type="number"
                      step={0.01}
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                      className="ml-2 w-24 rounded border border-slate-200 px-2 py-1"
                    />
                  </label>
                  <label className="block text-sm">
                    Tax %
                    <input
                      type="number"
                      step={0.1}
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="ml-2 w-20 rounded border border-slate-200 px-2 py-1"
                    />
                  </label>
                  <p className="mt-2 font-medium text-slate-800">
                    Grand Total: ${formulaTotals.grand_total.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="mb-3 text-xs font-medium uppercase text-slate-500">Cascading: Customer → Terms</p>
                <label className="block text-sm">
                  Customer
                  <select
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="ml-2 rounded border border-slate-200 px-2 py-1"
                  >
                    <option value="">— Select —</option>
                    <option value="customer-a">Customer A</option>
                    <option value="customer-b">Customer B</option>
                    <option value="customer-c">Customer C</option>
                  </select>
                </label>
                <p className="mt-2 text-sm text-slate-700">
                  Payment terms: {terms?.paymentTerms ?? '—'}
                </p>
              </div>
            </div>
          </section>

          {/* 4. Bitemporal & Audit */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">4. Bitemporal & Audit</h2>
            <p className="mb-4 text-sm text-slate-500">Timeline from audit_log: Transaction Date (posting) vs Record Date (when stored — Zero-Day Close).</p>
            {!activeTenantId ? (
              <p className="text-sm text-slate-500">Select a company to load the audit timeline.</p>
            ) : auditLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {auditEntries.slice(0, 8).map((e) => {
                  const postingDate = (e.payload?.postingDate as string) ?? null;
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{e.action}</span>
                      {postingDate && (
                        <span className="text-slate-500">Tx date: {new Date(postingDate).toLocaleDateString()}</span>
                      )}
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500">Record: {new Date(e.createdAt).toLocaleString()}</span>
                    </li>
                  );
                })}
                {auditEntries.length === 0 && <li className="text-sm text-slate-500">No audit entries yet.</li>}
              </ul>
            )}
          </section>

          {/* 5. XAI */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">5. XAI (Explainability)</h2>
            <p className="mb-4 text-sm text-slate-500">Reasoning card: why a tax code was chosen for an entry.</p>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">Reasoning Card</p>
              <p className="text-sm text-slate-800">
                Tax code <strong>VAT-0</strong> was chosen because: vendor &quot;CloudCorp&quot; appears in the last 12 invoices with no tax applied; 
                jurisdiction is B2B exempt; and the line description matches the pattern &quot;Cloud Server&quot; from chart-of-accounts mapping.
              </p>
            </div>
          </section>
        </div>
      </div>

      <AIEntryReview
        open={aiReviewOpen}
        onClose={() => {
          setAiReviewOpen(false);
          setMockResult(null);
        }}
        tenantId={tenantId}
        entityId={entityId}
        initialResult={mockResult}
        onSuccess={() => setAiReviewOpen(false)}
      />
    </div>
  );
}
