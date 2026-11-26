import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDesktopClientMetadata,
  validateDesktopApiBaseUrl,
  validateDesktopDeepLink,
  validateExternalHttpsUrl,
} from '../../src/desktop/runtime';
import {
  type VaultSecretKey,
  WindowsCredentialTokenStorage,
  type WindowsVaultBridge,
} from '../../src/desktop/windowsTokenStorage';
import { WINDOWS_DESKTOP_CONFIG } from '../../src/config/openSourceConfig';

const REPO_ROOT = path.resolve(process.cwd());

function createMockWindowsVaultBridge(initial: Partial<Record<VaultSecretKey, string>> = {}): WindowsVaultBridge & {
  store: Map<VaultSecretKey, string>;
  clearCalls: number;
} {
  const store = new Map<VaultSecretKey, string>();
  for (const [k, v] of Object.entries(initial)) {
    if (v !== undefined) store.set(k as VaultSecretKey, v);
  }
  return {
    store,
    clearCalls: 0,
    async getSecret(key) {
      return store.get(key) ?? null;
    },
    async setSecret(key, value) {
      store.set(key, value);
    },
    async deleteSecret(key) {
      store.delete(key);
    },
    async clearSessionTokens() {
      this.clearCalls += 1;
      store.delete('access_token');
      store.delete('refresh_token');
      store.delete('organization_id');
    },
  };
}

test('Desktop URL validation enforces HTTPS, allows loopback HTTP dev only, and rejects unsafe URLs', () => {
  assert.deepEqual(validateDesktopApiBaseUrl(''), { ok: true, normalized: '' });
  assert.deepEqual(validateDesktopApiBaseUrl('https://api.scribbleit.example.com/'), {
    ok: true,
    normalized: 'https://api.scribbleit.example.com',
  });
  assert.deepEqual(validateDesktopApiBaseUrl('http://localhost:8000/'), {
    ok: true,
    normalized: 'http://localhost:8000',
  });
  assert.deepEqual(validateDesktopApiBaseUrl('http://127.0.0.1:8000'), {
    ok: true,
    normalized: 'http://127.0.0.1:8000',
  });

  // Plain remote HTTP is rejected
  assert.equal(validateDesktopApiBaseUrl('http://api.example.com:8000').ok, false);
  // Embedded credentials, query strings, fragments, and non-HTTP schemes are rejected
  assert.equal(validateDesktopApiBaseUrl('https://user:pass@api.example.com').ok, false);
  assert.equal(validateDesktopApiBaseUrl('https://api.example.com?token=123').ok, false);
  assert.equal(validateDesktopApiBaseUrl('https://api.example.com#frag').ok, false);
  assert.equal(validateDesktopApiBaseUrl('javascript:alert(1)').ok, false);
  assert.equal(validateDesktopApiBaseUrl('file:///C:/Windows/System32').ok, false);
});

test('Deep link validator allows curated internal routes and rejects auth-bypass or arbitrary URLs', () => {
  assert.deepEqual(validateDesktopDeepLink('scribbleit://watchtower'), {
    ok: true,
    route: '/watchtower',
  });
  assert.deepEqual(validateDesktopDeepLink('scribbleit://incidents'), {
    ok: true,
    route: '/incidents',
  });
  assert.deepEqual(validateDesktopDeepLink('scribbleit://incidents/new'), {
    ok: true,
    route: '/incidents/new',
  });
  assert.deepEqual(validateDesktopDeepLink('scribbleit://requests/REQ-1001'), {
    ok: true,
    route: '/requests',
  });

  // Security: auth/session/role bypass query parameters are strictly rejected
  assert.equal(validateDesktopDeepLink('scribbleit://incidents?token=forged').ok, false);
  assert.equal(validateDesktopDeepLink('scribbleit://watchtower?access_token=abc').ok, false);
  assert.equal(validateDesktopDeepLink('scribbleit://watchtower?role=admin').ok, false);
  assert.equal(validateDesktopDeepLink('scribbleit://iam?portal_type=super_admin').ok, false);
  assert.equal(validateDesktopDeepLink('scribbleit://user@watchtower').ok, false);
  assert.equal(validateDesktopDeepLink('https://evil.example.com/watchtower').ok, false);
  assert.equal(validateDesktopDeepLink('scribbleit://unknown-route').ok, false);
});

test('External URL validator permits HTTPS and blocks file/javascript/remote-http URIs', () => {
  assert.equal(validateExternalHttpsUrl('https://scribbleit.njuregroup.in').ok, true);
  assert.equal(validateExternalHttpsUrl('http://localhost:3000').ok, true);
  assert.equal(validateExternalHttpsUrl('http://untrusted.example.com').ok, false);
  assert.equal(validateExternalHttpsUrl('file:///C:/Windows/notepad.exe').ok, false);
  assert.equal(validateExternalHttpsUrl('javascript:alert(1)').ok, false);
});

test('WindowsCredentialTokenStorage hydrates from vault, persists rotated tokens, and clears tokens on logout', async () => {
  const vault = createMockWindowsVaultBridge({
    access_token: 'win-acc-initial',
    refresh_token: 'win-ref-initial',
    organization_id: 'org-win-01',
  });
  const storage = new WindowsCredentialTokenStorage(vault);
  assert.equal(storage.isHydrated(), false);

  await storage.hydrate();
  assert.equal(storage.isHydrated(), true);
  assert.equal(await storage.getAccessToken(), 'win-acc-initial');
  assert.equal(await storage.getRefreshToken(), 'win-ref-initial');
  assert.equal(await storage.getOrganizationId(), 'org-win-01');

  // Token rotation updates vault entries
  await storage.setTokens({
    accessToken: 'win-acc-rotated',
    refreshToken: 'win-ref-rotated',
    organizationId: 'org-win-02',
  });
  assert.equal(vault.store.get('access_token'), 'win-acc-rotated');
  assert.equal(vault.store.get('refresh_token'), 'win-ref-rotated');
  assert.equal(vault.store.get('organization_id'), 'org-win-02');

  // Logout wipes all Windows Credential Manager entries
  await storage.clearTokens();
  assert.equal(vault.clearCalls, 1);
  assert.equal(vault.store.size, 0);
  assert.equal(await storage.getAccessToken(), null);
  assert.equal(await storage.getRefreshToken(), null);
  assert.equal(await storage.getOrganizationId(), null);
});

test('buildDesktopClientMetadata produces valid Windows desktop metadata for FastAPI telemetry', () => {
  const meta = buildDesktopClientMetadata({
    client_type: 'desktop',
    client_platform: 'windows',
    app_version: '1.0.0',
    app_id: 'in.njuretech.scribbleit',
    device_name: 'CORP-WIN11-04',
    os_version: 'windows-x86_64',
    device_fingerprint: 'abc123',
    mdm_claimed: false,
    credential_backend: 'Windows Credential Manager',
  });

  assert.equal(meta.client_type, 'desktop');
  assert.equal(meta.client_platform, 'windows');
  assert.equal(meta.app_version, '1.0.0');
  assert.equal(meta.app_id, 'in.njuretech.scribbleit');
  assert.equal(meta.device_name, 'CORP-WIN11-04');
});

test('WINDOWS_DESKTOP_CONFIG truthfully avoids fabricated installer binaries when env vars are empty', () => {
  assert.equal(WINDOWS_DESKTOP_CONFIG.availabilityStatus, 'In Development');
  assert.equal(WINDOWS_DESKTOP_CONFIG.installerUrl, '');
  assert.equal(WINDOWS_DESKTOP_CONFIG.msiInstallerUrl, '');
  assert.equal(WINDOWS_DESKTOP_CONFIG.installerSha256, '');
  assert.match(WINDOWS_DESKTOP_CONFIG.codeSigningStatus, /Unsigned/i);
});

test('Tauri Windows configuration and least-privilege capabilities enforce security & verified Task 5.2 icon paths', () => {
  const tauriConfPath = path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json');
  const capPath = path.join(REPO_ROOT, 'src-tauri', 'capabilities', 'default.json');
  const cargoPath = path.join(REPO_ROOT, 'src-tauri', 'Cargo.toml');

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const capabilities = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const cargoToml = fs.readFileSync(cargoPath, 'utf8');

  assert.equal(tauriConf.productName, 'SCRIBBLE-IT');
  assert.equal(tauriConf.identifier, 'in.njuretech.scribbleit');
  assert.equal(tauriConf.app.withGlobalTauri, false);
  assert.equal(tauriConf.bundle.windows.certificateThumbprint, null);
  assert.equal(tauriConf.bundle.windows.timestampUrl, null);
  assert.deepEqual(tauriConf.bundle.targets, ['nsis', 'msi']);
  assert.deepEqual(tauriConf.plugins['deep-link'].desktop.schemes, ['scribbleit']);

  // Verify Windows CI workflow & PowerShell release builder enforce non-empty .exe validation
  const ciWorkflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'windows-desktop-ci.yml');
  const buildPsPath = path.join(REPO_ROOT, 'scripts', 'build-windows-release.ps1');
  assert.equal(fs.existsSync(ciWorkflowPath), true);
  assert.equal(fs.existsSync(buildPsPath), true);
  const ciYaml = fs.readFileSync(ciWorkflowPath, 'utf8');
  assert.match(ciYaml, /runs-on:\s*windows-latest/);
  assert.match(ciYaml, /build-windows-release\.ps1/);

  // Verify zero version numbers in visual branding productName / window titles
  assert.doesNotMatch(tauriConf.productName, /\b(2\.0|V2|v2)\b/);
  assert.doesNotMatch(tauriConf.app.windows[0].title, /\b(2\.0|V2|v2)\b/);

  // Verify every referenced Windows icon & installer BMP exists on disk
  const assetRefs: string[] = [
    ...tauriConf.bundle.icon,
    tauriConf.bundle.windows.nsis.installerIcon,
    tauriConf.bundle.windows.nsis.headerImage,
    tauriConf.bundle.windows.nsis.sidebarImage,
    tauriConf.bundle.windows.wix.bannerPath,
    tauriConf.bundle.windows.wix.dialogImagePath,
  ];
  for (const rel of assetRefs) {
    const abs = path.resolve(path.join(REPO_ROOT, 'src-tauri'), rel);
    assert.equal(fs.existsSync(abs), true, `Missing referenced Tauri Windows asset: ${rel}`);
  }

  // Verify least-privilege capability permissions (no unrestricted fs or shell access)
  assert.deepEqual(capabilities.windows, ['main']);
  const perms: string[] = capabilities.permissions;
  for (const p of perms) {
    assert.equal(p.startsWith('shell:'), false, `Unexpected shell permission: ${p}`);
    assert.equal(p.startsWith('fs:'), false, `Unexpected filesystem permission: ${p}`);
    assert.notEqual(p, 'opener:allow-open-url', 'Direct frontend opener:allow-open-url should stay gated via Rust');
  }

  // Verify Cargo uses Windows-native keyring & zeroize
  assert.match(cargoToml, /features\s*=\s*\["windows-native"\]/);
  assert.match(cargoToml, /zeroize\s*=/);
});
