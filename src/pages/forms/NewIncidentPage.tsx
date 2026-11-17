import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { IncidentPriority, IncidentCategory } from '../../types/itsm';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export const NewIncidentPage: React.FC = () => {
  const navigate = useNavigate();
  const { createIncident, assets, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('P3');
  const [category, setCategory] = useState<IncidentCategory>('software');
  const [affectedCI, setAffectedCI] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent, createAnother = false) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const newInc = createIncident({
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

    if (createAnother) {
      setTitle('');
      setDescription('');
      setAffectedCI('');
      setIsSubmitting(false);
    } else {
      navigate(`/incidents?id=${newInc.id}`);
    }
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/incidents" className="hover:text-neutral-300 transition-colors">INCIDENTS</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW RECORD (incident.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>NEW INCIDENT FORM</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/incidents"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Incidents</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Record Form */}
      <form onSubmit={e => handleSubmit(e, false)} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Primary Ticket Details</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Row 1: Caller & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Caller / Requester</label>
            <input
              type="text"
              readOnly
              value={`${currentUser.name} (${currentUser.email})`}
              className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-3 py-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as IncidentCategory)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="software">Software / Application</option>
              <option value="hardware">Hardware / Infrastructure</option>
              <option value="network">Network / Connectivity</option>
              <option value="access">Identity & Access</option>
              <option value="security">SecOps / Security Alert</option>
            </select>
          </div>
        </div>

        {/* Row 2: Impact, Urgency, Priority Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="low">Low Impact</option>
              <option value="medium">Medium Impact</option>
              <option value="high">High Impact</option>
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
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="low">Low Urgency</option>
              <option value="medium">Medium Urgency</option>
              <option value="high">High Urgency</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Calculated Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as IncidentPriority)}
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
          <label className="text-neutral-400 block mb-1 text-[11px]">Configuration Item (CMDB CI)</label>
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

        {/* Short Description */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Short Description *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. SFP Transceiver link failure on switch 2"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Detailed Description */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Detailed Symptoms & Diagnostics</label>
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Observed error codes, impact scope, or diagnostic output..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none leading-relaxed"
          />
        </div>

        {/* Page Form Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/incidents"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => handleSubmit(e, true)}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 transition-colors"
            >
              Save & Create Another
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
            >
              Submit Incident
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
