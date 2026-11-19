import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';

export const GEMINI_WIKI_MODEL = 'gemini-4-hydrogen';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable AI capabilities.'
    );
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedApiKey = apiKey;
  }

  return cachedClient;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface WikiGroundingResult {
  summary: string;
  sources: GroundingSource[];
  searchQueries: string[];
  model: string;
  generatedAt: string;
}

export type WikiGroundingMode = 'documentation_update' | 'industry_news' | 'page_refresh';

export interface WikiGroundingInput {
  query: string;
  mode: WikiGroundingMode;
  existingTitle?: string;
  existingSection?: string;
  existingContent?: string;
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|500|502|503|504|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT/i.test(message);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableError(err)) {
        throw err;
      }
      const delayMs = Math.min(4000, 500 * Math.pow(2, attempt - 1));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function runWikiSearchGrounding(input: WikiGroundingInput): Promise<WikiGroundingResult> {
  const ai = getGeminiClient();
  const todayIso = new Date().toISOString().split('T')[0];

  let systemInstruction =
    'You are an enterprise IT engineering documentation specialist for Scribble IT System Wiki. ' +
    `Today's date is ${todayIso}. Use Google Search grounding to retrieve verified, up-to-date facts, version numbers, security advisories, vendor documentation changes, and dates. ` +
    'Format output in concise, structured plain markdown suitable for an engineering wiki (use clear headings, bullet points, exact version/CVE identifiers, and concrete remediation or operational steps). ' +
    'Never invent URLs, CVE numbers, or version numbers not supported by search results.';

  let prompt = '';
  if (input.mode === 'page_refresh') {
    prompt =
      `Review the following internal IT wiki page and verify it against current real-world documentation, releases, and advisories as of ${todayIso}.\n\n` +
      `Page Title: ${input.existingTitle || 'Untitled'}\n` +
      `Section: ${input.existingSection || 'General'}\n` +
      `Focus / Verification Query: ${input.query || input.existingTitle || 'Latest technical updates and best practices'}\n\n` +
      `Current Wiki Content:\n---\n${(input.existingContent || '').slice(0, 6000)}\n---\n\n` +
      `Provide:\n` +
      `1. **Current Status & What Changed**: Recent official updates, deprecations, CVEs, or version milestones relevant to this page.\n` +
      `2. **Recommended Wiki Additions / Corrections**: Ready-to-paste markdown section to bring the documentation up to date.\n` +
      `3. **Operational Action Items**: Concrete checklist items for the IT/SRE team.`;
  } else if (input.mode === 'industry_news') {
    systemInstruction +=
      ' Focus on recent IT industry news, critical CVEs/security advisories, cloud/infrastructure outages or deprecations, and vendor platform updates.';
    prompt =
      `Provide a real-time IT industry & security briefing grounded in current web sources as of ${todayIso} for the topic:\n` +
      `"${input.query}"\n\n` +
      `Include:\n` +
      `1. **Key Developments & Dates**: Most recent verified updates, advisories, or releases.\n` +
      `2. **Enterprise Impact & Risk Assessment**: What IT operations, infrastructure, or security teams should monitor.\n` +
      `3. **Recommended Actions**: Concrete verification, patching, or runbook steps.`;
  } else {
    prompt =
      `Research and synthesize up-to-date technical IT documentation as of ${todayIso} for:\n` +
      `"${input.query}"\n\n` +
      `Include:\n` +
      `1. **Current Official Guidance & Versions**: Verified standards, supported versions, and configuration changes.\n` +
      `2. **Runbook / SOP Reference Notes**: Clear technical steps or configuration recommendations ready for an engineering wiki.\n` +
      `3. **Deprecations & Caveats**: Any breaking changes, EOL dates, or common pitfalls.`;
  }

  const response: GenerateContentResponse = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    })
  );

  const summary = (response.text || '').trim();
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const rawChunks = metadata?.groundingChunks || [];

  const seenUris = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of rawChunks) {
    const uri = chunk?.web?.uri?.trim();
    const title = chunk?.web?.title?.trim() || uri || 'Verified Source';
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      sources.push({ title, uri });
    }
  }

  const searchQueries = Array.isArray(metadata?.webSearchQueries)
    ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : [];

  return {
    summary,
    sources,
    searchQueries,
    model: GEMINI_WIKI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 1. INCIDENT AI TRIAGE & RESOLUTION DRAFT
// ==========================================

export interface IncidentTriageInput {
  id?: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  affectedCI?: string;
  recentActivity?: string[];
  availableQueues?: string[];
}

export interface IncidentTriageResult {
  recommendedPriority: 'P1' | 'P2' | 'P3' | 'P4';
  recommendedCategory: 'hardware' | 'software' | 'network' | 'access' | 'security' | 'telephony';
  suggestedQueue: string;
  rootCauseHypothesis: string;
  diagnosticSteps: string[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  generatedAt: string;
}

export async function triageIncidentWithAi(input: IncidentTriageInput): Promise<IncidentTriageResult> {
  const ai = getGeminiClient();
  const queueList =
    input.availableQueues && input.availableQueues.length > 0
      ? input.availableQueues.join(', ')
      : 'Service Desk L1, Service Desk L2, Network & Firewall Ops, Cloud SRE & Platform, IAM & Identity Operations, Endpoint & Hardware Support, SecOps & Threat Response, Telephony & UC Ops';

  const prompt =
    `Analyze this IT incident and provide structured ITIL v4 ticket routing and triage guidance.\n\n` +
    `Ticket ID: ${input.id || 'NEW'}\n` +
    `Title: ${input.title}\n` +
    `Description: ${input.description || 'No detailed description provided.'}\n` +
    `Current Category: ${input.category || 'unspecified'}\n` +
    `Current Priority: ${input.priority || 'unspecified'}\n` +
    `Affected CI: ${input.affectedCI || 'None'}\n` +
    `Available Assignment Groups (prefer picking the closest exact match from this list): ${queueList}\n` +
    (input.recentActivity && input.recentActivity.length > 0
      ? `Recent Activity:\n${input.recentActivity.slice(-5).join('\n')}\n`
      : '');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an experienced L3 SRE and ITIL Incident Manager for Scribble IT. Provide crisp, technical, actionable triage analysis, diagnostic steps, and draft communication.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedPriority: {
              type: Type.STRING,
              description: 'One of P1, P2, P3, or P4 based on blast radius and urgency.',
            },
            recommendedCategory: {
              type: Type.STRING,
              description: 'One of hardware, software, network, access, security, or telephony.',
            },
            suggestedQueue: {
              type: Type.STRING,
              description: 'Recommended assignment group such as L2 Network Ops, IAM & Identity, L3 Cloud SRE, Endpoint Engineering, or SecOps.',
            },
            rootCauseHypothesis: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence technical root cause hypothesis.',
            },
            diagnosticSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 specific technical verification or remediation steps.',
            },
            draftResolutionNote: {
              type: Type.STRING,
              description: 'Concise engineering resolution/work note draft.',
            },
            draftCustomerReply: {
              type: Type.STRING,
              description: 'Polite, reassuring update message ready to send to the requester.',
            },
          },
          required: [
            'recommendedPriority',
            'recommendedCategory',
            'suggestedQueue',
            'rootCauseHypothesis',
            'diagnosticSteps',
            'draftResolutionNote',
            'draftCustomerReply',
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text || '{}').trim());
  const validPriorities = ['P1', 'P2', 'P3', 'P4'] as const;
  const validCategories = ['hardware', 'software', 'network', 'access', 'security', 'telephony'] as const;

  const recommendedPriority = validPriorities.includes(parsed.recommendedPriority)
    ? parsed.recommendedPriority
    : 'P3';
  const recommendedCategory = validCategories.includes(parsed.recommendedCategory)
    ? parsed.recommendedCategory
    : 'software';

  return {
    recommendedPriority,
    recommendedCategory,
    suggestedQueue: String(parsed.suggestedQueue || 'Service Desk L2'),
    rootCauseHypothesis: String(parsed.rootCauseHypothesis || ''),
    diagnosticSteps: Array.isArray(parsed.diagnosticSteps) ? parsed.diagnosticSteps.map(String) : [],
    draftResolutionNote: String(parsed.draftResolutionNote || ''),
    draftCustomerReply: String(parsed.draftCustomerReply || ''),
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 2. CHANGE ADVISORY BOARD (CAB) RISK ADVISOR
// ==========================================

export interface ChangeAssessInput {
  id?: string;
  title: string;
  type: string;
  reason: string;
  implementationPlan: string;
  rollbackPlan: string;
  testPlan: string;
}

export interface ChangeAssessResult {
  assessedRisk: 'low' | 'medium' | 'high' | 'critical';
  readinessScore: number;
  riskFindings: string[];
  missingControls: string[];
  recommendedCabGuidance: string;
  generatedAt: string;
}

export async function assessChangeWithAi(input: ChangeAssessInput): Promise<ChangeAssessResult> {
  const ai = getGeminiClient();

  const prompt =
    `Evaluate this ITIL Change Request (RFC) for Change Advisory Board (CAB) readiness and operational risk.\n\n` +
    `RFC ID: ${input.id || 'NEW'}\n` +
    `Title: ${input.title}\n` +
    `Change Type: ${input.type}\n` +
    `Technical Justification: ${input.reason || 'Not specified'}\n` +
    `Implementation Plan: ${input.implementationPlan || 'Not specified'}\n` +
    `Rollback Plan: ${input.rollbackPlan || 'Not specified'}\n` +
    `Validation / Test Plan: ${input.testPlan || 'Not specified'}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a Principal Change Advisory Board (CAB) Chair and Release Governance Engineer. Critically review implementation steps, rollback safety, blast radius, and validation criteria.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assessedRisk: {
              type: Type.STRING,
              description: 'One of low, medium, high, or critical.',
            },
            readinessScore: {
              type: Type.INTEGER,
              description: 'CAB readiness score from 0 to 100 based on completeness of implementation, rollback, and test plans.',
            },
            riskFindings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 4 concise technical risks identified in the RFC.',
            },
            missingControls: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '1 to 4 missing safeguards, observability checks, or rollback prerequisites.',
            },
            recommendedCabGuidance: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence CAB sign-off condition or approval guidance.',
            },
          },
          required: ['assessedRisk', 'readinessScore', 'riskFindings', 'missingControls', 'recommendedCabGuidance'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text || '{}').trim());
  const validRisks = ['low', 'medium', 'high', 'critical'] as const;
  const assessedRisk = validRisks.includes(parsed.assessedRisk) ? parsed.assessedRisk : 'medium';
  const rawScore = Number(parsed.readinessScore);
  const readinessScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 70;

  return {
    assessedRisk,
    readinessScore,
    riskFindings: Array.isArray(parsed.riskFindings) ? parsed.riskFindings.map(String) : [],
    missingControls: Array.isArray(parsed.missingControls) ? parsed.missingControls.map(String) : [],
    recommendedCabGuidance: String(parsed.recommendedCabGuidance || ''),
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 3. KNOWLEDGE BASE RUNBOOK DRAFTER
// ==========================================

export interface DraftKbInput {
  topic: string;
  category?: string;
  sourceIncidentTitle?: string;
  sourceIncidentDescription?: string;
  sourceResolution?: string;
}

export interface DraftKbResult {
  title: string;
  category: string;
  tags: string[];
  content: string;
  generatedAt: string;
}

export async function draftKbArticleWithAi(input: DraftKbInput): Promise<DraftKbResult> {
  const ai = getGeminiClient();

  const prompt =
    `Draft a structured, production-ready IT Knowledge Base article / SOP runbook.\n\n` +
    `Topic / Request: ${input.topic}\n` +
    `Preferred Category: ${input.category || 'Operations'}\n` +
    (input.sourceIncidentTitle ? `Source Incident Title: ${input.sourceIncidentTitle}\n` : '') +
    (input.sourceIncidentDescription ? `Symptoms: ${input.sourceIncidentDescription}\n` : '') +
    (input.sourceResolution ? `Resolution Applied: ${input.sourceResolution}\n` : '');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You write clean, concise ITIL knowledge articles and operational runbooks with Overview, Symptoms/Prerequisites, Step-by-Step Procedure, and Verification sections.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Clear searchable KB title.' },
            category: { type: Type.STRING, description: 'Concise ITSM category such as Operations, Security, Network, Identity, or Endpoint.' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 short uppercase/lowercase search tags.',
            },
            content: { type: Type.STRING, description: 'Structured plain markdown runbook body.' },
          },
          required: ['title', 'category', 'tags', 'content'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text || '{}').trim());
  return {
    title: String(parsed.title || input.topic),
    category: String(parsed.category || input.category || 'Operations'),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : ['ITSM'],
    content: String(parsed.content || ''),
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 4. SCRIBBLE IT OPERATIONS COPILOT CHAT
// ==========================================

export interface CopilotTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotInput {
  message: string;
  history?: CopilotTurnMessage[];
  tenantContext: string;
}

export interface CopilotResult {
  reply: string;
  model: string;
  generatedAt: string;
}

export async function runItsmCopilotTurn(input: CopilotInput): Promise<CopilotResult> {
  const ai = getGeminiClient();

  const systemInstruction =
    'You are the Scribble IT Operations Copilot embedded in a multi-tenant Enterprise ITSM suite (Njure Tech). ' +
    'You assist IT engineers, SREs, IAM officers, and administrators with incident triage, CAB risk analysis, workflow design, root-cause reasoning, and executive status summaries. ' +
    'Base workspace-specific answers strictly on the live Tenant Operational Snapshot provided below—never fabricate ticket IDs, metrics, or assets not present in the snapshot. ' +
    'Keep responses concise, structured, and technical.\n\n' +
    `=== LIVE TENANT SNAPSHOT ===\n${input.tenantContext.slice(0, 8000)}`;

  const contents = [
    ...(input.history || []).slice(-10).map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: input.message }],
    },
  ];

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents,
      config: {
        systemInstruction,
      },
    })
  );

  return {
    reply: (response.text || '').trim(),
    model: GEMINI_WIKI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 5. REAL-TIME INCIDENT TRIAGE ASSISTANT SIDEBAR (SUMMARY + KB MATCHING)
// ==========================================

export interface TriageAssistantKbCandidate {
  id: string;
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
}

export interface TriageAssistantInput {
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
  kbArticles?: TriageAssistantKbCandidate[];
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

export interface TriageAssistantResult {
  realTimeSummary: string;
  urgencySignal: 'critical' | 'elevated' | 'normal';
  slaAssessment: string;
  recommendedPriority: 'P1' | 'P2' | 'P3' | 'P4';
  recommendedCategory: 'hardware' | 'software' | 'network' | 'access' | 'security' | 'telephony';
  suggestedQueue: string;
  rootCauseHypothesis: string;
  nextSteps: string[];
  matchedKbArticles: MatchedKbSuggestion[];
  suggestedNewKbTopics: SuggestedNewKbTopic[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  model: string;
  generatedAt: string;
}

export async function runIncidentTriageAssistant(
  input: TriageAssistantInput
): Promise<TriageAssistantResult> {
  const ai = getGeminiClient();

  const kbPool = (input.kbArticles || []).slice(0, 20);
  const kbCatalogText =
    kbPool.length > 0
      ? kbPool
          .map(
            kb =>
              `- [${kb.id}] (${kb.category}) "${kb.title}" | Tags: ${kb.tags.join(', ') || 'none'} | Excerpt: ${kb.excerpt.slice(0, 260)}`
          )
          .join('\n')
      : 'No existing Knowledge Base articles are currently published in this tenant.';

  const slaInfo = input.slaDeadline
    ? `SLA Deadline: ${input.slaDeadline} (Current UTC: ${new Date().toISOString()})`
    : 'SLA Deadline: Not specified';

  const prompt =
    `Provide a real-time Incident Triage Assistant briefing for the currently selected IT incident, and match relevant Knowledge Base articles.\n\n` +
    `=== SELECTED INCIDENT ===\n` +
    `Ticket ID: ${input.id}\n` +
    `Title: ${input.title}\n` +
    `Status: ${input.status}\n` +
    `Priority: ${input.priority}\n` +
    `Category: ${input.category}\n` +
    `Assignment Group: ${input.assignmentGroup || 'Unassigned'}\n` +
    `Affected CI: ${input.affectedCI || 'None linked'}\n` +
    `${slaInfo}\n` +
    `Description:\n${input.description || 'No detailed description provided.'}\n\n` +
    (input.recentActivity && input.recentActivity.length > 0
      ? `Recent Activity Log:\n${input.recentActivity.slice(-6).join('\n')}\n\n`
      : '') +
    `=== TENANT KNOWLEDGE BASE CATALOG ===\n${kbCatalogText}\n\n` +
    `Instructions:\n` +
    `1. Write a concise realTimeSummary (2-3 crisp sentences) summarizing the issue, current progress, and operational impact.\n` +
    `2. Assess SLA risk in slaAssessment and classify urgencySignal.\n` +
    `3. Match up to 3 relevant articles from the TENANT KNOWLEDGE BASE CATALOG ONLY using their exact kbId. If none are relevant, return an empty array for matchedKbArticles.\n` +
    `4. Always suggest 1-2 targeted new KB runbook articles in suggestedNewKbTopics that would directly help resolve or prevent this incident (with a practical short markdown draftBody).`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_WIKI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are the Scribble IT Real-Time Triage Assistant embedded alongside ITIL incident records. ' +
          'Be concise, technical, and immediately actionable. Never fabricate internal KB IDs outside the provided catalog.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            realTimeSummary: {
              type: Type.STRING,
              description: '2-3 sentence real-time operational summary of incident symptoms, status, and blast radius.',
            },
            urgencySignal: {
              type: Type.STRING,
              description: 'One of critical, elevated, or normal.',
            },
            slaAssessment: {
              type: Type.STRING,
              description: 'Short 1-sentence SLA exposure assessment.',
            },
            recommendedPriority: {
              type: Type.STRING,
              description: 'One of P1, P2, P3, or P4.',
            },
            recommendedCategory: {
              type: Type.STRING,
              description: 'One of hardware, software, network, access, security, or telephony.',
            },
            suggestedQueue: {
              type: Type.STRING,
              description: 'Recommended assignment group.',
            },
            rootCauseHypothesis: {
              type: Type.STRING,
              description: 'Concise technical root cause hypothesis.',
            },
            nextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 specific diagnostic or remediation steps.',
            },
            matchedKbArticles: {
              type: Type.ARRAY,
              description: 'Relevant KB articles strictly from the provided catalog.',
              items: {
                type: Type.OBJECT,
                properties: {
                  kbId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  relevanceReason: { type: Type.STRING },
                  matchConfidence: { type: Type.STRING, description: 'high, medium, or low' },
                },
                required: ['kbId', 'title', 'relevanceReason', 'matchConfidence'],
              },
            },
            suggestedNewKbTopics: {
              type: Type.ARRAY,
              description: '1 to 2 recommended KB runbook articles tailored to this incident.',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  draftBody: { type: Type.STRING },
                },
                required: ['title', 'category', 'summary', 'draftBody'],
              },
            },
            draftResolutionNote: {
              type: Type.STRING,
              description: 'Concise engineering resolution note draft.',
            },
            draftCustomerReply: {
              type: Type.STRING,
              description: 'Polite, concise customer status update draft.',
            },
          },
          required: [
            'realTimeSummary',
            'urgencySignal',
            'slaAssessment',
            'recommendedPriority',
            'recommendedCategory',
            'suggestedQueue',
            'rootCauseHypothesis',
            'nextSteps',
            'matchedKbArticles',
            'suggestedNewKbTopics',
            'draftResolutionNote',
            'draftCustomerReply',
          ],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text || '{}').trim());
  const validUrgencies = ['critical', 'elevated', 'normal'] as const;
  const validPriorities = ['P1', 'P2', 'P3', 'P4'] as const;
  const validCategories = ['hardware', 'software', 'network', 'access', 'security', 'telephony'] as const;
  const validConfidences = ['high', 'medium', 'low'] as const;

  const kbIdSet = new Set(kbPool.map(k => k.id));
  const rawMatched = Array.isArray(parsed.matchedKbArticles) ? parsed.matchedKbArticles : [];
  const matchedKbArticles: MatchedKbSuggestion[] = rawMatched
    .filter((item: Record<string, unknown>) => item && typeof item.kbId === 'string' && kbIdSet.has(item.kbId))
    .slice(0, 3)
    .map((item: Record<string, unknown>) => {
      const kbMatch = kbPool.find(k => k.id === item.kbId);
      const conf = String(item.matchConfidence || 'medium').toLowerCase();
      return {
        kbId: String(item.kbId),
        title: kbMatch?.title || String(item.title || 'Knowledge Article'),
        relevanceReason: String(item.relevanceReason || 'Matches incident symptoms and operational category.'),
        matchConfidence: validConfidences.includes(conf as 'high' | 'medium' | 'low')
          ? (conf as 'high' | 'medium' | 'low')
          : 'medium',
      };
    });

  const rawTopics = Array.isArray(parsed.suggestedNewKbTopics) ? parsed.suggestedNewKbTopics : [];
  const suggestedNewKbTopics: SuggestedNewKbTopic[] = rawTopics.slice(0, 2).map((t: Record<string, unknown>) => ({
    title: String(t?.title || `Runbook: ${input.title}`),
    category: String(t?.category || input.category || 'Operations'),
    summary: String(t?.summary || 'Recommended operational runbook for this incident class.'),
    draftBody: String(t?.draftBody || ''),
  }));

  return {
    realTimeSummary: String(parsed.realTimeSummary || ''),
    urgencySignal: validUrgencies.includes(parsed.urgencySignal) ? parsed.urgencySignal : 'normal',
    slaAssessment: String(parsed.slaAssessment || 'Monitor SLA resolution target.'),
    recommendedPriority: validPriorities.includes(parsed.recommendedPriority) ? parsed.recommendedPriority : 'P3',
    recommendedCategory: validCategories.includes(parsed.recommendedCategory) ? parsed.recommendedCategory : 'software',
    suggestedQueue: String(parsed.suggestedQueue || 'Service Desk L2'),
    rootCauseHypothesis: String(parsed.rootCauseHypothesis || ''),
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(String) : [],
    matchedKbArticles,
    suggestedNewKbTopics,
    draftResolutionNote: String(parsed.draftResolutionNote || ''),
    draftCustomerReply: String(parsed.draftCustomerReply || ''),
    model: GEMINI_WIKI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

