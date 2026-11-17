import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { BarChart3, Download, Shield } from 'lucide-react';

export const ReportsAuditPage: React.FC = () => {
  const {
    activeTenant, incidents, requests, problems, changes,
    assets, contracts, invoices, auditLogs
  } = useITSM();

  const [drillModule, setDrillModule] = useState<string>('ALL');

  const resolvedIncidents = incidents.filter(i => i.status === 'resolved' || i.status === 'closed');
  const slaCompliant = incidents.filter(i => !i.slaBreached).length;
  const slaPct = incidents.length > 0 ? Math.round((slaCompliant / incidents.length) * 100) : 100;
  const totalContractSpend = contracts.reduce((acc, c) => acc + c.annualValue, 0);
  const totalAssetValue = assets.reduce((acc, a) => acc + a.currentBookValue, 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);

  const filteredLogs = drillModule === 'ALL' ? auditLogs : auditLogs.filter(a => a.module === drillModule);
  const uniqueModules = ['ALL', ...Array.from(new Set(auditLogs.map(a => a.module)))];

  const handleDownloadCsv = () => {
    const headers = ['ID', 'Tenant', 'Type', 'Title', 'Status', 'Priority_or_Value', 'Owner'];
    const rows = [
      ...incidents.map(i => [i.id, activeTenant.slug, 'Incident', i.title, i.status, i.priority, i.assignee]),
      ...requests.map(r => [r.id, activeTenant.slug, 'Request', r.catalogItemName, r.status, `${activeTenant.currency} ${r.cost}`, r.requesterName]),
      ...changes.map(c => [c.id, activeTenant.slug, 'Change', c.title, c.status, c.riskScore, c.assignedEngineer])
    ];
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribble_${activeTenant.slug}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · ANALYTICS, EXPORTS & TENANT AUDIT LOG</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-rose-500" />
            <span>REPORTING & AUDITING</span>
          </h1>
        </div>
        <button onClick={handleDownloadCsv} className="px-4 py-2 bg-neutral-100 text-neutral-950 hover:bg-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 border border-neutral-800 bg-neutral-900/30">
          <div className="text-neutral-500">SLA COMPLIANCE RATE</div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">{slaPct}%</div>
          <div className="text-neutral-500 mt-1">{resolvedIncidents.length}/{incidents.length} resolved</div>
        </div>
        <div className="p-4 border border-neutral-800 bg-neutral-900/30">
          <div className="text-neutral-500">CMDB BOOK VALUE</div>
          <div className="text-3xl font-bold text-neutral-100 mt-2">{activeTenant.currency} {totalAssetValue.toLocaleString()}</div>
          <div className="text-neutral-500 mt-1">{assets.length} tracked assets</div>
        </div>
        <div className="p-4 border border-neutral-800 bg-neutral-900/30">
          <div className="text-neutral-500">CONTRACT COMMITMENT</div>
          <div className="text-3xl font-bold text-neutral-100 mt-2">{activeTenant.currency} {totalContractSpend.toLocaleString()}</div>
          <div className="text-neutral-500 mt-1">{contracts.length} active agreements</div>
        </div>
        <div className="p-4 border border-neutral-800 bg-neutral-900/30">
          <div className="text-neutral-500">SETTLED BILLING</div>
          <div className="text-3xl font-bold text-neutral-100 mt-2">{activeTenant.currency} {paidInvoices.toLocaleString()}</div>
          <div className="text-neutral-500 mt-1">{problems.length} KEDB/Problems tracked</div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="border border-neutral-800 bg-neutral-950">
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold text-neutral-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>IMMUTABLE TENANT AUDIT TRAIL ({filteredLogs.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {uniqueModules.map(mod => (
              <button
                key={mod}
                onClick={() => setDrillModule(mod)}
                className={`px-2.5 py-1 border text-[10px] ${drillModule === mod ? 'border-neutral-500 bg-neutral-800 text-white font-bold' : 'border-neutral-800 text-neutral-400'}`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse tabular-nums">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 uppercase text-[10px]">
                <th className="py-2 px-4">Timestamp</th>
                <th className="py-2 px-4">Actor</th>
                <th className="py-2 px-4">Module</th>
                <th className="py-2 px-4">Action</th>
                <th className="py-2 px-4">Target</th>
                <th className="py-2 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-neutral-900/30">
                  <td className="py-2.5 px-4 text-neutral-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-neutral-200">{log.actor}</td>
                  <td className="py-2.5 px-4 text-neutral-400">{log.module}</td>
                  <td className="py-2.5 px-4 text-amber-400 font-bold">{log.action}</td>
                  <td className="py-2.5 px-4 text-neutral-300">{log.targetId}</td>
                  <td className="py-2.5 px-4 text-neutral-400">{log.detail}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-neutral-500">No audit events logged yet for {activeTenant.name}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
