import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { MorningCheckItem } from '../../types/itsm';
import { CheckSquare, Plus, CheckCircle2 } from 'lucide-react';

const DEFAULT_TEMPLATE: MorningCheckItem[] = [
  { id: 'mc-1', label: 'Off-site Immutable Backup Snapshot Verification', category: 'Backups', status: 'pending' },
  { id: 'mc-2', label: 'Core Switch BGP Peers & Optical Thresholds', category: 'Network', status: 'pending' },
  { id: 'mc-3', label: 'Primary & Read-Replica Database Replication Lag (<30s)', category: 'Databases', status: 'pending' },
  { id: 'mc-4', label: 'EDR / SIEM Unacknowledged Critical Security Alerts', category: 'Security', status: 'pending' },
  { id: 'mc-5', label: 'UPS Battery Telemetry & Rack Temperature', category: 'Infrastructure', status: 'pending' }
];

export const MorningChecksPage: React.FC = () => {
  const { activeTenant, morningChecks, submitMorningCheckRun } = useITSM();
  const [draftItems, setDraftItems] = useState<MorningCheckItem[]>(
    morningChecks[0]?.items.map(i => ({ ...i, status: 'pending', note: '' })) || DEFAULT_TEMPLATE
  );
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const setItemStatus = (id: string, status: MorningCheckItem['status']) => {
    setDraftItems(prev => prev.map(i => (i.id === id ? { ...i, status } : i)));
  };

  const setItemNote = (id: string, note: string) => {
    setDraftItems(prev => prev.map(i => (i.id === id ? { ...i, note } : i)));
  };

  const handleSubmitRun = (e: React.FormEvent) => {
    e.preventDefault();
    submitMorningCheckRun(draftItems);
    setSubmittedNotice(true);
    setTimeout(() => setSubmittedNotice(false), 3500);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · DAILY OPERATIONAL HEALTH CHECKS</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-rose-500" />
            <span>MORNING CHECKS</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{morningChecks.length} Historical Runs</span>
          </h1>
        </div>
      </div>

      {submittedNotice && (
        <div className="p-3 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Daily Morning Check run logged and added to tenant audit trail.</span>
        </div>
      )}

      {/* Active Daily Runner */}
      <form onSubmit={handleSubmitRun} className="border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span className="font-bold text-neutral-200 uppercase">TODAY'S MORNING CHECK RUNNER</span>
          <button type="submit" className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Daily Check Sign-Off</span>
          </button>
        </div>

        <div className="divide-y divide-neutral-800/80">
          {draftItems.map(item => (
            <div key={item.id} className="py-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-5">
                <div className="text-[10px] text-neutral-500 uppercase">{item.category}</div>
                <div className="font-bold text-neutral-100 mt-0.5">{item.label}</div>
              </div>
              <div className="lg:col-span-3 flex items-center gap-1.5">
                {(['pass', 'warn', 'fail'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setItemStatus(item.id, st)}
                    className={`px-3 py-1.5 border uppercase text-[10px] font-bold transition-colors ${
                      item.status === st
                        ? st === 'pass'
                          ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                          : st === 'warn'
                          ? 'border-amber-600 bg-amber-950/50 text-amber-300'
                          : 'border-rose-600 bg-rose-950/50 text-rose-300'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-500'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <div className="lg:col-span-4">
                <input
                  type="text"
                  value={item.note || ''}
                  onChange={e => setItemNote(item.id, e.target.value)}
                  placeholder="Observation / linked incident ID..."
                  className="w-full bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-neutral-200 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </form>

      {/* Historical Trend Matrix */}
      <div className="border border-neutral-800 bg-neutral-950">
        <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/50 font-bold text-neutral-300 uppercase">
          HISTORICAL CHECK LOGS & TREND
        </div>
        <div className="divide-y divide-neutral-900">
          {morningChecks.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              No morning checks logged yet. Complete today&apos;s runner above to create the first run record.
            </div>
          ) : (
            morningChecks.map(run => {
              const passCount = run.items.filter(i => i.status === 'pass').length;
              const failCount = run.items.filter(i => i.status === 'fail').length;
              return (
                <div key={run.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-neutral-100">{run.date} · Signed off by {run.engineer} ({run.completedAt})</div>
                    <div className="tabular-nums text-neutral-400">
                      <span className="text-emerald-400 font-bold">{passCount} PASS</span> ·{' '}
                      <span className={failCount > 0 ? 'text-rose-400 font-bold' : 'text-neutral-500'}>{failCount} FAIL</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    {run.items.map(it => (
                      <div key={it.id} className="px-2.5 py-1.5 border border-neutral-900 bg-neutral-900/20 flex items-center justify-between gap-2">
                        <span className="truncate text-neutral-300">{it.label}</span>
                        <span className={
                          it.status === 'pass' ? 'text-emerald-400 font-bold' :
                          it.status === 'warn' ? 'text-amber-400 font-bold' :
                          it.status === 'fail' ? 'text-rose-400 font-bold' : 'text-neutral-500'
                        }>
                          {it.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
