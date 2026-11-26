import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AddressInfo } from 'node:net';

import type { Incident, AuthTokenResponseDto, IncidentDto } from '@scribble-it/types';
import {
  BRAND_PALETTE,
  DARK_THEME,
  LIGHT_THEME,
  INCIDENT_PRIORITY_TOKENS,
  SLA_STATUS_TOKENS,
  ENTERPRISE_STATUS_TOKENS,
  SCRIBBLE_IT_BRAND,
  TYPOGRAPHY,
  SPACING,
  RADII,
} from '@scribble-it/design-tokens';
import {
  canAccessPage,
  evaluateEffectivePermissions,
  formatClearanceLabel,
  getVisibleSidebarItems,
  hasAllPermissions,
  hasAnyPermission,
  resolveEffectiveHasPermission,
} from '@scribble-it/rbac';
import {
  ApiError,
  createScribbleApiClient,
  normalizeFastApiBaseUrl,
  type TokenStorageAdapter,
} from '@scribble-it/api-client';

const REPO_ROOT = path.resolve(process.cwd());

function createAsyncSecureStorageMock(): TokenStorageAdapter & { reads: number; writes: number } {
  const store = new Map<string, string>();
  return {
    reads: 0,
    writes: 0,
    async getItem(key: string) {
      this.reads += 1;
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      this.writes += 1;
      store.set(key, value);
    },
    async removeItem(key: string) {
      this.writes += 1;
      store.delete(key);
    },
  };
}

test('@scribble-it/design-tokens enforces official palette, themes, typography, ITSM statuses, and zero version numbers', () => {
  assert.equal(BRAND_PALETTE.deepNavy, '#0B1F3B');
  assert.equal(BRAND_PALETTE.njureBlue, '#0A84FF');
  assert.equal(BRAND_PALETTE.accentCyan, '#22D3EE');
  assert.equal(BRAND_PALETTE.surface, '#F5F8FF');

  assert.equal(SCRIBBLE_IT_BRAND.productName, 'SCRIBBLE-IT');
  assert.equal(SCRIBBLE_IT_BRAND.wordmark, 'Scribble IT');
  assert.equal(SCRIBBLE_IT_BRAND.productAttribution, 'A Njure Tech product.');
  assert.equal(SCRIBBLE_IT_BRAND.tagline, 'Enterprise IT Management. Open to Everyone.');

  // Strict zero-version branding guard
  for (const val of Object.values(SCRIBBLE_IT_BRAND)) {
    assert.doesNotMatch(String(val), /\b(2\.0|V2|v2)\b/, `Forbidden version string in brand metadata: ${val}`);
  }

  assert.equal(DARK_THEME.mode, 'dark');
  assert.equal(LIGHT_THEME.mode, 'light');
  assert.equal(DARK_THEME.brand.primary, '#0A84FF');
  assert.equal(LIGHT_THEME.surface.canvas, '#F5F8FF');

  assert.ok(TYPOGRAPHY.fontFamily.display.includes('Manrope'));
  assert.ok(TYPOGRAPHY.fontFamily.sans.includes('Inter'));
  assert.ok(SPACING[4] === 16 && RADII.md === 8);

  assert.ok(INCIDENT_PRIORITY_TOKENS.P1 && INCIDENT_PRIORITY_TOKENS.P4);
  assert.ok(SLA_STATUS_TOKENS.on_track && SLA_STATUS_TOKENS.breached);
  assert.ok(ENTERPRISE_STATUS_TOKENS.open && ENTERPRISE_STATUS_TOKENS.resolved);
});

test('@scribble-it/rbac evaluates permissions and navigation clearance purely without React/DOM', () => {
  const superAdmin = evaluateEffectivePermissions({
    role: 'Super Admin',
    backendPermissions: [],
    permissionSource: 'local',
    portalClearance: 'L5_SUPER_ADMIN',
  });
  assert.equal(superAdmin.isSuperAdmin, true);
  assert.equal(superAdmin.hasPermission('governance.audit.read'), true);
  assert.equal(superAdmin.hasPermission('iam.users.manage'), true);
  assert.equal(formatClearanceLabel(superAdmin.clearance), 'L5 — Super Admin');

  const tech = evaluateEffectivePermissions({
    role: 'Technician',
    backendPermissions: ['itsm.incidents.read', 'itsm.incidents.write', 'cmdb.read'],
    permissionSource: 'backend',
    portalClearance: 'L2_EMPLOYEE',
  });
  assert.equal(tech.isSuperAdmin, false);
  assert.equal(tech.hasPermission('itsm.incidents.write'), true);
  assert.equal(tech.hasPermission('iam.roles.manage'), false);
  assert.equal(hasAnyPermission(tech.hasPermission, ['iam.roles.manage', 'cmdb.read']), true);
  assert.equal(hasAllPermissions(tech.hasPermission, ['itsm.incidents.read', 'cmdb.read']), true);
  assert.equal(hasAllPermissions(tech.hasPermission, ['itsm.incidents.read', 'iam.roles.manage']), false);

  assert.equal(
    resolveEffectiveHasPermission('End User', ['itsm.incidents.read'], 'backend', 'itsm.incidents.read'),
    true
  );
  assert.equal(
    resolveEffectiveHasPermission('End User', ['itsm.incidents.read'], 'backend', 'iam.users.manage'),
    false
  );

  // Navigation policy check
  assert.equal(
    canAccessPage('Super Admin', 'audit', {
      hasPermission: superAdmin.hasPermission,
      portalClearance: 'L5_SUPER_ADMIN',
    }),
    true
  );
  assert.equal(
    canAccessPage('End User', 'audit', {
      hasPermission: () => false,
      portalClearance: 'L1_END_USER',
    }),
    false
  );
  const endUserNav = getVisibleSidebarItems('End User', {
    hasPermission: () => false,
    portalClearance: 'L1_END_USER',
  });
  assert.ok(endUserNav.length > 0);
  assert.ok(!endUserNav.some((item) => item.id === 'iam'));
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
        const loginPayload: AuthTokenResponseDto = {
          access_token: 'native-access-1',
          refresh_token: 'native-refresh-1',
          token_type: 'bearer',
          expires_in: 900,
          session_id: 'sess-native-1',
          user_id: 'usr-native-1',
          email: 'ops@njuregroup.in',
          full_name: 'Ops Lead',
          portal_clearance: 'L2_EMPLOYEE',
          organization_id: 'org-njure',
          permissions: ['itsm.incidents.read', 'ai.triage.use'],
        };
        return send(200, loginPayload);
      }

      if (method === 'GET' && url === '/api/v1/incidents') {
        if (failOnceWith401 && req.headers.authorization === 'Bearer native-access-1') {
          failOnceWith401 = false;
          return send(401, { detail: 'Access token expired' });
        }
        const dto: IncidentDto = {
          id: 'inc-100',
          number: 'INC0000100',
          short_description: 'VPN tunnel timeout',
          description: 'Branch office tunnel dropped',
          category: 'Network',
          priority: 'P2',
          impact: 'Medium',
          urgency: 'High',
          status: 'Open',
          caller_name: 'Ops Lead',
          caller_email: 'ops@njuregroup.in',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return send(200, [dto]);
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
          priority: 'P2',
          category: 'Network',
          assigned_group: 'Network Engineering',
          suggested_actions: ['Inspect IPsec phase 2 lifetime'],
          summary: 'High-priority VPN interruption.',
          confidence: 0.91,
          matched_kb_ids: [],
          audit_id: 'ai-audit-1',
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
      storage: secureStorage,
      baseUrlProvider: async () => `http://127.0.0.1:${port}`,
    });

    await client.auth.login({ email: 'ops@njuregroup.in', password: 'SecretPassword!123' });
    assert.equal(await client.http.getAccessToken(), 'native-access-1');
    assert.equal(await client.http.getActiveOrganizationId(), 'org-njure');
    assert.ok(secureStorage.writes >= 3);

    // Triggers 401 -> single-flight refresh -> retry with rotated token
    const incidents: Incident[] = (await client.itsm.listIncidents()).map(client.mappers.mapIncidentDto);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].number, 'INC0000100');
    assert.equal(await client.http.getAccessToken(), 'native-access-2');

    // FastAPI-only AI endpoint check
    const triage = await client.ai.triageIncident({
      short_description: 'VPN tunnel timeout',
      description: 'Branch office tunnel dropped',
    });
    assert.equal(triage.priority, 'P2');
    assert.ok(observed.some((r) => r.url === '/api/v1/ai/triage-incident' && r.org === 'org-njure'));

    // Structured ApiError propagation
    await assert.rejects(
      () => client.http.request('/incidents/missing'),
      (err: unknown) => err instanceof ApiError && err.status === 404 && err.message === 'Incident not found'
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
        `Shared package ${pkgJson.name} must not depend on ${forbidden}`
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
        `${pkgJson.name}/src/${file} must not import React`
      );
      assert.doesNotMatch(
        content,
        /\bdocument\.(getElementById|querySelector|createElement)\b/,
        `${pkgJson.name}/src/${file} must not rely on DOM APIs`
      );
      if (dir === 'api-client') {
        assert.doesNotMatch(
          content,
          /['"]\/api\/ai\//,
          `@scribble-it/api-client/${file} must use FastAPI /api/v1/ai/* exclusively, never Express /api/ai/*`
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
