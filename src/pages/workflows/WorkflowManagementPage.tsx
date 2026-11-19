import React, { useState, useMemo } from 'react';
import { useITSM } from '../../context/ITSMContext';
import {
  FreeITSMModuleId,
  ProcessEdge,
  ProcessNode,
  ProcessNodeType,
  WorkflowDefinition,
  WorkflowStage,
  WorkflowTriggerConfig
} from '../../types/itsm';
import {
  FigmaWireframeCanvas,
  WIREFRAME_NODE_PALETTE
} from '../../components/workflows/FigmaWireframeCanvas';
import {
  ALL_WORKFLOW_MODULES,
  WorkflowActionDef,
  getActionsForModule,
  getModuleLabel,
  getTriggersForModule
} from '../../data/workflowCatalog';
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Pause,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  Zap,
  GitBranch,
  Search,
  X,
  Clock,
  Flag,
  LayoutGrid,
  List
} from 'lucide-react';

const MODULE_GROUPS = [
  'Built-in Controls',
  'Command',
  'ITSM',
  'CMDB & Assets',
  'Knowledge & Automation',
  'Platform & Workspace'
];

export const WorkflowManagementPage: React.FC = () => {
  const {
    activeTenant,
    workflows,
    createWorkflow,
    updateWorkflow,
    toggleWorkflowStatus,
    runWorkflowExecution,
    deleteWorkflow
  } = useITSM();

  // Designer open state & mode (create or edit existing workflow)
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Flow metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkflowDefinition['status']>('active');

  // Trigger state (Step 0)
  const [triggerModuleId, setTriggerModuleId] = useState<FreeITSMModuleId | 'all'>('incidents');
  const [triggerEventKey, setTriggerEventKey] = useState<string>('incident_created');
  const [triggerConditionField, setTriggerConditionField] = useState('');
  const [triggerConditionOperator, setTriggerConditionOperator] =
    useState<NonNullable<WorkflowTriggerConfig['conditionOperator']>>('equals');
  const [triggerConditionValue, setTriggerConditionValue] = useState('');

  // Multi-step stages (Power Automate vertical steps)
  const [stages, setStages] = useState<WorkflowStage[]>([
    {
      id: 'STP-1',
      name: 'Manager Approval Gate',
      stepType: 'approval',
      moduleId: 'all',
      actionKey: 'approval_gate',
      actionLabel: 'Start and Wait for Approval',
      assigneeRole: 'Department Lead',
      slaHours: 8,
      branch: 'main',
      config: { approverGroup: 'IT Manager', approvalMode: 'First to respond' }
    },
    {
      id: 'STP-2',
      name: 'Route / Assign Incident',
      stepType: 'task',
      moduleId: 'incidents',
      actionKey: 'assign_incident_queue',
      actionLabel: 'Route / Assign Incident',
      assigneeRole: 'Service Desk L2',
      slaHours: 12,
      branch: 'main',
      config: { targetQueue: 'Service Desk L2', workNote: 'Routed automatically via workflow' }
    }
  ]);

  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({
    'STP-1': true
  });

  // Inline "+ Add step" Power Automate Action Picker state (insertIndex === index after which to insert)
  const [pickerInsertIndex, setPickerInsertIndex] = useState<number | null>(null);
  const [pickerModuleFilter, setPickerModuleFilter] = useState<FreeITSMModuleId | 'all' | 'ALL_MODULES'>('ALL_MODULES');
  const [pickerSearch, setPickerSearch] = useState('');

  // Figma Wireframe Designer Mode (default) vs Power Automate Step List
  const [designerView, setDesignerView] = useState<'wireframe' | 'list'>('wireframe');
  const [selectedWireframeNodeId, setSelectedWireframeNodeId] = useState<string | null>(null);
  const [wireframeCoords, setWireframeCoords] = useState<Record<string, { x: number; y: number }>>({});

  // Selected workflow in library inspector
  const [selectedId, setSelectedId] = useState<string>(workflows[0]?.id || '');
  const selected = workflows.find(w => w.id === selectedId) || workflows[0];

  const availableTriggers = useMemo(
    () => getTriggersForModule(triggerModuleId),
    [triggerModuleId]
  );

  const selectedTriggerDef = useMemo(
    () => availableTriggers.find(t => t.key === triggerEventKey) || availableTriggers[0],
    [availableTriggers, triggerEventKey]
  );

  const handleTriggerModuleChange = (modId: FreeITSMModuleId | 'all') => {
    setTriggerModuleId(modId);
    const firstTrigger = getTriggersForModule(modId)[0];
    if (firstTrigger) {
      setTriggerEventKey(firstTrigger.key);
    }
  };

  // All actions searchable across all modules for the Power Automate "+ Add step" picker
  const pickerActionResults = useMemo(() => {
    const modulesToScan =
      pickerModuleFilter === 'ALL_MODULES'
        ? ALL_WORKFLOW_MODULES
        : ALL_WORKFLOW_MODULES.filter(m => m.id === pickerModuleFilter);

    const results: { moduleId: FreeITSMModuleId | 'all'; moduleLabel: string; group: string; action: WorkflowActionDef }[] = [];
    for (const mod of modulesToScan) {
      const actions = getActionsForModule(mod.id);
      for (const act of actions) {
        const q = pickerSearch.trim().toLowerCase();
        if (
          !q ||
          act.label.toLowerCase().includes(q) ||
          act.description.toLowerCase().includes(q) ||
          mod.label.toLowerCase().includes(q) ||
          act.stepType.toLowerCase().includes(q)
        ) {
          results.push({
            moduleId: mod.id,
            moduleLabel: mod.label,
            group: mod.group,
            action: act
          });
        }
      }
    }
    return results;
  }, [pickerModuleFilter, pickerSearch]);

  // Build live Figma Wireframe nodes & edges from Trigger + Pre-Close Stages + Close Gate
  const wireframeGraph = useMemo<{ nodes: ProcessNode[]; edges: ProcessEdge[] }>(() => {
    const startLabel =
      triggerModuleId === 'requests'
        ? 'Service Request Opened'
        : triggerModuleId === 'incidents'
        ? 'Incident Opened'
        : `${getModuleLabel(triggerModuleId)} Opened`;
    const closeLabel =
      triggerModuleId === 'requests'
        ? 'Close Request'
        : triggerModuleId === 'incidents'
        ? 'Close Incident'
        : 'Close / Complete Record';

    const mapStageType = (st: WorkflowStage['stepType']): ProcessNodeType => {
      if (st === 'approval') return 'approval';
      if (st === 'condition') return 'decision';
      if (st === 'notification') return 'notification';
      if (st === 'automation' || st === 'delay') return 'automation';
      return 'action';
    };

    const nodes: ProcessNode[] = [
      {
        id: 'wf-trigger-open',
        label: startLabel,
        type: 'start',
        role: selectedTriggerDef?.label || 'Trigger',
        moduleId: triggerModuleId,
        slaHours: 1,
        x: wireframeCoords['wf-trigger-open']?.x ?? 48,
        y: wireframeCoords['wf-trigger-open']?.y ?? 128,
      },
      ...stages.map((st, idx) => ({
        id: st.id,
        label: st.name || st.actionLabel || `Step ${idx + 1}`,
        type: mapStageType(st.stepType),
        role: st.assigneeRole || getModuleLabel(st.moduleId || 'all'),
        moduleId: st.moduleId || 'all',
        slaHours: st.slaHours,
        x: wireframeCoords[st.id]?.x ?? 48 + (idx + 1) * 272,
        y: wireframeCoords[st.id]?.y ?? 128,
      })),
      {
        id: 'wf-close-gate',
        label: closeLabel,
        type: 'end',
        role: 'Resolution & Closure',
        moduleId: triggerModuleId,
        slaHours: 1,
        x: wireframeCoords['wf-close-gate']?.x ?? 48 + (stages.length + 1) * 272,
        y: wireframeCoords['wf-close-gate']?.y ?? 128,
      },
    ];

    const edges: ProcessEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      const stageMeta = stages.find(s => s.id === to.id);
      const cond =
        stageMeta?.branch === 'if_yes'
          ? 'If Yes'
          : stageMeta?.branch === 'if_no'
          ? 'If No'
          : from.type === 'approval'
          ? 'Approved'
          : to.type === 'end'
          ? 'Before Close'
          : 'Next';
      edges.push({ from: from.id, to: to.id, condition: cond });
    }

    return { nodes, edges };
  }, [triggerModuleId, selectedTriggerDef, stages, wireframeCoords]);

  const insertQuickWireframeStep = (
    insertAfterStageIdx: number,
    nodeType: Exclude<ProcessNodeType, 'start' | 'end'>
  ) => {
    const palette = WIREFRAME_NODE_PALETTE.find(p => p.type === nodeType) || WIREFRAME_NODE_PALETTE[0];
    const stepTypeMap: Record<Exclude<ProcessNodeType, 'start' | 'end'>, WorkflowStage['stepType']> = {
      action: 'task',
      approval: 'approval',
      decision: 'condition',
      notification: 'notification',
      automation: 'automation',
    };
    const newId = `STP-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`;
    const newStep: WorkflowStage = {
      id: newId,
      name: palette.defaultTitle,
      stepType: stepTypeMap[nodeType],
      moduleId: triggerModuleId === 'requests' ? 'requests' : triggerModuleId === 'incidents' ? 'incidents' : 'all',
      actionKey:
        nodeType === 'approval'
          ? 'approval_gate'
          : nodeType === 'decision'
          ? 'condition_branch'
          : nodeType === 'notification'
          ? 'send_notification'
          : undefined,
      actionLabel: palette.defaultTitle,
      assigneeRole: palette.defaultRole,
      slaHours: palette.defaultSla,
      branch: 'main',
      config: {},
    };
    setStages(prev => {
      const next = [...prev];
      const targetIdx = Math.max(0, Math.min(next.length, insertAfterStageIdx + 1));
      next.splice(targetIdx, 0, newStep);
      return next;
    });
    setExpandedStepIds(prev => ({ ...prev, [newId]: true }));
    setSelectedWireframeNodeId(newId);
    setWireframeCoords({});
  };

  const openNewWorkflowDesigner = () => {
    setEditingWorkflowId(null);
    setName('');
    setDescription('');
    setStatus('active');
    setTriggerModuleId('incidents');
    setTriggerEventKey('incident_created');
    setTriggerConditionField('');
    setTriggerConditionOperator('equals');
    setTriggerConditionValue('');
    setStages([
      {
        id: `STP-${Date.now().toString().slice(-4)}`,
        name: 'Start and Wait for Approval',
        stepType: 'approval',
        moduleId: 'all',
        actionKey: 'approval_gate',
        actionLabel: 'Start and Wait for Approval',
        assigneeRole: 'Department Lead',
        slaHours: 8,
        branch: 'main',
        config: { approverGroup: 'IT Manager', approvalMode: 'First to respond' }
      }
    ]);
    setExpandedStepIds({});
    setPickerInsertIndex(null);
    setShowDesigner(true);
  };

  const openEditWorkflowDesigner = (wf: WorkflowDefinition) => {
    setEditingWorkflowId(wf.id);
    setName(wf.name);
    setDescription(wf.description || '');
    setStatus(wf.status);
    const modId = wf.triggerConfig?.moduleId || wf.targetModuleId || 'all';
    setTriggerModuleId(modId);
    const trigs = getTriggersForModule(modId);
    setTriggerEventKey(wf.triggerConfig?.eventKey || trigs[0]?.key || 'manual_trigger');
    setTriggerConditionField(wf.triggerConfig?.conditionField || '');
    setTriggerConditionOperator(wf.triggerConfig?.conditionOperator || 'equals');
    setTriggerConditionValue(wf.triggerConfig?.conditionValue || '');
    setStages(wf.stages.map(s => ({ ...s, config: { ...(s.config || {}) } })));
    const expanded: Record<string, boolean> = {};
    if (wf.stages[0]) expanded[wf.stages[0].id] = true;
    setExpandedStepIds(expanded);
    setPickerInsertIndex(null);
    setShowDesigner(true);
  };

  const insertStepAt = (
    insertAfterIndex: number,
    modId: FreeITSMModuleId | 'all',
    actionDef: WorkflowActionDef
  ) => {
    const newId = `STP-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`;
    const defaultConfig: Record<string, string> = {};
    actionDef.fields.forEach(f => {
      if (f.defaultValue) defaultConfig[f.key] = f.defaultValue;
    });
    const newStep: WorkflowStage = {
      id: newId,
      name: actionDef.label,
      stepType: actionDef.stepType,
      moduleId: modId,
      actionKey: actionDef.key,
      actionLabel: actionDef.label,
      assigneeRole: actionDef.defaultRole,
      slaHours: 4,
      branch: 'main',
      config: defaultConfig
    };

    setStages(prev => {
      const next = [...prev];
      next.splice(insertAfterIndex + 1, 0, newStep);
      return next;
    });
    setExpandedStepIds(prev => ({ ...prev, [newId]: true }));
    setPickerInsertIndex(null);
    setPickerSearch('');
  };

  const updateStep = (stepId: string, patch: Partial<WorkflowStage>) => {
    setStages(prev => prev.map(s => (s.id === stepId ? { ...s, ...patch } : s)));
  };

  const updateStepModule = (stepId: string, newModuleId: FreeITSMModuleId | 'all') => {
    const actions = getActionsForModule(newModuleId);
    const firstAction = actions[0];
    const defaultConfig: Record<string, string> = {};
    firstAction?.fields.forEach(f => {
      if (f.defaultValue) defaultConfig[f.key] = f.defaultValue;
    });
    setStages(prev =>
      prev.map(s =>
        s.id === stepId
          ? {
              ...s,
              moduleId: newModuleId,
              actionKey: firstAction?.key,
              actionLabel: firstAction?.label,
              stepType: firstAction?.stepType || s.stepType,
              name: firstAction?.label || s.name,
              assigneeRole: firstAction?.defaultRole || s.assigneeRole,
              config: defaultConfig
            }
          : s
      )
    );
  };

  const updateStepAction = (stepId: string, modId: FreeITSMModuleId | 'all', actionKey: string) => {
    const actionDef = getActionsForModule(modId).find(a => a.key === actionKey);
    if (!actionDef) return;
    const defaultConfig: Record<string, string> = {};
    actionDef.fields.forEach(f => {
      if (f.defaultValue) defaultConfig[f.key] = f.defaultValue;
    });
    setStages(prev =>
      prev.map(s =>
        s.id === stepId
          ? {
              ...s,
              actionKey: actionDef.key,
              actionLabel: actionDef.label,
              stepType: actionDef.stepType,
              name: actionDef.label,
              assigneeRole: actionDef.defaultRole,
              config: defaultConfig
            }
          : s
      )
    );
  };

  const updateStepConfigField = (stepId: string, key: string, value: string) => {
    setStages(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, config: { ...(s.config || {}), [key]: value } }
          : s
      )
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    setStages(prev => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const duplicateStep = (index: number) => {
    const source = stages[index];
    if (!source) return;
    const cloneId = `STP-${Date.now().toString().slice(-5)}`;
    const clone: WorkflowStage = {
      ...source,
      id: cloneId,
      name: `${source.name} (Copy)`,
      config: { ...(source.config || {}) }
    };
    setStages(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
    setExpandedStepIds(prev => ({ ...prev, [cloneId]: true }));
  };

  const removeStep = (stepId: string) => {
    setStages(prev => prev.filter(s => s.id !== stepId));
  };

  const handleSaveWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trigConfig: WorkflowTriggerConfig = {
      moduleId: triggerModuleId,
      eventKey: selectedTriggerDef?.key || triggerEventKey,
      eventLabel: selectedTriggerDef?.label || 'Module Trigger',
      conditionField: triggerConditionField.trim() || undefined,
      conditionOperator: triggerConditionField.trim() ? triggerConditionOperator : undefined,
      conditionValue: triggerConditionField.trim() ? triggerConditionValue.trim() : undefined
    };

    const legacyTrigger: WorkflowDefinition['trigger'] =
      triggerModuleId === 'all' && triggerEventKey === 'manual_trigger'
        ? 'manual'
        : triggerModuleId === 'all' && triggerEventKey === 'recurrence_schedule'
        ? 'schedule'
        : triggerModuleId === 'requests'
        ? 'service_request'
        : triggerModuleId === 'changes'
        ? 'change_request'
        : triggerModuleId === 'assets'
        ? 'asset_lifecycle'
        : 'module_event';

    if (editingWorkflowId) {
      updateWorkflow(editingWorkflowId, {
        name: name.trim(),
        description: description.trim(),
        status,
        targetModuleId: triggerModuleId,
        trigger: legacyTrigger,
        triggerConfig: trigConfig,
        stages
      });
      setSelectedId(editingWorkflowId);
    } else {
      const created = createWorkflow({
        name: name.trim(),
        description: description.trim(),
        status,
        targetModuleId: triggerModuleId,
        trigger: legacyTrigger,
        triggerConfig: trigConfig,
        stages
      });
      setSelectedId(created.id);
    }

    setShowDesigner(false);
    setEditingWorkflowId(null);
  };

  const renderAddStepConnector = (insertAfterIndex: number, label = 'Add a step') => {
    const isPickerHere = pickerInsertIndex === insertAfterIndex;
    return (
      <div className="flex flex-col items-center">
        <div className="w-px h-4 bg-neutral-700" />
        <button
          type="button"
          onClick={() => {
            setPickerInsertIndex(isPickerHere ? null : insertAfterIndex);
            setPickerSearch('');
          }}
          className={`px-3 py-1.5 border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
            isPickerHere
              ? 'border-rose-500 bg-rose-600 text-white'
              : 'border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-500 text-neutral-200'
          }`}
        >
          {isPickerHere ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3 text-rose-400" />}
          <span>{isPickerHere ? 'Close Action Picker' : label}</span>
        </button>

        {isPickerHere && (
          <div className="w-full max-w-3xl mt-2 border border-rose-500/60 bg-neutral-950 p-4 space-y-3 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-rose-400">
                  Choose a Module &amp; Action
                </div>
                <div className="text-[11px] text-neutral-500">
                  Select an operation from any Scribble IT module or built-in logic controller
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerInsertIndex(null)}
                className="text-neutral-500 hover:text-neutral-200 self-start sm:self-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search actions (approval, incident, IAM, chat, delay...)"
                  className="w-full bg-neutral-900 border border-neutral-700 pl-8 pr-3 py-1.5 text-neutral-100"
                />
              </div>
              <select
                value={pickerModuleFilter}
                onChange={e => setPickerModuleFilter(e.target.value as typeof pickerModuleFilter)}
                className="sm:col-span-6 bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
              >
                <option value="ALL_MODULES">All Modules ({ALL_WORKFLOW_MODULES.length})</option>
                {MODULE_GROUPS.map(group => (
                  <optgroup key={group} label={group}>
                    {ALL_WORKFLOW_MODULES.filter(m => m.group === group).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
              {pickerActionResults.map(item => (
                <button
                  key={`${item.moduleId}-${item.action.key}`}
                  type="button"
                  onClick={() => insertStepAt(insertAfterIndex, item.moduleId, item.action)}
                  className="text-left p-2.5 border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 hover:border-rose-500/70 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500 uppercase">
                    <span className="truncate">{item.moduleLabel}</span>
                    <span className="text-rose-400 shrink-0">{item.action.stepType}</span>
                  </div>
                  <div className="font-bold text-neutral-100 mt-0.5 truncate">
                    {item.action.label}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                    {item.action.description}
                  </div>
                </button>
              ))}
              {pickerActionResults.length === 0 && (
                <div className="col-span-full p-4 text-center text-neutral-500 border border-neutral-800">
                  No actions match your filter.
                </div>
              )}
            </div>
          </div>
        )}
        <div className="w-px h-4 bg-neutral-700" />
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">
            {activeTenant.name} · MULTI-MODULE FLOW AUTOMATION
          </div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Workflow className="w-5 h-5 text-rose-500" />
            <span>WORKFLOW MANAGEMENT</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              {workflows.length} Flows
            </span>
          </h1>
        </div>
        <button
          onClick={() => (showDesigner ? setShowDesigner(false) : openNewWorkflowDesigner())}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          {showDesigner ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showDesigner ? 'Close Flow Designer' : 'Create Automated Flow'}</span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-neutral-800 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800 bg-neutral-950">
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Total Flows</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">{workflows.length}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Active Flows</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
            {workflows.filter(w => w.status === 'active').length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Total Executions</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">
            {workflows.reduce((sum, w) => sum + w.executionCount, 0)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Total Connected Steps</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">
            {workflows.reduce((sum, w) => sum + w.stages.length, 0)}
          </div>
        </div>
      </div>

      {/* Power Automate-Style Workflow Creator / Editor */}
      {showDesigner && (
        <form onSubmit={handleSaveWorkflow} className="border border-neutral-700 bg-neutral-900/30 p-5 space-y-6">
          {/* Flow Properties Bar + Designer View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-neutral-100 font-bold uppercase tracking-wider">
                {editingWorkflowId ? `Edit Flow · ${editingWorkflowId}` : 'Lifecycle Workflow Designer (Open → Pre-Close → Close)'}
              </div>
              <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                1 Open Trigger · {stages.length} Pre-Close Step{stages.length === 1 ? '' : 's'} · 1 Close Gate
              </div>
            </div>

            <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDesignerView('wireframe')}
                className={`min-h-[34px] px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  designerView === 'wireframe'
                    ? 'bg-sky-950/60 border border-sky-700/80 text-sky-300'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Figma Wireframe</span>
              </button>
              <button
                type="button"
                onClick={() => setDesignerView('list')}
                className={`min-h-[34px] px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  designerView === 'list'
                    ? 'bg-neutral-800 border border-neutral-600 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Step List</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-neutral-400 mb-1">Flow Name *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Incident / Request Pre-Close Approval & Action Flow"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-neutral-400 mb-1">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Cross-module orchestration details"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-neutral-400 mb-1">Flow State</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as WorkflowDefinition['status'])}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          {/* Interactive Figma Wireframe Canvas View */}
          {designerView === 'wireframe' && (
            <div className="space-y-4">
              <FigmaWireframeCanvas
                nodes={wireframeGraph.nodes}
                edges={wireframeGraph.edges}
                selectedNodeId={selectedWireframeNodeId}
                onSelectNode={nodeId => {
                  setSelectedWireframeNodeId(nodeId);
                  if (nodeId && stages.some(s => s.id === nodeId)) {
                    setExpandedStepIds(prev => ({ ...prev, [nodeId]: true }));
                  }
                }}
                onChangeGraph={updatedNodes => {
                  const nextCoords: Record<string, { x: number; y: number }> = {};
                  updatedNodes.forEach(n => {
                    nextCoords[n.id] = { x: n.x, y: n.y };
                  });
                  setWireframeCoords(nextCoords);
                }}
                onInsertBetweenEdge={(edgeIdx, nodeType) => {
                  // edgeIdx 0 is between Trigger and Stage 0 -> insertAfter -1; edgeIdx k -> insertAfter k-1
                  insertQuickWireframeStep(edgeIdx - 1, nodeType);
                }}
                onQuickAddBeforeClose={nodeType => {
                  insertQuickWireframeStep(stages.length - 1, nodeType);
                }}
                frameTitle={`${name || 'New Lifecycle Workflow'} · ${getModuleLabel(triggerModuleId)}`}
              />
              <div className="text-[11px] text-neutral-400">
                Configure trigger criteria and selected pre-close steps below, or click <strong className="text-sky-300">+</strong> on any connector wire above to insert an Action, Approval, Condition, Notification, or Automation before Close.
              </div>
            </div>
          )}

          {/* Vertical Flow Canvas / Step Configuration Cards */}
          <div className="flex flex-col items-center py-2">
            {/* STEP 0: TRIGGER NODE */}
            <div className="w-full max-w-3xl border border-sky-700/70 bg-neutral-950 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-sky-600/20 border border-sky-600 text-sky-400 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-[10px] text-sky-400 font-bold uppercase">
                      Trigger · When this happens
                    </div>
                    <div className="text-sm font-bold text-neutral-100">
                      {getModuleLabel(triggerModuleId)} — {selectedTriggerDef?.label}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-500 uppercase">
                  All Module Trigger
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Trigger Source Module (All Modules)</label>
                  <select
                    value={triggerModuleId}
                    onChange={e => handleTriggerModuleChange(e.target.value as FreeITSMModuleId | 'all')}
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  >
                    {MODULE_GROUPS.map(group => (
                      <optgroup key={group} label={group}>
                        {ALL_WORKFLOW_MODULES.filter(m => m.group === group).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Trigger Event</label>
                  <select
                    value={triggerEventKey}
                    onChange={e => setTriggerEventKey(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  >
                    {availableTriggers.map(tr => (
                      <option key={tr.key} value={tr.key}>
                        {tr.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Trigger Condition Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-neutral-900">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] text-neutral-500 mb-1">
                    Trigger Filter Field (Optional)
                  </label>
                  <input
                    value={triggerConditionField}
                    onChange={e => setTriggerConditionField(e.target.value)}
                    placeholder={`e.g. ${selectedTriggerDef?.suggestedFields.join(', ') || 'priority'}`}
                    className="w-full bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-neutral-100"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] text-neutral-500 mb-1">Operator</label>
                  <select
                    value={triggerConditionOperator}
                    onChange={e =>
                      setTriggerConditionOperator(
                        e.target.value as NonNullable<WorkflowTriggerConfig['conditionOperator']>
                      )
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-neutral-100"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="contains">contains</option>
                    <option value="greater_than">greater than</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] text-neutral-500 mb-1">Match Value</label>
                  <input
                    value={triggerConditionValue}
                    onChange={e => setTriggerConditionValue(e.target.value)}
                    placeholder="e.g. P1"
                    className="w-full bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-neutral-100"
                  />
                </div>
              </div>
            </div>

            {/* Connector right after Trigger */}
            {renderAddStepConnector(-1, stages.length === 0 ? 'Add first step' : 'Insert step')}

            {/* MULTI-STEP POWER AUTOMATE FLOW NODES */}
            {stages.map((step, idx) => {
              const stepModId = step.moduleId || 'all';
              const modActions = getActionsForModule(stepModId);
              const activeAction =
                modActions.find(a => a.key === step.actionKey) || modActions[0];
              const isExpanded = Boolean(expandedStepIds[step.id]);

              return (
                <React.Fragment key={step.id}>
                  <div
                    className={`w-full max-w-3xl border bg-neutral-950 transition-colors ${
                      step.stepType === 'condition'
                        ? 'border-amber-700/70'
                        : step.stepType === 'approval'
                        ? 'border-emerald-800/70'
                        : 'border-neutral-800'
                    }`}
                  >
                    {/* Step Header Bar */}
                    <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 bg-neutral-900/40">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStepIds(prev => ({ ...prev, [step.id]: !isExpanded }))
                        }
                        className="flex items-center gap-3 text-left min-w-0 flex-1"
                      >
                        <span className="w-6 h-6 border border-neutral-700 bg-neutral-950 text-neutral-200 font-bold flex items-center justify-center tabular-nums shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500 uppercase">
                            <span className="text-neutral-300 font-bold">
                              {getModuleLabel(stepModId)}
                            </span>
                            <span>·</span>
                            <span>{step.stepType.replace('_', ' ')}</span>
                            {step.branch && step.branch !== 'main' && (
                              <>
                                <span>·</span>
                                <span
                                  className={
                                    step.branch === 'if_yes'
                                      ? 'text-emerald-400 font-bold'
                                      : 'text-rose-400 font-bold'
                                  }
                                >
                                  {step.branch === 'if_yes' ? 'IF YES BRANCH' : 'IF NO BRANCH'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="font-bold text-neutral-100 truncate">
                            {step.name || activeAction?.label}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                          title="Move step up"
                          className="p-1.5 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx === stages.length - 1}
                          title="Move step down"
                          className="p-1.5 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateStep(idx)}
                          title="Duplicate step"
                          className="p-1.5 border border-neutral-800 text-neutral-400 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStepIds(prev => ({ ...prev, [step.id]: !isExpanded }))
                          }
                          title={isExpanded ? 'Collapse step' : 'Configure step'}
                          className="p-1.5 border border-neutral-800 text-neutral-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          title="Delete step"
                          className="p-1.5 border border-neutral-800 text-neutral-500 hover:text-rose-400 hover:border-rose-900"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Step Configuration Body */}
                    {isExpanded && (
                      <div className="p-4 border-t border-neutral-800 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-4">
                            <label className="block text-neutral-400 mb-1">Step Name</label>
                            <input
                              value={step.name}
                              onChange={e => updateStep(step.id, { name: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-neutral-400 mb-1">Target Module</label>
                            <select
                              value={stepModId}
                              onChange={e =>
                                updateStepModule(step.id, e.target.value as FreeITSMModuleId | 'all')
                              }
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                            >
                              {MODULE_GROUPS.map(group => (
                                <optgroup key={group} label={group}>
                                  {ALL_WORKFLOW_MODULES.filter(m => m.group === group).map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-neutral-400 mb-1">Action</label>
                            <select
                              value={step.actionKey || activeAction?.key || ''}
                              onChange={e => updateStepAction(step.id, stepModId, e.target.value)}
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                            >
                              {modActions.map(act => (
                                <option key={act.key} value={act.key}>
                                  {act.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-neutral-400 mb-1">Execution Branch</label>
                            <select
                              value={step.branch || 'main'}
                              onChange={e =>
                                updateStep(step.id, {
                                  branch: e.target.value as WorkflowStage['branch']
                                })
                              }
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                            >
                              <option value="main">Main Sequence</option>
                              <option value="if_yes">If Condition = YES (True)</option>
                              <option value="if_no">If Condition = NO (False)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1">Assignee / Actor Role</label>
                            <input
                              value={step.assigneeRole}
                              onChange={e => updateStep(step.id, { assigneeRole: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1">Step SLA (Hours)</label>
                            <input
                              type="number"
                              min="1"
                              value={step.slaHours}
                              onChange={e =>
                                updateStep(step.id, { slaHours: Number(e.target.value) || 1 })
                              }
                              className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100 tabular-nums"
                            />
                          </div>
                        </div>

                        {/* Dynamic Action Input Fields */}
                        {activeAction && activeAction.fields.length > 0 && (
                          <div className="border-t border-neutral-900 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeAction.fields.map(field => {
                              const val = step.config?.[field.key] ?? field.defaultValue ?? '';
                              return (
                                <div
                                  key={field.key}
                                  className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
                                >
                                  <label className="block text-[11px] text-neutral-400 mb-1">
                                    {field.label}
                                  </label>
                                  {field.type === 'select' && field.options ? (
                                    <select
                                      value={val}
                                      onChange={e =>
                                        updateStepConfigField(step.id, field.key, e.target.value)
                                      }
                                      className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                                    >
                                      {field.options.map(opt => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  ) : field.type === 'textarea' ? (
                                    <textarea
                                      rows={2}
                                      value={val}
                                      onChange={e =>
                                        updateStepConfigField(step.id, field.key, e.target.value)
                                      }
                                      placeholder={field.placeholder}
                                      className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                                    />
                                  ) : (
                                    <input
                                      type={field.type === 'number' ? 'number' : 'text'}
                                      value={val}
                                      onChange={e =>
                                        updateStepConfigField(step.id, field.key, e.target.value)
                                      }
                                      placeholder={field.placeholder}
                                      className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connector between steps / bottom "+ Insert before Close" */}
                  {renderAddStepConnector(
                    idx,
                    idx === stages.length - 1 ? '+ Add Action / Approval Before Close' : 'Insert step'
                  )}
                </React.Fragment>
              );
            })}

            {/* ANCHORED CLOSE RECORD GATE */}
            <div className="w-full max-w-3xl border border-rose-700/70 bg-neutral-950 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 bg-rose-600/20 border border-rose-600 text-rose-400 flex items-center justify-center shrink-0">
                  <Flag className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] text-rose-400 font-bold uppercase">
                    Lifecycle Completion Gate
                  </div>
                  <div className="font-bold text-neutral-100 truncate">
                    {triggerModuleId === 'requests'
                      ? 'Close Service Request'
                      : triggerModuleId === 'incidents'
                      ? 'Resolve & Close Incident'
                      : 'Complete & Close Record'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-neutral-500 uppercase shrink-0">
                Executes After All Pre-Close Steps
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDesigner(false);
                setEditingWorkflowId(null);
              }}
              className="px-4 py-2 border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {editingWorkflowId ? 'Save Changes' : 'Save Automated Flow'}
            </button>
          </div>
        </form>
      )}

      {/* Saved Flows Library + Flow Diagram & Execution Trace Inspector */}
      {workflows.length === 0 ? (
        <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-3">
          <Workflow className="w-7 h-7 text-neutral-600 mx-auto" />
          <div className="text-neutral-200 font-bold">No Automated Flows Configured</div>
          <p className="text-neutral-500 max-w-md mx-auto">
            Build multi-step automation flows across any Scribble IT module with triggers, conditions, approvals, and actions.
          </p>
          <button
            onClick={openNewWorkflowDesigner}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            + Create First Automated Flow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Flow List */}
          <div className="lg:col-span-4 border border-neutral-800 divide-y divide-neutral-900 bg-neutral-950">
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => setSelectedId(wf.id)}
                className={`w-full text-left p-4 transition-colors ${
                  selected?.id === wf.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    {wf.id} · {getModuleLabel(wf.triggerConfig?.moduleId || wf.targetModuleId)}
                  </span>
                  <span
                    className={
                      wf.status === 'active'
                        ? 'text-emerald-400 font-bold'
                        : wf.status === 'paused'
                        ? 'text-amber-400'
                        : 'text-neutral-500'
                    }
                  >
                    {wf.status.toUpperCase()}
                  </span>
                </div>
                <div className="font-bold text-neutral-100 mt-1">{wf.name}</div>
                <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                  {wf.stages.length} steps · {wf.executionCount} runs
                </div>
              </button>
            ))}
          </div>

          {/* Flow Diagram & Run History Inspector */}
          {selected && (
            <div className="lg:col-span-8 border border-neutral-800 bg-neutral-950 p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                <div>
                  <div className="text-[11px] text-neutral-500 uppercase">
                    {selected.id} · {getModuleLabel(selected.triggerConfig?.moduleId || selected.targetModuleId)}
                  </div>
                  <h2 className="text-base font-bold text-neutral-100 mt-0.5">{selected.name}</h2>
                  {selected.description && (
                    <p className="text-neutral-400 mt-1">{selected.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => runWorkflowExecution(selected.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test / Run Flow</span>
                  </button>
                  <button
                    onClick={() => openEditWorkflowDesigner(selected)}
                    className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Steps</span>
                  </button>
                  <button
                    onClick={() =>
                      toggleWorkflowStatus(selected.id, selected.status === 'active' ? 'paused' : 'active')
                    }
                    className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5"
                  >
                    {selected.status === 'active' ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => deleteWorkflow(selected.id)}
                    className="px-2.5 py-1.5 border border-neutral-800 text-neutral-500 hover:text-rose-400 hover:border-rose-900"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Trigger + Step Vertical Preview */}
              <div className="space-y-0 flex flex-col items-center">
                <div className="w-full p-3.5 border border-sky-800/60 bg-neutral-900/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-sky-400 uppercase font-bold">
                        Trigger · {getModuleLabel(selected.triggerConfig?.moduleId || selected.targetModuleId)}
                      </div>
                      <div className="font-bold text-neutral-100">
                        {selected.triggerConfig?.eventLabel || selected.trigger.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  {selected.triggerConfig?.conditionField && (
                    <div className="text-[11px] text-neutral-400">
                      Filter: {selected.triggerConfig.conditionField} {selected.triggerConfig.conditionOperator}{' '}
                      {selected.triggerConfig.conditionValue}
                    </div>
                  )}
                </div>

                {selected.stages.map((stg, idx) => (
                  <React.Fragment key={stg.id}>
                    <div className="w-px h-4 bg-neutral-700" />
                    <div className="w-full p-3.5 border border-neutral-800 bg-neutral-900/30 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 border border-neutral-700 bg-neutral-950 flex items-center justify-center text-neutral-300 font-bold tabular-nums shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase">
                            <span>{getModuleLabel(stg.moduleId)}</span>
                            <span>·</span>
                            <span>{stg.actionLabel || stg.stepType}</span>
                            {stg.branch && stg.branch !== 'main' && (
                              <>
                                <span>·</span>
                                <span className={stg.branch === 'if_yes' ? 'text-emerald-400' : 'text-rose-400'}>
                                  {stg.branch === 'if_yes' ? 'IF YES' : 'IF NO'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="font-bold text-neutral-100">{stg.name}</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-neutral-400 tabular-nums flex items-center gap-2">
                        <GitBranch className="w-3 h-3 text-neutral-600" />
                        <span>{stg.assigneeRole}</span>
                        <span>·</span>
                        <span>{stg.slaHours}h SLA</span>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Last Run Trace */}
              {selected.lastRunTrace && selected.lastRunTrace.length > 0 && (
                <div className="border-t border-neutral-800 pt-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 uppercase font-bold">
                    <span>Latest Run Execution Trace</span>
                    <span className="text-neutral-500 font-normal flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {selected.lastExecutedAt ? new Date(selected.lastExecutedAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <div className="border border-neutral-800 divide-y divide-neutral-900">
                    {selected.lastRunTrace.map((t, i) => (
                      <div key={`${t.stepId}-${i}`} className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-emerald-400 font-bold mr-2">[SUCCEEDED]</span>
                          <span className="text-neutral-200 font-bold">{t.stepName}</span>
                          <span className="text-neutral-500 ml-2">({t.moduleLabel})</span>
                          <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{t.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
