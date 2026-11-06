import React, { useState } from 'react';
import { ITSMProvider, useITSM } from './context/ITSMContext';
import { ServiceNowHeader } from './components/common/ServiceNowHeader';
import { ServiceNowNavigator } from './components/common/ServiceNowNavigator';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { IncidentModule } from './components/incidents/IncidentModule';
import { RequestModule } from './components/requests/RequestModule';
import { ProblemModule } from './components/problems/ProblemModule';
import { ChangeModule } from './components/changes/ChangeModule';
import { AssetModule } from './components/assets/AssetModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { TelephonyModule } from './components/telephony/TelephonyModule';
import { BillingModule } from './components/billing/BillingModule';
import { DatabaseModule } from './components/database/DatabaseModule';
import { CustomerPortal } from './components/portal/CustomerPortal';
import { NewItemModal } from './components/modals/NewItemModal';
import { GoogleFormsModule } from './components/workspace/GoogleFormsModule';
import { GoogleChatModule } from './components/workspace/GoogleChatModule';
import { GoogleSheetsModule } from './components/workspace/GoogleSheetsModule';
import { GoogleDriveModule } from './components/workspace/GoogleDriveModule';

function MainApp() {
  const { activeTab, role } = useITSM();
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<'incident' | 'request' | 'change' | 'asset'>('incident');

  const handleOpenCreate = (type: 'incident' | 'request' | 'change' | 'asset' = 'incident') => {
    setModalDefaultType(type);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col dot-matrix-bg selection:bg-rose-600 selection:text-white">
      {/* ServiceNow Top Header Bar */}
      <ServiceNowHeader
        onToggleNavigator={() => setIsNavigatorOpen(!isNavigatorOpen)}
        isNavigatorOpen={isNavigatorOpen}
      />

      {/* Main Workspace Frame with Left Application Navigator */}
      <div className="flex-1 flex overflow-hidden">
        {/* ServiceNow Left Application Navigator (All) */}
        {role !== 'customer' && (
          <ServiceNowNavigator
            isOpen={isNavigatorOpen}
            onCloseMobile={() => {
              if (window.innerWidth < 768) setIsNavigatorOpen(false);
            }}
          />
        )}

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-full">
          <div className="max-w-7xl mx-auto">
            {role === 'customer' || activeTab === 'portal' ? (
              <CustomerPortal onOpenNewTicket={() => handleOpenCreate('incident')} />
            ) : (
              <>
                {activeTab === 'dashboard' && <OverviewDashboard onOpenCreate={handleOpenCreate} />}
                {activeTab === 'incidents' && <IncidentModule onOpenCreate={() => handleOpenCreate('incident')} />}
                {activeTab === 'requests' && <RequestModule onOpenCreate={() => handleOpenCreate('request')} />}
                {activeTab === 'problems' && <ProblemModule onOpenCreate={() => handleOpenCreate('problem' as any)} />}
                {activeTab === 'changes' && <ChangeModule onOpenCreate={() => handleOpenCreate('change')} />}
                {activeTab === 'assets' && <AssetModule onOpenCreate={() => handleOpenCreate('asset')} />}
                {activeTab === 'inventory' && <InventoryModule />}
                {activeTab === 'telephony' && <TelephonyModule />}
                {activeTab === 'billing' && <BillingModule />}
                {activeTab === 'database' && <DatabaseModule />}
                {/* Google Workspace Cloud Integrations */}
                {activeTab === 'google_forms' && <GoogleFormsModule />}
                {activeTab === 'google_chat' && <GoogleChatModule />}
                {activeTab === 'google_sheets' && <GoogleSheetsModule />}
                {activeTab === 'google_drive' && <GoogleDriveModule />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Universal New Record Modal */}
      <NewItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultType={modalDefaultType}
      />

      {/* ServiceNow Platform Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/90 py-3 px-4 z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-bold">SCRIBBLE IT // NOW PLATFORM</span>
            <span aria-hidden="true">·</span>
            <span>NJURE TECH</span>
            <span aria-hidden="true">·</span>
            <span>GCP PROJECT: gen-lang-client-0108198368</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span className="text-emerald-400">● FIRESTORE (asia-south1)</span>
            <span>GOOGLE WORKSPACE LIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ITSMProvider>
      <MainApp />
    </ITSMProvider>
  );
}
