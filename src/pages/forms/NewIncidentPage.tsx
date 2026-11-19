import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { IncidentPriority, IncidentCategory } from '../../types/itsm';
import { ArrowLeft, Sparkles, RefreshCw, Route, CheckCircle2, AlertCircle } from 'lucide-react';
import { aiService, type IncidentTriageResponse } from '../../services/aiService';

const STANDARD_ASSIGNMENT_GROUPS = [
  'Service Desk L1',
  'Service Desk L2',
  'Network & Firewall Ops',
  'Cloud SRE & Platform',
  'IAM & Identity Operations',
  'Endpoint & Hardware Support',
  'SecOps & Threat Response',
  'Telephony & UC Ops'
];

export const NewIncidentPage: React.FC = () => {
  const navigate = useNavigate();
  const { createIncident, assets, currentUser, activeTenant, ticketWorkflows, showToast } = useITSM();

  const availableQueues = useMemo(() => {
    const workflowQueues = ticketWorkflows.map(w => w.assignToQueue).filter(Boolean);
    const merged = [
      activeTenant.preferenceTemplate.defaultQueue,
      ...workflowQueues,
      ...STANDARD_ASSIGNMENT_GROUPS
    ].filter(Boolean);
    return Array.from(new Set(merged));
  }, [activeTenant.preferenceTemplate.defaultQueue, ticketWorkflows]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('P3');
  const [category, setCategory] = useState<IncidentCategory>('software');
  const [assignmentGroup, setAssignmentGroup] = useState<string>(activeTenant.preferenceTemplate.defaultQueue);
  const [affectedCI, setAffectedCI] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Automatic AI-powered Ticket Routing state
  const [autoRouteEnabled, setAutoRouteEnabled] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [aiRouting, setAiRouting] = useState<IncidentTriageResponse | null>(null);
  const [manualPriorityOverride, setManualPriorityOverride] = useState(false);
  const [manualGroupOverride, setManualGroupOverride] = useState(false);
  const [aiAppliedFields, setAiAppliedFields] = useState<{ priority: boolean; group: boolean; category: boolean }>({
    priority: false,
    group: false,
    category: false
  });
  const lastAnalyzedSignatureRef = useRef<string>('');

  const queueOptions = useMemo(() => {
    if (aiRouting?.suggestedQueue && !availableQueues.includes(aiRouting.suggestedQueue)) {
      return [aiRouting.suggestedQueue, ...availableQueues];
    }
    if (assignmentGroup && !availableQueues.includes(assignmentGroup)) {
      return [assignmentGroup, ...availableQueues];
    }
    return availableQueues;
  }, [availableQueues, aiRouting, assignmentGroup]);

  const applyRoutingSuggestion = (res: IncidentTriageResponse, forceApply = false) => {
    const applied = { priority: false, group: false, category: false };

    setCategory(res.recommendedCategory);
    applied.category = true;

    if (forceApply || !manualGroupOverride) {
      setAssignmentGroup(res.suggestedQueue);
      if (forceApply) setManualGroupOverride(false);
      applied.group = true;
    }

    if (forceApply || !manualPriorityOverride) {
      setPriority(res.recommendedPriority);
      if (res.recommendedPriority === 'P1') {
        setImpact('high');
        setUrgency('high');
      } else if (res.recommendedPriority === 'P2') {
        setImpact('high');
        setUrgency('medium');
      } else if (res.recommendedPriority === 'P4') {
        setImpact('low');
        setUrgency('low');
      } else {
        setImpact('medium');
        setUrgency('medium');
      }
      if (forceApply) setManualPriorityOverride(false);
      applied.priority = true;
    }

    setAiAppliedFields(applied);
  };

  const runAiTicketRouting = async (isManualTrigger = false) => {
    const combinedText = `${title.trim()} ${description.trim()}`.trim();
    if (!combinedText) {
      if (isManualTrigger) {
        showToast({
          variant: 'warning',
          title: 'Incident Description Required',
          description: 'Enter a short title or symptom description for AI routing.'
        });
      }
      return;
    }

    const signature = `${title.trim()}||${description.trim()}||${affectedCI}`;
    if (!isManualTrigger && signature === lastAnalyzedSignatureRef.current) return;

    setIsRouting(true);
    setRoutingError(null);
    lastAnalyzedSignatureRef.current = signature;

    try {
      const res = await aiService.triageIncident({
        title: title.trim() || description.trim().slice(0, 80),
        description: description.trim(),
        affectedCI: affectedCI || undefined,
        availableQueues
      });
      setAiRouting(res);
      applyRoutingSuggestion(res, isManualTrigger);

      if (isManualTrigger) {
        showToast({
          variant: 'success',
          title: `AI Routed: ${res.recommendedPriority} → ${res.suggestedQueue}`,
          description: `Category: ${res.recommendedCategory.toUpperCase()}`
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI ticket routing failed.';
      setRoutingError(msg);
      if (isManualTrigger) {
        showToast({ variant: 'error', title: 'AI Routing Failed', description: msg });
      }
    } finally {
      setIsRouting(false);
    }
  };

  // Automatically suggest assignment group & priority as description is entered
  useEffect(() => {
    if (!autoRouteEnabled) return;
    const descLen = description.trim().length;
    const totalLen = `${title.trim()} ${description.trim()}`.trim().length;
    if (descLen < 12 && totalLen < 18) return;

    const timer = setTimeout(() => {
      runAiTicketRouting(false);
    }, 950);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, title, affectedCI, autoRouteEnabled]);

  const handleSubmit = (e: React.FormEvent, createAnother = false) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const newInc = createIncident({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      assignmentGroup: assignmentGroup || activeTenant.preferenceTemplate.defaultQueue,
      assignee: assignmentGroup || activeTenant.preferenceTemplate.defaultQueue,
      affectedCI: affectedCI || undefined,
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      urgency,
      impact
    });

    if (createAnother) {
      setTitle('');
      setDescription('');
      setAffectedCI('');
      setAiRouting(null);
      setManualGroupOverride(false);
      setManualPriorityOverride(false);
      setAiAppliedFields({ priority: false, group: false, category: false });
      lastAnalyzedSignatureRef.current = '';
      setIsSubmitting(false);
    } else {
      navigate(`/incidents?id=${newInc.id}`);
    }
  };

  return (
    <div className="space-y-5 font-sans text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <Link to="/incidents" className="hover:text-neutral-300 transition-colors font-medium">Incidents</Link>
            <span>/</span>
            <span className="text-neutral-300 font-semibold">New Incident</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[10px]">{activeTenant.name}</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-100">
            Log New Incident
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/incidents"
            className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-neutral-100 transition-colors flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Incidents</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Record Form */}
      <form onSubmit={e => handleSubmit(e, false)} className="border border-neutral-800 bg-neutral-950 rounded-md p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-100">Incident Intake &amp; AI Routing</div>
            <div className="text-[11px] text-neutral-500">
              Assignment Group and Priority update automatically as you describe the incident.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer select-none px-2.5 py-1 rounded-md border border-neutral-800 bg-neutral-900/60">
              <input
                type="checkbox"
                checked={autoRouteEnabled}
                onChange={e => setAutoRouteEnabled(e.target.checked)}
                className="accent-sky-500"
              />
              <span>Auto-Suggest on Input</span>
            </label>
            <button
              type="button"
              disabled={isRouting}
              onClick={() => runAiTicketRouting(true)}
              className="px-3 py-1.5 rounded-md border border-sky-700 bg-sky-950/40 hover:bg-sky-900/60 disabled:opacity-50 text-sky-300 font-semibold flex items-center gap-1.5 text-[11px]"
            >
              {isRouting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isRouting ? 'Analyzing Symptoms...' : 'Analyze & Route Now'}</span>
            </button>
          </div>
        </div>

        {/* Short Description */}
        <div>
          <label className="text-neutral-400 font-medium block mb-1.5 text-[11px]">Short Description *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Core firewall VPN tunnel dropping packets for remote staff"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Detailed Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-neutral-400 font-medium text-[11px]">
              Incident Description &amp; Symptoms
            </label>
            {isRouting && (
              <span className="text-[11px] text-sky-400 flex items-center gap-1 font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Evaluating assignment group &amp; priority...</span>
              </span>
            )}
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe affected users/services, error codes, outage blast radius, and timestamps so AI routing can suggest the right assignment group and priority..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
          />
        </div>

        {/* AI Routing Suggestion Card */}
        {routingError && (
          <div className="p-3 rounded-md border border-rose-800 bg-rose-950/40 text-rose-300 flex items-start gap-2 text-[11px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{routingError}</span>
          </div>
        )}

        {aiRouting && (
          <div className="p-4 rounded-md border border-sky-800/80 bg-sky-950/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                <Route className="w-3.5 h-3.5" />
                <span>AI Ticket Routing Recommendation</span>
              </div>
              {(manualGroupOverride || manualPriorityOverride) && (
                <button
                  type="button"
                  onClick={() => applyRoutingSuggestion(aiRouting, true)}
                  className="px-2.5 py-1 rounded border border-sky-700 bg-sky-950/50 hover:bg-sky-900/60 text-sky-300 font-semibold text-[11px]"
                >
                  Apply Suggested Group &amp; Priority
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded border border-neutral-800 bg-neutral-950/80">
                <div className="text-[10px] text-neutral-500 uppercase">Suggested Assignment Group</div>
                <div className="text-neutral-100 font-semibold mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{aiRouting.suggestedQueue}</span>
                </div>
              </div>
              <div className="p-2.5 rounded border border-neutral-800 bg-neutral-950/80">
                <div className="text-[10px] text-neutral-500 uppercase">Suggested Priority</div>
                <div className={`font-bold font-mono mt-0.5 ${
                  aiRouting.recommendedPriority === 'P1'
                    ? 'text-rose-500'
                    : aiRouting.recommendedPriority === 'P2'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {aiRouting.recommendedPriority}
                </div>
              </div>
              <div className="p-2.5 rounded border border-neutral-800 bg-neutral-950/80">
                <div className="text-[10px] text-neutral-500 uppercase">Suggested Category</div>
                <div className="text-neutral-100 font-semibold uppercase mt-0.5">
                  {aiRouting.recommendedCategory}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-300 leading-relaxed">
              <span className="font-semibold text-neutral-200">Routing Rationale: </span>
              <span>{aiRouting.rootCauseHypothesis}</span>
            </div>
          </div>
        )}

        {/* Row 1: Caller, Category & Assignment Group */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-neutral-400 font-medium block mb-1.5 text-[11px]">Caller / Requester</label>
            <input
              type="text"
              readOnly
              value={`${currentUser.name} (${currentUser.email})`}
              className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-400 font-medium text-[11px]">Category *</label>
              {aiAppliedFields.category && (
                <span className="text-[10px] text-sky-400 font-semibold">AI Suggested</span>
              )}
            </div>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as IncidentCategory)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="software">Software / Application</option>
              <option value="hardware">Hardware / Infrastructure</option>
              <option value="network">Network / Connectivity</option>
              <option value="access">Identity &amp; Access</option>
              <option value="security">SecOps / Security Alert</option>
              <option value="telephony">Telephony &amp; UC</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-400 font-medium text-[11px]">Assignment Group *</label>
              {aiAppliedFields.group && !manualGroupOverride && (
                <span className="text-[10px] text-sky-400 font-semibold">AI Routed</span>
              )}
            </div>
            <select
              value={assignmentGroup}
              onChange={e => {
                setAssignmentGroup(e.target.value);
                setManualGroupOverride(true);
              }}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 font-medium px-3 py-2 focus:outline-none focus:border-sky-500"
            >
              {queueOptions.map(q => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Impact, Urgency, Priority Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-neutral-400 font-medium block mb-1.5 text-[11px]">Impact</label>
            <select
              value={impact}
              onChange={e => {
                const val = e.target.value as 'low' | 'medium' | 'high';
                setImpact(val);
                setManualPriorityOverride(true);
                if (val === 'high' && urgency === 'high') setPriority('P1');
                else if (val === 'high' || urgency === 'high') setPriority('P2');
                else setPriority('P3');
              }}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="low">Low Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="high">High Impact</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 font-medium block mb-1.5 text-[11px]">Urgency</label>
            <select
              value={urgency}
              onChange={e => {
                const val = e.target.value as 'low' | 'medium' | 'high';
                setUrgency(val);
                setManualPriorityOverride(true);
                if (impact === 'high' && val === 'high') setPriority('P1');
                else if (impact === 'high' || val === 'high') setPriority('P2');
                else setPriority('P3');
              }}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="low">Low Urgency</option>
              <option value="medium">Medium Urgency</option>
              <option value="high">High Urgency</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-400 font-medium text-[11px]">Priority *</label>
              {aiAppliedFields.priority && !manualPriorityOverride && (
                <span className="text-[10px] text-sky-400 font-semibold">AI Suggested</span>
              )}
            </div>
            <select
              value={priority}
              onChange={e => {
                setPriority(e.target.value as IncidentPriority);
                setManualPriorityOverride(true);
              }}
              className={`w-full bg-neutral-900 border border-neutral-700 font-bold px-3 py-2 focus:outline-none ${
                priority === 'P1' ? 'text-rose-500' : priority === 'P2' ? 'text-amber-500' : 'text-neutral-200'
              }`}
            >
              <option value="P1">P1 - Critical Outage</option>
              <option value="P2">P2 - High Priority</option>
              <option value="P3">P3 - Moderate</option>
              <option value="P4">P4 - Low</option>
            </select>
          </div>
        </div>

        {/* Configuration Item (CI) */}
        <div>
          <label className="text-neutral-400 font-medium block mb-1.5 text-[11px]">Configuration Item (CMDB CI)</label>
          <select
            value={affectedCI}
            onChange={e => setAffectedCI(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
          >
            <option value="">None / Unspecified CI</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>
                {a.assetTag} - {a.name} ({a.location})
              </option>
            ))}
          </select>
        </div>

        {/* Page Form Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/incidents"
            className="px-4 py-2 rounded-md border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors font-medium"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => handleSubmit(e, true)}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 transition-colors font-medium"
            >
              Save &amp; Create Another
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
            >
              Submit Incident
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
