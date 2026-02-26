'use client';

import { usePermissions } from '../hooks/usePermissions';
import type { TenantRole } from '../store/tenant-store';

const ROLE_ORDER: Record<TenantRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  OWNER: 2,
};

/**
 * Button-level ACL: renders children only if the current user's role (from user_tenants)
 * meets the required minimum. OWNER > EDITOR > VIEWER.
 * Use to hide actions like "New Entry" or "Revalue" from VIEWER.
 */
export function PermissionGuard({
  children,
  requiredRole = 'EDITOR',
}: {
  children: React.ReactNode;
  /** Minimum role required to see the content (OWNER | EDITOR | VIEWER). */
  requiredRole?: TenantRole;
}) {
  const { role } = usePermissions();
  const currentLevel = ROLE_ORDER[role] ?? 0;
  const requiredLevel = ROLE_ORDER[requiredRole] ?? 0;
  if (currentLevel < requiredLevel) return null;
  return <>{children}</>;
}
