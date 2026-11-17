import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { GitBranch, Plus } from 'lucide-react';

export const ProcessMapperPage: React.FC = () => {
  const { activeTenant, processMaps, kbArticles, createProcessMap, addProcessNode } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(processMaps[0]?.id || '');
  const [showNewMap, setShowNewMap] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [linkedKbId, setLinkedKbId] = useState('');

  // Add node controls
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<'action' | 'decision' | 'approval'>('action');
  const [nodeRole, setNodeRole] = useState('Service Desk');

  const selected = processMaps.find(m => m.id === selectedId) || processMaps[0];

  const handleCreateMap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const m = createProcessMap({ title: newTitle.trim(), linkedKbId: linkedKbId || undefined });
    setSelectedId(m.id);
    setNewTitle('');
    setShowNewMap(false);
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !nodeLabel.trim()) return;
    addProcessNode(selected.id, nodeLabel.trim(), nodeType, nodeRole);
    setNodeLabel('');
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · WORKFLOW & RUNBOOK FLOWCHART BUILDER</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-rose-500" />
            <span>PROCESS MAPPER</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{processMaps.length} Workflows</span>
          </h1>
        </div>
        <button onClick={() => setShowNewMap(!showNewMap)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span>New Process Map</span>
        </button>
      </div>

      {showNewMap && (
        <form onSubmit={handleCreateMap} className="p-4 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-neutral-400 mb-1">Process Name *</label>
            <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Emergency Change Approval Workflow" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Link Knowledge Article</label>
            <select value={linkedKbId} onChange={e => setLinkedKbId(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="">None</option>
              {kbArticles.map(k => <option key={k.id} value={k.id}>{k.id} · {k.title}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold">Create Workflow</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 border border-neutral-800 divide-y divide-neutral-900 bg-neutral-950">
          {processMaps.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left p-4 transition-colors ${selected?.id === m.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'}`}
            >
              <div className="text-[11px] text-neutral-500">{m.id} {m.linkedKbId ? `· ${m.linkedKbId}` : ''}</div>
              <div className="font-bold text-neutral-100 mt-1">{m.title}</div>
              <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">{m.nodes.length} Steps</div>
            </button>
          ))}
          {processMaps.length === 0 && <div className="p-6 text-center text-neutral-500">No process maps yet.</div>}
        </div>

        {selected && (
          <div className="lg:col-span-9 space-y-4">
            <form onSubmit={handleAddNode} className="p-4 border border-neutral-800 bg-neutral-900/30 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-neutral-400 mb-1">Append Step Label *</label>
                <input required value={nodeLabel} onChange={e => setNodeLabel(e.target.value)} placeholder="e.g. CAB Chair Sign-Off" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Step Type</label>
                <select value={nodeType} onChange={e => setNodeType(e.target.value as 'action' | 'decision' | 'approval')} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
                  <option value="action">Action</option>
                  <option value="decision">Decision Gate</option>
                  <option value="approval">Approval</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input value={nodeRole} onChange={e => setNodeRole(e.target.value)} placeholder="Owner Role" className="w-full bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100" />
                <button type="submit" className="px-3 py-2 bg-rose-600 text-white font-bold shrink-0">Add</button>
              </div>
            </form>

            <div className="border border-neutral-800 bg-neutral-950 p-4 overflow-x-auto">
              <svg viewBox="0 0 920 240" className="w-full min-w-[700px] h-auto">
                {selected.edges.map((ed, idx) => {
                  const from = selected.nodes.find(n => n.id === ed.from);
                  const to = selected.nodes.find(n => n.id === ed.to);
                  if (!from || !to) return null;
                  return (
                    <g key={idx}>
                      <line x1={from.x + 85} y1={from.y + 26} x2={to.x} y2={to.y + 26} stroke="#525252" strokeWidth="1.5" />
                      {ed.condition && (
                        <text x={(from.x + 85 + to.x) / 2} y={(from.y + to.y) / 2 + 20} textAnchor="middle" fill="#fb7185" fontSize="9">
                          {ed.condition}
                        </text>
                      )}
                    </g>
                  );
                })}
                {selected.nodes.map(node => (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={170}
                      height={52}
                      fill="#111111"
                      stroke={node.type === 'decision' ? '#f59e0b' : node.type === 'start' ? '#10b981' : node.type === 'end' ? '#e11d48' : '#404040'}
                      strokeWidth="1.5"
                    />
                    <text x={node.x + 10} y={node.y + 18} fill="#737373" fontSize="9">{node.type.toUpperCase()} · {node.role}</text>
                    <text x={node.x + 10} y={node.y + 36} fill="#f5f5f5" fontSize="10" fontWeight="bold">{node.label.slice(0, 24)}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
