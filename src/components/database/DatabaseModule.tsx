import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { firebaseConfigMeta } from '../../lib/firebase';
import { apiUrl, isStaticHostWithoutBackend } from '../../utils/apiClient';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  AlertTriangle,
  Database,
  Building2,
  Sparkles,
} from 'lucide-react';

interface ServerDatabaseInfo {
  ok: boolean;
  engine: string;
  projectId: string | null;
  firestoreDatabaseId: string;
  serverTime: string;
}

export const DatabaseModule: React.FC = () => {
  const {
    tenants,
    incidents,
    requests,
    problems,
    changes,
    assets,
    inventory,
    calls,
    invoices,
    workflows,
    processMaps,
    googleUser,
    cloudSyncStatus,
    lastCloudSyncAt,
    cloudSyncError,
    loginWithGoogle,
    forceCloudSync,
    workspaceTotals,
    loadEnterpriseSeedData,
    resetDatabase,
    exportDatabaseJSON,
    importDatabaseJSON,
  } = useITSM();

  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerDatabaseInfo | null>(null);

  useEffect(() => {
    if (isStaticHostWithoutBackend()) return;
    let active = true;
    fetch(apiUrl('/api/system/database-info'))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active && data?.ok) setServerInfo(data as ServerDatabaseInfo);
      })
      .catch(() => {
        // Client Firestore SDK still works independently even when backend probe is unavailable
      });
    return () => {
      active = false;
    };
  }, []);

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

  const logosConfiguredCount = tenants.filter(
    t =>
      Boolean(t.companyLogoDataUrl) ||
      Boolean(t.portalBranding?.employees?.logoDataUrl) ||
      Boolean(t.portalBranding?.enduser?.logoDataUrl) ||
      Boolean(t.portalBranding?.iam?.logoDataUrl)
  ).length;

  const dbStats = [
    { label: 'Company Profiles (Logos)', count: `${workspaceTotals.companies} (${workspaceTotals.companyLogos})`, schema: 'workspaces/{uid}/tenants' },
    { label: 'IAM User Profiles', count: workspaceTotals.users, schema: 'module_state/auth_accounts_*' },
    { label: 'IAM Access Policies', count: workspaceTotals.policies, schema: 'module_state/iam_policies' },
    { label: 'KB Articles, SOPs & Wiki', count: workspaceTotals.kbArticles + workspaceTotals.wikiPages, schema: 'module_state/kb+wiki' },
    { label: 'Incident Records (All Orgs)', count: workspaceTotals.incidents, schema: `workspaces/{uid}/incidents (${incidents.length} active org)` },
    { label: 'Service Requests (All Orgs)', count: workspaceTotals.requests, schema: `workspaces/{uid}/service_requests (${requests.length} active org)` },
    { label: 'CMDB Assets & Stock', count: workspaceTotals.assets + inventory.length, schema: 'module_state/assets+inventory' },
    { label: 'Problems, CAB & Tasks', count: workspaceTotals.problems + workspaceTotals.changes + workspaceTotals.tasks, schema: `module_state/problems+changes+tasks (${problems.length + changes.length + workflows.length + processMaps.length + calls.length + invoices.length})` },
  ];

  const syncBadgeLabel =
    cloudSyncStatus === 'synced'
      ? 'CLOUD SYNCED'
      : cloudSyncStatus === 'syncing'
      ? 'SYNCING...'
      : cloudSyncStatus === 'connecting'
      ? 'CONNECTING...'
      : cloudSyncStatus === 'error'
      ? 'SYNC ERROR'
      : 'LOCAL ONLY';

  const syncBadgeClass =
    cloudSyncStatus === 'synced'
      ? 'text-emerald-400'
      : cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting'
      ? 'text-amber-400'
      : cloudSyncStatus === 'error'
      ? 'text-rose-400'
      : 'text-neutral-400';

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 text-[10px]">NJURE TECH · CENTRALIZED CLOUD DATABASE</div>
          <h1 className="text-xl font-bold text-neutral-100 flex flex-wrap items-center gap-3">
            <span>DATABASE TOPOLOGY &amp; CROSS-DEVICE SYNC</span>
            <span className={`text-xs font-normal flex items-center gap-1.5 ${syncBadgeClass}`}>
              {cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span
                  className={`w-1.5 h-1.5 inline-block ${
                    cloudSyncStatus === 'synced'
                      ? 'bg-emerald-500'
                      : cloudSyncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-neutral-500'
                  }`}
                />
              )}
              <span>{syncBadgeLabel}</span>
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {googleUser ? (
            <button
              type="button"
              onClick={() => void forceCloudSync()}
              disabled={cloudSyncStatus === 'syncing'}
              className="px-3.5 py-2 border border-emerald-700/80 bg-emerald-950/30 hover:bg-emerald-900/40 disabled:opacity-50 text-emerald-300 font-bold transition-colors flex items-center gap-2"
            >
              {cloudSyncStatus === 'syncing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              <span>Force Cloud Sync Now</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void loginWithGoogle()}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors flex items-center gap-2"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Connect Google for Cross-Device Sync</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadEnterpriseSeedData}
            className="px-3.5 py-2 border border-sky-700/80 bg-sky-950/30 text-sky-300 hover:bg-sky-900/40 font-bold transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Enterprise Seed Data</span>
          </button>
          <button
            type="button"
            onClick={resetDatabase}
            className="px-3.5 py-2 border border-rose-900 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear Local Data</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 border border-neutral-700 bg-neutral-900 text-neutral-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {cloudSyncError && (
        <div className="p-3 border border-rose-800 bg-rose-950/30 text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="break-all">
            <div className="font-bold text-rose-300">Cloud Sync Warning</div>
            <div className="text-[11px] text-rose-200/90 mt-0.5">{cloudSyncError}</div>
          </div>
        </div>
      )}

      {/* Multi-Cloud Database & Architecture Card */}
      <div className="p-4 border border-neutral-800 bg-neutral-900/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
          <span className="font-bold text-neutral-100 uppercase text-xs flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>Centralized Cloud Persistence &amp; Firestore Topology</span>
          </span>
          <span className="text-[10px] text-neutral-400">
            {lastCloudSyncAt
              ? `LAST CLOUD SYNC: ${new Date(lastCloudSyncAt).toLocaleTimeString()}`
              : 'SIGN IN WITH GOOGLE TO ENABLE MULTI-DEVICE SYNC'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Primary Live Cloud Database</div>
            <div className="font-bold text-neutral-100">
              {serverInfo?.engine || 'Google Cloud Firestore (Enterprise)'}
            </div>
            <div className="text-neutral-400 truncate" title={firebaseConfigMeta.projectId}>
              Project: {serverInfo?.projectId || firebaseConfigMeta.projectId}
            </div>
            <div className="text-neutral-500 truncate text-[10px]" title={firebaseConfigMeta.firestoreDatabaseId}>
              DB ID: {serverInfo?.firestoreDatabaseId || firebaseConfigMeta.firestoreDatabaseId}
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Cross-Device Sync Account</div>
            <div className="font-bold text-neutral-100 truncate">
              {googleUser ? googleUser.email || googleUser.displayName : 'Not Connected (Browser Local Only)'}
            </div>
            <div className="text-neutral-400 text-[10px]">
              {googleUser
                ? 'All incidents, requests, company logos & settings sync automatically.'
                : 'Data is saved locally per browser until Google Cloud Sync is connected.'}
            </div>
            <div className={`text-[10px] flex items-center gap-1.5 ${syncBadgeClass}`}>
              {googleUser ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
              <span>{syncBadgeLabel}</span>
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
            <div className="text-neutral-500 uppercase text-[10px]">Multi-Company Logo Storage</div>
            <div className="font-bold text-neutral-100 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-rose-500" />
              <span>{tenants.length} Profiles · {logosConfiguredCount} Custom Logos</span>
            </div>
            <div className="text-neutral-400 text-[10px]">
              Auto-optimized ≤ 256px WebP/PNG payloads for quota-safe local + cloud persistence.
            </div>
            <div className="text-emerald-400 text-[10px]">● Per-Key Isolated Local Cache Active</div>
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
            <span>Export Full Multi-Company Backup</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Generate a complete JSON archive containing all company profiles, uploaded logos, incidents, service requests, workflows, process maps, telephony settings, CMDB assets, and invoices.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Snapshot</span>
            </button>
            <button
              type="button"
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
            Paste a valid Scribble IT JSON export payload below to restore all tenants, logos, tickets, and settings (automatically synced to Firestore when signed in).
          </p>

          <textarea
            rows={4}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste exported database JSON payload here..."
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 p-3 text-[11px] font-mono focus:border-neutral-600 focus:outline-none"
          />

          <button
            type="button"
            onClick={handleImport}
            disabled={!importText.trim()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold transition-colors flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import &amp; Restore Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
