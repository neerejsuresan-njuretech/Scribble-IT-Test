import type { ApiErrorPayload, PageMetaDto, PaginatedDto } from '@scribble-it/types';
import {
  MemoryTokenStorageAdapter,
  normalizeFastApiBaseUrl,
  ResolvableBaseUrlProvider,
  TokenStorageAdapter,
  TokenUpdateParams,
} from './storage';

export type { ApiErrorPayload, PageMetaDto, PaginatedDto };

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

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

export interface HttpClientConfig {
  baseUrlProvider?: ResolvableBaseUrlProvider;
  tokenStorage?: TokenStorageAdapter;
  fetchImpl?: typeof fetch;
  defaultTimeoutMs?: number;
}

function readRuntimeEnv(key: string): string | undefined {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv && key in metaEnv) return metaEnv[key];
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process;
  if (proc?.env && key in proc.env) {
    return proc.env[key];
  }
  return undefined;
}

function defaultEnvBaseUrlProvider(): string {
  return readRuntimeEnv('VITE_API_BASE_URL') || '';
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value;
}

export class ScribbleHttpClient {
  private tokenStorage: TokenStorageAdapter;
  private baseUrlProvider: ResolvableBaseUrlProvider;
  private fetchImpl?: typeof fetch;
  private defaultTimeoutMs: number;
  private refreshPromise: Promise<boolean> | null = null;
  private runtimeBaseUrlOverride: string | null = null;
  private cachedAccessToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private cachedOrganizationId: string | null = null;

  constructor(config: HttpClientConfig = {}) {
    this.tokenStorage = config.tokenStorage ?? new MemoryTokenStorageAdapter();
    this.baseUrlProvider = config.baseUrlProvider ?? defaultEnvBaseUrlProvider;
    this.fetchImpl = config.fetchImpl;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 15000;
  }

  configure(config: Partial<HttpClientConfig>): void {
    if (config.tokenStorage !== undefined) {
      this.tokenStorage = config.tokenStorage;
      this.syncReadCache();
    }
    if (config.baseUrlProvider !== undefined) {
      this.baseUrlProvider = config.baseUrlProvider;
    }
    if (config.fetchImpl !== undefined) {
      this.fetchImpl = config.fetchImpl;
    }
    if (config.defaultTimeoutMs !== undefined) {
      this.defaultTimeoutMs = config.defaultTimeoutMs;
    }
  }

  setTokenStorageAdapter(adapter: TokenStorageAdapter): void {
    this.tokenStorage = adapter;
    this.syncReadCache();
  }

  setBaseUrlProvider(provider: ResolvableBaseUrlProvider): void {
    this.baseUrlProvider = provider;
  }

  setApiBaseUrlForTesting(url: string | null): void {
    this.runtimeBaseUrlOverride = url;
  }

  private syncReadCache(): void {
    const access = this.tokenStorage.getAccessToken();
    const refresh = this.tokenStorage.getRefreshToken();
    const orgId = this.tokenStorage.getOrganizationId();
    if (!isPromiseLike(access)) this.cachedAccessToken = access;
    if (!isPromiseLike(refresh)) this.cachedRefreshToken = refresh;
    if (!isPromiseLike(orgId)) this.cachedOrganizationId = orgId;
  }

  private resolveBaseUrlSync(): string {
    if (this.runtimeBaseUrlOverride !== null) {
      return normalizeFastApiBaseUrl(this.runtimeBaseUrlOverride);
    }
    if (typeof this.baseUrlProvider === 'string') {
      return normalizeFastApiBaseUrl(this.baseUrlProvider);
    }
    const raw =
      typeof this.baseUrlProvider === 'function'
        ? this.baseUrlProvider()
        : this.baseUrlProvider.getBaseUrl();
    if (isPromiseLike(raw)) {
      return '';
    }
    return normalizeFastApiBaseUrl(raw);
  }

  async resolveBaseUrl(): Promise<string> {
    if (this.runtimeBaseUrlOverride !== null) {
      return normalizeFastApiBaseUrl(this.runtimeBaseUrlOverride);
    }
    if (typeof this.baseUrlProvider === 'string') {
      return normalizeFastApiBaseUrl(this.baseUrlProvider);
    }
    const raw =
      typeof this.baseUrlProvider === 'function'
        ? await this.baseUrlProvider()
        : await this.baseUrlProvider.getBaseUrl();
    return normalizeFastApiBaseUrl(raw);
  }

  getApiBaseUrl(): string {
    return this.resolveBaseUrlSync();
  }

  isBackendApiConfigured(): boolean {
    const explicitFlag = readRuntimeEnv('VITE_USE_BACKEND_API');
    if (explicitFlag === 'false') return false;
    if (explicitFlag === 'true') return true;
    return this.getApiBaseUrl().length > 0;
  }

  setAuthTokens(params: TokenUpdateParams): void | Promise<void> {
    this.cachedAccessToken = params.accessToken;
    if (params.refreshToken !== undefined) {
      this.cachedRefreshToken = params.refreshToken;
    }
    if (params.organizationId !== undefined) {
      this.cachedOrganizationId = params.organizationId;
    }
    return this.tokenStorage.setTokens(params);
  }

  clearAuthTokens(): void | Promise<void> {
    this.cachedAccessToken = null;
    this.cachedRefreshToken = null;
    this.cachedOrganizationId = null;
    return this.tokenStorage.clearTokens();
  }

  getAccessToken(): string | null {
    const val = this.tokenStorage.getAccessToken();
    return isPromiseLike(val) ? this.cachedAccessToken : val;
  }

  getRefreshToken(): string | null {
    const val = this.tokenStorage.getRefreshToken();
    return isPromiseLike(val) ? this.cachedRefreshToken : val;
  }

  getActiveApiOrganizationId(): string | null {
    const val = this.tokenStorage.getOrganizationId();
    return isPromiseLike(val) ? this.cachedOrganizationId : val;
  }

  private getFetch(): typeof fetch {
    if (this.fetchImpl) return this.fetchImpl;
    return globalThis.fetch;
  }

  private async attemptRefresh(): Promise<boolean> {
    const currentRefreshToken = await this.tokenStorage.getRefreshToken();
    if (!currentRefreshToken) return false;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const baseUrl = await this.resolveBaseUrl();
        if (!baseUrl) return false;
        const doFetch = this.getFetch();
        const res = await doFetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        });
        if (!res.ok) {
          await this.clearAuthTokens();
          return false;
        }
        const data = (await res.json()) as {
          access_token: string;
          refresh_token?: string;
          organization_id?: string;
        };
        await this.setAuthTokens({
          accessToken: data.access_token,
          ...(data.refresh_token !== undefined ? { refreshToken: data.refresh_token } : {}),
          ...(data.organization_id !== undefined ? { organizationId: data.organization_id } : {}),
        });
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private buildUrl(base: string, path: string, query?: ApiRequestOptions['query']): string {
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

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      query,
      headers = {},
      skipAuth = false,
      timeoutMs = this.defaultTimeoutMs,
    } = options;

    const baseUrl = await this.resolveBaseUrl();
    const url = this.buildUrl(baseUrl, path, query);
    const doFetch = this.getFetch();

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
        if (!skipAuth) {
          const accessToken = await this.tokenStorage.getAccessToken();
          const organizationId = await this.tokenStorage.getOrganizationId();
          if (accessToken) {
            reqHeaders['Authorization'] = `Bearer ${accessToken}`;
          }
          if (organizationId) {
            reqHeaders['X-Organization-ID'] = organizationId;
          }
        }
        return await doFetch(url, {
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
    if (response.status === 401 && !skipAuth) {
      const refreshToken = await this.tokenStorage.getRefreshToken();
      if (refreshToken) {
        const refreshed = await this.attemptRefresh();
        if (refreshed) {
          response = await exec();
        }
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
      const errObj =
        typeof payload === 'object' && payload !== null ? (payload as ApiErrorPayload) : null;
      const message =
        errObj?.error?.message ||
        errObj?.detail ||
        (typeof payload === 'string' && payload.trim() ? payload : `HTTP ${response.status}`);
      const code = errObj?.error?.code || `HTTP_${response.status}`;
      throw new ApiError(response.status, message, code, errObj?.error?.details);
    }

    return payload as T;
  }
}

export const defaultHttpClient = new ScribbleHttpClient();

export function configureApiClient(config: Partial<HttpClientConfig>): void {
  defaultHttpClient.configure(config);
}

export function setTokenStorageAdapter(adapter: TokenStorageAdapter): void {
  defaultHttpClient.setTokenStorageAdapter(adapter);
}

export function setBaseUrlProvider(provider: ResolvableBaseUrlProvider): void {
  defaultHttpClient.setBaseUrlProvider(provider);
}

export function getApiBaseUrl(): string {
  return defaultHttpClient.getApiBaseUrl();
}

export function setApiBaseUrlForTesting(url: string | null): void {
  defaultHttpClient.setApiBaseUrlForTesting(url);
}

export function isBackendApiConfigured(): boolean {
  return defaultHttpClient.isBackendApiConfigured();
}

export function setAuthTokens(params: TokenUpdateParams): void | Promise<void> {
  return defaultHttpClient.setAuthTokens(params);
}

export function clearAuthTokens(): void | Promise<void> {
  return defaultHttpClient.clearAuthTokens();
}

export function getAccessToken(): string | null {
  return defaultHttpClient.getAccessToken();
}

export function getRefreshToken(): string | null {
  return defaultHttpClient.getRefreshToken();
}

export function getActiveApiOrganizationId(): string | null {
  return defaultHttpClient.getActiveApiOrganizationId();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return defaultHttpClient.request<T>(path, options);
}
