import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ProjectStage } from '../../types/itsm';
import { FolderKanban, Plus } from 'lucide-react';

const STAGES: ProjectStage[] = ['initiation', 'planning', 'execution', 'uat', 'closed'];

export const ProjectsPage: React.FC = () => {
  const { activeTenant, projects, tasks, createProject, updateProjectStage } = useITSM();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [budgetTotal, setBudgetTotal] = useState(50000);
  const [targetEndDate, setTargetEndDate] = useState('2027-02-28');
  const [summary, setSummary] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createProject({ title: title.trim(), budgetTotal, targetEndDate, summary });
    setTitle('');
    setSummary('');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · PROJECT PORTFOLIO & STAGE GATES</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <FolderKanban className="w-5 h-5 text-rose-500" />
            <span>PROJECTS & BUDGETING</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{projects.length} Active Initiatives</span>
          </h1>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showNew ? 'Cancel' : 'New Project'}</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleAdd} className="p-5 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-neutral-400 mb-1">Project Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Zero-Trust SIEM Migration" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Allocated Budget ({activeTenant.currency})</label>
            <input type="number" min="0" value={budgetTotal} onChange={e => setBudgetTotal(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-neutral-400 mb-1">Scope Summary</label>
            <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Key deliverables & stage-gate objective..." className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div className="flex gap-2">
            <input type="date" value={targetEndDate} onChange={e => setTargetEndDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100" />
            <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0">Launch</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {projects.map(p => {
          const linkedTasks = tasks.filter(t => t.projectId === p.id);
          const budgetPct = Math.min(100, Math.round((p.budgetSpent / Math.max(1, p.budgetTotal)) * 100));
          return (
            <div key={p.id} className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="text-neutral-500 flex items-center gap-2">
                    <span>{p.code}</span>
                    <span>·</span>
                    <span>Owner: {p.owner}</span>
                    <span>·</span>
                    <span>Target: {p.targetEndDate}</span>
                  </div>
                  <h2 className="text-base font-bold text-neutral-100 mt-1">{p.title}</h2>
                  <p className="text-neutral-400 mt-1">{p.summary}</p>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <div className={p.health === 'on_track' ? 'text-emerald-400 font-bold' : p.health === 'at_risk' ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                    {p.health.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-neutral-300 mt-1">{activeTenant.currency} {p.budgetSpent.toLocaleString()} / {p.budgetTotal.toLocaleString()} ({budgetPct}%)</div>
                  <div className="text-neutral-500">{linkedTasks.length} linked tasks</div>
                </div>
              </div>

              {/* Stage Gate Progress Strip */}
              <div className="grid grid-cols-5 gap-1.5 pt-2">
                {STAGES.map((st, idx) => {
                  const currentIdx = STAGES.indexOf(p.stage);
                  const active = st === p.stage;
                  const passed = idx < currentIdx;
                  return (
                    <button
                      key={st}
                      onClick={() => updateProjectStage(p.id, st, Math.min(100, (idx + 1) * 20))}
                      className={`py-2 px-2 border text-center uppercase text-[10px] transition-colors ${
                        active
                          ? 'border-rose-500 bg-rose-950/30 text-white font-bold'
                          : passed
                          ? 'border-emerald-800 bg-emerald-950/20 text-emerald-400'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-500 hover:text-neutral-200'
                      }`}
                    >
                      {idx + 1}. {st}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div className="p-8 border border-neutral-800 text-center text-neutral-500">No projects registered for {activeTenant.name}.</div>
        )}
      </div>
    </div>
  );
};
