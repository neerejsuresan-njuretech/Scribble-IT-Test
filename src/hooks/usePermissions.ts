import { useMemo } from 'react';
import {
  AccessibleNavSection,
  getAccessibleNavSections,
  NavRbacContext,
} from '../config/navigationAccess';
import { AuthSession, FreeITSMModuleId, IamPermissionScope, Role } from '../types/itsm';

export interface EffectivePermissionsResult {
  rbacContext: NavRbacContext;
  accessibleSections: AccessibleNavSection[];
  totalAccessibleModules: number;
  clearanceLabel: string;
  permissionSource: 'backend' | 'legacy_local';
}

/**
 * Resolves effective permissions for navigation, route guards, quick-create controls,
 * and global search. Always prefers backend-issued effective permissions from
 * `/api/v1/auth/me` when present.
 */
export function resolveEffectiveHasPermission(
  authSession: AuthSession | null,
  fallbackHasPermission: (scope: IamPermissionScope) => boolean
): (scope: IamPermissionScope) => boolean {
  if (
    authSession?.permissionSource === 'backend' &&
    Array.isArray(authSession.effectivePermissions)
  ) {
    const backendSet = new Set<IamPermissionScope>(authSession.effectivePermissions);
    return (scope: IamPermissionScope) => backendSet.has(scope);
  }
  return fallbackHasPermission;
}

export function formatClearanceLabel(params: {
  clearanceTier?: string;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}): string {
  if (params.clearanceTier) {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      iam_officer: 'IAM Officer',
      operations_lead: 'Operations Lead',
      it_operations: 'IT Operations',
      approver_cab: 'Approver & CAB',
      finops: 'FinOps Analyst',
      end_user: 'Self-Service',
      scoped_staff: 'Scoped Access',
    };
    if (labels[params.clearanceTier]) return labels[params.clearanceTier];
  }
  if (params.isSuperAdmin) return 'Super Admin';
  if (params.isIamPortal) return 'IAM Officer';
  if (params.hasPermission('workflows:manage')) return 'Operations Lead';
  if (params.hasPermission('incidents:write')) return 'IT Operations';
  if (params.hasPermission('billing:read')) return 'FinOps Analyst';
  return 'Scoped Access';
}

export function usePermissions(params: {
  role: Role;
  authSession: AuthSession | null;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  isModuleEnabled: (moduleId: FreeITSMModuleId) => boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}): EffectivePermissionsResult {
  const { role, authSession, isSuperAdmin, isIamPortal, isModuleEnabled, hasPermission } = params;

  const effectiveHasPermission = useMemo(
    () => resolveEffectiveHasPermission(authSession, hasPermission),
    [authSession, hasPermission]
  );

  const rbacContext = useMemo<NavRbacContext>(
    () => ({
      role,
      portalType: authSession?.portalType,
      isSuperAdmin,
      isIamPortal,
      isModuleEnabled,
      hasPermission: effectiveHasPermission,
    }),
    [role, authSession?.portalType, isSuperAdmin, isIamPortal, isModuleEnabled, effectiveHasPermission]
  );

  const accessibleSections = useMemo(
    () => getAccessibleNavSections(rbacContext),
    [rbacContext]
  );

  const totalAccessibleModules = useMemo(
    () => accessibleSections.reduce((sum, sec) => sum + sec.items.length, 0),
    [accessibleSections]
  );

  const clearanceLabel = useMemo(
    () =>
      formatClearanceLabel({
        clearanceTier: authSession?.clearanceTier,
        isSuperAdmin,
        isIamPortal,
        hasPermission: effectiveHasPermission,
      }),
    [authSession?.clearanceTier, isSuperAdmin, isIamPortal, effectiveHasPermission]
  );

  return {
    rbacContext,
    accessibleSections,
    totalAccessibleModules,
    clearanceLabel,
    permissionSource: authSession?.permissionSource === 'backend' ? 'backend' : 'legacy_local',
  };
}
