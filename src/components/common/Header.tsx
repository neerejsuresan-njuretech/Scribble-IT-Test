import React from 'react';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText } from './DotMatrixDisplay';

interface HeaderProps {
  onOpenNewModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewModal }) => {
  const { role, setRole, activeTab, setActiveTab, activeCall } = useITSM();

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
        
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setActiveTab(role === 'customer' ? 'portal' : 'dashboard')}
          className="text-base font-bold tracking-widest text-neutral-100 font-mono whitespace-nowrap shrink-0 flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
        >
          <span className="w-2 h-2 bg-rose-600 inline-block" />
          <span>SCRIBBLE IT</span>
        </button>

        {/* Zone 2: 4–5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono tracking-wider uppercase text-neutral-400">
          {role === 'customer' ? (
            <>
              <button
                onClick={() => setActiveTab('portal')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'portal' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Catalog & Requests
              </button>
              <button
                onClick={() => setActiveTab('incidents')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'incidents' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                My Tickets
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'assets' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                My Devices
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'billing' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Invoices
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('incidents')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'incidents' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Incidents
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'requests' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Requests
              </button>
              <button
                onClick={() => setActiveTab('changes')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'changes' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                Changes
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'assets' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                CMDB Assets
              </button>
              <button
                onClick={() => setActiveTab('telephony')}
                className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${activeTab === 'telephony' ? 'text-white border-b border-rose-500 pb-0.5' : 'hover:text-neutral-200'}`}
              >
                <span>Telephony</span>
                {activeCall && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (role === 'admin') {
                setRole('customer');
                setActiveTab('portal');
              } else {
                setRole('admin');
                setActiveTab('dashboard');
              }
            }}
            className="px-3.5 py-1.5 text-xs font-mono font-medium tracking-wider uppercase border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors whitespace-nowrap shrink-0"
            title="Switch between Customer Portal and Admin ITIL Desk"
          >
            {role === 'admin' ? 'Switch to Customer' : 'Switch to Admin'}
          </button>
        </div>

      </div>
    </header>
  );
};
