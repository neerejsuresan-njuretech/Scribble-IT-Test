import type { ClientMetadataDto } from '@scribble-it/types';

export interface DesktopRuntimeInfo {
  client_type: 'desktop';
  client_platform: 'windows';
  app_version: string;
  app_id: string;
  device_name: string;
  os_version: string;
  device_fingerprint: string;
  mdm_claimed: boolean;
  credential_backend: string;
}

export interface PickedAttachmentInfo {
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256: string;
}

export interface DeepLinkNavigationEvent {
  raw_url: string;
  route: string;
}

const FORBIDDEN_DEEP_LINK_PARAMS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'session',
  'session_id',
  'role',
  'portal_type',
  'admin',
  'sso_token',
]);

const ALLOWED_DEEP_LINK_ROUTES: Record<string, string> = {
  '': '/watchtower',
  watchtower: '/watchtower',
  home: '/watchtower',
  incidents: '/incidents',
  'incidents/new': '/incidents/new',
  requests: '/requests',
  'requests/new': '/requests/new',
  changes: '/changes',
  problems: '/problems',
  assets: '/assets',
  portal: '/portal',
  'portal/new': '/portal/new',
  iam: '/iam',
  login: '/login/employee',
  'login/employee': '/login/employee',
  'login/admin': '/login/admin',
  'login/iam': '/login/iam',
  'login/portal': '/login/portal',
};

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

export function validateDesktopApiBaseUrl(
  raw: string,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, normalized: '' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid server API URL format.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Embedded credentials in server URLs are not permitted.' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, error: 'Server base URL must not contain query parameters or fragments.' };
  }

  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  if (parsed.protocol === 'https:') {
    return { ok: true, normalized: trimmed.replace(/\/+$/, '') };
  }
  if (parsed.protocol === 'http:' && isLoopback) {
    return { ok: true, normalized: trimmed.replace(/\/+$/, '') };
  }
  if (parsed.protocol === 'http:') {
    return {
      ok: false,
      error: 'Plain HTTP is restricted to localhost development. Use HTTPS for enterprise servers.',
    };
  }

  return {
    ok: false,
    error: 'Only HTTPS server URLs (or localhost HTTP for dev) are permitted.',
  };
}

export function validateDesktopDeepLink(
  rawUrl: string,
): { ok: true; route: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Malformed deep link URI.' };
  }

  if (parsed.protocol !== 'scribbleit:') {
    return { ok: false, error: 'Unsupported deep-link scheme.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Deep link must not contain credentials.' };
  }

  for (const [key] of parsed.searchParams.entries()) {
    if (FORBIDDEN_DEEP_LINK_PARAMS.has(key.toLowerCase())) {
      return {
        ok: false,
        error: `Deep link rejected forbidden authentication parameter '${key}'.`,
      };
    }
  }

  const host = parsed.hostname.toLowerCase();
  const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const combined =
    host && pathPart ? `${host}/${pathPart}` : host || pathPart;

  if (combined in ALLOWED_DEEP_LINK_ROUTES) {
    return { ok: true, route: ALLOWED_DEEP_LINK_ROUTES[combined] };
  }
  if (combined.startsWith('incidents/')) {
    return { ok: true, route: '/incidents' };
  }
  if (combined.startsWith('requests/')) {
    return { ok: true, route: '/requests' };
  }
  if (combined.startsWith('changes/')) {
    return { ok: true, route: '/changes' };
  }

  return { ok: false, error: 'Deep link points to an unrecognized route.' };
}

export function validateExternalHttpsUrl(
  rawUrl: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid external URL.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'External URL must not include embedded credentials.' };
  }
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopback)) {
    return { ok: true, url: parsed.toString() };
  }
  return { ok: false, error: 'Blocked non-HTTPS external link for security.' };
}

export function buildDesktopClientMetadata(info: DesktopRuntimeInfo | null): ClientMetadataDto {
  return {
    client_type: 'desktop',
    client_platform: 'windows',
    app_version: info?.app_version || '1.0.0',
    app_id: info?.app_id || 'in.njuretech.scribbleit',
    device_name: info?.device_name || 'WINDOWS-WORKSTATION',
    os_version: info?.os_version || 'Windows',
  };
}
