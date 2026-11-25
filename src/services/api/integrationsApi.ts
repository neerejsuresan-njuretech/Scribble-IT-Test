import { apiRequest } from './httpClient';

export interface IntegrationConnectionDto {
  id: string;
  organization_id: string;
  provider: string;
  display_name: string;
  status: 'active' | 'disabled' | 'error';
  config_json: Record<string, unknown>;
  has_credentials: boolean;
  has_oauth_token: boolean;
  oauth_token_expires_at: string | null;
  oauth_scopes: string[];
  allowed_roles: string[];
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpointDto {
  id: string;
  organization_id: string;
  name: string;
  target_url: string;
  subscribed_events: string[];
  is_active: boolean;
  max_retries: number;
  last_delivery_status: number | null;
  last_delivered_at: string | null;
  created_at: string;
}

export interface TelephonyCallDto {
  id: string;
  organization_id: string;
  provider: string;
  provider_call_sid: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string;
  to_number: string;
  caller_name: string | null;
  linked_incident_id: string | null;
  duration_seconds: number;
  notes: string;
  created_at: string;
}

export interface BackgroundJobDto {
  id: string;
  organization_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'retrying' | 'succeeded' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AiUsageSummaryDto {
  organization_id: string;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  rate_limit_per_minute: number;
  model: string;
  recent_logs: Array<{
    id: string;
    actor_email: string;
    action_type: string;
    model_name: string;
    target_entity_type: string | null;
    target_entity_id: string | null;
    prompt_chars: number;
    response_chars: number;
    latency_ms: number;
    status: string;
    requires_human_approval: boolean;
    advisory_summary: string;
    created_at: string;
  }>;
}

export const integrationsApi = {
  // --- AI Quota & Audit ---
  getAiUsage(): Promise<AiUsageSummaryDto> {
    return apiRequest<AiUsageSummaryDto>('/ai/usage');
  },

  // --- Integration Connections ---
  listConnections(): Promise<IntegrationConnectionDto[]> {
    return apiRequest<IntegrationConnectionDto[]>('/integrations/connections');
  },

  createConnection(payload: {
    provider: string;
    display_name: string;
    config_json?: Record<string, unknown>;
    credentials?: Record<string, string>;
    oauth_scopes?: string[];
    allowed_roles?: string[];
  }): Promise<IntegrationConnectionDto> {
    return apiRequest<IntegrationConnectionDto>('/integrations/connections', {
      method: 'POST',
      body: payload,
    });
  },

  updateConnection(
    connectionId: string,
    payload: {
      display_name?: string;
      status?: 'active' | 'disabled' | 'error';
      config_json?: Record<string, unknown>;
      credentials?: Record<string, string>;
      allowed_roles?: string[];
    },
  ): Promise<IntegrationConnectionDto> {
    return apiRequest<IntegrationConnectionDto>(`/integrations/connections/${connectionId}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  storeOAuthTokens(
    connectionId: string,
    payload: {
      access_token: string;
      refresh_token?: string;
      expires_in_seconds?: number;
      scopes?: string[];
    },
  ): Promise<IntegrationConnectionDto> {
    return apiRequest<IntegrationConnectionDto>(
      `/integrations/connections/${connectionId}/oauth-tokens`,
      { method: 'POST', body: payload },
    );
  },

  executeGoogleWorkspaceAction(payload: {
    connection_id: string;
    action: string;
    params?: Record<string, unknown>;
  }): Promise<{ ok: boolean; action: string; data: unknown }> {
    return apiRequest('/integrations/google/execute', {
      method: 'POST',
      body: payload,
      timeoutMs: 25000,
    });
  },

  // --- Webhooks ---
  listWebhooks(): Promise<WebhookEndpointDto[]> {
    return apiRequest<WebhookEndpointDto[]>('/integrations/webhooks');
  },

  createWebhook(payload: {
    name: string;
    target_url: string;
    signing_secret: string;
    subscribed_events?: string[];
    max_retries?: number;
  }): Promise<WebhookEndpointDto> {
    return apiRequest<WebhookEndpointDto>('/integrations/webhooks', {
      method: 'POST',
      body: payload,
    });
  },

  testWebhook(webhookId: string, eventType = 'system.test'): Promise<BackgroundJobDto> {
    return apiRequest<BackgroundJobDto>(`/integrations/webhooks/${webhookId}/test`, {
      method: 'POST',
      body: { event_type: eventType },
    });
  },

  // --- Telephony / Twilio ---
  listCalls(): Promise<TelephonyCallDto[]> {
    return apiRequest<TelephonyCallDto[]>('/integrations/telephony/calls');
  },

  placeOutboundCall(payload: {
    to_number: string;
    caller_name?: string;
    linked_incident_id?: string;
    notes?: string;
  }): Promise<TelephonyCallDto> {
    return apiRequest<TelephonyCallDto>('/integrations/telephony/calls/outbound', {
      method: 'POST',
      body: payload,
    });
  },

  // --- External Notifications & Background Jobs ---
  dispatchExternalNotification(payload: {
    connection_id: string;
    channel?: string;
    subject: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
  }): Promise<BackgroundJobDto> {
    return apiRequest<BackgroundJobDto>('/integrations/notifications/dispatch', {
      method: 'POST',
      body: payload,
    });
  },

  listJobs(): Promise<BackgroundJobDto[]> {
    return apiRequest<BackgroundJobDto[]>('/integrations/jobs');
  },
};
