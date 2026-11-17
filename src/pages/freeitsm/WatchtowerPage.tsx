import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import {
  Eye, AlertTriangle, ShieldCheck, Globe, FileText,
  CheckSquare, Package, Key, ArrowUpRight, Radio
} from 'lucide-react';

export const WatchtowerPage: React.FC = () => {
  const {
    activeTenant, incidents, changes, tasks, contracts, domains,
    inventory, softwareLicenses, morningChecks, statusComponents
  } = useITSM();

  const [visibleCards, setVisibleCards] = useState<Record<string, boolean>>({
    incidents: true,
    changes: true,
    domains: true,
    contracts: true,
    software: true,
    inventory: true,
    checks: true,
    tasks: true
  });

  const toggleCard = (key: string) => {
    setVisibleCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const p1p2Open = incidents.filter(i => (i.priority === 'P1' || i.priority === 'P2') && i.status !== 'resolved' && i.status !== 'closed');
  const pendingCab = changes.filter(c => c.status === 'cab_review');
  const expiringDomains = domains.filter(d => d.securityGrade === 'C' || d.securityGrade === 'D' || d.securityGrade === 'F' || d.lookalikeAlerts > 0);
  const expiringContracts = contracts.filter(c => c.status === 'expiring_soon' || c.status === 'rfp_open');
  const overAllocatedSw = softwareLicenses.filter(s => s.complianceStatus !== 'compliant');
  const lowInventory = inventory.filter(i => i.quantity <= i.minThreshold);
  const latestCheck = morningChecks[0];
  const checkFails = latestCheck ? latestCheck.items.filter(i => i.status === 'fail' || i.status === 'warn') : [];
  const openTasks = tasks.filter(t => t.column !== 'done');
  const degradedServices = statusComponents.filter(s => s.status !== 'operational');

  const totalAlerts = p1p2Open.length + pendingCab.length + expiringDomains.length + expiringContracts.length + overAllocatedSw.length + lowInventory.length + checkFails.length + degradedServices.length;

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · ATTENTION COMMAND CENTER</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Eye className="w-5 h-5 text-rose-500" />
            <span>WATCHTOWER</span>
            <span className="text-xs font-normal text-amber-400 tabular-nums">{totalAlerts} Attention Signals</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(visibleCards).map(k => (
            <button
              key={k}
              onClick={() => toggleCard(k)}
              className={`px-2.5 py-1 border uppercase text-[10px] transition-colors ${
                visibleCards[k]
                  ? 'border-neutral-600 bg-neutral-800 text-neutral-100 font-bold'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-500'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Status Banner if any component degraded */}
      {degradedServices.length > 0 && (
        <div className="p-4 border border-amber-700/60 bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-amber-200">{degradedServices.length} Service Status Components Degraded or Offline</div>
              <div className="text-neutral-400 mt-0.5">{degradedServices.map(d => d.name).join(' · ')}</div>
            </div>
          </div>
          <Link to="/status" className="px-3 py-1.5 border border-amber-600 text-amber-200 hover:bg-amber-900/40 whitespace-nowrap shrink-0">
            Open Status Page
          </Link>
        </div>
      )}

      {/* Watchtower Attention Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {visibleCards.incidents && (
          <Link to="/incidents" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>CRITICAL INCIDENTS</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{p1p2Open.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {p1p2Open.slice(0, 2).map(inc => (
                <div key={inc.id} className="truncate">{inc.id} · {inc.title}</div>
              ))}
              {p1p2Open.length === 0 && (
                <div className={incidents.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {incidents.length === 0 ? 'No incidents logged' : 'Zero open P1/P2 tickets'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.changes && (
          <Link to="/changes" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>PENDING CAB VOTES</span>
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{pendingCab.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {pendingCab.slice(0, 2).map(c => (
                <div key={c.id} className="truncate">{c.id} · {c.title}</div>
              ))}
              {pendingCab.length === 0 && (
                <div className={changes.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {changes.length === 0 ? 'No change requests logged' : 'CAB queue clear'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.domains && (
          <Link to="/domains" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>DOMAIN / SSL ALERTS</span>
              <Globe className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{expiringDomains.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {expiringDomains.slice(0, 2).map(d => (
                <div key={d.id} className="truncate">{d.domain} · Grade {d.securityGrade} · {d.lookalikeAlerts} lookalike</div>
              ))}
              {expiringDomains.length === 0 && (
                <div className={domains.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {domains.length === 0 ? 'No domains tracked' : 'All domains Grade A/A+'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.contracts && (
          <Link to="/contracts" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>CONTRACTS & RFPs</span>
              <FileText className="w-4 h-4 text-neutral-300" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{expiringContracts.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {expiringContracts.slice(0, 2).map(c => (
                <div key={c.id} className="truncate">{c.vendor} · Renewal {c.renewalDate}</div>
              ))}
              {expiringContracts.length === 0 && (
                <div className={contracts.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {contracts.length === 0 ? 'No contracts registered' : 'No upcoming renewals'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.checks && (
          <Link to="/checks" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>MORNING CHECK FLAGS</span>
              <CheckSquare className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{checkFails.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {checkFails.slice(0, 2).map(m => (
                <div key={m.id} className="truncate">{m.status.toUpperCase()} · {m.label}</div>
              ))}
              {checkFails.length === 0 && (
                <div className={morningChecks.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {morningChecks.length === 0 ? 'No morning checks logged' : 'All daily checks green'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.software && (
          <Link to="/software" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>SOFTWARE COMPLIANCE</span>
              <Key className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{overAllocatedSw.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {overAllocatedSw.slice(0, 2).map(s => (
                <div key={s.id} className="truncate">{s.name} ({s.usedSeats}/{s.totalSeats})</div>
              ))}
              {overAllocatedSw.length === 0 && (
                <div className={softwareLicenses.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {softwareLicenses.length === 0 ? 'No licences tracked' : 'All licences compliant'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.inventory && (
          <Link to="/inventory" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>LOW STOCK SKUs</span>
              <Package className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{lowInventory.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {lowInventory.slice(0, 2).map(i => (
                <div key={i.id} className="truncate">{i.sku} · Qty {i.quantity}/{i.minThreshold}</div>
              ))}
              {lowInventory.length === 0 && (
                <div className={inventory.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {inventory.length === 0 ? 'No inventory SKUs' : 'Stock thresholds healthy'}
                </div>
              )}
            </div>
          </Link>
        )}

        {visibleCards.tasks && (
          <Link to="/tasks" className="p-4 border border-neutral-800 bg-neutral-900/30 hover:border-neutral-600 transition-colors space-y-3">
            <div className="flex items-center justify-between text-neutral-400">
              <span>OPEN KANBAN TASKS</span>
              <ArrowUpRight className="w-4 h-4 text-neutral-300" />
            </div>
            <div className="text-3xl font-bold text-neutral-100 tabular-nums">{openTasks.length}</div>
            <div className="space-y-1 text-[11px] text-neutral-400">
              {openTasks.slice(0, 2).map(t => (
                <div key={t.id} className="truncate">{t.id} · {t.title}</div>
              ))}
              {openTasks.length === 0 && (
                <div className={tasks.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}>
                  {tasks.length === 0 ? 'No tasks created' : 'Board clear'}
                </div>
              )}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
};
