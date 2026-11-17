import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { IncidentCategory, IncidentPriority, IncidentStatus } from '../../types/itsm';
import { GitCommitHorizontal, Plus, Power, Trash2, ArrowRight } from 'lucide-react';

const STATE_SEQUENCE: IncidentStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'pending',
  'resolved',
  'closed'
];

export const TicketWorkflowPage: React.FC = () => {
  const {
    activeTenant,
    ticketWorkflows,
    incidents,
    createTicketWorkflow,
    toggleTicketWorkflow,
    deleteTicketWorkflow
  } = useITSM();

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [name, setName] = useState('');
  const [sourceChannel, setSourceChannel] = useState<'all' | 'portal' | 'email' | 'phone' | 'monitor'>('all');
  const [matchCategory, setMatchCategory] = useState<'all' | IncidentCategory>('all');
  const [matchPriority, setMatchPriority] = useState<'all' | IncidentPriority>('all');
  const [assignToQueue, setAssignToQueue] = useState(activeTenant.preferenceTemplate.defaultQueue);
  const [overrideSlaHours, setOverrideSlaHours] = useState('');
  const [autoEscalateAfterMins, setAutoEscalateAfterMins] = useState('');
  const [notifyRolesInput, setNotifyRolesInput] = useState('Assignee, Service Desk Lead');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTicketWorkflow({
      name: name.trim(),
      active: true,
      sourceChannel,
      matchCategory,
      matchPriority,
      assignToQueue: assignToQueue.trim() || activeTenant.preferenceTemplate.defaultQueue,
      overrideSlaHours: overrideSlaHours ? Number(overrideSlaHours) : undefined,
      autoEscalateAfterMins: autoEscalateAfterMins ? Number(autoEscalateAfterMins) : undefined,
      notifyRoles: notifyRolesInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    });
    setName('');
    setOverrideSlaHours('');
    setAutoEscalateAfterMins('');
    setShowRuleForm(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">
            {activeTenant.name} · INCIDENT TRIAGE, SLA OVERRIDES & STATE ENGINE
          </div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <GitCommitHorizontal className="w-5 h-5 text-rose-500" />
            <span>TICKET WORKFLOW MANAGEMENT</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              {ticketWorkflows.length} Routing Rules
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowRuleForm(!showRuleForm)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showRuleForm ? 'Close Rule Form' : 'New Routing Rule'}</span>
        </button>
      </div>

      {/* Live Ticket State Machine */}
      <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 uppercase font-bold">
          <span>Active Ticket Lifecycle Pipeline</span>
          <span className="text-neutral-500 font-normal">Live Tenant Distribution</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STATE_SEQUENCE.map((st, idx) => {
            const count = incidents.filter(i => i.status === st).length;
            return (
              <div
                key={st}
                className="p-3 border border-neutral-800 bg-neutral-900/40 flex items-center justify-between"
              >
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase">
                    {st.replace('_', ' ')}
                  </div>
                  <div className="text-lg font-bold text-neutral-100 tabular-nums mt-0.5">
                    {count}
                  </div>
                </div>
                {idx < STATE_SEQUENCE.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Ticket Workflow Rule Form */}
      {showRuleForm && (
        <form onSubmit={handleCreateRule} className="border border-neutral-700 bg-neutral-900/40 p-5 space-y-4">
          <div className="text-neutral-200 font-bold uppercase tracking-wider border-b border-neutral-800 pb-2">
            Configure Automatic Ticket Triage Rule
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-neutral-400 mb-1">Rule Name *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. P1 Security Escalation Route"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Source Channel Match</label>
              <select
                value={sourceChannel}
                onChange={e => setSourceChannel(e.target.value as typeof sourceChannel)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              >
                <option value="all">All Channels</option>
                <option value="portal">Self-Service Portal</option>
                <option value="email">Inbound Email</option>
                <option value="phone">Telephony CTI</option>
                <option value="monitor">System Monitor</option>
              </select>
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Category Match</label>
              <select
                value={matchCategory}
                onChange={e => setMatchCategory(e.target.value as typeof matchCategory)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              >
                <option value="all">All Categories</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="security">Security</option>
                <option value="access">Access & IAM</option>
                <option value="telephony">Telephony</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-neutral-400 mb-1">Priority Match</label>
              <select
                value={matchPriority}
                onChange={e => setMatchPriority(e.target.value as typeof matchPriority)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              >
                <option value="all">Any Priority</option>
                <option value="P1">P1 Critical</option>
                <option value="P2">P2 High</option>
                <option value="P3">P3 Medium</option>
                <option value="P4">P4 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Target Assignee / Queue *</label>
              <input
                required
                value={assignToQueue}
                onChange={e => setAssignToQueue(e.target.value)}
                placeholder="e.g. SecOps SOC Tier 2"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">SLA Override (Hours)</label>
              <input
                type="number"
                min="1"
                value={overrideSlaHours}
                onChange={e => setOverrideSlaHours(e.target.value)}
                placeholder="Optional (uses tenant SLA)"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Auto-Escalate (Mins)</label>
              <input
                type="number"
                min="5"
                value={autoEscalateAfterMins}
                onChange={e => setAutoEscalateAfterMins(e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Notification Roles (comma-separated)</label>
            <input
              value={notifyRolesInput}
              onChange={e => setNotifyRolesInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRuleForm(false)}
              className="px-4 py-2 border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">
              Activate Routing Rule
            </button>
          </div>
        </form>
      )}

      {/* Rules Table */}
      {ticketWorkflows.length === 0 ? (
        <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-3">
          <GitCommitHorizontal className="w-7 h-7 text-neutral-600 mx-auto" />
          <div className="text-neutral-200 font-bold">No Ticket Routing Rules Configured</div>
          <p className="text-neutral-500 max-w-md mx-auto">
            Rules defined here evaluate automatically when new tickets arrive via Portal, Email, Telephony, or Monitoring.
          </p>
          <button
            onClick={() => setShowRuleForm(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            + Add Routing Rule
          </button>
        </div>
      ) : (
        <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50 text-[11px] text-neutral-400 uppercase">
                <th className="py-3 px-4">Rule</th>
                <th className="py-3 px-4">Match Criteria</th>
                <th className="py-3 px-4">Auto-Assign Queue</th>
                <th className="py-3 px-4">SLA / Escalation</th>
                <th className="py-3 px-4 text-right">Matched</th>
                <th className="py-3 px-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {ticketWorkflows.map(rule => (
                <tr key={rule.id} className="hover:bg-neutral-900/30">
                  <td className="py-3 px-4">
                    <div className="font-bold text-neutral-100">{rule.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      {rule.id} ·{' '}
                      <span className={rule.active ? 'text-emerald-400' : 'text-neutral-500'}>
                        {rule.active ? 'ENABLED' : 'PAUSED'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-neutral-300">
                    <div>Channel: {rule.sourceChannel.toUpperCase()}</div>
                    <div className="text-[11px] text-neutral-500">
                      Cat: {rule.matchCategory} · Prio: {rule.matchPriority}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-neutral-200 font-bold">{rule.assignToQueue}</td>
                  <td className="py-3 px-4 text-neutral-400 tabular-nums">
                    <div>{rule.overrideSlaHours ? `${rule.overrideSlaHours}h SLA override` : 'Tenant SLA'}</div>
                    <div className="text-[11px] text-neutral-500">
                      {rule.autoEscalateAfterMins ? `Escalate @ ${rule.autoEscalateAfterMins}m` : 'Manual escalation'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-neutral-100 tabular-nums">
                    {rule.executionCount}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => toggleTicketWorkflow(rule.id)}
                        className={`px-2.5 py-1 border text-[11px] flex items-center gap-1 ${
                          rule.active
                            ? 'border-emerald-800 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/60'
                            : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{rule.active ? 'Disable' : 'Enable'}</span>
                      </button>
                      <button
                        onClick={() => deleteTicketWorkflow(rule.id)}
                        className="p-1.5 border border-neutral-800 text-neutral-500 hover:text-rose-400 hover:border-rose-900"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
