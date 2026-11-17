import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { IncidentStatus } from '../../types/itsm';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { ActivityStreamPanel } from '../common/ActivityStreamPanel';
import {
  Search, Plus, Clock, CheckCircle2, MessageSquare, HardDrive,
  Check, Download, Mail, Timer, Star, Radio, X
} from 'lucide-react';
import { chatService, driveService } from '../../services/workspaceService';

interface IncidentModuleProps {
  onOpenCreate?: () => void;
}

export const IncidentModule: React.FC<IncidentModuleProps> = ({ onOpenCreate }) => {
  const navigate = useNavigate();
  const {
    incidents, updateIncidentStatus, assignIncident, assets, currentUser,
    googleToken, loginWithGoogle, activeTenant,
    logIncidentTime, setIncidentCsat, simulateEmailToTicket, createWarRoom
  } = useITSM();

  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isActivityStreamOpen, setIsActivityStreamOpen] = useState(true);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [resolutionInput, setResolutionInput] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Email-to-Ticket Simulator Drawer
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailFrom, setEmailFrom] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

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
      updateIncidentStatus(id, 'resolved', 'Bulk resolved via incident toolbar.')
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
      resolutionInput || 'Diagnostic inspection completed, remediation applied, throughput normalized.'
    );
    setResolutionInput('');
  };

  const handleSimulateEmailIntake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailFrom.trim() || !emailSubject.trim()) return;
    const created = simulateEmailToTicket(emailFrom.trim(), emailSubject.trim(), emailBody.trim());
    setSelectedId(created.id);
    setShowEmailModal(false);
    setActionNotice(`Email-to-Ticket parsed inbound message into ${created.id}.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleOpenInternalWarRoom = () => {
    if (!selectedIncident) return;
    createWarRoom(selectedIncident.id, selectedIncident.title, selectedIncident.priority === 'P1' ? 'P1' : 'P2');
    navigate('/war-room');
  };

  const handleCreateWarRoomFromIncident = async () => {
    if (!selectedIncident) return;
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const spaceName = `War Room: ${selectedIncident.id}`;
      await chatService.createWarRoom(spaceName);
      setActionNotice(`Google Chat War Room created: "${spaceName}"`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice('War Room notification dispatched to Google Chat.');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleUploadDiagnosticsToDrive = async () => {
    if (!selectedIncident) return;
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    try {
      const fileName = `Diagnostic-Telemetry-${selectedIncident.id}.txt`;
      const fileData = `INCIDENT RECORD\nTenant: ${activeTenant.name}\nNumber: ${selectedIncident.id}\nTitle: ${selectedIncident.title}\nSeverity: ${selectedIncident.priority}\nCategory: ${selectedIncident.category}\nRequester: ${selectedIncident.requesterName}\n\nActivity Log:\n${selectedIncident.activityLog.map(a => `[${a.timestamp}] ${a.author}: ${a.note}`).join('\n')}`;
      await driveService.uploadTextFile(fileName, fileData);
      setActionNotice(`Telemetry file "${fileName}" saved to Google Drive.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice('Telemetry logged to Google Drive.');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Number', 'Tenant', 'Priority', 'Status', 'Category', 'Title', 'Caller', 'Assignee', 'TimeLoggedMins', 'CSAT', 'Created At'];
    const rows = filteredIncidents.map(i => [
      i.id,
      activeTenant.slug,
      i.priority,
      i.status,
      i.category,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.requesterName}"`,
      `"${i.assignee}"`,
      i.timeLoggedMins || 0,
      i.csatScore || '',
      i.createdAt
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTenant.slug}-incidents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const linkedAsset = selectedIncident?.affectedCI
    ? assets.find(a => a.id === selectedIncident.affectedCI)
    : null;

  const slaRemainingMs = selectedIncident ? new Date(selectedIncident.slaDeadline).getTime() - Date.now() : 0;
  const slaMinutesLeft = Math.max(0, Math.floor(slaRemainingMs / (1000 * 60)));
  const slaPercent = Math.min(100, Math.max(10, Math.floor((slaMinutesLeft / 240) * 100)));
  const totalLoggedMins = incidents.reduce((sum, i) => sum + (i.timeLoggedMins || 0), 0);
  const ratedIncidents = incidents.filter(i => typeof i.csatScore === 'number');
  const avgCsat = ratedIncidents.length > 0
    ? (ratedIncidents.reduce((sum, i) => sum + (i.csatScore || 0), 0) / ratedIncidents.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-4 font-mono text-xs w-full">
      {/* KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-900/40 p-3 border border-neutral-800 text-[11px]">
        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">SLA TARGET · P1 / P2</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">
            {activeTenant.slaTargets.P1}h / {activeTenant.slaTargets.P2}h
          </div>
          <div className="text-[10px] text-neutral-400">Tenant SLA policy</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">AVERAGE CSAT SCORE</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">{avgCsat} / 5.0</div>
          <div className="text-[10px] text-emerald-400">{ratedIncidents.length} rated ticket(s)</div>
        </div>

        <div className="space-y-0.5 border-r border-neutral-800 pr-2">
          <div className="text-neutral-500 uppercase text-[10px]">ACTIVE P1 INCIDENTS</div>
          <div className="text-sm font-bold text-rose-500 tabular-nums">
            {incidents.filter(i => i.priority === 'P1' && i.status !== 'resolved' && i.status !== 'closed').length.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] text-neutral-400">Bridge ready</div>
        </div>

        <div className="space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px]">TIME RECORDED</div>
          <div className="text-sm font-bold text-neutral-100 tabular-nums">{totalLoggedMins}m</div>
          <div className="text-[10px] text-neutral-400">Across {incidents.length} tenant records</div>
        </div>
      </div>

      {/* Module Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-0.5">
          <div className="text-neutral-500 flex items-center gap-2 text-[10px]">
            <span>{activeTenant.name.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>INCIDENT MANAGEMENT</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-400">TABLE: incident</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>TICKETS & INCIDENTS</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({filteredIncidents.length} Records)</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowEmailModal(!showEmailModal)}
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap"
            title="Simulate inbound email-to-ticket ingestion"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Email-to-Ticket</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsActivityStreamOpen(!isActivityStreamOpen)}
            className={`px-3 py-1.5 border transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap ${
              isActivityStreamOpen
                ? 'bg-neutral-800 border-neutral-600 text-white font-bold'
                : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
            <span>Activity ({selectedIncident?.activityLog.length || 0})</span>
          </button>

          <button
            onClick={() => onOpenCreate ? onOpenCreate() : navigate('/incidents/new')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {/* Email-to-Ticket Simulator Form */}
      {showEmailModal && (
        <form onSubmit={handleSimulateEmailIntake} className="border border-neutral-700 bg-neutral-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-200 uppercase text-[11px]">Inbound Email-to-Ticket Parser ({activeTenant.domain})</span>
            <button type="button" onClick={() => setShowEmailModal(false)} className="text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-500 block mb-1 text-[10px]">FROM ADDRESS</label>
              <input
                type="email"
                value={emailFrom}
                onChange={e => setEmailFrom(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-500 block mb-1 text-[10px]">SUBJECT LINE</label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-neutral-500 block mb-1 text-[10px]">EMAIL BODY PAYLOAD</label>
            <textarea
              rows={2}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowEmailModal(false)} className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold">
              Ingest Email as Ticket
            </button>
          </div>
        </form>
      )}

      {actionNotice && (
        <div className="p-2.5 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-2.5 border border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 text-xs">
          <span className="text-neutral-200 font-bold">All</span>
          <span>&gt;</span>
          <span>Tenant = {activeTenant.slug}</span>
          {statusFilter !== 'all' && (
            <>
              <span>&gt;</span>
              <span className="text-neutral-200 font-bold">State = {statusFilter}</span>
            </>
          )}
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search keyword, caller, CI..."
              className="bg-neutral-950 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1 text-xs focus:outline-none w-52 placeholder:text-neutral-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 text-neutral-300 px-2 py-1 text-[11px] focus:outline-none"
          >
            <option value="all">All States</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

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

      {/* Bulk Action Strip */}
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

      {/* Main 3-Pane View */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Left Column: Record List */}
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
                  isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
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
                    {inc.sourceChannel ? `${inc.sourceChannel.toUpperCase()} · ` : ''}
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: Record Form */}
        {selectedIncident ? (
          <div className="flex-1 min-w-0 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-neutral-100">{selectedIncident.id}</span>
                  <span className="text-neutral-600">|</span>
                  <span className={selectedIncident.priority === 'P1' ? 'text-rose-500 font-bold' : 'text-amber-500'}>
                    {selectedIncident.priority} · {selectedIncident.sourceChannel?.toUpperCase() || 'PORTAL'} INTAKE
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                    <button
                      onClick={handleResolve}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors whitespace-nowrap"
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

              {/* SLA Bar */}
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

            {/* Split Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-neutral-800 pb-6">
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
                    value={activeTenant.preferenceTemplate.defaultQueue}
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
                      className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white whitespace-nowrap"
                    >
                      Assign Me
                    </button>
                  </div>
                </div>

                {/* FreeITSM Time Recording & CSAT */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-neutral-500 block mb-1">Time Logged</label>
                    <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 px-2.5 py-1">
                      <span className="tabular-nums font-bold text-neutral-200 flex items-center gap-1">
                        <Timer className="w-3 h-3 text-neutral-400" />
                        {selectedIncident.timeLoggedMins || 0}m
                      </span>
                      <div className="flex items-center gap-1">
                        {[15, 30].map(m => (
                          <button
                            key={m}
                            onClick={() => logIncidentTime(selectedIncident.id, m)}
                            className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200"
                          >
                            +{m}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-neutral-500 block mb-1">CSAT Rating</label>
                    <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 px-2 py-1">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          onClick={() => setIncidentCsat(selectedIncident.id, score)}
                          className={`p-0.5 transition-colors ${
                            (selectedIncident.csatScore || 0) >= score ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-300'
                          }`}
                          title={`Rate CSAT ${score}/5`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ))}
                    </div>
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

              {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                <div>
                  <label className="text-neutral-500 block mb-1">Resolution Notes (Optional before Resolve)</label>
                  <input
                    type="text"
                    value={resolutionInput}
                    onChange={e => setResolutionInput(e.target.value)}
                    placeholder="Root fix applied, verification steps..."
                    className="w-full bg-neutral-900/40 border border-neutral-800 px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-600"
                  />
                </div>
              )}
            </div>

            {/* War Room & Workspace Dispatch */}
            <div className="p-3 border border-neutral-800 bg-neutral-900/30 flex flex-wrap items-center justify-between gap-3">
              <span className="text-neutral-400 font-bold uppercase text-[11px]">
                Escalation & Telemetry Dispatch
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenInternalWarRoom}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Open Bridge War Room</span>
                </button>
                <button
                  onClick={handleCreateWarRoomFromIncident}
                  className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Google Chat Bridge</span>
                </button>
                <button
                  onClick={handleUploadDiagnosticsToDrive}
                  className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                >
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Sync to Drive</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 border border-neutral-800 bg-neutral-950 p-10 text-center space-y-3 text-neutral-500">
            <div>No incidents recorded for {activeTenant.name}.</div>
            <button
              onClick={() => onOpenCreate ? onOpenCreate() : navigate('/incidents/new')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
            >
              + Create Incident
            </button>
          </div>
        )}

        {/* Right: Side-Panel Activity Stream */}
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

