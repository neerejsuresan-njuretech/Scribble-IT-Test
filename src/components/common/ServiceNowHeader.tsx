import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { GlobalSearchBar } from './GlobalSearchBar';
import { Menu, User, LogOut, Building2, ChevronDown, SlidersHorizontal } from 'lucide-react';

interface ServiceNowHeaderProps {
  onToggleNavigator: () => void;
  isNavigatorOpen: boolean;
}

export const ServiceNowHeader: React.FC<ServiceNowHeaderProps> = ({ onToggleNavigator, isNavigatorOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    role, authSession, logoutSession, googleUser,
    loginWithGoogle, logoutGoogle,
    tenants, activeTenant, switchTenant, getPortalBranding
  } = useITSM();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);

  const activePortalKey =
    location.pathname.startsWith('/iam') || authSession?.portalType === 'iam'
      ? 'iam'
      : role === 'customer'
      ? 'enduser'
      : 'employees';
  const brand = getPortalBranding(activePortalKey);

  return (
    <header className="sticky top-0 z-40 h-14 bg-neutral-950 border-b border-neutral-800 px-4 flex items-center justify-between gap-4 font-mono text-xs select-none">
      {/* Left: Navigator Toggle + Brand + Tenant Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        {role !== 'customer' && (
          <button
            onClick={onToggleNavigator}
            className={`p-1.5 border transition-colors ${
              isNavigatorOpen
                ? 'border-neutral-700 bg-neutral-900 text-neutral-100'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
            }`}
            title="Toggle Application Navigator"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to={role === 'customer' ? '/portal' : authSession?.portalType === 'iam' ? '/iam' : '/watchtower'}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left whitespace-nowrap"
          >
            {brand.logoDataUrl ? (
              <img
                src={brand.logoDataUrl}
                alt={brand.portalName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
              />
            ) : (
              <span className="w-2.5 h-2.5 bg-rose-600 inline-block shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-bold tracking-widest text-neutral-100 text-sm max-w-[180px] truncate">
                {brand.portalName}
              </span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider max-w-[180px] truncate">
                {brand.subtitle}
              </span>
            </div>
          </Link>

          {/* Live Multi-Tenant Context Switcher */}
          <div className="relative ml-2">
            <button
              onClick={() => {
                setShowTenantMenu(!showTenantMenu);
                setShowRoleMenu(false);
              }}
              className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/90 hover:border-neutral-600 text-neutral-200 flex items-center gap-2 text-[11px] whitespace-nowrap transition-colors"
              title="Switch active isolated tenant workspace"
            >
              <Building2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-bold max-w-[140px] truncate">{activeTenant.name}</span>
              <span className="text-neutral-500 hidden xl:inline">· {activeTenant.region}</span>
              <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
            </button>

            {showTenantMenu && (
              <div className="absolute left-0 mt-1 w-72 bg-neutral-950 border border-neutral-800 shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] text-neutral-500 uppercase border-b border-neutral-800 flex items-center justify-between">
                  <span>Active Tenant Isolation</span>
                  <span>{tenants.length} Orgs</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-neutral-900">
                  {tenants.map(t => {
                    const isCurrent = t.id === activeTenant.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          switchTenant(t.id);
                          setShowTenantMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-neutral-800 text-white font-bold'
                            : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{t.name}</div>
                          <div className="text-[10px] text-neutral-500 font-normal truncate">
                            {t.domain} · {t.plan} · {t.region}
                          </div>
                        </div>
                        {isCurrent && <span className="text-[10px] text-rose-400 shrink-0">ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>
                {role === 'admin' && (
                  <div className="border-t border-neutral-800 p-1.5 flex items-center gap-1">
                    <Link
                      to="/tenants"
                      onClick={() => setShowTenantMenu(false)}
                      className="flex-1 text-center py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-200 uppercase font-bold"
                    >
                      Manage Tenants
                    </Link>
                    <Link
                      to="/system/modules"
                      onClick={() => setShowTenantMenu(false)}
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-300 flex items-center gap-1"
                      title="Module Availability Controls"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Modules</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Access-Controlled Global Search Bar */}
      <GlobalSearchBar />

        {/* Right Controls: Database indicator, Google Workspace Auth, Role Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 border border-neutral-800 bg-neutral-900/50 text-[10px] text-neutral-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" />
            <span>TENANT: {activeTenant.slug.toUpperCase()}</span>
          </div>

          {googleUser ? (
            <div className="flex items-center gap-2 border border-neutral-800 bg-neutral-900/80 px-2.5 py-1">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-5 h-5 object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <div className="hidden sm:block text-left text-[11px] leading-tight">
                <div className="text-neutral-200 font-bold truncate max-w-[110px]">
                  {googleUser.displayName || googleUser.email}
                </div>
                <div className="text-[10px] text-emerald-400">Workspace Active</div>
              </div>
              <button
                onClick={logoutGoogle}
                className="text-neutral-500 hover:text-neutral-200 ml-1"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2 text-xs whitespace-nowrap"
              title="Sign in with Google to enable Google Forms, Chat, Sheets, and Drive APIs"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span className="hidden sm:inline">Connect Google</span>
            </button>
          )}

          {/* Authenticated Portal Session Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleMenu(!showRoleMenu);
                setShowTenantMenu(false);
              }}
              className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-colors uppercase tracking-wider text-[11px] whitespace-nowrap flex items-center gap-2"
            >
              <span className={`w-1.5 h-1.5 inline-block ${
                authSession?.portalType === 'super_admin'
                  ? 'bg-rose-500'
                  : authSession?.portalType === 'iam'
                  ? 'bg-amber-400'
                  : authSession?.portalType === 'employee'
                  ? 'bg-sky-400'
                  : 'bg-emerald-400'
              }`} />
              <span className="font-bold text-neutral-100">
                {authSession?.portalType === 'super_admin'
                  ? 'SUPER ADMIN'
                  : authSession?.portalType === 'iam'
                  ? 'IAM PORTAL'
                  : authSession?.authMethod === 'employee_sso'
                  ? 'EMPLOYEE (SSO)'
                  : authSession?.portalType === 'employee'
                  ? 'EMPLOYEE'
                  : 'SELF-SERVICE'}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-500" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-neutral-950 border border-neutral-800 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <div className="text-neutral-100 font-bold truncate">{authSession?.name || 'Authenticated User'}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{authSession?.email}</div>
                  <div className="text-[10px] text-neutral-400 uppercase mt-0.5">
                    {authSession?.companyId ? `${authSession.companyId} · ` : ''}
                    {authSession?.authMethod?.replace('_', ' ')}
                  </div>
                </div>
                <div className="px-3 py-1 text-[10px] text-neutral-500 uppercase border-b border-neutral-900">
                  Switch Login Portal
                </div>
                <Link
                  to="/login/admin"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  Super Admin Login
                </Link>
                <Link
                  to="/login/employee"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  Employee / Company SSO
                </Link>
                <Link
                  to="/login/iam"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  IAM Portal Login
                </Link>
                <Link
                  to="/login/portal"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  End-User Self-Service Login
                </Link>
                <div className="border-t border-neutral-800 mt-1 pt-1">
                  <button
                    onClick={async () => {
                      setShowRoleMenu(false);
                      await logoutSession();
                      navigate('/login');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 font-bold flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </header>
  );
};

