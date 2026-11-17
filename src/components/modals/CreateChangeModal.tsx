import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ChangeType, RiskLevel } from '../../types/itsm';
import { X } from 'lucide-react';

interface CreateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChangeModal: React.FC<CreateChangeModalProps> = ({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createChangeRequest({
      title: title.trim(),
      type,
      riskScore,
      reason: reason.trim(),
      implementationPlan: implementationPlan.trim() || '1. Pre-change backup\n2. Binary deployment\n3. Interface verification',
      rollbackPlan: rollbackPlan.trim() || 'Revert revision commit and restore snapshot from warm standby.',
      testPlan: testPlan.trim() || 'Ping sweep & synthetic throughput validation.',
      scheduledStart: new Date(scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduledEnd).toISOString(),
      requestedBy: currentUser.name,
      assignedEngineer: currentUser.name
    });

    onClose();
    setTitle('');
    setReason('');
    setImplementationPlan('');
    setRollbackPlan('');
    setTestPlan('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: change_request.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Change Request (RFC)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Type, Risk, Requester */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Change Type *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as ChangeType)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
              >
                <option value="standard">Standard (Pre-approved)</option>
                <option value="normal">Normal (CAB Review)</option>
                <option value="emergency">Emergency (Outage)</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Risk Level *</label>
              <select
                value={riskScore}
                onChange={e => setRiskScore(e.target.value as RiskLevel)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
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
                className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">RFC Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Core Switch Firmware 17.09 Rollover & Baffle Mount"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Maintenance Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Scheduled Start (UTC) *</label>
              <input
                type="datetime-local"
                required
                value={scheduledStart}
                onChange={e => setScheduledStart(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Scheduled End (UTC) *</label>
              <input
                type="datetime-local"
                required
                value={scheduledEnd}
                onChange={e => setScheduledEnd(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Justification */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Technical Justification *</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Business justification and underlying problem / need..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {/* Implementation & Rollback */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Implementation Procedure</label>
              <textarea
                rows={2}
                value={implementationPlan}
                onChange={e => setImplementationPlan(e.target.value)}
                placeholder="1. Step one&#10;2. Step two"
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none focus:border-neutral-500 resize-none text-[11px]"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Rollback Contingency Plan</label>
              <textarea
                rows={2}
                value={rollbackPlan}
                onChange={e => setRollbackPlan(e.target.value)}
                placeholder="Backout trigger condition and rollback script..."
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none focus:border-neutral-500 resize-none text-[11px]"
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
              Submit RFC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
