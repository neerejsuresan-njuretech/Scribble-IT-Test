import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident } from '../../types/itsm';
import { useITSM } from '../../context/ITSMContext';
import {
  aiService,
  type TriageAssistantResponse,
  type SuggestedNewKbTopic,
} from '../../services/aiService';
import {
  Sparkles,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FilePlus2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Send,
  ShieldAlert,
  Clock,
  FileText,
} from 'lucide-react';

interface TriageAssistantSidebarProps {
  incident: Incident;
  onApplyResolution: (draft: string) => void;
  className?: string;
}

export const TriageAssistantSidebar: React.FC<TriageAssistantSidebarProps> = ({
  incident,
  onApplyResolution,
  className = '',
}) => {
  const navigate = useNavigate();
  const { kbArticles, addRecordActivity, createKbArticle, showToast } = useITSM();

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TriageAssistantResponse | null>(null);

  const [expandedKbIds, setExpandedKbIds] = useState<Record<string, boolean>>({});
  const [expandedDraftIdx, setExpandedDraftIdx] = useState<Record<number, boolean>>({});
  const [publishedDraftKeys, setPublishedDraftKeys] = useState<Record<string, boolean>>({});

  // In-memory cache keyed by incident id + updatedAt + kb count so switching tickets is instant
  const cacheRef = useRef<Map<string, TriageAssistantResponse>>(new Map());
  const requestSeqRef = useRef(0);

  const cacheKey = `${incident.id}:${incident.updatedAt}:${kbArticles.length}`;

  const runAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        setResult(cacheRef.current.get(cacheKey) || null);
        setErrorMsg(null);
        setIsLoading(false);
        return;
      }

      const seq = ++requestSeqRef.current;
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const kbPayload = kbArticles.slice(0, 20).map(article => ({
          id: article.id,
          title: article.title,
          category: article.category,
          tags: article.tags || [],
          excerpt: article.content.slice(0, 320),
        }));

        const data = await aiService.runTriageAssistant({
          id: incident.id,
          title: incident.title,
          description: incident.description,
          priority: incident.priority,
          status: incident.status,
          category: incident.category,
          assignmentGroup: incident.assignmentGroup,
          affectedCI: incident.affectedCI,
          slaDeadline: incident.slaDeadline,
          recentActivity: incident.activityLog.slice(-6).map(a => `[${a.action}] ${a.author}: ${a.note}`),
          kbArticles: kbPayload,
        });

        if (seq !== requestSeqRef.current) return;
        cacheRef.current.set(cacheKey, data);
        setResult(data);
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        const msg = err instanceof Error ? err.message : 'Unable to reach Gemini Triage Assistant.';
        setErrorMsg(msg);
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [cacheKey, incident, kbArticles]
  );

  // Trigger real-time analysis when selected incident changes
  useEffect(() => {
    setExpandedKbIds({});
    setExpandedDraftIdx({});

    if (cacheRef.current.has(cacheKey)) {
      setResult(cacheRef.current.get(cacheKey) || null);
      setErrorMsg(null);
      setIsLoading(false);
      return;
    }

    if (autoAnalyze) {
      setResult(null);
      void runAnalysis(false);
    } else {
      setResult(null);
      setErrorMsg(null);
      setIsLoading(false);
    }
  }, [cacheKey, autoAnalyze, runAnalysis]);

  const handleCiteKb = (kbId: string, kbTitle: string, reason: string) => {
    addRecordActivity(
      incident.id,
      'incident',
      `Referenced Knowledge Base Article [${kbId}] "${kbTitle}"\nRelevance: ${reason}`,
      'work_note',
      'KB_LINKED'
    );
  };

  const handlePublishSuggestedKb = (topic: SuggestedNewKbTopic, idx: number) => {
    const key = `${incident.id}-${idx}-${topic.title}`;
    createKbArticle({
      title: topic.title,
      category: topic.category || incident.category.toUpperCase(),
      visibility: 'internal',
      tags: ['AI-TRIAGE', incident.priority, incident.category.toUpperCase()],
      content:
        topic.draftBody?.trim() ||
        `## Summary\n${topic.summary}\n\n### Source Incident\nDerived from ${incident.id} (${incident.title}).`,
    });
    setPublishedDraftKeys(prev => ({ ...prev, [key]: true }));
  };

  const handleLogSummaryWorkNote = () => {
    if (!result) return;
    const stepsText = result.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    addRecordActivity(
      incident.id,
      'incident',
      `AI Triage Summary: ${result.realTimeSummary}\n\nRoot Cause Hypothesis: ${result.rootCauseHypothesis}\nRecommended Queue: ${result.suggestedQueue} (${result.recommendedPriority})\n\nDiagnostic Steps:\n${stepsText}`,
      'work_note',
      'AI_TRIAGE'
    );
  };

  const handlePostCustomerUpdate = () => {
    if (!result?.draftCustomerReply) return;
    addRecordActivity(
      incident.id,
      'incident',
      result.draftCustomerReply,
      'comment',
      'Customer Update Posted'
    );
    showToast({
      variant: 'success',
      title: 'Customer update posted',
      description: `Broadcasted AI-drafted status update on ${incident.id}.`,
    });
  };

  const urgencyStyles =
    result?.urgencySignal === 'critical'
      ? 'border-rose-700/80 bg-rose-950/30 text-rose-300'
      : result?.urgencySignal === 'elevated'
      ? 'border-amber-700/80 bg-amber-950/30 text-amber-300'
      : 'border-emerald-700/80 bg-emerald-950/30 text-emerald-300';

  return (
    <div className={`flex flex-col h-full min-h-0 bg-neutral-950 text-xs ${className}`}>
      {/* Assistant Sub-header */}
      <div className="px-3.5 py-2.5 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-neutral-100">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">Triage Assistant</span>
            <span className="text-neutral-500 font-normal">·</span>
            <span className="text-sky-400 font-mono-strict tabular-nums shrink-0">{incident.id}</span>
          </div>
          <div className="text-[10px] text-neutral-500 truncate mt-0.5">
            Real-time summary &amp; KB matcher
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setAutoAnalyze(prev => !prev)}
            className={`min-h-[34px] px-2 border text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              autoAnalyze
                ? 'border-sky-700/80 bg-sky-950/40 text-sky-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-200'
            }`}
            title="Automatically analyze incident when selected"
          >
            {autoAnalyze ? 'Auto: On' : 'Auto: Off'}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void runAnalysis(true)}
            className="min-h-[34px] min-w-[34px] px-2 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center transition-colors"
            title="Refresh real-time AI analysis"
            aria-label="Refresh real-time AI analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-3.5" aria-busy="true" aria-label="Analyzing incident details">
            <div className="p-3 border border-sky-900/60 bg-sky-950/20 flex items-center gap-2.5 text-sky-300">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <div>
                <div className="font-bold">Synthesizing {incident.id}</div>
                <div className="text-[11px] text-neutral-400">
                  Scanning description, activity history, and {kbArticles.length} KB article(s)...
                </div>
              </div>
            </div>
            <div className="space-y-2 border border-neutral-800 bg-neutral-900/30 p-3">
              <div className="h-3 w-28 bg-neutral-800 rounded animate-pulse" />
              <div className="h-3 w-full bg-neutral-800/80 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-neutral-800/60 rounded animate-pulse" />
            </div>
            <div className="space-y-2 border border-neutral-800 bg-neutral-900/30 p-3">
              <div className="h-3 w-36 bg-neutral-800 rounded animate-pulse" />
              <div className="h-12 w-full bg-neutral-800/70 rounded animate-pulse" />
              <div className="h-12 w-full bg-neutral-800/50 rounded animate-pulse" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMsg && (
          <div className="p-3.5 border border-rose-800 bg-rose-950/30 space-y-2.5">
            <div className="flex items-start gap-2 text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="font-bold">Triage Assistant Unavailable</div>
                <p className="text-[11px] text-neutral-300 leading-relaxed break-words">
                  {errorMsg}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runAnalysis(true)}
              className="w-full min-h-[38px] px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-100 font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Analysis</span>
            </button>
          </div>
        )}

        {/* Manual Trigger State (when Auto is turned Off and no cached analysis exists) */}
        {!isLoading && !errorMsg && !result && (
          <div className="p-4 border border-neutral-800 bg-neutral-900/40 text-center space-y-3">
            <Sparkles className="w-5 h-5 text-sky-400 mx-auto" />
            <div className="space-y-1">
              <div className="font-bold text-neutral-100">Ready to Analyze {incident.id}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Generate a real-time executive summary, SLA risk brief, and matched Knowledge Base articles for this incident.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runAnalysis(true)}
              className="w-full min-h-[40px] px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze Incident Now</span>
            </button>
          </div>
        )}

        {/* Live AI Result */}
        {!isLoading && result && (
          <>
            {/* 1. Real-Time Incident Summary */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Real-Time Summary
                </span>
                <span className={`px-1.5 py-0.5 border text-[10px] font-bold uppercase ${urgencyStyles}`}>
                  {result.urgencySignal}
                </span>
              </div>

              <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-2.5">
                <p className="text-neutral-200 leading-relaxed">{result.realTimeSummary}</p>

                <div className="pt-2 border-t border-neutral-800/80 flex items-start gap-2 text-[11px] text-neutral-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{result.slaAssessment}</span>
                </div>
              </div>

              {/* Compact Routing Summary Strip */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div className="p-2 border border-neutral-800 bg-neutral-900/30">
                  <div className="text-[9px] text-neutral-500 uppercase">Priority</div>
                  <div className="font-bold text-neutral-100 font-mono-strict tabular-nums mt-0.5">
                    {result.recommendedPriority}
                  </div>
                </div>
                <div className="p-2 border border-neutral-800 bg-neutral-900/30">
                  <div className="text-[9px] text-neutral-500 uppercase">Category</div>
                  <div className="font-bold text-neutral-100 uppercase truncate mt-0.5">
                    {result.recommendedCategory}
                  </div>
                </div>
                <div className="p-2 border border-neutral-800 bg-neutral-900/30">
                  <div className="text-[9px] text-neutral-500 uppercase">Queue</div>
                  <div className="font-bold text-sky-300 truncate mt-0.5" title={result.suggestedQueue}>
                    {result.suggestedQueue}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Suggested Knowledge Base Articles */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Suggested KB Articles</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/knowledge')}
                  className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Browse KB</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Matched Tenant KB Articles */}
              {result.matchedKbArticles.length > 0 ? (
                <div className="space-y-2">
                  {result.matchedKbArticles.map(match => {
                    const fullKb = kbArticles.find(k => k.id === match.kbId);
                    const isExpanded = !!expandedKbIds[match.kbId];
                    return (
                      <div
                        key={match.kbId}
                        className="border border-sky-900/60 bg-sky-950/15 p-2.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                              <span className="font-mono-strict tabular-nums text-sky-400 font-bold">
                                {match.kbId}
                              </span>
                              <span>·</span>
                              <span
                                className={
                                  match.matchConfidence === 'high'
                                    ? 'text-emerald-400 font-bold uppercase'
                                    : 'text-amber-400 uppercase'
                                }
                              >
                                {match.matchConfidence} match
                              </span>
                            </div>
                            <div className="font-bold text-neutral-100 mt-0.5 leading-snug">
                              {match.title}
                            </div>
                          </div>

                          {fullKb && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedKbIds(prev => ({ ...prev, [match.kbId]: !prev[match.kbId] }))
                              }
                              className="p-1 text-neutral-400 hover:text-white shrink-0"
                              title={isExpanded ? 'Hide article preview' : 'Preview article'}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-300 leading-relaxed">
                          {match.relevanceReason}
                        </p>

                        {isExpanded && fullKb && (
                          <div className="p-2.5 border border-neutral-800 bg-neutral-950 text-[11px] text-neutral-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                            {fullKb.content}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCiteKb(match.kbId, match.title, match.relevanceReason)}
                            className="min-h-[32px] px-2.5 py-1 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                          >
                            <ClipboardCheck className="w-3 h-3 text-emerald-400" />
                            <span>Cite in Work Note</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/knowledge')}
                            className="min-h-[32px] px-2.5 py-1 border border-neutral-800 bg-neutral-950 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200 text-[10px] flex items-center gap-1 whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open in KB</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-2.5 border border-neutral-800 bg-neutral-900/30 text-[11px] text-neutral-400">
                  No direct match in existing tenant Knowledge Base. Review AI-recommended runbooks below to publish directly.
                </div>
              )}

              {/* AI-Recommended New KB Runbook Suggestions */}
              {result.suggestedNewKbTopics.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Recommended KB Runbooks
                  </div>
                  {result.suggestedNewKbTopics.map((topic, idx) => {
                    const publishKey = `${incident.id}-${idx}-${topic.title}`;
                    const isPublished = !!publishedDraftKeys[publishKey];
                    const isExpanded = !!expandedDraftIdx[idx];
                    return (
                      <div
                        key={publishKey}
                        className="border border-neutral-800 bg-neutral-900/40 p-2.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-neutral-500 uppercase">
                              {topic.category} · Suggested Draft
                            </div>
                            <div className="font-bold text-neutral-100 mt-0.5 leading-snug">
                              {topic.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDraftIdx(prev => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className="p-1 text-neutral-400 hover:text-white shrink-0"
                            title={isExpanded ? 'Hide runbook draft' : 'Preview runbook draft'}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <p className="text-[11px] text-neutral-400 leading-relaxed">{topic.summary}</p>

                        {isExpanded && topic.draftBody && (
                          <div className="p-2.5 border border-neutral-800 bg-neutral-950 text-[11px] text-neutral-300 whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
                            {topic.draftBody}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPublished}
                            onClick={() => handlePublishSuggestedKb(topic, idx)}
                            className={`min-h-[32px] px-2.5 py-1 border text-[10px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                              isPublished
                                ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                                : 'border-sky-700/80 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300'
                            }`}
                          >
                            {isPublished ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Published to KB</span>
                              </>
                            ) : (
                              <>
                                <FilePlus2 className="w-3 h-3" />
                                <span>Publish to KB</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDraftIdx(prev => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className="min-h-[32px] px-2 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 whitespace-nowrap"
                          >
                            {isExpanded ? 'Hide Draft' : 'Preview Draft'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Root Cause & Diagnostic Steps */}
            <section className="space-y-2 border-t border-neutral-800 pt-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Root Cause &amp; Next Steps</span>
              </div>

              <div className="p-2.5 border border-neutral-800 bg-neutral-900/30 text-neutral-200 leading-relaxed">
                {result.rootCauseHypothesis}
              </div>

              {result.nextSteps.length > 0 && (
                <ol className="space-y-1.5 text-[11px] text-neutral-300 list-decimal pl-4">
                  {result.nextSteps.map((step, i) => (
                    <li key={i} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* 4. Draft Communication & Quick Actions */}
            <section className="space-y-2 border-t border-neutral-800 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Quick Actions
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onApplyResolution(result.draftResolutionNote);
                    showToast({
                      variant: 'info',
                      title: 'Resolution draft inserted',
                      description: `Copied AI draft into ${incident.id} resolution notes.`,
                    });
                  }}
                  className="w-full min-h-[38px] px-3 py-1.5 border border-emerald-700/80 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 font-bold flex items-center justify-center gap-1.5 text-[11px] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Insert Resolution Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogSummaryWorkNote}
                  className="w-full min-h-[38px] px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold flex items-center justify-center gap-1.5 text-[11px] transition-colors"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                  <span>Log Triage to Work Notes</span>
                </button>

                <button
                  type="button"
                  onClick={handlePostCustomerUpdate}
                  className="w-full min-h-[38px] px-3 py-1.5 border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 font-bold flex items-center justify-center gap-1.5 text-[11px] transition-colors"
                >
                  <Send className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span>Post Customer Status Update</span>
                </button>
              </div>

              <div className="text-[10px] text-neutral-500 text-right tabular-nums pt-1">
                Updated {new Date(result.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
