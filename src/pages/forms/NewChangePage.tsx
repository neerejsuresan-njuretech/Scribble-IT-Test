import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ChangeType, RiskLevel } from '../../types/itsm';
import { ArrowLeft } from 'lucide-react';

export const NewChangePage: React.FC = () => {
  const navigate = useNavigate();
  const { createChangeRequest, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ChangeType>('normal');
  const [riskScore, setRiskScore] = useState<RiskLevel>('medium');
  const [reason, setReason] = useState('');
  const [implementationPlan, setImplementationPlan] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');
  const [testPlan, setTestPlan] = useState('');
  const [scheduledStart, setScheduledStart] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    new Date(Date.now() + 28 * 3600 * 1000).toISOString().slice(0, 16)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newChg = createChangeRequest({
      title: title.trim(),
      type,
      riskScore,
      reason: reason.trim(),
      implementationPlan: implementationPlan.trim() || '1. Pre-change backup\n2. Firmware deployment\n3. Interface verification',
      rollbackPlan: rollbackPlan.trim() || 'Revert revision commit and restore snapshot from secondary partition.',
      testPlan: testPlan.trim() || 'Ping sweep & synthetic throughput benchmark verification.',
      scheduledStart: new Date(scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduledEnd).toISOString(),
      requestedBy: currentUser.name,
      assignedEngineer: currentUser.name
    });

    navigate(`/changes?id=${newChg.id}`);
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/changes" className="hover:text-neutral-300 transition-colors">CHANGES (CAB)</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW RFC (change_request.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>NEW REQUEST FOR CHANGE (RFC)</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/changes"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Changes</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated RFC Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Change Scope & Risk Profile</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Row 1: Type, Risk, Requester */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Change Type *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ChangeType)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="standard">Standard (Pre-approved)</option>
              <option value="normal">Normal (CAB Review)</option>
              <option value="emergency">Emergency (Active Outage)</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Assessed Risk Level *</label>
            <select
              value={riskScore}
              onChange={e => setRiskScore(e.target.value as RiskLevel)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Requested By</label>
            <input
              type="text"
              readOnly
              value={currentUser.name}
              className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-3 py-2 focus:outline-none"
            />
          </div>
        </div>

        {/* RFC Title */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">RFC Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Core Switch Firmware 17.09 Rollover & Baffle Mount"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Maintenance Window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Scheduled Start (UTC) *</label>
            <input
              type="datetime-local"
              required
              value={scheduledStart}
              onChange={e => setScheduledStart(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Scheduled End (UTC) *</label>
            <input
              type="datetime-local"
              required
              value={scheduledEnd}
              onChange={e => setScheduledEnd(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Technical Justification */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Technical Justification / Business Reason *</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Technical defect addressed or operational justification..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none leading-relaxed"
          />
        </div>

        {/* Implementation, Rollback & Test Procedures */}
        <div className="space-y-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Execution Steps (Implementation Procedure)</label>
            <textarea
              rows={3}
              value={implementationPlan}
              onChange={e => setImplementationPlan(e.target.value)}
              placeholder="1. Reroute primary traffic via Stack A&#10;2. Power down secondary PSU&#10;3. Upgrade image via TFTP"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Backout / Rollback Contingency Plan</label>
            <textarea
              rows={2}
              value={rollbackPlan}
              onChange={e => setRollbackPlan(e.target.value)}
              placeholder="Trigger condition and rollback sequence..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Post-Change Synthetic Validation Test Plan</label>
            <textarea
              rows={2}
              value={testPlan}
              onChange={e => setTestPlan(e.target.value)}
              placeholder="Synthetic test sweep, latency benchmark, or health probe..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none text-[11px] leading-relaxed"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/changes"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Submit RFC
          </button>
        </div>
      </form>
    </div>
  );
};
