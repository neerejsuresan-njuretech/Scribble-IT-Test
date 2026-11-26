import type {
  AiUsageSummaryDto,
  BackgroundJobDto,
  IntegrationConnectionDto,
  TelephonyCallDto,
  WebhookEndpointDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  AiUsageSummaryDto,
  BackgroundJobDto,
  IntegrationConnectionDto,
  TelephonyCallDto,
  WebhookEndpointDto,
};

export function createIntegrationsApi(http: ScribbleHttpClient) {
  return {
    getAiUsage(): Promise<AiUsageSummaryDto> {
      return http.request<AiUsageSummaryDto>('/ai/usage');
    },

    listConnections(): Promise<IntegrationConnectionDto[]> {
      return http.request<IntegrationConnectionDto[]>('/integrations/connections');
    },

    createConnection(payload: {
      provider: string;
      display_name: string;
      config_json?: Record<string, unknown>;
      credentials?: Record<string, string>;
      oauth_scopes?: string[];
      allowed_roles?: string[];
    }): Promise<IntegrationConnectionDto> {
      return http.request<IntegrationConnectionDto>('/integrations/connections', {
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
      return http.request<IntegrationConnectionDto>(`/integrations/connections/${connectionId}`, {
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
      return http.request<IntegrationConnectionDto>(
        `/integrations/connections/${connectionId}/oauth-tokens`,
        { method: 'POST', body: payload },
      );
    },

    executeGoogleWorkspaceAction(payload: {
      connection_id: string;
      action: string;
      params?: Record<string, unknown>;
    }): Promise<{ ok: boolean; action: string; data: unknown }> {
      return http.request('/integrations/google/execute', {
        method: 'POST',
        body: payload,
        timeoutMs: 25000,
      });
    },

    listWebhooks(): Promise<WebhookEndpointDto[]> {
      return http.request<WebhookEndpointDto[]>('/integrations/webhooks');
    },

    createWebhook(payload: {
      name: string;
      target_url: string;
      signing_secret: string;
      subscribed_events?: string[];
      max_retries?: number;
    }): Promise<WebhookEndpointDto> {
      return http.request<WebhookEndpointDto>('/integrations/webhooks', {
        method: 'POST',
        body: payload,
      });
    },

    testWebhook(webhookId: string, eventType = 'system.test'): Promise<BackgroundJobDto> {
      return http.request<BackgroundJobDto>(`/integrations/webhooks/${webhookId}/test`, {
        method: 'POST',
        body: { event_type: eventType },
      });
    },

    listCalls(): Promise<TelephonyCallDto[]> {
      return http.request<TelephonyCallDto[]>('/integrations/telephony/calls');
    },

    placeOutboundCall(payload: {
      to_number: string;
      caller_name?: string;
      linked_incident_id?: string;
      notes?: string;
    }): Promise<TelephonyCallDto> {
      return http.request<TelephonyCallDto>('/integrations/telephony/calls/outbound', {
        method: 'POST',
        body: payload,
      });
    },

    dispatchExternalNotification(payload: {
      connection_id: string;
      channel?: string;
      subject: string;
      message: string;
      severity?: 'info' | 'warning' | 'critical';
    }): Promise<BackgroundJobDto> {
      return http.request<BackgroundJobDto>('/integrations/notifications/dispatch', {
        method: 'POST',
        body: payload,
      });
    },

    listJobs(): Promise<BackgroundJobDto[]> {
      return http.request<BackgroundJobDto[]>('/integrations/jobs');
    },
  };
}

export const integrationsApi = createIntegrationsApi(defaultHttpClient);
