import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ITSMProvider, useITSM } from './context/ITSMContext';
import { ServiceNowHeader } from './components/common/ServiceNowHeader';
import { ServiceNowNavigator } from './components/common/ServiceNowNavigator';
import { ToastViewport } from './components/common/ToastViewport';
import { FreeITSMModuleId } from './types/itsm';

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

// Multi-Portal Authentication Pages
import { PortalGatewayPage } from './pages/auth/PortalGatewayPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { EmployeeLoginPage } from './pages/auth/EmployeeLoginPage';
import { EndUserLoginPage } from './pages/auth/EndUserLoginPage';
import { IamLoginPage } from './pages/auth/IamLoginPage';

const ModuleGate: React.FC<{ moduleId: FreeITSMModuleId; label: string; children: React.ReactNode }> = ({
  moduleId, label, children
}) => {
  const { isModuleEnabled, activeTenant, role } = useITSM();
  if (!isModuleEnabled(moduleId)) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-neutral-500 uppercase">MODULE AVAILABILITY · {activeTenant.name}</div>
        <h2 className="text-base font-bold text-neutral-100">{label} Is Disabled</h2>
        <p className="text-neutral-400">
          This FreeITSM module is currently turned off in System &rarr; Modules &rarr; Availability for tenant {activeTenant.name}.
        </p>
        {role !== 'customer' && (
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

const AdminOnlyGate: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { role } = useITSM();
  if (role !== 'admin') {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-rose-500 uppercase font-bold">SUPER ADMIN CLEARANCE REQUIRED</div>
        <h2 className="text-base font-bold text-neutral-100">{label} Access Restricted</h2>
        <p className="text-neutral-400">
          Multi-tenant directory governance, module controls, and database operations require signing in through the dedicated Super Admin login page.
        </p>
        <Link
          to="/login/admin"
          className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
        >
          Go to Super Admin Login
        </Link>
      </div>
    );
  }
  return <>{children}</>;
};

const IamAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, authSession, hasPermission } = useITSM();
  const allowed = role === 'admin' || authSession?.portalType === 'iam' || hasPermission('iam:manage');
  if (!allowed) {
    return (
      <div className="border border-neutral-800 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="text-[10px] text-amber-400 uppercase font-bold">IAM CLEARANCE REQUIRED</div>
        <h2 className="text-base font-bold text-neutral-100">IAM Portal Access Restricted</h2>
        <p className="text-neutral-400">
          Identity creation, Company ID bindings, and policy assignments require an IAM Operator, Super Admin, or an account granted iam:manage scope.
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

function MainApp() {
  const { authSession, role, activeTenant, isModuleEnabled, getPortalBranding } = useITSM();
  const location = useLocation();
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(true);

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
        <Route path="*" element={<Navigate to="/login" replace />} />
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col dot-matrix-bg selection:bg-rose-600 selection:text-white">
      <ServiceNowHeader
        onToggleNavigator={() => setIsNavigatorOpen(!isNavigatorOpen)}
        isNavigatorOpen={isNavigatorOpen}
      />

      {role === 'customer' && (
        <div className="bg-neutral-950 border-b border-neutral-800 px-4 py-2 flex flex-wrap items-center gap-4 font-mono text-xs">
          <Link
            to="/portal"
            className={location.pathname === '/portal' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}
          >
            Self-Service Portal
          </Link>
          {isModuleEnabled('status_page') && (
            <Link
              to="/status"
              className={location.pathname === '/status' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}
            >
              Service Status
            </Link>
          )}
          {isModuleEnabled('knowledge') && (
            <Link
              to="/knowledge"
              className={location.pathname === '/knowledge' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'}
            >
              Knowledge Bank
            </Link>
          )}
          <Link
            to="/portal/new"
            className={location.pathname === '/portal/new' ? 'text-rose-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'}
          >
            + Report Ticket
          </Link>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {role !== 'customer' && (
          <ServiceNowNavigator
            isOpen={isNavigatorOpen}
            onCloseMobile={() => {
              if (window.innerWidth < 768) setIsNavigatorOpen(false);
            }}
          />
        )}

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 max-w-full">
          <div className="max-w-7xl mx-auto">
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
                <Route path="/watchtower" element={<ModuleGate moduleId="watchtower" label="Watchtower"><WatchtowerPage /></ModuleGate>} />
                <Route path="/dashboard" element={<ModuleGate moduleId="dashboard" label="Service Desk"><OverviewDashboard /></ModuleGate>} />
                <Route path="/war-room" element={<ModuleGate moduleId="war_room" label="War Room"><WarRoomPage /></ModuleGate>} />
                <Route path="/checks" element={<ModuleGate moduleId="morning_checks" label="Morning Checks"><MorningChecksPage /></ModuleGate>} />
                <Route path="/status" element={<ModuleGate moduleId="status_page" label="Service Status"><ServiceStatusPage /></ModuleGate>} />
                <Route path="/calendar" element={<ModuleGate moduleId="calendar" label="Calendar & Rota"><CalendarRotaPage /></ModuleGate>} />

                {/* ITSM & Delivery */}
                <Route path="/incidents" element={<ModuleGate moduleId="incidents" label="Incidents"><IncidentModule /></ModuleGate>} />
                <Route path="/ticket-workflows" element={<ModuleGate moduleId="ticket_workflow" label="Ticket Workflow Management"><TicketWorkflowPage /></ModuleGate>} />
                <Route path="/changes" element={<ModuleGate moduleId="changes" label="Change (CAB)"><ChangeModule /></ModuleGate>} />
                <Route path="/requests" element={<ModuleGate moduleId="requests" label="Service Requests"><RequestModule /></ModuleGate>} />
                <Route path="/problems" element={<ModuleGate moduleId="problems" label="Problem Management"><ProblemModule /></ModuleGate>} />
                <Route path="/tasks" element={<ModuleGate moduleId="tasks" label="Tasks (Kanban)"><TasksKanbanPage /></ModuleGate>} />
                <Route path="/projects" element={<ModuleGate moduleId="projects" label="Projects Portfolio"><ProjectsPage /></ModuleGate>} />

                {/* CMDB, Assets & Vendors */}
                <Route path="/assets" element={<ModuleGate moduleId="assets" label="Assets Register"><AssetModule /></ModuleGate>} />
                <Route path="/cmdb/network-map" element={<ModuleGate moduleId="network_map" label="CMDB Network Map"><CmdbNetworkMapPage /></ModuleGate>} />
                <Route path="/inventory" element={<ModuleGate moduleId="inventory" label="Hardware Inventory"><InventoryModule /></ModuleGate>} />
                <Route path="/software" element={<ModuleGate moduleId="software" label="Software & Licences"><SoftwareInventoryPage /></ModuleGate>} />
                <Route path="/contracts" element={<ModuleGate moduleId="contracts" label="Contracts & RFP"><ContractsRfpPage /></ModuleGate>} />
                <Route path="/domains" element={<ModuleGate moduleId="domains" label="Domains & SSL"><DomainsRegisterPage /></ModuleGate>} />

                {/* Knowledge, Forms & LMS */}
                <Route path="/knowledge" element={<ModuleGate moduleId="knowledge" label="Knowledge Base"><KnowledgeBasePage /></ModuleGate>} />
                <Route path="/wiki" element={<ModuleGate moduleId="wiki" label="System Wiki"><SystemWikiPage /></ModuleGate>} />
                <Route path="/workflows" element={<ModuleGate moduleId="workflow_management" label="Workflow Management"><WorkflowManagementPage /></ModuleGate>} />
                <Route path="/process-mapper" element={<ModuleGate moduleId="process_mapper" label="Process Mapper"><ProcessMapperPage /></ModuleGate>} />
                <Route path="/forms-builder" element={<ModuleGate moduleId="custom_forms" label="Custom Forms Builder"><CustomFormsBuilderPage /></ModuleGate>} />
                <Route path="/lms" element={<ModuleGate moduleId="lms" label="LMS Training"><LmsPage /></ModuleGate>} />

                {/* Multi-Tenant Super Admin, IAM & Platform */}
                <Route path="/tenants" element={<AdminOnlyGate label="Tenant Directory"><TenantAdminPage /></AdminOnlyGate>} />
                <Route path="/system/modules" element={<AdminOnlyGate label="Module Availability"><ModuleControlsPage /></AdminOnlyGate>} />
                <Route path="/iam" element={<IamAccessGate><ModuleGate moduleId="iam" label="IAM Portal"><IamPortalPage /></ModuleGate></IamAccessGate>} />
                <Route path="/reports" element={<ModuleGate moduleId="reports" label="Reporting & Audit"><ReportsAuditPage /></ModuleGate>} />
                <Route path="/telephony" element={<ModuleGate moduleId="telephony" label="Telephony CTI"><TelephonyModule /></ModuleGate>} />
                <Route path="/billing" element={<ModuleGate moduleId="billing" label="Invoices & Billing"><BillingModule /></ModuleGate>} />
                <Route path="/database" element={<AdminOnlyGate label="Database & Sync"><DatabaseModule /></AdminOnlyGate>} />
                <Route path="/portal" element={<CustomerPortal />} />

                {/* Dedicated Form Pages */}
                <Route path="/incidents/new" element={<NewIncidentPage />} />
                <Route path="/changes/new" element={<NewChangePage />} />
                <Route path="/requests/new" element={<NewRequestPage />} />
                <Route path="/problems/new" element={<NewProblemPage />} />
                <Route path="/assets/new" element={<NewAssetPage />} />
                <Route path="/inventory/new" element={<NewInventoryPage />} />
                <Route path="/billing/new" element={<NewInvoicePage />} />
                <Route path="/portal/new" element={<NewPortalTicketPage />} />

                {/* Google Workspace Integrations */}
                <Route path="/workspace/forms" element={<ModuleGate moduleId="google_workspace" label="Google Forms"><GoogleFormsModule /></ModuleGate>} />
                <Route path="/workspace/chat" element={<ModuleGate moduleId="google_workspace" label="Google Chat"><GoogleChatModule /></ModuleGate>} />
                <Route path="/workspace/sheets" element={<ModuleGate moduleId="google_workspace" label="Google Sheets"><GoogleSheetsModule /></ModuleGate>} />
                <Route path="/workspace/drive" element={<ModuleGate moduleId="google_workspace" label="Google Drive"><GoogleDriveModule /></ModuleGate>} />

                <Route path="*" element={<Navigate to={authSession?.portalType === 'iam' ? '/iam' : '/watchtower'} replace />} />
              </Routes>
            )}
          </div>
        </main>
      </div>

      {/* Platform Footer — Always preserves Powered by Scribble IT even when tenant customizes portal name */}
      <footer className="border-t border-neutral-900 bg-neutral-950/90 py-2.5 px-4 z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-neutral-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-200 font-bold">{activeBrand.portalName}</span>
            <span aria-hidden="true">·</span>
            <span>{activeTenant.name}</span>
            {activeTenant.companyCode && (
              <>
                <span aria-hidden="true">·</span>
                <span>{activeTenant.companyCode}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span className="text-neutral-300 font-bold">Powered by Scribble IT</span>
            <span aria-hidden="true">·</span>
            <span>Njure Tech</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ITSMProvider>
      <HashRouter>
        <MainApp />
      </HashRouter>
      <ToastViewport />
    </ITSMProvider>
  );
}

