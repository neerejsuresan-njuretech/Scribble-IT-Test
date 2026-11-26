import { useMemo } from 'react';
import {
  EffectivePermissionsSummary,
  evaluateEffectivePermissions,
  formatClearanceLabel,
  resolveEffectiveHasPermission,
} from '@scribble-it/rbac';
import type { AuthSession, FreeITSMModuleId, IamPermissionScope, Role } from '@scribble-it/types';

export { formatClearanceLabel, resolveEffectiveHasPermission };

export type EffectivePermissionsResult = EffectivePermissionsSummary;

export function usePermissions(params: {
  role: Role;
  authSession: AuthSession | null;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  isModuleEnabled: (moduleId: FreeITSMModuleId) => boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}): EffectivePermissionsResult {
  const { role, authSession, isSuperAdmin, isIamPortal, isModuleEnabled, hasPermission } = params;

  return useMemo(
    () =>
      evaluateEffectivePermissions({
        role,
        authSession,
        isSuperAdmin,
        isIamPortal,
        isModuleEnabled,
        hasPermission,
      }),
    [role, authSession, isSuperAdmin, isIamPortal, isModuleEnabled, hasPermission],
  );
}
