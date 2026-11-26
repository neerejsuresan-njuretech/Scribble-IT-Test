export interface AuthTokenSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  organizationId: string | null;
}

export interface TokenUpdateParams {
  accessToken: string | null;
  refreshToken?: string | null;
  organizationId?: string | null;
}

/**
 * Injectable token persistence contract for Web (in-memory), Tauri Desktop
 * (OS Keychain / Stronghold), and React Native (Keychain / Keystore / SecureStore).
 * Both synchronous and asynchronous implementations are supported.
 */
export interface TokenStorageAdapter {
  getAccessToken(): string | null | Promise<string | null>;
  getRefreshToken(): string | null | Promise<string | null>;
  getOrganizationId(): string | null | Promise<string | null>;
  setTokens(params: TokenUpdateParams): void | Promise<void>;
  clearTokens(): void | Promise<void>;
}

/**
 * Injectable FastAPI base URL provider (supports static strings, env readers,
 * or async tenant/workspace server configuration lookups on desktop & mobile).
 */
export type BaseUrlProvider =
  | string
  | (() => string | null | undefined | Promise<string | null | undefined>);

export interface BaseUrlProviderObject {
  getBaseUrl(): string | null | undefined | Promise<string | null | undefined>;
}

export type ResolvableBaseUrlProvider = BaseUrlProvider | BaseUrlProviderObject;

/**
 * Default zero-persistence in-memory token adapter safe for browser SPAs and unit tests.
 */
export class MemoryTokenStorageAdapter implements TokenStorageAdapter {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private organizationId: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  getOrganizationId(): string | null {
    return this.organizationId;
  }

  setTokens(params: TokenUpdateParams): void {
    this.accessToken = params.accessToken;
    if (params.refreshToken !== undefined) {
      this.refreshToken = params.refreshToken;
    }
    if (params.organizationId !== undefined) {
      this.organizationId = params.organizationId;
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.organizationId = null;
  }
}

export function normalizeFastApiBaseUrl(rawUrl: string | null | undefined): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}
