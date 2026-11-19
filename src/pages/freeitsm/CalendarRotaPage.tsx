import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { CalendarEvent } from '../../types/itsm';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';

export const CalendarRotaPage: React.FC = () => {
  const { activeTenant, calendarEvents, changes, contracts, domains, createCalendarEvent, currentUser } = useITSM();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<CalendarEvent['type']>('duty_rota');
  const [owner, setOwner] = useState(currentUser.name);

  // Auto-merge live scheduled changes, contract renewals, SSL expiries + calendarEvents
  const mergedEvents: CalendarEvent[] = [
    ...calendarEvents,
    ...changes.map(c => ({
      id: `chg-${c.id}`,
      tenantId: activeTenant.id,
      title: `CAB Window: ${c.id} · ${c.title}`,
      date: c.scheduledStart.split('T')[0],
      type: 'change' as const,
      owner: c.assignedEngineer,
      linkedId: c.id
    })),
    ...contracts.map(c => ({
      id: `ctr-${c.id}`,
      tenantId: activeTenant.id,
      title: `Contract Renewal: ${c.vendor} (${c.title})`,
      date: c.renewalDate,
      type: 'contract_renewal' as const,
      owner: 'Procurement',
      linkedId: c.id
    })),
    ...domains.map(d => ({
      id: `dom-${d.id}`,
      tenantId: activeTenant.id,
      title: `SSL Cert Expiry: ${d.domain}`,
      date: d.sslExpiry,
      type: 'ssl_expiry' as const,
      owner: 'SecOps',
      linkedId: d.id
    }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  const visible = mergedEvents.filter(e => typeFilter === 'all' || e.type === typeFilter);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCalendarEvent({ title: title.trim(), date, type, owner });
    setTitle('');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · UNIFIED SCHEDULE & DUTY ROTA</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-rose-500" />
            <span>CALENDAR & ON-CALL ROTA</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{visible.length} Scheduled Items</span>
          </h1>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Rota / Event</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleAdd} className="p-4 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-neutral-400 mb-1">Event / Shift Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Primary L3 NetOps On-Call Shift" className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as CalendarEvent['type'])} className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="duty_rota">Duty Rota</option>
              <option value="change">Change Window</option>
              <option value="project_milestone">Project Milestone</option>
              <option value="contract_renewal">Contract Renewal</option>
              <option value="ssl_expiry">SSL Expiry</option>
            </select>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 min-w-[130px] min-h-[38px] bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100" />
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner" className="w-28 min-h-[38px] bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100" />
            <button type="submit" className="min-h-[38px] px-3 py-2 bg-rose-600 text-white font-bold shrink-0">Add</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 border border-neutral-800 bg-neutral-900/50 p-1 w-full sm:w-fit overflow-x-auto no-scrollbar">
        {(['all', 'duty_rota', 'change', 'ssl_expiry', 'contract_renewal', 'project_milestone'] as const).map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`min-h-[34px] px-3 py-1 uppercase text-[10px] whitespace-nowrap shrink-0 ${typeFilter === f ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400'}`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900 tabular-nums">
        {visible.map(ev => (
          <div key={ev.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-900/30">
            <div className="flex items-center gap-4">
              <div className="w-24 font-bold text-neutral-200 shrink-0">{ev.date}</div>
              <div>
                <div className="font-bold text-neutral-100">{ev.title}</div>
                <div className="text-neutral-500">Owner: {ev.owner} {ev.endDate ? `· Thru ${ev.endDate}` : ''}</div>
              </div>
            </div>
            <div className="text-neutral-400 uppercase text-[11px] shrink-0">
              {ev.type.replace('_', ' ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
