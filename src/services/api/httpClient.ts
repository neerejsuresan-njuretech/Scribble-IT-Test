export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  detail?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface PageMetaDto {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedDto<T> {
  items: T[];
  meta: PageMetaDto;
}

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
  organizationId: string | null;
}

const tokenStore: TokenStore = {
  accessToken: null,
  refreshToken: null,
  organizationId: null,
};

let refreshPromise: Promise<boolean> | null = null;
let runtimeBaseUrlOverride: string | null = null;

function readEnv(key: string): string | undefined {
  // Support both Vite (import.meta.env) and Node.js test environments
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv && key in metaEnv) return metaEnv[key];
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key];
  }
  return undefined;
}

export function getApiBaseUrl(): string {
  const raw =
    runtimeBaseUrlOverride !== null
      ? runtimeBaseUrlOverride
      : readEnv('VITE_API_BASE_URL') || '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

export function setApiBaseUrlForTesting(url: string | null): void {
  runtimeBaseUrlOverride = url;
}

export function isBackendApiConfigured(): boolean {
  const explicitFlag = readEnv('VITE_USE_BACKEND_API');
  if (explicitFlag === 'false') return false;
  if (explicitFlag === 'true') return true;
  return getApiBaseUrl().length > 0;
}

export function setAuthTokens(params: {
  accessToken: string | null;
  refreshToken?: string | null;
  organizationId?: string | null;
}): void {
  tokenStore.accessToken = params.accessToken;
  if (params.refreshToken !== undefined) {
    tokenStore.refreshToken = params.refreshToken;
  }
  if (params.organizationId !== undefined) {
    tokenStore.organizationId = params.organizationId;
  }
}

export function clearAuthTokens(): void {
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
  tokenStore.organizationId = null;
}

export function getAccessToken(): string | null {
  return tokenStore.accessToken;
}

export function getRefreshToken(): string | null {
  return tokenStore.refreshToken;
}

export function getActiveApiOrganizationId(): string | null {
  return tokenStore.organizationId;
}

async function attemptRefresh(): Promise<boolean> {
  if (!tokenStore.refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) return false;
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokenStore.refreshToken }),
      });
      if (!res.ok) {
        clearAuthTokens();
        return false;
      }
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        organization_id?: string;
      };
      tokenStore.accessToken = data.access_token;
      if (data.refresh_token) {
        tokenStore.refreshToken = data.refresh_token;
      }
      if (data.organization_id) {
        tokenStore.organizationId = data.organization_id;
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const full = `${base}${normalizedPath}`;
  if (!query) return full;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${full}?${qs}` : full;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers = {}, skipAuth = false, timeoutMs = 15000 } = options;
  const url = buildUrl(path, query);

  const exec = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const reqHeaders: Record<string, string> = {
        Accept: 'application/json',
        ...headers,
      };
      if (body !== undefined) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (!skipAuth && tokenStore.accessToken) {
        reqHeaders['Authorization'] = `Bearer ${tokenStore.accessToken}`;
      }
      if (!skipAuth && tokenStore.organizationId) {
        reqHeaders['X-Organization-ID'] = tokenStore.organizationId;
      }
      return await fetch(url, {
        method,
        headers: reqHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await exec();

  // Single-flight automatic refresh-token rotation on 401
  if (response.status === 401 && !skipAuth && tokenStore.refreshToken) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      response = await exec();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errObj = typeof payload === 'object' && payload !== null ? (payload as ApiErrorPayload) : null;
    const message =
      errObj?.error?.message ||
      errObj?.detail ||
      (typeof payload === 'string' && payload.trim() ? payload : `HTTP ${response.status}`);
    const code = errObj?.error?.code || `HTTP_${response.status}`;
    throw new ApiError(response.status, message, code, errObj?.error?.details);
  }

  return payload as T;
}
