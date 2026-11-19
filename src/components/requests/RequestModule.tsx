import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { SlaTimer, evaluateSlaState, getRequestSlaDeadline } from '../common/SlaTimer';
import {
  Check,
  X,
  UserCheck,
  Plus,
  Search,
  Table2,
  Columns3,
  Lock,
  ShieldCheck,
} from 'lucide-react';

interface RequestModuleProps {
  onOpenCreate?: () => void;
}

export const RequestModule: React.FC<RequestModuleProps> = ({ onOpenCreate }) => {
  const navigate = useNavigate();
  const {
    requests,
    approveRequestStage,
    canApproveRequestStage,
    reassignRequestApprover,
    authAccounts,
    isSuperAdmin,
    isIamPortal,
    currentUser,
    activeTenant
  } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(requests[0]?.id || '');
  const [approvalNote, setApprovalNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'breach_critical' | 'warning' | 'healthy'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'split'>('table');

  const corporateApproverOptions = useMemo(
    () =>
      authAccounts
        .filter(a => a.tenantId === activeTenant.id && a.portalType !== 'end_user' && a.status !== 'suspended')
        .slice(0, 60),
    [authAccounts, activeTenant.id]
  );

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter(req => {
      const matchesSearch =
        !q ||
        req.id.toLowerCase().includes(q) ||
        req.catalogItemName.toLowerCase().includes(q) ||
        req.requesterName.toLowerCase().includes(q) ||
        req.department.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (slaFilter === 'all') return true;
      const sla = evaluateSlaState({
        createdAt: req.createdAt,
        deadline: getRequestSlaDeadline(req),
        isCompleted: req.status === 'completed',
        isCancelled: req.status === 'rejected',
      });
      if (slaFilter === 'breach_critical') return sla.tier === 'breached' || sla.tier === 'critical';
      if (slaFilter === 'warning') return sla.tier === 'warning';
      return sla.tier === 'healthy' || sla.tier === 'met';
    });
  }, [requests, searchQuery, slaFilter]);

  const selectedRequest =
    filteredRequests.find(r => r.id === selectedId) ||
    requests.find(r => r.id === selectedId) ||
    filteredRequests[0] ||
    requests[0];

  const handleApprove = (roleName: string) => {
    if (!selectedRequest) return;
    approveRequestStage(
      selectedRequest.id,
      roleName,
      currentUser.name,
      'approved',
      approvalNote || 'Approved via Scribble IT ITSM desk.'
    );
    setApprovalNote('');
  };

  const handleReject = (roleName: string) => {
    if (!selectedRequest) return;
    approveRequestStage(
      selectedRequest.id,
      roleName,
      currentUser.name,
      'rejected',
      approvalNote || 'Rejected per policy constraints.'
    );
    setApprovalNote('');
  };

  const stages = [
    { num: 1, label: 'Submitted' },
    { num: 2, label: 'Manager Review' },
    { num: 3, label: 'Security Review' },
    { num: 4, label: 'Fulfillment' },
  ];

  const renderDetailPanel = () => {
    if (!selectedRequest) {
      return (
        <div className="border border-neutral-800 bg-neutral-950 p-10 text-center space-y-3 text-neutral-500 text-xs">
          <div>No service requests recorded yet.</div>
          <button
            type="button"
            onClick={() => (onOpenCreate ? onOpenCreate() : navigate('/requests/new'))}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            + New Service Request
          </button>
        </div>
      );
    }

    const requestDeadline = getRequestSlaDeadline(selectedRequest);

    return (
      <div className="border border-neutral-800 bg-neutral-950 p-5 sm:p-6 space-y-5">
        <div className="space-y-3 border-b border-neutral-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-mono-strict tabular-nums text-neutral-100">
                {selectedRequest.id}
              </span>
              <span className="text-neutral-600">·</span>
              <MinimalStatus
                status={selectedRequest.status}
                variant={
                  selectedRequest.status === 'completed'
                    ? 'emerald'
                    : selectedRequest.status === 'rejected'
                    ? 'red'
                    : 'amber'
                }
              />
            </div>
            <span className="text-neutral-400 tabular-nums">
              Est. Delivery: {selectedRequest.deliveryEstimateDays} business day(s)
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-neutral-100">
            {selectedRequest.catalogItemName}
          </h2>

          <SlaTimer
            createdAt={selectedRequest.createdAt}
            deadline={requestDeadline}
            isCompleted={selectedRequest.status === 'completed'}
            isCancelled={selectedRequest.status === 'rejected'}
            variant="detailed"
            label="Fulfillment SLA Target"
          />

          <p className="text-xs text-neutral-300 bg-neutral-900/40 p-3 border border-neutral-800/80 leading-relaxed">
            {selectedRequest.description}
          </p>
        </div>

        {/* Stepper Display */}
        <div className="space-y-2">
          <div className="text-xs text-neutral-400 font-semibold">Stage Progress</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stages.map(st => {
              const isDone = selectedRequest.currentStage >= st.num;
              const isCurrent = selectedRequest.currentStage === st.num;
              return (
                <div
                  key={st.num}
                  className={`p-2.5 border text-center text-xs space-y-1 transition-colors ${
                    isCurrent
                      ? 'border-neutral-400 bg-neutral-900 text-neutral-100 font-bold'
                      : isDone
                      ? 'border-neutral-800 bg-neutral-900/30 text-neutral-400'
                      : 'border-neutral-900 bg-neutral-950 text-neutral-600'
                  }`}
                >
                  <div className="text-[10px] font-mono-strict text-neutral-500">STAGE 0{st.num}</div>
                  <div className="truncate text-[11px]">{st.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approvals Checklist (Strict Designated Account or Super Admin Governance) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-neutral-400 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Required Governance Approvals</span>
            </div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
              Designated Account or Super Admin Only
            </span>
          </div>

          <div className="space-y-3">
            {selectedRequest.approvals.map((app, idx) => {
              const authCheck = canApproveRequestStage(app, selectedRequest.requesterEmail);
              const isPending = app.status === 'pending' && selectedRequest.status !== 'rejected';
              return (
                <div key={idx} className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <UserCheck className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-neutral-200">{app.role}</span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-neutral-300">{app.approver}</span>
                        </div>
                        {app.approverEmail && (
                          <div className="text-[10px] text-sky-400 font-mono-strict truncate">
                            Designated Account: {app.approverEmail}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`uppercase font-bold text-[11px] shrink-0 ${
                        app.status === 'approved'
                          ? 'text-emerald-400'
                          : app.status === 'rejected'
                          ? 'text-rose-500'
                          : 'text-amber-400'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  {app.notes && (
                    <div className="text-[11px] text-neutral-400 bg-neutral-950 p-2 border border-neutral-900">
                      "{app.notes}"
                    </div>
                  )}

                  {isPending && (
                    <div className="space-y-2.5 pt-1">
                      {authCheck.allowed ? (
                        <div className="space-y-2.5">
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                              authCheck.isSuperAdminOverride ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {authCheck.isSuperAdminOverride
                                ? 'Super Admin Governance Override Authorized'
                                : 'Authorized Designated Approver Account'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={approvalNote}
                            onChange={e => setApprovalNote(e.target.value)}
                            placeholder="Optional approval / rejection audit justification..."
                            className="w-full bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(app.role)}
                              className="min-h-[36px] px-3 py-1 bg-neutral-100 text-neutral-950 hover:bg-white font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {authCheck.isSuperAdminOverride ? 'Approve (Super Admin)' : 'Approve Stage'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(app.role)}
                              className="min-h-[36px] px-3 py-1 border border-neutral-700 text-rose-400 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 border border-neutral-800 bg-neutral-950/80 text-[11px] text-neutral-400 flex items-start gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{authCheck.reason}</span>
                        </div>
                      )}

                      {(isSuperAdmin || isIamPortal) && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80">
                          <span className="text-[10px] text-neutral-500 uppercase">Reassign Approver:</span>
                          <select
                            defaultValue=""
                            onChange={e => {
                              if (!e.target.value) return;
                              reassignRequestApprover(selectedRequest.id, app.role, e.target.value);
                              e.target.value = '';
                            }}
                            className="bg-neutral-950 border border-neutral-700 text-neutral-200 px-2 py-1 text-[11px] focus:outline-none max-w-xs"
                          >
                            <option value="">Select specific corporate account...</option>
                            {corporateApproverOptions.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Module Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="space-y-0.5">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <span>{activeTenant.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-strict">sc_req_item</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-neutral-100 flex items-center gap-2.5">
            <span>Service Requests</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              ({filteredRequests.length})
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Table / Split View Switcher */}
          <div className="flex items-center border border-neutral-700 bg-neutral-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`min-h-[34px] md:min-h-0 px-2.5 py-1 text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'table'
                  ? 'bg-neutral-800 text-neutral-100 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Full tabular view with live SLA countdown column"
            >
              <Table2 className="w-3.5 h-3.5 shrink-0" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`min-h-[34px] md:min-h-0 px-2.5 py-1 text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'split'
                  ? 'bg-neutral-800 text-neutral-100 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Side-by-side split view"
            >
              <Columns3 className="w-3.5 h-3.5 shrink-0" />
              <span>Split</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/requests/new')}
            className="min-h-[38px] md:min-h-0 px-3.5 py-1.5 text-xs border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors whitespace-nowrap"
          >
            I Need Something Else
          </button>

          <button
            type="button"
            onClick={() => (onOpenCreate ? onOpenCreate() : navigate('/requests/new'))}
            className="min-h-[38px] md:min-h-0 px-4 py-1.5 text-xs font-bold tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Service Request</span>
          </button>
        </div>
      </div>

      {/* Filter & SLA Threshold Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-3 border border-neutral-800">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search request ID, item, requester..."
            className="w-full min-h-[36px] bg-neutral-950 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none placeholder:text-neutral-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={slaFilter}
            onChange={e =>
              setSlaFilter(e.target.value as 'all' | 'breach_critical' | 'warning' | 'healthy')
            }
            aria-label="Filter requests by SLA status"
            className="min-h-[36px] bg-neutral-950 border border-neutral-700 text-neutral-300 px-2.5 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">All SLA Status</option>
            <option value="breach_critical">SLA Red (Critical / Breached)</option>
            <option value="warning">SLA Yellow (Warning)</option>
            <option value="healthy">SLA Green (On Track / Met)</option>
          </select>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="space-y-5">
          {/* High-Density Service Request Table with Dedicated SLA Countdown Column */}
          <div className="border border-neutral-800 bg-neutral-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Request ID</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[220px]">Catalog Item</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Requester</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Stage</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">SLA Countdown</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-neutral-500">
                        No service requests match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const isSelected = selectedRequest?.id === req.id;
                      const deadline = getRequestSlaDeadline(req);
                      return (
                        <tr
                          key={req.id}
                          onClick={() => setSelectedId(req.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-neutral-900' : 'hover:bg-neutral-900/40'
                          }`}
                        >
                          <td className="py-3 px-3 font-bold font-mono-strict tabular-nums text-neutral-200 whitespace-nowrap">
                            {req.id}
                          </td>
                          <td className="py-3 px-3 max-w-md">
                            <div className="font-medium text-neutral-100 truncate">
                              {req.catalogItemName}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              {req.department} · Est. {req.deliveryEstimateDays}d
                            </div>
                          </td>
                          <td className="py-3 px-3 text-neutral-300 whitespace-nowrap">
                            {req.requesterName}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-neutral-800 h-1.5 overflow-hidden">
                                <div
                                  className="bg-neutral-200 h-full"
                                  style={{ width: `${(req.currentStage / 4) * 100}%` }}
                                />
                              </div>
                              <span className="font-mono-strict tabular-nums text-[11px] text-neutral-400">
                                {req.currentStage}/4
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <MinimalStatus
                              status={req.status}
                              variant={
                                req.status === 'completed'
                                  ? 'emerald'
                                  : req.status === 'rejected'
                                  ? 'red'
                                  : 'amber'
                              }
                            />
                          </td>
                          <td className="py-3 px-3">
                            <SlaTimer
                              createdAt={req.createdAt}
                              deadline={deadline}
                              isCompleted={req.status === 'completed'}
                              isCancelled={req.status === 'rejected'}
                              variant="table"
                            />
                          </td>
                          <td className="py-3 px-3 font-mono-strict tabular-nums font-bold text-neutral-300 whitespace-nowrap text-right">
                            {req.cost > 0 ? `$${req.cost.toLocaleString()}` : 'Free'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Request Approval & SLA Inspector */}
          {renderDetailPanel()}
        </div>
      ) : (
        /* Split View: Request List on Left, Multi-Stage Approvals on Right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Request items */}
          <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950 max-h-[750px] overflow-y-auto">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                No service requests match the current filters.
              </div>
            ) : (
              filteredRequests.map(req => {
                const isSelected = selectedRequest?.id === req.id;
                const deadline = getRequestSlaDeadline(req);
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedId(req.id)}
                    className={`p-4 transition-colors cursor-pointer space-y-2 ${
                      isSelected ? 'bg-neutral-900' : 'hover:bg-neutral-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold font-mono-strict tabular-nums text-neutral-200">
                        {req.id}
                      </span>
                      <MinimalStatus
                        status={req.status}
                        variant={
                          req.status === 'completed'
                            ? 'emerald'
                            : req.status === 'rejected'
                            ? 'red'
                            : 'amber'
                        }
                      />
                    </div>

                    <div className="text-xs font-medium text-neutral-200 line-clamp-1">
                      {req.catalogItemName}
                    </div>

                    {/* Live SLA Countdown Bar */}
                    <SlaTimer
                      createdAt={req.createdAt}
                      deadline={deadline}
                      isCompleted={req.status === 'completed'}
                      isCancelled={req.status === 'rejected'}
                      variant="compact"
                    />

                    {/* Progress bar line */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
                      <span className="truncate">
                        {req.requesterName} ({req.department})
                      </span>
                      <span className="font-mono-strict tabular-nums font-bold text-neutral-400 shrink-0 ml-2">
                        {req.cost > 0 ? `$${req.cost.toLocaleString()}` : 'Free'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Multi-stage Approval Workflow */}
          <div className="lg:col-span-7">{renderDetailPanel()}</div>
        </div>
      )}
    </div>
  );
};

