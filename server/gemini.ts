import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

export const GEMINI_WIKI_MODEL = 'gemini-4-hydrogen';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable live Google Search grounding.'
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
