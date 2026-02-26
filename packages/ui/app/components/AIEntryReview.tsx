'use client';

import { useState, useCallback, useEffect } from 'react';
import { processDocument, type AIExtractResult, type AIExtractLine } from '@/app/lib/ai-client';
import { toLocalDateString } from '@/app/lib/date-utils';
import { calculateLineTotals, type LineItem } from '@/app/lib/engine/formula-plugin';
import { PermissionGuard } from '@/app/components/PermissionGuard';

const CONFIDENCE_UNSURE = 0.8;

type EditableLine = AIExtractLine & { id: string };

function lineToLineItem(l: EditableLine): LineItem {
  return {
    quantity: Number(l.quantity) || 0,
    unit_price: Number(l.unit_price) || 0,
    tax_rate: Number(l.tax_rate) || 0,
  };
}

function formulaVerified(
  lines: EditableLine[],
  suggestedSubtotal?: number,
  suggestedTaxAmount?: number,
  suggestedGrandTotal?: number
): boolean {
  const items = lines.map(lineToLineItem);
  const hasAny = items.some((i) => i.quantity > 0 || i.unit_price > 0 || i.tax_rate > 0);
  if (!hasAny || suggestedSubtotal == null || suggestedTaxAmount == null || suggestedGrandTotal == null)
    return false;
  const { subtotal, tax_amount, grand_total } = calculateLineTotals(items);
  const subOk = Math.abs(subtotal - suggestedSubtotal) < 0.02;
  const taxOk = Math.abs(tax_amount - suggestedTaxAmount) < 0.02;
  const totalOk = Math.abs(grand_total - suggestedGrandTotal) < 0.02;
  return subOk && taxOk && totalOk;
}

export type AIEntryReviewProps = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  entityId: string;
  /** Initial file to process when modal opens (e.g. from a file picker elsewhere). */
  initialFile?: File | null;
  /** Pre-filled extract result (e.g. for demos); skips AI extraction when set. */
  initialResult?: AIExtractResult | null;
  onSuccess?: (info: { postingDate: string }) => void;
};

export function AIEntryReview({
  open,
  onClose,
  tenantId,
  entityId,
  initialFile = null,
  initialResult: initialResultProp = null,
  onSuccess,
}: AIEntryReviewProps) {
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AIExtractResult | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [computedTotals, setComputedTotals] = useState<{ subtotal: number; tax_amount: number; grand_total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [editableDescription, setEditableDescription] = useState('');
  const [editablePostingDate, setEditablePostingDate] = useState('');

  useEffect(() => {
    if (result) {
      setEditableDescription(result.description ?? '');
      setEditablePostingDate(result.postingDate ?? toLocalDateString(new Date()));
    }
  }, [result]);

  useEffect(() => {
    if (!open || !initialResultProp) return;
    setResult(initialResultProp);
    const withIds: EditableLine[] = (initialResultProp.lines ?? []).map((l, i) => ({
      ...l,
      id: `line-${i}-${crypto.randomUUID().slice(0, 8)}`,
    }));
    setLines(withIds);
    if (
      initialResultProp.suggestedSubtotal != null &&
      initialResultProp.suggestedTaxAmount != null &&
      initialResultProp.suggestedGrandTotal != null
    ) {
      setComputedTotals({
        subtotal: initialResultProp.suggestedSubtotal,
        tax_amount: initialResultProp.suggestedTaxAmount,
        grand_total: initialResultProp.suggestedGrandTotal,
      });
    } else {
      setComputedTotals(
        calculateLineTotals(withIds.map(lineToLineItem))
      );
    }
    setFile(null);
    setPreviewUrl(null);
    setLoading(false);
    setError(null);
  }, [open, initialResultProp]);

  const description = editableDescription || (result?.description ?? '');
  const postingDate = editablePostingDate || (result?.postingDate ?? toLocalDateString(new Date()));
  const reasoning = result?.reasoning ?? '';
  const confidence = result?.confidence ?? 1;
  const suggestedSubtotal = result?.suggestedSubtotal ?? computedTotals?.subtotal;
  const suggestedTaxAmount = result?.suggestedTaxAmount ?? computedTotals?.tax_amount;
  const suggestedGrandTotal = result?.suggestedGrandTotal ?? computedTotals?.grand_total;

  const isUnsure = confidence < CONFIDENCE_UNSURE;
  const hasFormulaInputs = lines.some((l) => (l.quantity ?? 0) !== 0 || (l.unit_price ?? 0) !== 0 || (l.tax_rate ?? 0) !== 0);
  const mathVerified = hasFormulaInputs && formulaVerified(lines, suggestedSubtotal, suggestedTaxAmount, suggestedGrandTotal);

  const recalcFromFormula = useCallback(() => {
    const items = lines.map(lineToLineItem);
    const totals = calculateLineTotals(items);
    setComputedTotals(totals);
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    setFile(initialFile ?? null);
    if (initialFile) {
      const url = URL.createObjectURL(initialFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [open, initialFile]);

  useEffect(() => {
    if (!file || !open) return;
    setError(null);
    setLoading(true);
    processDocument(file)
      .then((data) => {
        setResult(data);
        const withIds: EditableLine[] = (data.lines ?? []).map((l, i) => ({
          ...l,
          id: `line-${i}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        setLines(withIds);
        if (data.suggestedSubtotal != null && data.suggestedTaxAmount != null && data.suggestedGrandTotal != null)
          setComputedTotals({
            subtotal: data.suggestedSubtotal,
            tax_amount: data.suggestedTaxAmount,
            grand_total: data.suggestedGrandTotal,
          });
        else {
          const items = withIds.map(lineToLineItem);
          setComputedTotals(calculateLineTotals(items));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Extract failed'))
      .finally(() => setLoading(false));
  }, [file, open]);

  const handleApprovePost = async () => {
    if (lines.length < 2) {
      setPostError('At least 2 lines are required.');
      return;
    }
    setPostError(null);
    setPosting(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          postingDate,
          description: description.trim(),
          sourceModule: 'AI_REVIEW',
          lines: lines.map((l) => ({
            accountCode: l.accountCode.trim(),
            debitAmountCents: l.debitAmountCents,
            creditAmountCents: l.creditAmountCents,
            description: l.description?.trim(),
            metadata: l.metadata,
          })),
          metadata: result?.metadata,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPostError(data.error || `Request failed (${res.status})`);
        return;
      }
      onSuccess?.({ postingDate });
      onClose();
    } finally {
      setPosting(false);
    }
  };

  const handleFixRecalc = () => {
    recalcFromFormula();
  };

  const updateLine = (id: string, patch: Partial<EditableLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" aria-hidden onClick={onClose} />
      <div
        className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:inset-8"
        role="dialog"
        aria-labelledby="ai-review-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="ai-review-title" className="text-lg font-semibold text-slate-900">
            AI Entry Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: document preview */}
          <div className="flex w-1/2 flex-col border-r border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              Document
            </div>
            <div className="flex-1 overflow-auto p-2">
              {!file && (
                <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/50">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return URL.createObjectURL(f);
                        });
                        setFile(f);
                      }
                    }}
                  />
                  <span className="text-sm">Drop PDF or image, or click to upload</span>
                </label>
              )}
              {file && loading && (
                <div className="flex h-48 items-center justify-center text-slate-500">Extracting…</div>
              )}
              {file && error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}
              {previewUrl && !loading && !error && (
                <>
                  {file?.type === 'application/pdf' ? (
                    <iframe
                      src={previewUrl}
                      title="Document preview"
                      className="h-full min-h-[400px] w-full rounded border border-slate-200 bg-white"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Document preview"
                      className="max-h-full w-full rounded border border-slate-200 object-contain"
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: suggested entry + reasoning + actions */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              Suggested entry
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Description</label>
                <input
                  value={description}
                  onChange={(e) => setEditableDescription(e.target.value)}
                  placeholder="Description"
                  className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm ${mathVerified ? 'border-emerald-300 bg-emerald-50/50' : isUnsure ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Posting date</label>
                <input
                  type="date"
                  value={postingDate}
                  onChange={(e) => setEditablePostingDate(e.target.value)}
                  className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm ${isUnsure ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">Lines</label>
                  {hasFormulaInputs && (
                    <span className={`text-xs font-medium ${mathVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {mathVerified ? 'Math verified' : 'Unverified / Unsure'}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-2">
                  {lines.map((l) => (
                    <div
                      key={l.id}
                      className={`rounded border p-2 text-sm ${mathVerified ? 'border-emerald-200 bg-emerald-50/30' : isUnsure ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="grid grid-cols-12 gap-1">
                        <input
                          placeholder="Account"
                          value={l.accountCode}
                          onChange={(e) => updateLine(l.id, { accountCode: e.target.value })}
                          className="col-span-4 rounded border border-slate-200 px-2 py-1"
                        />
                        <input
                          type="number"
                          placeholder="Debit"
                          value={l.debitAmountCents ? l.debitAmountCents / 100 : ''}
                          onChange={(e) => updateLine(l.id, { debitAmountCents: Math.round(Number(e.target.value) * 100) || 0 })}
                          className="col-span-2 rounded border border-slate-200 px-2 py-1"
                        />
                        <input
                          type="number"
                          placeholder="Credit"
                          value={l.creditAmountCents ? l.creditAmountCents / 100 : ''}
                          onChange={(e) => updateLine(l.id, { creditAmountCents: Math.round(Number(e.target.value) * 100) || 0 })}
                          className="col-span-2 rounded border border-slate-200 px-2 py-1"
                        />
                        {(l.quantity != null || l.unit_price != null || l.tax_rate != null) && (
                          <>
                            <input
                              type="number"
                              placeholder="Qty"
                              value={l.quantity ?? ''}
                              onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) || 0 })}
                              className="col-span-1 rounded border border-slate-200 px-1 py-1 text-xs"
                            />
                            <input
                              type="number"
                              placeholder="Price"
                              value={l.unit_price ?? ''}
                              onChange={(e) => updateLine(l.id, { unit_price: Number(e.target.value) || 0 })}
                              className="col-span-1 rounded border border-slate-200 px-1 py-1 text-xs"
                            />
                            <input
                              type="number"
                              placeholder="Tax%"
                              value={l.tax_rate ?? ''}
                              onChange={(e) => updateLine(l.id, { tax_rate: Number(e.target.value) || 0 })}
                              className="col-span-1 rounded border border-slate-200 px-1 py-1 text-xs"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(suggestedSubtotal != null || computedTotals) && (
                <div className={`rounded border p-3 text-sm ${mathVerified ? 'border-emerald-200 bg-emerald-50/50' : isUnsure ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'}`}>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="text-right font-medium">${((computedTotals?.subtotal ?? suggestedSubtotal) ?? 0).toFixed(2)}</span>
                    <span className="text-slate-600">Tax</span>
                    <span className="text-right font-medium">${((computedTotals?.tax_amount ?? suggestedTaxAmount) ?? 0).toFixed(2)}</span>
                    <span className="text-slate-600">Total</span>
                    <span className="text-right font-semibold">${((computedTotals?.grand_total ?? suggestedGrandTotal) ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {reasoning && (
                <div>
                  <label className="block text-xs font-medium text-slate-500">Reasoning (XAI)</label>
                  <div className="mt-0.5 rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {reasoning}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
              <PermissionGuard requiredRole="EDITOR">
                <button
                  type="button"
                  onClick={handleApprovePost}
                  disabled={posting || lines.length < 2}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {posting ? 'Posting…' : 'Approve & Post'}
                </button>
              </PermissionGuard>
              <button
                type="button"
                onClick={handleFixRecalc}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fix & Re-calculate
              </button>
              {postError && <span className="text-sm text-red-600">{postError}</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
