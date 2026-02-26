'use client';

import { useTenantStore } from '../store/tenant-store';
import type { TenantRole } from '../store/tenant-store';

export type Permissions = {
  role: TenantRole;
  canPost: boolean;
  canEdit: boolean;
  isOwner: boolean;
};

/**
 * Derives RBAC permissions for the current user in the active tenant.
 * OWNER = full access; EDITOR = can post entries; VIEWER = read-only.
 */
export function usePermissions(): Permissions {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const userTenants = useTenantStore((s) => s.userTenants);
  const demoRoleOverride = useTenantStore((s) => s.demoRoleOverride);
  const current = activeTenantId
    ? userTenants.find((t) => t.tenantId === activeTenantId)
    : null;
  const role: TenantRole = demoRoleOverride ?? current?.role ?? 'VIEWER';
  return {
    role,
    canPost: role === 'OWNER' || role === 'EDITOR',
    canEdit: role === 'OWNER' || role === 'EDITOR',
    isOwner: role === 'OWNER',
  };
}
