import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';

import type {
  AuthSession,
  BackendLoginResponse,
  Incident,
  IncidentDto,
  PaginatedDto,
} from '@scribble-it/types';
import {
  BRAND_COLORS,
  BORDER_RADII,
  DARK_THEME,
  ENTERPRISE_STATUS_TOKENS,
  FONT_FAMILIES,
  INCIDENT_PRIORITY_TOKENS,
  LIGHT_THEME,
  SCRIBBLE_IT_BRAND,
  SLA_STATUS_TOKENS,
  SPACING,
  TYPOGRAPHY_SCALE,
  type ThemeTokens,
} from '@scribble-it/design-tokens';
import {
  canAccessNavId,
  canAccessRoutePath,
  evaluateEffectivePermissions,
  formatClearanceLabel,
  getAccessibleNavSections,
  hasAllPermissions,
  hasAnyPermission,
  resolveEffectiveHasPermission,
} from '@scribble-it/rbac';
import {
  ApiError,
  createScribbleApiClient,
  mapIncidentDto,
  normalizeFastApiBaseUrl,
  type TokenStorageAdapter,
  type TokenUpdateParams,
} from '@scribble-it/api-client';

const REPO_ROOT = path.resolve(process.cwd());

function createAsyncSecureStorageMock(): TokenStorageAdapter & {
  reads: number;
  writes: number;
} {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let organizationId: string | null = null;

  return {
    reads: 0,
    writes: 0,
    async getAccessToken() {
      this.reads += 1;
      return accessToken;
    },
    async getRefreshToken() {
      this.reads += 1;
      return refreshToken;
    },
    async getOrganizationId() {
      this.reads += 1;
      return organizationId;
    },
    async setTokens(params: TokenUpdateParams) {
      this.writes += 1;
      accessToken = params.accessToken;
      if (params.refreshToken !== undefined) {
        refreshToken = params.refreshToken;
      }
      if (params.organizationId !== undefined) {
        organizationId = params.organizationId;
      }
    },
    async clearTokens() {
      this.writes += 1;
      accessToken = null;
      refreshToken = null;
      organizationId = null;
    },
  };
}

test('@scribble-it/design-tokens enforces official palette, themes, typography, ITSM statuses, and zero version numbers', () => {
  assert.equal(BRAND_COLORS.deepNavy, '#0B1F3B');
  assert.equal(BRAND_COLORS.njureBlue, '#0A84FF');
  assert.equal(BRAND_COLORS.accentCyan, '#22D3EE');
  assert.equal(BRAND_COLORS.surface, '#F5F8FF');

  assert.equal(SCRIBBLE_IT_BRAND.productName, 'SCRIBBLE-IT');
  assert.equal(SCRIBBLE_IT_BRAND.wordmark, 'Scribble IT');
  assert.equal(SCRIBBLE_IT_BRAND.productAttribution, 'A Njure Tech product.');
  assert.equal(SCRIBBLE_IT_BRAND.tagline, 'Enterprise IT Management. Open to Everyone.');

  // Strict zero-version branding guard
  for (const val of Object.values(SCRIBBLE_IT_BRAND)) {
    assert.doesNotMatch(
      String(val),
      /\b(2\.0|V2|v2)\b/,
      `Forbidden version string in brand metadata: ${val}`,
    );
  }

  const dark: ThemeTokens = DARK_THEME;
  const light: ThemeTokens = LIGHT_THEME;
  assert.equal(dark.mode, 'dark');
  assert.equal(light.mode, 'light');
  assert.equal(dark.brand.primary, '#0A84FF');
  assert.equal(light.background.canvas, '#F5F8FF');
  assert.equal(dark.background.surface, '#0B1F3B');

  assert.ok(FONT_FAMILIES.css.display.includes('Manrope'));
  assert.ok(FONT_FAMILIES.css.sans.includes('Inter'));
  assert.equal(FONT_FAMILIES.native.displayExtraBold, 'Manrope-ExtraBold');
  assert.ok(TYPOGRAPHY_SCALE.display.fontSize === 40);
  assert.ok(SPACING[4] === 16 && BORDER_RADII.md === 8);

  assert.ok(INCIDENT_PRIORITY_TOKENS.P1 && INCIDENT_PRIORITY_TOKENS.P4);
  assert.ok(SLA_STATUS_TOKENS.on_track && SLA_STATUS_TOKENS.breached);
  assert.ok(ENTERPRISE_STATUS_TOKENS.open && ENTERPRISE_STATUS_TOKENS.resolved);
});

test('@scribble-it/rbac evaluates permissions and navigation clearance purely without React/DOM', () => {
  const superAdminSession: AuthSession = {
    isAuthenticated: true,
    portalType: 'super_admin',
    role: 'admin',
    name: 'Global Super Admin',
    email: 'superadmin@njuregroup.in',
    department: 'Platform Governance',
    authMethod: 'admin_credentials',
    deviceManaged: true,
    permissionSource: 'backend',
    clearanceTier: 'super_admin',
    effectivePermissions: ['audit:read', 'iam:manage', 'tenants:admin', 'incidents:read'],
    authenticatedAt: new Date().toISOString(),
  };

  const superAdmin = evaluateEffectivePermissions({
    role: 'admin',
    authSession: superAdminSession,
    isSuperAdmin: true,
    isIamPortal: false,
    isModuleEnabled: () => true,
    hasPermission: () => false,
  });
  assert.equal(superAdmin.permissionSource, 'backend');
  assert.equal(superAdmin.rbacContext.hasPermission('audit:read'), true);
  assert.equal(superAdmin.rbacContext.hasPermission('iam:manage'), true);
  assert.equal(superAdmin.clearanceLabel, 'Super Admin');
  assert.equal(canAccessNavId('audit', superAdmin.rbacContext) || canAccessNavId('tenants', superAdmin.rbacContext), true);

  const techSession: AuthSession = {
    isAuthenticated: true,
    portalType: 'employee',
    role: 'technician',
    name: 'Jordan Rivera',
    email: 'tech@njuregroup.in',
    department: 'IT Service Desk',
    authMethod: 'employee_password',
    deviceManaged: true,
    permissionSource: 'backend',
    clearanceTier: 'it_operations',
    effectivePermissions: ['incidents:read', 'incidents:write', 'assets:read'],
    authenticatedAt: new Date().toISOString(),
  };

  const tech = evaluateEffectivePermissions({
    role: 'technician',
    authSession: techSession,
    isSuperAdmin: false,
    isIamPortal: false,
    isModuleEnabled: () => true,
    hasPermission: () => false,
  });
  assert.equal(tech.rbacContext.hasPermission('incidents:write'), true);
  assert.equal(tech.rbacContext.hasPermission('iam:manage'), false);
  assert.equal(hasAnyPermission(tech.rbacContext.hasPermission, ['iam:manage', 'assets:read']), true);
  assert.equal(hasAllPermissions(tech.rbacContext.hasPermission, ['incidents:read', 'assets:read']), true);
  assert.equal(hasAllPermissions(tech.rbacContext.hasPermission, ['incidents:read', 'iam:manage']), false);

  const resolved = resolveEffectiveHasPermission(techSession, () => false);
  assert.equal(resolved('incidents:read'), true);
  assert.equal(resolved('iam:manage'), false);

  assert.equal(
    formatClearanceLabel({
      isSuperAdmin: false,
      isIamPortal: true,
      hasPermission: () => false,
    }),
    'IAM Officer',
  );

  // Navigation policy check: end_user/customer accounts receive zero corporate staff sidebar sections
  assert.equal(canAccessRoutePath('/incidents', tech.rbacContext), true);
  assert.equal(canAccessRoutePath('/tenants', tech.rbacContext), false);
  const endUserSections = getAccessibleNavSections({
    role: 'customer',
    portalType: 'end_user',
    isSuperAdmin: false,
    isIamPortal: false,
    isModuleEnabled: () => true,
    hasPermission: () => false,
  });
  assert.equal(endUserSections.length, 0);
  const techSections = getAccessibleNavSections(tech.rbacContext);
  assert.ok(techSections.length > 0);
  assert.ok(!techSections.some((sec) => sec.items.some((item) => item.id === 'iam')));
  assert.ok(!techSections.some((sec) => sec.items.some((item) => item.id === 'tenants')));
});

test('@scribble-it/api-client supports async TokenStorageAdapter, async BaseUrlProvider, 401 refresh rotation, and FastAPI-only AI routes', async () => {
  assert.equal(normalizeFastApiBaseUrl('https://api.example.com/'), 'https://api.example.com/api/v1');
  assert.equal(normalizeFastApiBaseUrl('https://api.example.com/api/v1/'), 'https://api.example.com/api/v1');

  const observed: Array<{ method: string; url: string; auth?: string; org?: string }> = [];
  let failOnceWith401 = true;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const url = req.url || '/';
      const method = req.method || 'GET';
      observed.push({
        method,
        url,
        auth: req.headers.authorization,
        org: req.headers['x-organization-id'] as string | undefined,
      });

      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (method === 'POST' && url === '/api/v1/auth/login') {
        const loginPayload: BackendLoginResponse = {
          access_token: 'native-access-1',
          refresh_token: 'native-refresh-1',
          token_type: 'bearer',
          expires_in: 900,
          session_id: 'sess-native-1',
          user_id: 'usr-native-1',
          email: 'ops@njuregroup.in',
          full_name: 'Ops Lead',
          portal_type: 'employee',
          clearance_tier: 'it_operations',
          organization_id: 'org-njure',
          organization_slug: 'njure-tech',
          permissions: ['incidents:read'],
        };
        return send(200, loginPayload);
      }

      if (method === 'GET' && url === '/api/v1/incidents') {
        if (failOnceWith401 && req.headers.authorization === 'Bearer native-access-1') {
          failOnceWith401 = false;
          return send(401, { detail: 'Access token expired' });
        }
        const now = new Date().toISOString();
        const dto: IncidentDto = {
          id: 'inc-100',
          organization_id: 'org-njure',
          number: 'INC0000100',
          title: 'VPN tunnel timeout',
          description: 'Branch office tunnel dropped',
          category: 'network',
          priority: 'P2',
          impact: 'medium',
          urgency: 'high',
          status: 'assigned',
          requester_name: 'Ops Lead',
          requester_email: 'ops@njuregroup.in',
          assignee_name: 'NetOps Team',
          assignment_group: 'Network Engineering',
          affected_ci_label: 'vpn-gw-01',
          sla_deadline: now,
          sla_breached: false,
          time_logged_mins: 15,
          csat_score: null,
          source_channel: 'portal',
          resolution_notes: null,
          created_at: now,
          updated_at: now,
          activities: [],
        };
        const page: PaginatedDto<IncidentDto> = {
          items: [dto],
          meta: {
            page: 1,
            page_size: 25,
            total: 1,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          },
        };
        return send(200, page);
      }

      if (method === 'POST' && url === '/api/v1/auth/refresh') {
        return send(200, {
          access_token: 'native-access-2',
          refresh_token: 'native-refresh-2',
          token_type: 'bearer',
          expires_in: 900,
        });
      }

      if (method === 'POST' && url === '/api/v1/ai/triage-incident') {
        return send(200, {
          recommendedPriority: 'P2',
          recommendedCategory: 'network',
          suggestedQueue: 'Network Engineering',
          rootCauseHypothesis: 'IPsec phase 2 key lifetime mismatch',
          diagnosticSteps: ['Inspect IPsec phase 2 lifetime'],
          draftResolutionNote: 'Synchronize gateway lifetime parameters.',
          draftCustomerReply: 'Network engineering is investigating the VPN tunnel interruption.',
          generatedAt: new Date().toISOString(),
          requiresHumanApproval: true,
        });
      }

      if (method === 'GET' && url === '/api/v1/incidents/missing') {
        return send(404, { detail: 'Incident not found' });
      }

      return send(404, { detail: 'Not found' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;

  try {
    const secureStorage = createAsyncSecureStorageMock();
    const client = createScribbleApiClient({
      tokenStorage: secureStorage,
      baseUrlProvider: async () => `http://127.0.0.1:${port}`,
    });

    await client.auth.login({
      email: 'ops@njuregroup.in',
      password: 'SecretPassword!123',
      portal_type: 'employee',
    });
    assert.equal(await secureStorage.getAccessToken(), 'native-access-1');
    assert.equal(await secureStorage.getOrganizationId(), 'org-njure');
    assert.ok(secureStorage.writes >= 1);

    // Triggers 401 -> single-flight refresh -> retry with rotated token
    const page = await client.itsm.listIncidents();
    const incidents: Incident[] = page.items.map(mapIncidentDto);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].id, 'inc-100');
    assert.equal(incidents[0].title, 'VPN tunnel timeout');
    assert.equal(await secureStorage.getAccessToken(), 'native-access-2');

    // FastAPI-only AI endpoint check
    const triage = await client.ai.triageIncident({
      title: 'VPN tunnel timeout',
      description: 'Branch office tunnel dropped',
    });
    assert.equal(triage.recommendedPriority, 'P2');
    assert.ok(observed.some((r) => r.url === '/api/v1/ai/triage-incident' && r.org === 'org-njure'));

    // Structured ApiError propagation
    await assert.rejects(
      () => client.http.request('/incidents/missing'),
      (err: unknown) => err instanceof ApiError && err.status === 404 && err.message === 'Incident not found',
    );
  } finally {
    server.close();
  }
});

test('Shared packages maintain acyclic DAG, zero React/DOM dependencies, and zero Express routes', () => {
  const pkgNames = ['types', 'design-tokens', 'rbac', 'api-client'];
  const depsGraph = new Map<string, string[]>();

  for (const dir of pkgNames) {
    const pkgJsonPath = path.join(REPO_ROOT, 'packages', dir, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.peerDependencies || {}),
    };

    // No React, React-DOM, Express, or browser-only UI packages in shared packages
    for (const forbidden of ['react', 'react-dom', 'express', 'lucide-react', 'tailwindcss']) {
      assert.equal(
        allDeps[forbidden],
        undefined,
        `Shared package ${pkgJson.name} must not depend on ${forbidden}`,
      );
    }

    const internalDeps = Object.keys(allDeps).filter((d) => d.startsWith('@scribble-it/'));
    depsGraph.set(pkgJson.name, internalDeps);

    // Scan source files for forbidden React/DOM imports or Express /api/ai routes
    const srcDir = path.join(REPO_ROOT, 'packages', dir, 'src');
    for (const file of fs.readdirSync(srcDir)) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      assert.doesNotMatch(
        content,
        /from\s+['"]react(-dom)?['"]/,
        `${pkgJson.name}/src/${file} must not import React`,
      );
      assert.doesNotMatch(
        content,
        /\bdocument\.(getElementById|querySelector|createElement)\b/,
        `${pkgJson.name}/src/${file} must not rely on DOM APIs`,
      );
      if (dir === 'api-client') {
        assert.doesNotMatch(
          content,
          /['"]\/api\/ai\//,
          `@scribble-it/api-client/${file} must use FastAPI /api/v1/ai/* exclusively, never Express /api/ai/*`,
        );
      }
    }
  }

  // Verify strict acyclic DAG using DFS
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(node: string) {
    if (visiting.has(node)) {
      assert.fail(`Circular workspace dependency detected involving ${node}`);
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dep of depsGraph.get(node) || []) {
      visit(dep);
    }
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of depsGraph.keys()) {
    visit(node);
  }
});
