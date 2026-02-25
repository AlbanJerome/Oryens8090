/**
 * Client-side cookie helpers for active tenant persistence.
 * Session cookie (no max-age) so the app stays locked to company context for the browser session.
 */

const ACTIVE_TENANT_COOKIE = 'active_tenant_id';

export function getActiveTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_TENANT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setActiveTenantIdCookie(tenantId: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACTIVE_TENANT_COOKIE}=${encodeURIComponent(tenantId)}; path=/; SameSite=Lax`;
}

export function clearActiveTenantIdCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACTIVE_TENANT_COOKIE}=; path=/; max-age=0`;
}
