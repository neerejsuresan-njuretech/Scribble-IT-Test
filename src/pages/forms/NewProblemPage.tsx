import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ArrowLeft } from 'lucide-react';

export const NewProblemPage: React.FC = () => {
  const navigate = useNavigate();
  const { createProblem, incidents, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'moderate' | 'minor'>('high');
  const [isKnownError, setIsKnownError] = useState(false);
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [permanentSolution, setPermanentSolution] = useState('');
  const [linkedIncident, setLinkedIncident] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createProblem({
      title: title.trim(),
      description: description.trim(),
      severity,
      isKnownError,
      rootCauseAnalysis: rootCauseAnalysis.trim(),
      workaround: workaround.trim(),
      permanentSolution: permanentSolution.trim(),
      linkedIncidentIds: linkedIncident ? [linkedIncident] : [],
      owner: currentUser.name
    });

    navigate('/problems');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/problems" className="hover:text-neutral-300 transition-colors">PROBLEMS</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW INVESTIGATION (problem.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>NEW PROBLEM INVESTIGATION FORM</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/problems"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Problems</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Problem Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Defect Classification & Root Cause</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Severity & Incident Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Severity Level *</label>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="critical">Critical Severity</option>
              <option value="high">High Severity</option>
              <option value="moderate">Moderate Severity</option>
              <option value="minor">Minor Severity</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Triggering Incident Reference</label>
            <select
              value={linkedIncident}
              onChange={e => setLinkedIncident(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="">None Linked</option>
              {incidents.map(inc => (
                <option key={inc.id} value={inc.id}>
                  {inc.id} - {inc.title.slice(0, 40)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 border border-neutral-800 bg-neutral-900/30">
          <input
            type="checkbox"
            id="kedb-page-check"
            checked={isKnownError}
            onChange={e => setIsKnownError(e.target.checked)}
            className="accent-rose-600 w-4 h-4"
          />
          <label htmlFor="kedb-page-check" className="text-neutral-300 text-xs cursor-pointer">
            Publish this record directly to the Known Error Database (KEDB) for service desk technicians
          </label>
        </div>

        {/* Title */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Problem Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Optical Transceiver Overheating in Rack A-04 Top-of-Rack Switch"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* RCA & Workaround */}
        <div className="space-y-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Root Cause Analysis (RCA)</label>
            <textarea
              rows={3}
              value={rootCauseAnalysis}
              onChange={e => setRootCauseAnalysis(e.target.value)}
              placeholder="Underlying hardware defect, firmware bug, or thermal recirculation path..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Temporary Workaround</label>
            <textarea
              rows={2}
              value={workaround}
              onChange={e => setWorkaround(e.target.value)}
              placeholder="Mitigation steps to restore service availability while awaiting permanent fix..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Permanent Structural Solution</label>
            <textarea
              rows={2}
              value={permanentSolution}
              onChange={e => setPermanentSolution(e.target.value)}
              placeholder="Code merge PR, architectural redesign, or RFC change request link..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/problems"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Submit Problem
          </button>
        </div>
      </form>
    </div>
  );
};
