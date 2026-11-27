import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDesktopClientMetadata,
  detectFallbackDesktopPlatform,
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
  LINUX_DESKTOP_CONFIG,
  parseGitHubLinuxRelease,
} from '../../src/config/openSourceConfig';

const REPO_ROOT = path.resolve(process.cwd());

function createMockLinuxSecretServiceBridge(
  initial: Partial<Record<VaultSecretKey, string>> = {}
): DesktopVaultBridge & {
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

test('detectFallbackDesktopPlatform identifies Linux desktops while excluding Android user agents', () => {
  assert.equal(detectFallbackDesktopPlatform('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)'), 'linux');
  assert.equal(
    detectFallbackDesktopPlatform('Linux aarch64', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)'),
    'windows'
  );
  assert.equal(detectFallbackDesktopPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)'), 'macos');
});

test('buildDesktopClientMetadata accurately emits Linux client telemetry and x86_64 metadata', () => {
  const meta = buildDesktopClientMetadata({
    client_type: 'desktop',
    client_platform: 'linux',
    app_version: '1.0.0',
    app_id: 'in.njuretech.scribbleit',
    device_name: 'FEDORA-WS-01',
    os_version: 'Ubuntu 22.04.5 LTS (x86_64)',
    device_fingerprint: 'deadbeef02',
    mdm_claimed: false,
    credential_backend: 'Linux Secret Service (GNOME Keyring / KWallet via keyring)',
  });

  assert.equal(meta.client_type, 'desktop');
  assert.equal(meta.client_platform, 'linux');
  assert.equal(meta.app_version, '1.0.0');
  assert.equal(meta.app_id, 'in.njuretech.scribbleit');
  assert.equal(meta.device_name, 'FEDORA-WS-01');
  assert.equal(meta.os_version, 'Ubuntu 22.04.5 LTS (x86_64)');
});

test('NativeVaultTokenStorage persists rotated tokens and clears Secret Service keyring entries on sign-out', async () => {
  const secretService = createMockLinuxSecretServiceBridge({
    access_token: 'lin-acc-1',
    refresh_token: 'lin-ref-1',
    organization_id: 'org-lin-01',
  });
  const storage = new NativeVaultTokenStorage(secretService);

  assert.equal(await storage.getAccessToken(), 'lin-acc-1');
  assert.equal(await storage.getRefreshToken(), 'lin-ref-1');
  assert.equal(await storage.getOrganizationId(), 'org-lin-01');

  await storage.setTokens({
    accessToken: 'lin-acc-2',
    refreshToken: 'lin-ref-2',
    organizationId: 'org-lin-02',
  });
  assert.equal(secretService.store.get('access_token'), 'lin-acc-2');
  assert.equal(secretService.store.get('refresh_token'), 'lin-ref-2');

  await storage.clearTokens();
  assert.equal(secretService.clearCalls, 1);
  assert.equal(secretService.store.size, 0);
});

test('Deep links from scribbleit:// validate cleanly on Linux XDG handlers without auth bypass', () => {
  assert.deepEqual(validateDesktopDeepLink('scribbleit://incidents/INC-901'), {
    ok: true,
    route: '/incidents',
  });
  assert.equal(validateDesktopDeepLink('scribbleit://iam?access_token=forged').ok, false);
});

test('LINUX_DESKTOP_CONFIG truthfully avoids fabricated .deb/.rpm/.AppImage binaries when release env vars are unset', () => {
  assert.equal(LINUX_DESKTOP_CONFIG.availabilityStatus, 'In Development');
  assert.equal(LINUX_DESKTOP_CONFIG.debInstallerUrl, '');
  assert.equal(LINUX_DESKTOP_CONFIG.debSha256, '');
  assert.equal(LINUX_DESKTOP_CONFIG.rpmInstallerUrl, '');
  assert.equal(LINUX_DESKTOP_CONFIG.rpmSha256, '');
  assert.equal(LINUX_DESKTOP_CONFIG.appImageInstallerUrl, '');
  assert.equal(LINUX_DESKTOP_CONFIG.appImageSha256, '');
});

test('parseGitHubLinuxRelease resolves direct .deb, .rpm, and .AppImage assets and rejects drafts or non-release URLs', () => {
  const debSha = '1'.repeat(64);
  const rpmSha = '2'.repeat(64);
  const appSha = '3'.repeat(64);

  const debUrl = `${GITHUB_REPOSITORY_URL}/releases/download/linux-v1.0.0/SCRIBBLE-IT_1.0.0_amd64.deb`;
  const rpmUrl = `${GITHUB_REPOSITORY_URL}/releases/download/linux-v1.0.0/SCRIBBLE-IT-1.0.0-1.x86_64.rpm`;
  const appUrl = `${GITHUB_REPOSITORY_URL}/releases/download/linux-v1.0.0/SCRIBBLE-IT_1.0.0_amd64.AppImage`;
  const sumsUrl = `${GITHUB_REPOSITORY_URL}/releases/download/linux-v1.0.0/SHA256SUMS-linux.txt`;

  assert.equal(isDirectGitHubReleaseAssetUrl(debUrl, GITHUB_REPOSITORY_URL, '.deb'), true);
  assert.equal(isDirectGitHubReleaseAssetUrl(rpmUrl, GITHUB_REPOSITORY_URL, '.rpm'), true);
  assert.equal(isDirectGitHubReleaseAssetUrl(appUrl, GITHUB_REPOSITORY_URL, '.appimage'), true);
  assert.equal(
    isDirectGitHubReleaseAssetUrl(`${GITHUB_REPOSITORY_URL}/archive/refs/tags/linux-v1.0.0.zip`, GITHUB_REPOSITORY_URL, '.deb'),
    false
  );

  // Draft release must be ignored
  assert.equal(
    parseGitHubLinuxRelease([
      {
        tag_name: 'linux-v1.0.0',
        draft: true,
        assets: [
          {
            name: 'SCRIBBLE-IT_1.0.0_amd64.deb',
            size: 14_200_000,
            browser_download_url: debUrl,
            digest: `sha256:${debSha}`,
          },
        ],
      },
    ]),
    null
  );

  // Published release resolves exact Tauri bundle filenames, sizes, and SHA-256 checksums
  const parsed = parseGitHubLinuxRelease([
    {
      tag_name: 'linux-v1.0.0',
      html_url: `${GITHUB_REPOSITORY_URL}/releases/tag/linux-v1.0.0`,
      draft: false,
      assets: [
        {
          name: 'SCRIBBLE-IT_1.0.0_amd64.deb',
          size: 14_200_000,
          browser_download_url: debUrl,
          digest: `sha256:${debSha}`,
        },
        {
          name: 'SCRIBBLE-IT-1.0.0-1.x86_64.rpm',
          size: 14_500_000,
          browser_download_url: rpmUrl,
          digest: `sha256:${rpmSha}`,
        },
        {
          name: 'SCRIBBLE-IT_1.0.0_amd64.AppImage',
          size: 82_000_000,
          browser_download_url: appUrl,
          digest: `sha256:${appSha}`,
        },
        {
          name: 'SHA256SUMS-linux.txt',
          size: 290,
          browser_download_url: sumsUrl,
        },
      ],
    },
  ]);

  assert.ok(parsed);
  assert.equal(parsed.availabilityStatus, 'Available');
  assert.equal(parsed.version, '1.0.0');
  assert.equal(parsed.debInstallerUrl, debUrl);
  assert.equal(parsed.debInstallerName, 'SCRIBBLE-IT_1.0.0_amd64.deb');
  assert.equal(parsed.debSha256, debSha);
  assert.equal(parsed.rpmInstallerUrl, rpmUrl);
  assert.equal(parsed.rpmInstallerName, 'SCRIBBLE-IT-1.0.0-1.x86_64.rpm');
  assert.equal(parsed.rpmSha256, rpmSha);
  assert.equal(parsed.appImageInstallerUrl, appUrl);
  assert.equal(parsed.appImageInstallerName, 'SCRIBBLE-IT_1.0.0_amd64.AppImage');
  assert.equal(parsed.appImageSha256, appSha);
  assert.equal(parsed.sha256SumsUrl, sumsUrl);
  assert.equal(parsed.supportedArchitectures, 'Linux x86_64 (64-bit amd64)');
});

test('Tauri Linux packaging config, Cargo Secret Service feature, CI workflow, Pages deployment, and website CTAs are valid', () => {
  const tauriConf = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8')
  );
  const cargoToml = fs.readFileSync(path.join(REPO_ROOT, 'src-tauri', 'Cargo.toml'), 'utf8');
  const libRs = fs.readFileSync(path.join(REPO_ROOT, 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const linuxCiYaml = fs.readFileSync(
    path.join(REPO_ROOT, '.github', 'workflows', 'linux-desktop-ci.yml'),
    'utf8'
  );
  const deployPagesYaml = fs.readFileSync(
    path.join(REPO_ROOT, '.github', 'workflows', 'deploy-pages.yml'),
    'utf8'
  );
  const buildSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'build-linux-release.sh'),
    'utf8'
  );
  const landingTsx = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'pages', 'public', 'LandingWebsitePage.tsx'),
    'utf8'
  );

  // Preserve Windows + macOS targets while enabling Linux deb/rpm/appimage bundles & metainfo
  assert.equal(tauriConf.identifier, 'in.njuretech.scribbleit');
  assert.deepEqual(tauriConf.bundle.targets, ['nsis', 'msi']);
  assert.ok(Array.isArray(tauriConf.bundle.linux?.deb?.depends));
  assert.ok(tauriConf.bundle.linux.deb.depends.includes('libwebkit2gtk-4.1-0'));
  assert.ok(Array.isArray(tauriConf.bundle.linux?.rpm?.depends));
  assert.ok(tauriConf.bundle.linux.rpm.depends.includes('webkit2gtk4.1'));
  assert.equal(tauriConf.bundle.linux?.appimage?.bundleMediaFramework, false);

  const metainfoPath = path.resolve(
    path.join(REPO_ROOT, 'src-tauri'),
    tauriConf.bundle.linux.deb.files['/usr/share/metainfo/in.njuregroup.scribbleit.metainfo.xml']
  );
  assert.equal(fs.existsSync(metainfoPath), true, 'Missing Linux AppStream metainfo XML');

  // Cargo target dependencies preserve Windows/macOS and configure Linux sync-secret-service
  assert.match(cargoToml, /target\.'cfg\(target_os = "windows"\)'\.dependencies/);
  assert.match(cargoToml, /target\.'cfg\(target_os = "macos"\)'\.dependencies/);
  assert.match(cargoToml, /target\.'cfg\(target_os = "linux"\)'\.dependencies/);
  assert.match(cargoToml, /features\s*=\s*\["sync-secret-service"\]/);
  assert.match(libRs, /in\.njuretech\.scribbleit\.linux/);
  assert.match(libRs, /parse_linux_os_release_name/);

  // Ubuntu LTS workflow & release script checks
  assert.match(linuxCiYaml, /runs-on:\s*ubuntu-22\.04/);
  assert.match(linuxCiYaml, /libwebkit2gtk-4\.1-dev/);
  assert.match(linuxCiYaml, /patchelf/);
  assert.match(linuxCiYaml, /\brpm\b/);
  assert.match(linuxCiYaml, /APPIMAGE_EXTRACT_AND_RUN:\s*"1"/);
  assert.doesNotMatch(
    linuxCiYaml,
    /^\s*if:.*secrets\./m,
    'GitHub Actions prohibits referencing secrets inside step/job if: expressions'
  );
  assert.match(buildSh, /BUNDLES="deb,rpm,appimage"/);
  assert.match(buildSh, /--bundles "\$BUNDLES"/);
  assert.match(buildSh, /dpkg-deb/);
  assert.match(buildSh, /appimage-extract/);
  assert.match(buildSh, /SHA256SUMS-linux\.txt/);

  // Pages workflow triggers after Linux CI & exports VITE_LINUX_* variables
  assert.match(deployPagesYaml, /Build & Verify Linux Desktop Application/);
  assert.match(deployPagesYaml, /VITE_LINUX_DEB_URL=/);
  assert.match(deployPagesYaml, /VITE_LINUX_RPM_URL=/);
  assert.match(deployPagesYaml, /VITE_LINUX_APPIMAGE_URL=/);

  // Website gates Linux download CTAs strictly on Available status
  assert.match(landingTsx, /id="linux-desktop"/);
  assert.match(landingTsx, /Download for Linux/);
  assert.match(landingTsx, /Debian \/ Ubuntu \(\.deb\)/);
  assert.match(landingTsx, /Fedora \/ RHEL \(\.rpm\)/);
  assert.match(landingTsx, /Universal Linux \(\.AppImage\)/);
  assert.match(landingTsx, /linuxRelease\.availabilityStatus === 'Available'/);
});
