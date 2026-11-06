import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Problem, ProblemStatus } from '../../types/itsm';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { AlertCircle, BookOpen, Link as LinkIcon, Plus, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ProblemModuleProps {
  onOpenCreate: () => void;
}

export const ProblemModule: React.FC<ProblemModuleProps> = ({ onOpenCreate }) => {
  const { problems, updateProblem, setActiveTab } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(problems[0]?.id || '');
  const [activeTabSub, setActiveTabSub] = useState<'all' | 'kedb'>('all');

  const selectedProblem = problems.find(p => p.id === selectedId) || problems[0];

  const displayedProblems = activeTabSub === 'kedb'
    ? problems.filter(p => p.isKnownError)
    : problems;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">ITIL SERVICE OPERATION // PROBLEM MANAGEMENT & KEDB</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>ROOT CAUSE & KNOWN ERRORS</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({problems.length} Problems Tracked)</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-neutral-800 bg-neutral-900/60 p-0.5 text-xs font-mono">
            <button
              onClick={() => setActiveTabSub('all')}
              className={`px-3 py-1 transition-colors ${activeTabSub === 'all' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400'}`}
            >
              All Investigations
            </button>
            <button
              onClick={() => setActiveTabSub('kedb')}
              className={`px-3 py-1 transition-colors ${activeTabSub === 'kedb' ? 'bg-neutral-800 text-neutral-100 font-bold text-amber-400' : 'text-neutral-400'}`}
            >
              Known Error DB (KEDB)
            </button>
          </div>
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {/* Grid: Problem Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950 max-h-[750px] overflow-y-auto">
          {displayedProblems.map(prob => {
            const isSelected = selectedProblem?.id === prob.id;
            return (
              <div
                key={prob.id}
                onClick={() => setSelectedId(prob.id)}
                className={`p-4 transition-colors cursor-pointer space-y-2 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-200">{prob.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className={prob.severity === 'critical' ? 'text-rose-500' : prob.severity === 'high' ? 'text-amber-500' : 'text-neutral-400'}>
                      {prob.severity.toUpperCase()}
                    </span>
                    {prob.isKnownError && (
                      <span className="text-[10px] text-amber-400 border border-amber-900/60 px-1">KEDB</span>
                    )}
                  </div>
                  <MinimalStatus
                    status={prob.status}
                    variant={prob.status === 'root_cause_identified' ? 'amber' : prob.status === 'closed' ? 'emerald' : 'neutral'}
                  />
                </div>

                <div className="text-xs font-medium text-neutral-200 line-clamp-2">
                  {prob.title}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                  <span>Owner: {prob.owner}</span>
                  <span className="tabular-nums">{prob.linkedIncidentIds.length} Linked Incidents</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail */}
        {selectedProblem ? (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-neutral-400">
                  <span className="text-base font-bold text-neutral-100">{selectedProblem.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 font-bold uppercase">{selectedProblem.severity} SEVERITY</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Status:</span>
                  <select
                    value={selectedProblem.status}
                    onChange={e => updateProblem(selectedProblem.id, { status: e.target.value as ProblemStatus })}
                    className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs font-mono px-2 py-1 focus:outline-none"
                  >
                    <option value="investigating">Investigating</option>
                    <option value="root_cause_identified">Root Cause Identified</option>
                    <option value="workaround_published">Workaround Published</option>
                    <option value="change_requested">Change Requested</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <h2 className="text-lg font-bold text-neutral-100 font-mono">
                {selectedProblem.title}
              </h2>

              <p className="text-xs text-neutral-300 font-mono bg-neutral-900/40 p-3 border border-neutral-800/80 leading-relaxed">
                {selectedProblem.description}
              </p>
            </div>

            {/* Root Cause Analysis & Workaround Blocks */}
            <div className="space-y-4">
              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-2">
                <div className="text-xs font-mono uppercase text-neutral-400 flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Root Cause Analysis (RCA)</span>
                </div>
                <p className="text-xs font-mono text-neutral-200 leading-relaxed">
                  {selectedProblem.rootCauseAnalysis || 'Investigation in progress. Hardware diagnostics and log telemetry being parsed.'}
                </p>
              </div>

              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-2">
                <div className="text-xs font-mono uppercase text-neutral-400 flex items-center gap-2 font-bold">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  <span>Documented Workaround (1st Line Support)</span>
                </div>
                <p className="text-xs font-mono text-neutral-200 leading-relaxed">
                  {selectedProblem.workaround || 'No immediate workaround available. Escalated to Tier 3 engineering.'}
                </p>
              </div>

              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-2">
                <div className="text-xs font-mono uppercase text-neutral-400 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Permanent Solution Architecture</span>
                </div>
                <p className="text-xs font-mono text-neutral-200 leading-relaxed">
                  {selectedProblem.permanentSolution || 'Pending release in upcoming infrastructure sprint.'}
                </p>
              </div>
            </div>

            {/* Linked Entities (Incidents & Change RFC) */}
            <div className="border-t border-neutral-800 pt-4 space-y-3 text-xs font-mono">
              <div className="text-neutral-400 uppercase">Linked ITIL Entities</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
                  <span className="text-neutral-500">ASSOCIATED INCIDENTS</span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedProblem.linkedIncidentIds.map(incId => (
                      <span key={incId} className="px-1.5 py-0.5 border border-neutral-700 bg-neutral-900 text-neutral-300">
                        {incId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
                  <span className="text-neutral-500">REMEDY CHANGE REQUEST (RFC)</span>
                  <div className="pt-1">
                    {selectedProblem.linkedChangeId ? (
                      <button
                        onClick={() => setActiveTab('changes')}
                        className="text-rose-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>{selectedProblem.linkedChangeId} (Inspect CAB RFC)</span>
                      </button>
                    ) : (
                      <span className="text-neutral-600">No Change Request linked</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
