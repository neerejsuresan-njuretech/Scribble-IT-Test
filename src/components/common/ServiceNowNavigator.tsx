import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import {
  getAccessibleNavSections,
  canUseQuickCreate,
  NavIconKey,
  NavModuleItem,
  NavSectionId,
} from '../../config/navigationAccess';
import {
  AlertTriangle,
  Package,
  ShieldCheck,
  Server,
  RefreshCw,
  Phone,
  DollarSign,
  Database,
  FileText,
  MessageSquare,
  Sheet,
  HardDrive,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Eye,
  Radio,
  ClipboardCheck,
  Activity,
  Calendar,
  KanbanSquare,
  FolderKanban,
  GitFork,
  KeyRound,
  FileSpreadsheet,
  Globe,
  BookOpen,
  Library,
  Workflow,
  FormInput,
  GraduationCap,
  BarChart3,
  Building2,
  SlidersHorizontal,
  GitCommitHorizontal,
  Shield,
  X,
  GitPullRequest,
  Network,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';

interface ServiceNowNavigatorProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

const ICON_MAP: Record<NavIconKey, React.ComponentType<{ className?: string }>> = {
  eye: Eye,
  server: Server,
  radio: Radio,
  clipboard_check: ClipboardCheck,
  activity: Activity,
  calendar: Calendar,
  alert_triangle: AlertTriangle,
  package: Package,
  shield_check: ShieldCheck,
  git_pull_request: GitPullRequest,
  kanban: KanbanSquare,
  folder_kanban: FolderKanban,
  hard_drive_server: Server,
  git_fork: GitFork,
  refresh_cw: RefreshCw,
  key_round: KeyRound,
  file_spreadsheet: FileSpreadsheet,
  globe: Globe,
  workflow: Workflow,
  git_commit: GitCommitHorizontal,
  network: Network,
  form_input: FormInput,
  book_open: BookOpen,
  library: Library,
  graduation_cap: GraduationCap,
  dollar_sign: DollarSign,
  bar_chart: BarChart3,
  phone: Phone,
  file_text: FileText,
  message_square: MessageSquare,
  sheet: Sheet,
  hard_drive: HardDrive,
  shield: Shield,
  building: Building2,
  sliders: SlidersHorizontal,
  database: Database,
};

function isNavItemActive(item: NavModuleItem, pathname: string): boolean {
  if (pathname === item.path) return true;
  if (item.path === '/dashboard' || item.path === '/watchtower') return false;
  return pathname.startsWith(`${item.path}/`) && !pathname.endsWith('/new');
}

export const ServiceNowNavigator: React.FC<ServiceNowNavigatorProps> = ({
  isOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const {
    role,
    authSession,
    incidents,
    changes,
    inventory,
    calls,
    tasks,
    projects,
    warRooms,
    softwareLicenses,
    contracts,
    domains,
    activeTenant,
    isModuleEnabled,
    isSuperAdmin,
    isIamPortal,
    hasPermission,
  } = useITSM();

  const [filterText, setFilterText] = useState('');
  const [sectionOverrides, setSectionOverrides] = useState<Partial<Record<NavSectionId, boolean>>>({});

  const rbacContext = useMemo(
    () => ({
      role,
      portalType: authSession?.portalType,
      isSuperAdmin,
      isIamPortal,
      isModuleEnabled,
      hasPermission,
    }),
    [role, authSession?.portalType, isSuperAdmin, isIamPortal, isModuleEnabled, hasPermission]
  );

  // Dynamically compute only the sections & modules the user's role/policies permit
  const accessibleSections = useMemo(
    () => getAccessibleNavSections(rbacContext),
    [rbacContext]
  );

  const totalAccessibleCount = useMemo(
    () => accessibleSections.reduce((sum, sec) => sum + sec.items.length, 0),
    [accessibleSections]
  );

  // Live numeric counters (shown as quiet tabular numerals, never pill badges)
  const metricCounts = useMemo<Record<string, number>>(() => {
    return {
      war_room: warRooms.filter(w => w.status === 'active').length,
      incidents: incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length,
      changes: changes.filter(c => c.status === 'cab_review').length,
      tasks: tasks.filter(t => t.column !== 'done').length,
      projects: projects.length,
      inventory: inventory.filter(i => i.quantity <= i.minThreshold).length,
      software: softwareLicenses.filter(s => s.complianceStatus !== 'compliant').length,
      contracts: contracts.filter(c => c.status === 'expiring_soon' || c.status === 'rfp_open').length,
      domains: domains.length,
      telephony: calls.length,
    };
  }, [warRooms, incidents, changes, tasks, projects, inventory, softwareLicenses, contracts, domains, calls]);

  const normalizedQuery = filterText.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return accessibleSections;
    return accessibleSections
      .map(section => {
        const sectionMatch =
          section.meta.title.toLowerCase().includes(normalizedQuery) ||
          section.meta.subtitle.toLowerCase().includes(normalizedQuery);
        const items = sectionMatch
          ? section.items
          : section.items.filter(
              item =>
                item.label.toLowerCase().includes(normalizedQuery) ||
                item.code.toLowerCase().includes(normalizedQuery)
            );
        return { ...section, items };
      })
      .filter(section => section.items.length > 0);
  }, [accessibleSections, normalizedQuery]);

  const isSectionExpanded = (sectionId: NavSectionId, items: NavModuleItem[], defaultExpanded: boolean): boolean => {
    if (normalizedQuery.length > 0) return true;
    const containsActiveRoute = items.some(
      item =>
        isNavItemActive(item, location.pathname) ||
        (Boolean(item.newPath) && location.pathname === item.newPath)
    );
    if (sectionOverrides[sectionId] !== undefined) {
      return Boolean(sectionOverrides[sectionId]);
    }
    return defaultExpanded || containsActiveRoute;
  };

  const toggleSection = (sectionId: NavSectionId, currentlyExpanded: boolean) => {
    setSectionOverrides(prev => ({ ...prev, [sectionId]: !currentlyExpanded }));
  };

  const allExpanded = visibleSections.every(sec =>
    isSectionExpanded(sec.meta.id, sec.items, sec.meta.defaultExpanded)
  );

  const handleToggleAllSections = () => {
    const nextState = !allExpanded;
    const nextOverrides: Partial<Record<NavSectionId, boolean>> = {};
    accessibleSections.forEach(sec => {
      nextOverrides[sec.meta.id] = nextState;
    });
    setSectionOverrides(nextOverrides);
  };

  const clearanceLabel = isSuperAdmin
    ? 'Super Admin'
    : isIamPortal
    ? 'IAM Officer'
    : hasPermission('workflows:manage')
    ? 'Operations Lead'
    : hasPermission('incidents:write')
    ? 'IT Operations'
    : hasPermission('billing:read')
    ? 'FinOps Analyst'
    : 'Scoped Access';

  const clearanceAccent = isSuperAdmin
    ? 'text-rose-400'
    : isIamPortal
    ? 'text-amber-400'
    : 'text-sky-400';

  if (!isOpen) return null;

  const tenantLogo =
    activeTenant.companyLogoDataUrl || activeTenant.portalBranding?.employees?.logoDataUrl;

  return (
    <>
      {/* Mobile & Tablet Backdrop (< lg) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        aria-label="Workspace Navigation"
        className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] lg:static lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-64 xl:w-[272px] lg:z-30 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 font-sans text-xs select-none shadow-2xl lg:shadow-none"
      >
        {/* Structured Workspace Header & Filter */}
        <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {tenantLogo ? (
                <img
                  src={tenantLogo}
                  alt={activeTenant.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded border border-neutral-800 bg-neutral-900 flex items-center justify-center text-[10px] font-bold text-neutral-300 shrink-0">
                  {activeTenant.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate font-semibold text-neutral-100 text-xs">
                  {activeTenant.name}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 truncate">
                  <span>{activeTenant.plan}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{totalAccessibleCount} modules</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden min-h-[40px] min-w-[40px] -mr-1 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 border border-neutral-800 bg-neutral-950 transition-colors"
              aria-label="Close navigation sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter modules..."
              aria-label="Filter accessible modules"
              className="w-full min-h-[40px] lg:min-h-[32px] rounded-md bg-neutral-900 border border-neutral-800 text-neutral-200 pl-8 pr-7 py-1.5 text-xs focus:border-neutral-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/60 placeholder:text-neutral-500 transition-colors"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                aria-label="Clear module filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quiet Structural Toolbar */}
          {accessibleSections.length > 1 && !normalizedQuery && (
            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
              <span className="truncate">{accessibleSections.length} workspace groups</span>
              <button
                type="button"
                onClick={handleToggleAllSections}
                className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-200 transition-colors whitespace-nowrap shrink-0"
              >
                {allExpanded ? (
                  <>
                    <ChevronsDownUp className="w-3 h-3" />
                    <span>Collapse all</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="w-3 h-3" />
                    <span>Expand all</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Structured Role-Filtered Navigation Tree */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {visibleSections.length === 0 ? (
            <div className="px-3 py-8 text-center space-y-2.5">
              <p className="text-xs text-neutral-400">
                No accessible modules match &ldquo;{filterText.trim()}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                Clear filter
              </button>
            </div>
          ) : (
            visibleSections.map((section, idx) => {
              const expanded = isSectionExpanded(
                section.meta.id,
                section.items,
                section.meta.defaultExpanded
              );
              const hasActiveChild = section.items.some(
                item =>
                  isNavItemActive(item, location.pathname) ||
                  (Boolean(item.newPath) && location.pathname === item.newPath)
              );

              return (
                <div
                  key={section.meta.id}
                  className={idx > 0 ? 'pt-3 border-t border-neutral-900' : ''}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.meta.id, expanded)}
                    aria-expanded={expanded}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      hasActiveChild && !expanded
                        ? 'text-neutral-100 bg-neutral-900/60'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-tight text-neutral-300 truncate">
                        {section.meta.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] tabular-nums text-neutral-500">
                        {section.items.length}
                      </span>
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-1 ml-2.5 pl-2 border-l border-neutral-800/80 space-y-0.5">
                      {section.items.map(item => {
                        const isActive = isNavItemActive(item, location.pathname);
                        const isNewActive = Boolean(item.newPath) && location.pathname === item.newPath;
                        const Icon = ICON_MAP[item.icon];
                        const count = metricCounts[item.id] || 0;
                        const allowCreate = canUseQuickCreate(item, rbacContext);

                        return (
                          <div
                            key={item.id}
                            className={`group flex items-center justify-between rounded-md transition-colors ${
                              isActive
                                ? 'bg-neutral-800/90 text-neutral-100 font-semibold'
                                : 'text-neutral-400 hover:bg-neutral-900/80 hover:text-neutral-200'
                            }`}
                          >
                            <Link
                              to={item.path}
                              onClick={onCloseMobile}
                              aria-current={isActive ? 'page' : undefined}
                              className="flex-1 min-h-[42px] lg:min-h-[32px] px-2.5 py-2 lg:py-1.5 flex items-center justify-between gap-2 min-w-0"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                    isActive
                                      ? 'text-rose-400'
                                      : 'text-neutral-500 group-hover:text-neutral-300'
                                  }`}
                                />
                                <span className="truncate whitespace-nowrap">{item.label}</span>
                              </div>
                              {count > 0 && (
                                <span
                                  className={`text-[11px] tabular-nums shrink-0 ${
                                    isActive ? 'text-neutral-200 font-semibold' : 'text-neutral-500'
                                  }`}
                                >
                                  {count}
                                </span>
                              )}
                            </Link>

                            {item.newPath && allowCreate && (
                              <Link
                                to={item.newPath}
                                onClick={onCloseMobile}
                                title={`New ${item.label}`}
                                aria-label={`Create new ${item.label}`}
                                className={`min-h-[34px] min-w-[34px] lg:min-h-[24px] lg:min-w-[24px] mr-1 rounded flex items-center justify-center transition-colors shrink-0 ${
                                  isNewActive
                                    ? 'bg-rose-600 text-white'
                                    : 'text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800 opacity-80 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* Quiet Corporate Access Context Footer */}
        <div className="px-3.5 py-2.5 border-t border-neutral-800/80 bg-neutral-950 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span className={`font-semibold truncate ${clearanceAccent}`}>{clearanceLabel}</span>
          <span className="truncate tabular-nums font-mono text-[10px]">
            {activeTenant.companyCode || 'Njure Tech'}
          </span>
        </div>
      </aside>
    </>
  );
};
