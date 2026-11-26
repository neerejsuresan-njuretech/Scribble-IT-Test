import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import {
  authApi,
  clearAuthTokens,
  cmdbApi,
  getAccessToken,
  getActiveApiOrganizationId,
  itsmApi,
  mapAssetDto,
  mapIncidentDto,
  setApiBaseUrlForTesting,
} from '../../src/services/api';

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

test('FastAPI client handles login, /me, 401 refresh-token rotation, ITSM & CMDB CRUD, global search, and logout', async () => {
  const observedRequests: Array<{ method: string; url: string; auth?: string; org?: string }> = [];
  let expiredOnce = false;

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = req.url || '/';
    const auth = req.headers.authorization;
    const org = req.headers['x-organization-id'] as string | undefined;
    observedRequests.push({ method, url, auth, org });

    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (method === 'POST' && url === '/api/v1/auth/login') {
      const body = await readJsonBody(req);
      assert.equal(body.email, 'tech@acme.io');
      return send(200, {
        access_token: 'access-v1',
        refresh_token: 'refresh-v1',
        token_type: 'bearer',
        expires_in: 900,
        session_id: 'sess-01',
        user_id: 'usr-01',
        email: 'tech@acme.io',
        full_name: 'Jordan Rivera',
        organization_id: 'org-acme-01',
        organization_slug: 'acme',
        portal_type: 'employee',
        clearance_tier: 'it_operations',
        permissions: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'],
      });
    }

    if (method === 'GET' && url === '/api/v1/auth/me') {
      assert.equal(auth, 'Bearer access-v1');
      return send(200, {
        user_id: 'usr-01',
        email: 'tech@acme.io',
        full_name: 'Jordan Rivera',
        organization_id: 'org-acme-01',
        organization_slug: 'acme',
        portal_type: 'employee',
        is_super_admin: false,
        is_iam_portal: false,
        permissions: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'],
        roles: ['pol-employee-ops'],
        session_id: 'sess-01',
        clearance_tier: 'it_operations',
      });
    }

    if (method === 'POST' && url === '/api/v1/auth/refresh') {
      const body = await readJsonBody(req);
      assert.equal(body.refresh_token, 'refresh-v1');
      return send(200, {
        access_token: 'access-v2',
        refresh_token: 'refresh-v2',
        token_type: 'bearer',
        expires_in: 900,
      });
    }

    if (method === 'GET' && url.startsWith('/api/v1/incidents')) {
      // Simulate expired access-v1 on first attempt to verify automatic refresh rotation
      if (auth === 'Bearer access-v1' && !expiredOnce) {
        expiredOnce = true;
        return send(401, { error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' } });
      }
      assert.equal(auth, 'Bearer access-v2');
      assert.equal(org, 'org-acme-01');
      return send(200, {
        items: [
          {
            id: 'inc-uuid-1',
            organization_id: 'org-acme-01',
            ticket_number: 'INC-4001',
            title: 'Core VPN Gateway Degradation',
            description: 'Latency spikes across EU edge nodes',
            status: 'in_progress',
            priority: 'P1',
            urgency: 'high',
            impact: 'high',
            category: 'network',
            requester_name: 'Pat Lee',
            requester_email: 'pat@acme.io',
            assignee_name: 'Jordan Rivera',
            assignment_group: 'Network Ops',
            affected_ci: 'VPN-GW-EU-01',
            sla_deadline: '2026-11-26T00:00:00Z',
            sla_breached: false,
            time_logged_mins: 45,
            source_channel: 'portal',
            created_at: '2026-11-25T10:00:00Z',
            updated_at: '2026-11-25T10:15:00Z',
            activities: [
              {
                id: 'act-1',
                author_name: 'Jordan Rivera',
                activity_type: 'work_note',
                action: 'Triage Started',
                note: 'Checking BGP peer flaps',
                created_at: '2026-11-25T10:15:00Z',
              },
            ],
          },
        ],
        meta: {
          page: 1,
          page_size: 25,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      });
    }

    if (method === 'POST' && url === '/api/v1/assets') {
      assert.equal(auth, 'Bearer access-v2');
      const body = await readJsonBody(req);
      return send(201, {
        id: 'ast-uuid-9',
        organization_id: 'org-acme-01',
        asset_tag: body.asset_tag,
        name: body.name,
        asset_type: body.asset_type,
        serial_number: body.serial_number,
        model: body.model,
        manufacturer: body.manufacturer,
        status: 'in_stock',
        location: body.location,
        purchase_cost: 2499,
        current_book_value: 2499,
        created_at: '2026-11-25T10:20:00Z',
        updated_at: '2026-11-25T10:20:00Z',
      });
    }

    if (method === 'GET' && url.startsWith('/api/v1/search')) {
      assert.equal(auth, 'Bearer access-v2');
      return send(200, {
        query: 'VPN',
        organization_id: 'org-acme-01',
        total: 1,
        hits: [
          {
            id: 'inc-uuid-1',
            ref: 'INC-4001',
            group: 'Incidents',
            title: 'Core VPN Gateway Degradation',
            subtitle: 'P1 · in_progress',
            status: 'in_progress',
            path: '/incidents',
          },
        ],
      });
    }

    if (method === 'POST' && url === '/api/v1/auth/logout') {
      return send(200, { message: 'Logged out' });
    }

    return send(404, { error: { code: 'NOT_FOUND', message: `Unhandled ${method} ${url}` } });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    setApiBaseUrlForTesting(`http://127.0.0.1:${port}`);
    clearAuthTokens();

    // 1. Login & /me
    const loginRes = await authApi.login({
      email: 'tech@acme.io',
      password: 'Password!1234',
      portal_type: 'employee',
    });
    assert.equal(loginRes.access_token, 'access-v1');
    assert.equal(getAccessToken(), 'access-v1');
    assert.equal(getActiveApiOrganizationId(), 'org-acme-01');

    const me = await authApi.me();
    assert.deepEqual(me.permissions, ['incidents:read', 'incidents:write', 'assets:read', 'assets:write']);
    assert.equal(me.clearance_tier, 'it_operations');

    // 2. List incidents -> hits 401 -> rotates refresh token -> retries with access-v2
    const incPage = await itsmApi.listIncidents({ page: 1, page_size: 25, status: 'in_progress' });
    assert.equal(getAccessToken(), 'access-v2');
    assert.equal(incPage.items.length, 1);
    const uiIncident = mapIncidentDto(incPage.items[0]);
    assert.equal(uiIncident.id, 'inc-uuid-1');
    assert.equal(uiIncident.priority, 'P1');
    assert.equal(uiIncident.activityLog.length, 1);
    assert.equal(uiIncident.activityLog[0].note, 'Checking BGP peer flaps');

    // 3. Create asset & verify DTO mapping
    const createdAsset = await cmdbApi.createAsset({
      asset_tag: 'ACME-LT-909',
      name: 'MacBook Pro 16',
      asset_type: 'laptop',
      serial_number: 'SN-MBP-909',
      model: 'M4 Pro',
      manufacturer: 'Apple',
      location: 'HQ Vault',
    });
    const uiAsset = mapAssetDto(createdAsset);
    assert.equal(uiAsset.assetTag, 'ACME-LT-909');
    assert.equal(uiAsset.purchaseCost, 2499);

    // 4. RBAC-filtered Global Search
    const searchRes = await itsmApi.globalSearch('VPN', 5);
    assert.equal(searchRes.total, 1);
    assert.equal(searchRes.hits.length, 1);
    assert.equal(searchRes.hits[0].ref, 'INC-4001');

    // 5. Logout clears in-memory tokens
    await authApi.logout();
    assert.equal(getAccessToken(), null);
    assert.equal(getActiveApiOrganizationId(), null);

    // Confirm refresh endpoint was invoked once
    const refreshCalls = observedRequests.filter((r) => r.url === '/api/v1/auth/refresh');
    assert.equal(refreshCalls.length, 1);
  } finally {
    setApiBaseUrlForTesting(null);
    clearAuthTokens();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('AI service routes to authenticated FastAPI /api/v1/ai/* and integrationsApi manages connections & webhooks', async () => {
  const { integrationsApi, setAuthTokens } = await import('../../src/services/api');
  const { aiService } = await import('../../src/services/aiService');

  const seenPaths: string[] = [];
  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = req.url || '/';
    seenPaths.push(`${method} ${url}`);

    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    assert.equal(req.headers.authorization, 'Bearer jwt-live-token');
    assert.equal(req.headers['x-organization-id'], 'org-acme-01');

    if (method === 'POST' && url === '/api/v1/ai/triage-incident') {
      return send(200, {
        recommendedPriority: 'P1',
        recommendedCategory: 'Network',
        suggestedQueue: 'Network & Firewall Ops',
        rootCauseHypothesis: 'BGP flap on edge router',
        diagnosticSteps: ['Check BGP neighbor state'],
        draftResolutionNote: 'Restored peer',
        draftCustomerReply: 'Investigating connectivity',
        generatedAt: '2026-11-25T12:00:00Z',
        requiresHumanApproval: true,
      });
    }

    if (method === 'GET' && url === '/api/v1/ai/usage') {
      return send(200, {
        organization_id: 'org-acme-01',
        daily_limit: 500,
        used_today: 12,
        remaining_today: 488,
        rate_limit_per_minute: 20,
        model: 'gemini-4-hydrogen',
        recent_logs: [],
      });
    }

    if (method === 'POST' && url === '/api/v1/integrations/webhooks') {
      const body = await readJsonBody(req);
      return send(201, {
        id: 'wh-01',
        organization_id: 'org-acme-01',
        name: body.name,
        target_url: body.target_url,
        subscribed_events: body.subscribed_events,
        is_active: true,
        max_retries: 3,
        last_delivery_status: null,
        last_delivered_at: null,
        created_at: '2026-11-25T12:00:00Z',
      });
    }

    return send(404, { error: { code: 'NOT_FOUND', message: `Unhandled ${method} ${url}` } });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    setApiBaseUrlForTesting(`http://127.0.0.1:${port}`);
    setAuthTokens({
      accessToken: 'jwt-live-token',
      refreshToken: 'ref-live-token',
      organizationId: 'org-acme-01',
    });

    const triage = await aiService.triageIncident({
      title: 'Edge router flapping',
      description: 'Packet loss > 40%',
    });
    assert.equal(triage.recommendedPriority, 'P1');
    assert.equal(triage.requiresHumanApproval, true);

    const usage = await integrationsApi.getAiUsage();
    assert.equal(usage.model, 'gemini-4-hydrogen');
    assert.equal(usage.remaining_today, 488);

    const wh = await integrationsApi.createWebhook({
      name: 'PagerDuty Bridge',
      target_url: 'https://events.pagerduty.com/v2/enqueue',
      signing_secret: 'super-secret-signing-key-1234',
      subscribed_events: ['incident.created'],
    });
    assert.equal(wh.id, 'wh-01');
    assert.deepEqual(seenPaths, [
      'POST /api/v1/ai/triage-incident',
      'GET /api/v1/ai/usage',
      'POST /api/v1/integrations/webhooks',
    ]);
  } finally {
    setApiBaseUrlForTesting(null);
    clearAuthTokens();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Task 5.3/5.4 native client metadata headers, authenticated device enrollment, sessions, client config, attachments, and session-expired callback work end-to-end', async () => {
  const {
    createScribbleApiClient,
    MemoryTokenStorageAdapter,
  } = await import('@scribble-it/api-client');

  const seenRequests: Array<{
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body?: Record<string, unknown>;
  }> = [];

  let expiryTriggered: string | null = null;
  let forceUnauthorizedEverything = false;

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = req.url || '/';
    const body = method !== 'GET' && method !== 'DELETE' ? await readJsonBody(req) : undefined;
    seenRequests.push({ method, url, headers: req.headers, body });

    const send = (status: number, payload?: unknown) => {
      if (status === 204) {
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (method === 'GET' && url === '/api/v1/client/config') {
      return send(200, {
        instance_name: 'Scribble-IT Enterprise',
        deployment_mode: 'self_hosted',
        api_version: '1.0.0',
        api_prefix: '/api/v1',
        public_api_url: null,
        minimum_client_versions: { desktop: '1.0.0', mobile: '1.0.0' },
        auth: {
          access_token_ttl_minutes: 15,
          refresh_token_ttl_days: 14,
          refresh_token_rotation: true,
          reuse_detection_enabled: true,
          mfa_supported: true,
          device_trust_supported: true,
        },
        push: { android_fcm_enabled: false, ios_apns_enabled: false },
      });
    }

    if (forceUnauthorizedEverything) {
      return send(401, { error: { code: 'SESSION_REVOKED', message: 'Refresh token revoked' } });
    }

    if (method === 'POST' && url === '/api/v1/auth/login') {
      assert.equal(req.headers['x-scribble-client-type'], 'desktop');
      assert.equal(req.headers['x-scribble-client-platform'], 'windows');
      assert.equal(req.headers['x-scribble-app-version'], '1.0.0');
      assert.equal(req.headers['x-scribble-app-id'], 'in.njuretech.scribbleit');
      assert.equal((body?.client_metadata as Record<string, unknown>)?.client_platform, 'windows');
      assert.equal('organization_slug' in (body || {}), false);

      return send(200, {
        access_token: 'win-access-1',
        refresh_token: 'win-refresh-1',
        token_type: 'bearer',
        expires_in: 900,
        session_id: 'sess-win-1',
        user_id: 'usr-win-1',
        email: 'win@acme.io',
        full_name: 'Windows Operator',
        organization_id: 'org-win-01',
        organization_slug: 'acme',
        portal_type: 'employee',
        clearance_tier: 'it_operations',
        permissions: ['incidents:read', 'incidents:write'],
      });
    }

    if (method === 'POST' && url === '/api/v1/auth/device/enroll') {
      // Must carry Bearer authorization header (skipAuth must NOT be set)
      assert.equal(req.headers.authorization, 'Bearer win-access-1');
      assert.equal(req.headers['x-organization-id'], 'org-win-01');
      return send(201, {
        device_id: 'dev-win-1',
        hostname: body?.hostname,
        os_platform: 'Windows 11',
        client_type: 'desktop',
        device_platform: 'windows',
        app_version: '1.0.0',
        trust_level: 'registered',
        mdm_verified: false,
        certificate_thumbprint: 'sha256:win-cert-01',
        status: 'active',
      });
    }

    if (method === 'GET' && url === '/api/v1/auth/sessions') {
      assert.equal(req.headers.authorization, 'Bearer win-access-1');
      return send(200, {
        items: [
          {
            id: 'sess-win-1',
            portal_type: 'employee',
            client_type: 'desktop',
            client_platform: 'windows',
            app_version: '1.0.0',
            app_id: 'in.njuretech.scribbleit',
            device_name: 'WIN11-LAPTOP-01',
            ip_address: '127.0.0.1',
            created_at: '2026-11-26T00:00:00Z',
            last_used_at: '2026-11-26T00:00:00Z',
            expires_at: '2026-12-10T00:00:00Z',
            revoked_at: null,
            is_current: true,
          },
        ],
      });
    }

    if (method === 'DELETE' && url === '/api/v1/auth/sessions/sess-other-2') {
      assert.equal(req.headers.authorization, 'Bearer win-access-1');
      return send(204);
    }

    if (method === 'POST' && url === '/api/v1/incidents/inc-uuid-1/attachments') {
      assert.equal(req.headers.authorization, 'Bearer win-access-1');
      return send(201, {
        id: 'att-1',
        filename: body?.filename,
        content_type: body?.content_type,
        size_bytes: body?.size_bytes,
        storage_key: body?.storage_key,
        checksum_sha256: body?.checksum_sha256,
        uploaded_by: 'Windows Operator',
        created_at: '2026-11-26T00:05:00Z',
      });
    }

    return send(404, { error: { code: 'NOT_FOUND', message: `Unhandled ${method} ${url}` } });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const storage = new MemoryTokenStorageAdapter();
    const client = createScribbleApiClient({
      tokenStorage: storage,
      baseUrlProvider: `http://127.0.0.1:${port}`,
      clientMetadata: {
        client_type: 'desktop',
        client_platform: 'windows',
        app_version: '1.0.0',
        app_id: 'in.njuretech.scribbleit',
        device_name: 'WIN11-LAPTOP-01',
      },
      onSessionExpired: (reason) => {
        expiryTriggered = reason;
      },
    });

    const cfg = await client.auth.getClientConfig();
    assert.equal(cfg.deployment_mode, 'self_hosted');
    assert.equal(cfg.auth.refresh_token_rotation, true);

    await client.auth.login({
      email: 'win@acme.io',
      password: 'Password!1234',
      portal_type: 'employee',
      organization_slug: 'acme', // should be stripped cleanly for Pydantic extra="forbid"
    });

    const enrolled = await client.auth.enrollDevice({
      enrollment_code: 'ENROLL-WIN-01',
      hostname: 'WIN11-LAPTOP-01',
      os_platform: 'Windows 11',
      device_fingerprint: 'fp-1234',
      client_type: 'desktop',
      device_platform: 'windows',
      app_version: '1.0.0',
      app_id: 'in.njuretech.scribbleit',
    });
    assert.equal(enrolled.device_id, 'dev-win-1');
    assert.equal(enrolled.mdm_verified, false);
    assert.equal(enrolled.trust_level, 'registered');

    const sessions = await client.auth.listSessions();
    assert.equal(sessions.items.length, 1);
    assert.equal(sessions.items[0].client_platform, 'windows');

    await client.auth.revokeSession('sess-other-2');

    const att = await client.itsm.addIncidentAttachment('inc-uuid-1', {
      filename: 'screenshot.png',
      content_type: 'image/png',
      size_bytes: 2048,
      storage_key: 'windows-local://uuid/screenshot.png',
      checksum_sha256: 'a'.repeat(64),
    });
    assert.equal(att.id, 'att-1');
    assert.equal(att.filename, 'screenshot.png');

    // Failed refresh clears stored tokens and notifies session-expired handler
    forceUnauthorizedEverything = true;
    await assert.rejects(() => client.auth.me());
    assert.equal(expiryTriggered, 'refresh_failed');
    assert.equal(await storage.getAccessToken(), null);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

