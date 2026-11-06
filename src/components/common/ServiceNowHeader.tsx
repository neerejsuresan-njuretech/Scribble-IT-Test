import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Search, Menu, Database, Shield, User, LogOut, CheckCircle2 } from 'lucide-react';

interface ServiceNowHeaderProps {
  onToggleNavigator: () => void;
  isNavigatorOpen: boolean;
}

export const ServiceNowHeader: React.FC<ServiceNowHeaderProps> = ({ onToggleNavigator, isNavigatorOpen }) => {
  const {
    role, setRole, setActiveTab, googleUser, googleToken,
    loginWithGoogle, logoutGoogle
  } = useITSM();

  const [globalSearch, setGlobalSearch] = useState('');
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = globalSearch.trim().toUpperCase();
    if (!query) return;

    if (query.startsWith('INC')) {
      setActiveTab('incidents');
    } else if (query.startsWith('REQ') || query.includes('CATALOG')) {
      setActiveTab('requests');
    } else if (query.startsWith('PRB') || query.includes('PROBLEM')) {
      setActiveTab('problems');
    } else if (query.startsWith('CHG') || query.includes('CHANGE')) {
      setActiveTab('changes');
    } else if (query.startsWith('AST') || query.includes('CMDB') || query.includes('ASSET')) {
      setActiveTab('assets');
    } else if (query.includes('FORM')) {
      setActiveTab('google_forms');
    } else if (query.includes('CHAT')) {
      setActiveTab('google_chat');
    } else if (query.includes('SHEET')) {
      setActiveTab('google_sheets');
    } else if (query.includes('DRIVE')) {
      setActiveTab('google_drive');
    } else {
      setActiveTab('incidents');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800 text-neutral-100 font-mono text-xs">
      <div className="max-w-full px-4 h-14 flex items-center justify-between gap-4">
        
        {/* Left: Navigator Toggle & ServiceNow Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleNavigator}
            className={`p-2 border transition-colors ${
              isNavigatorOpen
                ? 'bg-neutral-800 border-neutral-600 text-white'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
            }`}
            title="Toggle ServiceNow Application Navigator (All)"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
          >
            <span className="w-2.5 h-2.5 bg-rose-600 inline-block" />
            <div className="flex flex-col">
              <span className="font-bold tracking-widest text-neutral-100 text-sm">SCRIBBLE IT</span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">NOW PLATFORM ARCHITECTURE</span>
            </div>
          </button>
        </div>

        {/* Center: ServiceNow Global Command & Record Search Bar */}
        <form onSubmit={handleGlobalSearch} className="hidden md:flex flex-1 max-w-xl mx-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Type a record (e.g. INC-2048, CHG-0512) or table (incident, cmdb, forms)..."
            className="w-full bg-neutral-900/90 border border-neutral-800 text-neutral-200 pl-8 pr-4 py-2 text-xs focus:border-neutral-600 focus:outline-none"
          />
        </form>

        {/* Right Controls: Database status, Google Workspace Auth, Role Impersonator */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Cloud Database Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 border border-neutral-800/80 bg-neutral-900/50 text-[11px] text-neutral-400">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>FIRESTORE</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">asia-south1</span>
          </div>

          {/* Google Workspace Account / Sign-In with Google */}
          {googleUser ? (
            <div className="flex items-center gap-2 border border-neutral-800 bg-neutral-900/80 px-2.5 py-1">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <div className="hidden sm:block text-left text-[11px] leading-tight">
                <div className="text-neutral-200 font-bold truncate max-w-[120px]">
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
              className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2 text-xs"
              title="Sign in with Google to enable Google Forms, Chat, Sheets, and Drive APIs"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Connect Google</span>
            </button>
          )}

          {/* ServiceNow Impersonator / Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-colors uppercase tracking-wider text-[11px]"
            >
              Role: <span className="font-bold text-neutral-100">{role}</span>
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-neutral-950 border border-neutral-800 shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] text-neutral-500 uppercase border-b border-neutral-800">
                  Impersonate Profile
                </div>
                {[
                  { id: 'admin', label: 'System Administrator' },
                  { id: 'technician', label: 'ITIL L2/L3 Technician' },
                  { id: 'customer', label: 'End-User Self Service' }
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRole(r.id as any);
                      setShowRoleMenu(false);
                      if (r.id === 'customer') setActiveTab('portal');
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      role === r.id ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
