import type {
  AuthPortalType,
  AuthSession,
  FreeITSMModuleId,
  IamPermissionScope,
  Role,
} from '@scribble-it/types';
import {
  AccessibleNavSection,
  getAccessibleNavSections,
  NavRbacContext,
} from './navigationAccess';

export const CANONICAL_PERMISSION_SCOPES: readonly IamPermissionScope[] = [
  'incidents:read',
  'incidents:write',
  'assets:read',
  'assets:write',
  'requests:approve',
  'changes:cab_vote',
  'workflows:manage',
  'iam:manage',
  'devices:enroll_code',
  'tenants:admin',
  'billing:read',
  'audit:read',
] as const;

export const CLEARANCE_TIER_LABELS: Readonly<Record<string, string>> = {
  super_admin: 'Super Admin',
  iam_officer: 'IAM Officer',
  operations_lead: 'Operations Lead',
  it_operations: 'IT Operations',
  approver_cab: 'Approver & CAB',
  finops: 'FinOps Analyst',
  end_user: 'Self-Service',
  scoped_staff: 'Scoped Access',
};

/**
 * Resolves effective permissions for navigation, route guards, quick-create controls,
 * and global search. Always prefers backend-issued effective permissions from
 * `/api/v1/auth/me` when present.
 */
export function resolveEffectiveHasPermission(
  authSession: AuthSession | null,
  fallbackHasPermission: (scope: IamPermissionScope) => boolean,
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

export function hasAnyPermission(
  hasPermission: (scope: IamPermissionScope) => boolean,
  scopes: readonly IamPermissionScope[],
): boolean {
  return scopes.some((scope) => hasPermission(scope));
}

export function hasAllPermissions(
  hasPermission: (scope: IamPermissionScope) => boolean,
  scopes: readonly IamPermissionScope[],
): boolean {
  return scopes.every((scope) => hasPermission(scope));
}

export function isPortalSuperAdmin(portalType?: AuthPortalType): boolean {
  return portalType === 'super_admin';
}

export function isPortalIamOfficer(portalType?: AuthPortalType): boolean {
  return portalType === 'iam';
}

export function formatClearanceLabel(params: {
  clearanceTier?: string;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}): string {
  if (params.clearanceTier && CLEARANCE_TIER_LABELS[params.clearanceTier]) {
    return CLEARANCE_TIER_LABELS[params.clearanceTier];
  }
  if (params.isSuperAdmin) return 'Super Admin';
  if (params.isIamPortal) return 'IAM Officer';
  if (params.hasPermission('workflows:manage')) return 'Operations Lead';
  if (params.hasPermission('incidents:write')) return 'IT Operations';
  if (params.hasPermission('billing:read')) return 'FinOps Analyst';
  return 'Scoped Access';
}

export interface EffectivePermissionsSummary {
  rbacContext: NavRbacContext;
  accessibleSections: AccessibleNavSection[];
  totalAccessibleModules: number;
  clearanceLabel: string;
  permissionSource: 'backend' | 'legacy_local';
}

/**
 * Pure non-React permission summary builder for Web, Tauri Desktop, and React Native clients.
 */
export function evaluateEffectivePermissions(params: {
  role: Role;
  authSession: AuthSession | null;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  isModuleEnabled: (moduleId: FreeITSMModuleId) => boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}): EffectivePermissionsSummary {
  const effectiveHasPermission = resolveEffectiveHasPermission(
    params.authSession,
    params.hasPermission,
  );

  const rbacContext: NavRbacContext = {
    role: params.role,
    portalType: params.authSession?.portalType,
    isSuperAdmin: params.isSuperAdmin,
    isIamPortal: params.isIamPortal,
    isModuleEnabled: params.isModuleEnabled,
    hasPermission: effectiveHasPermission,
  };

  const accessibleSections = getAccessibleNavSections(rbacContext);
  const totalAccessibleModules = accessibleSections.reduce(
    (sum, sec) => sum + sec.items.length,
    0,
  );
  const clearanceLabel = formatClearanceLabel({
    clearanceTier: params.authSession?.clearanceTier,
    isSuperAdmin: params.isSuperAdmin,
    isIamPortal: params.isIamPortal,
    hasPermission: effectiveHasPermission,
  });

  return {
    rbacContext,
    accessibleSections,
    totalAccessibleModules,
    clearanceLabel,
    permissionSource:
      params.authSession?.permissionSource === 'backend' ? 'backend' : 'legacy_local',
  };
}
