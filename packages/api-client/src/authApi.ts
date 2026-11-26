import type {
  AuthPortalType,
  BackendLoginResponse,
  BackendMeResponse,
  BackendOrganizationDto,
  DeviceEnrollResponseDto,
  OrganizationSwitchResponseDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  BackendLoginResponse,
  BackendMeResponse,
  BackendOrganizationDto,
  DeviceEnrollResponseDto,
  OrganizationSwitchResponseDto,
};

export function createAuthApi(http: ScribbleHttpClient) {
  return {
    async login(payload: {
      email: string;
      password: string;
      portal_type: AuthPortalType;
      organization_slug?: string;
      mfa_code?: string;
    }): Promise<BackendLoginResponse> {
      const res = await http.request<BackendLoginResponse>('/auth/login', {
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

    async register(payload: {
      email: string;
      full_name: string;
      password: string;
      organization_name?: string;
      organization_slug?: string;
      portal_type?: AuthPortalType;
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

    async logout(): Promise<void> {
      try {
        await http.request<void>('/auth/logout', { method: 'POST' });
      } finally {
        await http.clearAuthTokens();
      }
    },

    async enrollDevice(payload: {
      enrollment_code: string;
      hostname: string;
      os_platform: string;
      device_fingerprint: string;
      mdm_provider?: string;
      employee_email?: string;
    }): Promise<DeviceEnrollResponseDto> {
      return http.request<DeviceEnrollResponseDto>('/auth/device/enroll', {
        method: 'POST',
        body: payload,
        skipAuth: true,
      });
    },

    async deviceSsoLogin(payload: {
      email: string;
      device_id: string;
      device_fingerprint: string;
      organization_slug?: string;
    }): Promise<BackendLoginResponse> {
      const res = await http.request<BackendLoginResponse>('/auth/device/sso-login', {
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
