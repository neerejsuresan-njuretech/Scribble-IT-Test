import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDesktopClientMetadata,
  validateDesktopDeepLink,
} from '../../src/desktop/runtime';
import {
  type DesktopVaultBridge,
  NativeVaultTokenStorage,
  type VaultSecretKey,
} from '../../src/desktop/windowsTokenStorage';
import {
  GITHUB_REPOSITORY_URL,
  isDirectGitHubReleaseAssetUrl,
  MACOS_DESKTOP_CONFIG,
  parseGitHubMacosRelease,
} from '../../src/config/openSourceConfig';

const REPO_ROOT = path.resolve(process.cwd());

function createMockAppleKeychainBridge(initial: Partial<Record<VaultSecretKey, string>> = {}): DesktopVaultBridge & {
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

test('buildDesktopClientMetadata accurately emits macOS client telemetry when running on macOS', () => {
  const meta = buildDesktopClientMetadata({
    client_type: 'desktop',
    client_platform: 'macos',
    app_version: '1.0.0',
    app_id: 'in.njuretech.scribbleit',
    device_name: 'MacBook-Pro-IT-01',
    os_version: 'macOS 15.1 (aarch64)',
    device_fingerprint: 'deadbeef01',
    mdm_claimed: false,
    credential_backend: 'Apple Keychain (Security.framework / keyring)',
  });

  assert.equal(meta.client_type, 'desktop');
  assert.equal(meta.client_platform, 'macos');
  assert.equal(meta.app_version, '1.0.0');
  assert.equal(meta.app_id, 'in.njuretech.scribbleit');
  assert.equal(meta.device_name, 'MacBook-Pro-IT-01');
  assert.equal(meta.os_version, 'macOS 15.1 (aarch64)');
});

test('NativeVaultTokenStorage persists rotated tokens and clears Apple Keychain entries on sign-out', async () => {
  const keychain = createMockAppleKeychainBridge({
    access_token: 'mac-acc-1',
    refresh_token: 'mac-ref-1',
    organization_id: 'org-mac-01',
  });
  const storage = new NativeVaultTokenStorage(keychain);

  assert.equal(await storage.getAccessToken(), 'mac-acc-1');
  assert.equal(await storage.getRefreshToken(), 'mac-ref-1');
  assert.equal(await storage.getOrganizationId(), 'org-mac-01');

  await storage.setTokens({
    accessToken: 'mac-acc-2',
    refreshToken: 'mac-ref-2',
    organizationId: 'org-mac-02',
  });
  assert.equal(keychain.store.get('access_token'), 'mac-acc-2');
  assert.equal(keychain.store.get('refresh_token'), 'mac-ref-2');

  await storage.clearTokens();
  assert.equal(keychain.clearCalls, 1);
  assert.equal(keychain.store.size, 0);
});

test('Deep links from scribbleit:// validate cleanly on macOS Apple Events without auth bypass', () => {
  assert.deepEqual(validateDesktopDeepLink('scribbleit://incidents/INC-402'), {
    ok: true,
    route: '/incidents',
  });
  assert.equal(validateDesktopDeepLink('scribbleit://watchtower?sso_token=forged').ok, false);
});

test('MACOS_DESKTOP_CONFIG truthfully avoids fabricated .dmg binaries when release env vars are unset', () => {
  assert.equal(MACOS_DESKTOP_CONFIG.availabilityStatus, 'In Development');
  assert.equal(MACOS_DESKTOP_CONFIG.arm64InstallerUrl, '');
  assert.equal(MACOS_DESKTOP_CONFIG.arm64Sha256, '');
  assert.equal(MACOS_DESKTOP_CONFIG.x64InstallerUrl, '');
  assert.equal(MACOS_DESKTOP_CONFIG.x64Sha256, '');
  assert.match(MACOS_DESKTOP_CONFIG.codeSigningStatus, /Unsigned/i);
});

test('parseGitHubMacosRelease resolves Apple Silicon and Intel .dmg assets and rejects drafts or non-release URLs', () => {
  const armSha = 'b'.repeat(64);
  const x64Sha = 'c'.repeat(64);
  const armUrl = `${GITHUB_REPOSITORY_URL}/releases/download/macos-v1.0.0/SCRIBBLE-IT_1.0.0_arm64.dmg`;
  const x64Url = `${GITHUB_REPOSITORY_URL}/releases/download/macos-v1.0.0/SCRIBBLE-IT_1.0.0_x64.dmg`;
  const sumsUrl = `${GITHUB_REPOSITORY_URL}/releases/download/macos-v1.0.0/SHA256SUMS-macos.txt`;

  assert.equal(isDirectGitHubReleaseAssetUrl(armUrl, GITHUB_REPOSITORY_URL, '.dmg'), true);
  assert.equal(
    isDirectGitHubReleaseAssetUrl(`${GITHUB_REPOSITORY_URL}/archive/refs/tags/macos-v1.0.0.zip`, GITHUB_REPOSITORY_URL, '.dmg'),
    false
  );

  // Draft release ignored
  assert.equal(
    parseGitHubMacosRelease([
      {
        tag_name: 'macos-v1.0.0',
        draft: true,
        assets: [
          { name: 'SCRIBBLE-IT_1.0.0_arm64.dmg', size: 12_500_000, browser_download_url: armUrl, digest: `sha256:${armSha}` },
        ],
      },
    ]),
    null
  );

  // Single-arch Apple Silicon release only exposes Apple Silicon
  const armOnly = parseGitHubMacosRelease([
    {
      tag_name: 'macos-v1.0.0',
      html_url: `${GITHUB_REPOSITORY_URL}/releases/tag/macos-v1.0.0`,
      draft: false,
      assets: [
        { name: 'SCRIBBLE-IT_1.0.0_arm64.dmg', size: 12_500_000, browser_download_url: armUrl, digest: `sha256:${armSha}` },
      ],
    },
  ]);
  assert.ok(armOnly);
  assert.equal(armOnly.availabilityStatus, 'Available');
  assert.equal(armOnly.arm64InstallerUrl, armUrl);
  assert.equal(armOnly.arm64Sha256, armSha);
  assert.equal(armOnly.x64InstallerUrl, '');
  assert.equal(armOnly.supportedArchitectures, 'Apple Silicon (arm64)');

  // Dual-arch release resolves both Apple Silicon and Intel .dmg assets
  const dual = parseGitHubMacosRelease([
    {
      tag_name: 'macos-v1.0.0',
      html_url: `${GITHUB_REPOSITORY_URL}/releases/tag/macos-v1.0.0`,
      draft: false,
      assets: [
        { name: 'SCRIBBLE-IT_1.0.0_arm64.dmg', size: 12_500_000, browser_download_url: armUrl, digest: `sha256:${armSha}` },
        { name: 'SCRIBBLE-IT_1.0.0_x64.dmg', size: 13_100_000, browser_download_url: x64Url, digest: `sha256:${x64Sha}` },
        { name: 'SHA256SUMS-macos.txt', size: 180, browser_download_url: sumsUrl },
      ],
    },
  ]);
  assert.ok(dual);
  assert.equal(dual.availabilityStatus, 'Available');
  assert.equal(dual.version, '1.0.0');
  assert.equal(dual.arm64InstallerUrl, armUrl);
  assert.equal(dual.arm64Sha256, armSha);
  assert.equal(dual.x64InstallerUrl, x64Url);
  assert.equal(dual.x64Sha256, x64Sha);
  assert.equal(dual.sha256SumsUrl, sumsUrl);
  assert.equal(dual.supportedArchitectures, 'Apple Silicon (arm64) & Intel (x86_64)');
});

test('Tauri macOS configuration, Hardened Runtime entitlements, Cargo Keychain dependency, and CI pipeline are valid', () => {
  const tauriConf = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  const cargoToml = fs.readFileSync(path.join(REPO_ROOT, 'src-tauri', 'Cargo.toml'), 'utf8');
  const entitlements = fs.readFileSync(
    path.join(REPO_ROOT, 'src-tauri', 'Entitlements.plist'),
    'utf8'
  );
  const macCiYaml = fs.readFileSync(
    path.join(REPO_ROOT, '.github', 'workflows', 'macos-desktop-ci.yml'),
    'utf8'
  );
  const buildSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'build-macos-release.sh'),
    'utf8'
  );

  // Bundle ID & hardened runtime settings
  assert.equal(tauriConf.identifier, 'in.njuretech.scribbleit');
  assert.equal(tauriConf.bundle.macOS.minimumSystemVersion, '12.0');
  assert.equal(tauriConf.bundle.macOS.hardenedRuntime, true);
  assert.equal(tauriConf.bundle.macOS.entitlements, './Entitlements.plist');

  // Verify macOS icon & DMG background exist on disk
  assert.ok(
    tauriConf.bundle.icon.includes('../assets/brand/icons/macos/icon.icns'),
    'bundle.icon must include macos/icon.icns'
  );
  const dmgBgAbs = path.resolve(
    path.join(REPO_ROOT, 'src-tauri'),
    tauriConf.bundle.macOS.dmg.background
  );
  assert.equal(fs.existsSync(dmgBgAbs), true, 'Missing macOS DMG background PNG');
  assert.equal(tauriConf.bundle.macOS.dmg.windowSize.width, 540);
  assert.equal(tauriConf.bundle.macOS.dmg.windowSize.height, 380);

  // Entitlements security check: outbound network client allowed, no unsafe JIT / unsigned-memory exemptions
  assert.match(entitlements, /com\.apple\.security\.network\.client/);
  assert.doesNotMatch(entitlements, /allow-unsigned-executable-memory/);
  assert.doesNotMatch(entitlements, /disable-library-validation/);

  // Cargo Keychain target dependency alongside preserved Windows target
  assert.match(cargoToml, /target\.'cfg\(target_os = "macos"\)'\.dependencies/);
  assert.match(cargoToml, /features\s*=\s*\["apple-native"\]/);
  assert.match(cargoToml, /features\s*=\s*\["windows-native"\]/);

  // macOS CI & release build script enforce dual-arch targets, Security.framework linkage, and conflict-safe DMG verification
  assert.match(macCiYaml, /runs-on:\s*macos-latest/);
  assert.match(macCiYaml, /aarch64-apple-darwin/);
  assert.match(macCiYaml, /x86_64-apple-darwin/);
  assert.ok(macCiYaml.includes(String.raw`\[PASS\] DMG verified & mounted cleanly: .*_arm64\.dmg`));
  assert.ok(macCiYaml.includes(String.raw`\[PASS\] DMG verified & mounted cleanly: .*_x64\.dmg`));
  assert.match(macCiYaml, /if:\s*\$\{\{\s*success\(\)\s*&&/);
  assert.doesNotMatch(
    macCiYaml,
    /^\s*if:.*secrets\./m,
    'GitHub Actions prohibits referencing secrets inside step/job if: expressions'
  );
  assert.match(macCiYaml, /CI:\s*"true"/);
  assert.match(buildSh, /unset APPLE_SIGNING_IDENTITY/);
  assert.match(buildSh, /file -b "\$dmg"/);
  assert.match(buildSh, /hdiutil imageinfo "\$dmg"/);
  assert.match(buildSh, /hdiutil verify "\$dmg"/);
  assert.match(buildSh, /xattr -d com\.apple\.quarantine/);
  assert.match(buildSh, /mktemp -d "\$\{REAL_TMP_WORK\}\/mnt_\$\{label\}\.XXXXXX"/);
  assert.match(buildSh, /hdiutil attach "\$dmg"/);
  assert.match(buildSh, /-nobrowse/);
  assert.match(buildSh, /-noautoopen/);
  assert.match(buildSh, /ATTACH_STDOUT=/);
  assert.match(buildSh, /ATTACH_STDERR=/);
  assert.match(buildSh, /trap cleanup_verify EXIT/);
  assert.match(buildSh, /plutil -lint/);
  assert.match(buildSh, /Security\.framework/);
  assert.match(buildSh, /SHA256SUMS-macos\.txt/);
  assert.equal(tauriConf.bundle.license, 'AGPL-3.0-only');
  assert.equal(
    tauriConf.bundle.licenseFile,
    undefined,
    'bundle.licenseFile causes Tauri macOS bundler to embed an interactive DMG EULA/SLA that cancels non-interactive hdiutil attach'
  );

  // Website LandingWebsitePage gates both Hero and #macos-desktop DMG download CTAs strictly on Available state
  const landingTsx = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'pages', 'public', 'LandingWebsitePage.tsx'),
    'utf8'
  );
  assert.match(landingTsx, /Download for macOS \(\.dmg\)/);
  assert.match(landingTsx, /Download for Mac — Apple Silicon \(\.dmg\)/);
  assert.match(landingTsx, /Download for Mac — Intel x86_64 \(\.dmg\)/);
  assert.match(landingTsx, /macosRelease\.availabilityStatus === 'Available'/);
});

