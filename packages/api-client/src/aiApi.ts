import type {
  ChangeAssessResponse,
  CopilotResponse,
  CopilotTurnMessage,
  DraftKbResponse,
  IncidentTriageResponse,
  MatchedKbSuggestion,
  SuggestedNewKbTopic,
  TriageAssistantKbPayload,
  TriageAssistantResponse,
  WikiAssistResponse,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  ChangeAssessResponse,
  CopilotResponse,
  CopilotTurnMessage,
  DraftKbResponse,
  IncidentTriageResponse,
  MatchedKbSuggestion,
  SuggestedNewKbTopic,
  TriageAssistantKbPayload,
  TriageAssistantResponse,
  WikiAssistResponse,
};

/**
 * Native-safe FastAPI /api/v1/ai/* client.
 * Exclusively uses authenticated FastAPI endpoints with server-enforced AI quotas,
 * rate limits, audit logs, and human-approval guardrails (zero Express dependencies).
 */
export function createAiApi(http: ScribbleHttpClient) {
  return {
    triageIncident(payload: {
      id?: string;
      title: string;
      description: string;
      category?: string;
      priority?: string;
      affectedCI?: string;
      recentActivity?: string[];
      availableQueues?: string[];
    }): Promise<IncidentTriageResponse> {
      return http.request<IncidentTriageResponse>('/ai/triage-incident', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },

    runTriageAssistant(payload: {
      id: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      category: string;
      assignmentGroup?: string;
      affectedCI?: string;
      slaDeadline?: string;
      recentActivity?: string[];
      kbArticles?: TriageAssistantKbPayload[];
    }): Promise<TriageAssistantResponse> {
      return http.request<TriageAssistantResponse>('/ai/triage-assistant', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },

    assessChange(payload: {
      id?: string;
      title: string;
      type: string;
      reason: string;
      implementationPlan: string;
      rollbackPlan: string;
      testPlan: string;
    }): Promise<ChangeAssessResponse> {
      return http.request<ChangeAssessResponse>('/ai/assess-change', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },

    draftKbArticle(payload: {
      topic: string;
      category?: string;
      sourceIncidentTitle?: string;
      sourceIncidentDescription?: string;
      sourceResolution?: string;
    }): Promise<DraftKbResponse> {
      return http.request<DraftKbResponse>('/ai/draft-kb', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },

    assistWiki(payload: {
      query: string;
      mode?: 'research' | 'draft' | 'improve' | 'summarize';
      existingTitle?: string;
      existingContent?: string;
      existingSection?: string;
    }): Promise<WikiAssistResponse> {
      return http.request<WikiAssistResponse>('/ai/wiki-assist', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },

    askCopilot(payload: {
      message: string;
      history?: CopilotTurnMessage[];
      tenantContext: string;
    }): Promise<CopilotResponse> {
      return http.request<CopilotResponse>('/ai/copilot', {
        method: 'POST',
        body: payload,
        timeoutMs: 35000,
      });
    },
  };
}

export const aiApi = createAiApi(defaultHttpClient);
