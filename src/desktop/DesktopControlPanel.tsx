import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Globe,
  Laptop,
  LogOut,
  Power,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  authApi,
  ClientConfigDto,
  getAccessToken,
  UserSessionDto,
} from '../services/api';
import { useITSM } from '../context/ITSMContext';
import {
  getCachedDesktopBaseUrl,
  getCachedDesktopRuntimeInfo,
  getWindowsAutostartEnabled,
  openDesktopExternalUrl,
  saveDesktopApiBaseUrl,
  sendWindowsNotification,
  setWindowsAutostartEnabled,
} from './desktopBridge';
import { PROJECT_IDENTITY, GITHUB_REPOSITORY_URL } from '../config/openSourceConfig';

interface DesktopControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopControlPanel: React.FC<DesktopControlPanelProps> = ({ isOpen, onClose }) => {
  const { isManagedDeviceVerified, managedDevice, logoutSession, showToast } = useITSM();
  const runtimeInfo = getCachedDesktopRuntimeInfo();

  const [serverUrl, setServerUrl] = useState<string>(() => getCachedDesktopBaseUrl());
  const [serverConfig, setServerConfig] = useState<ClientConfigDto | null>(null);
  const [serverStatus, setServerStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [serverMessage, setServerMessage] = useState<string>('');

  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string>('');

  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  const hasBackendToken = Boolean(getAccessToken());

  const loadServerConfig = async () => {
    if (!getCachedDesktopBaseUrl()) {
      setServerConfig(null);
      setServerStatus('idle');
      setServerMessage('Local sandbox / unconfigured server URL. Enter an HTTPS FastAPI server URL or http://localhost:8000.');
      return;
    }
    setServerStatus('checking');
    setServerMessage('');
    try {
      const cfg = await authApi.getClientConfig();
      setServerConfig(cfg);
      setServerStatus('connected');
      setServerMessage(`Connected to ${cfg.instance_name} (${cfg.deployment_mode} · ${cfg.api_prefix})`);
    } catch (err) {
      setServerStatus('error');
      setServerMessage(err instanceof Error ? err.message : 'Unable to reach /api/v1/client/config');
    }
  };

  const loadSessions = async () => {
    if (!getCachedDesktopBaseUrl() || !getAccessToken()) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const res = await authApi.listSessions();
      setSessions(res.items || []);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed loading active sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setServerUrl(getCachedDesktopBaseUrl());
    void loadServerConfig();
    void loadSessions();
    void getWindowsAutostartEnabled().then(setAutostartEnabled);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveDesktopApiBaseUrl(serverUrl);
    if (!res.ok) {
      setServerStatus('error');
      setServerMessage(res.error);
      return;
    }
    setServerUrl(res.normalized);
    await loadServerConfig();
    showToast({
      variant: 'success',
      title: 'Desktop Server Endpoint Updated',
      description: res.normalized || 'Cleared custom server endpoint.',
    });
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    try {
      await authApi.revokeSession(sessionId);
      if (isCurrent) {
        await logoutSession();
        onClose();
        return;
      }
      await loadSessions();
      showToast({
        variant: 'info',
        title: 'Session Revoked',
        description: `Session ${sessionId.slice(0, 8)} terminated.`,
      });
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const res = await authApi.revokeAllSessions(true);
      await loadSessions();
      showToast({
        variant: 'info',
        title: 'Other Sessions Revoked',
        description: `Signed out ${res.revoked_count} other session(s).`,
      });
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed to revoke other sessions');
    }
  };

  const handleToggleAutostart = async () => {
    setAutostartBusy(true);
    try {
      const next = await setWindowsAutostartEnabled(!autostartEnabled);
      setAutostartEnabled(next);
      showToast({
        variant: 'info',
        title: 'Windows Startup Preference Updated',
        description: next ? 'SCRIBBLE-IT will launch on Windows sign-in.' : 'Windows auto-launch disabled.',
      });
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Autostart Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update Windows startup key.',
      });
    } finally {
      setAutostartBusy(false);
    }
  };

  const handleTestNotification = async () => {
    const res = await sendWindowsNotification(
      'SCRIBBLE-IT Windows Desktop',
      'Native Windows incident & SLA alerts are active.',
    );
    showToast({
      variant: res.sent ? 'success' : 'error',
      title: res.sent ? 'Windows Notification Sent' : 'Notification Unavailable',
      description: res.sent ? 'Check Windows Action Center.' : (res.reason || 'Permission blocked.'),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SCRIBBLE-IT Windows Desktop Controls"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-neutral-800 bg-neutral-950 text-neutral-100 rounded-lg shadow-2xl font-sans text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-neutral-100">
                {PROJECT_IDENTITY.productName} for Windows — Desktop Settings &amp; Security
              </h2>
              <p className="text-[11px] text-neutral-400">
                v{runtimeInfo?.app_version || '1.0.0'} · {runtimeInfo?.device_name || 'Windows Host'} · {runtimeInfo?.credential_backend || 'Windows Credential Manager'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Windows Desktop Controls"
            className="p-1.5 text-neutral-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* 1. Server Endpoint Configuration */}
          <section className="border border-neutral-800 bg-neutral-900/30 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-neutral-100">
                <Server className="w-4 h-4 text-sky-400" />
                <span>FastAPI Server Connection (Cloud or Self-Hosted)</span>
              </div>
              {serverStatus === 'connected' && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              )}
            </div>

            <form onSubmit={handleSaveServerUrl} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://api.your-company.com or http://localhost:8000"
                className="flex-1 bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 rounded-sm focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-sm whitespace-nowrap"
              >
                Save &amp; Verify
              </button>
            </form>

            {serverMessage && (
              <div
                className={`text-[11px] p-2.5 border rounded-sm ${
                  serverStatus === 'error'
                    ? 'border-rose-800 bg-rose-950/30 text-rose-300'
                    : serverStatus === 'connected'
                    ? 'border-emerald-800/70 bg-emerald-950/20 text-emerald-300'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                }`}
              >
                {serverMessage}
              </div>
            )}

            {serverConfig && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 border border-neutral-800 bg-neutral-950">
                  <div className="text-neutral-500">Mode</div>
                  <div className="font-semibold text-neutral-200">{serverConfig.deployment_mode}</div>
                </div>
                <div className="p-2 border border-neutral-800 bg-neutral-950">
                  <div className="text-neutral-500">API Version</div>
                  <div className="font-semibold text-neutral-200">{serverConfig.api_version}</div>
                </div>
                <div className="p-2 border border-neutral-800 bg-neutral-950">
                  <div className="text-neutral-500">Min Desktop</div>
                  <div className="font-semibold text-neutral-200">{serverConfig.minimum_client_versions.desktop}</div>
                </div>
                <div className="p-2 border border-neutral-800 bg-neutral-950">
                  <div className="text-neutral-500">Token Rotation</div>
                  <div className="font-semibold text-emerald-400">
                    {serverConfig.auth.refresh_token_rotation ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 2. Windows Security & Device Posture */}
          <section className="border border-neutral-800 bg-neutral-900/30 rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-neutral-100">
              {isManagedDeviceVerified ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              )}
              <span>Windows Security &amp; Device Trust Posture</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 border border-neutral-800 bg-neutral-950">
                <div className="text-neutral-500">Token Storage</div>
                <div className="font-semibold text-emerald-300 mt-0.5">
                  {runtimeInfo?.credential_backend || 'Windows Credential Manager (DPAPI)'}
                </div>
              </div>
              <div className="p-2.5 border border-neutral-800 bg-neutral-950">
                <div className="text-neutral-500">Managed Device Trust</div>
                <div className={`font-semibold mt-0.5 ${isManagedDeviceVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isManagedDeviceVerified
                    ? `IAM Enrolled (${managedDevice?.hostname || 'Verified'})`
                    : 'Local Host Profile Only (Unverified / Not MDM Attested)'}
                </div>
              </div>
              <div className="p-2.5 border border-neutral-800 bg-neutral-950 sm:col-span-2">
                <div className="text-neutral-500">Host Hardware Fingerprint (Non-MDM Client Identifier)</div>
                <div className="font-mono text-[10px] text-neutral-300 break-all mt-0.5">
                  {runtimeInfo?.device_fingerprint || 'Generated natively on Windows host'}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Windows OS Integration Controls */}
          <section className="border border-neutral-800 bg-neutral-900/30 rounded-md p-4 space-y-3">
            <div className="font-bold text-neutral-100">Windows OS Integrations</div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-3.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 font-semibold flex items-center gap-2 rounded-sm"
              >
                <Bell className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Test Windows Notification</span>
              </button>

              <button
                type="button"
                disabled={autostartBusy}
                onClick={handleToggleAutostart}
                className={`px-3.5 py-2 border font-semibold flex items-center gap-2 rounded-sm ${
                  autostartEnabled
                    ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {autostartEnabled ? 'Launch on Windows Sign-In: ON' : 'Launch on Windows Sign-In: OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openDesktopExternalUrl(`${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/windows-security.md`)}
                className="px-3.5 py-2 border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 font-semibold flex items-center gap-2 rounded-sm"
              >
                <Globe className="w-3.5 h-3.5 text-neutral-400" />
                <span>Windows Security Docs</span>
              </button>
            </div>
          </section>

          {/* 4. Backend Active Sessions & Revocation */}
          <section className="border border-neutral-800 bg-neutral-900/30 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-neutral-100">Active Authenticated Sessions</div>
              <div className="flex items-center gap-2">
                {hasBackendToken && sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    className="px-2.5 py-1 border border-rose-800 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 font-semibold flex items-center gap-1 rounded-sm"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Revoke Others</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadSessions()}
                  disabled={sessionsLoading || !hasBackendToken}
                  className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1 rounded-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {sessionsError && (
              <div className="p-2 border border-rose-800 bg-rose-950/30 text-rose-300 text-[11px]">
                {sessionsError}
              </div>
            )}

            {!hasBackendToken ? (
              <p className="text-[11px] text-neutral-400">
                Sign in against a configured FastAPI backend server to inspect and revoke live token sessions.
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-[11px] text-neutral-400">
                {sessionsLoading ? 'Loading backend sessions...' : 'No active sessions returned.'}
              </p>
            ) : (
              <div className="divide-y divide-neutral-800 border border-neutral-800 bg-neutral-950">
                {sessions.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-100 flex items-center gap-2">
                        <span>
                          {s.client_type.toUpperCase()} ({s.client_platform})
                        </span>
                        {s.device_name && <span className="text-neutral-400">· {s.device_name}</span>}
                        {s.is_current && (
                          <span className="text-[10px] text-emerald-400 font-mono">CURRENT</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                        Portal: {s.portal_type} · App {s.app_version || 'n/a'} · IP {s.ip_address || 'n/a'}
                      </div>
                    </div>
                    {!s.revoked_at && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeSession(s.id, s.is_current)}
                        className="px-2.5 py-1.5 border border-rose-800/80 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 font-semibold flex items-center gap-1 shrink-0 rounded-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{s.is_current ? 'Sign Out' : 'Revoke'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
