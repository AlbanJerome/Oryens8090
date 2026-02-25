import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL =
  typeof process.env.NEXT_PUBLIC_AI_SERVICE_URL === 'string' && process.env.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : 'http://localhost:8090';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${AI_SERVICE_URL}/v1/ai/summarize-account-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { summary: data.summary ?? 'Unable to generate summary.', error: data.error },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Summarize account activity proxy error:', error);
    return NextResponse.json(
      { summary: 'Summary unavailable.', error: error instanceof Error ? error.message : 'Request failed' },
      { status: 502 }
    );
  }
}
