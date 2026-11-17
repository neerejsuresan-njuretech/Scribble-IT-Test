import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ArrowLeft } from 'lucide-react';

export const NewPortalTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { createIncident, currentUser } = useITSM();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'software' | 'hardware' | 'network' | 'access'>('software');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createIncident({
      title: title.trim(),
      description: description.trim(),
      priority: urgency === 'high' ? 'P2' : urgency === 'medium' ? 'P3' : 'P4',
      category,
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      urgency,
      impact: 'medium'
    });

    navigate('/portal');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-3xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/portal" className="hover:text-neutral-300 transition-colors">SELF-SERVICE</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">REPORT ISSUE</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>REPORT IT INCIDENT</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/portal"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portal</span>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-5">
        <div className="border-b border-neutral-800 pb-2 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Self-Service Incident Details</div>
          <span className="text-[10px] text-neutral-500">SUBMITTER: {currentUser.name}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Issue Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="software">Software / Application Glitch</option>
              <option value="hardware">Laptop / Monitor Hardware</option>
              <option value="network">VPN / WiFi / Internet</option>
              <option value="access">Account Credentials / MFA</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Urgency / Impact Level *</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="low">Low - General Inconvenience</option>
              <option value="medium">Medium - Work Hindered</option>
              <option value="high">High - Completely Blocked</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Brief Summary of What Happened *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Cannot connect to staging database via WireGuard VPN"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Detailed Description & Error Messages</label>
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Include any exact error messages or screenshots description..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/portal"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Submit Ticket
          </button>
        </div>
      </form>
    </div>
  );
};
