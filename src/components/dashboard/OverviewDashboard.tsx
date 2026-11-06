import React from 'react';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText, MinimalStatus } from '../common/DotMatrixDisplay';
import { Phone, AlertTriangle, ShieldCheck, Server, RefreshCw, Plus, FileText, ArrowUpRight } from 'lucide-react';

interface OverviewDashboardProps {
  onOpenCreate: (type: 'incident' | 'request' | 'change' | 'asset') => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onOpenCreate }) => {
  const { incidents, requests, changes, assets, inventory, calls, activeCall, setActiveTab, simulateIncomingCall } = useITSM();

  const p1p2Count = incidents.filter(i => (i.priority === 'P1' || i.priority === 'P2') && i.status !== 'resolved' && i.status !== 'closed').length;
  const pendingCabCount = changes.filter(c => c.status === 'cab_review').length;
  const lowStockCount = inventory.filter(i => i.quantity <= i.minThreshold).length;
  const activeAssetsCount = assets.filter(a => a.status === 'in_use').length;

  return (
    <div className="space-y-8">
      {/* Top Banner / Dot-Matrix Display */}
      <div className="p-6 border border-neutral-800 bg-neutral-900/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span>NJURE TECH</span>
              <span aria-hidden="true">·</span>
              <span>SYSTEM ARCHITECTURE</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-500 font-mono">ALL NODES SYNCHRONIZED</span>
            </div>
            <div>
              <DotMatrixText text="SCRIBBLE IT" size="lg" activeColor="#ffffff" dimColor="#262626" glow />
            </div>
            <p className="text-xs text-neutral-400 max-w-xl font-mono">
              Free & Open IT Service Management suite. ITIL aligned: Incidents, Service Requests, Problems, Changes, CMDB Assets, Inventory, and CTI Telephony.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={simulateIncomingCall}
              className="px-3 py-2 text-xs font-mono tracking-wider border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors flex items-center gap-2"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Inbound Call</span>
            </button>
            <button
              onClick={() => onOpenCreate('incident')}
              className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Incident</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Telephony Alert Banner if ringing or active */}
      {activeCall && (
        <div className="p-4 border border-rose-600/60 bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-rose-500 animate-ping rounded-full" />
            <div>
              <div className="text-xs font-mono font-bold text-neutral-200 flex items-center gap-2">
                <span>TELEPHONY CTI: {activeCall.status.toUpperCase()}</span>
                <span className="text-neutral-500">·</span>
                <span className="text-neutral-400">{activeCall.callerName} ({activeCall.callerNumber})</span>
              </div>
              <div className="text-xs font-mono text-neutral-400">
                {activeCall.callerCompany} · Duration: {Math.floor(activeCall.durationSec / 60)}:{(activeCall.durationSec % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('telephony')}
            className="px-3 py-1.5 text-xs font-mono border border-rose-500 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
          >
            Open Softphone Panel
          </button>
        </div>
      )}

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('incidents')}
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
            <span>SLA monitoring active</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('changes')}
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
            <span>Awaiting voting sign-off</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('inventory')}
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
            <span>Reorder thresholds breached</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('assets')}
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
            <span>Tracked in CMDB</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 2-Column Split: Critical Incidents Queue & Datacenter Infrastructure Node */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Real-time Incident Board */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="text-xs font-mono text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <span>ACTIVE INCIDENTS QUEUE</span>
              <span className="text-neutral-500 tabular-nums">({incidents.length})</span>
            </div>
            <button
              onClick={() => setActiveTab('incidents')}
              className="text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              View All →
            </button>
          </div>

          <div className="border border-neutral-800 divide-y divide-neutral-800/80 bg-neutral-950">
            {incidents.slice(0, 4).map(incident => (
              <div
                key={incident.id}
                onClick={() => setActiveTab('incidents')}
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
            ))}
          </div>

          {/* Quick Request & Change Glance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border border-neutral-800 bg-neutral-900/20 space-y-3">
              <div className="text-xs font-mono uppercase text-neutral-400 flex items-center justify-between">
                <span>Recent Service Requests</span>
                <button onClick={() => setActiveTab('requests')} className="hover:text-neutral-200">More</button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {requests.slice(0, 2).map(r => (
                  <div key={r.id} className="p-2 border border-neutral-800/60 bg-neutral-950 space-y-1">
                    <div className="flex justify-between text-neutral-300">
                      <span>{r.id}</span>
                      <span className="text-neutral-500">Stage {r.currentStage}/4</span>
                    </div>
                    <div className="text-neutral-200 truncate">{r.catalogItemName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border border-neutral-800 bg-neutral-900/20 space-y-3">
              <div className="text-xs font-mono uppercase text-neutral-400 flex items-center justify-between">
                <span>Upcoming CAB Changes</span>
                <button onClick={() => setActiveTab('changes')} className="hover:text-neutral-200">More</button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {changes.slice(0, 2).map(c => (
                  <div key={c.id} className="p-2 border border-neutral-800/60 bg-neutral-950 space-y-1">
                    <div className="flex justify-between text-neutral-300">
                      <span>{c.id}</span>
                      <span className={c.riskScore === 'high' ? 'text-rose-500' : 'text-amber-500'}>{c.riskScore} risk</span>
                    </div>
                    <div className="text-neutral-200 truncate">{c.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Datacenter & Hardware Node Preview */}
        <div className="border border-neutral-800 bg-neutral-950 overflow-hidden space-y-4">
          <div className="relative aspect-video w-full bg-neutral-900">
            <img
              src="/src/assets/images/it_datacenter_minimal_1793899657206.jpg"
              alt="Datacenter Node Rack"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover grayscale contrast-125 opacity-80 hover:opacity-100 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-200 font-bold">RACK CLUSTER A-04</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-neutral-400 uppercase">Hardware Node Specification</div>
              <div className="text-sm font-medium text-neutral-100">Njure Infrastructure Edge Pod</div>
              <p className="text-xs text-neutral-400 font-mono">
                Dual redundant 10GbE fiber uplink with automated failover and telemetry logging.
              </p>
            </div>

            <div className="border-t border-neutral-800 pt-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>Core Switch Chassis</span>
                <span className="text-neutral-200">Cisco Catalyst 9300</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Database Replica</span>
                <span className="text-neutral-200">PowerEdge R750 NVMe</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Security Token Standard</span>
                <span className="text-neutral-200">FIDO2 WebAuthn</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('assets')}
              className="w-full py-2 text-xs font-mono tracking-wider border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              Inspect CMDB Inventory →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
