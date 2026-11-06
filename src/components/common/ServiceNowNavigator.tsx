import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import {
  AlertTriangle, Package, ShieldCheck, Server, RefreshCw,
  Phone, DollarSign, Database, FileText, MessageSquare,
  Sheet, HardDrive, Star, ChevronDown, ChevronRight, Search
} from 'lucide-react';

interface ServiceNowNavigatorProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const ServiceNowNavigator: React.FC<ServiceNowNavigatorProps> = ({ isOpen, onCloseMobile }) => {
  const {
    activeTab, setActiveTab, incidents, changes, inventory,
    calls, role
  } = useITSM();

  const [filterText, setFilterText] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const openIncidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
  const pendingChanges = changes.filter(c => c.status === 'cab_review').length;
  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold).length;

  const navSections = [
    {
      id: 'itsm',
      title: 'IT Service Management',
      items: [
        { id: 'dashboard', label: 'Service Desk Overview', code: 'sys_portal', icon: Server, badge: null },
        { id: 'incidents', label: 'Incidents', code: 'incident.list', icon: AlertTriangle, badge: openIncidents },
        { id: 'requests', label: 'Service Catalog', code: 'sc_request.list', icon: Package, badge: null },
        { id: 'problems', label: 'Problem Management', code: 'problem.list', icon: ShieldCheck, badge: null },
        { id: 'changes', label: 'Change Advisory (CAB)', code: 'change_request.list', icon: ShieldCheck, badge: pendingChanges || null },
        { id: 'assets', label: 'CMDB Configuration Items', code: 'cmdb_ci.list', icon: Server, badge: null },
        { id: 'inventory', label: 'Inventory & Consumables', code: 'alm_consumable.list', icon: RefreshCw, badge: lowStock || null }
      ]
    },
    {
      id: 'workspace',
      title: 'Google Workspace Cloud Suite',
      items: [
        { id: 'google_forms', label: 'Google Forms Intake', code: 'google_forms', icon: FileText, badge: 'API' },
        { id: 'google_chat', label: 'Google Chat War Rooms', code: 'google_chat', icon: MessageSquare, badge: 'API' },
        { id: 'google_sheets', label: 'Google Sheets Live Sync', code: 'google_sheets', icon: Sheet, badge: 'API' },
        { id: 'google_drive', label: 'Google Drive Document Repo', code: 'google_drive', icon: HardDrive, badge: 'API' }
      ]
    },
    {
      id: 'telephony',
      title: 'Telephony & Voice CTI',
      items: [
        { id: 'telephony', label: 'Interactive Softphone & CDR', code: 'cti_console', icon: Phone, badge: calls.length }
      ]
    },
    {
      id: 'admin',
      title: 'Platform Administration & Finance',
      items: [
        { id: 'billing', label: 'Invoices & Ledger', code: 'fin_invoice.list', icon: DollarSign, badge: null },
        { id: 'database', label: 'Multi-Cloud DB & Backup', code: 'sys_db_sync', icon: Database, badge: 'CLOUD' }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 font-mono text-xs h-[calc(100vh-3.5rem)] sticky top-14 z-30 select-none">
      {/* ServiceNow Navigator Filter Input */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter navigator..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1.5 text-xs focus:border-neutral-500 focus:outline-none placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Nav Tree Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/80 p-2 space-y-4">
        {navSections.map(section => {
          const matchingItems = section.items.filter(item =>
            !filterText ||
            item.label.toLowerCase().includes(filterText.toLowerCase()) ||
            item.code.toLowerCase().includes(filterText.toLowerCase())
          );

          if (matchingItems.length === 0) return null;

          const isCollapsed = collapsedSections[section.id];

          return (
            <div key={section.id} className="pt-2">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between text-neutral-400 hover:text-neutral-200 py-1 px-2 text-[11px] uppercase tracking-wider font-bold"
              >
                <span>{section.title}</span>
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 mt-1">
                  {matchingItems.map(item => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between transition-colors ${
                          isActive
                            ? 'bg-neutral-800 text-neutral-100 border-l-2 border-l-rose-500 font-bold'
                            : 'text-neutral-400 hover:bg-neutral-900/80 hover:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-rose-400' : 'text-neutral-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== null && (
                          <span className={`text-[10px] px-1 py-0.2 tabular-nums font-mono ${
                            isActive ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigator Footer */}
      <div className="p-3 border-t border-neutral-900 bg-neutral-950 text-[10px] text-neutral-500 flex items-center justify-between">
        <span>NOW PLATFORM v2.4</span>
        <span>NJURE TECH</span>
      </div>
    </aside>
  );
};
