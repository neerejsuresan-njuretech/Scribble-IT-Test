import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Database, Download, Upload, RefreshCw, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react';

export const DatabaseModule: React.FC = () => {
  const {
    incidents, requests, problems, changes, assets, inventory,
    calls, invoices, resetDatabase, exportDatabaseJSON, importDatabaseJSON
  } = useITSM();

  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribble-itsm-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    const jsonStr = exportDatabaseJSON();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const ok = importDatabaseJSON(importText);
    if (ok) {
      setImportStatus('Database successfully restored from JSON snapshot.');
      setImportText('');
    } else {
      setImportStatus('Error: Invalid JSON schema format.');
    }
    setTimeout(() => setImportStatus(null), 4000);
  };

  const dbStats = [
    { label: 'Incident Records', count: incidents.length, schema: 'ITIL.ServiceOperation.Incident' },
    { label: 'Service Catalog Requests', count: requests.length, schema: 'ITIL.ServiceTransition.Request' },
    { label: 'Problem RCA Cases', count: problems.length, schema: 'ITIL.ProblemManagement.KEDB' },
    { label: 'Change Advisory RFCs', count: changes.length, schema: 'ITIL.ChangeManagement.RFC' },
    { label: 'CMDB Configuration Items', count: assets.length, schema: 'ITIL.AssetManagement.CMDB' },
    { label: 'Hardware Inventory SKUs', count: inventory.length, schema: 'Logistics.Stock.Consumables' },
    { label: 'Telephony CDR Records', count: calls.length, schema: 'VoIP.SIP.TelephonyCDR' },
    { label: 'Billed MSP Invoices', count: invoices.length, schema: 'Finance.Ledger.Invoice' }
  ];

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-400">ENTERPRISE SYSTEM STORAGE // PERSISTENCE & RECOVERY</div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-3">
            <span>DATABASE & BACKUP ENGINE</span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>PERSISTED IN STORAGE</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetDatabase}
            className="px-3.5 py-2 border border-rose-900 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Factory Seed</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 border border-neutral-700 bg-neutral-900 text-neutral-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* Multi-Cloud Database & Architecture Card */}
      <div className="p-4 border border-neutral-800 bg-neutral-900/40 space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span className="font-bold text-neutral-100 uppercase text-xs">Cloud Persistence & Database Topology</span>
          <span className="text-[10px] text-emerald-400">ACTIVE REGION: asia-south1</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="p-2.5 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Primary Live Database</div>
            <div className="font-bold text-neutral-200">Google Cloud Firestore</div>
            <div className="text-neutral-400">Project: gen-lang-client-0108198368</div>
            <div className="text-emerald-400 text-[10px]">● Realtime Synchronized</div>
          </div>

          <div className="p-2.5 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Relational SQL Integration</div>
            <div className="font-bold text-neutral-200">Cloud SQL (PostgreSQL)</div>
            <div className="text-neutral-400">Target: asia-south1</div>
            <div className="text-amber-400 text-[10px]">● Drizzle Schema Mapped</div>
          </div>

          <div className="p-2.5 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Google Workspace APIs</div>
            <div className="font-bold text-neutral-200">Drive · Forms · Chat · Sheets</div>
            <div className="text-neutral-400">OAuth Scopes Authorized</div>
            <div className="text-emerald-400 text-[10px]">● Token In-Memory Cached</div>
          </div>
        </div>
      </div>

      {/* Schema Entity Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dbStats.map((st, i) => (
          <div key={i} className="p-4 border border-neutral-800 bg-neutral-950 space-y-2">
            <div className="text-neutral-500 text-[10px] uppercase truncate">{st.schema}</div>
            <div className="text-2xl font-bold text-neutral-100 tabular-nums">{st.count}</div>
            <div className="text-neutral-300">{st.label}</div>
          </div>
        ))}
      </div>

      {/* Export & Import Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Export / Backup Card */}
        <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-100 uppercase border-b border-neutral-800 pb-3">
            <Download className="w-4 h-4 text-neutral-400" />
            <span>Export ITSM Database Backup</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Generate an encrypted JSON dump of all configuration items, active incidents, changes, telephony CDR call sessions, and financial ledgers for off-site disaster recovery or compliance audit.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Snapshot</span>
            </button>
            <button
              onClick={handleCopyJSON}
              className="px-4 py-2 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              {copied ? 'Copied to Clipboard!' : 'Copy Raw JSON'}
            </button>
          </div>
        </div>

        {/* Import / Restore Card */}
        <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-100 uppercase border-b border-neutral-800 pb-3">
            <Upload className="w-4 h-4 text-neutral-400" />
            <span>Restore Snapshot / Migration</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Paste a valid Scribble IT or FreeITSM JSON payload below to synchronize schemas and restore database state into browser storage.
          </p>

          <textarea
            rows={4}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste exported database JSON payload here..."
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 p-3 text-[11px] font-mono focus:border-neutral-600 focus:outline-none"
          />

          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold transition-colors flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import & Replace Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
