import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Siren, Send, CheckSquare, Square, Plus, Phone } from 'lucide-react';

export const WarRoomPage: React.FC = () => {
  const {
    activeTenant, warRooms, incidents, createWarRoom,
    postWarRoomMessage, toggleWarRoomChecklist, closeWarRoom
  } = useITSM();

  const [selectedId, setSelectedId] = useState<string>(warRooms[0]?.id || '');
  const [messageInput, setMessageInput] = useState('');
  const [newIncId, setNewIncId] = useState(incidents[0]?.id || '');
  const [showOpenForm, setShowOpenForm] = useState(false);

  const selected = warRooms.find(w => w.id === selectedId) || warRooms[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !messageInput.trim()) return;
    postWarRoomMessage(selected.id, messageInput.trim());
    setMessageInput('');
  };

  const handleOpenBridge = (e: React.FormEvent) => {
    e.preventDefault();
    const inc = incidents.find(i => i.id === newIncId);
    const created = createWarRoom(
      inc?.id || 'INC-P1',
      inc ? `Major Incident Bridge: ${inc.title}` : 'Emergency Operations War Room',
      inc?.priority === 'P2' ? 'P2' : 'P1'
    );
    setSelectedId(created.id);
    setShowOpenForm(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · MAJOR INCIDENT RESPONSE BRIDGE</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Siren className="w-5 h-5 text-rose-500" />
            <span>WAR ROOM</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{warRooms.filter(w => w.status === 'active').length} Active Bridges</span>
          </h1>
        </div>
        <button onClick={() => setShowOpenForm(!showOpenForm)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span>Open War Room Bridge</span>
        </button>
      </div>

      {showOpenForm && (
        <form onSubmit={handleOpenBridge} className="p-4 border border-neutral-700 bg-neutral-900/50 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-neutral-400 mb-1">Link Incident</label>
            <select value={newIncId} onChange={e => setNewIncId(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              {incidents.map(i => <option key={i.id} value={i.id}>{i.id} ({i.priority}) · {i.title}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">Launch Major Bridge</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 border border-neutral-800 divide-y divide-neutral-900 bg-neutral-950">
          {warRooms.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={`w-full text-left p-4 transition-colors ${selected?.id === w.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'}`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">{w.id} · {w.incidentId}</span>
                <span className={w.status === 'active' ? 'text-rose-400 font-bold' : 'text-neutral-500'}>{w.status.toUpperCase()}</span>
              </div>
              <div className="font-bold text-neutral-100 mt-1">{w.title}</div>
              <div className="text-neutral-500 text-[11px] mt-1">Commander: {w.commander}</div>
            </button>
          ))}
          {warRooms.length === 0 && <div className="p-6 text-center text-neutral-500">No War Rooms opened for {activeTenant.name}.</div>}
        </div>

        {selected && (
          <div className="lg:col-span-8 border border-neutral-800 bg-neutral-900/30 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <div className="text-rose-400 font-bold">{selected.severity} · {selected.incidentId} · {selected.status.toUpperCase()}</div>
                <h2 className="text-base font-bold text-neutral-100 mt-1">{selected.title}</h2>
                <div className="text-neutral-400 mt-1 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selected.bridgeNumber}</span>
                </div>
              </div>
              {selected.status === 'active' && (
                <button onClick={() => closeWarRoom(selected.id)} className="px-3 py-1.5 border border-neutral-700 hover:border-emerald-600 text-neutral-200 hover:text-emerald-300 shrink-0">
                  Stand Down Bridge
                </button>
              )}
            </div>

            {/* Action Checklist */}
            <div className="space-y-2">
              <div className="text-neutral-400 font-bold uppercase">RESPONSE CHECKLIST</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selected.checklist.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleWarRoomChecklist(selected.id, c.id)}
                    className="p-2.5 border border-neutral-800 bg-neutral-950 text-left flex items-start gap-2 hover:border-neutral-600"
                  >
                    {c.done ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />}
                    <span className={c.done ? 'line-through text-neutral-500' : 'text-neutral-200'}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Timeline Feed */}
            <div className="space-y-3">
              <div className="text-neutral-400 font-bold uppercase">LIVE BRIDGE TIMELINE</div>
              <div className="border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900 max-h-72 overflow-y-auto">
                {selected.feed.map(msg => (
                  <div key={msg.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="font-bold text-neutral-300">{msg.author} ({msg.role})</span>
                      <span className="tabular-nums">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-neutral-200">{msg.message}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Post command update to War Room timeline..."
                  className="flex-1 bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
