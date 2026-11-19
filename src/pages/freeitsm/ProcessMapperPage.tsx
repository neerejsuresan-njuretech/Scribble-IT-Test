import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import {
  FreeITSMModuleId,
  ProcessEdge,
  ProcessMap,
  ProcessNode,
  ProcessNodeType,
} from '../../types/itsm';
import {
  FigmaWireframeCanvas,
  WIREFRAME_NODE_PALETTE,
} from '../../components/workflows/FigmaWireframeCanvas';
import { ALL_WORKFLOW_MODULES } from '../../data/workflowCatalog';
import {
  GitBranch,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  CheckCircle2,
  ArrowRight,
  X,
} from 'lucide-react';

interface ProcessTemplate {
  id: string;
  label: string;
  scope: 'incident' | 'request' | 'change';
  description: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

const WIREFRAME_TEMPLATES: ProcessTemplate[] = [
  {
    id: 'incident-standard',
    label: 'Incident Lifecycle (Open → Approval → Close)',
    scope: 'incident',
    description: 'Standard incident intake with triage action, escalation/approval gate, and verification before close.',
    nodes: [
      { id: 'n-start', label: 'Incident Opened', type: 'start', role: 'Portal / Phone / Email', moduleId: 'incidents', slaHours: 1, x: 48, y: 128 },
      { id: 'n-triage', label: 'L1 Triage & Categorize', type: 'action', role: 'Service Desk L1', moduleId: 'incidents', slaHours: 2, x: 320, y: 128 },
      { id: 'n-approval', label: 'Escalation / Fix Approval', type: 'approval', role: 'Incident Manager', moduleId: 'incidents', slaHours: 4, x: 592, y: 128 },
      { id: 'n-notify', label: 'Notify Caller & Verify', type: 'notification', role: 'Notification Bot', moduleId: 'incidents', slaHours: 1, x: 864, y: 128 },
      { id: 'n-end', label: 'Close Incident', type: 'end', role: 'Service Desk', moduleId: 'incidents', slaHours: 4, x: 1136, y: 128 },
    ],
    edges: [
      { from: 'n-start', to: 'n-triage', condition: 'Auto-Route' },
      { from: 'n-triage', to: 'n-approval', condition: 'Needs Sign-Off' },
      { from: 'n-approval', to: 'n-notify', condition: 'Approved' },
      { from: 'n-notify', to: 'n-end', condition: 'Verified' },
    ],
  },
  {
    id: 'request-fulfillment',
    label: 'Service Request (Open → Approvals → Provision → Close)',
    scope: 'request',
    description: 'Multi-gate request approval flow with Manager + Security sign-off and automated provisioning before closing.',
    nodes: [
      { id: 'n-start', label: 'Service Request Opened', type: 'start', role: 'Self-Service Portal', moduleId: 'requests', slaHours: 1, x: 48, y: 128 },
      { id: 'n-mgr', label: 'Line Manager Approval', type: 'approval', role: 'Department Lead', moduleId: 'requests', slaHours: 8, x: 320, y: 128 },
      { id: 'n-sec', label: 'IAM / Security Check', type: 'decision', role: 'SecOps / IAM', moduleId: 'iam', slaHours: 4, x: 592, y: 128 },
      { id: 'n-prov', label: 'Provision Access / Asset', type: 'automation', role: 'IT Fulfillment', moduleId: 'assets', slaHours: 4, x: 864, y: 128 },
      { id: 'n-end', label: 'Close Request', type: 'end', role: 'Service Desk', moduleId: 'requests', slaHours: 2, x: 1136, y: 128 },
    ],
    edges: [
      { from: 'n-start', to: 'n-mgr', condition: 'Submitted' },
      { from: 'n-mgr', to: 'n-sec', condition: 'Approved' },
      { from: 'n-sec', to: 'n-prov', condition: 'Compliant' },
      { from: 'n-prov', to: 'n-end', condition: 'Fulfilled' },
    ],
  },
];

export const ProcessMapperPage: React.FC = () => {
  const {
    activeTenant,
    processMaps,
    kbArticles,
    createProcessMap,
    updateProcessMap,
    deleteProcessMap,
    showToast,
  } = useITSM();

  const [selectedMapId, setSelectedMapId] = useState<string>(processMaps[0]?.id || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newScope, setNewScope] = useState<'incident' | 'request' | 'change'>('incident');
  const [linkedKbId, setLinkedKbId] = useState('');

  const selectedMap: ProcessMap | undefined =
    processMaps.find(m => m.id === selectedMapId) || processMaps[0];

  useEffect(() => {
    if (selectedMap && selectedMap.id !== selectedMapId) {
      setSelectedMapId(selectedMap.id);
    }
  }, [selectedMap, selectedMapId]);

  const selectedNode = selectedMap?.nodes.find(n => n.id === selectedNodeId) || null;

  const handleCreateMap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created = createProcessMap({
      title: newTitle.trim(),
      recordScope: newScope,
      linkedKbId: linkedKbId || undefined,
    });
    setSelectedMapId(created.id);
    setSelectedNodeId(created.nodes[0]?.id || null);
    setNewTitle('');
    setShowNewModal(false);
  };

  const handleCreateFromTemplate = (tpl: ProcessTemplate) => {
    const created = createProcessMap({
      title: tpl.label,
      recordScope: tpl.scope,
      nodes: tpl.nodes.map(n => ({ ...n })),
      edges: tpl.edges.map(e => ({ ...e })),
    });
    setSelectedMapId(created.id);
    setSelectedNodeId(created.nodes[1]?.id || created.nodes[0]?.id || null);
  };

  const handleGraphChange = (nodes: ProcessNode[], edges: ProcessEdge[]) => {
    if (!selectedMap) return;
    updateProcessMap(selectedMap.id, { nodes, edges });
  };

  // Insert a new wireframe node directly along an existing wire (between from -> to)
  const handleInsertBetweenEdge = (
    edgeIndex: number,
    type: Exclude<ProcessNodeType, 'start' | 'end'>
  ) => {
    if (!selectedMap) return;
    const edge = selectedMap.edges[edgeIndex];
    if (!edge) return;
    const fromNode = selectedMap.nodes.find(n => n.id === edge.from);
    const toNode = selectedMap.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const paletteDef = WIREFRAME_NODE_PALETTE.find(p => p.type === type) || WIREFRAME_NODE_PALETTE[0];
    const newId = `n-${Date.now()}`;
    const insertX = fromNode.x + 272;
    const insertY = Math.round(((fromNode.y + toNode.y) / 2) / 16) * 16;

    // Shift downstream nodes right so the inserted wireframe block never overlaps
    const shiftRight = toNode.x < insertX + 240 ? 272 : 0;
    const updatedNodes: ProcessNode[] = selectedMap.nodes
      .map(n => (shiftRight && n.x >= toNode.x ? { ...n, x: n.x + shiftRight } : n))
      .concat({
        id: newId,
        label: paletteDef.defaultTitle,
        type,
        role: paletteDef.defaultRole,
        slaHours: paletteDef.defaultSla,
        moduleId: selectedMap.recordScope === 'request' ? 'requests' : 'incidents',
        x: insertX,
        y: insertY,
      });

    const updatedEdges: ProcessEdge[] = [];
    selectedMap.edges.forEach((ed, idx) => {
      if (idx === edgeIndex) {
        updatedEdges.push({ from: edge.from, to: newId, condition: edge.condition || 'Next' });
        updatedEdges.push({
          from: newId,
          to: edge.to,
          condition: type === 'approval' ? 'Approved' : type === 'decision' ? 'If Yes' : 'Next',
        });
      } else {
        updatedEdges.push(ed);
      }
    });

    updateProcessMap(selectedMap.id, { nodes: updatedNodes, edges: updatedEdges });
    setSelectedNodeId(newId);
    showToast({
      variant: 'success',
      title: `${paletteDef.label} Inserted`,
      description: `Added between "${fromNode.label}" and "${toNode.label}"`,
    });
  };

  // Insert directly BEFORE the Close Record (end) node
  const handleQuickAddBeforeClose = (type: Exclude<ProcessNodeType, 'start' | 'end'>) => {
    if (!selectedMap) return;
    const endNode = selectedMap.nodes.find(n => n.type === 'end');
    if (endNode) {
      const incomingEdgeIdx = selectedMap.edges.findIndex(e => e.to === endNode.id);
      if (incomingEdgeIdx >= 0) {
        handleInsertBetweenEdge(incomingEdgeIdx, type);
        return;
      }
    }

    // Fallback: append before end or at the tail
    const paletteDef = WIREFRAME_NODE_PALETTE.find(p => p.type === type) || WIREFRAME_NODE_PALETTE[0];
    const last = selectedMap.nodes[selectedMap.nodes.length - 1];
    const newId = `n-${Date.now()}`;
    const newNode: ProcessNode = {
      id: newId,
      label: paletteDef.defaultTitle,
      type,
      role: paletteDef.defaultRole,
      slaHours: paletteDef.defaultSla,
      moduleId: selectedMap.recordScope === 'request' ? 'requests' : 'incidents',
      x: (last?.x ?? 48) + 272,
      y: last?.y ?? 128,
    };
    updateProcessMap(selectedMap.id, {
      nodes: [...selectedMap.nodes, newNode],
      edges: last
        ? [...selectedMap.edges, { from: last.id, to: newId, condition: 'Next' }]
        : selectedMap.edges,
    });
    setSelectedNodeId(newId);
  };

  const handleUpdateSelectedNode = (patch: Partial<ProcessNode>) => {
    if (!selectedMap || !selectedNode) return;
    updateProcessMap(selectedMap.id, {
      nodes: selectedMap.nodes.map(n => (n.id === selectedNode.id ? { ...n, ...patch } : n)),
    });
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedMap || !selectedNode) return;
    if (selectedNode.type === 'start' || selectedNode.type === 'end') {
      showToast({
        variant: 'warning',
        title: 'Lifecycle Anchor Protected',
        description: 'Open and Close terminal gates cannot be deleted.',
      });
      return;
    }

    // Re-bridge incoming edges -> outgoing edges so flow stays intact before Close
    const incoming = selectedMap.edges.filter(e => e.to === selectedNode.id);
    const outgoing = selectedMap.edges.filter(e => e.from === selectedNode.id);
    const remainingEdges = selectedMap.edges.filter(
      e => e.from !== selectedNode.id && e.to !== selectedNode.id
    );

    if (incoming.length > 0 && outgoing.length > 0) {
      incoming.forEach(inc => {
        outgoing.forEach(out => {
          if (!remainingEdges.some(e => e.from === inc.from && e.to === out.to)) {
            remainingEdges.push({ from: inc.from, to: out.to, condition: inc.condition || 'Next' });
          }
        });
      });
    }

    updateProcessMap(selectedMap.id, {
      nodes: selectedMap.nodes.filter(n => n.id !== selectedNode.id),
      edges: remainingEdges,
    });
    setSelectedNodeId(null);
    showToast({ variant: 'info', title: `Removed Step: ${selectedNode.label}` });
  };

  const handleUpdateOutgoingEdgeCondition = (edgeIdx: number, condition: string) => {
    if (!selectedMap) return;
    updateProcessMap(selectedMap.id, {
      edges: selectedMap.edges.map((ed, i) => (i === edgeIdx ? { ...ed, condition } : ed)),
    });
  };

  return (
    <div className="space-y-5 font-mono text-xs w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider text-[10px]">
            {activeTenant.name} · FIGMA WIREFRAME LIFECYCLE STUDIO
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-rose-500 shrink-0" />
            <span>Process Mapper</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              ({processMaps.length} Blueprints)
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCreateFromTemplate(WIREFRAME_TEMPLATES[0])}
            className="min-h-[38px] px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>+ Incident Blueprint</span>
          </button>
          <button
            type="button"
            onClick={() => handleCreateFromTemplate(WIREFRAME_TEMPLATES[1])}
            className="min-h-[38px] px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Request Blueprint</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(prev => !prev)}
            className="min-h-[38px] px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Blank Wireframe</span>
          </button>
        </div>
      </div>

      {/* Create Blank Wireframe Form */}
      {showNewModal && (
        <form
          onSubmit={handleCreateMap}
          className="p-4 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-neutral-400 mb-1 text-[10px] uppercase">Blueprint Name *</label>
            <input
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. P1 Security Incident Resolution Flow"
              className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1 text-[10px] uppercase">Record Lifecycle Scope</label>
            <select
              value={newScope}
              onChange={e => setNewScope(e.target.value as 'incident' | 'request' | 'change')}
              className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-neutral-100"
            >
              <option value="incident">Incident (Open → Pre-Close → Close)</option>
              <option value="request">Service Request (Open → Approvals → Close)</option>
              <option value="change">Change RFC (Open → CAB → Close)</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1 text-[10px] uppercase">Link Knowledge Article</label>
            <select
              value={linkedKbId}
              onChange={e => setLinkedKbId(e.target.value)}
              className="w-full min-h-[38px] bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-neutral-100"
            >
              <option value="">None</option>
              {kbArticles.map(k => (
                <option key={k.id} value={k.id}>
                  {k.id} · {k.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 min-h-[38px] px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Create Frame
            </button>
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="min-h-[38px] px-3 border border-neutral-700 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Main 3-Column Figma Studio Layout (Responsive: Stacks cleanly on Mobile/Tablet, 3 Columns on XL Desktop) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: Process Maps Library */}
        <div className="xl:col-span-3 border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900">
          <div className="px-3 py-2.5 bg-neutral-900/60 flex items-center justify-between text-[10px] uppercase font-bold text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-500" />
              <span>Pages / Blueprints</span>
            </span>
            <span className="tabular-nums">{processMaps.length}</span>
          </div>

          {processMaps.length === 0 ? (
            <div className="p-5 text-center space-y-3 text-neutral-500">
              <p>No process wireframes created yet.</p>
              <button
                type="button"
                onClick={() => handleCreateFromTemplate(WIREFRAME_TEMPLATES[0])}
                className="w-full min-h-[38px] px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                + Load Incident Lifecycle Blueprint
              </button>
            </div>
          ) : (
            <div className="max-h-72 xl:max-h-[540px] overflow-y-auto divide-y divide-neutral-900">
              {processMaps.map(m => {
                const isSelected = selectedMap?.id === m.id;
                const preCloseCount = m.nodes.filter(n => n.type !== 'start' && n.type !== 'end').length;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMapId(m.id);
                      setSelectedNodeId(null);
                    }}
                    className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase">
                        <span className="font-mono-strict text-sky-400">{m.id}</span>
                        <span>·</span>
                        <span>{m.recordScope || 'incident'}</span>
                      </div>
                      <div className="font-bold text-neutral-100 mt-0.5 truncate">{m.title}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 tabular-nums">
                        {preCloseCount} pre-close gate{preCloseCount === 1 ? '' : 's'} · {m.nodes.length} nodes
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        deleteProcessMap(m.id);
                      }}
                      className="p-1.5 text-neutral-600 hover:text-rose-400 shrink-0"
                      title="Delete blueprint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER CANVAS: Interactive Figma Wireframe Board */}
        <div className="xl:col-span-6 min-w-0">
          {selectedMap ? (
            <FigmaWireframeCanvas
              nodes={selectedMap.nodes}
              edges={selectedMap.edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onChangeGraph={handleGraphChange}
              onInsertBetweenEdge={handleInsertBetweenEdge}
              onQuickAddBeforeClose={handleQuickAddBeforeClose}
              frameTitle={`${selectedMap.title} (${(selectedMap.recordScope || 'incident').toUpperCase()})`}
            />
          ) : (
            <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-4">
              <GitBranch className="w-8 h-8 text-neutral-600 mx-auto" />
              <div className="space-y-1">
                <div className="font-bold text-neutral-100 text-sm">
                  Start Designing Your Incident or Request Lifecycle
                </div>
                <p className="text-neutral-400 max-w-md mx-auto">
                  Choose a starter blueprint below to map actions, approvals, conditions, and notifications between Record Open and Record Close.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {WIREFRAME_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleCreateFromTemplate(tpl)}
                    className="min-h-[40px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Figma Node Properties Inspector */}
        <div className="xl:col-span-3 border border-neutral-800 bg-neutral-950 flex flex-col">
          <div className="px-3 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between text-[10px] uppercase font-bold text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Design Inspector</span>
            </span>
            {selectedNode && (
              <span className="font-mono-strict text-sky-400">{selectedNode.type.toUpperCase()}</span>
            )}
          </div>

          {!selectedMap || !selectedNode ? (
            <div className="p-4 space-y-3 text-neutral-400">
              <p className="leading-relaxed">
                Select any wireframe block on the canvas to configure its label, step type, approver role, target module, SLA, and connector branch labels.
              </p>
              {selectedMap && (
                <div className="border-t border-neutral-800 pt-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-neutral-500">
                    Active Flow Sequence
                  </div>
                  <div className="space-y-1.5">
                    {selectedMap.nodes.map(n => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setSelectedNodeId(n.id)}
                        className="w-full text-left px-2.5 py-2 border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-neutral-200 font-medium">{n.label}</span>
                        <span className="text-[10px] uppercase text-neutral-500 shrink-0">{n.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase text-neutral-500 mb-1">Step Label</label>
                <input
                  value={selectedNode.label}
                  onChange={e => handleUpdateSelectedNode({ label: e.target.value })}
                  className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                />
              </div>

              {selectedNode.type !== 'start' && selectedNode.type !== 'end' && (
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1">Wireframe Block Type</label>
                  <select
                    value={selectedNode.type}
                    onChange={e =>
                      handleUpdateSelectedNode({
                        type: e.target.value as Exclude<ProcessNodeType, 'start' | 'end'>,
                      })
                    }
                    className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                  >
                    <option value="action">Action Step</option>
                    <option value="approval">Approval Gate</option>
                    <option value="decision">Condition / Decision</option>
                    <option value="notification">Notification</option>
                    <option value="automation">Automation / API</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1">Owner / Approver</label>
                  <input
                    value={selectedNode.role}
                    onChange={e => handleUpdateSelectedNode({ role: e.target.value })}
                    className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1">SLA (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedNode.slaHours ?? 4}
                    onChange={e => handleUpdateSelectedNode({ slaHours: Number(e.target.value) || 1 })}
                    className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-neutral-500 mb-1">Linked Module</label>
                <select
                  value={selectedNode.moduleId || 'incidents'}
                  onChange={e =>
                    handleUpdateSelectedNode({ moduleId: e.target.value as FreeITSMModuleId | 'all' })
                  }
                  className="w-full min-h-[36px] bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                >
                  {ALL_WORKFLOW_MODULES.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-neutral-500 mb-1">Wireframe Spec / Notes</label>
                <textarea
                  rows={2}
                  value={selectedNode.description || ''}
                  onChange={e => handleUpdateSelectedNode({ description: e.target.value })}
                  placeholder="Specify approval criteria, checklist, or transition rule..."
                  className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                />
              </div>

              {/* Outgoing Wires / Branch Condition Labels */}
              {selectedMap.edges.some(e => e.from === selectedNode.id) && (
                <div className="border-t border-neutral-800 pt-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-neutral-500">
                    Outgoing Wires
                  </div>
                  {selectedMap.edges.map((ed, idx) => {
                    if (ed.from !== selectedNode.id) return null;
                    const target = selectedMap.nodes.find(n => n.id === ed.to);
                    return (
                      <div key={idx} className="p-2 border border-neutral-800 bg-neutral-900/40 space-y-1">
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1 truncate">
                          <ArrowRight className="w-3 h-3 text-sky-400 shrink-0" />
                          <span className="truncate">{target?.label || ed.to}</span>
                        </div>
                        <input
                          value={ed.condition || ''}
                          onChange={e => handleUpdateOutgoingEdgeCondition(idx, e.target.value)}
                          placeholder="Wire label (e.g. Approved, Escalate)"
                          className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-200"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-neutral-800 pt-3 flex items-center justify-between gap-2">
                {selectedNode.type !== 'start' && selectedNode.type !== 'end' ? (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedNode}
                    className="min-h-[36px] px-3 py-1.5 border border-rose-900/80 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 font-bold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Step</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Lifecycle Anchor</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    showToast({
                      variant: 'success',
                      title: 'Wireframe Changes Saved',
                      description: `${selectedMap.title} updated.`,
                    })
                  }
                  className="min-h-[36px] px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
