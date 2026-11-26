import {
  aiApi,
  getAccessToken,
  isBackendApiConfigured,
} from '@scribble-it/api-client';
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
import { apiUrl, parseApiJson } from '../utils/apiClient';

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

async function postWebAiFallback<TReq, TRes>(legacyUrl: string, payload: TReq): Promise<TRes> {
  const res = await fetch(apiUrl(legacyUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson<TRes & { error?: string }>(res, 'AI Service');
  if (!res.ok) {
    throw new Error(data?.error || `AI request failed (${res.status})`);
  }
  return data as TRes;
}

function shouldUseFastApi(): boolean {
  return isBackendApiConfigured() && Boolean(getAccessToken());
}

/**
 * Web-facing AI service wrapper.
 * Routes through the shared FastAPI `/api/v1/ai/*` client (`@scribble-it/api-client`)
 * whenever an authenticated backend session is active, while preserving local web dev
 * compatibility without leaking Express routes into shared native packages.
 */
export const aiService = {
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
    if (shouldUseFastApi()) {
      return aiApi.triageIncident(payload);
    }
    return postWebAiFallback<typeof payload, IncidentTriageResponse>(
      '/api/ai/triage-incident',
      payload,
    );
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
    if (shouldUseFastApi()) {
      return aiApi.runTriageAssistant(payload);
    }
    return postWebAiFallback<typeof payload, TriageAssistantResponse>(
      '/api/ai/triage-assistant',
      payload,
    );
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
    if (shouldUseFastApi()) {
      return aiApi.assessChange(payload);
    }
    return postWebAiFallback<typeof payload, ChangeAssessResponse>(
      '/api/ai/assess-change',
      payload,
    );
  },

  draftKbArticle(payload: {
    topic: string;
    category?: string;
    sourceIncidentTitle?: string;
    sourceIncidentDescription?: string;
    sourceResolution?: string;
  }): Promise<DraftKbResponse> {
    if (shouldUseFastApi()) {
      return aiApi.draftKbArticle(payload);
    }
    return postWebAiFallback<typeof payload, DraftKbResponse>('/api/ai/draft-kb', payload);
  },

  assistWiki(payload: {
    query: string;
    mode?: 'research' | 'draft' | 'improve' | 'summarize';
    existingTitle?: string;
    existingContent?: string;
    existingSection?: string;
  }): Promise<WikiAssistResponse> {
    if (shouldUseFastApi()) {
      return aiApi.assistWiki(payload);
    }
    return postWebAiFallback<typeof payload, WikiAssistResponse>('/api/ai/wiki-assist', payload);
  },

  askCopilot(payload: {
    message: string;
    history?: CopilotTurnMessage[];
    tenantContext: string;
  }): Promise<CopilotResponse> {
    if (shouldUseFastApi()) {
      return aiApi.askCopilot(payload);
    }
    return postWebAiFallback<typeof payload, CopilotResponse>('/api/ai/copilot', payload);
  },
};
