import React from 'react';
import { useITSM } from '../../context/ITSMContext';

export const SubNav: React.FC = () => {
  const { activeTab, setActiveTab, role, incidents, changes, inventory, calls } = useITSM();

  if (role === 'customer') return null;

  const openIncidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
  const pendingChanges = changes.filter(c => c.status === 'cab_review').length;
  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold).length;
  const activeCalls = calls.filter(c => c.status === 'active' || c.status === 'ringing').length;

  const tabs = [
    { id: 'dashboard', label: 'Overview', badge: null },
    { id: 'incidents', label: 'Incidents', badge: openIncidents },
    { id: 'requests', label: 'Requests', badge: null },
    { id: 'problems', label: 'Problems', badge: null },
    { id: 'changes', label: 'Changes (CAB)', badge: pendingChanges || null },
    { id: 'assets', label: 'CMDB Assets', badge: null },
    { id: 'inventory', label: 'Inventory', badge: lowStock || null },
    { id: 'telephony', label: 'Telephony CTI', badge: activeCalls || null },
    { id: 'billing', label: 'Billing & PO', badge: null },
    { id: 'database', label: 'Data & Backup', badge: null }
  ];

  return (
    <div className="border-b border-neutral-800 bg-neutral-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-mono tracking-wider transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  isActive
                    ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span className={`text-[10px] tabular-nums font-mono px-1 py-0.2 ${isActive ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
