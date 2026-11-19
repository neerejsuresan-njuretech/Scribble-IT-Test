import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText } from '../../components/common/DotMatrixDisplay';
import { ShieldAlert, Laptop, UserCheck, Shield, ArrowRight, CheckCircle2, LogIn, Sun, Moon } from 'lucide-react';

export const PortalGatewayPage: React.FC = () => {
  const navigate = useNavigate();
  const { managedDevice, loginAsTestAccount, theme, toggleTheme } = useITSM();

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

      <div className="max-w-3xl w-full mx-auto my-auto space-y-8 py-8">
        {/* Corporate Brand Header with Inverted Dot-Matrix Wordmark */}
        <div className="text-center space-y-3">
          <div className="inline-flex justify-center">
            <DotMatrixText text="SCRIBBLE IT" size="lg" glow={theme === 'dark'} />
          </div>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Unified Multi-Tenant IT Service Management, Identity Governance &amp; Operations Suite
          </p>
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
