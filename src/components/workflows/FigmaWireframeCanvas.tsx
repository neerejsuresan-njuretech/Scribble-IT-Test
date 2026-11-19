import React, { useState, useRef, useMemo } from 'react';
import { ProcessNode, ProcessEdge, ProcessNodeType } from '../../types/itsm';
import {
  Play,
  CheckCircle2,
  GitBranch,
  Zap,
  Bell,
  Cpu,
  Flag,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Link2,
  Trash2,
  Clock,
  UserCheck,
  Sparkles,
  LayoutGrid,
  Move,
} from 'lucide-react';

export interface WireframePaletteOption {
  type: Exclude<ProcessNodeType, 'start' | 'end'>;
  label: string;
  defaultTitle: string;
  defaultRole: string;
  defaultSla: number;
  accentBorder: string;
  accentText: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const WIREFRAME_NODE_PALETTE: WireframePaletteOption[] = [
  {
    type: 'action',
    label: 'Action Step',
    defaultTitle: 'Investigate & Remediate',
    defaultRole: 'Service Desk L2',
    defaultSla: 4,
    accentBorder: 'border-sky-500/80',
    accentText: 'text-sky-400',
    Icon: Zap,
  },
  {
    type: 'approval',
    label: 'Approval Gate',
    defaultTitle: 'Manager Approval',
    defaultRole: 'IT Manager / CAB',
    defaultSla: 8,
    accentBorder: 'border-emerald-500/80',
    accentText: 'text-emerald-400',
    Icon: UserCheck,
  },
  {
    type: 'decision',
    label: 'Condition / Split',
    defaultTitle: 'Severity or Impact Check',
    defaultRole: 'Auto-Router',
    defaultSla: 1,
    accentBorder: 'border-amber-500/80',
    accentText: 'text-amber-400',
    Icon: GitBranch,
  },
  {
    type: 'notification',
    label: 'Notification',
    defaultTitle: 'Notify Stakeholders',
    defaultRole: 'Notification Bot',
    defaultSla: 1,
    accentBorder: 'border-indigo-500/80',
    accentText: 'text-indigo-400',
    Icon: Bell,
  },
  {
    type: 'automation',
    label: 'Automation / API',
    defaultTitle: 'Run Provisioning Script',
    defaultRole: 'Workflow Engine',
    defaultSla: 1,
    accentBorder: 'border-violet-500/80',
    accentText: 'text-violet-400',
    Icon: Cpu,
  },
];

const NODE_W = 216;
const NODE_H = 92;
const SNAP = 16;

interface FigmaWireframeCanvasProps {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onChangeGraph: (nodes: ProcessNode[], edges: ProcessEdge[]) => void;
  onInsertBetweenEdge: (edgeIndex: number, type: Exclude<ProcessNodeType, 'start' | 'end'>) => void;
  onQuickAddBeforeClose: (type: Exclude<ProcessNodeType, 'start' | 'end'>) => void;
  readOnly?: boolean;
  frameTitle?: string;
}

export const FigmaWireframeCanvas: React.FC<FigmaWireframeCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onChangeGraph,
  onInsertBetweenEdge,
  onQuickAddBeforeClose,
  readOnly = false,
  frameTitle = 'Lifecycle Frame · Open → Pre-Close Gates → Close',
}) => {
  const [zoom, setZoom] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [openInsertEdgeIdx, setOpenInsertEdgeIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);

  // Compute bounding canvas size dynamically so wires and nodes never clip
  const canvasBounds = useMemo(() => {
    const maxX = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W + 140), 960);
    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H + 140), 420);
    return { width: maxX, height: maxY };
  }, [nodes]);

  const handlePointerDownNode = (e: React.PointerEvent, node: ProcessNode) => {
    e.stopPropagation();

    // If user is in Connect Mode, complete the wire from connectSourceId -> node.id
    if (connectSourceId && connectSourceId !== node.id && !readOnly) {
      const exists = edges.some(ed => ed.from === connectSourceId && ed.to === node.id);
      if (!exists) {
        const sourceNode = nodes.find(n => n.id === connectSourceId);
        const condition =
          sourceNode?.type === 'approval'
            ? 'Approved'
            : sourceNode?.type === 'decision'
            ? 'If Yes'
            : 'Next';
        onChangeGraph(nodes, [...edges, { from: connectSourceId, to: node.id, condition }]);
      }
      setConnectSourceId(null);
      onSelectNode(node.id);
      return;
    }

    onSelectNode(node.id);
    setOpenInsertEdgeIdx(null);

    if (readOnly) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: node.x,
      origY: node.y,
    });
  };

  const handlePointerMoveNode = (e: React.PointerEvent) => {
    if (!dragging || readOnly) return;
    const dx = (e.clientX - dragging.startClientX) / zoom;
    const dy = (e.clientY - dragging.startClientY) / zoom;
    let nextX = Math.max(24, dragging.origX + dx);
    let nextY = Math.max(32, dragging.origY + dy);
    if (snapToGrid) {
      nextX = Math.round(nextX / SNAP) * SNAP;
      nextY = Math.round(nextY / SNAP) * SNAP;
    }

    const updated = nodes.map(n => (n.id === dragging.nodeId ? { ...n, x: nextX, y: nextY } : n));
    onChangeGraph(updated, edges);
  };

  const handlePointerUpNode = (e: React.PointerEvent) => {
    if (dragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already released
      }
      setDragging(null);
    }
  };

  const handleAutoLayout = () => {
    if (readOnly || nodes.length === 0) return;
    const startNode = nodes.find(n => n.type === 'start');
    const endNode = nodes.find(n => n.type === 'end');
    const middleNodes = nodes.filter(n => n.type !== 'start' && n.type !== 'end');

    // Order middle nodes via BFS from start so flow stays chronological
    const orderedMiddle: ProcessNode[] = [];
    const visited = new Set<string>();
    const queue: string[] = startNode ? [startNode.id] : [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      const found = middleNodes.find(m => m.id === curr);
      if (found) orderedMiddle.push(found);
      edges.filter(e => e.from === curr).forEach(e => queue.push(e.to));
    }
    middleNodes.forEach(m => {
      if (!orderedMiddle.some(o => o.id === m.id)) orderedMiddle.push(m);
    });

    const fullSequence: ProcessNode[] = [
      ...(startNode ? [startNode] : []),
      ...orderedMiddle,
      ...(endNode ? [endNode] : []),
    ];

    const laidOut = fullSequence.map((n, idx) => ({
      ...n,
      x: 48 + idx * 272,
      y: 128,
    }));

    onChangeGraph(laidOut, edges);
  };

  const handleRemoveEdge = (idx: number) => {
    if (readOnly) return;
    onChangeGraph(
      nodes,
      edges.filter((_, i) => i !== idx)
    );
    setOpenInsertEdgeIdx(null);
  };

  const getNodeMeta = (type: ProcessNodeType) => {
    switch (type) {
      case 'start':
        return {
          tag: 'OPEN TRIGGER',
          border: 'border-emerald-500/90',
          headerBg: 'bg-emerald-950/40',
          accent: 'text-emerald-400',
          Icon: Play,
        };
      case 'end':
        return {
          tag: 'CLOSE GATE',
          border: 'border-rose-500/90',
          headerBg: 'bg-rose-950/40',
          accent: 'text-rose-400',
          Icon: Flag,
        };
      case 'approval':
        return {
          tag: 'APPROVAL',
          border: 'border-emerald-600/80',
          headerBg: 'bg-emerald-950/30',
          accent: 'text-emerald-400',
          Icon: UserCheck,
        };
      case 'decision':
        return {
          tag: 'CONDITION',
          border: 'border-amber-500/80',
          headerBg: 'bg-amber-950/30',
          accent: 'text-amber-400',
          Icon: GitBranch,
        };
      case 'notification':
        return {
          tag: 'NOTIFY',
          border: 'border-indigo-500/80',
          headerBg: 'bg-indigo-950/30',
          accent: 'text-indigo-400',
          Icon: Bell,
        };
      case 'automation':
        return {
          tag: 'AUTOMATION',
          border: 'border-violet-500/80',
          headerBg: 'bg-violet-950/30',
          accent: 'text-violet-400',
          Icon: Cpu,
        };
      default:
        return {
          tag: 'ACTION',
          border: 'border-sky-500/80',
          headerBg: 'bg-sky-950/30',
          accent: 'text-sky-400',
          Icon: Zap,
        };
    }
  };

  return (
    <div className="border border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden">
      {/* Figma-Style Top Canvas Toolbar */}
      <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 border border-sky-700/70 bg-sky-950/40 text-sky-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
            FIGMA WIREFRAME
          </span>
          <span className="text-neutral-300 font-semibold truncate">{frameTitle}</span>
          <span className="hidden sm:inline text-neutral-500 tabular-nums shrink-0">
            · {nodes.length} nodes · {edges.length} wires
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={handleAutoLayout}
                className="min-h-[32px] px-2.5 py-1 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 whitespace-nowrap"
                title="Tidy nodes into clean wireframe alignment"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Auto-Align</span>
              </button>

              <button
                type="button"
                onClick={() => setSnapToGrid(prev => !prev)}
                className={`min-h-[32px] px-2 py-1 border flex items-center gap-1 whitespace-nowrap ${
                  snapToGrid
                    ? 'border-sky-700/80 bg-sky-950/40 text-sky-300'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-500'
                }`}
                title="Snap nodes to 16px blueprint grid"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Snap</span>
              </button>

              {connectSourceId && (
                <button
                  type="button"
                  onClick={() => setConnectSourceId(null)}
                  className="min-h-[32px] px-2.5 py-1 border border-amber-600 bg-amber-950/40 text-amber-300 font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Select target node (Cancel)</span>
                </button>
              )}
            </>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center border border-neutral-800 bg-neutral-950">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.6, Number((z - 0.1).toFixed(2))))}
              className="min-h-[32px] px-2 text-neutral-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono-strict tabular-nums text-neutral-300 border-x border-neutral-800">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="min-h-[32px] px-2 text-neutral-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="min-h-[32px] px-2 text-neutral-400 hover:text-white border-l border-neutral-800"
              title="Reset 100%"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Pre-Close Insertion Bar (Directly insert Action, Approval, Condition, Notification, Automation BEFORE Close) */}
      {!readOnly && (
        <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-950 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mr-1">
            Insert Before Close:
          </span>
          {WIREFRAME_NODE_PALETTE.map(item => {
            const Icon = item.Icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onQuickAddBeforeClose(item.type)}
                className="min-h-[32px] px-2.5 py-1 border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 hover:border-neutral-600 text-neutral-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3 h-3 text-neutral-500" />
                <Icon className={`w-3.5 h-3.5 ${item.accentText}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive Blueprint Viewport */}
      <div
        ref={viewportRef}
        onClick={() => {
          onSelectNode(null);
          setOpenInsertEdgeIdx(null);
        }}
        className="relative w-full h-[390px] sm:h-[440px] lg:h-[490px] overflow-auto dot-matrix-bg select-none"
      >
        <div
          style={{
            width: `${canvasBounds.width * zoom}px`,
            height: `${canvasBounds.height * zoom}px`,
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${canvasBounds.width}px`,
              height: `${canvasBounds.height}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'relative',
            }}
          >
            {/* Figma Artboard Frame Label */}
            <div className="absolute top-3 left-4 flex items-center gap-2 text-[10px] font-mono-strict text-neutral-500 pointer-events-none">
              <span className="text-sky-400 font-bold"># {frameTitle}</span>
              <span className="tabular-nums">
                {canvasBounds.width} × {canvasBounds.height}
              </span>
              {!readOnly && (
                <span className="hidden sm:inline text-neutral-600">
                  · Drag nodes to reposition · Click + on any wire to insert before close
                </span>
              )}
            </div>

            {/* SVG Wire Connectors Layer */}
            <svg
              width={canvasBounds.width}
              height={canvasBounds.height}
              className="absolute inset-0 pointer-events-none"
            >
              <defs>
                <marker
                  id="wire-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#737373" />
                </marker>
                <marker
                  id="wire-arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {edges.map((ed, idx) => {
                const from = nodes.find(n => n.id === ed.from);
                const to = nodes.find(n => n.id === ed.to);
                if (!from || !to) return null;

                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
                const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                const isHighlighted = selectedNodeId === from.id || selectedNodeId === to.id;

                return (
                  <g key={`${ed.from}-${ed.to}-${idx}`}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isHighlighted ? '#38bdf8' : '#64748b'}
                      strokeWidth={isHighlighted ? 2.25 : 1.75}
                      strokeDasharray={to.type === 'end' ? '6 4' : undefined}
                      markerEnd={isHighlighted ? 'url(#wire-arrow-active)' : 'url(#wire-arrow)'}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive Edge Labels & Inline "+" Insert Buttons on Every Wire */}
            {edges.map((ed, idx) => {
              const from = nodes.find(n => n.id === ed.from);
              const to = nodes.find(n => n.id === ed.to);
              if (!from || !to) return null;

              const midX = (from.x + NODE_W + to.x) / 2;
              const midY = (from.y + to.y) / 2 + NODE_H / 2;
              const isPickerOpen = openInsertEdgeIdx === idx;

              return (
                <div
                  key={`edge-ctrl-${ed.from}-${ed.to}-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isPickerOpen ? 40 : 15,
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex flex-col items-center gap-1"
                >
                  {ed.condition && (
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider border border-neutral-700 bg-neutral-950/95 text-neutral-300 whitespace-nowrap shadow-sm">
                      {ed.condition}
                    </span>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setOpenInsertEdgeIdx(isPickerOpen ? null : idx)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all shadow-md ${
                        isPickerOpen
                          ? 'bg-sky-500 border-sky-300 text-white scale-110'
                          : 'bg-neutral-950 border-neutral-600 text-sky-400 hover:bg-sky-600 hover:border-sky-400 hover:text-white'
                      }`}
                      title={`Insert step between "${from.label}" and "${to.label}"`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isPickerOpen && !readOnly && (
                    <div className="mt-1 w-48 border border-sky-600 bg-neutral-950 shadow-2xl p-1.5 space-y-1 z-50">
                      <div className="px-2 py-1 text-[9px] uppercase font-bold text-sky-400 border-b border-neutral-800 flex items-center justify-between">
                        <span>Insert Step Here</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEdge(idx)}
                          className="text-neutral-500 hover:text-rose-400"
                          title="Delete this connector wire"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {WIREFRAME_NODE_PALETTE.map(opt => {
                        const Icon = opt.Icon;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              onInsertBetweenEdge(idx, opt.type);
                              setOpenInsertEdgeIdx(null);
                            }}
                            className="w-full text-left px-2 py-1.5 hover:bg-neutral-900 text-neutral-200 flex items-center gap-2 text-[11px] transition-colors"
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${opt.accentText}`} />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Wireframe Node Cards with Figma Selection Handles */}
            {nodes.map(node => {
              const meta = getNodeMeta(node.type);
              const Icon = meta.Icon;
              const isSelected = selectedNodeId === node.id;
              const isConnectSource = connectSourceId === node.id;

              return (
                <div
                  key={node.id}
                  onPointerDown={e => handlePointerDownNode(e, node)}
                  onPointerMove={handlePointerMoveNode}
                  onPointerUp={handlePointerUpNode}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_W}px`,
                    height: `${NODE_H}px`,
                    zIndex: isSelected ? 25 : 10,
                    touchAction: 'none',
                  }}
                  className={`group border bg-neutral-950/95 shadow-lg flex flex-col justify-between transition-shadow ${
                    isSelected
                      ? 'border-sky-400 ring-2 ring-sky-500/40 shadow-sky-950/50'
                      : isConnectSource
                      ? 'border-amber-400 ring-2 ring-amber-500/40'
                      : `${meta.border} hover:border-neutral-400`
                  } ${readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  {/* Figma Corner Selection Handles */}
                  {isSelected && (
                    <>
                      <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-sky-500 pointer-events-none" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-sky-500 pointer-events-none" />
                      <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-sky-500 pointer-events-none" />
                      <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-sky-500 pointer-events-none" />
                      <span className="absolute -top-5 left-0 text-[9px] font-mono-strict text-sky-400 bg-neutral-950/90 px-1 border border-sky-800/70 tabular-nums pointer-events-none whitespace-nowrap">
                        X:{Math.round(node.x)} Y:{Math.round(node.y)}
                      </span>
                    </>
                  )}

                  {/* Left Input Port */}
                  {node.type !== 'start' && (
                    <span
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-neutral-500 bg-neutral-950 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}

                  {/* Right Output Port (click to start wire connection) */}
                  {node.type !== 'end' && !readOnly && (
                    <button
                      type="button"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        setConnectSourceId(prev => (prev === node.id ? null : node.id));
                      }}
                      title="Click then click another node to draw a connector wire"
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                        isConnectSource
                          ? 'bg-amber-500 border-amber-300 text-neutral-950'
                          : 'bg-neutral-950 border-neutral-500 hover:border-sky-400 hover:bg-sky-500 text-transparent hover:text-white'
                      }`}
                    >
                      <Link2 className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* Wireframe Card Header Strip */}
                  <div className={`px-2.5 py-1.5 border-b border-neutral-800/90 flex items-center justify-between gap-1.5 ${meta.headerBg}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.accent}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${meta.accent}`}>
                        {meta.tag}
                      </span>
                    </div>
                    {!readOnly && (
                      <Move className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 shrink-0" />
                    )}
                  </div>

                  {/* Wireframe Card Body */}
                  <div className="px-2.5 py-1.5 min-w-0">
                    <div className="font-bold text-neutral-100 text-xs truncate" title={node.label}>
                      {node.label}
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-400 mt-1">
                      <span className="truncate">{node.role || 'Unassigned'}</span>
                      {typeof node.slaHours === 'number' && (
                        <span className="flex items-center gap-0.5 tabular-nums text-neutral-500 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {node.slaHours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Wireframe Status Legend */}
      <div className="px-3 py-1.5 border-t border-neutral-800 bg-neutral-900/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-500 inline-block" /> Open / Approval
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-sky-500 inline-block" /> Action
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-500 inline-block" /> Condition
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-indigo-500 inline-block" /> Notification
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-rose-500 inline-block" /> Close Gate
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Sparkles className="w-3 h-3 text-sky-400" />
          <span>Click any wire (+) to insert actions or approvals before closing</span>
        </div>
      </div>
    </div>
  );
};
