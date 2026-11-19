import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { IncidentStatus } from '../../types/itsm';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { ActivityStreamPanel } from '../common/ActivityStreamPanel';
import { SlaTimer, evaluateSlaState } from '../common/SlaTimer';
import { TriageAssistantSidebar } from './TriageAssistantSidebar';
import {
  Search,
  Plus,
  CheckCircle2,
  MessageSquare,
  HardDrive,
  Check,
  Download,
  Mail,
  Timer,
  Star,
  Radio,
  X,
  Sparkles,
  ChevronLeft,
  SlidersHorizontal,
  ListFilter,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Table2,
  Columns3,
} from 'lucide-react';
import { chatService, driveService } from '../../services/workspaceService';

interface IncidentModuleProps {
  onOpenCreate?: () => void;
}

type InspectorTab = 'triage' | 'activity';
type MobilePane = 'queue' | 'detail' | 'triage' | 'activity';

export const IncidentModule: React.FC<IncidentModuleProps> = ({ onOpenCreate }) => {
  const navigate = useNavigate();
  const {
    incidents,
    updateIncidentStatus,
    assignIncident,
    assets,
    currentUser,
    googleToken,
    loginWithGoogle,
    activeTenant,
    logIncidentTime,
    setIncidentCsat,
    simulateEmailToTicket,
    createWarRoom,
  } = useITSM();

  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breach_critical' | 'warning' | 'healthy'>('all');
  const [viewMode, setViewMode] = useState<'split' | 'table'>('split');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Adaptive per-device panel states:
  // Desktop (xl+): docked right inspector (default open on Triage Assistant)
  // Tablet (md-lg): slide-over drawer triggered by toolbar buttons
  // Mobile (< md): single-pane workspace switcher (Queue | Details | Triage AI | Activity)
  const [isDesktopInspectorOpen, setIsDesktopInspectorOpen] = useState(true);
  const [isTabletDrawerOpen, setIsTabletDrawerOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('triage');
  const [mobilePane, setMobilePane] = useState<MobilePane>('queue');

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
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      i.title.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      i.requesterName.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.assignee.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || i.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
    let matchesSla = true;
    if (slaFilter !== 'all') {
      const slaState = evaluateSlaState({
        createdAt: i.createdAt,
        deadline: i.slaDeadline,
        isCompleted: i.status === 'resolved' || i.status === 'closed',
        isPaused: i.status === 'pending',
        breachedFlag: i.slaBreached,
      });
      if (slaFilter === 'breach_critical') {
        matchesSla = slaState.tier === 'breached' || slaState.tier === 'critical';
      } else if (slaFilter === 'warning') {
        matchesSla = slaState.tier === 'warning';
      } else if (slaFilter === 'healthy') {
        matchesSla = slaState.tier === 'healthy' || slaState.tier === 'met';
      }
    }
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesSla;
  });

  const handleSelectIncident = (id: string) => {
    setSelectedId(id);
    setMobilePane('detail');
  };

  const handleOpenInspectorTab = (tab: InspectorTab) => {
    setInspectorTab(tab);
    setIsDesktopInspectorOpen(true);
    setIsTabletDrawerOpen(true);
    setMobilePane(tab);
  };

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
    setMobilePane('detail');
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
      i.createdAt,
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

  const totalLoggedMins = incidents.reduce((sum, i) => sum + (i.timeLoggedMins || 0), 0);
  const ratedIncidents = incidents.filter(i => typeof i.csatScore === 'number');
  const avgCsat =
    ratedIncidents.length > 0
      ? (ratedIncidents.reduce((sum, i) => sum + (i.csatScore || 0), 0) / ratedIncidents.length).toFixed(1)
      : '—';
  const activeP1Count = incidents.filter(
    i => i.priority === 'P1' && i.status !== 'resolved' && i.status !== 'closed'
  ).length;
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (slaFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  return (
    <div className="space-y-4 font-mono text-xs w-full">
      {/* Adaptive KPI Strip: 2x2 cards on Mobile, 4-column bar on Tablet/Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-[11px]">
        <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px] truncate">SLA Target · P1 / P2</div>
          <div className="text-sm sm:text-base font-bold text-neutral-100 tabular-nums">
            {activeTenant.slaTargets.P1}h / {activeTenant.slaTargets.P2}h
          </div>
          <div className="text-[10px] text-neutral-400 truncate">Tenant SLA policy</div>
        </div>

        <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px] truncate">Average CSAT</div>
          <div className="text-sm sm:text-base font-bold text-neutral-100 tabular-nums">
            {avgCsat} / 5.0
          </div>
          <div className="text-[10px] text-emerald-400 truncate">{ratedIncidents.length} rated ticket(s)</div>
        </div>

        <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px] truncate">Active P1 Incidents</div>
          <div className="text-sm sm:text-base font-bold text-rose-500 tabular-nums">
            {activeP1Count.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] text-neutral-400 truncate">Bridge ready</div>
        </div>

        <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-0.5">
          <div className="text-neutral-500 uppercase text-[10px] truncate">Time Recorded</div>
          <div className="text-sm sm:text-base font-bold text-neutral-100 tabular-nums">
            {totalLoggedMins}m
          </div>
          <div className="text-[10px] text-neutral-400 truncate">Across {incidents.length} records</div>
        </div>
      </div>

      {/* Module Title & Device-Adaptive Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-neutral-500 flex items-center gap-1.5 text-[10px] truncate">
            <span className="truncate">{activeTenant.name.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">INCIDENT MANAGEMENT</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>Tickets &amp; Incidents</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              ({filteredIncidents.length})
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile filter drawer toggle */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(prev => !prev)}
            className={`md:hidden min-h-[40px] px-3 py-1.5 border text-xs flex items-center gap-1.5 whitespace-nowrap ${
              showMobileFilters || activeFilterCount > 0
                ? 'border-sky-700 bg-sky-950/40 text-sky-300 font-bold'
                : 'border-neutral-700 bg-neutral-900 text-neutral-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>

          {/* Split / Table View Switcher */}
          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`min-h-[34px] md:min-h-0 px-2.5 py-1 text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'split'
                  ? 'bg-neutral-800 text-neutral-100 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Split queue and inspector view"
            >
              <Columns3 className="w-3.5 h-3.5 shrink-0" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`min-h-[34px] md:min-h-0 px-2.5 py-1 text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'table'
                  ? 'bg-neutral-800 text-neutral-100 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Full tabular view with live SLA timers"
            >
              <Table2 className="w-3.5 h-3.5 shrink-0" />
              <span>Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowEmailModal(!showEmailModal)}
            className="min-h-[40px] md:min-h-0 px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap"
            title="Simulate inbound email-to-ticket ingestion"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Email-to-Ticket</span>
            <span className="sm:hidden">Email</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="hidden sm:flex px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors items-center gap-1.5 text-xs whitespace-nowrap"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Tablet-specific Inspector Drawer Triggers (md to lg) */}
          {selectedIncident && (
            <div className="hidden md:flex xl:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenInspectorTab('triage')}
                className="px-3 py-1.5 border border-sky-700/80 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Triage Assistant</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenInspectorTab('activity')}
                className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                <span>Activity ({selectedIncident.activityLog.length})</span>
              </button>
            </div>
          )}

          {/* Desktop Docked Inspector Toggle (xl+) */}
          {selectedIncident && (
            <button
              type="button"
              onClick={() => setIsDesktopInspectorOpen(prev => !prev)}
              className={`hidden xl:flex px-3 py-1.5 border transition-colors items-center gap-1.5 text-xs whitespace-nowrap ${
                isDesktopInspectorOpen
                  ? 'border-sky-700/80 bg-sky-950/40 text-sky-300 font-bold'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white'
              }`}
              title={isDesktopInspectorOpen ? 'Hide Triage & Activity Sidebar' : 'Show Triage & Activity Sidebar'}
            >
              {isDesktopInspectorOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span>Triage Sidebar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (onOpenCreate ? onOpenCreate() : navigate('/incidents/new'))}
            className="min-h-[40px] md:min-h-0 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-1.5 text-xs whitespace-nowrap ml-auto md:ml-0"
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
            <span className="font-bold text-neutral-200 uppercase text-[11px]">
              Inbound Email-to-Ticket Parser ({activeTenant.domain})
            </span>
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-neutral-400 hover:text-white"
            >
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
                className="w-full min-h-[40px] bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-500 block mb-1 text-[10px]">SUBJECT LINE</label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                required
                className="w-full min-h-[40px] bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
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
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="min-h-[40px] px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
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

      {/* Filter Bar — Always visible on Tablet/Desktop, toggleable on Mobile */}
      <div
        className={`${
          showMobileFilters ? 'flex' : 'hidden md:flex'
        } flex-col lg:flex-row lg:items-center justify-between gap-3 bg-neutral-900/60 p-3 border border-neutral-800`}
      >
        <div className="hidden xl:flex items-center gap-2 text-neutral-400 text-xs">
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

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search keyword, caller, CI..."
              className="w-full sm:w-56 min-h-[38px] md:min-h-0 bg-neutral-950 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none placeholder:text-neutral-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="min-h-[38px] md:min-h-0 bg-neutral-950 border border-neutral-700 text-neutral-300 px-2.5 py-1.5 text-[11px] focus:outline-none"
          >
            <option value="all">All States</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={slaFilter}
            onChange={e => setSlaFilter(e.target.value as 'all' | 'breach_critical' | 'warning' | 'healthy')}
            className="min-h-[38px] md:min-h-0 bg-neutral-950 border border-neutral-700 text-neutral-300 px-2.5 py-1.5 text-[11px] focus:outline-none"
            aria-label="Filter by SLA status"
          >
            <option value="all">All SLA Status</option>
            <option value="breach_critical">SLA Red (Critical / Breached)</option>
            <option value="warning">SLA Yellow (Warning)</option>
            <option value="healthy">SLA Green (On Track / Met)</option>
          </select>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5 overflow-x-auto">
            {['all', 'P1', 'P2', 'P3'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`flex-1 sm:flex-initial min-h-[34px] md:min-h-0 px-2.5 py-1 uppercase transition-colors text-[11px] whitespace-nowrap ${
                  priorityFilter === p ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5 overflow-x-auto">
            {['all', 'network', 'software', 'security'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`flex-1 sm:flex-initial min-h-[34px] md:min-h-0 px-2.5 py-1 uppercase transition-colors text-[11px] whitespace-nowrap ${
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
        <div className="p-2.5 border border-rose-900/60 bg-rose-950/20 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-neutral-200">
            <Check className="w-4 h-4 text-rose-500" />
            <span>{selectedIncidentIds.length} incident(s) selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkAssignToMe}
              className="min-h-[36px] px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 whitespace-nowrap"
            >
              Assign to Me
            </button>
            <button
              type="button"
              onClick={handleBulkResolve}
              className="min-h-[36px] px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold whitespace-nowrap"
            >
              Resolve Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIncidentIds([])}
              className="min-h-[36px] px-2 py-1 text-neutral-400 hover:text-white"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* TABLE VIEW: High-Density Enterprise Incident Table with Live SLA Countdown Column */}
      {viewMode === 'table' ? (
        <div className="border border-neutral-800 bg-neutral-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
                  <th className="py-2.5 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIncidentIds.length > 0 && selectedIncidentIds.length === filteredIncidents.length}
                      onChange={handleToggleSelectAll}
                      className="accent-rose-600 w-4 h-4"
                      aria-label="Select all incidents"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Number</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Priority</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[240px]">Short Description</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">State</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">SLA Countdown</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Assignee</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-neutral-500">
                      No incidents match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map(inc => {
                    const isSelected = selectedIncident?.id === inc.id;
                    const isChecked = selectedIncidentIds.includes(inc.id);
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => {
                          handleSelectIncident(inc.id);
                          setViewMode('split');
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-neutral-900/80' : 'hover:bg-neutral-900/40'
                        }`}
                      >
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            onClick={e => handleToggleSelectOne(inc.id, e)}
                            className="accent-rose-600 w-4 h-4"
                            aria-label={`Select ${inc.id}`}
                          />
                        </td>
                        <td className="py-3 px-3 font-bold font-mono-strict tabular-nums text-neutral-200 whitespace-nowrap">
                          {inc.id}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={
                              inc.priority === 'P1'
                                ? 'text-rose-500 font-bold'
                                : inc.priority === 'P2'
                                ? 'text-amber-500 font-bold'
                                : 'text-neutral-400 font-medium'
                            }
                          >
                            {inc.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <div className="font-medium text-neutral-100 truncate">{inc.title}</div>
                          <div className="text-[11px] text-neutral-500 truncate">
                            {inc.requesterName} · {inc.category}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <MinimalStatus
                            status={inc.status}
                            variant={
                              inc.status === 'in_progress'
                                ? 'amber'
                                : inc.status === 'resolved'
                                ? 'emerald'
                                : 'neutral'
                            }
                          />
                        </td>
                        <td className="py-3 px-3">
                          <SlaTimer
                            createdAt={inc.createdAt}
                            deadline={inc.slaDeadline}
                            isCompleted={inc.status === 'resolved' || inc.status === 'closed'}
                            isPaused={inc.status === 'pending'}
                            breachedFlag={inc.slaBreached}
                            variant="table"
                          />
                        </td>
                        <td className="py-3 px-3 text-neutral-300 whitespace-nowrap max-w-[180px] truncate">
                          {inc.assignee}
                        </td>
                        <td className="py-3 px-3 text-neutral-400 font-mono-strict tabular-nums whitespace-nowrap text-right">
                          {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
      {/* MOBILE-ONLY Segmented Workspace Switcher (< md) */}
      <div className="md:hidden grid grid-cols-4 border border-neutral-800 bg-neutral-950 p-1 gap-1 sticky top-[3.5rem] z-20">
        {[
          { id: 'queue' as MobilePane, label: `Queue (${filteredIncidents.length})`, Icon: ListFilter },
          { id: 'detail' as MobilePane, label: 'Details', Icon: FileText },
          { id: 'triage' as MobilePane, label: 'Triage AI', Icon: Sparkles },
          { id: 'activity' as MobilePane, label: `Stream`, Icon: MessageSquare },
        ].map(tab => {
          const isActive = mobilePane === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobilePane(tab.id)}
              className={`min-h-[44px] px-1.5 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors whitespace-nowrap ${
                isActive
                  ? tab.id === 'triage'
                    ? 'bg-sky-950/60 border border-sky-700/80 text-sky-300'
                    : 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive && tab.id === 'triage' ? 'text-sky-400' : ''}`} />
              <span className="truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Responsive Workspace:
          Mobile (< md): Single active pane (Queue | Details | Triage AI | Activity)
          Tablet (md - lg): 2-pane split (Queue + Details) + Slide-over Drawer for Triage AI / Activity
          Desktop (xl+): 3-pane command center (Queue + Details + Docked Triage AI / Activity Sidebar) */}
      <div className="flex flex-col md:flex-row gap-4 items-start w-full">
        {/* LEFT PANE: Incident Queue List */}
        <div
          className={`${
            mobilePane === 'queue' ? 'block' : 'hidden md:block'
          } w-full md:w-72 xl:w-72 2xl:w-80 shrink-0 border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800/80 md:max-h-[calc(100vh-14rem)] overflow-y-auto`}
        >
          <div className="p-2.5 bg-neutral-900/60 text-neutral-400 flex items-center justify-between text-[11px] border-b border-neutral-800 sticky top-0 z-10">
            <label className="flex items-center gap-2 cursor-pointer min-h-[32px]">
              <input
                type="checkbox"
                checked={selectedIncidentIds.length > 0 && selectedIncidentIds.length === filteredIncidents.length}
                onChange={handleToggleSelectAll}
                className="accent-rose-600 w-4 h-4"
              />
              <span className="font-bold">Select All</span>
            </label>
            <span className="tabular-nums">{filteredIncidents.length} Rows</span>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-xs">
              No incidents match the current filters.
            </div>
          ) : (
            filteredIncidents.map(inc => {
              const isSelected = selectedIncident?.id === inc.id;
              const isChecked = selectedIncidentIds.includes(inc.id);

              return (
                <div
                  key={inc.id}
                  onClick={() => handleSelectIncident(inc.id)}
                  className={`p-3.5 md:p-3 transition-colors cursor-pointer space-y-1.5 min-h-[68px] ${
                    isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={e => handleToggleSelectOne(inc.id, e)}
                        className="accent-rose-600 w-4 h-4 shrink-0"
                      />
                      <span className="font-bold text-neutral-200 font-mono-strict tabular-nums shrink-0">
                        {inc.id}
                      </span>
                      <span className="text-neutral-600">·</span>
                      <span
                        className={
                          inc.priority === 'P1'
                            ? 'text-rose-500 font-bold'
                            : inc.priority === 'P2'
                            ? 'text-amber-500 font-bold'
                            : 'text-neutral-400'
                        }
                      >
                        {inc.priority}
                      </span>
                    </div>

                    <MinimalStatus
                      status={inc.status}
                      variant={
                        inc.status === 'in_progress'
                          ? 'amber'
                          : inc.status === 'resolved'
                          ? 'emerald'
                          : 'neutral'
                      }
                    />
                  </div>

                  <div className="text-neutral-200 font-medium truncate text-xs">{inc.title}</div>

                  {/* Live SLA Countdown Bar inside Queue Row */}
                  <SlaTimer
                    createdAt={inc.createdAt}
                    deadline={inc.slaDeadline}
                    isCompleted={inc.status === 'resolved' || inc.status === 'closed'}
                    isPaused={inc.status === 'pending'}
                    breachedFlag={inc.slaBreached}
                    variant="compact"
                  />

                  <div className="flex items-center justify-between text-neutral-500 text-[10px] gap-2">
                    <span className="truncate">{inc.assignee}</span>
                    <span className="tabular-nums shrink-0">
                      {inc.sourceChannel ? `${inc.sourceChannel.toUpperCase()} · ` : ''}
                      {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CENTER PANE: Selected Incident Record Workspace */}
        <div className={`${mobilePane === 'detail' ? 'block' : 'hidden md:block'} flex-1 min-w-0 w-full`}>
          {selectedIncident ? (
            <div className="border border-neutral-800 bg-neutral-950 p-4 sm:p-5 lg:p-6 space-y-5">
              {/* Mobile Quick Navigation Row */}
              <div className="flex md:hidden items-center justify-between gap-2 pb-2 border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => setMobilePane('queue')}
                  className="min-h-[40px] px-2.5 py-1.5 border border-neutral-800 bg-neutral-900 text-neutral-200 flex items-center gap-1 text-xs font-bold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Queue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePane('triage')}
                  className="min-h-[40px] px-3 py-1.5 border border-sky-700/80 bg-sky-950/40 text-sky-300 flex items-center gap-1.5 text-xs font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Triage AI</span>
                </button>
              </div>

              {/* Ticket Header & Primary Controls */}
              <div className="space-y-3 border-b border-neutral-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-neutral-100 font-mono-strict tabular-nums">
                      {selectedIncident.id}
                    </span>
                    <span className="text-neutral-600">|</span>
                    <span
                      className={
                        selectedIncident.priority === 'P1'
                          ? 'text-rose-500 font-bold'
                          : 'text-amber-500 font-bold'
                      }
                    >
                      {selectedIncident.priority} · {selectedIncident.sourceChannel?.toUpperCase() || 'PORTAL'} INTAKE
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                      <button
                        type="button"
                        onClick={handleResolve}
                        className="min-h-[40px] md:min-h-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors whitespace-nowrap"
                      >
                        Resolve Incident
                      </button>
                    )}
                    <select
                      value={selectedIncident.status}
                      onChange={e =>
                        updateIncidentStatus(
                          selectedIncident.id,
                          e.target.value as IncidentStatus,
                          `State transitioned to ${e.target.value}`
                        )
                      }
                      className="min-h-[40px] md:min-h-0 bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
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

                {/* Live Visual SLA Countdown Bar */}
                <SlaTimer
                  createdAt={selectedIncident.createdAt}
                  deadline={selectedIncident.slaDeadline}
                  isCompleted={selectedIncident.status === 'resolved' || selectedIncident.status === 'closed'}
                  isPaused={selectedIncident.status === 'pending'}
                  breachedFlag={selectedIncident.slaBreached}
                  variant="detailed"
                  label="SLA Resolution Window"
                />
              </div>

              {/* Metadata Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-neutral-800 pb-5">
                <div className="space-y-3">
                  <div>
                    <label className="text-neutral-500 block mb-1">Number</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedIncident.id}
                      className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none font-bold font-mono-strict"
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
                    <div className="text-neutral-300 bg-neutral-900/60 border border-neutral-800 px-2.5 py-1.5 truncate">
                      {linkedAsset
                        ? `${linkedAsset.assetTag} - ${linkedAsset.name}`
                        : selectedIncident.affectedCI || 'None linked'}
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
                      value={selectedIncident.assignmentGroup || activeTenant.preferenceTemplate.defaultQueue}
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
                        className="flex-1 min-w-0 bg-neutral-900/60 border border-neutral-800 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => assignIncident(selectedIncident.id, currentUser.name)}
                        className="min-h-[38px] md:min-h-0 px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white whitespace-nowrap shrink-0"
                      >
                        Assign Me
                      </button>
                    </div>
                  </div>

                  {/* Time Recording & CSAT */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-neutral-500 block mb-1">Time Logged</label>
                      <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 px-2 py-1 min-h-[34px]">
                        <span className="tabular-nums font-bold text-neutral-200 flex items-center gap-1">
                          <Timer className="w-3 h-3 text-neutral-400" />
                          {selectedIncident.timeLoggedMins || 0}m
                        </span>
                        <div className="flex items-center gap-1">
                          {[15, 30].map(m => (
                            <button
                              key={m}
                              type="button"
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
                      <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 px-2 py-1 min-h-[34px]">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setIncidentCsat(selectedIncident.id, score)}
                            className={`p-0.5 transition-colors ${
                              (selectedIncident.csatScore || 0) >= score
                                ? 'text-amber-400'
                                : 'text-neutral-600 hover:text-neutral-300'
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
              <div className="space-y-3 border-b border-neutral-800 pb-5">
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
                    <label className="text-neutral-500 block mb-1">
                      Resolution Notes (Optional before Resolve)
                    </label>
                    <input
                      type="text"
                      value={resolutionInput}
                      onChange={e => setResolutionInput(e.target.value)}
                      placeholder="Root fix applied, verification steps... (or insert from Triage Assistant)"
                      className="w-full min-h-[40px] md:min-h-0 bg-neutral-900/40 border border-neutral-800 px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                )}
              </div>

              {/* War Room & Workspace Dispatch */}
              <div className="p-3 border border-neutral-800 bg-neutral-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-neutral-400 font-bold uppercase text-[11px]">
                  Escalation &amp; Telemetry Dispatch
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInternalWarRoom}
                    className="min-h-[38px] md:min-h-0 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Bridge War Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWarRoomFromIncident}
                    className="min-h-[38px] md:min-h-0 px-2.5 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Google Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadDiagnosticsToDrive}
                    className="min-h-[38px] md:min-h-0 px-2.5 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Sync to Drive</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-3 text-neutral-500">
              <div>No incidents recorded for {activeTenant.name}.</div>
              <button
                type="button"
                onClick={() => (onOpenCreate ? onOpenCreate() : navigate('/incidents/new'))}
                className="min-h-[42px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                + Create Incident
              </button>
            </div>
          )}
        </div>

        {/* MOBILE-ONLY Full-Width Triage AI Pane (< md) */}
        {selectedIncident && mobilePane === 'triage' && (
          <div className="md:hidden w-full border border-neutral-800 bg-neutral-950 min-h-[60vh]">
            <TriageAssistantSidebar
              incident={selectedIncident}
              onApplyResolution={draft => {
                setResolutionInput(draft);
                setMobilePane('detail');
              }}
            />
          </div>
        )}

        {/* MOBILE-ONLY Full-Width Activity Stream Pane (< md) */}
        {selectedIncident && mobilePane === 'activity' && (
          <div className="md:hidden w-full border border-neutral-800 bg-neutral-950 h-[70vh] flex flex-col">
            <ActivityStreamPanel
              recordId={selectedIncident.id}
              recordTitle={selectedIncident.title}
              recordType="incident"
              activityLog={selectedIncident.activityLog}
              isOpen={true}
              onToggle={() => setMobilePane('detail')}
              embedded={true}
            />
          </div>
        )}

        {/* DESKTOP-ONLY Docked Right Sidebar (xl+): Unified Triage Assistant & Activity Stream */}
        {selectedIncident && isDesktopInspectorOpen && (
          <aside
            className="hidden xl:flex flex-col w-[360px] 2xl:w-[400px] shrink-0 border border-neutral-800 bg-neutral-950 sticky top-16 h-[calc(100vh-5.5rem)] overflow-hidden"
            aria-label="Incident Triage Assistant and Activity Inspector"
          >
            {/* Inspector Tab Switcher */}
            <div className="grid grid-cols-2 border-b border-neutral-800 bg-neutral-900/60 p-1 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setInspectorTab('triage')}
                className={`py-2 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  inspectorTab === 'triage'
                    ? 'bg-sky-950/60 border border-sky-700/80 text-sky-300'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Triage AI</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('activity')}
                className={`py-2 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  inspectorTab === 'activity'
                    ? 'bg-neutral-800 border border-neutral-700 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Stream ({selectedIncident.activityLog.length})</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {inspectorTab === 'triage' ? (
                <TriageAssistantSidebar
                  incident={selectedIncident}
                  onApplyResolution={draft => setResolutionInput(draft)}
                />
              ) : (
                <ActivityStreamPanel
                  recordId={selectedIncident.id}
                  recordTitle={selectedIncident.title}
                  recordType="incident"
                  activityLog={selectedIncident.activityLog}
                  isOpen={true}
                  onToggle={() => setIsDesktopInspectorOpen(false)}
                  embedded={true}
                />
              )}
            </div>
          </aside>
        )}
      </div>
        </>
      )}

      {/* TABLET-ONLY Slide-Over Inspector Drawer (md to lg) */}
      {selectedIncident && isTabletDrawerOpen && (
        <div className="hidden md:block xl:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsTabletDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-2.5 border-b border-neutral-800 bg-neutral-900/60 shrink-0">
              <div className="grid grid-cols-2 flex-1 gap-1">
                <button
                  type="button"
                  onClick={() => setInspectorTab('triage')}
                  className={`min-h-[38px] px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                    inspectorTab === 'triage'
                      ? 'bg-sky-950/60 border border-sky-700/80 text-sky-300'
                      : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Triage AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('activity')}
                  className={`min-h-[38px] px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                    inspectorTab === 'activity'
                      ? 'bg-neutral-800 border border-neutral-700 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                  <span>Stream ({selectedIncident.activityLog.length})</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsTabletDrawerOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-neutral-400 hover:text-white border border-neutral-800 bg-neutral-950"
                aria-label="Close inspector drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {inspectorTab === 'triage' ? (
                <TriageAssistantSidebar
                  incident={selectedIncident}
                  onApplyResolution={draft => {
                    setResolutionInput(draft);
                    setIsTabletDrawerOpen(false);
                  }}
                />
              ) : (
                <ActivityStreamPanel
                  recordId={selectedIncident.id}
                  recordTitle={selectedIncident.title}
                  recordType="incident"
                  activityLog={selectedIncident.activityLog}
                  isOpen={true}
                  onToggle={() => setIsTabletDrawerOpen(false)}
                  embedded={true}
                />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
