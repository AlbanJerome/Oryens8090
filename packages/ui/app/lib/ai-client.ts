/**
 * AI service client for document extraction (Port 8090).
 * POSTs to the extract endpoint and returns a structure aligned with journal entries + metadata.
 */

const DEFAULT_EXTRACT_URL = 'http://localhost:8090/extract';

export type AIExtractLine = {
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  /** Optional: for formula-plugin verification (quantity × unit_price, tax_rate). */
  quantity?: number;
  unit_price?: number;
  tax_rate?: number;
  description?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type AIExtractResult = {
  description: string;
  postingDate: string;
  lines: AIExtractLine[];
  metadata?: Record<string, string | number | boolean>;
  /** XAI: human-readable reasoning from the model. */
  reasoning?: string;
  /** Confidence 0–1; used for visual cues (e.g. Amber if < 0.8). */
  confidence?: number;
  /** AI-provided totals for comparison with formula-plugin. */
  suggestedSubtotal?: number;
  suggestedTaxAmount?: number;
  suggestedGrandTotal?: number;
};

/**
 * Sends the file to the AI extract service and returns parsed journal-entry-like data.
 * Uses FormData with the file; endpoint may expect multipart/form-data.
 */
export async function processDocument(
  file: File,
  options?: { extractUrl?: string }
): Promise<AIExtractResult> {
  const url = options?.extractUrl ?? DEFAULT_EXTRACT_URL;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Extract failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();

  return {
    description: data.description ?? '',
    postingDate: data.postingDate ?? new Date().toISOString().slice(0, 10),
    lines: Array.isArray(data.lines) ? data.lines : [],
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    reasoning: typeof data.reasoning === 'string' ? data.reasoning : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    suggestedSubtotal: data.suggestedSubtotal != null ? Number(data.suggestedSubtotal) : undefined,
    suggestedTaxAmount: data.suggestedTaxAmount != null ? Number(data.suggestedTaxAmount) : undefined,
    suggestedGrandTotal: data.suggestedGrandTotal != null ? Number(data.suggestedGrandTotal) : undefined,
  };
}
