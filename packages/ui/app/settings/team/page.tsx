'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../../store/tenant-store';
import { usePermissions } from '../../hooks/usePermissions';
import { OryensSpinner } from '../../components/OryensSpinner';
import { PermissionGuard } from '../../components/PermissionGuard';

type TeamMember = { userId: string; email: string | null; role: 'OWNER' | 'EDITOR' | 'VIEWER' };

export default function TeamPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const { isOwner } = usePermissions(); // Invite button also guarded by PermissionGuard below
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/team`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load team');
        return res.json();
      })
      .then((data: { users?: TeamMember[] }) => setUsers(data.users ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId || !inviteEmail.trim()) return;
    setInviteError(null);
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setUsers((prev) => [...prev, { userId: data.userId, email: data.email ?? null, role: data.role }]);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('EDITOR');
    } finally {
      setInviteLoading(false);
    }
  }

  if (!activeTenantId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-slate-600">Select a company to manage team.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/settings" className="text-sm text-slate-500 hover:text-slate-700">
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">Users with access to this company.</p>
        </div>
        <PermissionGuard requiredRole="OWNER">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            Invite User
          </button>
        </PermissionGuard>
      </header>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          onClick={() => { setInviteOpen(false); setInviteError(null); }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="invite-modal-title" className="text-lg font-medium text-slate-900">
              Invite by email
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              User must already have an account. They will be linked to this company with the chosen role.
            </p>
            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                placeholder="colleague@example.com"
              />
              </div>
              <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
              </div>
              {inviteError && (
                <p className="text-sm text-red-600" role="alert">
                  {inviteError}
                </p>
              )}
              <div className="flex gap-2">
              <button
                type="submit"
                disabled={inviteLoading}
                className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-70"
              >
                {inviteLoading ? 'Inviting…' : 'Invite'}
              </button>
              <button
                type="button"
                onClick={() => { setInviteOpen(false); setInviteError(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center gap-3 p-8 text-slate-500" aria-label="Loading">
            <OryensSpinner className="oryens-spinner" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No team members yet.</div>
        ) : (
          <table className="saas-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="font-medium text-slate-900">{u.email ?? u.userId}</td>
                  <td className="text-slate-600">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
