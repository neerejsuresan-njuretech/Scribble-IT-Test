import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ComponentHealth } from '../../types/itsm';
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export const ServiceStatusPage: React.FC = () => {
  const { activeTenant, statusComponents, updateComponentHealth } = useITSM();
  const [autoIncident, setAutoIncident] = useState(true);

  const operationalCount = statusComponents.filter(c => c.status === 'operational').length;

  const getHealthMeta = (status: ComponentHealth) => {
    switch (status) {
      case 'operational': return { label: 'OPERATIONAL', cls: 'text-emerald-400', Icon: CheckCircle2 };
      case 'degraded': return { label: 'DEGRADED', cls: 'text-amber-400', Icon: AlertTriangle };
      case 'partial_outage': return { label: 'PARTIAL OUTAGE', cls: 'text-orange-400', Icon: AlertTriangle };
      case 'major_outage': return { label: 'MAJOR OUTAGE', cls: 'text-rose-400', Icon: XCircle };
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · PUBLIC & INTERNAL SERVICE STATUS</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Activity className="w-5 h-5 text-rose-500" />
            <span>SERVICE STATUS PAGE</span>
            <span className="text-xs font-normal text-neutral-400 tabular-nums">
              {operationalCount}/{statusComponents.length} Components Nominal
            </span>
          </h1>
        </div>
        <label className="flex items-center gap-2 text-neutral-300 cursor-pointer border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <input type="checkbox" checked={autoIncident} onChange={e => setAutoIncident(e.target.checked)} className="accent-rose-600" />
          <span>Auto-open Incident on Outage</span>
        </label>
      </div>

      <div className="border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900">
        {statusComponents.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No service status components registered for {activeTenant.name}.
          </div>
        ) : (
          statusComponents.map(comp => {
            const meta = getHealthMeta(comp.status);
            const Icon = meta.Icon;
            return (
              <div key={comp.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-neutral-900/30">
                <div className="space-y-1">
                  <div className="text-[11px] text-neutral-500">{comp.group} · {comp.id} {comp.linkedIncidentId ? `· Linked: ${comp.linkedIncidentId}` : ''}</div>
                  <div className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meta.cls}`} />
                    <span>{comp.name}</span>
                  </div>
                  <div className="text-neutral-400 tabular-nums">
                    Uptime: {comp.uptimePct.toFixed(2)}% · Latency: {comp.latencyMs}ms · Status: <span className={`font-bold ${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(['operational', 'degraded', 'partial_outage', 'major_outage'] as ComponentHealth[]).map(st => (
                    <button
                      key={st}
                      onClick={() => updateComponentHealth(comp.id, st, autoIncident)}
                      className={`px-2.5 py-1.5 border uppercase text-[10px] transition-colors ${
                        comp.status === st
                          ? 'border-neutral-400 bg-neutral-800 text-white font-bold'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-200'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
