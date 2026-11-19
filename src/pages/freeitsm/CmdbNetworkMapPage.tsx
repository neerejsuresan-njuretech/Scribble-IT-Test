import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Network, Plus, Trash2, AlertTriangle, Server } from 'lucide-react';
import { CmdbRelation } from '../../types/itsm';

export const CmdbNetworkMapPage: React.FC = () => {
  const { activeTenant, assets, domains, cmdbRelations, incidents, addCmdbRelation, removeCmdbRelation } = useITSM();

  const [selectedNodeId, setSelectedNodeId] = useState<string>(assets[0]?.id || '');
  const [sourceId, setSourceId] = useState<string>(assets[0]?.id || '');
  const [targetId, setTargetId] = useState<string>(assets[1]?.id || domains[0]?.id || '');
  const [relationType, setRelationType] = useState<CmdbRelation['relationType']>('depends_on');
  const [criticality, setCriticality] = useState<CmdbRelation['criticality']>('high');

  // Unified CMDB nodes (Assets + Domains)
  const nodes = [
    ...assets.map(a => ({ id: a.id, label: a.assetTag, name: a.name, kind: a.type.toUpperCase(), status: a.status })),
    ...domains.map(d => ({ id: d.id, label: d.domain, name: d.registrar, kind: 'DOMAIN', status: d.securityGrade }))
  ];

  // Arrange nodes cleanly in SVG grid coordinates
  const positionedNodes = nodes.map((n, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      ...n,
      x: 130 + col * 270,
      y: 75 + row * 130
    };
  });

  const getNodePos = (id: string) => positionedNodes.find(n => n.id === id);

  // Compute impact analysis for selected node
  const impactedBySelected = cmdbRelations.filter(r => r.sourceId === selectedNodeId || r.targetId === selectedNodeId);
  const linkedIncidents = incidents.filter(i => i.affectedCI === selectedNodeId);

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    addCmdbRelation({ sourceId, targetId, relationType, criticality });
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · CMDB TOPOLOGY & IMPACT GRAPH</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Network className="w-5 h-5 text-rose-500" />
            <span>CMDB NETWORK MAPPER</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{nodes.length} Nodes · {cmdbRelations.length} Links</span>
          </h1>
        </div>
      </div>

      {/* Add Relationship Form */}
      <form onSubmit={handleAddLink} className="p-4 border border-neutral-800 bg-neutral-900/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-neutral-400 mb-1">Source CI</label>
          <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-neutral-100">
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.kind})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">Relationship</label>
          <select value={relationType} onChange={e => setRelationType(e.target.value as CmdbRelation['relationType'])} className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-neutral-100">
            <option value="depends_on">depends_on</option>
            <option value="connects_to">connects_to</option>
            <option value="hosts">hosts</option>
            <option value="secured_by">secured_by</option>
            <option value="backed_up_by">backed_up_by</option>
          </select>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">Target CI</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-neutral-100">
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.kind})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">Criticality</label>
          <select value={criticality} onChange={e => setCriticality(e.target.value as CmdbRelation['criticality'])} className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-neutral-100">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <button type="submit" className="sm:col-span-2 lg:col-span-1 min-h-[38px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <span>Link CIs</span>
        </button>
      </form>

      {/* Topology Canvas & Impact Analysis Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 border border-neutral-800 bg-neutral-950 p-4 overflow-x-auto">
          <svg viewBox="0 0 820 340" className="w-full min-w-[640px] h-auto">
            {/* Edges */}
            {cmdbRelations.map(rel => {
              const s = getNodePos(rel.sourceId);
              const t = getNodePos(rel.targetId);
              if (!s || !t) return null;
              const isHighlighted = rel.sourceId === selectedNodeId || rel.targetId === selectedNodeId;
              const strokeColor = isHighlighted ? '#e11d48' : rel.criticality === 'critical' ? '#f59e0b' : '#404040';
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              return (
                <g key={rel.id}>
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={strokeColor} strokeWidth={isHighlighted ? 2.5 : 1.5} strokeDasharray={rel.relationType === 'backed_up_by' ? '4 4' : undefined} />
                  <rect x={midX - 42} y={midY - 9} width={84} height={18} fill="#0a0a0a" stroke="#262626" />
                  <text x={midX} y={midY + 3} textAnchor="middle" fill="#a3a3a3" fontSize="9">{rel.relationType}</text>
                </g>
              );
            })}

            {/* Nodes */}
            {positionedNodes.map(n => {
              const isSelected = n.id === selectedNodeId;
              const hasIncident = incidents.some(i => i.affectedCI === n.id && i.status !== 'closed' && i.status !== 'resolved');
              return (
                <g key={n.id} onClick={() => setSelectedNodeId(n.id)} className="cursor-pointer">
                  <rect
                    x={n.x - 95}
                    y={n.y - 30}
                    width={190}
                    height={60}
                    fill={isSelected ? '#171717' : '#0a0a0a'}
                    stroke={hasIncident ? '#e11d48' : isSelected ? '#ffffff' : '#404040'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text x={n.x - 84} y={n.y - 10} fill="#737373" fontSize="9">{n.kind} · {n.id}</text>
                  <text x={n.x - 84} y={n.y + 8} fill="#f5f5f5" fontSize="11" fontWeight="bold">{n.label.slice(0, 22)}</text>
                  <text x={n.x - 84} y={n.y + 22} fill={hasIncident ? '#fb7185' : '#34d399'} fontSize="9">
                    {hasIncident ? 'ACTIVE INCIDENT' : n.status.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Impact Analysis Sidebar */}
        <div className="lg:col-span-4 border border-neutral-800 bg-neutral-900/30 p-4 space-y-4">
          <div className="font-bold text-neutral-200 border-b border-neutral-800 pb-2 flex items-center gap-2">
            <Server className="w-4 h-4 text-rose-500" />
            <span>IMPACT ANALYSIS ({selectedNodeId || 'NONE'})</span>
          </div>

          <div className="space-y-2">
            <div className="text-neutral-400">DIRECT RELATIONSHIPS ({impactedBySelected.length})</div>
            {impactedBySelected.length === 0 ? (
              <div className="text-neutral-500 py-2">No upstream/downstream dependencies mapped.</div>
            ) : (
              impactedBySelected.map(rel => (
                <div key={rel.id} className="p-2.5 border border-neutral-800 bg-neutral-950 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div className="text-neutral-200">{rel.sourceId} → {rel.targetId}</div>
                    <div className="text-neutral-500">{rel.relationType} · {rel.criticality}</div>
                  </div>
                  <button onClick={() => removeCmdbRelation(rel.id)} className="text-neutral-500 hover:text-rose-400 p-1" title="Unlink">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <div className="text-neutral-400">LINKED INCIDENTS ({linkedIncidents.length})</div>
            {linkedIncidents.map(inc => (
              <div key={inc.id} className="p-2.5 border border-rose-900/60 bg-rose-950/20 text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{inc.id} ({inc.priority})</div>
                  <div className="text-neutral-300">{inc.title}</div>
                </div>
              </div>
            ))}
            {linkedIncidents.length === 0 && <div className="text-neutral-500">No active incidents linked to this CI.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
