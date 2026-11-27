import type { TokenStorageAdapter, TokenUpdateParams } from '@scribble-it/api-client';
import { invoke } from '@tauri-apps/api/core';

export type VaultSecretKey = 'access_token' | 'refresh_token' | 'organization_id';

export interface DesktopVaultBridge {
  getSecret(key: VaultSecretKey): Promise<string | null>;
  setSecret(key: VaultSecretKey, value: string): Promise<void>;
  deleteSecret(key: VaultSecretKey): Promise<void>;
  clearSessionTokens(): Promise<void>;
}

export type WindowsVaultBridge = DesktopVaultBridge;

const defaultTauriVaultBridge: WindowsVaultBridge = {
  async getSecret(key) {
    const val = await invoke<string | null>('vault_get_secret', { key });
    return val ?? null;
  },
  async setSecret(key, value) {
    await invoke<void>('vault_set_secret', { key, value });
  },
  async deleteSecret(key) {
    await invoke<void>('vault_delete_secret', { key });
  },
  async clearSessionTokens() {
    await invoke<void>('vault_clear_session_tokens');
  },
};

/**
 * OS native keyring-backed TokenStorageAdapter via Tauri Rust `keyring`
 * (Windows Credential Manager on Windows, Apple Keychain on macOS,
 * and Freedesktop Secret Service / GNOME Keyring / KWallet on Linux).
 * Maintains a read cache in memory while storing persistent secrets strictly inside
 * the OS keychain/vault (never in localStorage or plain files).
 */
export class NativeVaultTokenStorage implements TokenStorageAdapter {
  private readonly bridge: DesktopVaultBridge;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private organizationId: string | null = null;
  private hydrated = false;

  constructor(bridge: DesktopVaultBridge = defaultTauriVaultBridge) {
    this.bridge = bridge;
  }

  async hydrate(): Promise<void> {
    const [access, refresh, org] = await Promise.all([
      this.bridge.getSecret('access_token').catch(() => null),
      this.bridge.getSecret('refresh_token').catch(() => null),
      this.bridge.getSecret('organization_id').catch(() => null),
    ]);
    this.accessToken = access;
    this.refreshToken = refresh;
    this.organizationId = org;
    this.hydrated = true;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | null> {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return this.refreshToken;
  }

  async getOrganizationId(): Promise<string | null> {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return this.organizationId;
  }

  async setTokens(params: TokenUpdateParams): Promise<void> {
    this.accessToken = params.accessToken;
    const ops: Array<Promise<void>> = [
      params.accessToken
        ? this.bridge.setSecret('access_token', params.accessToken)
        : this.bridge.deleteSecret('access_token'),
    ];

    if (params.refreshToken !== undefined) {
      this.refreshToken = params.refreshToken;
      ops.push(
        params.refreshToken
          ? this.bridge.setSecret('refresh_token', params.refreshToken)
          : this.bridge.deleteSecret('refresh_token'),
      );
    }

    if (params.organizationId !== undefined) {
      this.organizationId = params.organizationId;
      ops.push(
        params.organizationId
          ? this.bridge.setSecret('organization_id', params.organizationId)
          : this.bridge.deleteSecret('organization_id'),
      );
    }

    this.hydrated = true;
    await Promise.all(ops);
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.organizationId = null;
    this.hydrated = true;
    await this.bridge.clearSessionTokens();
  }
}

export const WindowsCredentialTokenStorage = NativeVaultTokenStorage;
