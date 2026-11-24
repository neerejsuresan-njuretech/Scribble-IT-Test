import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ITSMProvider, useITSM } from './context/ITSMContext';
import { ServiceNowHeader } from './components/common/ServiceNowHeader';
import { ServiceNowNavigator } from './components/common/ServiceNowNavigator';
import { ToastViewport } from './components/common/ToastViewport';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FreeITSMModuleId, IamPermissionScope } from './types/itsm';
import {
  NAV_MODULES_BY_ID,
  canAccessNavId,
  hasModuleRolePermission,
} from './config/navigationAccess';
import {
  Eye,
  AlertTriangle,
  Package,
  BookOpen,
  LayoutGrid,
  Activity,
  PlusCircle,
  Shield,
} from 'lucide-react';

// Core ITSM Modules
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
import { GoogleFormsModule } from './components/workspace/GoogleFormsModule';
import { GoogleChatModule } from './components/workspace/GoogleChatModule';
import { GoogleSheetsModule } from './components/workspace/GoogleSheetsModule';
import { GoogleDriveModule } from './components/workspace/GoogleDriveModule';

// Dedicated Separate Full-Page Forms
import { NewIncidentPage } from './pages/forms/NewIncidentPage';
import { NewChangePage } from './pages/forms/NewChangePage';
import { NewRequestPage } from './pages/forms/NewRequestPage';
import { NewProblemPage } from './pages/forms/NewProblemPage';
import { NewAssetPage } from './pages/forms/NewAssetPage';
import { NewInventoryPage } from './pages/forms/NewInventoryPage';
import { NewInvoicePage } from './pages/forms/NewInvoicePage';
import { NewPortalTicketPage } from './pages/forms/NewPortalTicketPage';

// Multi-Tenant & IAM Pages
import { TenantAdminPage } from './pages/tenants/TenantAdminPage';
import { ModuleControlsPage } from './pages/tenants/ModuleControlsPage';
import { IamPortalPage } from './pages/iam/IamPortalPage';

// FreeITSM Full Module Suite Pages
import { WatchtowerPage } from './pages/freeitsm/WatchtowerPage';
import { CmdbNetworkMapPage } from './pages/freeitsm/CmdbNetworkMapPage';
import { SoftwareInventoryPage } from './pages/freeitsm/SoftwareInventoryPage';
import { TasksKanbanPage } from './pages/freeitsm/TasksKanbanPage';
import { ProjectsPage } from './pages/freeitsm/ProjectsPage';
import { KnowledgeBasePage } from './pages/freeitsm/KnowledgeBasePage';
import { ContractsRfpPage } from './pages/freeitsm/ContractsRfpPage';
import { DomainsRegisterPage } from './pages/freeitsm/DomainsRegisterPage';
import { ServiceStatusPage } from './pages/freeitsm/ServiceStatusPage';
import { MorningChecksPage } from './pages/freeitsm/MorningChecksPage';
import { CalendarRotaPage } from './pages/freeitsm/CalendarRotaPage';
import { WarRoomPage } from './pages/freeitsm/WarRoomPage';
import { LmsPage } from './pages/freeitsm/LmsPage';
import { SystemWikiPage } from './pages/freeitsm/SystemWikiPage';
import { ProcessMapperPage } from './pages/freeitsm/ProcessMapperPage';
import { CustomFormsBuilderPage } from './pages/freeitsm/CustomFormsBuilderPage';
import { ReportsAuditPage } from './pages/freeitsm/ReportsAuditPage';
import { WorkflowManagementPage } from './pages/workflows/WorkflowManagementPage';
import { TicketWorkflowPage } from './pages/workflows/TicketWorkflowPage';

// Public Pre-Login Website & Multi-Portal Authentication Pages
import { LandingWebsitePage } from './pages/public/LandingWebsitePage';
import { PortalGatewayPage } from './pages/auth/PortalGatewayPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { EmployeeLoginPage } from './pages/auth/EmployeeLoginPage';
import { EndUserLoginPage } from './pages/auth/EndUserLoginPage';
import { IamLoginPage } from './pages/auth/IamLoginPage';

const ModuleGate: React.FC<{ moduleId: FreeITSMModuleId; label: string; children: React.ReactNode }> = ({
  moduleId, label, children
}) => {
  const { isModuleEnabled, activeTenant, isSuperAdmin } = useITSM();
  if (!isModuleEnabled(moduleId)) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-neutral-500 uppercase">MODULE AVAILABILITY · {activeTenant.name}</div>
        <h2 className="text-base font-bold text-neutral-100">{label} Is Disabled</h2>
        <p className="text-neutral-400">
          This module is currently disabled by corporate administration for {activeTenant.name}.
        </p>
        {isSuperAdmin && (
          <Link
            to="/system/modules"
            className="inline-block px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
          >
            Enable in Module Controls
          </Link>
        )}
      </div>
    );
  }
  return <>{children}</>;
};

const SuperAdminOnlyGate: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { isSuperAdmin } = useITSM();
  if (!isSuperAdmin) {
    return (
      <div className="border border-rose-900/70 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">
          SUPER ADMIN PORTAL CLEARANCE REQUIRED
        </div>
        <h2 className="text-base font-bold text-neutral-100">{label} Access Restricted</h2>
        <p className="text-neutral-400 leading-relaxed">
          Corporate governance restricts company profile updates, branding, logos, SLA configurations, module availability, and database operations exclusively to authenticated <strong className="text-neutral-200">Super Admin Portal</strong> sessions.
        </p>
        <Link
          to="/login/admin"
          className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider"
        >
          Go to Super Admin Portal
        </Link>
      </div>
    );
  }
  return <>{children}</>;
};

const PermissionGate: React.FC<{ scope: IamPermissionScope; label: string; children: React.ReactNode }> = ({
  scope, label, children
}) => {
  const { isSuperAdmin, hasPermission } = useITSM();
  if (!isSuperAdmin && !hasPermission(scope)) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
          RBAC POLICY SCOPE REQUIRED · {scope}
        </div>
        <h2 className="text-base font-bold text-neutral-100">{label} Access Restricted</h2>
        <p className="text-neutral-400 leading-relaxed">
          Your current corporate role does not hold the <span className="text-neutral-200 font-bold">{scope}</span> permission scope required to access {label}. Contact the IAM Team to request an updated policy binding.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/watchtower"
            className="inline-block px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold"
          >
            Return to Operations
          </Link>
          <Link
            to="/login/iam"
            className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold"
          >
            IAM Portal Login
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const IamAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, isIamPortal, hasPermission } = useITSM();
  const allowed = isSuperAdmin || isIamPortal || hasPermission('iam:manage');
  if (!allowed) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-amber-400 uppercase font-bold">IAM CLEARANCE REQUIRED</div>
        <h2 className="text-base font-bold text-neutral-100">IAM Portal Access Restricted</h2>
        <p className="text-neutral-400">
          Identity creation, Company ID bindings, device enrollment codes, and policy assignments require an IAM Portal operator, Super Admin, or an account granted iam:manage scope.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/login/iam"
            className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold"
          >
            Go to IAM Login
          </Link>
          <Link
            to="/login/admin"
            className="inline-block px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold"
          >
            Super Admin Login
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const NavAccessGate: React.FC<{ navId: string; children: React.ReactNode }> = ({ navId, children }) => {
  const { role, authSession, isSuperAdmin, isIamPortal, isModuleEnabled, hasPermission, activeTenant } = useITSM();
  const item = NAV_MODULES_BY_ID[navId];
  if (!item) return <>{children}</>;

  if (item.moduleId && !isModuleEnabled(item.moduleId)) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-sans text-xs space-y-4 max-w-xl mx-auto mt-10 rounded-lg">
        <div className="text-[11px] text-neutral-500 font-semibold">Module Availability · {activeTenant.name}</div>
        <h2 className="text-base font-bold text-neutral-100">{item.label} Is Disabled</h2>
        <p className="text-neutral-400 leading-relaxed">
          This module is currently disabled by corporate administration for {activeTenant.name}.
        </p>
        {isSuperAdmin && (
          <Link
            to="/system/modules"
            className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-md"
          >
            Enable in Module Controls
          </Link>
        )}
      </div>
    );
  }

  const allowed = hasModuleRolePermission(item, {
    role,
    isSuperAdmin,
    isIamPortal,
    hasPermission,
  });

  if (!allowed) {
    const isSuperOnly = Boolean(item.access.superAdminOnly);
    const defaultReturnPath = authSession?.portalType === 'iam' ? '/iam' : '/watchtower';
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-sans text-xs space-y-4 max-w-xl mx-auto mt-10 rounded-lg">
        <div className={`text-[11px] font-semibold ${isSuperOnly ? 'text-rose-400' : 'text-amber-400'}`}>
          {isSuperOnly ? 'Super Admin Portal Clearance Required' : 'Role-Based Access Restricted'}
        </div>
        <h2 className="text-base font-bold text-neutral-100">{item.label} Access Restricted</h2>
        <p className="text-neutral-400 leading-relaxed">
          Your current account role does not include permission for <strong className="text-neutral-200">{item.label}</strong> ({item.access.clearanceLabel}).
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={defaultReturnPath}
            className="inline-block px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold rounded-md"
          >
            Return to Workspace
          </Link>
          <Link
            to={isSuperOnly ? '/login/admin' : '/login/iam'}
            className={`inline-block px-4 py-2 text-white font-semibold rounded-md ${
              isSuperOnly ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {isSuperOnly ? 'Super Admin Login' : 'IAM Portal Login'}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

function MainApp() {
  const { authSession, role, activeTenant, isModuleEnabled, isSuperAdmin, isIamPortal, hasPermission, getPortalBranding } = useITSM();
  const location = useLocation();
  const [isNavigatorOpen, setIsNavigatorOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // Adapt navigator smoothly when crossing the 1024px desktop/tablet breakpoint
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastDesktop = window.innerWidth >= 1024;
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop !== lastDesktop) {
        lastDesktop = isDesktop;
        setIsNavigatorOpen(isDesktop);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile/tablet overlay drawer automatically on navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsNavigatorOpen(false);
    }
  }, [location.pathname]);

  if (location.pathname === '/welcome') {
    return <LandingWebsitePage />;
  }

  if (location.pathname.startsWith('/login')) {
    return (
      <Routes>
        <Route path="/login" element={<PortalGatewayPage />} />
        <Route path="/login/admin" element={<AdminLoginPage />} />
        <Route path="/login/employee" element={<EmployeeLoginPage />} />
        <Route path="/login/iam" element={<IamLoginPage />} />
        <Route path="/login/portal" element={<EndUserLoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!authSession?.isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingWebsitePage />} />
        <Route path="/home" element={<LandingWebsitePage />} />
        <Route path="/tenants" element={<Navigate to="/login/admin" replace />} />
        <Route path="/system/modules" element={<Navigate to="/login/admin" replace />} />
        <Route path="/database" element={<Navigate to="/login/admin" replace />} />
        <Route path="/iam" element={<Navigate to="/login/iam" replace />} />
        <Route path="/portal/*" element={<Navigate to="/login/portal" replace />} />
        <Route path="/portal" element={<Navigate to="/login/portal" replace />} />
        <Route path="/watchtower" element={<Navigate to="/login/employee" replace />} />
        <Route path="/incidents/*" element={<Navigate to="/login/employee" replace />} />
        <Route path="/workflows" element={<Navigate to="/login/employee" replace />} />
        <Route path="/ticket-workflows" element={<Navigate to="/login/employee" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const activePortalKey =
    role === 'customer'
      ? 'enduser'
      : authSession?.portalType === 'iam'
        ? 'iam'
        : 'employees';
  const activeBrand = getPortalBranding(activePortalKey);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col dot-matrix-bg selection:bg-rose-600 selection:text-white overflow-x-clip">
      <ServiceNowHeader
        onToggleNavigator={() => setIsNavigatorOpen(!isNavigatorOpen)}
        isNavigatorOpen={isNavigatorOpen}
      />

      {role === 'customer' && (
        <div className="bg-neutral-950 border-b border-neutral-800 px-3 sm:px-4 py-2 flex items-center gap-4 font-mono text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link
            to="/portal"
            className={`min-h-[32px] inline-flex items-center shrink-0 ${location.pathname === '/portal' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            Self-Service Portal
          </Link>
          {isModuleEnabled('status_page') && (
            <Link
              to="/status"
              className={`min-h-[32px] inline-flex items-center shrink-0 ${location.pathname === '/status' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              Service Status
            </Link>
          )}
          {isModuleEnabled('knowledge') && (
            <Link
              to="/knowledge"
              className={`min-h-[32px] inline-flex items-center shrink-0 ${location.pathname === '/knowledge' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              Knowledge Bank
            </Link>
          )}
          <Link
            to="/portal/new"
            className={`min-h-[32px] inline-flex items-center shrink-0 ${location.pathname === '/portal/new' ? 'text-rose-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            + Report Ticket
          </Link>
        </div>
      )}

      <div className="flex-1 flex min-w-0 overflow-x-clip">
        {role !== 'customer' && (
          <ServiceNowNavigator
            isOpen={isNavigatorOpen}
            onCloseMobile={() => {
              if (window.innerWidth < 1024) setIsNavigatorOpen(false);
            }}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-5 pb-20 md:pb-6 max-w-full">
          <div className="max-w-[1680px] mx-auto w-full min-w-0">
            {role === 'customer' ? (
              <Routes>
                <Route path="/portal" element={<CustomerPortal />} />
                <Route path="/portal/new" element={<NewPortalTicketPage />} />
                <Route path="/requests/new" element={<NewRequestPage />} />
                <Route path="/status" element={<ModuleGate moduleId="status_page" label="Service Status"><ServiceStatusPage /></ModuleGate>} />
                <Route path="/knowledge" element={<ModuleGate moduleId="knowledge" label="Knowledge Base"><KnowledgeBasePage /></ModuleGate>} />
                <Route path="*" element={<Navigate to="/portal" replace />} />
              </Routes>
            ) : (
              <Routes>
                <Route path="/" element={<Navigate to={authSession?.portalType === 'iam' ? '/iam' : '/watchtower'} replace />} />

                {/* Command & Operations */}
                <Route path="/watchtower" element={<NavAccessGate navId="watchtower"><WatchtowerPage /></NavAccessGate>} />
                <Route path="/dashboard" element={<NavAccessGate navId="dashboard"><OverviewDashboard /></NavAccessGate>} />
                <Route path="/war-room" element={<NavAccessGate navId="war_room"><WarRoomPage /></NavAccessGate>} />
                <Route path="/checks" element={<NavAccessGate navId="morning_checks"><MorningChecksPage /></NavAccessGate>} />
                <Route path="/status" element={<NavAccessGate navId="status_page"><ServiceStatusPage /></NavAccessGate>} />
                <Route path="/calendar" element={<NavAccessGate navId="calendar"><CalendarRotaPage /></NavAccessGate>} />

                {/* ITSM & Delivery */}
                <Route path="/incidents" element={<NavAccessGate navId="incidents"><IncidentModule /></NavAccessGate>} />
                <Route path="/ticket-workflows" element={<NavAccessGate navId="ticket_workflow"><TicketWorkflowPage /></NavAccessGate>} />
                <Route path="/changes" element={<NavAccessGate navId="changes"><ChangeModule /></NavAccessGate>} />
                <Route path="/requests" element={<NavAccessGate navId="requests"><RequestModule /></NavAccessGate>} />
                <Route path="/problems" element={<NavAccessGate navId="problems"><ProblemModule /></NavAccessGate>} />
                <Route path="/tasks" element={<NavAccessGate navId="tasks"><TasksKanbanPage /></NavAccessGate>} />
                <Route path="/projects" element={<NavAccessGate navId="projects"><ProjectsPage /></NavAccessGate>} />

                {/* CMDB, Assets & Vendors */}
                <Route path="/assets" element={<NavAccessGate navId="assets"><AssetModule /></NavAccessGate>} />
                <Route path="/cmdb/network-map" element={<NavAccessGate navId="network_map"><CmdbNetworkMapPage /></NavAccessGate>} />
                <Route path="/inventory" element={<NavAccessGate navId="inventory"><InventoryModule /></NavAccessGate>} />
                <Route path="/software" element={<NavAccessGate navId="software"><SoftwareInventoryPage /></NavAccessGate>} />
                <Route path="/contracts" element={<NavAccessGate navId="contracts"><ContractsRfpPage /></NavAccessGate>} />
                <Route path="/domains" element={<NavAccessGate navId="domains"><DomainsRegisterPage /></NavAccessGate>} />

                {/* Knowledge, Forms & LMS */}
                <Route path="/knowledge" element={<NavAccessGate navId="knowledge"><KnowledgeBasePage /></NavAccessGate>} />
                <Route path="/wiki" element={<NavAccessGate navId="wiki"><SystemWikiPage /></NavAccessGate>} />
                <Route path="/workflows" element={<NavAccessGate navId="workflow_management"><WorkflowManagementPage /></NavAccessGate>} />
                <Route path="/process-mapper" element={<NavAccessGate navId="process_mapper"><ProcessMapperPage /></NavAccessGate>} />
                <Route path="/forms-builder" element={<NavAccessGate navId="custom_forms"><CustomFormsBuilderPage /></NavAccessGate>} />
                <Route path="/lms" element={<NavAccessGate navId="lms"><LmsPage /></NavAccessGate>} />

                {/* Multi-Tenant Super Admin, IAM & Platform */}
                <Route path="/tenants" element={<SuperAdminOnlyGate label="Company Details & Tenant Directory"><TenantAdminPage /></SuperAdminOnlyGate>} />
                <Route path="/system/modules" element={<SuperAdminOnlyGate label="Module Availability"><ModuleControlsPage /></SuperAdminOnlyGate>} />
                <Route path="/iam" element={<IamAccessGate><NavAccessGate navId="iam"><IamPortalPage /></NavAccessGate></IamAccessGate>} />
                <Route path="/reports" element={<NavAccessGate navId="reports"><ReportsAuditPage /></NavAccessGate>} />
                <Route path="/telephony" element={<NavAccessGate navId="telephony"><TelephonyModule /></NavAccessGate>} />
                <Route path="/billing" element={<NavAccessGate navId="billing"><BillingModule /></NavAccessGate>} />
                <Route path="/database" element={<SuperAdminOnlyGate label="Database & Sync"><DatabaseModule /></SuperAdminOnlyGate>} />
                <Route path="/portal" element={<CustomerPortal />} />

                {/* Dedicated Form Pages */}
                <Route path="/incidents/new" element={<PermissionGate scope="incidents:write" label="New Incident"><NewIncidentPage /></PermissionGate>} />
                <Route path="/changes/new" element={<PermissionGate scope="incidents:write" label="New Change Request"><NewChangePage /></PermissionGate>} />
                <Route path="/requests/new" element={<PermissionGate scope="incidents:write" label="New Service Request"><NewRequestPage /></PermissionGate>} />
                <Route path="/problems/new" element={<PermissionGate scope="incidents:write" label="New Problem Record"><NewProblemPage /></PermissionGate>} />
                <Route path="/assets/new" element={<PermissionGate scope="assets:write" label="New Asset"><NewAssetPage /></PermissionGate>} />
                <Route path="/inventory/new" element={<PermissionGate scope="assets:write" label="New Inventory Item"><NewInventoryPage /></PermissionGate>} />
                <Route path="/billing/new" element={<PermissionGate scope="billing:read" label="New Invoice"><NewInvoicePage /></PermissionGate>} />
                <Route path="/portal/new" element={<NewPortalTicketPage />} />

                {/* Google Workspace Integrations */}
                <Route path="/workspace/forms" element={<NavAccessGate navId="google_forms"><GoogleFormsModule /></NavAccessGate>} />
                <Route path="/workspace/chat" element={<NavAccessGate navId="google_chat"><GoogleChatModule /></NavAccessGate>} />
                <Route path="/workspace/sheets" element={<NavAccessGate navId="google_sheets"><GoogleSheetsModule /></NavAccessGate>} />
                <Route path="/workspace/drive" element={<NavAccessGate navId="google_drive"><GoogleDriveModule /></NavAccessGate>} />

                <Route path="*" element={<Navigate to={authSession?.portalType === 'iam' ? '/iam' : '/watchtower'} replace />} />
              </Routes>
            )}
          </div>
        </main>
      </div>

      {/* Platform Footer — Always preserves Powered by Scribble IT even when tenant customizes portal name */}
      <footer className="border-t border-neutral-900 bg-neutral-950/90 py-2.5 px-4 mb-14 md:mb-0 z-20">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-sans text-neutral-500">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="text-neutral-200 font-semibold">{activeBrand.portalName}</span>
            <span aria-hidden="true">·</span>
            <span>{activeTenant.name}</span>
            {activeTenant.companyCode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{activeTenant.companyCode}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span className="text-neutral-300 font-semibold">Powered by Scribble IT</span>
            <span aria-hidden="true">·</span>
            <span>Njure Tech</span>
          </div>
        </div>
      </footer>

      {/* Mobile Thumb-Zone Bottom Navigation Bar (< md) */}
      <nav
        aria-label="Mobile Primary Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 min-h-[56px] pb-safe bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 px-1"
      >
        {role === 'customer' ? (
          <div className="grid grid-cols-4 h-full">
            {[
              { path: '/portal', label: 'Portal', Icon: LayoutGrid },
              { path: '/portal/new', label: 'Report', Icon: PlusCircle },
              { path: '/status', label: 'Status', Icon: Activity },
              { path: '/knowledge', label: 'KB', Icon: BookOpen },
            ].map(item => {
              const active = location.pathname === item.path;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                    active ? 'text-rose-400' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          (() => {
            const rbacCtx = {
              role,
              portalType: authSession?.portalType,
              isSuperAdmin,
              isIamPortal,
              isModuleEnabled,
              hasPermission,
            };
            const mobileShortcuts = [
              authSession?.portalType === 'iam'
                ? { navId: 'iam', path: '/iam', label: 'IAM', Icon: Shield }
                : { navId: 'watchtower', path: '/watchtower', label: 'Watch', Icon: Eye },
              { navId: 'incidents', path: '/incidents', label: 'Incidents', Icon: AlertTriangle },
              { navId: 'requests', path: '/requests', label: 'Requests', Icon: Package },
              { navId: 'knowledge', path: '/knowledge', label: 'KB', Icon: BookOpen },
            ].filter(item => canAccessNavId(item.navId, rbacCtx));

            return (
              <div
                className="grid h-full"
                style={{ gridTemplateColumns: `repeat(${mobileShortcuts.length + 1}, minmax(0, 1fr))` }}
              >
                {mobileShortcuts.map(item => {
                  const active = location.pathname.startsWith(item.path);
                  const Icon = item.Icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                        active ? 'text-rose-400' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsNavigatorOpen(prev => !prev)}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                    isNavigatorOpen ? 'text-sky-400' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Modules</span>
                </button>
              </div>
            );
          })()
        )}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ITSMProvider>
        <HashRouter>
          <MainApp />
        </HashRouter>
        <ToastViewport />
      </ITSMProvider>
    </ErrorBoundary>
  );
}

