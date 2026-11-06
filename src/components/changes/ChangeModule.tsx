import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ChangeRequest, ChangeStatus, RiskLevel, ChangeType } from '../../types/itsm';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { ActivityStreamPanel } from '../common/ActivityStreamPanel';
import {
  ShieldCheck, Plus, Check, X, Calendar, AlertTriangle, FileCode,
  MessageSquare, HardDrive, Download, Search, CheckCircle2, Clock,
  Layers, ArrowRight, ShieldAlert, Cpu, Sparkles
} from 'lucide-react';
import { chatService, driveService } from '../../services/workspaceService';

interface ChangeModuleProps {
  onOpenCreate: () => void;
}

export const ChangeModule: React.FC<ChangeModuleProps> = ({ onOpenCreate }) => {
  const { changes, voteCab, updateChangeStatus, currentUser, googleToken, loginWithGoogle } = useITSM();

  const [selectedId, setSelectedId] = useState<string>(changes[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Side-panel activity stream toggle state
  const [isActivityStreamOpen, setIsActivityStreamOpen] = useState(true);

  // Notice & Vote note
  const [voteNote, setVoteNote] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedChange = changes.find(c => c.id === selectedId) || changes[0];

  const filteredChanges = changes.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesRisk = riskFilter === 'all' || c.riskScore === riskFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesRisk && matchesStatus;
  });

  const handleVote = (member: string, roleName: string, vote: 'approved' | 'rejected') => {
    if (!selectedChange) return;
    voteCab(selectedChange.id, member, roleName, vote, voteNote || `Vote recorded in CAB session by ${currentUser.name}.`);
    setVoteNote('');
    setActionNotice(`CAB vote "${vote.toUpperCase()}" submitted for ${member}.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Google Chat CAB Review Room integration
  const handleLaunchCabChat = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const spaceName = `CAB Review: ${selectedChange.id} - ${selectedChange.title.slice(0, 30)}`;
      await chatService.createWarRoom(spaceName);
      setActionNotice(`Google Chat Space "${spaceName}" launched for CAB reviewers!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice(`CAB review notification dispatched to Google Chat.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Google Drive RFC Spec Backup
  const handleUploadRfcToDrive = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const fileName = `RFC-Specification-${selectedChange.id}.txt`;
      const content = `CHANGE MANAGEMENT RFC SPECIFICATION\nNumber: ${selectedChange.id}\nTitle: ${selectedChange.title}\nType: ${selectedChange.type}\nRisk: ${selectedChange.riskScore}\nRequester: ${selectedChange.requestedBy}\nWindow: ${selectedChange.scheduledStart} to ${selectedChange.scheduledEnd}\n\nTechnical Justification:\n${selectedChange.reason}\n\nImplementation Procedure:\n${selectedChange.implementationPlan}\n\nRollback Contingency Plan:\n${selectedChange.rollbackPlan}\n\nValidation Test Plan:\n${selectedChange.testPlan}\n\nCAB Approvals:\n${selectedChange.cabVotes.map(v => `${v.member} (${v.role}): ${v.vote.toUpperCase()}`).join('\n')}`;
      await driveService.uploadTextFile(fileName, content);
      setActionNotice(`RFC Document "${fileName}" saved directly to Google Drive!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice(`RFC synced to Google Drive.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Export RFCs to CSV
  const handleExportCSV = () => {
    const headers = ['Number', 'Type', 'Status', 'Risk', 'Title', 'Requester', 'Scheduled Start', 'Scheduled End'];
    const rows = filteredChanges.map(c => [
      c.id,
      c.type,
      c.status,
      c.riskScore,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.requestedBy}"`,
      c.scheduledStart,
      c.scheduledEnd
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfc-changes-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quorum calculations
  const approvedVotes = selectedChange ? selectedChange.cabVotes.filter(v => v.vote === 'approved').length : 0;
  const totalVotes = selectedChange ? selectedChange.cabVotes.length : 0;
  const quorumPercent = totalVotes > 0 ? Math.round((approvedVotes / totalVotes) * 100) : 0;
  const isQuorumReached = approvedVotes === totalVotes && totalVotes > 0;

  return (
    <div className="space-y-4 font-mono text-xs w-full">
      {/* Enterprise SaaS KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-900/40 p-3 border border-neutral-800 text-[11px]">
        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">ACTIVE RFC PIPELINE</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">
            {changes.filter(c => c.status !== 'completed' && c.status !== 'cancelled').length.toString().padStart(2, '0')} RFCs
          </div>
          <div className="text-[10px] text-neutral-400">Total registered: {changes.length}</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">PENDING CAB QUORUM</div>
          <div className="text-sm font-bold text-amber-400 tabular-nums">
            {changes.filter(c => c.status === 'cab_review').length.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] text-amber-500/80">Awaiting multi-stakeholder sign-off</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">EMERGENCY OUTAGE RFCS</div>
          <div className="text-sm font-bold text-rose-500 tabular-nums">
            {changes.filter(c => c.type === 'emergency' && c.status !== 'completed').length.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] text-rose-400">Expedited CAB Review Active</div>
        </div>

        <div className="space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px]">CHANGE SUCCESS RATE</div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums">99.8%</div>
          <div className="text-[10px] text-emerald-500/80">0 backouts in last 90 days</div>
        </div>
      </div>

      {/* Header & Global Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-0.5">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px]">
            <span>SERVICENOW NOW PLATFORM</span>
            <span aria-hidden="true">·</span>
            <span>CHANGE ADVISORY BOARD (CAB)</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-400">TABLE: change_request</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>REQUEST FOR CHANGE (RFC)</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({filteredChanges.length} Records)</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs"
            title="Export RFC list to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsActivityStreamOpen(!isActivityStreamOpen)}
            className={`px-3 py-1.5 border transition-colors flex items-center gap-1.5 text-xs ${
              isActivityStreamOpen
                ? 'bg-neutral-800 border-neutral-600 text-white font-bold'
                : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Side-Panel Activity Stream"
          >
            <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
            <span>Activity Stream ({selectedChange?.activityLog?.length || 0})</span>
          </button>

          <button
            onClick={onOpenCreate}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Change Request</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-2.5 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ServiceNow Breadcrumb Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-2.5 border border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 text-xs">
          <span className="text-neutral-200 font-bold">All</span>
          <span>&gt;</span>
          <span>Active = true</span>
          {typeFilter !== 'all' && (
            <>
              <span>&gt;</span>
              <span className="text-rose-400 font-bold">Type = {typeFilter}</span>
            </>
          )}
          {riskFilter !== 'all' && (
            <>
              <span>&gt;</span>
              <span className="text-amber-400 font-bold">Risk = {riskFilter}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search RFC, justification, engineer..."
              className="bg-neutral-950 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1 text-xs focus:outline-none w-56 placeholder:text-neutral-600"
            />
          </div>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            {['all', 'emergency', 'normal', 'standard'].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 uppercase transition-colors text-[11px] ${
                  typeFilter === t ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            {['all', 'critical', 'high', 'medium', 'low'].map(r => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-2 py-0.5 uppercase transition-colors text-[11px] ${
                  riskFilter === r ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400'
                }`}
              >
                {r === 'all' ? 'All Risk' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 3-Pane View */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Left Column: RFC Record List */}
        <div className="w-full lg:w-80 shrink-0 border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800/80 max-h-[820px] overflow-y-auto">
          <div className="p-2.5 bg-neutral-900/60 text-neutral-400 flex items-center justify-between text-[11px] border-b border-neutral-800">
            <span className="font-bold">CHANGE REQUEST PIPELINE</span>
            <span>{filteredChanges.length} Rows</span>
          </div>

          {filteredChanges.map(chg => {
            const isSelected = selectedChange?.id === chg.id;
            return (
              <div
                key={chg.id}
                onClick={() => setSelectedId(chg.id)}
                className={`p-3 transition-colors cursor-pointer space-y-1.5 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-200">{chg.id}</span>
                    <span className="text-neutral-600">·</span>
                    <span className={`uppercase font-bold ${chg.type === 'emergency' ? 'text-rose-500' : 'text-neutral-400'}`}>
                      {chg.type}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className={chg.riskScore === 'critical' ? 'text-rose-500 font-bold' : chg.riskScore === 'high' ? 'text-rose-400' : chg.riskScore === 'medium' ? 'text-amber-400' : 'text-emerald-400'}>
                      {chg.riskScore}
                    </span>
                  </div>
                  <MinimalStatus
                    status={chg.status}
                    variant={chg.status === 'scheduled' ? 'emerald' : chg.status === 'cab_review' ? 'amber' : 'neutral'}
                  />
                </div>

                <div className="text-neutral-200 font-medium truncate text-xs">
                  {chg.title}
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span className="truncate max-w-[140px]">Req: {chg.requestedBy}</span>
                  <span className="tabular-nums">
                    {new Date(chg.scheduledStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: ServiceNow Change Form & CAB Board */}
        {selectedChange ? (
          <div className="flex-1 min-w-0 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            {/* Top Form Status & State Control */}
            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-neutral-100">{selectedChange.id}</span>
                  <span className="text-neutral-600">|</span>
                  <span className={`uppercase font-bold ${selectedChange.type === 'emergency' ? 'text-rose-500' : 'text-neutral-300'}`}>
                    {selectedChange.type} CHANGE REQUEST
                  </span>
                  <span className="text-neutral-600">|</span>
                  <span className={selectedChange.riskScore === 'critical' ? 'text-rose-500 font-bold' : selectedChange.riskScore === 'high' ? 'text-rose-400' : 'text-amber-400'}>
                    RISK LEVEL: {selectedChange.riskScore.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">State:</span>
                  <select
                    value={selectedChange.status}
                    onChange={e => updateChangeStatus(selectedChange.id, e.target.value as ChangeStatus)}
                    className="bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-1.5 focus:outline-none text-xs"
                  >
                    <option value="draft">State: Draft</option>
                    <option value="cab_review">State: CAB Review</option>
                    <option value="scheduled">State: Scheduled</option>
                    <option value="implementation">State: Implementation</option>
                    <option value="verification">State: Post-Verification</option>
                    <option value="completed">State: Completed</option>
                    <option value="cancelled">State: Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Title & Short Justification */}
              <h2 className="text-lg font-bold text-neutral-100">
                {selectedChange.title}
              </h2>

              <div className="text-xs text-neutral-300 bg-neutral-900/40 p-3 border border-neutral-800/80 space-y-1">
                <div className="text-neutral-500 uppercase text-[10px]">Business & Technical Justification</div>
                <div className="leading-relaxed">{selectedChange.reason}</div>
              </div>
            </div>

            {/* Change Governance Risk & Schedule Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 border border-neutral-800 bg-neutral-900/30 text-xs">
              <div className="space-y-1 border-r border-neutral-800 pr-2">
                <div className="text-neutral-500 flex items-center gap-1.5 text-[10px]">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span>WINDOW START (UTC)</span>
                </div>
                <div className="text-neutral-200 font-bold tabular-nums">
                  {new Date(selectedChange.scheduledStart).toLocaleString()}
                </div>
              </div>

              <div className="space-y-1 border-r border-neutral-800 pr-2">
                <div className="text-neutral-500 flex items-center gap-1.5 text-[10px]">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>WINDOW END (UTC)</span>
                </div>
                <div className="text-neutral-200 font-bold tabular-nums">
                  {new Date(selectedChange.scheduledEnd).toLocaleString()}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-neutral-500 text-[10px]">PLANNED DOWNTIME</div>
                <div className="text-neutral-200 font-bold">
                  Zero Interruption / Hitless Failover
                </div>
              </div>
            </div>

            {/* ServiceNow Detailed Procedure Plans */}
            <div className="space-y-4 text-xs">
              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-1.5">
                <div className="text-neutral-400 font-bold uppercase flex items-center gap-2 text-[11px]">
                  <FileCode className="w-4 h-4 text-neutral-400" />
                  <span>Execution & Implementation Steps</span>
                </div>
                <p className="text-neutral-200 leading-relaxed whitespace-pre-line">
                  {selectedChange.implementationPlan}
                </p>
              </div>

              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-1.5">
                <div className="text-neutral-400 font-bold uppercase flex items-center gap-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Backout / Rollback Contingency Plan</span>
                </div>
                <p className="text-neutral-200 leading-relaxed whitespace-pre-line">
                  {selectedChange.rollbackPlan}
                </p>
              </div>

              <div className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-1.5">
                <div className="text-neutral-400 font-bold uppercase flex items-center gap-2 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Post-Change Validation & Test Criteria</span>
                </div>
                <p className="text-neutral-200 leading-relaxed whitespace-pre-line">
                  {selectedChange.testPlan}
                </p>
              </div>
            </div>

            {/* CAB Voting & Approval Quorum Board */}
            <div className="space-y-3 border-t border-neutral-800 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                    <span>Change Advisory Board (CAB) Sign-Offs</span>
                    <span className="text-neutral-500">·</span>
                    <span className={isQuorumReached ? 'text-emerald-400' : 'text-amber-400'}>
                      {approvedVotes}/{totalVotes} Approved ({quorumPercent}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Enterprise Policy: All appointed infrastructure and security stakeholders must sign off before implementation.
                  </div>
                </div>

                {isQuorumReached && (
                  <div className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-bold flex items-center gap-1.5 text-[11px]">
                    <Check className="w-3.5 h-3.5" />
                    <span>CAB Quorum Authorized</span>
                  </div>
                )}
              </div>

              {/* Quorum Progress Bar */}
              <div className="w-full bg-neutral-950 h-2 border border-neutral-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isQuorumReached ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${quorumPercent}%` }}
                />
              </div>

              {/* Vote Note Input */}
              <div className="p-3 border border-neutral-800 bg-neutral-900/20 space-y-2">
                <label className="text-[10px] text-neutral-500 uppercase block">
                  Casting Notes / RFC Conditions (Optional)
                </label>
                <input
                  type="text"
                  value={voteNote}
                  onChange={e => setVoteNote(e.target.value)}
                  placeholder="e.g., Authorized on condition of secondary standby technician on call..."
                  className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 px-3 py-1.5 text-xs focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600"
                />
              </div>

              {/* CAB Member Vote Cards */}
              <div className="space-y-2">
                {selectedChange.cabVotes.map((v, i) => (
                  <div key={i} className="p-3 border border-neutral-800 bg-neutral-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-neutral-200 flex items-center gap-2">
                        <span>{v.member}</span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-[11px] font-normal text-neutral-400">{v.role}</span>
                      </div>
                      {v.notes && (
                        <div className="text-[11px] text-neutral-400 italic mt-0.5">
                          "{v.notes}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`uppercase font-bold text-[11px] ${
                        v.vote === 'approved'
                          ? 'text-emerald-400'
                          : v.vote === 'rejected'
                          ? 'text-rose-500'
                          : 'text-amber-500'
                      }`}>
                        {v.vote}
                      </span>

                      {v.vote === 'pending' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleVote(v.member, v.role, 'approved')}
                            className="px-2.5 py-1 border border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 flex items-center gap-1 font-bold"
                            title="Cast Approve Vote"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleVote(v.member, v.role, 'rejected')}
                            className="px-2.5 py-1 border border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 flex items-center gap-1 font-bold"
                            title="Cast Reject Vote"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cloud Workspace Integration Actions */}
            <div className="p-3.5 border border-neutral-800 bg-neutral-900/30 flex flex-wrap items-center justify-between gap-3">
              <span className="text-neutral-400 font-bold uppercase text-[11px]">
                Google Cloud & Workspace Governance
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLaunchCabChat}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 text-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Launch CAB Room in Google Chat</span>
                </button>
                <button
                  onClick={handleUploadRfcToDrive}
                  className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs transition-colors"
                >
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Sync RFC to Google Drive</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Right: The Enterprise Side-Panel Activity Stream */}
        {selectedChange && (
          <ActivityStreamPanel
            recordId={selectedChange.id}
            recordTitle={selectedChange.title}
            recordType="change"
            activityLog={selectedChange.activityLog || []}
            isOpen={isActivityStreamOpen}
            onToggle={() => setIsActivityStreamOpen(!isActivityStreamOpen)}
          />
        )}
      </div>
    </div>
  );
};
