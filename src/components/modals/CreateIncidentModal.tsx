import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { IncidentPriority, IncidentCategory } from '../../types/itsm';
import { X } from 'lucide-react';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({ isOpen, onClose }) => {
  const { createIncident, assets, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('P3');
  const [category, setCategory] = useState<IncidentCategory>('software');
  const [affectedCI, setAffectedCI] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createIncident({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      affectedCI: affectedCI || undefined,
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      urgency,
      impact
    });

    onClose();
    setTitle('');
    setDescription('');
    setAffectedCI('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: incident.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Incident Record</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Caller & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Caller</label>
              <input
                type="text"
                readOnly
                value={`${currentUser.name} (${currentUser.email})`}
                className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as IncidentCategory)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="software">Software / Application</option>
                <option value="hardware">Hardware / Infrastructure</option>
                <option value="network">Network / Connectivity</option>
                <option value="access">Identity & Access</option>
                <option value="security">SecOps / Security</option>
              </select>
            </div>
          </div>

          {/* Row 2: Impact, Urgency, Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Impact</label>
              <select
                value={impact}
                onChange={e => {
                  const val = e.target.value as any;
                  setImpact(val);
                  if (val === 'high' && urgency === 'high') setPriority('P1');
                  else if (val === 'high' || urgency === 'high') setPriority('P2');
                  else setPriority('P3');
                }}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-1.5 focus:outline-none uppercase"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Urgency</label>
              <select
                value={urgency}
                onChange={e => {
                  const val = e.target.value as any;
                  setUrgency(val);
                  if (impact === 'high' && val === 'high') setPriority('P1');
                  else if (impact === 'high' || val === 'high') setPriority('P2');
                  else setPriority('P3');
                }}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-1.5 focus:outline-none uppercase"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as IncidentPriority)}
                className={`w-full bg-neutral-900 border border-neutral-700 font-bold px-2 py-1.5 focus:outline-none ${
                  priority === 'P1' ? 'text-rose-500' : priority === 'P2' ? 'text-amber-500' : 'text-neutral-200'
                }`}
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Moderate</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>
          </div>

          {/* Configuration Item */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Configuration Item (CMDB CI)</label>
            <select
              value={affectedCI}
              onChange={e => setAffectedCI(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="">None / General Issue</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.assetTag} - {a.name} ({a.location})
                </option>
              ))}
            </select>
          </div>

          {/* Short Description */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Short Description *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. SFP Transceiver link failure on Core Switch"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Detailed Description */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Detailed Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Observed error codes, impact scope, or reproduction steps..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none"
            />
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
              Submit Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
