import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { FreeITSMModuleId } from '../../types/itsm';
import {
  AlertTriangle, Package, ShieldCheck, Server, RefreshCw,
  Phone, DollarSign, Database, FileText, MessageSquare,
  Sheet, HardDrive, Plus, ChevronDown, ChevronRight, Search,
  Eye, Radio, ClipboardCheck, Activity, Calendar, KanbanSquare,
  FolderKanban, GitFork, KeyRound, FileSpreadsheet, Globe,
  BookOpen, Library, Workflow, FormInput, GraduationCap,
  BarChart3, Building2, SlidersHorizontal, GitCommitHorizontal, Shield, X
} from 'lucide-react';

interface ServiceNowNavigatorProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: string;
  moduleId?: FreeITSMModuleId;
  path: string;
  label: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number | string | null;
  newPath: string | null;
  adminOnly?: boolean;
  iamOnly?: boolean;
}

export const ServiceNowNavigator: React.FC<ServiceNowNavigatorProps> = ({ isOpen, onCloseMobile }) => {
  const location = useLocation();
  const {
    incidents, changes, inventory, calls, tasks, projects,
    warRooms, softwareLicenses, contracts, domains,
    activeTenant, isModuleEnabled, role, hasPermission
  } = useITSM();

  const [filterText, setFilterText] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const openIncidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
  const pendingChanges = changes.filter(c => c.status === 'cab_review').length;
  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold).length;
  const openTasks = tasks.filter(t => t.column !== 'done').length;
  const activeWarRooms = warRooms.filter(w => w.status === 'active').length;
  const expiringContracts = contracts.filter(c => c.status === 'expiring_soon' || c.status === 'rfp_open').length;
  const flaggedSoftware = softwareLicenses.filter(s => s.complianceStatus !== 'compliant').length;

  const navSections: { id: string; title: string; items: NavItem[] }[] = [
    {
      id: 'command',
      title: 'Command & Operations',
      items: [
        { id: 'watchtower', moduleId: 'watchtower', path: '/watchtower', label: 'Watchtower', code: 'watchtower.do', icon: Eye, badge: null, newPath: null },
        { id: 'dashboard', moduleId: 'dashboard', path: '/dashboard', label: 'Service Desk', code: 'sys_portal', icon: Server, badge: null, newPath: null },
        { id: 'war_room', moduleId: 'war_room', path: '/war-room', label: 'War Room', code: 'war_room.do', icon: Radio, badge: activeWarRooms || null, newPath: null },
        { id: 'morning_checks', moduleId: 'morning_checks', path: '/checks', label: 'Morning Checks', code: 'morning_check.list', icon: ClipboardCheck, badge: null, newPath: null },
        { id: 'status_page', moduleId: 'status_page', path: '/status', label: 'Service Status', code: 'status_page.do', icon: Activity, badge: null, newPath: null },
        { id: 'calendar', moduleId: 'calendar', path: '/calendar', label: 'Calendar & Rota', code: 'sys_calendar.do', icon: Calendar, badge: null, newPath: null }
      ]
    },
    {
      id: 'itsm',
      title: 'ITSM & Delivery',
      items: [
        { id: 'incidents', moduleId: 'incidents', path: '/incidents', label: 'Tickets / Incidents', code: 'incident.list', icon: AlertTriangle, badge: openIncidents || null, newPath: '/incidents/new' },
        { id: 'ticket_workflow', moduleId: 'ticket_workflow', path: '/ticket-workflows', label: 'Ticket Workflow Mgmt', code: 'wf_ticket.do', icon: GitCommitHorizontal, badge: null, newPath: null },
        { id: 'requests', moduleId: 'requests', path: '/requests', label: 'Service Requests', code: 'sc_request.list', icon: Package, badge: null, newPath: '/requests/new' },
        { id: 'problems', moduleId: 'problems', path: '/problems', label: 'Problem Mgmt', code: 'problem.list', icon: ShieldCheck, badge: null, newPath: '/problems/new' },
        { id: 'changes', moduleId: 'changes', path: '/changes', label: 'Change (CAB)', code: 'change_request.list', icon: ShieldCheck, badge: pendingChanges || null, newPath: '/changes/new' },
        { id: 'tasks', moduleId: 'tasks', path: '/tasks', label: 'Tasks (Kanban)', code: 'pm_task.list', icon: KanbanSquare, badge: openTasks || null, newPath: null },
        { id: 'projects', moduleId: 'projects', path: '/projects', label: 'Projects Portfolio', code: 'pm_project.list', icon: FolderKanban, badge: projects.length || null, newPath: null }
      ]
    },
    {
      id: 'cmdb',
      title: 'CMDB, Assets & Vendors',
      items: [
        { id: 'assets', moduleId: 'assets', path: '/assets', label: 'Assets Register', code: 'cmdb_ci.list', icon: Server, badge: null, newPath: '/assets/new' },
        { id: 'network_map', moduleId: 'network_map', path: '/cmdb/network-map', label: 'CMDB Network Map', code: 'cmdb_map.do', icon: GitFork, badge: null, newPath: null },
        { id: 'inventory', moduleId: 'inventory', path: '/inventory', label: 'Hardware Inventory', code: 'alm_consumable.list', icon: RefreshCw, badge: lowStock || null, newPath: '/inventory/new' },
        { id: 'software', moduleId: 'software', path: '/software', label: 'Software & Licences', code: 'sam_software.list', icon: KeyRound, badge: flaggedSoftware || null, newPath: null },
        { id: 'contracts', moduleId: 'contracts', path: '/contracts', label: 'Contracts & RFP', code: 'ast_contract.list', icon: FileSpreadsheet, badge: expiringContracts || null, newPath: null },
        { id: 'domains', moduleId: 'domains', path: '/domains', label: 'Domains & SSL', code: 'cmdb_domain.list', icon: Globe, badge: domains.length || null, newPath: null }
      ]
    },
    {
      id: 'knowledge',
      title: 'Knowledge, Forms & LMS',
      items: [
        { id: 'knowledge', moduleId: 'knowledge', path: '/knowledge', label: 'Knowledge Base', code: 'kb_knowledge.list', icon: BookOpen, badge: null, newPath: null },
        { id: 'wiki', moduleId: 'wiki', path: '/wiki', label: 'System Wiki', code: 'sys_wiki.do', icon: Library, badge: null, newPath: null },
        { id: 'workflow_management', moduleId: 'workflow_management', path: '/workflows', label: 'Workflow Management', code: 'wf_engine.do', icon: Workflow, badge: null, newPath: null },
        { id: 'process_mapper', moduleId: 'process_mapper', path: '/process-mapper', label: 'Process Mapper', code: 'wf_process.do', icon: Workflow, badge: null, newPath: null },
        { id: 'custom_forms', moduleId: 'custom_forms', path: '/forms-builder', label: 'Custom Forms Builder', code: 'sc_form_builder.do', icon: FormInput, badge: null, newPath: null },
        { id: 'lms', moduleId: 'lms', path: '/lms', label: 'LMS Training', code: 'lms_course.list', icon: GraduationCap, badge: null, newPath: null }
      ]
    },
    {
      id: 'tenant_admin',
      title: 'Multi-Tenant & Platform',
      items: [
        { id: 'tenants', path: '/tenants', label: 'Tenant Directory', code: 'sys_tenant.list', icon: Building2, badge: null, newPath: null, adminOnly: true },
        { id: 'module_controls', path: '/system/modules', label: 'Module Availability', code: 'sys_modules.do', icon: SlidersHorizontal, badge: null, newPath: null, adminOnly: true },
        { id: 'iam', moduleId: 'iam', path: '/iam', label: 'IAM Portal', code: 'sys_iam.do', icon: Shield, badge: null, newPath: null, iamOnly: true },
        { id: 'reports', moduleId: 'reports', path: '/reports', label: 'Reporting & Audit', code: 'sys_report.do', icon: BarChart3, badge: null, newPath: null },
        { id: 'telephony', moduleId: 'telephony', path: '/telephony', label: 'Telephony Softphone', code: 'cti_console', icon: Phone, badge: calls.length || null, newPath: null },
        { id: 'billing', moduleId: 'billing', path: '/billing', label: 'Invoices & Billing', code: 'fin_invoice.list', icon: DollarSign, badge: null, newPath: '/billing/new' },
        { id: 'database', moduleId: 'database', path: '/database', label: 'Database & Sync', code: 'sys_db_sync', icon: Database, badge: null, newPath: null, adminOnly: true }
      ]
    },
    {
      id: 'workspace',
      title: 'Google Workspace',
      items: [
        { id: 'google_forms', moduleId: 'google_workspace', path: '/workspace/forms', label: 'Google Forms', code: 'google_forms', icon: FileText, badge: 'API', newPath: null },
        { id: 'google_chat', moduleId: 'google_workspace', path: '/workspace/chat', label: 'Google Chat', code: 'google_chat', icon: MessageSquare, badge: 'API', newPath: null },
        { id: 'google_sheets', moduleId: 'google_workspace', path: '/workspace/sheets', label: 'Google Sheets', code: 'google_sheets', icon: Sheet, badge: 'API', newPath: null },
        { id: 'google_drive', moduleId: 'google_workspace', path: '/workspace/drive', label: 'Google Drive', code: 'google_drive', icon: HardDrive, badge: 'API', newPath: null }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile & Tablet Backdrop (< xl) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden"
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] xl:static xl:sticky xl:top-14 xl:h-[calc(100vh-3.5rem)] xl:z-30 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 font-sans text-xs select-none shadow-2xl xl:shadow-none">
        {/* Navigator Filter Input */}
        <div className="p-3 border-b border-neutral-800 bg-neutral-900/40 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-bold text-neutral-200">{activeTenant.name}</span>
              <span className="text-neutral-500 shrink-0">· {activeTenant.plan}</span>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="xl:hidden min-h-[36px] min-w-[36px] -mr-1 flex items-center justify-center text-neutral-400 hover:text-white border border-neutral-800 bg-neutral-950"
              aria-label="Close module navigator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter 30+ modules..."
              className="w-full min-h-[38px] xl:min-h-0 bg-neutral-900 border border-neutral-700 text-neutral-200 pl-8 pr-3 py-1.5 text-xs focus:border-neutral-500 focus:outline-none placeholder:text-neutral-500"
            />
          </div>
        </div>

      {/* Nav Tree Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/80 p-2 space-y-3">
        {navSections.map(section => {
          const enabledItems = section.items.filter(
            item =>
              (!item.moduleId || isModuleEnabled(item.moduleId)) &&
              (!item.adminOnly || role === 'admin') &&
              (!item.iamOnly || role === 'admin' || hasPermission('iam:manage'))
          );
          const matchingItems = enabledItems.filter(item =>
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
                className="w-full flex items-center justify-between text-neutral-400 hover:text-neutral-200 py-1 px-2 text-[10px] uppercase tracking-wider font-bold"
              >
                <span>{section.title}</span>
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 mt-1">
                  {matchingItems.map(item => {
                    const isActive = location.pathname === item.path ||
                      (item.path !== '/dashboard' && item.path !== '/watchtower' && location.pathname.startsWith(item.path) && !location.pathname.endsWith('/new'));
                    const isNewActive = item.newPath && location.pathname === item.newPath;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center justify-between transition-colors ${
                          isActive
                            ? 'bg-neutral-800 text-neutral-100 font-bold'
                            : 'text-neutral-400 hover:bg-neutral-900/80 hover:text-neutral-200'
                        }`}
                      >
                        <Link
                          to={item.path}
                          onClick={onCloseMobile}
                          className="flex-1 min-h-[40px] xl:min-h-0 px-2.5 py-2 xl:py-1.5 flex items-center justify-between truncate"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-rose-400' : 'text-neutral-500'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge !== null && (
                            <span className={`text-[10px] px-1 tabular-nums font-mono shrink-0 ${
                              isActive ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>

                        {item.newPath && (
                          <Link
                            to={item.newPath}
                            onClick={onCloseMobile}
                            title={`Create new ${item.label.toLowerCase()}`}
                            className={`p-2 xl:p-1.5 mr-1 border transition-colors ${
                              isNewActive
                                ? 'bg-rose-600 border-rose-500 text-white'
                                : 'border-neutral-800 bg-neutral-900/40 text-neutral-500 hover:text-white hover:border-neutral-600'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
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
        <span>MULTI-TENANT ITSM</span>
        <span>NJURE TECH</span>
      </div>
    </aside>
    </>
  );
};

