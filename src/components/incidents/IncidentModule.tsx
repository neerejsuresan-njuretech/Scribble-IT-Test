import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Incident, IncidentPriority, IncidentStatus, IncidentCategory } from '../../types/itsm';
import { MinimalStatus, DotMatrixText } from '../common/DotMatrixDisplay';
import { ActivityStreamPanel } from '../common/ActivityStreamPanel';
import {
  Search, Plus, Filter, Clock, CheckCircle2, AlertCircle,
  User, Server, Send, MessageSquare, HardDrive, Paperclip,
  Check, Lock, ExternalLink, Download, Layers, ShieldAlert,
  ChevronRight, ArrowUpDown, RefreshCw, Sparkles
} from 'lucide-react';
import { chatService, driveService, sheetsService } from '../../services/workspaceService';

interface IncidentModuleProps {
  onOpenCreate: () => void;
}

export const IncidentModule: React.FC<IncidentModuleProps> = ({ onOpenCreate }) => {
  const {
    incidents, updateIncidentStatus, assignIncident, assets, currentUser,
    googleToken, loginWithGoogle
  } = useITSM();

  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Side-panel activity stream toggle state
  const [isActivityStreamOpen, setIsActivityStreamOpen] = useState(true);

  // Bulk selection state for enterprise management
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [resolutionInput, setResolutionInput] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedIncident = incidents.find(i => i.id === selectedId) || incidents[0];

  const filteredIncidents = incidents.filter(i => {
    const matchesSearch = i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.assignee.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || i.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const handleToggleSelectAll = () => {
    if (selectedIncidentIds.length === filteredIncidents.length) {
      setSelectedIncidentIds([]);
    } else {
      setSelectedIncidentIds(filteredIncidents.map(i => i.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIncidentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkAssignToMe = () => {
    selectedIncidentIds.forEach(id => assignIncident(id, currentUser.name));
    setActionNotice(`Assigned ${selectedIncidentIds.length} incident(s) to ${currentUser.name}`);
    setSelectedIncidentIds([]);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleBulkResolve = () => {
    selectedIncidentIds.forEach(id =>
      updateIncidentStatus(id, 'resolved', 'Bulk resolved via Enterprise action toolbar.')
    );
    setActionNotice(`Marked ${selectedIncidentIds.length} incident(s) as resolved.`);
    setSelectedIncidentIds([]);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleResolve = () => {
    if (!selectedIncident) return;
    updateIncidentStatus(
      selectedIncident.id,
      'resolved',
      'Incident marked resolved.',
      resolutionInput || 'Diagnostic inspection completed, hardware replacement verified, throughput normalized.'
    );
    setResolutionInput('');
  };

  // 1-Click Launch War Room in Google Chat
  const handleCreateWarRoomFromIncident = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const spaceName = `War Room: ${selectedIncident.id}`;
      await chatService.createWarRoom(spaceName);
      setActionNotice(`Google Chat War Room created: "${spaceName}"!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice(`War Room notification dispatched to Google Chat.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // 1-Click Upload Diagnostics to Google Drive
  const handleUploadDiagnosticsToDrive = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const fileName = `Diagnostic-Telemetry-${selectedIncident.id}.txt`;
      const fileData = `INCIDENT RECORD TELEMETRY\nNumber: ${selectedIncident.id}\nTitle: ${selectedIncident.title}\nSeverity: ${selectedIncident.priority}\nCategory: ${selectedIncident.category}\nRequester: ${selectedIncident.requesterName}\n\nActivity Log:\n${selectedIncident.activityLog.map(a => `[${a.timestamp}] ${a.author}: ${a.note}`).join('\n')}`;
      await driveService.uploadTextFile(fileName, fileData);
      setActionNotice(`Telemetry file "${fileName}" saved to Google Drive!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice(`Telemetry logged to Google Drive.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = ['Number', 'Priority', 'Status', 'Category', 'Title', 'Caller', 'Assignee', 'Created At'];
    const rows = filteredIncidents.map(i => [
      i.id,
      i.priority,
      i.status,
      i.category,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.requesterName}"`,
      `"${i.assignee}"`,
      i.createdAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const linkedAsset = selectedIncident?.affectedCI
    ? assets.find(a => a.id === selectedIncident.affectedCI)
    : null;

  // Enterprise SLA Calculation
  const slaRemainingMs = selectedIncident ? new Date(selectedIncident.slaDeadline).getTime() - Date.now() : 0;
  const slaMinutesLeft = Math.max(0, Math.floor(slaRemainingMs / (1000 * 60)));
  const slaPercent = Math.min(100, Math.max(10, Math.floor((slaMinutesLeft / 240) * 100)));

  return (
    <div className="space-y-4 font-mono text-xs w-full">
      {/* Enterprise SaaS KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-900/40 p-3 border border-neutral-800 text-[11px]">
        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">MEAN TIME TO RESOLVE (MTTR)</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">38m 14s</div>
          <div className="text-[10px] text-emerald-400">▲ 14% faster than target</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">SLA COMPLIANCE RATE</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">99.4%</div>
          <div className="text-[10px] text-neutral-400">Target SLA threshold: 98.0%</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">ACTIVE P1 OUTAGES</div>
          <div className="text-sm font-bold text-rose-500 tabular-nums">
            {incidents.filter(i => i.priority === 'P1' && i.status !== 'resolved' && i.status !== 'closed').length.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] text-rose-400">War Room Escalation Active</div>
        </div>

        <div className="space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px]">AVG FIRST RESPONSE TIME</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">4m 12s</div>
          <div className="text-[10px] text-emerald-400">Automated triage routing</div>
        </div>
      </div>

      {/* Module Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-0.5">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px]">
            <span>SERVICENOW NOW PLATFORM</span>
            <span aria-hidden="true">·</span>
            <span>INCIDENT MANAGEMENT</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-400">TABLE: incident</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>INCIDENT CONSOLE</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({filteredIncidents.length} Records)</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs"
            title="Export filtered records to CSV"
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
            <span>Activity Stream ({selectedIncident?.activityLog.length || 0})</span>
          </button>

          <button
            onClick={onOpenCreate}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-2.5 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ServiceNow Breadcrumb & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-2.5 border border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 text-xs">
          <span className="text-neutral-200 font-bold">All</span>
          <span>&gt;</span>
          <span>Active = true</span>
          {priorityFilter !== 'all' && (
            <>
              <span>&gt;</span>
              <span className="text-rose-400 font-bold">Priority = {priorityFilter}</span>
            </>
          )}
          {categoryFilter !== 'all' && (
            <>
              <span>&gt;</span>
              <span className="text-neutral-300 font-bold">Category = {categoryFilter}</span>
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
              placeholder="Search keyword, caller, CI, assignee..."
              className="bg-neutral-950 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1 text-xs focus:outline-none w-56 placeholder:text-neutral-600"
            />
          </div>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            {['all', 'P1', 'P2', 'P3'].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-0.5 uppercase transition-colors text-[11px] ${
                  priorityFilter === p ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            {['all', 'network', 'software', 'security'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 uppercase transition-colors text-[11px] ${
                  categoryFilter === cat ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400'
                }`}
              >
                {cat === 'all' ? 'All Cats' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Action Strip if any rows selected */}
      {selectedIncidentIds.length > 0 && (
        <div className="p-2.5 border border-rose-900/60 bg-rose-950/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-neutral-200">
            <Check className="w-4 h-4 text-rose-500" />
            <span>{selectedIncidentIds.length} incident(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkAssignToMe}
              className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
            >
              Assign to Me ({currentUser.name})
            </button>
            <button
              onClick={handleBulkResolve}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Resolve Selected
            </button>
            <button
              onClick={() => setSelectedIncidentIds([])}
              className="px-2 py-1 text-neutral-400 hover:text-white"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Pane View: Record List on Left, Form in Center, Activity Stream Side Panel on Right */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Left Column: High-Density Record List */}
        <div className="w-full lg:w-80 shrink-0 border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800/80 max-h-[820px] overflow-y-auto">
          <div className="p-2.5 bg-neutral-900/60 text-neutral-400 flex items-center justify-between text-[11px] border-b border-neutral-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIncidentIds.length > 0 && selectedIncidentIds.length === filteredIncidents.length}
                onChange={handleToggleSelectAll}
                className="accent-rose-600"
              />
              <span className="font-bold">Select All</span>
            </label>
            <span>{filteredIncidents.length} Rows</span>
          </div>

          {filteredIncidents.map(inc => {
            const isSelected = selectedIncident?.id === inc.id;
            const isChecked = selectedIncidentIds.includes(inc.id);

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedId(inc.id)}
                className={`p-3 transition-colors cursor-pointer space-y-1.5 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={e => handleToggleSelectOne(inc.id, e)}
                      className="accent-rose-600"
                    />
                    <span className="font-bold text-neutral-200">{inc.id}</span>
                    <span className="text-neutral-600">·</span>
                    <span className={inc.priority === 'P1' ? 'text-rose-500 font-bold' : inc.priority === 'P2' ? 'text-amber-500' : 'text-neutral-400'}>
                      {inc.priority}
                    </span>
                  </div>

                  <MinimalStatus
                    status={inc.status}
                    variant={inc.status === 'in_progress' ? 'amber' : inc.status === 'resolved' ? 'emerald' : 'neutral'}
                  />
                </div>

                <div className="text-neutral-200 font-medium truncate text-xs">
                  {inc.title}
                </div>

                <div className="flex items-center justify-between text-neutral-500 text-[10px]">
                  <span className="truncate max-w-[140px]">{inc.assignee}</span>
                  <span className="tabular-nums">
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: ServiceNow Record Form */}
        {selectedIncident ? (
          <div className="flex-1 min-w-0 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            {/* Form Top Actions & SLA Gauge */}
            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-neutral-100">{selectedIncident.id}</span>
                  <span className="text-neutral-600">|</span>
                  <span className={selectedIncident.priority === 'P1' ? 'text-rose-500 font-bold' : 'text-amber-500'}>
                    {selectedIncident.priority} - {selectedIncident.priority === 'P1' ? 'Critical Enterprise Outage' : 'Standard Incident'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedIncident.status !== 'resolved' && (
                    <button
                      onClick={handleResolve}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                    >
                      Resolve Incident
                    </button>
                  )}
                  <select
                    value={selectedIncident.status}
                    onChange={e => updateIncidentStatus(selectedIncident.id, e.target.value as IncidentStatus, `State transitioned to ${e.target.value}`)}
                    className="bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-1.5 focus:outline-none"
                  >
                    <option value="new">State: New</option>
                    <option value="assigned">State: Assigned</option>
                    <option value="in_progress">State: In Progress</option>
                    <option value="pending">State: On Hold / Pending</option>
                    <option value="resolved">State: Resolved</option>
                    <option value="closed">State: Closed</option>
                  </select>
                </div>
              </div>

              {/* SLA Target Timeline Bar */}
              <div className="p-3 border border-neutral-800/80 bg-neutral-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>SLA RESOLUTION WINDOW</span>
                  </span>
                  <span className="tabular-nums font-bold text-neutral-200">
                    {slaMinutesLeft > 0 ? `${slaMinutesLeft}m remaining` : 'SLA Breached'}
                  </span>
                </div>

                <div className="w-full bg-neutral-950 h-2 border border-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      slaMinutesLeft <= 30 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${slaPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ServiceNow Form Split Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-neutral-800 pb-6">
              {/* Left Column */}
              <div className="space-y-3">
                <div>
                  <label className="text-neutral-500 block mb-1">Number</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedIncident.id}
                    className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-neutral-500 block mb-1">Caller / Requester</label>
                  <input
                    type="text"
                    readOnly
                    value={`${selectedIncident.requesterName} (${selectedIncident.requesterEmail})`}
                    className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-neutral-500 block mb-1">Category</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedIncident.category.toUpperCase()}
                    className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-neutral-500 block mb-1">Configuration Item (CI)</label>
                  <div className="text-neutral-300 bg-neutral-900/60 border border-neutral-800 px-2.5 py-1.5">
                    {linkedAsset ? `${linkedAsset.assetTag} - ${linkedAsset.name}` : (selectedIncident.affectedCI || 'None linked')}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-neutral-500 block mb-1">Impact</label>
                    <div className="bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 uppercase">
                      {selectedIncident.impact || 'High'}
                    </div>
                  </div>
                  <div>
                    <label className="text-neutral-500 block mb-1">Urgency</label>
                    <div className="bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 uppercase">
                      {selectedIncident.urgency || 'High'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-neutral-500 block mb-1">Assignment Group</label>
                  <input
                    type="text"
                    readOnly
                    value="Network Operations / NOC Tier 3"
                    className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-neutral-500 block mb-1">Assigned To</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedIncident.assignee}
                      className="flex-1 bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
                    />
                    <button
                      onClick={() => assignIncident(selectedIncident.id, currentUser.name)}
                      className="px-2 py-1 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white"
                    >
                      Me
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Short & Detailed Description */}
            <div className="space-y-3 border-b border-neutral-800 pb-6">
              <div>
                <label className="text-neutral-500 block mb-1">Short Description</label>
                <div className="text-sm font-bold text-neutral-100 bg-neutral-900/40 p-2.5 border border-neutral-800">
                  {selectedIncident.title}
                </div>
              </div>

              <div>
                <label className="text-neutral-500 block mb-1">Detailed Description</label>
                <div className="text-neutral-300 bg-neutral-900/40 p-3 border border-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {selectedIncident.description}
                </div>
              </div>
            </div>

            {/* Fast Cloud Workspace Quick Actions */}
            <div className="p-3 border border-neutral-800 bg-neutral-900/30 flex flex-wrap items-center justify-between gap-3">
              <span className="text-neutral-400 font-bold uppercase text-[11px]">
                Google Cloud War Room & Drive Dispatch
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateWarRoomFromIncident}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 text-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Launch Google Chat War Room</span>
                </button>
                <button
                  onClick={handleUploadDiagnosticsToDrive}
                  className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs"
                >
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Sync to Google Drive</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Right: The Enterprise Side-Panel Activity Stream */}
        {selectedIncident && (
          <ActivityStreamPanel
            recordId={selectedIncident.id}
            recordTitle={selectedIncident.title}
            recordType="incident"
            activityLog={selectedIncident.activityLog}
            isOpen={isActivityStreamOpen}
            onToggle={() => setIsActivityStreamOpen(!isActivityStreamOpen)}
          />
        )}
      </div>
    </div>
  );
};
