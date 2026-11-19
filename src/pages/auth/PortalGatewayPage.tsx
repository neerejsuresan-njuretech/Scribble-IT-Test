import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText } from '../../components/common/DotMatrixDisplay';
import { ShieldAlert, Laptop, UserCheck, Shield, ArrowRight, CheckCircle2, LogIn, Sun, Moon, Cloud, Loader2 } from 'lucide-react';

export const PortalGatewayPage: React.FC = () => {
  const navigate = useNavigate();
  const { managedDevice, loginAsTestAccount, loginWithGooglePortal, theme, toggleTheme } = useITSM();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleCloudSignIn = async () => {
    setGoogleLoading(true);
    const ok = await loginWithGooglePortal();
    setGoogleLoading(false);
    if (ok) {
      navigate('/watchtower');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-sans text-xs flex flex-col justify-between p-6">
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400">
          <span className="w-2 h-2 bg-rose-600 rounded-xs inline-block" />
          <span className="tracking-wide uppercase font-semibold text-neutral-200">Njure Tech</span>
          <span aria-hidden="true">·</span>
          <span>Enterprise ITSM Platform</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/welcome"
            className="px-2.5 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors text-[11px] font-medium whitespace-nowrap"
          >
            ← Overview Website
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dot-matrix dark mode'}
            className="px-2.5 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-[11px] font-medium"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto my-auto space-y-6 py-8">
        {/* Corporate Brand Header with Inverted Dot-Matrix Wordmark */}
        <div className="text-center space-y-3">
          <div className="inline-flex justify-center">
            <DotMatrixText text="SCRIBBLE IT" size="lg" glow={theme === 'dark'} />
          </div>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Unified Multi-Tenant IT Service Management, Identity Governance &amp; Operations Suite
          </p>
        </div>

        {/* Cross-Device Cloud Database Sign-In Bar */}
        <div className="border border-sky-800/70 bg-sky-950/25 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md border border-sky-700/70 bg-sky-950/60 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">
                Centralized Cloud Database · Sync Across Devices
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                Sign in with Google to persist all incidents, requests, multi-company logos, workflows &amp; settings in Firestore across every device.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleCloudSignIn}
            className="px-4 py-2 rounded-md bg-neutral-100 hover:bg-white disabled:opacity-60 text-neutral-950 font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
            )}
            <span>{googleLoading ? 'Connecting...' : 'Sign In with Google'}</span>
          </button>
        </div>

        {/* Corporate Portal Access Matrix */}
        <div className="border border-neutral-800 bg-neutral-950/95 rounded-lg overflow-hidden shadow-xl divide-y divide-neutral-800">
          <div className="px-5 py-3 bg-neutral-900/60 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            <span>Select Authentication Portal</span>
            <span className="font-mono text-[10px]">SSO &amp; RBAC ENABLED</span>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/portal" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <div className="w-9 h-9 rounded-md border border-emerald-700/60 bg-emerald-950/40 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-white">
                  End-User Self-Service Portal
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Service Catalog, Knowledge Base &amp; Incident Reporting
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('end_user');
                  navigate('/portal');
                }}
                className="px-3 py-1.5 rounded-md border border-emerald-700/70 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/portal"
                className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex items-center gap-1.5 text-emerald-400 font-semibold whitespace-nowrap"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/employee" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <div className="w-9 h-9 rounded-md border border-sky-700/60 bg-sky-950/40 flex items-center justify-center shrink-0">
                <Laptop className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-white flex flex-wrap items-center gap-2">
                  <span>Employee &amp; Operations Workspace</span>
                  {managedDevice && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      SSO Ready ({managedDevice.hostname})
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Corporate Credentials or Managed Device Single Sign-On
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('employee');
                  navigate('/watchtower');
                }}
                className="px-3 py-1.5 rounded-md border border-sky-700/70 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/employee"
                className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex items-center gap-1.5 text-sky-400 font-semibold whitespace-nowrap"
              >
                <span>Login / SSO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/iam" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <div className="w-9 h-9 rounded-md border border-amber-700/60 bg-amber-950/40 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-white">
                  Identity &amp; Access Management (IAM)
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Directory Identities, Company IDs, Roles &amp; Access Policies
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('iam');
                  navigate('/iam');
                }}
                className="px-3 py-1.5 rounded-md border border-amber-700/70 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/iam"
                className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex items-center gap-1.5 text-amber-400 font-semibold whitespace-nowrap"
              >
                <span>IAM Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/admin" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <div className="w-9 h-9 rounded-md border border-rose-700/60 bg-rose-950/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-white">
                  Super Administrator Console
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Multi-Tenant Governance, Portal Branding &amp; Module Controls
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('super_admin');
                  navigate('/watchtower');
                }}
                className="px-3 py-1.5 rounded-md border border-rose-700/70 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/admin"
                className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex items-center gap-1.5 text-rose-500 font-semibold whitespace-nowrap"
              >
                <span>Admin Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-4">
        <span>Powered by Scribble IT · Enterprise Service Management</span>
        <span className="font-medium text-neutral-400">Njure Tech</span>
      </div>
    </div>
  );
};
