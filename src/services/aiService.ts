import type { IncidentCategory, IncidentPriority, RiskLevel } from '../types/itsm';
import { apiUrl, parseApiJson } from '../utils/apiClient';
import { apiRequest, getAccessToken, isBackendApiConfigured } from './api/httpClient';

export interface IncidentTriageResponse {
  recommendedPriority: IncidentPriority;
  recommendedCategory: IncidentCategory;
  suggestedQueue: string;
  rootCauseHypothesis: string;
  diagnosticSteps: string[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface ChangeAssessResponse {
  assessedRisk: RiskLevel;
  readinessScore: number;
  riskFindings: string[];
  missingControls: string[];
  recommendedCabGuidance: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface DraftKbResponse {
  title: string;
  category: string;
  tags: string[];
  content: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface WikiAssistResponse {
  summary: string;
  sources: Array<{ title: string; uri: string }>;
  searchQueries: string[];
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface CopilotTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotResponse {
  reply: string;
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface MatchedKbSuggestion {
  kbId: string;
  title: string;
  relevanceReason: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export interface SuggestedNewKbTopic {
  title: string;
  category: string;
  summary: string;
  draftBody: string;
}

export interface TriageAssistantResponse {
  realTimeSummary: string;
  urgencySignal: 'critical' | 'elevated' | 'normal';
  slaAssessment: string;
  recommendedPriority: IncidentPriority;
  recommendedCategory: IncidentCategory;
  suggestedQueue: string;
  rootCauseHypothesis: string;
  nextSteps: string[];
  matchedKbArticles: MatchedKbSuggestion[];
  suggestedNewKbTopics: SuggestedNewKbTopic[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface TriageAssistantKbPayload {
  id: string;
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
}

async function postAiJson<TReq, TRes>(
  legacyUrl: string,
  fastApiPath: string,
  payload: TReq,
): Promise<TRes> {
  // Prefer authenticated, quota-enforced FastAPI /api/v1/ai/* whenever backend session is active
  if (isBackendApiConfigured() && getAccessToken()) {
    return apiRequest<TRes>(fastApiPath, {
      method: 'POST',
      body: payload,
      timeoutMs: 35000,
    });
  }

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
  }) {
    return postAiJson<typeof payload, IncidentTriageResponse>(
      '/api/ai/triage-incident',
      '/ai/triage-incident',
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
  }) {
    return postAiJson<typeof payload, TriageAssistantResponse>(
      '/api/ai/triage-assistant',
      '/ai/triage-assistant',
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
  }) {
    return postAiJson<typeof payload, ChangeAssessResponse>(
      '/api/ai/assess-change',
      '/ai/assess-change',
      payload,
    );
  },

  draftKbArticle(payload: {
    topic: string;
    category?: string;
    sourceIncidentTitle?: string;
    sourceIncidentDescription?: string;
    sourceResolution?: string;
  }) {
    return postAiJson<typeof payload, DraftKbResponse>(
      '/api/ai/draft-kb',
      '/ai/draft-kb',
      payload,
    );
  },

  assistWiki(payload: {
    query: string;
    mode?: 'research' | 'draft' | 'improve' | 'summarize';
    existingTitle?: string;
    existingContent?: string;
    existingSection?: string;
  }) {
    return postAiJson<typeof payload, WikiAssistResponse>(
      '/api/ai/wiki-assist',
      '/ai/wiki-assist',
      payload,
    );
  },

  askCopilot(payload: {
    message: string;
    history?: CopilotTurnMessage[];
    tenantContext: string;
  }) {
    return postAiJson<typeof payload, CopilotResponse>(
      '/api/ai/copilot',
      '/ai/copilot',
      payload,
    );
  },
};

