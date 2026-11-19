import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { GlobalSearchBar } from './GlobalSearchBar';
import { AiCopilotDrawer } from './AiCopilotDrawer';
import {
  Menu,
  User,
  LogOut,
  Building2,
  ChevronDown,
  SlidersHorizontal,
  Sun,
  Moon,
  Sparkles,
  Search,
  X,
  Lock,
  ShieldCheck,
} from 'lucide-react';

interface ServiceNowHeaderProps {
  onToggleNavigator: () => void;
  isNavigatorOpen: boolean;
}

export const ServiceNowHeader: React.FC<ServiceNowHeaderProps> = ({
  onToggleNavigator,
  isNavigatorOpen,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    role,
    authSession,
    isSuperAdmin,
    isIamPortal,
    isManagedDeviceVerified,
    logoutSession,
    googleUser,
    loginWithGoogle,
    logoutGoogle,
    tenants,
    activeTenant,
    switchTenant,
    getPortalBranding,
    theme,
    toggleTheme,
    cloudSyncStatus,
  } = useITSM();

  const canSwitchTenants = isSuperAdmin || isIamPortal;

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const activePortalKey =
    location.pathname.startsWith('/iam') || authSession?.portalType === 'iam'
      ? 'iam'
      : role === 'customer'
      ? 'enduser'
      : 'employees';
  const brand = getPortalBranding(activePortalKey);

  return (
    <>
      {(showTenantMenu || showRoleMenu) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowTenantMenu(false);
            setShowRoleMenu(false);
          }}
          aria-hidden="true"
        />
      )}

      <header className="sticky top-0 z-40 h-14 bg-neutral-950 border-b border-neutral-800 px-2 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-3 font-sans text-xs select-none">
        {/* Left: Navigator Toggle + Brand + Tenant Switcher (md+) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {role !== 'customer' && (
            <button
              type="button"
              onClick={onToggleNavigator}
              className={`min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-[34px] p-1.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                isNavigatorOpen
                  ? 'border-neutral-700 bg-neutral-900 text-neutral-100'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
              }`}
              title="Toggle Application Navigator"
              aria-label="Toggle Application Navigator"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Link
              to={
                role === 'customer'
                  ? '/portal'
                  : authSession?.portalType === 'iam'
                  ? '/iam'
                  : '/watchtower'
              }
              className="flex items-center gap-2 hover:opacity-85 transition-opacity text-left whitespace-nowrap min-w-0"
            >
              {brand.logoDataUrl ? (
                <img
                  src={brand.logoDataUrl}
                  alt={brand.portalName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                />
              ) : (
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block shrink-0" />
              )}
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold tracking-tight text-neutral-100 text-xs sm:text-sm max-w-[100px] sm:max-w-[155px] truncate">
                  {brand.portalName}
                </span>
                <span className="hidden sm:block text-[10px] text-neutral-500 font-medium uppercase tracking-wider max-w-[155px] truncate">
                  {brand.subtitle}
                </span>
              </div>
            </Link>

            {/* Multi-Tenant Context Switcher (Super Admin & IAM Governance) or Locked Organization Indicator */}
            <div className="relative hidden md:block ml-1">
              {canSwitchTenants ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTenantMenu(!showTenantMenu);
                      setShowRoleMenu(false);
                    }}
                    className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/90 hover:border-neutral-600 text-neutral-200 flex items-center gap-1.5 text-[11px] whitespace-nowrap transition-colors"
                    title="Switch active isolated tenant workspace"
                  >
                    {activeTenant.companyLogoDataUrl || activeTenant.portalBranding?.employees?.logoDataUrl ? (
                      <img
                        src={activeTenant.companyLogoDataUrl || activeTenant.portalBranding?.employees?.logoDataUrl}
                        alt={activeTenant.name}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 object-contain shrink-0"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className="font-bold max-w-[110px] lg:max-w-[140px] truncate">
                      {activeTenant.name}
                    </span>
                    <span className="text-neutral-500 hidden 2xl:inline">· {activeTenant.region}</span>
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
                          const tenantLogo =
                            t.companyLogoDataUrl ||
                            t.portalBranding?.employees?.logoDataUrl ||
                            t.portalBranding?.enduser?.logoDataUrl;
                          return (
                            <button
                              key={t.id}
                              type="button"
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
                              <div className="flex items-center gap-2 min-w-0">
                                {tenantLogo ? (
                                  <img
                                    src={tenantLogo}
                                    alt={t.name}
                                    referrerPolicy="no-referrer"
                                    className="w-5 h-5 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <Building2 className="w-4 h-4 text-neutral-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="truncate">{t.name}</div>
                                  <div className="text-[10px] text-neutral-500 font-normal truncate">
                                    {t.domain} · {t.plan} · {t.region}
                                  </div>
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="text-[10px] text-rose-400 shrink-0">ACTIVE</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {isSuperAdmin && (
                        <div className="border-t border-neutral-800 p-1.5 flex items-center gap-1">
                          <Link
                            to="/tenants"
                            onClick={() => setShowTenantMenu(false)}
                            className="flex-1 text-center py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-200 uppercase font-bold"
                          >
                            Manage Companies
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
                </>
              ) : (
                <div
                  className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900/60 text-neutral-300 flex items-center gap-1.5 text-[11px] whitespace-nowrap"
                  title="Corporate tenant isolation active — locked to your assigned company"
                >
                  {activeTenant.companyLogoDataUrl || activeTenant.portalBranding?.employees?.logoDataUrl ? (
                    <img
                      src={activeTenant.companyLogoDataUrl || activeTenant.portalBranding?.employees?.logoDataUrl}
                      alt={activeTenant.name}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 object-contain shrink-0"
                    />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  )}
                  <span className="font-bold max-w-[110px] lg:max-w-[140px] truncate">
                    {activeTenant.name}
                  </span>
                  <Lock className="w-3 h-3 text-neutral-500 shrink-0" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Access-Controlled Global Search Bar (md+) */}
        <GlobalSearchBar variant="inline" />

        {/* Right Controls: Mobile/Tablet Search Trigger, AI Copilot, Theme Toggle, Google Workspace, Session Menu */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile & Tablet Search Button (< lg) */}
          <button
            type="button"
            onClick={() => {
              setShowMobileSearch(prev => !prev);
              setShowRoleMenu(false);
              setShowTenantMenu(false);
            }}
            aria-label="Search records"
            title="Search incidents, assets, and tickets"
            className={`lg:hidden min-h-[40px] min-w-[40px] p-1.5 border flex items-center justify-center transition-colors ${
              showMobileSearch
                ? 'border-sky-700 bg-sky-950/40 text-sky-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white'
            }`}
          >
            {showMobileSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {role !== 'customer' && (
            <button
              type="button"
              onClick={() => setShowCopilot(true)}
              aria-label="Open AI Operations Copilot"
              title="Open AI Operations Copilot"
              className="min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-0 px-2 sm:px-2.5 py-1.5 border border-sky-700/80 bg-sky-950/40 text-sky-300 hover:bg-sky-900/60 transition-colors flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">AI COPILOT</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dot-matrix dark mode'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dot-Matrix Dark Mode'}
            className="min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-0 px-2 sm:px-2.5 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden xl:inline">LIGHT</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="hidden xl:inline">DARK</span>
              </>
            )}
          </button>

          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 border border-neutral-800 bg-neutral-900/50 text-[10px] text-neutral-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" />
            <span>TENANT: {activeTenant.slug.toUpperCase()}</span>
          </div>

          {/* Google Workspace Auth (hidden < lg, available in Session Menu on phones & tablets) */}
          <div className="hidden lg:flex items-center">
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
                <Link
                  to={isSuperAdmin ? '/database' : isIamPortal ? '/iam' : '/watchtower'}
                  className="hidden xl:block text-left text-[11px] leading-tight hover:opacity-85"
                  title="View centralized cloud database sync status"
                >
                  <div className="text-neutral-200 font-bold truncate max-w-[115px]">
                    {googleUser.displayName || googleUser.email}
                  </div>
                  <div
                    className={`text-[10px] ${
                      cloudSyncStatus === 'error'
                        ? 'text-rose-400'
                        : cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {cloudSyncStatus === 'syncing'
                      ? 'Cloud Syncing...'
                      : cloudSyncStatus === 'connecting'
                      ? 'Connecting DB...'
                      : cloudSyncStatus === 'error'
                      ? 'Sync Attention'
                      : 'Cloud DB Synced'}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={logoutGoogle}
                  className="text-neutral-500 hover:text-neutral-200 ml-1"
                  title="Disconnect Google Cloud Sync"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="px-2.5 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2 text-xs whitespace-nowrap"
                title="Sign in with Google to enable Google Forms, Chat, Sheets, and Drive APIs"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="hidden xl:inline">Connect Google</span>
              </button>
            )}
          </div>

          {/* Authenticated Portal Session Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowRoleMenu(!showRoleMenu);
                setShowTenantMenu(false);
              }}
              className="min-h-[40px] md:min-h-0 px-2.5 sm:px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-colors uppercase tracking-wider text-[11px] whitespace-nowrap flex items-center gap-1.5 sm:gap-2"
              aria-label="Account and portal menu"
            >
              <span
                className={`w-1.5 h-1.5 inline-block shrink-0 ${
                  authSession?.portalType === 'super_admin'
                    ? 'bg-rose-500'
                    : authSession?.portalType === 'iam'
                    ? 'bg-amber-400'
                    : authSession?.portalType === 'employee'
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="hidden sm:inline font-bold text-neutral-100">
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
              <User className="w-3.5 h-3.5 sm:hidden text-neutral-200" />
              <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-72 max-w-[calc(100vw-1.5rem)] bg-neutral-950 border border-neutral-800 shadow-2xl py-1 z-50">
                <div className="px-3 py-2.5 border-b border-neutral-800 space-y-1">
                  <div className="text-neutral-100 font-bold truncate">
                    {authSession?.name || 'Authenticated User'}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">{authSession?.email}</div>
                  <div className="text-[10px] text-neutral-400 uppercase flex items-center justify-between gap-2 pt-0.5">
                    <span className="truncate">
                      {authSession?.companyId ? `${authSession.companyId} · ` : ''}
                      {authSession?.authMethod?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="pt-1 flex items-center justify-between gap-2 text-[10px] border-t border-neutral-900">
                    <span className="text-neutral-500 uppercase">Device Trust</span>
                    <span className={`font-bold flex items-center gap-1 ${isManagedDeviceVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isManagedDeviceVerified ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{isManagedDeviceVerified ? 'IAM MDM VERIFIED' : 'UNMANAGED'}</span>
                    </span>
                  </div>
                </div>

                {/* Mobile-accessible Tenant Switcher (Locked for Employees/End-Users) */}
                <div className="md:hidden px-3 py-2 border-b border-neutral-800 space-y-1.5">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center justify-between">
                    <span>Organization</span>
                    {!canSwitchTenants && <span className="text-neutral-500 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                  </div>
                  {canSwitchTenants ? (
                    <select
                      value={activeTenant.id}
                      onChange={e => {
                        switchTenant(e.target.value);
                        setShowRoleMenu(false);
                      }}
                      className="w-full min-h-[40px] bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-1 text-xs"
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.region})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-2.5 py-2 bg-neutral-900/60 border border-neutral-800 text-neutral-200 font-bold text-xs truncate">
                      {activeTenant.name} ({activeTenant.companyCode})
                    </div>
                  )}
                </div>

                {/* Mobile & Tablet-accessible Google Connect */}
                <div className="lg:hidden px-3 py-2 border-b border-neutral-800">
                  {googleUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        logoutGoogle();
                        setShowRoleMenu(false);
                      }}
                      className="w-full min-h-[36px] text-left text-xs text-emerald-400 flex items-center justify-between"
                    >
                      <span className="truncate">Google: {googleUser.displayName || googleUser.email}</span>
                      <span className="text-neutral-500 text-[10px] ml-2">Disconnect</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleMenu(false);
                        loginWithGoogle();
                      }}
                      className="w-full min-h-[36px] text-left text-xs text-neutral-200 hover:text-white flex items-center gap-2"
                    >
                      <span>Connect Google Workspace</span>
                    </button>
                  )}
                </div>

                <div className="px-3 py-1 text-[10px] text-neutral-500 uppercase border-b border-neutral-900">
                  Switch Login Portal
                </div>
                <Link
                  to="/login/admin"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  Super Admin Login
                </Link>
                <Link
                  to="/login/employee"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  Employee / Company SSO
                </Link>
                <Link
                  to="/login/iam"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  IAM Portal Login
                </Link>
                <Link
                  to="/login/portal"
                  onClick={() => setShowRoleMenu(false)}
                  className="block px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-white"
                >
                  End-User Self-Service Login
                </Link>
                <div className="border-t border-neutral-800 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setShowRoleMenu(false);
                      await logoutSession();
                      navigate('/login');
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs text-rose-400 hover:bg-rose-950/40 font-bold flex items-center gap-2"
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

      {/* Mobile & Tablet Full-Width Search Overlay (< lg) */}
      {showMobileSearch && (
        <div className="lg:hidden sticky top-14 z-30 bg-neutral-950 border-b border-neutral-800 px-3 py-2.5 shadow-xl">
          <GlobalSearchBar
            variant="mobile-overlay"
            onResultSelected={() => setShowMobileSearch(false)}
          />
        </div>
      )}

      <AiCopilotDrawer isOpen={showCopilot} onClose={() => setShowCopilot(false)} />
    </>
  );
};
