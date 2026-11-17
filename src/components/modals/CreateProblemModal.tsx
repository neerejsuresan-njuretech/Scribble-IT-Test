import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { X } from 'lucide-react';

interface CreateProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProblemModal: React.FC<CreateProblemModalProps> = ({ isOpen, onClose }) => {
  const { createProblem, incidents, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'moderate' | 'minor'>('high');
  const [isKnownError, setIsKnownError] = useState(false);
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [permanentSolution, setPermanentSolution] = useState('');
  const [linkedIncident, setLinkedIncident] = useState('');

  if (!isOpen) return null;

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

    onClose();
    setTitle('');
    setDescription('');
    setRootCauseAnalysis('');
    setWorkaround('');
    setPermanentSolution('');
    setLinkedIncident('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: problem.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Problem Record</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Severity & KEDB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Severity *</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Linked Incident</label>
              <select
                value={linkedIncident}
                onChange={e => setLinkedIncident(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">None Linked</option>
                {incidents.map(inc => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id} - {inc.title.slice(0, 36)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="kedb-check"
              checked={isKnownError}
              onChange={e => setIsKnownError(e.target.checked)}
              className="accent-rose-600"
            />
            <label htmlFor="kedb-check" className="text-neutral-300 text-[11px] cursor-pointer">
              Publish to Known Error Database (KEDB) with published workaround
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
              placeholder="e.g. Repeated SFP+ Transceiver Overheating in Rack A-04"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Root Cause & Workaround */}
          <div className="space-y-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Root Cause Analysis (RCA)</label>
              <textarea
                rows={2}
                value={rootCauseAnalysis}
                onChange={e => setRootCauseAnalysis(e.target.value)}
                placeholder="Identified underlying physical or software defect..."
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px]"
              />
            </div>

            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Temporary Workaround</label>
              <textarea
                rows={2}
                value={workaround}
                onChange={e => setWorkaround(e.target.value)}
                placeholder="Temporary mitigation procedure to restore service..."
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px]"
              />
            </div>

            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Permanent Solution</label>
              <textarea
                rows={2}
                value={permanentSolution}
                onChange={e => setPermanentSolution(e.target.value)}
                placeholder="Long-term code patch, hardware replacement, or change..."
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
            >
              Submit Problem
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
