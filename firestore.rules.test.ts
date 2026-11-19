/**
 * Phase 0 Security Specification Test Suite for Scribble IT Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads against firestore.rules when run
 * with @firebase/rules-unit-testing against the Firebase Emulator Suite.
 */

export interface SecurityRuleTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: SecurityRuleTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on incidents',
    operation: 'get',
    path: '/workspaces/userA/incidents/INC-1001',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email spoofing admin email',
    operation: 'get',
    path: '/workspaces/userA',
    auth: { uid: 'attacker', email: 'neerej.suresan.s@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-user PII read on another user workspace tenants',
    operation: 'get',
    path: '/workspaces/userA/tenants/tenant-acme',
    auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity spoofing ownerUid mismatch on create',
    operation: 'create',
    path: '/workspaces/userA/incidents/INC-1002',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { id: 'INC-1002', ownerUid: 'userB', tenantId: 'tenant-1', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned subcollection create without parent workspace doc',
    operation: 'create',
    path: '/workspaces/userNoParent/tenants/tenant-1',
    auth: { uid: 'userNoParent', email: 'n@example.com', email_verified: true },
    payload: { id: 'tenant-1', ownerUid: 'userNoParent', name: 'Orphan Corp' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow ghost field injection on tenant create',
    operation: 'create',
    path: '/workspaces/userA/tenants/tenant-ghost',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { id: 'tenant-ghost', ownerUid: 'userA', isSuperAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow ghost field injection on incident update',
    operation: 'update',
    path: '/workspaces/userA/incidents/INC-1001',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { bypassSla: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID poisoning with invalid characters / excessive length',
    operation: 'create',
    path: '/workspaces/userA/incidents/' + 'A'.repeat(200),
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { id: 'A'.repeat(200), ownerUid: 'userA' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value poisoning with oversized title string (>256 chars)',
    operation: 'update',
    path: '/workspaces/userA/incidents/INC-1001',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { title: 'X'.repeat(500) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client-forged backdated createdAt timestamp',
    operation: 'create',
    path: '/workspaces/userA',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: {
      ownerUid: 'userA',
      ownerEmail: 'a@example.com',
      activeTenantId: 'tenant-1',
      theme: 'dark',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immutable ownerUid mutation during update',
    operation: 'update',
    path: '/workspaces/userA/incidents/INC-1001',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { ownerUid: 'userB' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Terminal state mutation on closed incident by non-admin',
    operation: 'update',
    path: '/workspaces/userA/incidents/INC-CLOSED',
    auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { status: 'in_progress', title: 'Reopened illegally' },
    expected: 'PERMISSION_DENIED',
  },
];
