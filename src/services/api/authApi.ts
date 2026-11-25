import { AuthPortalType, IamPermissionScope } from '../../types/itsm';
import { apiRequest, clearAuthTokens, setAuthTokens } from './httpClient';

export interface BackendMeResponse {
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  organization_slug: string;
  organization_name?: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  is_super_admin: boolean;
  is_iam_portal: boolean;
  permissions: IamPermissionScope[];
  roles: string[];
  session_id: string;
  device_managed?: boolean;
  device_id?: string | null;
}

export interface BackendLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  organization_slug: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  permissions: IamPermissionScope[];
  session_id: string;
}

export interface BackendOrganizationDto {
  id: string;
  name: string;
  slug: string;
  company_code: string;
  domain: string;
  plan: string;
  region: string;
  timezone: string;
  currency: string;
  primary_contact_email: string;
  status: 'active' | 'suspended';
  sla_targets: { P1: number; P2: number; P3: number; P4: number };
  enabled_modules: Record<string, boolean>;
  portal_branding: Record<string, unknown>;
  preference_template: Record<string, unknown>;
  company_logo_storage_key?: string | null;
  created_at: string;
}

export interface OrganizationSwitchResponseDto {
  access_token: string;
  expires_in: number;
  organization_id: string;
  organization_slug: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  permissions: IamPermissionScope[];
}

export const authApi = {
  async login(payload: {
    email: string;
    password: string;
    portal_type: AuthPortalType;
    organization_slug?: string;
    mfa_code?: string;
  }): Promise<BackendLoginResponse> {
    const res = await apiRequest<BackendLoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
    setAuthTokens({
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
    const res = await apiRequest<BackendLoginResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
    setAuthTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      organizationId: res.organization_id,
    });
    return res;
  },

  async me(): Promise<BackendMeResponse> {
    return apiRequest<BackendMeResponse>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthTokens();
    }
  },

  async enrollDevice(payload: {
    enrollment_code: string;
    hostname: string;
    os_platform: string;
    device_fingerprint: string;
    mdm_provider?: string;
    employee_email?: string;
  }): Promise<{
    device_id: string;
    hostname: string;
    trust_level: string;
    mdm_verified: boolean;
    certificate_thumbprint: string;
  }> {
    return apiRequest('/auth/device/enroll', {
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
    const res = await apiRequest<BackendLoginResponse>('/auth/device/sso-login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
    setAuthTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      organizationId: res.organization_id,
    });
    return res;
  },

  async listOrganizations(): Promise<BackendOrganizationDto[]> {
    return apiRequest<BackendOrganizationDto[]>('/organizations');
  },

  async switchOrganization(organizationId: string): Promise<OrganizationSwitchResponseDto> {
    const res = await apiRequest<OrganizationSwitchResponseDto>('/organizations/switch', {
      method: 'POST',
      body: { organization_id: organizationId },
    });
    setAuthTokens({
      accessToken: res.access_token,
      organizationId: res.organization_id,
    });
    return res;
  },
};
