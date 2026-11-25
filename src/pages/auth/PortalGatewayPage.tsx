import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText } from '../../components/common/DotMatrixDisplay';
import { PROJECT_IDENTITY } from '../../config/openSourceConfig';
import njureTechLogo from '../../assets/images/njure_tech_logo.png';
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

  const portals = [
    {
      id: 'end_user' as const,
      loginPath: '/login/portal',
      demoPath: '/portal',
      title: 'End-User Self-Service Portal',
      subtitle: 'Service Catalog, Knowledge Base & Incident Reporting',
      ctaLabel: 'Sign In',
      icon: UserCheck,
      iconBox: 'border-emerald-700/60 bg-emerald-950/40',
      iconColor: 'text-emerald-400',
      testBtn: 'border-emerald-700/70 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300',
      ctaColor: 'text-emerald-400',
      badge: null as string | null,
    },
    {
      id: 'employee' as const,
      loginPath: '/login/employee',
      demoPath: '/watchtower',
      title: 'Employee & Operations Workspace',
      subtitle: 'Corporate Credentials or Managed Device Single Sign-On',
      ctaLabel: 'Login / SSO',
      icon: Laptop,
      iconBox: 'border-sky-700/60 bg-sky-950/40',
      iconColor: 'text-sky-400',
      testBtn: 'border-sky-700/70 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300',
      ctaColor: 'text-sky-400',
      badge: managedDevice ? `SSO Ready (${managedDevice.hostname})` : null,
    },
    {
      id: 'iam' as const,
      loginPath: '/login/iam',
      demoPath: '/iam',
      title: 'Identity & Access Management (IAM)',
      subtitle: 'Directory Identities, Company IDs, Roles & Access Policies',
      ctaLabel: 'IAM Login',
      icon: Shield,
      iconBox: 'border-amber-700/60 bg-amber-950/40',
      iconColor: 'text-amber-400',
      testBtn: 'border-amber-700/70 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300',
      ctaColor: 'text-amber-400',
      badge: null as string | null,
    },
    {
      id: 'super_admin' as const,
      loginPath: '/login/admin',
      demoPath: '/watchtower',
      title: 'Super Administrator Console',
      subtitle: 'Multi-Tenant Governance, Portal Branding & Module Controls',
      ctaLabel: 'Admin Login',
      icon: ShieldAlert,
      iconBox: 'border-rose-700/60 bg-rose-950/40',
      iconColor: 'text-rose-500',
      testBtn: 'border-rose-700/70 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300',
      ctaColor: 'text-rose-500',
      badge: null as string | null,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-sans text-xs flex flex-col justify-between p-4 sm:p-6 overflow-x-clip">
      <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 text-[11px] font-medium text-neutral-400 min-w-0">
          <a
            href={PROJECT_IDENTITY.njureTechWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-white px-2 py-1 rounded border border-neutral-200 hover:opacity-95 transition-opacity shrink-0"
            aria-label="Njure Tech — A Njure Group Company"
          >
            <img
              src={njureTechLogo}
              alt="Njure Tech — A Njure Group Company Logo"
              width={456}
              height={174}
              className="h-6 w-auto object-contain"
            />
          </a>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline truncate">Enterprise ITSM Platform</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/welcome"
            className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors text-[11px] font-medium inline-flex items-center whitespace-nowrap"
          >
            ← Overview
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dot-matrix dark mode'}
            className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden xs:inline sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="hidden xs:inline sm:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto my-auto space-y-5 sm:space-y-6 py-6 sm:py-8">
        {/* Corporate Brand Header with Fluid Inverted Dot-Matrix Wordmark */}
        <div className="text-center space-y-2.5 sm:space-y-3 px-2">
          <div className="flex justify-center max-w-full">
            <DotMatrixText text="SCRIBBLE IT" size="lg" glow={theme === 'dark'} />
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed">
            Unified Multi-Tenant IT Service Management, Identity Governance &amp; Operations Suite
          </p>
        </div>

        {/* Cross-Device Cloud Database Sign-In Bar */}
        <div className="border border-sky-800/70 bg-sky-950/25 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md border border-sky-700/70 bg-sky-950/60 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-100">
                Centralized Cloud Database · Sync Across Devices
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                Sign in with Google to persist all incidents, requests, multi-company logos, workflows &amp; settings in Firestore across every device.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleCloudSignIn}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-md bg-neutral-100 hover:bg-white disabled:opacity-60 text-neutral-950 font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
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

        {/* Responsive Corporate Portal Access Matrix (1-col phones, 2x2 grid tablets & desktops) */}
        <div className="border border-neutral-800 bg-neutral-950/95 rounded-lg overflow-hidden shadow-xl">
          <div className="px-4 sm:px-5 py-3 bg-neutral-900/60 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            <span>Select Authentication Portal</span>
            <span className="font-mono text-[10px]">SSO &amp; RBAC ENABLED</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-neutral-800">
            {portals.map(portal => {
              const Icon = portal.icon;
              return (
                <div
                  key={portal.id}
                  className="bg-neutral-950 p-4 sm:p-5 flex flex-col justify-between gap-4 hover:bg-neutral-900/40 transition-colors"
                >
                  <Link to={portal.loginPath} className="group flex items-start gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${portal.iconBox}`}>
                      <Icon className={`w-4 h-4 ${portal.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-100 group-hover:text-white flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{portal.title}</span>
                        {portal.badge && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>{portal.badge}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        {portal.subtitle}
                      </div>
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        loginAsTestAccount(portal.id);
                        navigate(portal.demoPath);
                      }}
                      className={`min-h-[40px] px-3 py-2 rounded-md border font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${portal.testBtn}`}
                    >
                      <LogIn className="w-3.5 h-3.5 shrink-0" />
                      <span>Test Login</span>
                    </button>
                    <Link
                      to={portal.loginPath}
                      className={`min-h-[40px] px-3 py-2 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors ${portal.ctaColor}`}
                    >
                      <span>{portal.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-4 text-center sm:text-left">
        <span>Powered by Scribble IT · Enterprise Service Management</span>
        <span className="font-medium text-neutral-400">Njure Tech</span>
      </div>
    </div>
  );
};
