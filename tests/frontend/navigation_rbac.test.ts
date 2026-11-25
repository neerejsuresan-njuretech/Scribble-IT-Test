import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_SECTION_METADATA,
  NAV_MODULES_BY_ID,
  canAccessNavId,
  canAccessRoutePath,
  canUseQuickCreate,
  getAccessibleNavSections,
  getGlobalSearchPermissions,
  NavRbacContext,
} from '../../src/config/navigationAccess';
import { resolveEffectiveHasPermission, formatClearanceLabel } from '../../src/hooks/usePermissions';
import type { AuthSession, FreeITSMModuleId, IamPermissionScope } from '../../src/types/itsm';

function makeContext(overrides: Partial<NavRbacContext> & { perms?: IamPermissionScope[]; disabledModules?: FreeITSMModuleId[] } = {}): NavRbacContext {
  const permSet = new Set<IamPermissionScope>(overrides.perms || []);
  const disabledSet = new Set<FreeITSMModuleId>(overrides.disabledModules || []);
  return {
    role: overrides.role ?? 'technician',
    portalType: overrides.portalType ?? 'employee',
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    isIamPortal: overrides.isIamPortal ?? false,
    isModuleEnabled: (id) => !disabledSet.has(id),
    hasPermission: (scope) => (overrides.isSuperAdmin ? true : permSet.has(scope)),
  };
}

test('preserves all 9 exact enterprise navigation groups in NAV_SECTION_METADATA', () => {
  const titles = Object.values(NAV_SECTION_METADATA).map((s) => s.title);
  assert.deepEqual(titles, [
    'Command & Operations',
    'ITSM & Delivery',
    'CMDB & Assets',
    'Automation & Workflows',
    'Finance',
    'Audit & Communications',
    'Knowledge & Learning',
    'Google Workspace',
    'Governance & Platform',
  ]);
});

test('Super Admin sees all 9 navigation sections and governance modules', () => {
  const ctx = makeContext({
    role: 'admin',
    portalType: 'super_admin',
    isSuperAdmin: true,
  });
  const sections = getAccessibleNavSections(ctx);
  assert.equal(sections.length, 9);
  assert.ok(canAccessNavId('tenants', ctx));
  assert.ok(canAccessNavId('module_controls', ctx));
  assert.ok(canAccessNavId('database', ctx));
  assert.ok(canAccessRoutePath('/incidents/new', ctx));
  assert.ok(canAccessRoutePath('/billing/new', ctx));
});

test('IAM Portal places Governance & Platform and Audit & Communications first and hides unauthorized modules', () => {
  const ctx = makeContext({
    role: 'technician',
    portalType: 'iam',
    isIamPortal: true,
    perms: ['iam:manage', 'audit:read', 'incidents:read', 'assets:read'],
  });
  const sections = getAccessibleNavSections(ctx);
  assert.equal(sections[0].meta.id, 'governance');
  assert.equal(sections[1].meta.id, 'audit_comms');

  // IAM officer can access IAM Portal and Reports/Audit, but NOT Super Admin-only pages or Finance
  assert.ok(canAccessNavId('iam', ctx));
  assert.ok(canAccessNavId('reports', ctx));
  assert.equal(canAccessNavId('tenants', ctx), false);
  assert.equal(canAccessNavId('module_controls', ctx), false);
  assert.equal(canAccessNavId('database', ctx), false);
  assert.equal(canAccessNavId('billing', ctx), false);
  // Empty Finance section must be pruned completely
  assert.equal(sections.some((s) => s.meta.id === 'finance'), false);
});

test('FinOps Analyst sees Finance & Vendor Contracts and is blocked from ITSM, Assets, Governance, and unauthorized quick-create routes', () => {
  const ctx = makeContext({
    role: 'technician',
    portalType: 'employee',
    perms: ['billing:read'],
  });
  const sections = getAccessibleNavSections(ctx);
  const sectionIds = sections.map((s) => s.meta.id);

  assert.ok(sectionIds.includes('finance'));
  // Vendor Contracts & RFP inside CMDB is intentionally available to billing:read, while hardware/software CMDB items stay hidden
  const cmdbSection = sections.find((s) => s.meta.id === 'cmdb');
  assert.deepEqual(cmdbSection?.items.map((i) => i.id), ['contracts']);
  assert.equal(sectionIds.includes('itsm'), false);
  assert.equal(sectionIds.includes('governance'), false);
  assert.equal(sectionIds.includes('automation'), false);

  assert.equal(canAccessRoutePath('/billing', ctx), true);
  assert.equal(canAccessRoutePath('/billing/new', ctx), true);
  assert.equal(canAccessRoutePath('/assets', ctx), false);
  assert.equal(canAccessRoutePath('/assets/new', ctx), false);
  assert.equal(canAccessRoutePath('/incidents', ctx), false);
  assert.equal(canAccessRoutePath('/incidents/new', ctx), false);
  assert.equal(canAccessRoutePath('/tenants', ctx), false);
});

test('Quick-create buttons and direct /new routes are gated by write permissions and tenant module flags', () => {
  const readOnlyCtx = makeContext({
    perms: ['incidents:read', 'assets:read'],
  });

  // Read-only user can view Incidents & Assets, but CANNOT use quick-create or open /new URLs directly
  assert.equal(canAccessRoutePath('/incidents', readOnlyCtx), true);
  assert.equal(canAccessRoutePath('/incidents/new', readOnlyCtx), false);
  assert.equal(canUseQuickCreate(NAV_MODULES_BY_ID.incidents, readOnlyCtx), false);
  assert.equal(canAccessRoutePath('/assets', readOnlyCtx), true);
  assert.equal(canAccessRoutePath('/assets/new', readOnlyCtx), false);
  assert.equal(canUseQuickCreate(NAV_MODULES_BY_ID.assets, readOnlyCtx), false);

  // Technician with write permission loses access immediately when tenant disables the module
  const disabledModuleCtx = makeContext({
    perms: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'],
    disabledModules: ['assets'],
  });
  assert.equal(canAccessRoutePath('/incidents/new', disabledModuleCtx), true);
  assert.equal(canAccessRoutePath('/assets', disabledModuleCtx), false);
  assert.equal(canAccessRoutePath('/assets/new', disabledModuleCtx), false);
  assert.equal(canUseQuickCreate(NAV_MODULES_BY_ID.assets, disabledModuleCtx), false);
});

test('Global search authorization mirrors effective permissions and tenant module toggles', () => {
  const finopsCtx = makeContext({ perms: ['billing:read'] });
  const finopsSearch = getGlobalSearchPermissions(finopsCtx);
  assert.equal(finopsSearch.canSearchIncidents, false);
  assert.equal(finopsSearch.canSearchRequests, false);
  assert.equal(finopsSearch.canSearchProblems, false);
  assert.equal(finopsSearch.canSearchChanges, false);
  assert.equal(finopsSearch.canSearchAssets, false);
  assert.equal(finopsSearch.ownRecordsOnly, false);

  const cabApproverCtx = makeContext({
    perms: ['requests:approve', 'changes:cab_vote'],
    disabledModules: ['changes'],
  });
  const cabSearch = getGlobalSearchPermissions(cabApproverCtx);
  assert.equal(cabSearch.canSearchRequests, true);
  assert.equal(cabSearch.canSearchChanges, false); // blocked by disabled tenant module
  assert.equal(cabSearch.canSearchIncidents, false);

  const endUserCtx = makeContext({ role: 'customer', portalType: 'end_user', perms: ['incidents:read'] });
  const endUserSearch = getGlobalSearchPermissions(endUserCtx);
  assert.equal(endUserSearch.ownRecordsOnly, true);
  assert.equal(endUserSearch.canSearchRequests, true);
  assert.equal(endUserSearch.canSearchProblems, false);
  assert.equal(endUserSearch.canSearchChanges, false);
});

test('resolveEffectiveHasPermission prioritizes backend-delivered effectivePermissions over local fallbacks', () => {
  const backendSession: AuthSession = {
    isAuthenticated: true,
    portalType: 'employee',
    role: 'admin', // even if stale local role says admin, backend scopes are authoritative
    name: 'Avery Chen',
    email: 'avery@acme.io',
    department: 'IT Operations',
    authMethod: 'employee_password',
    deviceManaged: false,
    authenticatedAt: new Date().toISOString(),
    backendOrganizationId: 'org-1',
    permissionSource: 'backend',
    effectivePermissions: ['incidents:read', 'assets:read'],
    clearanceTier: 'scoped_staff',
  };

  // Fallback tries to grant everything, but backend scopes must strictly win
  const check = resolveEffectiveHasPermission(backendSession, () => true);
  assert.equal(check('incidents:read'), true);
  assert.equal(check('assets:read'), true);
  assert.equal(check('incidents:write'), false);
  assert.equal(check('tenants:admin'), false);
  assert.equal(check('iam:manage'), false);

  assert.equal(
    formatClearanceLabel({
      clearanceTier: backendSession.clearanceTier,
      isSuperAdmin: false,
      isIamPortal: false,
      hasPermission: check,
    }),
    'Scoped Access'
  );
});
