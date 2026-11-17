import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText, MinimalStatus } from '../common/DotMatrixDisplay';
import { Phone, AlertTriangle, ShieldCheck, Server, RefreshCw, Plus, ArrowUpRight } from 'lucide-react';

interface OverviewDashboardProps {
  onOpenCreate?: (type: 'incident' | 'request' | 'change' | 'asset' | 'problem' | 'inventory' | 'invoice') => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onOpenCreate }) => {
  const navigate = useNavigate();
  const {
    activeTenant, incidents, requests, changes, assets, inventory,
    activeCall, simulateIncomingCall
  } = useITSM();

  const p1p2Count = incidents.filter(i => (i.priority === 'P1' || i.priority === 'P2') && i.status !== 'resolved' && i.status !== 'closed').length;
  const pendingCabCount = changes.filter(c => c.status === 'cab_review').length;
  const lowStockCount = inventory.filter(i => i.quantity <= i.minThreshold).length;
  const activeAssetsCount = assets.filter(a => a.status === 'in_use').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Dot-Matrix Display */}
      <div className="p-5 border border-neutral-800 bg-neutral-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="font-bold text-neutral-300">NJURE TECH</span>
              <span aria-hidden="true">·</span>
              <span>{activeTenant.name.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span>{activeTenant.region}</span>
            </div>
            <div>
              <DotMatrixText text="SCRIBBLE IT" size="lg" activeColor="#ffffff" dimColor="#262626" glow />
            </div>
            <div className="text-xs text-neutral-500 font-mono">
              SERVICE DESK OPERATIONS · {incidents.length} INCIDENTS · {assets.length} ASSETS
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={simulateIncomingCall}
              className="px-3 py-2 text-xs font-mono tracking-wider border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test Inbound Call</span>
            </button>
            <button
              onClick={() => onOpenCreate ? onOpenCreate('incident') : navigate('/incidents/new')}
              className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Incident</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Telephony Alert Banner */}
      {activeCall && (
        <div className="p-4 border border-rose-600/60 bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-rose-500" />
            <div>
              <div className="text-xs font-mono font-bold text-neutral-200 flex items-center gap-2">
                <span>TELEPHONY CTI: {activeCall.status.toUpperCase()}</span>
                <span className="text-neutral-500">·</span>
                <span className="text-neutral-400">{activeCall.callerName} ({activeCall.callerNumber})</span>
              </div>
              <div className="text-xs font-mono text-neutral-400">
                {activeCall.callerCompany}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/telephony')}
            className="px-3 py-1.5 text-xs font-mono border border-rose-500 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
          >
            Open Softphone Panel
          </button>
        </div>
      )}

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/incidents')}
          className="p-5 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>ACTIVE P1/P2 INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-mono tabular-nums font-bold text-neutral-100">
            {p1p2Count.toString().padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs font-mono text-neutral-500 flex items-center gap-1">
            <span>{incidents.length} total recorded</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => navigate('/changes')}
          className="p-5 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>PENDING CAB REVIEWS</span>
            <ShieldCheck className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-mono tabular-nums font-bold text-neutral-100">
            {pendingCabCount.toString().padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs font-mono text-neutral-500 flex items-center gap-1">
            <span>{changes.length} total RFCs</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => navigate('/inventory')}
          className="p-5 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>LOW STOCK ALERTS</span>
            <RefreshCw className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-mono tabular-nums font-bold text-neutral-100">
            {lowStockCount.toString().padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs font-mono text-neutral-500 flex items-center gap-1">
            <span>{inventory.length} stock SKUs</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => navigate('/assets')}
          className="p-5 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>DEPLOYED ASSETS</span>
            <Server className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-mono tabular-nums font-bold text-neutral-100">
            {activeAssetsCount.toString().padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs font-mono text-neutral-500 flex items-center gap-1">
            <span>{assets.length} tracked in CMDB</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 2-Column Split: Incidents Queue & CMDB Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="text-xs font-mono text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <span>ACTIVE INCIDENTS QUEUE</span>
              <span className="text-neutral-500 tabular-nums">({incidents.length})</span>
            </div>
            <button
              onClick={() => navigate('/incidents')}
              className="text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              View All &rarr;
            </button>
          </div>

          <div className="border border-neutral-800 divide-y divide-neutral-800/80 bg-neutral-950">
            {incidents.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-neutral-500 space-y-3">
                <div>No incidents logged for {activeTenant.name}.</div>
                <button
                  onClick={() => navigate('/incidents/new')}
                  className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                >
                  + Log First Incident
                </button>
              </div>
            ) : (
              incidents.slice(0, 4).map(incident => (
                <div
                  key={incident.id}
                  onClick={() => navigate('/incidents')}
                  className="p-4 hover:bg-neutral-900/60 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="font-bold text-neutral-200">{incident.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className={incident.priority === 'P1' ? 'text-rose-500 font-bold' : incident.priority === 'P2' ? 'text-amber-500' : 'text-neutral-400'}>
                        {incident.priority}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{incident.category}</span>
                    </div>
                    <MinimalStatus
                      status={incident.status}
                      variant={incident.status === 'in_progress' ? 'amber' : incident.status === 'resolved' ? 'emerald' : 'neutral'}
                    />
                  </div>

                  <div className="text-sm font-medium text-neutral-200 line-clamp-1">
                    {incident.title}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                    <span>Assignee: {incident.assignee}</span>
                    <span>Target SLA: {new Date(incident.slaDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border border-neutral-800 bg-neutral-900/20 space-y-3">
              <div className="text-xs font-mono uppercase text-neutral-400 flex items-center justify-between">
                <span>Service Requests ({requests.length})</span>
                <button onClick={() => navigate('/requests')} className="hover:text-neutral-200">Open</button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {requests.length === 0 ? (
                  <div className="text-neutral-500 py-3">No service requests yet.</div>
                ) : (
                  requests.slice(0, 2).map(r => (
                    <div key={r.id} className="p-2 border border-neutral-800/60 bg-neutral-950 space-y-1">
                      <div className="flex justify-between text-neutral-300">
                        <span>{r.id}</span>
                        <span className="text-neutral-500">Stage {r.currentStage}/4</span>
                      </div>
                      <div className="text-neutral-200 truncate">{r.catalogItemName}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border border-neutral-800 bg-neutral-900/20 space-y-3">
              <div className="text-xs font-mono uppercase text-neutral-400 flex items-center justify-between">
                <span>CAB Changes ({changes.length})</span>
                <button onClick={() => navigate('/changes')} className="hover:text-neutral-200">Open</button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {changes.length === 0 ? (
                  <div className="text-neutral-500 py-3">No change requests yet.</div>
                ) : (
                  changes.slice(0, 2).map(c => (
                    <div key={c.id} className="p-2 border border-neutral-800/60 bg-neutral-950 space-y-1">
                      <div className="flex justify-between text-neutral-300">
                        <span>{c.id}</span>
                        <span className={c.riskScore === 'high' ? 'text-rose-500' : 'text-amber-500'}>{c.riskScore} risk</span>
                      </div>
                      <div className="text-neutral-200 truncate">{c.title}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live CMDB Assets Register Summary */}
        <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-200 uppercase">CMDB CONFIGURATION ITEMS</span>
            <span className="text-neutral-500 tabular-nums">{assets.length}</span>
          </div>

          {assets.length === 0 ? (
            <div className="py-6 text-center text-neutral-500 space-y-3">
              <div>No assets registered in {activeTenant.name} CMDB.</div>
              <button
                onClick={() => navigate('/assets/new')}
                className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              >
                + Register Asset
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-900">
              {assets.slice(0, 4).map(asset => (
                <div key={asset.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-neutral-200 truncate">{asset.name}</div>
                    <div className="text-[11px] text-neutral-500">{asset.assetTag} · {asset.location}</div>
                  </div>
                  <span className="text-[10px] text-neutral-400 uppercase shrink-0">{asset.status}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate('/assets')}
            className="w-full py-2 text-xs font-mono tracking-wider border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Inspect CMDB Register &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

