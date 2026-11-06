import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ServiceRequest, RequestStatus } from '../../types/itsm';
import { MinimalStatus } from '../common/DotMatrixDisplay';
import { Check, X, ShieldAlert, Package, Clock, UserCheck, Plus, CheckCircle2 } from 'lucide-react';

interface RequestModuleProps {
  onOpenCreate: () => void;
}

export const RequestModule: React.FC<RequestModuleProps> = ({ onOpenCreate }) => {
  const { requests, approveRequestStage, currentUser } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(requests[0]?.id || '');
  const [approvalNote, setApprovalNote] = useState('');

  const selectedRequest = requests.find(r => r.id === selectedId) || requests[0];

  const handleApprove = (roleName: string) => {
    if (!selectedRequest) return;
    approveRequestStage(selectedRequest.id, roleName, currentUser.name, 'approved', approvalNote || 'Approved via Scribble IT ITSM desk.');
    setApprovalNote('');
  };

  const handleReject = (roleName: string) => {
    if (!selectedRequest) return;
    approveRequestStage(selectedRequest.id, roleName, currentUser.name, 'rejected', approvalNote || 'Rejected per policy constraints.');
    setApprovalNote('');
  };

  const stages = [
    { num: 1, label: 'Submitted' },
    { num: 2, label: 'Manager Review' },
    { num: 3, label: 'Security Review' },
    { num: 4, label: 'Fulfillment' }
  ];

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">ITIL SERVICE TRANSITION // SERVICE CATALOG REQUESTS</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>SERVICE REQUEST PIPELINE</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({requests.length} Requests)</span>
          </h1>
        </div>
        <button
          onClick={onOpenCreate}
          className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Service Request</span>
        </button>
      </div>

      {/* Grid: Request List on Left, Multi-Stage Approvals on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Request items */}
        <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950 max-h-[750px] overflow-y-auto">
          {requests.map(req => {
            const isSelected = selectedRequest?.id === req.id;
            return (
              <div
                key={req.id}
                onClick={() => setSelectedId(req.id)}
                className={`p-4 transition-colors cursor-pointer space-y-2 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-neutral-200">{req.id}</span>
                  <MinimalStatus
                    status={req.status}
                    variant={req.status === 'completed' ? 'emerald' : req.status === 'rejected' ? 'red' : 'amber'}
                  />
                </div>

                <div className="text-xs font-medium text-neutral-200 line-clamp-1">
                  {req.catalogItemName}
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-neutral-900 h-1 overflow-hidden">
                  <div
                    className="bg-neutral-200 h-full transition-all duration-300"
                    style={{ width: `${(req.currentStage / 4) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                  <span>{req.requesterName} ({req.department})</span>
                  <span className="tabular-nums font-bold text-neutral-400">
                    {req.cost > 0 ? `$${req.cost.toLocaleString()}` : 'Free'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Multi-stage Approval Workflow */}
        {selectedRequest ? (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            <div className="space-y-2 border-b border-neutral-800 pb-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-base font-bold text-neutral-100">{selectedRequest.id}</span>
                <span className="text-neutral-500">
                  Est. Delivery: {selectedRequest.deliveryEstimateDays} business days
                </span>
              </div>
              <h2 className="text-lg font-bold text-neutral-100 font-mono">
                {selectedRequest.catalogItemName}
              </h2>
              <p className="text-xs text-neutral-300 font-mono bg-neutral-900/40 p-3 border border-neutral-800/80">
                {selectedRequest.description}
              </p>
            </div>

            {/* Stepper Display */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-neutral-400 uppercase">Stage Progress</div>
              <div className="grid grid-cols-4 gap-2">
                {stages.map(st => {
                  const isDone = selectedRequest.currentStage >= st.num;
                  const isCurrent = selectedRequest.currentStage === st.num;
                  return (
                    <div
                      key={st.num}
                      className={`p-2.5 border text-center font-mono text-xs space-y-1 transition-colors ${
                        isCurrent
                          ? 'border-neutral-400 bg-neutral-900 text-neutral-100 font-bold'
                          : isDone
                          ? 'border-neutral-800 bg-neutral-900/30 text-neutral-400'
                          : 'border-neutral-900 bg-neutral-950 text-neutral-600'
                      }`}
                    >
                      <div className="text-[10px] text-neutral-500">STAGE 0{st.num}</div>
                      <div className="truncate text-[11px]">{st.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approvals Checklist */}
            <div className="space-y-3">
              <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                Required Governance Approvals
              </div>

              <div className="space-y-3">
                {selectedRequest.approvals.map((app, idx) => (
                  <div key={idx} className="p-4 border border-neutral-800 bg-neutral-900/30 space-y-3 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-neutral-400" />
                        <span className="font-bold text-neutral-200">{app.role}</span>
                        <span className="text-neutral-500">·</span>
                        <span className="text-neutral-400">{app.approver}</span>
                      </div>
                      <span className={`uppercase font-bold ${
                        app.status === 'approved' ? 'text-emerald-400' : app.status === 'rejected' ? 'text-rose-500' : 'text-amber-500'
                      }`}>
                        {app.status}
                      </span>
                    </div>

                    {app.notes && (
                      <div className="text-[11px] text-neutral-400 bg-neutral-950 p-2 border border-neutral-900">
                        "{app.notes}"
                      </div>
                    )}

                    {/* Action buttons if this stage is pending */}
                    {app.status === 'pending' && selectedRequest.status !== 'rejected' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApprove(app.role)}
                          className="px-3 py-1 bg-neutral-100 text-neutral-950 hover:bg-white font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Stage</span>
                        </button>
                        <button
                          onClick={() => handleReject(app.role)}
                          className="px-3 py-1 border border-neutral-700 text-rose-400 hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
