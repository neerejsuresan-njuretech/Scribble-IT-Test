import type {
  AuthPortalType,
  BackendLoginResponse,
  BackendMeResponse,
  BackendOrganizationDto,
  ClientConfigDto,
  ClientMetadataDto,
  ClientPlatform,
  ClientType,
  DeviceEnrollResponseDto,
  DeviceListResponseDto,
  ManagedDeviceDto,
  OrganizationSwitchResponseDto,
  SessionListResponseDto,
  UserSessionDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  BackendLoginResponse,
  BackendMeResponse,
  BackendOrganizationDto,
  ClientConfigDto,
  ClientMetadataDto,
  DeviceEnrollResponseDto,
  DeviceListResponseDto,
  ManagedDeviceDto,
  OrganizationSwitchResponseDto,
  SessionListResponseDto,
  UserSessionDto,
};

export function createAuthApi(http: ScribbleHttpClient) {
  return {
    async login(payload: {
      email: string;
      password: string;
      portal_type: AuthPortalType;
      organization_id?: string;
      organization_slug?: string;
      totp_code?: string;
      backup_code?: string;
      client_metadata?: ClientMetadataDto;
    }): Promise<BackendLoginResponse> {
      const clientMeta = payload.client_metadata ?? http.getClientMetadata() ?? undefined;
      const body: Record<string, unknown> = {
        email: payload.email,
        password: payload.password,
        portal_type: payload.portal_type,
      };
      if (payload.organization_id) body.organization_id = payload.organization_id;
      if (payload.totp_code) body.totp_code = payload.totp_code;
      if (payload.backup_code) body.backup_code = payload.backup_code;
      if (clientMeta) body.client_metadata = clientMeta;

      const res = await http.request<BackendLoginResponse>('/auth/login', {
        method: 'POST',
        body,
        skipAuth: true,
      });
      await http.setAuthTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        organizationId: res.organization_id,
      });
      return res;
    },

    async register(payload: {
      email: string;
      full_name: string;
      password: string;
      organization_id?: string;
      company_name?: string;
      company_slug?: string;
      company_code?: string;
    }): Promise<BackendLoginResponse> {
      const res = await http.request<BackendLoginResponse>('/auth/register', {
        method: 'POST',
        body: payload,
        skipAuth: true,
      });
      await http.setAuthTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        organizationId: res.organization_id,
      });
      return res;
    },

    async me(): Promise<BackendMeResponse> {
      return http.request<BackendMeResponse>('/auth/me');
    },

    async logout(revokePushTokens = true): Promise<void> {
      try {
        await http.request<void>('/auth/logout', {
          method: 'POST',
          body: { revoke_push_tokens: revokePushTokens },
        });
      } finally {
        await http.clearAuthTokens();
      }
    },

    async listSessions(): Promise<SessionListResponseDto> {
      return http.request<SessionListResponseDto>('/auth/sessions');
    },

    async revokeSession(sessionId: string): Promise<void> {
      return http.request<void>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
    },

    async revokeAllSessions(keepCurrent = false): Promise<{ revoked_count: number }> {
      return http.request<{ revoked_count: number }>('/auth/sessions/revoke-all', {
        method: 'POST',
        query: { keep_current: keepCurrent },
      });
    },

    async getClientConfig(): Promise<ClientConfigDto> {
      return http.request<ClientConfigDto>('/client/config', { skipAuth: true });
    },

    async enrollDevice(payload: {
      enrollment_code: string;
      hostname: string;
      os_platform: string;
      device_fingerprint: string;
      client_type?: ClientType;
      device_platform?: ClientPlatform;
      app_version?: string;
      app_id?: string;
      os_version?: string;
      device_model?: string;
    }): Promise<DeviceEnrollResponseDto> {
      // Backend /api/v1/auth/device/enroll strictly requires an authenticated principal.
      return http.request<DeviceEnrollResponseDto>('/auth/device/enroll', {
        method: 'POST',
        body: payload,
      });
    },

    async listMyDevices(): Promise<DeviceListResponseDto> {
      return http.request<DeviceListResponseDto>('/auth/devices');
    },

    async deviceSsoLogin(payload: {
      email: string;
      device_fingerprint: string;
      certificate_thumbprint: string;
      organization_id: string;
      client_metadata?: ClientMetadataDto;
    }): Promise<BackendLoginResponse> {
      const clientMeta = payload.client_metadata ?? http.getClientMetadata() ?? undefined;
      const body: Record<string, unknown> = {
        email: payload.email,
        device_fingerprint: payload.device_fingerprint,
        certificate_thumbprint: payload.certificate_thumbprint,
        organization_id: payload.organization_id,
      };
      if (clientMeta) body.client_metadata = clientMeta;

      const res = await http.request<BackendLoginResponse>('/auth/device/sso-login', {
        method: 'POST',
        body,
        skipAuth: true,
      });
      await http.setAuthTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        organizationId: res.organization_id,
      });
      return res;
    },

    async listOrganizations(): Promise<BackendOrganizationDto[]> {
      return http.request<BackendOrganizationDto[]>('/organizations');
    },

    async switchOrganization(organizationId: string): Promise<OrganizationSwitchResponseDto> {
      const res = await http.request<OrganizationSwitchResponseDto>('/organizations/switch', {
        method: 'POST',
        body: { organization_id: organizationId },
      });
      await http.setAuthTokens({
        accessToken: res.access_token,
        organizationId: res.organization_id,
      });
      return res;
    },
  };
}

export const authApi = createAuthApi(defaultHttpClient);
