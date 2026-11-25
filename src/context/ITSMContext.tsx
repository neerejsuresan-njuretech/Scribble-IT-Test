import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Incident, ServiceRequest, Problem, ChangeRequest, Asset,
  InventoryItem, TelephonyCall, Invoice, Role, IncidentStatus,
  ChangeStatus, Tenant, FreeITSMModuleId, SoftwareLicense,
  TaskItem, TaskColumn, ProjectItem, ProjectStage, KnowledgeArticle,
  ContractRecord, DomainRecord, ServiceStatusComponent, ComponentHealth,
  MorningCheckRun, MorningCheckItem, CalendarEvent, WarRoomSession,
  LmsCourse, WikiPage, ProcessMap, ProcessNodeType, CustomFormDefinition, CmdbRelation,
  AuditLogEntry, AuthPortalType, AuthAccount, AuthSession,
  ManagedDeviceTrust, DeviceEnrollmentCode, RequestApproval, CabVote,
  WorkflowDefinition, TicketWorkflowRule,
  IamPolicy, IamPermissionScope, CustomPortalKey, PortalBrandConfig,
  WorkflowRunStepTrace, ToastMessage, ThemeMode,
  TelephonyProviderConfig, TelephonyProviderType
} from '../types/itsm';
import {
  DEFAULT_BLANK_TENANT,
  createAllEnabledModules,
  getDefaultTenantBranding
} from '../data/freeitsmSeedData';
import {
  generateEnterpriseSeedBundle,
  DEFAULT_TEST_ENV_ACCOUNTS,
  CORE_IAM_POLICIES,
} from '../data/enterpriseSeedGenerator';
import { getModuleLabel } from '../data/workflowCatalog';
import { googleSignIn, logout as firebaseLogout, initAuth } from '../lib/firebase';
import {
  ensureWorkspaceRoot,
  upsertTenantInCloud,
  upsertIncidentInCloud,
  upsertRequestInCloud,
  upsertModuleBucketInCloud,
  pushFullWorkspaceSnapshotToCloud,
  subscribeWorkspace,
  clearKnownCloudDocPaths,
  type CloudWorkspaceSnapshot,
} from '../services/firestoreSync';
import { User } from 'firebase/auth';
import {
  authApi,
  clearAuthTokens,
  cmdbApi,
  getAccessToken,
  isBackendApiConfigured,
  itsmApi,
  mapAssetDto,
  mapChangeDto,
  mapIncidentDto,
  mapProblemDto,
  mapServiceRequestDto,
} from '../services/api';
import { BackendSyncState, useBackendSyncBridge } from '../hooks/useBackendSyncBridge';

export type CloudSyncStatus = 'disconnected' | 'connecting' | 'synced' | 'syncing' | 'error';

interface ITSMContextType {
  // Multi-Tenant Architecture
  tenants: Tenant[];
  activeTenantId: string;
  activeTenant: Tenant;
  switchTenant: (tenantId: string) => void;
  createTenant: (data: Partial<Tenant>) => Tenant;
  updateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
  toggleTenantModule: (tenantId: string, moduleId: FreeITSMModuleId) => void;
  isModuleEnabled: (moduleId: FreeITSMModuleId) => boolean;
  updateTenantPortalBranding: (tenantId: string, portalKey: CustomPortalKey, updates: Partial<PortalBrandConfig>) => void;
  applyCompanyLogoToAllPortals: (tenantId: string, logoDataUrl: string) => void;
  getPortalBranding: (portalKey: CustomPortalKey) => PortalBrandConfig;

  role: Role;
  setRole: (role: Role) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: { name: string; email: string; department: string; phone: string };

  // Portal Auth, Corporate Clearance & IAM-Verified Company Device SSO
  authSession: AuthSession | null;
  authAccounts: AuthAccount[];
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  managedDevice: ManagedDeviceTrust | null;
  isManagedDeviceVerified: boolean;
  deviceEnrollmentCodes: DeviceEnrollmentCode[];
  enrolledDevices: ManagedDeviceTrust[];
  registerAccount: (portalType: AuthPortalType, data: { name: string; email: string; password: string; department?: string }) => { ok: boolean; error?: string };
  loginWithCredentials: (portalType: AuthPortalType, email: string, password: string) => { ok: boolean; error?: string };
  loginAsTestAccount: (portalType: AuthPortalType) => void;
  generateDeviceEnrollmentCode: (options: {
    tenantId?: string;
    assignedEmail?: string;
    targetHostname?: string;
    mdmProvider?: string;
    validHours?: number;
  }) => { ok: boolean; record?: DeviceEnrollmentCode; error?: string };
  revokeDeviceEnrollmentCode: (id: string) => { ok: boolean; error?: string };
  revokeEnrolledDevice: (deviceId: string) => { ok: boolean; error?: string };
  enrollCompanyDevice: (verificationCode: string, hostname?: string, mdmProvider?: string, employeeEmail?: string) => { ok: boolean; device?: ManagedDeviceTrust; error?: string };
  unenrollCompanyDevice: () => void;
  loginEmployeeDeviceSso: (email?: string, name?: string) => { ok: boolean; error?: string };
  loginViaGooglePortal: (portalType: AuthPortalType) => Promise<{ ok: boolean; error?: string }>;
  logoutSession: () => Promise<void>;

  // IAM Portal (Identities, Company IDs, Roles & Policies)
  iamPolicies: IamPolicy[];
  createIamIdentity: (data: {
    id?: string;
    name: string;
    email: string;
    password: string;
    portalType: AuthPortalType;
    role: Role;
    companyId: string;
    tenantId?: string;
    department?: string;
    policyIds?: string[];
    mfaEnabled?: boolean;
  }) => { ok: boolean; account?: AuthAccount; error?: string };
  updateIamIdentity: (id: string, updates: Partial<AuthAccount>) => void;
  deleteIamIdentity: (id: string) => void;
  createIamPolicy: (policy: Partial<IamPolicy>) => IamPolicy;
  deleteIamPolicy: (id: string) => void;
  hasPermission: (scope: IamPermissionScope) => boolean;

  // Google Auth, Workspace & Centralized Firestore Cloud Sync
  googleUser: User | null;
  googleToken: string | null;
  loginWithGoogle: () => Promise<boolean>;
  loginWithGooglePortal: () => Promise<boolean>;
  logoutGoogle: () => Promise<void>;
  isFirebaseConnected: boolean;
  cloudSyncStatus: CloudSyncStatus;
  lastCloudSyncAt: string | null;
  cloudSyncError: string | null;
  forceCloudSync: () => Promise<void>;

  // Scribble-IT 2.0 FastAPI + PostgreSQL Backend Bridge
  backendSyncStatus: BackendSyncState;
  lastBackendSyncAt: string | null;
  backendSyncError: string | null;
  isBackendApiMode: boolean;
  syncWithBackend: () => Promise<boolean>;
  loginWithBackendApi: (
    portalType: AuthPortalType,
    email: string,
    password: string,
    organizationId?: string
  ) => Promise<{ ok: boolean; error?: string }>;

  // Tenant-Isolated Collections
  incidents: Incident[];
  requests: ServiceRequest[];
  problems: Problem[];
  changes: ChangeRequest[];
  assets: Asset[];
  inventory: InventoryItem[];
  calls: TelephonyCall[];
  invoices: Invoice[];
  activeCall: TelephonyCall | null;

  // FreeITSM Extended Tenant-Isolated Collections
  softwareLicenses: SoftwareLicense[];
  tasks: TaskItem[];
  projects: ProjectItem[];
  kbArticles: KnowledgeArticle[];
  contracts: ContractRecord[];
  domains: DomainRecord[];
  statusComponents: ServiceStatusComponent[];
  morningChecks: MorningCheckRun[];
  calendarEvents: CalendarEvent[];
  warRooms: WarRoomSession[];
  lmsCourses: LmsCourse[];
  wikiPages: WikiPage[];
  processMaps: ProcessMap[];
  customForms: CustomFormDefinition[];
  cmdbRelations: CmdbRelation[];
  auditLogs: AuditLogEntry[];
  workflows: WorkflowDefinition[];
  ticketWorkflows: TicketWorkflowRule[];

  // Core CRUD & Operations
  createIncident: (incident: Partial<Incident>) => Incident;
  updateIncidentStatus: (id: string, status: IncidentStatus, note?: string, resolutionNotes?: string, isWorkNote?: boolean) => void;
  assignIncident: (id: string, assignee: string) => void;
  logIncidentTime: (id: string, mins: number) => void;
  setIncidentCsat: (id: string, score: number) => void;
  simulateEmailToTicket: (fromEmail: string, subject: string, body: string) => Incident;

  createServiceRequest: (req: Partial<ServiceRequest>) => ServiceRequest;
  canApproveRequestStage: (approval: RequestApproval, requesterEmail?: string) => { allowed: boolean; reason: string; isSuperAdminOverride?: boolean };
  approveRequestStage: (requestId: string, roleName: string, approver: string, status: 'approved' | 'rejected', notes?: string) => { ok: boolean; error?: string };
  reassignRequestApprover: (requestId: string, roleName: string, accountId: string) => { ok: boolean; error?: string };
  createProblem: (prob: Partial<Problem>) => Problem;
  updateProblem: (id: string, updates: Partial<Problem>) => void;
  createChangeRequest: (change: Partial<ChangeRequest>) => ChangeRequest;
  canVoteCab: (vote: CabVote) => { allowed: boolean; reason: string; isSuperAdminOverride?: boolean };
  voteCab: (changeId: string, member: string, roleName: string, vote: 'approved' | 'rejected', notes?: string) => { ok: boolean; error?: string };
  reassignCabVoter: (changeId: string, roleName: string, accountId: string) => { ok: boolean; error?: string };
  updateChangeStatus: (id: string, status: ChangeStatus) => void;
  addRecordActivity: (recordId: string, recordType: 'incident' | 'change', note: string, type: 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit', action?: string, fieldChanges?: { field: string; from: string; to: string }[]) => void;

  createAsset: (asset: Partial<Asset>) => Asset;
  updateAssetStatus: (id: string, status: Asset['status'], assignedTo?: string) => void;
  addCmdbRelation: (rel: Partial<CmdbRelation>) => CmdbRelation;
  removeCmdbRelation: (id: string) => void;

  updateInventoryQuantity: (id: string, delta: number) => void;
  createInventoryItem: (item: Partial<InventoryItem>) => InventoryItem;
  createSoftwareLicense: (sw: Partial<SoftwareLicense>) => SoftwareLicense;
  adjustSoftwareSeats: (id: string, delta: number) => void;

  // FreeITSM Tasks, Projects, KB, Contracts, Domains, Status, Checks, Calendar, War Room, LMS, Wiki, Process, Forms
  createTask: (task: Partial<TaskItem>) => TaskItem;
  moveTaskColumn: (id: string, column: TaskColumn) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  logTaskTime: (taskId: string, mins: number) => void;

  createProject: (proj: Partial<ProjectItem>) => ProjectItem;
  updateProjectStage: (id: string, stage: ProjectStage, progressPct?: number) => void;

  createKbArticle: (article: Partial<KnowledgeArticle>) => KnowledgeArticle;
  voteKbHelpful: (id: string) => void;

  createContract: (contract: Partial<ContractRecord>) => ContractRecord;
  updateContractStatus: (id: string, status: ContractRecord['status'], rfpNotes?: string) => void;

  createDomainRecord: (domain: Partial<DomainRecord>) => DomainRecord;
  updateComponentHealth: (id: string, status: ComponentHealth, autoOpenIncident?: boolean) => void;
  submitMorningCheckRun: (items: MorningCheckItem[]) => MorningCheckRun;
  createCalendarEvent: (evt: Partial<CalendarEvent>) => CalendarEvent;

  createWarRoom: (incidentId: string, title: string, severity: 'P1' | 'P2') => WarRoomSession;
  postWarRoomMessage: (sessionId: string, message: string) => void;
  toggleWarRoomChecklist: (sessionId: string, checkId: string) => void;
  closeWarRoom: (sessionId: string) => void;

  toggleLmsLesson: (courseId: string, lessonId: string) => void;
  completeLmsQuiz: (courseId: string, scorePct: number) => void;

  createWikiPage: (page: Partial<WikiPage>) => WikiPage;
  updateWikiPage: (id: string, content: string) => void;

  createProcessMap: (proc: Partial<ProcessMap>) => ProcessMap;
  updateProcessMap: (id: string, updates: Partial<ProcessMap>) => void;
  deleteProcessMap: (id: string) => void;
  addProcessNode: (mapId: string, label: string, type: Exclude<ProcessNodeType, 'start' | 'end'>, roleLabel: string) => void;

  createCustomForm: (form: Partial<CustomFormDefinition>) => CustomFormDefinition;
  toggleFormPublish: (id: string) => void;
  submitCustomFormToRequest: (formId: string, values: Record<string, string>) => ServiceRequest;

  // Workflow Management & Ticket Workflow Management
  createWorkflow: (wf: Partial<WorkflowDefinition>) => WorkflowDefinition;
  updateWorkflow: (id: string, updates: Partial<WorkflowDefinition>) => void;
  toggleWorkflowStatus: (id: string, status: WorkflowDefinition['status']) => void;
  runWorkflowExecution: (id: string) => void;
  deleteWorkflow: (id: string) => void;

  createTicketWorkflow: (rule: Partial<TicketWorkflowRule>) => TicketWorkflowRule;
  toggleTicketWorkflow: (id: string) => void;
  deleteTicketWorkflow: (id: string) => void;

  // Telephony CTI & Multi-Provider Bridge
  telephonyConfig: TelephonyProviderConfig;
  updateTelephonyConfig: (updates: Partial<TelephonyProviderConfig>) => void;
  startTelephonyCall: (number: string, name?: string, providerMeta?: { providerType?: TelephonyProviderType; providerLabel?: string; initialNote?: string }) => TelephonyCall;
  appendCallNote: (callId: string, note: string) => void;
  simulateIncomingCall: () => void;
  answerIncomingCall: () => void;
  endTelephonyCall: () => void;
  toggleHoldCall: () => void;
  popTicketFromCall: (callId: string) => Incident;

  // Billing
  payInvoice: (invoiceId: string, method: Invoice['paymentMethod']) => void;
  createInvoice: (inv: Partial<Invoice>) => Invoice;

  // Global Toast Notifications
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;

  // Theme (Dot-Matrix Dark / Light Mode)
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;

  // Global Multi-Company Aggregate Totals (for Overview Website & Database Dashboard)
  workspaceTotals: {
    companies: number;
    companyLogos: number;
    users: number;
    policies: number;
    kbArticles: number;
    wikiPages: number;
    incidents: number;
    requests: number;
    problems: number;
    changes: number;
    assets: number;
    tasks: number;
    calls: number;
  };

  // Data backup, seed & reset
  loadEnterpriseSeedData: () => void;
  resetDatabase: () => void;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (data: string) => boolean;
}

const STORAGE_KEY = 'SCRIBBLE_ITSM_DB_V5_ENTERPRISE';

function loadState<T>(suffix: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}_${suffix}`);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function safeSaveLocal(suffix: string, value: unknown): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${suffix}`, JSON.stringify(value));
  } catch (e) {
    console.warn(`LocalStorage save skipped for ${suffix}:`, e);
  }
}

const ITSMContext = createContext<ITSMContextType | undefined>(undefined);

const DEFAULT_IAM_POLICIES: IamPolicy[] = CORE_IAM_POLICIES;

export const ITSMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSeed = useMemo(() => generateEnterpriseSeedBundle(), []);

  // Authentication, Portal Accounts & Company Device SSO Trust
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadState('AUTH_SESSION', null));
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>(() => {
    const saved = loadState<AuthAccount[]>('AUTH_ACCOUNTS', []);
    if (saved.length === 0) return initialSeed.authAccounts;
    const hasIamTest = saved.some(a => a.portalType === 'iam');
    return hasIamTest ? saved : [...saved, DEFAULT_TEST_ENV_ACCOUNTS[2]];
  });
  const [allIamPolicies, setAllIamPolicies] = useState<IamPolicy[]>(() => {
    const saved = loadState<IamPolicy[]>('IAM_POLICIES', []);
    return saved.length > 0 ? saved : initialSeed.iamPolicies;
  });
  const [managedDevice, setManagedDevice] = useState<ManagedDeviceTrust | null>(() => loadState('MANAGED_DEVICE', null));
  const [deviceEnrollmentCodes, setDeviceEnrollmentCodes] = useState<DeviceEnrollmentCode[]>(() =>
    loadState('DEVICE_ENROLLMENT_CODES', [])
  );
  const [enrolledDevices, setEnrolledDevices] = useState<ManagedDeviceTrust[]>(() =>
    loadState('ENROLLED_DEVICES', [])
  );

  const role: Role = authSession?.isAuthenticated ? authSession.role : 'customer';
  const isSuperAdmin = Boolean(
    authSession?.isAuthenticated && authSession.portalType === 'super_admin' && authSession.role === 'admin'
  );
  const isIamPortal = Boolean(authSession?.isAuthenticated && authSession.portalType === 'iam');

  const isManagedDeviceVerified = useMemo(() => {
    if (!managedDevice || !managedDevice.verifiedByIam || managedDevice.status === 'revoked') {
      return false;
    }
    const registryRecord = enrolledDevices.find(d => d.deviceId === managedDevice.deviceId);
    if (registryRecord && registryRecord.status === 'revoked') {
      return false;
    }
    return true;
  }, [managedDevice, enrolledDevices]);

  const setRole = (nextRole: Role) => {
    if (!authSession) return;
    if (!isSuperAdmin && nextRole === 'admin') {
      showToast({
        variant: 'error',
        title: 'Privilege Escalation Blocked',
        description: 'Only authenticated Super Admin Portal sessions can hold Super Admin privileges.',
      });
      return;
    }
    const portalType: AuthPortalType =
      nextRole === 'admin' ? 'super_admin' : nextRole === 'technician' ? 'employee' : 'end_user';
    setAuthSession({ ...authSession, role: nextRole, portalType });
  };
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Theme Mode (Dot-Matrix Dark / Light) synced with root <html> class
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = loadState<string>('THEME', 'dark');
    return saved === 'light' ? 'light' : 'dark';
  });

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    }
    try {
      localStorage.setItem(`${STORAGE_KEY}_THEME`, JSON.stringify(theme));
    } catch {
      // ignore storage quota errors
    }
  }, [theme]);

  // Global Toast Notification System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    Object.values(toastTimersRef.current).forEach(clearTimeout);
    toastTimersRef.current = {};
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id' | 'createdAt'>): string => {
      const id = `TST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const durationMs = toast.durationMs ?? (toast.variant === 'error' || toast.variant === 'warning' ? 5500 : 4000);
      const entry: ToastMessage = {
        ...toast,
        id,
        durationMs,
        createdAt: new Date().toISOString()
      };
      setToasts(prev => [entry, ...prev].slice(0, 5));
      if (durationMs > 0) {
        toastTimersRef.current[id] = setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // Multi-Tenant State (Preloaded with 8 Enterprise Companies & Custom Logos)
  const [tenants, setTenants] = useState<Tenant[]>(() => loadState('TENANTS', initialSeed.tenants));
  const [activeTenantId, setActiveTenantId] = useState<string>(() => loadState('ACTIVE_TENANT', initialSeed.tenants[0].id));

  const activeTenant = useMemo(
    () => tenants.find(t => t.id === activeTenantId) || tenants[0],
    [tenants, activeTenantId]
  );

  // Google / Firebase Auth & Cloud Sync Status
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('disconnected');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const isFirebaseConnected = Boolean(googleUser && cloudSyncStatus !== 'error');

  const cloudReadyUidRef = useRef<string | null>(null);
  const syncedHashesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token || null);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const performGoogleSignInWithFallback = async (): Promise<{ user: User; accessToken: string }> => {
    try {
      return await googleSignIn(true);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw err;
      }
      // Fallback to basic Google profile sign-in so Cloud DB sync still succeeds even if Workspace scopes are blocked
      return await googleSignIn(false);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const res = await performGoogleSignInWithFallback();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
      showToast({
        variant: 'success',
        title: 'Cloud Database Connected',
        description: `Signed in as ${res.user.email || res.user.displayName}. Syncing workspace across devices.`,
      });
      return true;
    } catch (e: any) {
      console.error('Login failed:', e);
      showToast({
        variant: 'error',
        title: 'Google Sign-In Failed',
        description: e?.message || 'Unable to sign in with Google.',
      });
      return false;
    }
  };

  const logoutGoogle = async () => {
    await firebaseLogout();
    cloudReadyUidRef.current = null;
    syncedHashesRef.current.clear();
    clearKnownCloudDocPaths();
    setGoogleUser(null);
    setGoogleToken(null);
    setCloudSyncStatus('disconnected');
    setCloudSyncError(null);
  };

  const portalToRole = (p: AuthPortalType): Role =>
    p === 'super_admin' ? 'admin' : p === 'end_user' ? 'customer' : 'technician';

  const registerAccount = (
    portalType: AuthPortalType,
    data: { name: string; email: string; password: string; department?: string }
  ): { ok: boolean; error?: string } => {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!cleanEmail || !data.password || !data.name.trim()) {
      const msg = 'Name, email, and password are required.';
      showToast({ variant: 'error', title: 'Registration Failed', description: msg });
      return { ok: false, error: msg };
    }
    if (authAccounts.some(a => a.email === cleanEmail && a.portalType === portalType)) {
      const msg = 'An account with this email already exists for this portal.';
      showToast({ variant: 'error', title: 'Registration Failed', description: msg });
      return { ok: false, error: msg };
    }
    const targetRole = portalToRole(portalType);
    const dept = data.department?.trim() || (portalType === 'end_user' ? 'Self-Service' : portalType === 'iam' ? 'Identity & Access' : 'IT Operations');
    const defaultPolicyId =
      portalType === 'super_admin'
        ? 'POL-SUPER-ADMIN'
        : portalType === 'iam'
        ? 'POL-IAM-ADMIN'
        : portalType === 'employee'
        ? 'POL-EMPLOYEE-OPS'
        : 'POL-END-USER';
    const newAccount: AuthAccount = {
      id: `USR-${Date.now()}`,
      portalType,
      role: targetRole,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password,
      department: dept,
      companyId: activeTenant.companyCode || `COMP-${activeTenant.slug.toUpperCase()}`,
      tenantId: activeTenant.id,
      policyIds: [defaultPolicyId],
      status: 'active',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    setAuthAccounts(prev => [newAccount, ...prev]);
    setAuthSession({
      isAuthenticated: true,
      portalType,
      role: targetRole,
      name: newAccount.name,
      email: newAccount.email,
      department: newAccount.department,
      authMethod:
        portalType === 'super_admin'
          ? 'admin_credentials'
          : portalType === 'iam'
          ? 'iam_credentials'
          : portalType === 'employee'
          ? 'employee_password'
          : 'portal_login',
      deviceManaged: isManagedDeviceVerified,
      deviceId: isManagedDeviceVerified ? managedDevice?.deviceId : undefined,
      companyId: newAccount.companyId,
      policyIds: newAccount.policyIds,
      authenticatedAt: new Date().toISOString()
    });
    return { ok: true };
  };

  const loginWithCredentials = (
    portalType: AuthPortalType,
    email: string,
    password: string
  ): { ok: boolean; error?: string } => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      const msg = 'Email and password are required.';
      showToast({ variant: 'error', title: 'Sign-In Error', description: msg });
      return { ok: false, error: msg };
    }
    const matched = authAccounts.find(
      a =>
        a.email === cleanEmail &&
        (a.portalType === portalType || (portalType === 'iam' && a.portalType === 'super_admin'))
    );
    if (!matched) {
      const msg = 'Account not found for this portal. Verify your portal or contact IAM Team.';
      showToast({ variant: 'error', title: 'Authentication Failed', description: msg });
      return { ok: false, error: msg };
    }
    if (matched.status === 'suspended') {
      const msg = 'This identity has been suspended in the IAM Portal.';
      showToast({ variant: 'error', title: 'Access Suspended', description: msg });
      return { ok: false, error: msg };
    }
    if (matched.password !== password) {
      const msg = 'Invalid password.';
      showToast({ variant: 'error', title: 'Authentication Failed', description: msg });
      return { ok: false, error: msg };
    }

    // Enforce Corporate SSO-Only IAM Policy for Employee accounts on unmanaged devices
    if (portalType === 'employee') {
      const accountPolicies = allIamPolicies.filter(p => (matched.policyIds || []).includes(p.id));
      const requiresSsoOnly = accountPolicies.some(p => p.ssoOnly);
      if (requiresSsoOnly && !isManagedDeviceVerified) {
        const msg =
          'Corporate Policy Enforcement: Your identity requires an IAM-verified Company Managed Device & SSO. Request a unique enrollment code from the IAM Team.';
        showToast({ variant: 'error', title: 'Managed Device & SSO Required', description: msg });
        return { ok: false, error: msg };
      }
    }

    if (matched.tenantId && tenants.some(t => t.id === matched.tenantId)) {
      setActiveTenantId(matched.tenantId);
    }
    setAuthSession({
      isAuthenticated: true,
      portalType: matched.portalType === 'super_admin' && portalType === 'iam' ? 'iam' : portalType,
      role: matched.role,
      name: matched.name,
      email: matched.email,
      department: matched.department,
      authMethod:
        portalType === 'super_admin'
          ? 'admin_credentials'
          : portalType === 'iam'
          ? 'iam_credentials'
          : portalType === 'employee'
          ? 'employee_password'
          : 'portal_login',
      deviceManaged: isManagedDeviceVerified,
      deviceId: isManagedDeviceVerified ? managedDevice?.deviceId : undefined,
      companyId: matched.companyId,
      policyIds: matched.policyIds,
      authenticatedAt: new Date().toISOString()
    });
    return { ok: true };
  };

  const loginAsTestAccount = (portalType: AuthPortalType) => {
    const preset =
      DEFAULT_TEST_ENV_ACCOUNTS.find(a => a.portalType === portalType) ||
      DEFAULT_TEST_ENV_ACCOUNTS[0];

    setAuthAccounts(prev =>
      prev.some(a => a.id === preset.id || (a.email === preset.email && a.portalType === portalType))
        ? prev
        : [preset, ...prev]
    );

    if (preset.tenantId && tenants.some(t => t.id === preset.tenantId)) {
      setActiveTenantId(preset.tenantId);
    }

    setAuthSession({
      isAuthenticated: true,
      portalType,
      role: preset.role,
      name: preset.name,
      email: preset.email,
      department: preset.department,
      authMethod:
        portalType === 'super_admin'
          ? 'admin_credentials'
          : portalType === 'iam'
          ? 'iam_credentials'
          : portalType === 'employee'
          ? 'employee_password'
          : 'portal_login',
      deviceManaged: isManagedDeviceVerified,
      deviceId: isManagedDeviceVerified ? managedDevice?.deviceId : undefined,
      companyId: preset.companyId,
      policyIds: preset.policyIds,
      authenticatedAt: new Date().toISOString()
    });
  };

  const generateUniqueEnrollmentCodeString = (): string => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomBlock = (len: number) => {
      let out = '';
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        for (let i = 0; i < len; i++) {
          out += alphabet[bytes[i] % alphabet.length];
        }
      } else {
        for (let i = 0; i < len; i++) {
          out += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
      return out;
    };
    let candidate = `IAM-${randomBlock(4)}-${randomBlock(4)}`;
    let guard = 0;
    while (deviceEnrollmentCodes.some(c => c.code === candidate) && guard < 20) {
      candidate = `IAM-${randomBlock(4)}-${randomBlock(4)}`;
      guard++;
    }
    return candidate;
  };

  const generateDeviceEnrollmentCode: ITSMContextType['generateDeviceEnrollmentCode'] = options => {
    if (!isIamPortal) {
      const err = 'Device enrollment verification codes can ONLY be generated through the IAM Portal.';
      showToast({ variant: 'error', title: 'IAM Portal Exclusive Action', description: err });
      return { ok: false, error: err };
    }
    const targetTenant = tenants.find(t => t.id === options.tenantId) || activeTenant;
    const cleanEmail = options.assignedEmail?.trim().toLowerCase() || undefined;
    const matchedEmployee = cleanEmail
      ? authAccounts.find(a => a.email.toLowerCase() === cleanEmail)
      : undefined;
    const validHours = Math.max(1, Math.min(168, options.validHours || 24));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validHours * 3600 * 1000).toISOString();

    const record: DeviceEnrollmentCode = {
      id: `ENRL-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      code: generateUniqueEnrollmentCodeString(),
      tenantId: targetTenant.id,
      companyCode: targetTenant.companyCode || `COMP-${targetTenant.slug.toUpperCase()}`,
      assignedEmail: cleanEmail,
      assignedEmployeeName: matchedEmployee?.name,
      targetHostname: options.targetHostname?.trim() || undefined,
      mdmProvider: options.mdmProvider?.trim() || 'Njure Endpoint Trust MDM',
      status: 'active',
      issuedBy: authSession?.name || 'IAM Officer',
      issuedByEmail: authSession?.email || 'iam@njuretech.io',
      createdAt: now.toISOString(),
      expiresAt,
    };

    setDeviceEnrollmentCodes(prev => [record, ...prev]);
    setAllAuditLogs(prev => [
      {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 99)}`,
        tenantId: targetTenant.id,
        timestamp: now.toISOString(),
        actor: authSession?.name || 'IAM Officer',
        module: 'IAM Device Trust',
        action: 'GENERATE_ENROLLMENT_CODE',
        targetId: record.code,
        detail: `Issued single-use device enrollment code (${validHours}h TTL)${cleanEmail ? ` bound to ${cleanEmail}` : ' (company-wide)'}`,
      },
      ...prev,
    ].slice(0, 200));
    showToast({
      variant: 'success',
      title: `Enrollment Code Issued: ${record.code}`,
      description: `Valid for ${validHours}h · ${targetTenant.name}${cleanEmail ? ` · Bound to ${cleanEmail}` : ''}`,
    });
    return { ok: true, record };
  };

  const revokeDeviceEnrollmentCode = (id: string): { ok: boolean; error?: string } => {
    if (!isIamPortal) {
      const err = 'Only the IAM Portal can revoke device enrollment verification codes.';
      showToast({ variant: 'error', title: 'IAM Portal Exclusive Action', description: err });
      return { ok: false, error: err };
    }
    const target = deviceEnrollmentCodes.find(c => c.id === id);
    if (!target) return { ok: false, error: 'Enrollment code not found.' };
    setDeviceEnrollmentCodes(prev =>
      prev.map(c => (c.id === id ? { ...c, status: 'revoked' } : c))
    );
    setAllAuditLogs(prev => [
      {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 99)}`,
        tenantId: target.tenantId,
        timestamp: new Date().toISOString(),
        actor: authSession?.name || 'IAM Officer',
        module: 'IAM Device Trust',
        action: 'REVOKE_ENROLLMENT_CODE',
        targetId: target.code,
        detail: 'Revoked pending device enrollment verification code',
      },
      ...prev,
    ].slice(0, 200));
    showToast({ variant: 'warning', title: `Code Revoked: ${target.code}` });
    return { ok: true };
  };

  const revokeEnrolledDevice = (deviceId: string): { ok: boolean; error?: string } => {
    if (!isIamPortal) {
      const err = 'Only the IAM Portal can revoke corporate MDM device trust.';
      showToast({ variant: 'error', title: 'IAM Portal Exclusive Action', description: err });
      return { ok: false, error: err };
    }
    const target = enrolledDevices.find(d => d.deviceId === deviceId);
    setEnrolledDevices(prev =>
      prev.map(d => (d.deviceId === deviceId ? { ...d, status: 'revoked' } : d))
    );
    if (managedDevice?.deviceId === deviceId) {
      setManagedDevice(null);
    }
    setAllAuditLogs(prev => [
      {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 99)}`,
        tenantId: target?.tenantId || activeTenant.id,
        timestamp: new Date().toISOString(),
        actor: authSession?.name || 'IAM Officer',
        module: 'IAM Device Trust',
        action: 'REVOKE_DEVICE_TRUST',
        targetId: deviceId,
        detail: `Revoked corporate MDM certificate & SSO trust for ${target?.hostname || deviceId}`,
      },
      ...prev,
    ].slice(0, 200));
    showToast({
      variant: 'warning',
      title: `Device Trust Revoked: ${deviceId}`,
      description: 'SSO access has been disabled for this workstation.',
    });
    return { ok: true };
  };

  const enrollCompanyDevice = (
    verificationCode: string,
    hostname?: string,
    mdmProvider?: string,
    employeeEmail?: string
  ): { ok: boolean; device?: ManagedDeviceTrust; error?: string } => {
    const cleanCode = verificationCode.trim().toUpperCase();
    if (!cleanCode) {
      const err = 'An IAM-issued Device Enrollment Verification Code (e.g. IAM-XXXX-XXXX) is mandatory.';
      showToast({ variant: 'error', title: 'Verification Code Required', description: err });
      return { ok: false, error: err };
    }

    const matchedCode = deviceEnrollmentCodes.find(c => c.code.toUpperCase() === cleanCode);
    if (!matchedCode) {
      const err = 'Invalid enrollment verification code. Request a valid unique code from the IAM Team via the IAM Portal.';
      showToast({ variant: 'error', title: 'Enrollment Denied', description: err });
      return { ok: false, error: err };
    }

    if (matchedCode.status === 'used') {
      const err = `Code ${matchedCode.code} has already been redeemed on workstation ${matchedCode.usedByHostname || matchedCode.usedByDeviceId || 'another device'}.`;
      showToast({ variant: 'error', title: 'Code Already Used', description: err });
      return { ok: false, error: err };
    }

    if (matchedCode.status === 'revoked') {
      const err = `Code ${matchedCode.code} was revoked by the IAM Team.`;
      showToast({ variant: 'error', title: 'Code Revoked', description: err });
      return { ok: false, error: err };
    }

    if (matchedCode.status === 'expired' || new Date(matchedCode.expiresAt).getTime() <= Date.now()) {
      setDeviceEnrollmentCodes(prev =>
        prev.map(c => (c.id === matchedCode.id ? { ...c, status: 'expired' } : c))
      );
      const err = `Code ${matchedCode.code} has expired. Contact the IAM Team for a new verification code.`;
      showToast({ variant: 'error', title: 'Code Expired', description: err });
      return { ok: false, error: err };
    }

    const cleanEmployeeEmail = employeeEmail?.trim().toLowerCase() || '';
    if (matchedCode.assignedEmail) {
      if (!cleanEmployeeEmail) {
        const err = 'This IAM enrollment code is bound to a specific corporate employee email. Enter your corporate email to verify.';
        showToast({ variant: 'error', title: 'Employee Email Required', description: err });
        return { ok: false, error: err };
      }
      if (cleanEmployeeEmail !== matchedCode.assignedEmail.toLowerCase()) {
        const err = 'Corporate email does not match the identity bound to this IAM enrollment verification code.';
        showToast({ variant: 'error', title: 'Identity Mismatch', description: err });
        return { ok: false, error: err };
      }
    }

    const targetTenant = tenants.find(t => t.id === matchedCode.tenantId) || activeTenant;
    const ua = typeof navigator !== 'undefined' ? navigator.platform || 'Managed Workstation' : 'Managed Workstation';
    const resolvedHostname =
      hostname?.trim() ||
      matchedCode.targetHostname ||
      `${targetTenant.slug.toUpperCase()}-WS-${Math.floor(100 + Math.random() * 899)}`;
    const nowIso = new Date().toISOString();

    const trust: ManagedDeviceTrust = {
      deviceId: `DEV-${Math.floor(10000 + Math.random() * 89999)}`,
      hostname: resolvedHostname,
      osPlatform: ua,
      mdmProvider: mdmProvider?.trim() || matchedCode.mdmProvider || 'Njure Endpoint Trust MDM',
      domain: targetTenant.domain,
      tenantId: targetTenant.id,
      companyCode: matchedCode.companyCode,
      enrollmentCode: matchedCode.code,
      enrolledByEmail: matchedCode.assignedEmail || cleanEmployeeEmail || undefined,
      verifiedByIam: true,
      status: 'active',
      enrolledAt: nowIso,
      certificateThumbprint: `SHA256:${Math.random().toString(16).slice(2, 10).toUpperCase()}${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    };

    setDeviceEnrollmentCodes(prev =>
      prev.map(c =>
        c.id === matchedCode.id
          ? {
              ...c,
              status: 'used',
              usedAt: nowIso,
              usedByDeviceId: trust.deviceId,
              usedByHostname: trust.hostname,
            }
          : c
      )
    );
    setEnrolledDevices(prev => [trust, ...prev]);
    setManagedDevice(trust);
    setActiveTenantId(targetTenant.id);
    setAllAuditLogs(prev => [
      {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 99)}`,
        tenantId: targetTenant.id,
        timestamp: nowIso,
        actor: trust.enrolledByEmail || 'Workstation Onboarding',
        module: 'IAM Device Trust',
        action: 'DEVICE_ENROLLED',
        targetId: trust.deviceId,
        detail: `Verified & onboarded ${trust.hostname} using IAM code ${matchedCode.code} (${trust.mdmProvider})`,
      },
      ...prev,
    ].slice(0, 200));
    showToast({
      variant: 'success',
      title: 'Device Onboarded & SSO Activated',
      description: `${trust.hostname} (${trust.deviceId}) verified via IAM code ${matchedCode.code}.`,
    });
    return { ok: true, device: trust };
  };

  const unenrollCompanyDevice = () => {
    setManagedDevice(null);
  };

  const loginEmployeeDeviceSso = (email?: string, name?: string): { ok: boolean; error?: string } => {
    if (!managedDevice || !isManagedDeviceVerified) {
      return {
        ok: false,
        error:
          'This workstation is unmanaged or its corporate MDM certificate was revoked. Obtain a unique verification code from the IAM Team to enroll.',
      };
    }

    const cleanInputEmail = email?.trim().toLowerCase();
    if (managedDevice.enrolledByEmail && cleanInputEmail && cleanInputEmail !== managedDevice.enrolledByEmail.toLowerCase()) {
      return {
        ok: false,
        error: `This managed workstation is bound by IAM to ${managedDevice.enrolledByEmail}.`,
      };
    }

    const targetEmail = managedDevice.enrolledByEmail || cleanInputEmail;
    const employeeAccount = targetEmail
      ? authAccounts.find(a => a.portalType === 'employee' && a.email.toLowerCase() === targetEmail.toLowerCase())
      : authAccounts.find(
          a => a.portalType === 'employee' && (!managedDevice.tenantId || a.tenantId === managedDevice.tenantId)
        ) || authAccounts.find(a => a.portalType === 'employee');

    if (employeeAccount?.status === 'suspended') {
      return { ok: false, error: 'This employee identity has been suspended in the IAM Portal.' };
    }

    if (managedDevice.tenantId && tenants.some(t => t.id === managedDevice.tenantId)) {
      setActiveTenantId(managedDevice.tenantId);
    }

    const resolvedName = name?.trim() || employeeAccount?.name || `Corporate Employee (${managedDevice.hostname})`;
    const resolvedEmail = targetEmail || employeeAccount?.email || `employee@${managedDevice.domain}`;
    setAuthSession({
      isAuthenticated: true,
      portalType: 'employee',
      role: 'technician',
      name: resolvedName,
      email: resolvedEmail,
      department: employeeAccount?.department || 'IT Operations',
      authMethod: 'employee_sso',
      deviceManaged: true,
      deviceId: managedDevice.deviceId,
      companyId: managedDevice.companyCode || employeeAccount?.companyId || activeTenant.companyCode,
      policyIds: employeeAccount?.policyIds || ['POL-EMPLOYEE-OPS'],
      authenticatedAt: new Date().toISOString()
    });
    return { ok: true };
  };

  const loginViaGooglePortal = async (portalType: AuthPortalType): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await performGoogleSignInWithFallback();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
      const targetRole = portalToRole(portalType);
      setAuthSession({
        isAuthenticated: true,
        portalType,
        role: targetRole,
        name: res.user.displayName || res.user.email || 'Google Account User',
        email: res.user.email || `user@${activeTenant.domain}`,
        department: portalType === 'end_user' ? 'Self-Service' : 'IT Operations',
        authMethod: 'google_oauth',
        deviceManaged: Boolean(managedDevice),
        deviceId: managedDevice?.deviceId,
        authenticatedAt: new Date().toISOString()
      });
      showToast({
        variant: 'success',
        title: 'Signed In & Cloud Sync Active',
        description: `Connected ${res.user.email || 'Google account'} to centralized cloud database.`,
      });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || 'Google authentication was cancelled or failed.';
      showToast({ variant: 'error', title: 'Google Sign-In Failed', description: msg });
      return { ok: false, error: msg };
    }
  };

  const loginWithGooglePortal = async (): Promise<boolean> => {
    const res = await loginViaGooglePortal('super_admin');
    return res.ok;
  };

  const logoutSession = async () => {
    if (isBackendApiConfigured() && getAccessToken()) {
      await authApi.logout().catch(() => undefined);
    } else {
      clearAuthTokens();
    }
    setAuthSession(null);
    if (googleUser) {
      await logoutGoogle();
    }
  };

  const currentUser = {
    name: authSession?.name || googleUser?.displayName || (role === 'customer' ? 'Portal User' : 'System Administrator'),
    email: authSession?.email || googleUser?.email || (role === 'customer' ? `user@${activeTenant.domain}` : activeTenant.primaryContactEmail),
    department: authSession?.department || (role === 'customer' ? 'Self-Service' : 'IT Operations'),
    phone: ''
  };

  // Master Multi-Tenant Stores (Preloaded Enterprise Seed Dataset)
  const [allIncidents, setAllIncidents] = useState<Incident[]>(() => loadState('INCIDENTS', initialSeed.incidents));
  const [allRequests, setAllRequests] = useState<ServiceRequest[]>(() => loadState('REQUESTS', initialSeed.requests));
  const [allProblems, setAllProblems] = useState<Problem[]>(() => loadState('PROBLEMS', initialSeed.problems));
  const [allChanges, setAllChanges] = useState<ChangeRequest[]>(() => loadState('CHANGES', initialSeed.changes));
  const [allAssets, setAllAssets] = useState<Asset[]>(() => loadState('ASSETS', initialSeed.assets));
  const [allInventory, setAllInventory] = useState<InventoryItem[]>(() => loadState('INVENTORY', initialSeed.inventory));
  const [allCalls, setAllCalls] = useState<TelephonyCall[]>(() => loadState('CALLS', initialSeed.calls));
  const [allInvoices, setAllInvoices] = useState<Invoice[]>(() => loadState('INVOICES', initialSeed.invoices));

  // Extended FreeITSM Stores (Preloaded Enterprise Seed Dataset)
  const [allSoftware, setAllSoftware] = useState<SoftwareLicense[]>(() => loadState('SOFTWARE', initialSeed.software));
  const [allTasks, setAllTasks] = useState<TaskItem[]>(() => loadState('TASKS', initialSeed.tasks));
  const [allProjects, setAllProjects] = useState<ProjectItem[]>(() => loadState('PROJECTS', initialSeed.projects));
  const [allKb, setAllKb] = useState<KnowledgeArticle[]>(() => loadState('KB', initialSeed.kbArticles));
  const [allContracts, setAllContracts] = useState<ContractRecord[]>(() => loadState('CONTRACTS', initialSeed.contracts));
  const [allDomains, setAllDomains] = useState<DomainRecord[]>(() => loadState('DOMAINS', initialSeed.domains));
  const [allStatusComponents, setAllStatusComponents] = useState<ServiceStatusComponent[]>(() => loadState('STATUS', initialSeed.statusComponents));
  const [allMorningChecks, setAllMorningChecks] = useState<MorningCheckRun[]>(() => loadState('CHECKS', initialSeed.morningChecks));
  const [allCalendarEvents, setAllCalendarEvents] = useState<CalendarEvent[]>(() => loadState('CALENDAR', initialSeed.calendarEvents));
  const [allWarRooms, setAllWarRooms] = useState<WarRoomSession[]>(() => loadState('WAR_ROOMS', initialSeed.warRooms));
  const [allLmsCourses, setAllLmsCourses] = useState<LmsCourse[]>(() => loadState('LMS', initialSeed.lmsCourses));
  const [allWikiPages, setAllWikiPages] = useState<WikiPage[]>(() => loadState('WIKI', initialSeed.wikiPages));
  const [allProcessMaps, setAllProcessMaps] = useState<ProcessMap[]>(() => loadState('PROCESS_MAPS', initialSeed.processMaps));
  const [allCustomForms, setAllCustomForms] = useState<CustomFormDefinition[]>(() => loadState('CUSTOM_FORMS', initialSeed.customForms));
  const [allCmdbRelations, setAllCmdbRelations] = useState<CmdbRelation[]>(() => loadState('CMDB_REL', initialSeed.cmdbRelations));
  const [allAuditLogs, setAllAuditLogs] = useState<AuditLogEntry[]>(() => loadState('AUDIT', initialSeed.auditLogs));
  const [allWorkflows, setAllWorkflows] = useState<WorkflowDefinition[]>(() => loadState('WORKFLOWS', initialSeed.workflows));
  const [allTicketWorkflows, setAllTicketWorkflows] = useState<TicketWorkflowRule[]>(() => loadState('TICKET_WORKFLOWS', initialSeed.ticketWorkflows));
  const [telephonyConfigsByTenant, setTelephonyConfigsByTenant] = useState<Record<string, TelephonyProviderConfig>>(() =>
    loadState('TELEPHONY_CONFIGS', initialSeed.telephonyConfigsByTenant)
  );

  const [activeCall, setActiveCall] = useState<TelephonyCall | null>(null);

  // Tenant-Filtered Views (Strict Tenant Isolation)
  const incidents = useMemo(() => allIncidents.filter(r => r.tenantId === activeTenant.id), [allIncidents, activeTenant.id]);
  const requests = useMemo(() => allRequests.filter(r => r.tenantId === activeTenant.id), [allRequests, activeTenant.id]);
  const problems = useMemo(() => allProblems.filter(r => r.tenantId === activeTenant.id), [allProblems, activeTenant.id]);
  const changes = useMemo(() => allChanges.filter(r => r.tenantId === activeTenant.id), [allChanges, activeTenant.id]);
  const assets = useMemo(() => allAssets.filter(r => r.tenantId === activeTenant.id), [allAssets, activeTenant.id]);
  const inventory = useMemo(() => allInventory.filter(r => r.tenantId === activeTenant.id), [allInventory, activeTenant.id]);
  const calls = useMemo(() => allCalls.filter(r => r.tenantId === activeTenant.id), [allCalls, activeTenant.id]);
  const invoices = useMemo(() => allInvoices.filter(r => r.tenantId === activeTenant.id), [allInvoices, activeTenant.id]);
  const softwareLicenses = useMemo(() => allSoftware.filter(r => r.tenantId === activeTenant.id), [allSoftware, activeTenant.id]);
  const tasks = useMemo(() => allTasks.filter(r => r.tenantId === activeTenant.id), [allTasks, activeTenant.id]);
  const projects = useMemo(() => allProjects.filter(r => r.tenantId === activeTenant.id), [allProjects, activeTenant.id]);
  const kbArticles = useMemo(() => allKb.filter(r => r.tenantId === activeTenant.id), [allKb, activeTenant.id]);
  const contracts = useMemo(() => allContracts.filter(r => r.tenantId === activeTenant.id), [allContracts, activeTenant.id]);
  const domains = useMemo(() => allDomains.filter(r => r.tenantId === activeTenant.id), [allDomains, activeTenant.id]);
  const statusComponents = useMemo(() => allStatusComponents.filter(r => r.tenantId === activeTenant.id), [allStatusComponents, activeTenant.id]);
  const morningChecks = useMemo(() => allMorningChecks.filter(r => r.tenantId === activeTenant.id), [allMorningChecks, activeTenant.id]);
  const calendarEvents = useMemo(() => allCalendarEvents.filter(r => r.tenantId === activeTenant.id), [allCalendarEvents, activeTenant.id]);
  const warRooms = useMemo(() => allWarRooms.filter(r => r.tenantId === activeTenant.id), [allWarRooms, activeTenant.id]);
  const lmsCourses = useMemo(() => allLmsCourses.filter(r => r.tenantId === activeTenant.id), [allLmsCourses, activeTenant.id]);
  const wikiPages = useMemo(() => allWikiPages.filter(r => r.tenantId === activeTenant.id), [allWikiPages, activeTenant.id]);
  const processMaps = useMemo(() => allProcessMaps.filter(r => r.tenantId === activeTenant.id), [allProcessMaps, activeTenant.id]);
  const customForms = useMemo(() => allCustomForms.filter(r => r.tenantId === activeTenant.id), [allCustomForms, activeTenant.id]);
  const cmdbRelations = useMemo(() => allCmdbRelations.filter(r => r.tenantId === activeTenant.id), [allCmdbRelations, activeTenant.id]);
  const auditLogs = useMemo(() => allAuditLogs.filter(r => r.tenantId === activeTenant.id), [allAuditLogs, activeTenant.id]);
  const workflows = useMemo(() => allWorkflows.filter(r => r.tenantId === activeTenant.id), [allWorkflows, activeTenant.id]);
  const ticketWorkflows = useMemo(() => allTicketWorkflows.filter(r => r.tenantId === activeTenant.id), [allTicketWorkflows, activeTenant.id]);

  const iamPolicies = useMemo(
    () => allIamPolicies.filter(p => p.tenantId === activeTenant.id || p.tenantId === 'tenant-default'),
    [allIamPolicies, activeTenant.id]
  );

  const telephonyConfig = useMemo<TelephonyProviderConfig>(() => {
    const existing = telephonyConfigsByTenant[activeTenant.id];
    if (existing) return existing;
    return {
      providerType: 'amazon_connect',
      providerLabel: 'Amazon Connect CCP',
      amazonConnectInstanceAlias: '',
      amazonConnectRegion: 'us-east-1',
      amazonConnectCcpUrl: '',
      sipWssUrl: '',
      sipDomain: activeTenant.domain,
      sipExtension: '4401',
      stunServer: 'stun:stun.l.google.com:19302',
      personalMobileEnabled: true,
      personalMobileNumber: currentUser.phone || '',
      personalMobileCountryCode: '+1',
      personalMobileBridgeMode: 'native_dialer',
      autoPopTicketOnInbound: false,
    };
  }, [telephonyConfigsByTenant, activeTenant.id, activeTenant.domain, currentUser.phone]);

  // Persist each collection independently to localStorage so a single large key never blocks saving other data
  useEffect(() => {
    safeSaveLocal('AUTH_SESSION', authSession);
    safeSaveLocal('AUTH_ACCOUNTS', authAccounts);
    safeSaveLocal('IAM_POLICIES', allIamPolicies);
    safeSaveLocal('MANAGED_DEVICE', managedDevice);
    safeSaveLocal('DEVICE_ENROLLMENT_CODES', deviceEnrollmentCodes);
    safeSaveLocal('ENROLLED_DEVICES', enrolledDevices);
    safeSaveLocal('ACTIVE_TENANT', activeTenantId);
    safeSaveLocal('INCIDENTS', allIncidents);
    safeSaveLocal('REQUESTS', allRequests);
    safeSaveLocal('PROBLEMS', allProblems);
    safeSaveLocal('CHANGES', allChanges);
    safeSaveLocal('ASSETS', allAssets);
    safeSaveLocal('INVENTORY', allInventory);
    safeSaveLocal('CALLS', allCalls);
    safeSaveLocal('INVOICES', allInvoices);
    safeSaveLocal('SOFTWARE', allSoftware);
    safeSaveLocal('TASKS', allTasks);
    safeSaveLocal('PROJECTS', allProjects);
    safeSaveLocal('KB', allKb);
    safeSaveLocal('CONTRACTS', allContracts);
    safeSaveLocal('DOMAINS', allDomains);
    safeSaveLocal('STATUS', allStatusComponents);
    safeSaveLocal('CHECKS', allMorningChecks);
    safeSaveLocal('CALENDAR', allCalendarEvents);
    safeSaveLocal('WAR_ROOMS', allWarRooms);
    safeSaveLocal('LMS', allLmsCourses);
    safeSaveLocal('WIKI', allWikiPages);
    safeSaveLocal('PROCESS_MAPS', allProcessMaps);
    safeSaveLocal('CUSTOM_FORMS', allCustomForms);
    safeSaveLocal('CMDB_REL', allCmdbRelations);
    safeSaveLocal('AUDIT', allAuditLogs);
    safeSaveLocal('WORKFLOWS', allWorkflows);
    safeSaveLocal('TICKET_WORKFLOWS', allTicketWorkflows);
    safeSaveLocal('TELEPHONY_CONFIGS', telephonyConfigsByTenant);
    safeSaveLocal('TENANTS', tenants);
  }, [
    authSession, authAccounts, allIamPolicies, managedDevice, deviceEnrollmentCodes, enrolledDevices,
    tenants, activeTenantId, allIncidents, allRequests, allProblems, allChanges,
    allAssets, allInventory, allCalls, allInvoices, allSoftware, allTasks,
    allProjects, allKb, allContracts, allDomains, allStatusComponents,
    allMorningChecks, allCalendarEvents, allWarRooms, allLmsCourses,
    allWikiPages, allProcessMaps, allCustomForms, allCmdbRelations, allAuditLogs,
    allWorkflows, allTicketWorkflows, telephonyConfigsByTenant
  ]);

  // Build normalized module state buckets for centralized Firestore sync.
  // Auth accounts (520+ profiles) are sharded into <=200-item buckets to stay strictly within Firestore 1MB doc & 500-item rule bounds.
  const buildModuleBuckets = useCallback((): CloudWorkspaceSnapshot['moduleBuckets'] => {
    const accountShardSize = 200;
    const accountShards: CloudWorkspaceSnapshot['moduleBuckets'] = {};
    const totalShards = Math.max(1, Math.ceil(authAccounts.length / accountShardSize));
    for (let s = 0; s < totalShards; s++) {
      accountShards[`auth_accounts_${s}`] = {
        items: authAccounts.slice(s * accountShardSize, (s + 1) * accountShardSize),
      };
    }

    return {
      problems: { items: allProblems },
      changes: { items: allChanges },
      assets: { items: allAssets },
      inventory: { items: allInventory },
      calls: { items: allCalls },
      invoices: { items: allInvoices },
      software: { items: allSoftware },
      tasks: { items: allTasks },
      projects: { items: allProjects },
      kb: { items: allKb },
      contracts: { items: allContracts },
      domains: { items: allDomains },
      status: { items: allStatusComponents },
      checks: { items: allMorningChecks },
      calendar: { items: allCalendarEvents },
      war_rooms: { items: allWarRooms },
      lms: { items: allLmsCourses },
      wiki: { items: allWikiPages },
      process_maps: { items: allProcessMaps },
      custom_forms: { items: allCustomForms },
      cmdb_rel: { items: allCmdbRelations },
      audit: { items: allAuditLogs.slice(0, 120) },
      workflows: { items: allWorkflows },
      ticket_workflows: { items: allTicketWorkflows },
      iam_policies: { items: allIamPolicies },
      device_enrollment_codes: { items: deviceEnrollmentCodes.slice(0, 300) },
      enrolled_devices: { items: enrolledDevices.slice(0, 300) },
      ...accountShards,
      telephony_configs: { settingsMap: telephonyConfigsByTenant as unknown as Record<string, unknown> },
    };
  }, [
    allProblems, allChanges, allAssets, allInventory, allCalls, allInvoices,
    allSoftware, allTasks, allProjects, allKb, allContracts, allDomains,
    allStatusComponents, allMorningChecks, allCalendarEvents, allWarRooms,
    allLmsCourses, allWikiPages, allProcessMaps, allCustomForms, allCmdbRelations,
    allAuditLogs, allWorkflows, allTicketWorkflows, allIamPolicies,
    deviceEnrollmentCodes, enrolledDevices, authAccounts,
    telephonyConfigsByTenant
  ]);

  // Keep latest state ref for initial cloud bootstrap without stale closures
  const latestSnapshotRef = useRef<CloudWorkspaceSnapshot>({
    activeTenantId,
    theme,
    tenants,
    incidents: allIncidents,
    requests: allRequests,
    moduleBuckets: buildModuleBuckets(),
  });

  useEffect(() => {
    latestSnapshotRef.current = {
      activeTenantId,
      theme,
      tenants,
      incidents: allIncidents,
      requests: allRequests,
      moduleBuckets: buildModuleBuckets(),
    };
  }, [activeTenantId, theme, tenants, allIncidents, allRequests, buildModuleBuckets]);

  // Real-time Firestore Workspace Hydration & Cross-Device Live Listener
  useEffect(() => {
    if (!googleUser?.uid) {
      cloudReadyUidRef.current = null;
      syncedHashesRef.current.clear();
      clearKnownCloudDocPaths();
      setCloudSyncStatus('disconnected');
      setCloudSyncError(null);
      return;
    }

    const uid = googleUser.uid;
    const email = googleUser.email || 'user@scribbleit.local';
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let initialSeedChecked = false;
    let sawTenants = false;
    let sawIncidents = false;
    let sawRequests = false;
    let sawBuckets = false;
    let remoteTenantCount = 0;
    let remoteIncidentCount = 0;
    let remoteRequestCount = 0;
    let remoteBucketCount = 0;

    setCloudSyncStatus('connecting');
    setCloudSyncError(null);

    const recordSnapshotHashes = (snap: CloudWorkspaceSnapshot) => {
      syncedHashesRef.current.set('root', JSON.stringify({ activeTenantId: snap.activeTenantId, theme: snap.theme }));
      snap.tenants.forEach(t => syncedHashesRef.current.set(`tenant:${t.id}`, JSON.stringify(t)));
      snap.incidents.forEach(inc => syncedHashesRef.current.set(`incident:${inc.id}`, JSON.stringify(inc)));
      snap.requests.forEach(req => syncedHashesRef.current.set(`request:${req.id}`, JSON.stringify(req)));
      Object.entries(snap.moduleBuckets).forEach(([k, v]) => {
        syncedHashesRef.current.set(`bucket:${k}`, JSON.stringify(v));
      });
    };

    const maybeFinishInitialSync = () => {
      if (cancelled || initialSeedChecked) return;
      if (!(sawTenants && sawIncidents && sawRequests && sawBuckets)) return;
      initialSeedChecked = true;

      const hasRemoteData =
        remoteTenantCount > 0 || remoteIncidentCount > 0 || remoteRequestCount > 0 || remoteBucketCount > 0;

      if (!hasRemoteData) {
        const localSnap = latestSnapshotRef.current;
        setCloudSyncStatus('syncing');
        pushFullWorkspaceSnapshotToCloud(uid, email, localSnap)
          .then(() => {
            if (cancelled) return;
            recordSnapshotHashes(localSnap);
            cloudReadyUidRef.current = uid;
            setCloudSyncStatus('synced');
            setLastCloudSyncAt(new Date().toISOString());
          })
          .catch(err => {
            if (cancelled) return;
            cloudReadyUidRef.current = uid;
            setCloudSyncStatus('error');
            setCloudSyncError(err instanceof Error ? err.message : 'Initial cloud upload failed.');
          });
      } else {
        cloudReadyUidRef.current = uid;
        setCloudSyncStatus('synced');
        setLastCloudSyncAt(new Date().toISOString());
      }
    };

    const startSync = async () => {
      try {
        const snap = latestSnapshotRef.current;
        await ensureWorkspaceRoot(uid, email, snap.activeTenantId, snap.theme);
        if (cancelled) return;

        unsubscribe = subscribeWorkspace(uid, {
          onWorkspaceRoot: root => {
            if (cancelled || !root) return;
            syncedHashesRef.current.set(
              'root',
              JSON.stringify({ activeTenantId: root.activeTenantId, theme: root.theme })
            );
            setThemeState(root.theme);
            if (root.activeTenantId) {
              setActiveTenantId(root.activeTenantId);
            }
          },
          onTenants: remoteTenants => {
            if (cancelled) return;
            sawTenants = true;
            remoteTenantCount = remoteTenants.length;
            if (remoteTenants.length > 0) {
              remoteTenants.forEach(t => syncedHashesRef.current.set(`tenant:${t.id}`, JSON.stringify(t)));
              setTenants(remoteTenants);
              setActiveTenantId(prev =>
                remoteTenants.some(t => t.id === prev) ? prev : remoteTenants[0].id
              );
              setLastCloudSyncAt(new Date().toISOString());
            }
            maybeFinishInitialSync();
          },
          onIncidents: remoteIncidents => {
            if (cancelled) return;
            sawIncidents = true;
            remoteIncidentCount = remoteIncidents.length;
            if (remoteIncidents.length > 0 || initialSeedChecked) {
              remoteIncidents.forEach(inc => syncedHashesRef.current.set(`incident:${inc.id}`, JSON.stringify(inc)));
              setAllIncidents(remoteIncidents);
              setLastCloudSyncAt(new Date().toISOString());
            }
            maybeFinishInitialSync();
          },
          onRequests: remoteRequests => {
            if (cancelled) return;
            sawRequests = true;
            remoteRequestCount = remoteRequests.length;
            if (remoteRequests.length > 0 || initialSeedChecked) {
              remoteRequests.forEach(req => syncedHashesRef.current.set(`request:${req.id}`, JSON.stringify(req)));
              setAllRequests(remoteRequests);
              setLastCloudSyncAt(new Date().toISOString());
            }
            maybeFinishInitialSync();
          },
          onModuleBuckets: buckets => {
            if (cancelled) return;
            sawBuckets = true;
            remoteBucketCount = Object.keys(buckets).length;
            const shardedAccountEntries: Array<[number, AuthAccount[]]> = [];
            let legacyAccounts: AuthAccount[] = [];

            Object.entries(buckets).forEach(([key, rec]) => {
              const payload =
                rec.settingsMap !== undefined
                  ? { settingsMap: rec.settingsMap }
                  : { items: rec.items || [] };
              syncedHashesRef.current.set(`bucket:${key}`, JSON.stringify(payload));
              if (key.startsWith('auth_accounts_')) {
                const idx = Number(key.replace('auth_accounts_', ''));
                if (!Number.isNaN(idx) && Array.isArray(rec.items)) {
                  shardedAccountEntries.push([idx, rec.items as AuthAccount[]]);
                }
                return;
              }
              switch (key) {
                case 'problems': if (rec.items) setAllProblems(rec.items as Problem[]); break;
                case 'changes': if (rec.items) setAllChanges(rec.items as ChangeRequest[]); break;
                case 'assets': if (rec.items) setAllAssets(rec.items as Asset[]); break;
                case 'inventory': if (rec.items) setAllInventory(rec.items as InventoryItem[]); break;
                case 'calls': if (rec.items) setAllCalls(rec.items as TelephonyCall[]); break;
                case 'invoices': if (rec.items) setAllInvoices(rec.items as Invoice[]); break;
                case 'software': if (rec.items) setAllSoftware(rec.items as SoftwareLicense[]); break;
                case 'tasks': if (rec.items) setAllTasks(rec.items as TaskItem[]); break;
                case 'projects': if (rec.items) setAllProjects(rec.items as ProjectItem[]); break;
                case 'kb': if (rec.items) setAllKb(rec.items as KnowledgeArticle[]); break;
                case 'contracts': if (rec.items) setAllContracts(rec.items as ContractRecord[]); break;
                case 'domains': if (rec.items) setAllDomains(rec.items as DomainRecord[]); break;
                case 'status': if (rec.items) setAllStatusComponents(rec.items as ServiceStatusComponent[]); break;
                case 'checks': if (rec.items) setAllMorningChecks(rec.items as MorningCheckRun[]); break;
                case 'calendar': if (rec.items) setAllCalendarEvents(rec.items as CalendarEvent[]); break;
                case 'war_rooms': if (rec.items) setAllWarRooms(rec.items as WarRoomSession[]); break;
                case 'lms': if (rec.items) setAllLmsCourses(rec.items as LmsCourse[]); break;
                case 'wiki': if (rec.items) setAllWikiPages(rec.items as WikiPage[]); break;
                case 'process_maps': if (rec.items) setAllProcessMaps(rec.items as ProcessMap[]); break;
                case 'custom_forms': if (rec.items) setAllCustomForms(rec.items as CustomFormDefinition[]); break;
                case 'cmdb_rel': if (rec.items) setAllCmdbRelations(rec.items as CmdbRelation[]); break;
                case 'audit': if (rec.items) setAllAuditLogs(rec.items as AuditLogEntry[]); break;
                case 'workflows': if (rec.items) setAllWorkflows(rec.items as WorkflowDefinition[]); break;
                case 'ticket_workflows': if (rec.items) setAllTicketWorkflows(rec.items as TicketWorkflowRule[]); break;
                case 'iam_policies': if (rec.items && rec.items.length > 0) setAllIamPolicies(rec.items as IamPolicy[]); break;
                case 'device_enrollment_codes': if (rec.items) setDeviceEnrollmentCodes(rec.items as DeviceEnrollmentCode[]); break;
                case 'enrolled_devices': if (rec.items) setEnrolledDevices(rec.items as ManagedDeviceTrust[]); break;
                case 'auth_accounts': if (rec.items && rec.items.length > 0) legacyAccounts = rec.items as AuthAccount[]; break;
                case 'telephony_configs':
                  if (rec.settingsMap) {
                    setTelephonyConfigsByTenant(rec.settingsMap as unknown as Record<string, TelephonyProviderConfig>);
                  }
                  break;
              }
            });

            if (shardedAccountEntries.length > 0) {
              shardedAccountEntries.sort((a, b) => a[0] - b[0]);
              const combined = shardedAccountEntries.flatMap(([, list]) => list);
              if (combined.length > 0) setAuthAccounts(combined);
            } else if (legacyAccounts.length > 0) {
              setAuthAccounts(legacyAccounts);
            }

            if (remoteBucketCount > 0) {
              setLastCloudSyncAt(new Date().toISOString());
            }
            maybeFinishInitialSync();
          },
          onError: err => {
            if (cancelled) return;
            setCloudSyncStatus('error');
            setCloudSyncError(err.message);
          },
        });
      } catch (err) {
        if (cancelled) return;
        setCloudSyncStatus('error');
        setCloudSyncError(err instanceof Error ? err.message : 'Failed to connect to cloud database.');
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [googleUser?.uid]);

  // Debounced Diff-Aware Cloud Sync: only pushes modified documents/buckets to Firestore
  useEffect(() => {
    if (!googleUser?.uid || cloudReadyUidRef.current !== googleUser.uid) return;

    const uid = googleUser.uid;
    const email = googleUser.email || 'user@scribbleit.local';

    const timer = setTimeout(() => {
      const tasks: Promise<void>[] = [];
      const pendingHashUpdates: [string, string][] = [];

      const rootHash = JSON.stringify({ activeTenantId, theme });
      if (syncedHashesRef.current.get('root') !== rootHash) {
        pendingHashUpdates.push(['root', rootHash]);
        tasks.push(ensureWorkspaceRoot(uid, email, activeTenantId, theme));
      }

      tenants.forEach(t => {
        const key = `tenant:${t.id}`;
        const h = JSON.stringify(t);
        if (syncedHashesRef.current.get(key) !== h) {
          pendingHashUpdates.push([key, h]);
          tasks.push(upsertTenantInCloud(uid, t));
        }
      });

      allIncidents.forEach(inc => {
        const key = `incident:${inc.id}`;
        const h = JSON.stringify(inc);
        if (syncedHashesRef.current.get(key) !== h) {
          pendingHashUpdates.push([key, h]);
          tasks.push(upsertIncidentInCloud(uid, inc));
        }
      });

      allRequests.forEach(req => {
        const key = `request:${req.id}`;
        const h = JSON.stringify(req);
        if (syncedHashesRef.current.get(key) !== h) {
          pendingHashUpdates.push([key, h]);
          tasks.push(upsertRequestInCloud(uid, req));
        }
      });

      const buckets = buildModuleBuckets();
      Object.entries(buckets).forEach(([bKey, bVal]) => {
        const key = `bucket:${bKey}`;
        const h = JSON.stringify(bVal);
        const alreadySynced = syncedHashesRef.current.has(key);
        const hasData = Array.isArray(bVal.items)
          ? bVal.items.length > 0
          : bVal.settingsMap
          ? Object.keys(bVal.settingsMap).length > 0
          : false;
        if (syncedHashesRef.current.get(key) !== h && (alreadySynced || hasData)) {
          pendingHashUpdates.push([key, h]);
          tasks.push(upsertModuleBucketInCloud(uid, bKey, bVal));
        }
      });

      if (tasks.length === 0) return;

      setCloudSyncStatus('syncing');
      Promise.allSettled(tasks).then(results => {
        const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        pendingHashUpdates.forEach(([k, v], idx) => {
          if (results[idx]?.status === 'fulfilled') {
            syncedHashesRef.current.set(k, v);
          }
        });
        if (rejected) {
          setCloudSyncStatus('error');
          setCloudSyncError(rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason));
        } else {
          setCloudSyncStatus('synced');
          setCloudSyncError(null);
          setLastCloudSyncAt(new Date().toISOString());
        }
      });
    }, 550);

    return () => clearTimeout(timer);
  }, [
    googleUser?.uid,
    activeTenantId,
    theme,
    tenants,
    allIncidents,
    allRequests,
    buildModuleBuckets,
  ]);

  const forceCloudSync = useCallback(async () => {
    if (!googleUser?.uid) {
      const ok = await loginWithGoogle();
      if (!ok) return;
      return;
    }
    const uid = googleUser.uid;
    const email = googleUser.email || 'user@scribbleit.local';
    const snap: CloudWorkspaceSnapshot = {
      activeTenantId,
      theme,
      tenants,
      incidents: allIncidents,
      requests: allRequests,
      moduleBuckets: buildModuleBuckets(),
    };
    setCloudSyncStatus('syncing');
    setCloudSyncError(null);
    try {
      await pushFullWorkspaceSnapshotToCloud(uid, email, snap);
      syncedHashesRef.current.set('root', JSON.stringify({ activeTenantId, theme }));
      tenants.forEach(t => syncedHashesRef.current.set(`tenant:${t.id}`, JSON.stringify(t)));
      allIncidents.forEach(inc => syncedHashesRef.current.set(`incident:${inc.id}`, JSON.stringify(inc)));
      allRequests.forEach(req => syncedHashesRef.current.set(`request:${req.id}`, JSON.stringify(req)));
      Object.entries(snap.moduleBuckets).forEach(([k, v]) => {
        syncedHashesRef.current.set(`bucket:${k}`, JSON.stringify(v));
      });
      cloudReadyUidRef.current = uid;
      setCloudSyncStatus('synced');
      setLastCloudSyncAt(new Date().toISOString());
      showToast({
        variant: 'success',
        title: 'Cloud Database Synced',
        description: `Backed up ${tenants.length} org(s), ${allIncidents.length} incident(s), ${allRequests.length} request(s), and all settings.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud sync failed.';
      setCloudSyncStatus('error');
      setCloudSyncError(msg);
      showToast({ variant: 'error', title: 'Cloud Sync Error', description: msg });
    }
  }, [googleUser, activeTenantId, theme, tenants, allIncidents, allRequests, buildModuleBuckets, showToast]);

  // Helper: Tenant-Scoped Audit Log
  const recordAudit = (module: string, action: string, targetId: string, detail: string) => {
    const entry: AuditLogEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 99)}`,
      tenantId: activeTenant.id,
      timestamp: new Date().toISOString(),
      actor: currentUser.name,
      module,
      action,
      targetId,
      detail
    };
    setAllAuditLogs(prev => [entry, ...prev].slice(0, 200));
  };

  // Multi-Tenant Operations (Strictly Super Admin Portal Exclusive for Company Governance)
  const requireSuperAdmin = (actionName: string): boolean => {
    if (isSuperAdmin) return true;
    recordAudit('Security Governance', 'SECURITY_DENIED', actionName, `Blocked non-Super-Admin (${authSession?.portalType || 'guest'} · ${currentUser.email}) from ${actionName}`);
    showToast({
      variant: 'error',
      title: 'Super Admin Portal Clearance Required',
      description: `Only the Super Admin Portal can perform: ${actionName}.`,
    });
    return false;
  };

  const {
    backendStatus: backendSyncStatus,
    backendError: backendSyncError,
    lastBackendSyncAt,
    isBackendMode: isBackendApiMode,
    hydrateFromBackend,
  } = useBackendSyncBridge();

  const applyHydratedBackendSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof hydrateFromBackend>>) => {
      if (!snapshot) return false;
      const { me } = snapshot;
      const backendOrgId = me.organization_id || activeTenant.id;
      setAuthSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          name: me.full_name || prev.name,
          email: me.email || prev.email,
          portalType: me.portal_type,
          role: me.portal_type === 'end_user' ? 'customer' : me.is_super_admin ? 'admin' : 'technician',
          effectivePermissions: me.permissions,
          clearanceTier: me.clearance_tier,
          backendSessionId: me.session_id,
          backendOrganizationId: backendOrgId,
          permissionSource: 'backend',
        };
      });
      if (snapshot.incidents.length > 0) setAllIncidents(snapshot.incidents);
      if (snapshot.requests.length > 0) setAllRequests(snapshot.requests);
      if (snapshot.problems.length > 0) setAllProblems(snapshot.problems);
      if (snapshot.changes.length > 0) setAllChanges(snapshot.changes);
      if (snapshot.assets.length > 0) setAllAssets(snapshot.assets);
      if (snapshot.cmdbRelations.length > 0) setAllCmdbRelations(snapshot.cmdbRelations);
      if (snapshot.inventory.length > 0) setAllInventory(snapshot.inventory);
      if (snapshot.softwareLicenses.length > 0) setAllSoftware(snapshot.softwareLicenses);
      if (snapshot.kbArticles.length > 0) setAllKb(snapshot.kbArticles);
      if (snapshot.auditLogs.length > 0) setAllAuditLogs(snapshot.auditLogs);
      return true;
    },
    [activeTenant.id]
  );

  const syncWithBackend = useCallback(async (): Promise<boolean> => {
    const snapshot = await hydrateFromBackend();
    return applyHydratedBackendSnapshot(snapshot);
  }, [hydrateFromBackend, applyHydratedBackendSnapshot]);

  const loginWithBackendApi = useCallback(
    async (
      portalType: AuthPortalType,
      email: string,
      password: string,
      organizationSlug?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isBackendApiConfigured()) {
        return { ok: false, error: 'FastAPI backend URL is not configured.' };
      }
      try {
        const res = await authApi.login({
          email,
          password,
          portal_type: portalType,
          organization_slug: organizationSlug,
        });
        const me = await authApi.me();
        const resolvedOrgId = me.organization_id || res.organization_id || activeTenant.id;
        const mappedRole: Role =
          me.portal_type === 'end_user' ? 'customer' : me.is_super_admin ? 'admin' : 'technician';
        const session: AuthSession = {
          isAuthenticated: true,
          portalType: me.portal_type,
          role: mappedRole,
          name: me.full_name,
          email: me.email,
          department: me.portal_type === 'end_user' ? 'Self-Service' : 'IT Operations',
          authMethod:
            me.portal_type === 'super_admin'
              ? 'admin_credentials'
              : me.portal_type === 'iam'
                ? 'iam_credentials'
                : me.portal_type === 'end_user'
                  ? 'portal_login'
                  : 'employee_password',
          deviceManaged: Boolean(me.device_managed),
          deviceId: me.device_id || undefined,
          authenticatedAt: new Date().toISOString(),
          effectivePermissions: me.permissions,
          clearanceTier: me.clearance_tier,
          backendSessionId: me.session_id,
          backendOrganizationId: resolvedOrgId,
          permissionSource: 'backend',
        };
        setAuthSession(session);
        setRole(mappedRole);
        const snapshot = await hydrateFromBackend();
        applyHydratedBackendSnapshot(snapshot);
        showToast({
          variant: 'success',
          title: 'Connected to Scribble-IT 2.0 Backend',
          description: `Authenticated as ${me.email} (${me.permissions.length} backend-verified scopes).`,
        });
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Backend authentication failed.';
        return { ok: false, error: msg };
      }
    },
    [activeTenant.id, hydrateFromBackend, applyHydratedBackendSnapshot]
  );

  const switchTenant = (tenantId: string) => {
    if (authSession?.isAuthenticated && !isSuperAdmin && !isIamPortal) {
      showToast({
        variant: 'warning',
        title: 'Corporate Tenant Isolation Active',
        description: 'Employees and End-Users are locked to their assigned organization.',
      });
      return;
    }
    setActiveTenantId(tenantId);
    setActiveCall(null);
    if (isBackendApiConfigured() && getAccessToken()) {
      authApi
        .switchOrganization(tenantId)
        .then(() => hydrateFromBackend())
        .then(snapshot => {
          applyHydratedBackendSnapshot(snapshot);
        })
        .catch(() => {
          // Non-UUID local tenant IDs remain isolated in standalone mode
        });
    }
  };

  const createTenant = (data: Partial<Tenant>): Tenant => {
    if (!requireSuperAdmin('Provision New Company Tenant')) {
      return activeTenant;
    }
    const slug = (data.slug || data.name || 'new-tenant').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `tenant-${slug}-${Math.floor(100 + Math.random() * 900)}`;
    const tenantDisplayName = data.name || 'New Enterprise Tenant';
    const initialLogo = data.companyLogoDataUrl || '';
    const defaultBranding = getDefaultTenantBranding(tenantDisplayName);
    const hydratedBranding = data.portalBranding || {
      employees: { ...defaultBranding.employees, logoDataUrl: initialLogo },
      enduser: { ...defaultBranding.enduser, logoDataUrl: initialLogo },
      iam: { ...defaultBranding.iam, logoDataUrl: initialLogo },
    };
    const newTenant: Tenant = {
      id,
      name: tenantDisplayName,
      slug,
      companyCode: data.companyCode || `COMP-${slug.toUpperCase().slice(0, 8)}`,
      domain: data.domain || `${slug}.io`,
      plan: data.plan || 'Enterprise',
      region: data.region || 'asia-south1',
      timezone: data.timezone || 'UTC',
      currency: data.currency || 'USD',
      primaryContactEmail: data.primaryContactEmail || `ops@${slug}.io`,
      status: 'active',
      companyLogoDataUrl: initialLogo,
      slaTargets: data.slaTargets || { P1: 1, P2: 4, P3: 24, P4: 72 },
      enabledModules: data.enabledModules || createAllEnabledModules(),
      preferenceTemplate: data.preferenceTemplate || {
        dateFormat: 'YYYY-MM-DD',
        defaultQueue: 'Service Desk Triage Pool',
        autoAssignRota: true,
        requireCabForNormalChange: true,
        portalBannerTitle: `${(data.name || slug).toUpperCase()} SUPPORT`
      },
      portalBranding: hydratedBranding,
      createdAt: new Date().toISOString()
    };
    setTenants(prev => [...prev, newTenant]);
    setActiveTenantId(id);
    showToast({ variant: 'success', title: 'Tenant Provisioned', description: `${newTenant.name} (${newTenant.companyCode}) is now active.` });
    return newTenant;
  };

  const updateTenant = (tenantId: string, updates: Partial<Tenant>) => {
    if (!requireSuperAdmin('Update Company Details & SLA Configuration')) return;
    setTenants(prev => prev.map(t => (t.id === tenantId ? { ...t, ...updates } : t)));
    recordAudit('Multi-Tenant', 'UPDATE_TENANT', tenantId, 'Updated tenant configuration / preference template');
    showToast({ variant: 'success', title: 'Tenant Changes Saved', description: 'Tenant configuration and templates updated.' });
  };

  const updateTenantPortalBranding = (
    tenantId: string,
    portalKey: CustomPortalKey,
    updates: Partial<PortalBrandConfig>
  ) => {
    if (!requireSuperAdmin('Update Company Portal Branding & Logos')) return;
    setTenants(prev =>
      prev.map(t => {
        if (t.id !== tenantId) return t;
        const base = t.portalBranding || getDefaultTenantBranding(t.name);
        const nextLogo =
          updates.logoDataUrl !== undefined
            ? updates.logoDataUrl
            : base[portalKey].logoDataUrl;
        return {
          ...t,
          companyLogoDataUrl:
            !t.companyLogoDataUrl && nextLogo ? nextLogo : t.companyLogoDataUrl,
          portalBranding: {
            ...base,
            [portalKey]: {
              ...base[portalKey],
              ...updates
            }
          }
        };
      })
    );
    recordAudit('Tenant Branding', 'UPDATE_PORTAL_BRANDING', tenantId, `Updated ${portalKey} portal name/logo`);
    showToast({ variant: 'success', title: 'Portal Branding Saved', description: `Updated ${portalKey} portal branding.` });
  };

  const applyCompanyLogoToAllPortals = (tenantId: string, logoDataUrl: string) => {
    if (!requireSuperAdmin('Apply Company Logo Across Portals')) return;
    setTenants(prev =>
      prev.map(t => {
        if (t.id !== tenantId) return t;
        const base = t.portalBranding || getDefaultTenantBranding(t.name);
        return {
          ...t,
          companyLogoDataUrl: logoDataUrl,
          portalBranding: {
            employees: { ...base.employees, logoDataUrl },
            enduser: { ...base.enduser, logoDataUrl },
            iam: { ...base.iam, logoDataUrl },
          },
        };
      })
    );
    recordAudit('Tenant Branding', 'APPLY_COMPANY_LOGO', tenantId, logoDataUrl ? 'Applied company logo to all portals' : 'Cleared company logo across portals');
    showToast({
      variant: 'success',
      title: logoDataUrl ? 'Company Logo Applied to All Portals' : 'Company Logo Cleared',
      description: 'Saved across Employees, End-User, and IAM portals.',
    });
  };

  const getPortalBranding = (portalKey: CustomPortalKey): PortalBrandConfig => {
    const base = activeTenant.portalBranding || getDefaultTenantBranding(activeTenant.name);
    const cfg = base[portalKey] || getDefaultTenantBranding(activeTenant.name)[portalKey];
    return {
      ...cfg,
      logoDataUrl: cfg.logoDataUrl || activeTenant.companyLogoDataUrl || '',
    };
  };

  const toggleTenantModule = (tenantId: string, moduleId: FreeITSMModuleId) => {
    if (!requireSuperAdmin('Modify Tenant Module Availability')) return;
    setTenants(prev => prev.map(t => {
      if (t.id !== tenantId) return t;
      const nextVal = !t.enabledModules[moduleId];
      return {
        ...t,
        enabledModules: {
          ...t.enabledModules,
          [moduleId]: nextVal
        }
      };
    }));
    recordAudit('Module Controls', 'TOGGLE_MODULE', moduleId, `Toggled availability for ${moduleId}`);
    showToast({ variant: 'info', title: 'Module Availability Saved', description: `Updated availability for ${moduleId}.` });
  };

  const isModuleEnabled = (moduleId: FreeITSMModuleId): boolean => {
    return activeTenant.enabledModules?.[moduleId] !== false;
  };

  // IAM Portal Operations (Requires IAM Portal, Super Admin, or iam:manage policy)
  const canManageIam = () => isSuperAdmin || isIamPortal || hasPermission('iam:manage');

  const createIamIdentity: ITSMContextType['createIamIdentity'] = data => {
    if (!canManageIam()) {
      const err = 'IAM Management clearance required to create corporate identities.';
      showToast({ variant: 'error', title: 'Access Denied', description: err });
      return { ok: false, error: err };
    }
    if (data.portalType === 'super_admin' && !isSuperAdmin) {
      const err = 'Only Super Admin Portal can provision new Super Admin accounts.';
      showToast({ variant: 'error', title: 'Privilege Guard', description: err });
      return { ok: false, error: err };
    }
    const cleanEmail = data.email.trim().toLowerCase();
    if (!cleanEmail || !data.password || !data.name.trim()) {
      const err = 'Identity Name, Email, and Password are required.';
      showToast({ variant: 'error', title: 'IAM Creation Failed', description: err });
      return { ok: false, error: err };
    }
    const customId = data.id?.trim().toUpperCase() || `IAM-${Math.floor(1000 + Math.random() * 8999)}`;
    if (authAccounts.some(a => a.id.toUpperCase() === customId)) {
      const err = `Identity ID ${customId} already exists.`;
      showToast({ variant: 'error', title: 'Duplicate Identity ID', description: err });
      return { ok: false, error: err };
    }
    if (authAccounts.some(a => a.email === cleanEmail && a.portalType === data.portalType)) {
      const err = `Email ${cleanEmail} is already assigned to ${data.portalType}.`;
      showToast({ variant: 'error', title: 'Duplicate Identity Email', description: err });
      return { ok: false, error: err };
    }
    const newAccount: AuthAccount = {
      id: customId,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password,
      portalType: data.portalType,
      role: data.role,
      companyId: data.companyId.trim() || activeTenant.companyCode || 'COMP-NJURE-01',
      tenantId: data.tenantId || activeTenant.id,
      department: data.department?.trim() || 'Operations',
      policyIds: data.policyIds || [],
      status: 'active',
      mfaEnabled: Boolean(data.mfaEnabled),
      createdAt: new Date().toISOString()
    };
    setAuthAccounts(prev => [newAccount, ...prev]);
    recordAudit('IAM Portal', 'CREATE_IDENTITY', newAccount.id, `${newAccount.email} (${newAccount.companyId} · ${newAccount.role})`);
    showToast({ variant: 'success', title: `Identity Created: ${newAccount.id}`, description: `${newAccount.email} · ${newAccount.companyId}` });
    return { ok: true, account: newAccount };
  };

  const updateIamIdentity = (id: string, updates: Partial<AuthAccount>) => {
    if (!canManageIam()) {
      showToast({ variant: 'error', title: 'Access Denied', description: 'IAM Management clearance required.' });
      return;
    }
    if (updates.role === 'admin' && !isSuperAdmin) {
      showToast({ variant: 'error', title: 'Privilege Guard', description: 'Only Super Admin Portal can assign Super Admin role.' });
      return;
    }
    setAuthAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
    recordAudit('IAM Portal', 'UPDATE_IDENTITY', id, 'Updated role, company ID, status, or policy assignments');
    showToast({ variant: 'success', title: `Identity Updated: ${id}`, description: 'IAM role, status, or policies saved.' });
  };

  const deleteIamIdentity = (id: string) => {
    if (!canManageIam()) {
      showToast({ variant: 'error', title: 'Access Denied', description: 'IAM Management clearance required.' });
      return;
    }
    setAuthAccounts(prev => prev.filter(a => a.id !== id));
    recordAudit('IAM Portal', 'DELETE_IDENTITY', id, 'Revoked IAM identity');
    showToast({ variant: 'info', title: `Identity Revoked: ${id}` });
  };

  const createIamPolicy = (policy: Partial<IamPolicy>): IamPolicy => {
    const newPolicy: IamPolicy = {
      id: `POL-${Math.floor(100 + Math.random() * 899)}`,
      tenantId: activeTenant.id,
      name: policy.name?.trim() || 'Custom Access Policy',
      description: policy.description?.trim() || '',
      permissions: policy.permissions || ['incidents:read'],
      mfaRequired: Boolean(policy.mfaRequired),
      ssoOnly: Boolean(policy.ssoOnly),
      createdAt: new Date().toISOString()
    };
    if (!canManageIam()) {
      showToast({ variant: 'error', title: 'Access Denied', description: 'IAM Management clearance required.' });
      return newPolicy;
    }
    setAllIamPolicies(prev => [newPolicy, ...prev]);
    recordAudit('IAM Portal', 'CREATE_POLICY', newPolicy.id, newPolicy.name);
    showToast({ variant: 'success', title: `IAM Policy Created: ${newPolicy.id}`, description: newPolicy.name });
    return newPolicy;
  };

  const deleteIamPolicy = (id: string) => {
    if (!canManageIam()) {
      showToast({ variant: 'error', title: 'Access Denied', description: 'IAM Management clearance required.' });
      return;
    }
    setAllIamPolicies(prev => prev.filter(p => p.id !== id));
    setAuthAccounts(prev =>
      prev.map(a => ({ ...a, policyIds: (a.policyIds || []).filter(pid => pid !== id) }))
    );
    recordAudit('IAM Portal', 'DELETE_POLICY', id, 'Removed IAM policy');
    showToast({ variant: 'info', title: `IAM Policy Removed: ${id}` });
  };

  const hasPermission = (scope: IamPermissionScope): boolean => {
    if (!authSession?.isAuthenticated) return false;
    // Backend-calculated effective permissions from `/api/v1/auth/me` are authoritative
    if (
      authSession.permissionSource === 'backend' &&
      Array.isArray(authSession.effectivePermissions)
    ) {
      return authSession.effectivePermissions.includes(scope);
    }
    // Device enrollment verification code generation is strictly IAM Portal exclusive
    if (scope === 'devices:enroll_code') {
      return isIamPortal;
    }
    // Company tenant administration is strictly Super Admin Portal exclusive
    if (scope === 'tenants:admin') {
      return isSuperAdmin;
    }
    if (isSuperAdmin) return true;
    const assignedIds = authSession.policyIds || [];
    if (assignedIds.length === 0) {
      if (isIamPortal) {
        return ['iam:manage', 'incidents:read', 'assets:read', 'audit:read'].includes(scope);
      }
      if (authSession.role === 'technician') {
        return ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'].includes(scope);
      }
      return scope === 'incidents:read' || scope === 'assets:read';
    }
    return allIamPolicies
      .filter(p => assignedIds.includes(p.id))
      .some(p => p.permissions.includes(scope));
  };

  // Telephony call duration ticker
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;
    const interval = setInterval(() => {
      setActiveCall(prev => {
        if (!prev || prev.status !== 'active') return prev;
        return { ...prev, durationSec: prev.durationSec + 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Incident Operations (evaluates active Ticket Workflow Rules)
  const createIncident = (data: Partial<Incident>): Incident => {
    const id = `INC-${Math.floor(2050 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const prio = data.priority || 'P3';
    const cat = data.category || 'software';
    const chan = data.sourceChannel || 'portal';

    const matchedRule = ticketWorkflows.find(r =>
      r.active &&
      (r.sourceChannel === 'all' || r.sourceChannel === chan) &&
      (r.matchCategory === 'all' || r.matchCategory === cat) &&
      (r.matchPriority === 'all' || r.matchPriority === prio)
    );

    const slaHours = matchedRule?.overrideSlaHours || activeTenant.slaTargets[prio] || 24;
    const resolvedGroup = data.assignmentGroup || matchedRule?.assignToQueue || activeTenant.preferenceTemplate.defaultQueue;
    const resolvedAssignee = data.assignee || resolvedGroup;
    const resolvedStatus: IncidentStatus = data.status || (matchedRule || data.assignmentGroup ? 'assigned' : 'new');

    const initialLog = [
      {
        id: `act-${Date.now()}`,
        timestamp: now,
        author: currentUser.name,
        action: 'Record Created',
        note: `Registered in tenant [${activeTenant.slug}] · Routed to "${resolvedGroup}" (${slaHours}h SLA).`
      }
    ];

    if (matchedRule) {
      initialLog.unshift({
        id: `act-${Date.now() + 1}`,
        timestamp: now,
        author: 'Ticket Workflow Engine',
        action: `Rule Applied: ${matchedRule.name}`,
        note: `Auto-routed to "${resolvedAssignee}" (${slaHours}h SLA).`
      });
      setAllTicketWorkflows(prev => prev.map(r => (r.id === matchedRule.id ? { ...r, executionCount: r.executionCount + 1 } : r)));
    }

    const newInc: Incident = {
      id,
      tenantId: activeTenant.id,
      title: data.title || 'Untitled Incident',
      description: data.description || '',
      status: resolvedStatus,
      priority: prio,
      urgency: data.urgency || 'medium',
      impact: data.impact || 'medium',
      category: cat,
      requesterName: data.requesterName || currentUser.name,
      requesterEmail: data.requesterEmail || currentUser.email,
      assignee: resolvedAssignee,
      assignmentGroup: resolvedGroup,
      affectedCI: data.affectedCI,
      slaDeadline: data.slaDeadline || new Date(Date.now() + slaHours * 3600 * 1000).toISOString(),
      slaBreached: false,
      timeLoggedMins: data.timeLoggedMins || 0,
      sourceChannel: chan,
      createdAt: now,
      updatedAt: now,
      activityLog: initialLog
    };
    setAllIncidents(prev => [newInc, ...prev]);
    if (isBackendApiConfigured() && getAccessToken()) {
      itsmApi
        .createIncident({
          title: newInc.title,
          description: newInc.description,
          category: newInc.category,
          impact: newInc.impact,
          urgency: newInc.urgency,
          priority: newInc.priority,
          source_channel: newInc.sourceChannel,
          assignment_group: newInc.assignmentGroup,
          affected_ci_label: newInc.affectedCI,
        })
        .then(dto => {
          const mapped = mapIncidentDto(dto);
          setAllIncidents(prev => prev.map(item => (item.id === newInc.id ? mapped : item)));
        })
        .catch(() => {
          // Local optimistic record stays visible if backend call fails transiently
        });
    }
    recordAudit('Incidents', 'CREATE', id, `${newInc.priority} ${newInc.title} -> ${resolvedGroup}`);
    showToast({ variant: 'success', title: `Incident Created: ${id}`, description: `${newInc.priority} · ${resolvedGroup} · ${newInc.title}` });
    return newInc;
  };

  const updateIncidentStatus = (id: string, status: IncidentStatus, note?: string, resolutionNotes?: string, isWorkNote = false) => {
    setAllIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc;
      const now = new Date().toISOString();
      const updatedLog = [...inc.activityLog];
      if (note) {
        updatedLog.push({
          id: `act-${Date.now()}`,
          timestamp: now,
          author: currentUser.name,
          action: isWorkNote ? '[WORK NOTE - INTERNAL]' : `Status: ${status}`,
          note
        });
      }
      return {
        ...inc,
        status,
        updatedAt: now,
        resolutionNotes: resolutionNotes || inc.resolutionNotes,
        activityLog: updatedLog
      };
    }));
    if (isBackendApiConfigured() && getAccessToken()) {
      const apiCall =
        status === 'resolved'
          ? itsmApi.resolveIncident(id, resolutionNotes || note || 'Resolved via console')
          : status === 'closed'
            ? itsmApi.closeIncident(id, note)
            : itsmApi.updateIncident(id, { status, note });
      apiCall.catch(() => undefined);
    }
    recordAudit('Incidents', 'STATUS_CHANGE', id, `Moved to ${status}`);
    showToast({ variant: 'success', title: `Incident Updated: ${id}`, description: `State changed to ${status.replace('_', ' ')}` });
  };

  const assignIncident = (id: string, assignee: string) => {
    setAllIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc;
      const now = new Date().toISOString();
      return {
        ...inc,
        assignee,
        status: inc.status === 'new' ? 'assigned' : inc.status,
        updatedAt: now,
        activityLog: [
          ...inc.activityLog,
          { id: `act-${Date.now()}`, timestamp: now, author: currentUser.name, action: 'Assigned', note: `Assigned to ${assignee}` }
        ]
      };
    }));
    if (isBackendApiConfigured() && getAccessToken()) {
      itsmApi.assignIncident(id, { assignee_name: assignee }).catch(() => undefined);
    }
    recordAudit('Incidents', 'ASSIGN', id, `Assigned to ${assignee}`);
    showToast({ variant: 'success', title: `Incident Assigned: ${id}`, description: `Owner: ${assignee}` });
  };

  const logIncidentTime = (id: string, mins: number) => {
    setAllIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc;
      const now = new Date().toISOString();
      return {
        ...inc,
        timeLoggedMins: (inc.timeLoggedMins || 0) + mins,
        updatedAt: now,
        activityLog: [
          ...inc.activityLog,
          { id: `act-${Date.now()}`, timestamp: now, author: currentUser.name, type: 'work_note', action: 'Time Logged', note: `Logged +${mins} minutes billable/work time.` }
        ]
      };
    }));
  };

  const setIncidentCsat = (id: string, score: number) => {
    setAllIncidents(prev => prev.map(inc => (inc.id === id ? { ...inc, csatScore: score } : inc)));
    recordAudit('Incidents', 'CSAT_RATED', id, `CSAT score ${score}/5 recorded`);
  };

  const simulateEmailToTicket = (fromEmail: string, subject: string, body: string): Incident => {
    return createIncident({
      title: subject,
      description: body,
      requesterName: fromEmail.split('@')[0],
      requesterEmail: fromEmail,
      category: 'software',
      priority: 'P3',
      sourceChannel: 'email'
    });
  };

  // Service Requests (Strict Designated Approver Account OR Super Admin Governance)
  const createServiceRequest = (req: Partial<ServiceRequest>): ServiceRequest => {
    const id = `REQ-${Math.floor(3030 + Math.random() * 800)}`;
    const now = new Date().toISOString();
    const reqEmail = (req.requesterEmail || currentUser.email).toLowerCase();
    const tenantCorpAccounts = authAccounts.filter(
      a => a.tenantId === activeTenant.id && a.portalType !== 'end_user' && a.status === 'active'
    );
    const eligibleApprovers = tenantCorpAccounts.filter(a => a.email.toLowerCase() !== reqEmail);
    const mgrAccount =
      eligibleApprovers.find(a => a.portalType === 'employee') ||
      tenantCorpAccounts.find(a => a.portalType === 'employee') ||
      DEFAULT_TEST_ENV_ACCOUNTS[1];
    const secAccount =
      eligibleApprovers.find(a => a.portalType === 'iam') ||
      eligibleApprovers.find(a => a.email !== mgrAccount.email) ||
      DEFAULT_TEST_ENV_ACCOUNTS[2];
    const fulfillAccount =
      eligibleApprovers.find(a => a.email !== mgrAccount.email && a.email !== secAccount.email) ||
      DEFAULT_TEST_ENV_ACCOUNTS[0];

    const newReq: ServiceRequest = {
      id,
      tenantId: activeTenant.id,
      catalogItemId: req.catalogItemId || 'CAT-GEN-01',
      catalogItemName: req.catalogItemName || 'Custom Service Request',
      description: req.description || '',
      requesterName: req.requesterName || currentUser.name,
      requesterEmail: req.requesterEmail || currentUser.email,
      department: req.department || currentUser.department,
      cost: req.cost || 0,
      status: 'submitted',
      currentStage: 1,
      approvals: req.approvals || [
        { role: 'Direct Manager', approver: mgrAccount.name, approverEmail: mgrAccount.email, status: 'pending' },
        { role: 'Security Review', approver: secAccount.name, approverEmail: secAccount.email, status: 'pending' },
        { role: 'IT Fulfillment', approver: fulfillAccount.name, approverEmail: fulfillAccount.email, status: 'pending' }
      ],
      deliveryEstimateDays: req.deliveryEstimateDays || 3,
      customFormValues: req.customFormValues,
      createdAt: now
    };
    setAllRequests(prev => [newReq, ...prev]);
    if (isBackendApiConfigured() && getAccessToken()) {
      itsmApi
        .createRequest({
          catalog_item_name: newReq.catalogItemName,
          description: newReq.description,
          department: newReq.department,
          cost: newReq.cost,
          delivery_estimate_days: newReq.deliveryEstimateDays,
          custom_form_values: newReq.customFormValues,
        })
        .then(dto => {
          const mapped = mapServiceRequestDto(dto);
          setAllRequests(prev => prev.map(item => (item.id === newReq.id ? mapped : item)));
        })
        .catch(() => undefined);
    }
    recordAudit('Service Requests', 'CREATE', id, newReq.catalogItemName);
    showToast({ variant: 'success', title: `Request Submitted: ${id}`, description: newReq.catalogItemName });
    return newReq;
  };

  const canApproveRequestStage = (
    approval: RequestApproval,
    requesterEmail?: string
  ): { allowed: boolean; reason: string; isSuperAdminOverride?: boolean } => {
    if (!authSession?.isAuthenticated) {
      return { allowed: false, reason: 'Corporate authentication is required to approve workflow stages.' };
    }
    if (isSuperAdmin) {
      return { allowed: true, reason: 'Authorized via Super Admin Governance Override.', isSuperAdminOverride: true };
    }
    if (authSession.role === 'customer') {
      return { allowed: false, reason: 'End-User Portal accounts cannot approve workflow stages.' };
    }
    const actorEmail = authSession.email.trim().toLowerCase();
    if (requesterEmail && actorEmail === requesterEmail.trim().toLowerCase()) {
      return {
        allowed: false,
        reason: 'Separation of Duties Violation: Requesters cannot approve their own service request.',
      };
    }
    if (approval.approverEmail) {
      if (actorEmail === approval.approverEmail.trim().toLowerCase()) {
        return { allowed: true, reason: `Verified designated approver (${approval.approverEmail}).` };
      }
      return {
        allowed: false,
        reason: `Restricted to designated approver ${approval.approver} (${approval.approverEmail}) or Super Admin.`,
      };
    }
    if (authSession.name.trim().toLowerCase() === approval.approver.trim().toLowerCase()) {
      return { allowed: true, reason: `Verified designated approver (${approval.approver}).` };
    }
    return {
      allowed: false,
      reason: `Restricted to designated approver ${approval.approver} or Super Admin.`,
    };
  };

  const approveRequestStage = (
    requestId: string,
    roleName: string,
    approver: string,
    status: 'approved' | 'rejected',
    notes?: string
  ): { ok: boolean; error?: string } => {
    const targetReq = allRequests.find(r => r.id === requestId);
    if (!targetReq) {
      return { ok: false, error: 'Service request not found.' };
    }
    const targetStage = targetReq.approvals.find(a => a.role === roleName);
    if (!targetStage) {
      return { ok: false, error: 'Approval stage not found.' };
    }
    const check = canApproveRequestStage(targetStage, targetReq.requesterEmail);
    if (!check.allowed) {
      recordAudit('Service Requests', 'SECURITY_DENIED', requestId, `Blocked ${currentUser.email} from ${status} on ${roleName}: ${check.reason}`);
      showToast({
        variant: 'error',
        title: 'Approval Authorization Denied',
        description: check.reason,
      });
      return { ok: false, error: check.reason };
    }

    const actorLabel = check.isSuperAdminOverride
      ? `${currentUser.name} (Super Admin Override)`
      : currentUser.name || approver;
    const enrichedNotes = check.isSuperAdminOverride
      ? `${notes ? `${notes} · ` : ''}[Super Admin Override for ${targetStage.approver}]`
      : notes;

    setAllRequests(prev => prev.map(req => {
      if (req.id !== requestId) return req;
      const newApprovals = req.approvals.map(a =>
        a.role === roleName
          ? {
              ...a,
              status,
              approver: actorLabel,
              approverEmail: a.approverEmail || currentUser.email,
              notes: enrichedNotes,
              timestamp: new Date().toISOString()
            }
          : a
      );
      let nextStatus = req.status;
      let nextStage = req.currentStage;
      if (status === 'rejected') {
        nextStatus = 'rejected';
      } else {
        const approvedCount = newApprovals.filter(a => a.status === 'approved').length;
        if (approvedCount === 1) { nextStatus = 'manager_approved'; nextStage = 2; }
        else if (approvedCount === 2) { nextStatus = 'fulfillment'; nextStage = 3; }
        else if (approvedCount >= 3) { nextStatus = 'completed'; nextStage = 4; }
      }
      return { ...req, status: nextStatus, currentStage: nextStage, approvals: newApprovals };
    }));
    recordAudit('Service Requests', status.toUpperCase(), requestId, `${roleName} stage ${status} by ${actorLabel}`);
    showToast({
      variant: status === 'approved' ? 'success' : 'warning',
      title: `Request ${status === 'approved' ? 'Approved' : 'Rejected'}: ${requestId}`,
      description: `${roleName} by ${actorLabel}`
    });
    return { ok: true };
  };

  const reassignRequestApprover = (
    requestId: string,
    roleName: string,
    accountId: string
  ): { ok: boolean; error?: string } => {
    if (!isSuperAdmin && !isIamPortal) {
      const err = 'Only Super Admin or IAM Governance Portal can reassign designated approver accounts.';
      showToast({ variant: 'error', title: 'Clearance Required', description: err });
      return { ok: false, error: err };
    }
    const targetAcc = authAccounts.find(a => a.id === accountId && a.portalType !== 'end_user');
    if (!targetAcc) {
      return { ok: false, error: 'Selected corporate approver account was not found.' };
    }
    setAllRequests(prev =>
      prev.map(req =>
        req.id === requestId
          ? {
              ...req,
              approvals: req.approvals.map(a =>
                a.role === roleName && a.status === 'pending'
                  ? { ...a, approver: targetAcc.name, approverEmail: targetAcc.email }
                  : a
              ),
            }
          : req
      )
    );
    recordAudit('Service Requests', 'REASSIGN_APPROVER', requestId, `${roleName} assigned to ${targetAcc.name} (${targetAcc.email})`);
    showToast({
      variant: 'success',
      title: 'Designated Approver Updated',
      description: `${roleName} on ${requestId} → ${targetAcc.name} (${targetAcc.email})`,
    });
    return { ok: true };
  };

  // Problem Operations
  const createProblem = (prob: Partial<Problem>): Problem => {
    const id = `PRB-${Math.floor(100 + Math.random() * 899)}`;
    const now = new Date().toISOString();
    const newProb: Problem = {
      id,
      tenantId: activeTenant.id,
      title: prob.title || 'Untitled Problem Investigation',
      description: prob.description || '',
      status: prob.status || 'investigating',
      severity: prob.severity || 'moderate',
      rootCauseAnalysis: prob.rootCauseAnalysis || '',
      workaround: prob.workaround || '',
      permanentSolution: prob.permanentSolution || '',
      linkedIncidentIds: prob.linkedIncidentIds || [],
      linkedChangeId: prob.linkedChangeId,
      owner: prob.owner || currentUser.name,
      isKnownError: prob.isKnownError || false,
      createdAt: now,
      updatedAt: now
    };
    setAllProblems(prev => [newProb, ...prev]);
    if (isBackendApiConfigured() && getAccessToken()) {
      itsmApi
        .createProblem({
          title: newProb.title,
          description: newProb.description,
          severity: newProb.severity,
          root_cause_analysis: newProb.rootCauseAnalysis,
          workaround: newProb.workaround,
        })
        .then(dto => {
          const mapped = mapProblemDto(dto);
          setAllProblems(prev => prev.map(item => (item.id === newProb.id ? mapped : item)));
        })
        .catch(() => undefined);
    }
    recordAudit('Problems', 'CREATE', id, newProb.title);
    showToast({ variant: 'success', title: `Problem Created: ${id}`, description: newProb.title });
    return newProb;
  };

  const updateProblem = (id: string, updates: Partial<Problem>) => {
    setAllProblems(prev => prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)));
    showToast({ variant: 'success', title: `Problem Saved: ${id}` });
  };

  // Change Management (Strict Designated CAB Voter OR Super Admin Governance)
  const createChangeRequest = (change: Partial<ChangeRequest>): ChangeRequest => {
    const id = `CHG-${Math.floor(600 + Math.random() * 300)}`;
    const now = new Date().toISOString();
    const tenantCorpAccounts = authAccounts.filter(
      a => a.tenantId === activeTenant.id && a.portalType !== 'end_user' && a.status === 'active'
    );
    const cabChair =
      tenantCorpAccounts.find(a => a.portalType === 'super_admin') ||
      DEFAULT_TEST_ENV_ACCOUNTS[0];
    const secArch =
      tenantCorpAccounts.find(a => a.portalType === 'iam' && a.email !== cabChair.email) ||
      tenantCorpAccounts.find(a => a.portalType === 'employee' && a.email !== cabChair.email) ||
      DEFAULT_TEST_ENV_ACCOUNTS[2];

    const newChg: ChangeRequest = {
      id,
      tenantId: activeTenant.id,
      title: change.title || 'Standard System Maintenance',
      type: change.type || 'normal',
      status: change.status || 'cab_review',
      riskScore: change.riskScore || 'medium',
      reason: change.reason || '',
      implementationPlan: change.implementationPlan || '',
      rollbackPlan: change.rollbackPlan || '',
      testPlan: change.testPlan || '',
      scheduledStart: change.scheduledStart || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      scheduledEnd: change.scheduledEnd || new Date(Date.now() + 28 * 3600 * 1000).toISOString(),
      cabVotes: change.cabVotes || [
        { member: cabChair.name, memberEmail: cabChair.email, role: 'CAB Chair', vote: 'pending' },
        { member: secArch.name, memberEmail: secArch.email, role: 'Security Architect', vote: 'pending' }
      ],
      requestedBy: change.requestedBy || currentUser.name,
      assignedEngineer: change.assignedEngineer || currentUser.name,
      createdAt: now,
      activityLog: []
    };
    setAllChanges(prev => [newChg, ...prev]);
    if (isBackendApiConfigured() && getAccessToken()) {
      itsmApi
        .createChange({
          title: newChg.title,
          change_type: newChg.type,
          risk_score: newChg.riskScore,
          reason: newChg.reason,
          implementation_plan: newChg.implementationPlan,
          rollback_plan: newChg.rollbackPlan,
          test_plan: newChg.testPlan,
          scheduled_start: newChg.scheduledStart,
          scheduled_end: newChg.scheduledEnd,
        })
        .then(dto => {
          const mapped = mapChangeDto(dto);
          setAllChanges(prev => prev.map(item => (item.id === newChg.id ? mapped : item)));
        })
        .catch(() => undefined);
    }
    recordAudit('Change (CAB)', 'CREATE', id, newChg.title);
    showToast({ variant: 'success', title: `Change Request Created: ${id}`, description: newChg.title });
    return newChg;
  };

  const canVoteCab = (vote: CabVote): { allowed: boolean; reason: string; isSuperAdminOverride?: boolean } => {
    if (!authSession?.isAuthenticated) {
      return { allowed: false, reason: 'Corporate authentication is required to cast CAB votes.' };
    }
    if (isSuperAdmin) {
      return { allowed: true, reason: 'Authorized via Super Admin CAB Override.', isSuperAdminOverride: true };
    }
    if (authSession.role === 'customer') {
      return { allowed: false, reason: 'End-User Portal accounts cannot cast CAB votes.' };
    }
    const actorEmail = authSession.email.trim().toLowerCase();
    if (vote.memberEmail) {
      if (actorEmail === vote.memberEmail.trim().toLowerCase()) {
        return { allowed: true, reason: `Verified designated CAB member (${vote.memberEmail}).` };
      }
      return {
        allowed: false,
        reason: `Restricted to designated CAB member ${vote.member} (${vote.memberEmail}) or Super Admin.`,
      };
    }
    if (authSession.name.trim().toLowerCase() === vote.member.trim().toLowerCase()) {
      return { allowed: true, reason: `Verified designated CAB member (${vote.member}).` };
    }
    return {
      allowed: false,
      reason: `Restricted to designated CAB member ${vote.member} or Super Admin.`,
    };
  };

  const voteCab = (
    changeId: string,
    member: string,
    roleName: string,
    vote: 'approved' | 'rejected',
    notes?: string
  ): { ok: boolean; error?: string } => {
    const targetChg = allChanges.find(c => c.id === changeId);
    if (!targetChg) {
      return { ok: false, error: 'Change request not found.' };
    }
    const targetVote = targetChg.cabVotes.find(v => v.role === roleName && v.member === member) || targetChg.cabVotes.find(v => v.member === member);
    if (!targetVote) {
      return { ok: false, error: 'CAB voter seat not found.' };
    }
    const check = canVoteCab(targetVote);
    if (!check.allowed) {
      recordAudit('Change (CAB)', 'SECURITY_DENIED', changeId, `Blocked ${currentUser.email} from CAB vote on ${roleName}: ${check.reason}`);
      showToast({
        variant: 'error',
        title: 'CAB Vote Authorization Denied',
        description: check.reason,
      });
      return { ok: false, error: check.reason };
    }

    const actorLabel = check.isSuperAdminOverride
      ? `${currentUser.name} (Super Admin Override)`
      : currentUser.name || member;

    setAllChanges(prev => prev.map(c => {
      if (c.id !== changeId) return c;
      const votes = c.cabVotes.map(v =>
        v.member === member && v.role === roleName
          ? {
              ...v,
              vote,
              notes: check.isSuperAdminOverride
                ? `${notes ? `${notes} · ` : ''}[Super Admin Override for ${v.member}]`
                : notes
            }
          : v
      );
      const allApproved = votes.every(v => v.vote === 'approved');
      const now = new Date().toISOString();
      const newStatus = allApproved ? 'scheduled' : c.status;
      return {
        ...c,
        cabVotes: votes,
        status: newStatus,
        activityLog: [
          ...(c.activityLog || []),
          {
            id: `act-${Date.now()}`,
            timestamp: now,
            author: actorLabel,
            type: 'audit',
            action: `CAB Vote: ${vote.toUpperCase()}`,
            note: `${actorLabel} (${roleName}) voted ${vote.toUpperCase()}.`,
            fieldChanges: allApproved && c.status !== 'scheduled' ? [{ field: 'State', from: c.status, to: 'scheduled' }] : undefined
          }
        ]
      };
    }));
    recordAudit('Change (CAB)', `CAB_${vote.toUpperCase()}`, changeId, `Vote by ${actorLabel} (${roleName})`);
    showToast({ variant: vote === 'approved' ? 'success' : 'warning', title: `CAB Vote Recorded: ${changeId}`, description: `${actorLabel} voted ${vote.toUpperCase()}` });
    return { ok: true };
  };

  const reassignCabVoter = (
    changeId: string,
    roleName: string,
    accountId: string
  ): { ok: boolean; error?: string } => {
    if (!isSuperAdmin && !isIamPortal) {
      const err = 'Only Super Admin or IAM Governance Portal can reassign CAB voter seats.';
      showToast({ variant: 'error', title: 'Clearance Required', description: err });
      return { ok: false, error: err };
    }
    const targetAcc = authAccounts.find(a => a.id === accountId && a.portalType !== 'end_user');
    if (!targetAcc) {
      return { ok: false, error: 'Selected corporate CAB member account was not found.' };
    }
    setAllChanges(prev =>
      prev.map(c =>
        c.id === changeId
          ? {
              ...c,
              cabVotes: c.cabVotes.map(v =>
                v.role === roleName && v.vote === 'pending'
                  ? { ...v, member: targetAcc.name, memberEmail: targetAcc.email }
                  : v
              ),
            }
          : c
      )
    );
    recordAudit('Change (CAB)', 'REASSIGN_CAB_VOTER', changeId, `${roleName} assigned to ${targetAcc.name} (${targetAcc.email})`);
    showToast({
      variant: 'success',
      title: 'CAB Seat Reassigned',
      description: `${roleName} on ${changeId} → ${targetAcc.name} (${targetAcc.email})`,
    });
    return { ok: true };
  };

  const updateChangeStatus = (id: string, status: ChangeStatus) => {
    setAllChanges(prev => prev.map(c => {
      if (c.id !== id) return c;
      const now = new Date().toISOString();
      const prior = c.status;
      return {
        ...c,
        status,
        updatedAt: now,
        activityLog: [
          ...(c.activityLog || []),
          {
            id: `act-${Date.now()}`,
            timestamp: now,
            author: currentUser.name,
            type: 'field_change',
            action: 'Status Changed',
            note: `Transitioned RFC status from "${prior}" to "${status}".`,
            fieldChanges: [{ field: 'State', from: prior, to: status }]
          }
        ]
      };
    }));
    showToast({ variant: 'success', title: `Change Status Updated: ${id}`, description: `Moved to ${status}` });
  };

  const addRecordActivity = (
    recordId: string,
    recordType: 'incident' | 'change',
    note: string,
    type: 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit',
    action?: string,
    fieldChanges?: { field: string; from: string; to: string }[]
  ) => {
    const now = new Date().toISOString();
    const entry = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now,
      author: currentUser.name,
      type,
      action: action || (type === 'work_note' ? 'Work Note' : type === 'comment' ? 'Customer Comment' : 'Update'),
      note,
      fieldChanges
    };

    if (recordType === 'incident') {
      setAllIncidents(prev => prev.map(inc => inc.id === recordId ? { ...inc, updatedAt: now, activityLog: [entry, ...inc.activityLog] } : inc));
    } else {
      setAllChanges(prev => prev.map(chg => chg.id === recordId ? { ...chg, updatedAt: now, activityLog: [entry, ...(chg.activityLog || [])] } : chg));
    }
    showToast({ variant: 'success', title: `Activity Posted on ${recordId}` });
  };

  // Asset & CMDB Relations
  const createAsset = (asset: Partial<Asset>): Asset => {
    const id = `AST-${Math.floor(6000 + Math.random() * 3000)}`;
    const newAsset: Asset = {
      id,
      tenantId: activeTenant.id,
      assetTag: asset.assetTag || `${activeTenant.slug.toUpperCase().slice(0, 5)}-HW-${Math.floor(100 + Math.random() * 900)}`,
      name: asset.name || 'Hardware Asset',
      type: asset.type || 'laptop',
      serialNumber: asset.serialNumber || `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      macAddress: asset.macAddress,
      ipAddress: asset.ipAddress,
      syncSource: asset.syncSource || 'manual',
      model: asset.model || 'Standard Enterprise Model',
      manufacturer: asset.manufacturer || 'Dell Technologies',
      status: asset.status || 'in_stock',
      assignedTo: asset.assignedTo,
      department: asset.department,
      location: asset.location || 'Headquarters IT Depot',
      purchaseDate: asset.purchaseDate || new Date().toISOString().split('T')[0],
      warrantyExpiry: asset.warrantyExpiry || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      purchaseCost: asset.purchaseCost || 1200,
      currentBookValue: asset.currentBookValue || 1200,
      qrCodeData: `https://scribble.njuretech.io/asset/${id}`
    };
    setAllAssets(prev => [newAsset, ...prev]);
    if (isBackendApiConfigured() && getAccessToken()) {
      cmdbApi
        .createAsset({
          asset_tag: newAsset.assetTag,
          name: newAsset.name,
          asset_type: newAsset.type,
          serial_number: newAsset.serialNumber,
          model: newAsset.model,
          manufacturer: newAsset.manufacturer,
          status: newAsset.status,
          assigned_to_name: newAsset.assignedTo,
          location: newAsset.location,
          purchase_cost: newAsset.purchaseCost,
          current_book_value: newAsset.currentBookValue,
        })
        .then(dto => {
          const mapped = mapAssetDto(dto);
          setAllAssets(prev => prev.map(item => (item.id === newAsset.id ? mapped : item)));
        })
        .catch(() => undefined);
    }
    recordAudit('CMDB Assets', 'CREATE', id, newAsset.name);
    showToast({ variant: 'success', title: `Asset Registered: ${id}`, description: `${newAsset.assetTag} · ${newAsset.name}` });
    return newAsset;
  };

  const updateAssetStatus = (id: string, status: Asset['status'], assignedTo?: string) => {
    setAllAssets(prev => prev.map(a => (a.id === id ? { ...a, status, assignedTo: assignedTo !== undefined ? assignedTo : a.assignedTo } : a)));
    if (isBackendApiConfigured() && getAccessToken()) {
      cmdbApi
        .assignAsset(id, {
          status,
          ...(assignedTo !== undefined ? { assigned_to_name: assignedTo } : {}),
        })
        .catch(() => undefined);
    }
    showToast({ variant: 'success', title: `Asset Updated: ${id}`, description: `Status: ${status.replace('_', ' ')}` });
  };

  const addCmdbRelation = (rel: Partial<CmdbRelation>): CmdbRelation => {
    const newRel: CmdbRelation = {
      id: `REL-${Date.now()}`,
      tenantId: activeTenant.id,
      sourceId: rel.sourceId || '',
      targetId: rel.targetId || '',
      relationType: rel.relationType || 'depends_on',
      criticality: rel.criticality || 'standard'
    };
    setAllCmdbRelations(prev => [newRel, ...prev]);
    recordAudit('CMDB Map', 'LINK_CI', newRel.id, `${newRel.sourceId} ${newRel.relationType} ${newRel.targetId}`);
    showToast({ variant: 'success', title: 'CMDB Dependency Linked', description: `${newRel.sourceId} → ${newRel.targetId}` });
    return newRel;
  };

  const removeCmdbRelation = (id: string) => {
    setAllCmdbRelations(prev => prev.filter(r => r.id !== id));
  };

  // Inventory & Software
  const updateInventoryQuantity = (id: string, delta: number) => {
    setAllInventory(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item));
  };

  const createInventoryItem = (item: Partial<InventoryItem>): InventoryItem => {
    const id = `INV-${Math.floor(500 + Math.random() * 400)}`;
    const newItem: InventoryItem = {
      id,
      tenantId: activeTenant.id,
      sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: item.name || 'Stock Item',
      category: item.category || 'components',
      quantity: item.quantity || 10,
      minThreshold: item.minThreshold || 5,
      unitCost: item.unitCost || 25,
      location: item.location || 'Depot Shelf 1',
      lastRestocked: new Date().toISOString().split('T')[0]
    };
    setAllInventory(prev => [newItem, ...prev]);
    recordAudit('Inventory', 'CREATE', id, newItem.name);
    showToast({ variant: 'success', title: `Inventory Added: ${id}`, description: newItem.name });
    return newItem;
  };

  const createSoftwareLicense = (sw: Partial<SoftwareLicense>): SoftwareLicense => {
    const id = `SW-${Math.floor(200 + Math.random() * 700)}`;
    const totalSeats = sw.totalSeats || 25;
    const usedSeats = sw.usedSeats || 0;
    const newSw: SoftwareLicense = {
      id,
      tenantId: activeTenant.id,
      name: sw.name || 'Enterprise Software',
      vendor: sw.vendor || 'Vendor',
      version: sw.version || '1.0',
      licenseType: sw.licenseType || 'per_seat',
      totalSeats,
      usedSeats,
      annualCost: sw.annualCost || 2500,
      renewalDate: sw.renewalDate || '2027-01-01',
      source: sw.source || 'Manual',
      complianceStatus: usedSeats > totalSeats ? 'over_allocated' : 'compliant'
    };
    setAllSoftware(prev => [newSw, ...prev]);
    recordAudit('Software SAM', 'CREATE', id, newSw.name);
    showToast({ variant: 'success', title: `Software License Added: ${id}`, description: newSw.name });
    return newSw;
  };

  const adjustSoftwareSeats = (id: string, delta: number) => {
    setAllSoftware(prev => prev.map(sw => {
      if (sw.id !== id) return sw;
      const usedSeats = Math.max(0, sw.usedSeats + delta);
      return {
        ...sw,
        usedSeats,
        complianceStatus: usedSeats > sw.totalSeats ? 'over_allocated' : 'compliant'
      };
    }));
  };

  // Tasks (Kanban)
  const createTask = (task: Partial<TaskItem>): TaskItem => {
    const id = `TSK-${Math.floor(400 + Math.random() * 500)}`;
    const newTask: TaskItem = {
      id,
      tenantId: activeTenant.id,
      title: task.title || 'New Operational Task',
      description: task.description || '',
      column: task.column || 'todo',
      priority: task.priority || 'medium',
      assignee: task.assignee || currentUser.name,
      dueDate: task.dueDate || new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0],
      timeLoggedMins: 0,
      linkedRecordId: task.linkedRecordId,
      projectId: task.projectId,
      subtasks: task.subtasks || [],
      createdAt: new Date().toISOString()
    };
    setAllTasks(prev => [newTask, ...prev]);
    recordAudit('Tasks', 'CREATE', id, newTask.title);
    showToast({ variant: 'success', title: `Task Created: ${id}`, description: newTask.title });
    return newTask;
  };

  const moveTaskColumn = (id: string, column: TaskColumn) => {
    setAllTasks(prev => prev.map(t => (t.id === id ? { ...t, column } : t)));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setAllTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, done: !st.done } : st)
      };
    }));
  };

  const logTaskTime = (taskId: string, mins: number) => {
    setAllTasks(prev => prev.map(t => (t.id === taskId ? { ...t, timeLoggedMins: t.timeLoggedMins + mins } : t)));
  };

  // Projects
  const createProject = (proj: Partial<ProjectItem>): ProjectItem => {
    const id = `PRJ-${Math.floor(10 + Math.random() * 89)}`;
    const newProj: ProjectItem = {
      id,
      tenantId: activeTenant.id,
      code: proj.code || `PRJ-2026-${Math.floor(10 + Math.random() * 89)}`,
      title: proj.title || 'New Infrastructure Project',
      owner: proj.owner || currentUser.name,
      stage: proj.stage || 'initiation',
      health: proj.health || 'on_track',
      progressPct: proj.progressPct || 10,
      budgetTotal: proj.budgetTotal || 25000,
      budgetSpent: proj.budgetSpent || 0,
      startDate: proj.startDate || new Date().toISOString().split('T')[0],
      targetEndDate: proj.targetEndDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      summary: proj.summary || ''
    };
    setAllProjects(prev => [newProj, ...prev]);
    recordAudit('Projects', 'CREATE', id, newProj.title);
    showToast({ variant: 'success', title: `Project Created: ${id}`, description: newProj.title });
    return newProj;
  };

  const updateProjectStage = (id: string, stage: ProjectStage, progressPct?: number) => {
    setAllProjects(prev => prev.map(p => (p.id === id ? { ...p, stage, progressPct: progressPct ?? p.progressPct } : p)));
    showToast({ variant: 'success', title: `Project Updated: ${id}`, description: `Stage: ${stage}` });
  };

  // Knowledge Base
  const createKbArticle = (article: Partial<KnowledgeArticle>): KnowledgeArticle => {
    const id = `KB-${Math.floor(1100 + Math.random() * 899)}`;
    const newKb: KnowledgeArticle = {
      id,
      tenantId: activeTenant.id,
      title: article.title || 'Untitled KB Article',
      category: article.category || 'Operations',
      visibility: article.visibility || 'public',
      author: currentUser.name,
      views: 1,
      helpfulVotes: 0,
      tags: article.tags || ['ITSM'],
      content: article.content || '',
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setAllKb(prev => [newKb, ...prev]);
    recordAudit('Knowledge Base', 'PUBLISH', id, newKb.title);
    showToast({ variant: 'success', title: `KB Article Published: ${id}`, description: newKb.title });
    return newKb;
  };

  const voteKbHelpful = (id: string) => {
    setAllKb(prev => prev.map(k => (k.id === id ? { ...k, helpfulVotes: k.helpfulVotes + 1 } : k)));
  };

  // Contracts & RFP
  const createContract = (contract: Partial<ContractRecord>): ContractRecord => {
    const id = `CTR-${Math.floor(500 + Math.random() * 499)}`;
    const newCtr: ContractRecord = {
      id,
      tenantId: activeTenant.id,
      title: contract.title || 'Vendor Service Agreement',
      vendor: contract.vendor || 'Supplier',
      type: contract.type || 'software',
      annualValue: contract.annualValue || 10000,
      startDate: contract.startDate || new Date().toISOString().split('T')[0],
      renewalDate: contract.renewalDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      noticeDays: contract.noticeDays || 30,
      autoRenew: contract.autoRenew ?? false,
      linkedAssetIds: contract.linkedAssetIds || [],
      status: contract.status || 'active',
      rfpNotes: contract.rfpNotes
    };
    setAllContracts(prev => [newCtr, ...prev]);
    recordAudit('Contracts', 'CREATE', id, newCtr.title);
    showToast({ variant: 'success', title: `Contract Added: ${id}`, description: newCtr.title });
    return newCtr;
  };

  const updateContractStatus = (id: string, status: ContractRecord['status'], rfpNotes?: string) => {
    setAllContracts(prev => prev.map(c => (c.id === id ? { ...c, status, rfpNotes: rfpNotes ?? c.rfpNotes } : c)));
    showToast({ variant: 'success', title: `Contract Updated: ${id}`, description: `Status: ${status}` });
  };

  // Domains & SSL
  const createDomainRecord = (domain: Partial<DomainRecord>): DomainRecord => {
    const id = `DOM-${Math.floor(10 + Math.random() * 89)}`;
    const newDom: DomainRecord = {
      id,
      tenantId: activeTenant.id,
      domain: domain.domain || 'example.io',
      registrar: domain.registrar || 'Cloudflare Registrar',
      domainExpiry: domain.domainExpiry || '2027-11-17',
      sslExpiry: domain.sslExpiry || '2027-02-17',
      securityGrade: domain.securityGrade || 'A',
      dnssecEnabled: domain.dnssecEnabled ?? true,
      spfValid: domain.spfValid ?? true,
      dkimValid: domain.dkimValid ?? true,
      dmarcPolicy: domain.dmarcPolicy || 'quarantine',
      registrarLocked: domain.registrarLocked ?? true,
      lookalikeAlerts: domain.lookalikeAlerts ?? 0
    };
    setAllDomains(prev => [newDom, ...prev]);
    recordAudit('Domains', 'REGISTER', id, newDom.domain);
    showToast({ variant: 'success', title: `Domain Registered: ${newDom.domain}` });
    return newDom;
  };

  // Service Status Page
  const updateComponentHealth = (id: string, status: ComponentHealth, autoOpenIncident = false) => {
    const target = allStatusComponents.find(s => s.id === id);
    let createdIncId: string | undefined;
    if (autoOpenIncident && target && (status === 'partial_outage' || status === 'major_outage')) {
      const inc = createIncident({
        title: `Service Outage: ${target.name} (${status.replace('_', ' ').toUpperCase()})`,
        description: `Automatically triggered from Service Status monitor for ${target.name}.`,
        priority: status === 'major_outage' ? 'P1' : 'P2',
        category: 'network',
        sourceChannel: 'monitor'
      });
      createdIncId = inc.id;
    }
    setAllStatusComponents(prev => prev.map(s => (s.id === id ? { ...s, status, linkedIncidentId: createdIncId ?? s.linkedIncidentId, updatedAt: new Date().toISOString() } : s)));
    recordAudit('Status Page', 'HEALTH_UPDATE', id, `Component marked ${status}`);
    showToast({ variant: status === 'operational' ? 'success' : 'warning', title: `Service Health Updated: ${id}`, description: status.replace('_', ' ') });
  };

  // Morning Checks
  const submitMorningCheckRun = (items: MorningCheckItem[]): MorningCheckRun => {
    const run: MorningCheckRun = {
      id: `MC-${Date.now()}`,
      tenantId: activeTenant.id,
      date: new Date().toISOString().split('T')[0],
      engineer: currentUser.name,
      items,
      completedAt: new Date().toISOString().slice(11, 16) + ' UTC'
    };
    setAllMorningChecks(prev => [run, ...prev]);
    recordAudit('Morning Checks', 'SUBMIT_RUN', run.id, `${items.filter(i => i.status === 'pass').length}/${items.length} checks passed`);
    showToast({ variant: 'success', title: 'Morning Checks Submitted', description: `${items.filter(i => i.status === 'pass').length}/${items.length} checks passed` });
    return run;
  };

  // Calendar & Duty Rota
  const createCalendarEvent = (evt: Partial<CalendarEvent>): CalendarEvent => {
    const newEvt: CalendarEvent = {
      id: `CAL-${Date.now()}`,
      tenantId: activeTenant.id,
      title: evt.title || 'Scheduled Event',
      date: evt.date || new Date().toISOString().split('T')[0],
      endDate: evt.endDate,
      type: evt.type || 'duty_rota',
      owner: evt.owner || currentUser.name,
      linkedId: evt.linkedId
    };
    setAllCalendarEvents(prev => [newEvt, ...prev]);
    showToast({ variant: 'success', title: 'Calendar Event Scheduled', description: `${newEvt.title} (${newEvt.date})` });
    return newEvt;
  };

  // War Room
  const createWarRoom = (incidentId: string, title: string, severity: 'P1' | 'P2'): WarRoomSession => {
    const session: WarRoomSession = {
      id: `WAR-${Math.floor(1000 + Math.random() * 8999)}`,
      tenantId: activeTenant.id,
      incidentId,
      title,
      severity,
      status: 'active',
      commander: currentUser.name,
      bridgeNumber: '+44 20 7946 8800 · PIN ' + Math.floor(1000 + Math.random() * 8999) + '#',
      startedAt: new Date().toISOString(),
      checklist: [
        { id: `wc-${Date.now()}-1`, label: 'Assign Incident Commander & Comms Scribe', done: true },
        { id: `wc-${Date.now()}-2`, label: 'Update Service Status Page & Stakeholder Alert', done: false },
        { id: `wc-${Date.now()}-3`, label: 'Verify mitigation & monitor 15m telemetry stability', done: false }
      ],
      feed: [
        { id: `wm-${Date.now()}`, timestamp: new Date().toISOString(), author: currentUser.name, role: 'Incident Commander', message: `War Room bridge opened for ${incidentId}.` }
      ]
    };
    setAllWarRooms(prev => [session, ...prev]);
    recordAudit('War Room', 'OPEN_BRIDGE', session.id, `Bridge opened for ${incidentId}`);
    showToast({ variant: 'warning', title: `War Room Bridge Opened: ${session.id}`, description: `${severity} · ${title}` });
    return session;
  };

  const postWarRoomMessage = (sessionId: string, message: string) => {
    setAllWarRooms(prev => prev.map(w => {
      if (w.id !== sessionId) return w;
      return {
        ...w,
        feed: [...w.feed, { id: `wm-${Date.now()}`, timestamp: new Date().toISOString(), author: currentUser.name, role: role.toUpperCase(), message }]
      };
    }));
  };

  const toggleWarRoomChecklist = (sessionId: string, checkId: string) => {
    setAllWarRooms(prev => prev.map(w => {
      if (w.id !== sessionId) return w;
      return { ...w, checklist: w.checklist.map(c => c.id === checkId ? { ...c, done: !c.done } : c) };
    }));
  };

  const closeWarRoom = (sessionId: string) => {
    setAllWarRooms(prev => prev.map(w => (w.id === sessionId ? { ...w, status: 'closed' } : w)));
    recordAudit('War Room', 'CLOSE_BRIDGE', sessionId, 'Major incident bridge stood down');
    showToast({ variant: 'info', title: `War Room Closed: ${sessionId}`, description: 'Major incident bridge stood down.' });
  };

  // LMS
  const toggleLmsLesson = (courseId: string, lessonId: string) => {
    setAllLmsCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c;
      const lessons = c.lessons.map(l => l.id === lessonId ? { ...l, completed: !l.completed } : l);
      const allDone = lessons.every(l => l.completed);
      return { ...c, lessons, certified: allDone ? true : c.certified };
    }));
  };

  const completeLmsQuiz = (courseId: string, scorePct: number) => {
    setAllLmsCourses(prev => prev.map(c => (c.id === courseId ? { ...c, scorePct, certified: scorePct >= 80 } : c)));
    recordAudit('LMS', 'CERTIFIED', courseId, `Completed assessment with ${scorePct}%`);
    showToast({
      variant: scorePct >= 80 ? 'success' : 'warning',
      title: scorePct >= 80 ? 'Assessment Passed' : 'Assessment Recorded',
      description: `Course ${courseId} · Score ${scorePct}%`
    });
  };

  // Wiki
  const createWikiPage = (page: Partial<WikiPage>): WikiPage => {
    const newPage: WikiPage = {
      id: `WIKI-${Math.floor(10 + Math.random() * 89)}`,
      tenantId: activeTenant.id,
      title: page.title || 'New Wiki Page',
      section: page.section || 'Runbooks',
      author: currentUser.name,
      updatedAt: new Date().toISOString().split('T')[0],
      content: page.content || ''
    };
    setAllWikiPages(prev => [newPage, ...prev]);
    showToast({ variant: 'success', title: `Wiki Page Created: ${newPage.id}`, description: newPage.title });
    return newPage;
  };

  const updateWikiPage = (id: string, content: string) => {
    setAllWikiPages(prev => prev.map(p => (p.id === id ? { ...p, content, updatedAt: new Date().toISOString().split('T')[0] } : p)));
    showToast({ variant: 'success', title: `Wiki Page Saved: ${id}` });
  };

  // Process Mapper
  const createProcessMap = (proc: Partial<ProcessMap>): ProcessMap => {
    const scope = proc.recordScope || 'incident';
    const openLabel =
      scope === 'request'
        ? 'Service Request Opened'
        : scope === 'change'
        ? 'Change RFC Opened'
        : 'Incident Opened';
    const closeLabel =
      scope === 'request'
        ? 'Close Request'
        : scope === 'change'
        ? 'Close Change'
        : 'Close Incident';

    const newMap: ProcessMap = {
      id: `PROC-${Math.floor(10 + Math.random() * 89)}`,
      tenantId: activeTenant.id,
      title: proc.title || `${scope === 'request' ? 'Service Request' : 'Incident'} Lifecycle Flow`,
      recordScope: scope,
      owner: currentUser.name,
      linkedKbId: proc.linkedKbId,
      updatedAt: new Date().toISOString().split('T')[0],
      nodes: proc.nodes || [
        {
          id: 'n-start',
          label: openLabel,
          type: 'start',
          role: 'Portal / Intake',
          moduleId: scope === 'request' ? 'requests' : scope === 'change' ? 'changes' : 'incidents',
          slaHours: 1,
          description: 'Triggered immediately when a new record opens.',
          x: 48,
          y: 120,
        },
        {
          id: 'n-end',
          label: closeLabel,
          type: 'end',
          role: 'Service Desk',
          moduleId: scope === 'request' ? 'requests' : scope === 'change' ? 'changes' : 'incidents',
          slaHours: 4,
          description: 'Final resolution verification and record closure.',
          x: 448,
          y: 120,
        },
      ],
      edges: proc.edges || [{ from: 'n-start', to: 'n-end', condition: 'Next' }],
    };
    setAllProcessMaps(prev => [newMap, ...prev]);
    showToast({ variant: 'success', title: `Process Map Created: ${newMap.id}`, description: newMap.title });
    return newMap;
  };

  const updateProcessMap = (id: string, updates: Partial<ProcessMap>) => {
    setAllProcessMaps(prev =>
      prev.map(m =>
        m.id === id
          ? {
              ...m,
              ...updates,
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : m
      )
    );
  };

  const deleteProcessMap = (id: string) => {
    setAllProcessMaps(prev => prev.filter(m => m.id !== id));
    showToast({ variant: 'info', title: `Process Map Deleted: ${id}` });
  };

  const addProcessNode = (
    mapId: string,
    label: string,
    type: Exclude<ProcessNodeType, 'start' | 'end'>,
    roleLabel: string
  ) => {
    setAllProcessMaps(prev =>
      prev.map(m => {
        if (m.id !== mapId) return m;
        const newId = `n-${Date.now()}`;
        const endNode = m.nodes.find(n => n.type === 'end');

        if (endNode) {
          // Insert directly BEFORE the Close Record (end) node so open -> ... -> new step -> close always holds
          const incomingToEnd = m.edges.filter(e => e.to === endNode.id);
          const predecessor =
            incomingToEnd.length > 0
              ? m.nodes.find(n => n.id === incomingToEnd[incomingToEnd.length - 1].from)
              : m.nodes[m.nodes.length - 2] || m.nodes[0];

          const newX = Math.max((predecessor?.x ?? 48) + 256, endNode.x);
          const newY = predecessor?.y ?? endNode.y;
          const shiftedEnd = { ...endNode, x: newX + 256 };

          const nextNodes = m.nodes
            .map(n => (n.id === endNode.id ? shiftedEnd : n))
            .concat({
              id: newId,
              label,
              type,
              role: roleLabel,
              slaHours: type === 'approval' ? 8 : 4,
              x: newX,
              y: newY,
            });

          const nextEdges = m.edges
            .map(e => (predecessor && e.from === predecessor.id && e.to === endNode.id ? { ...e, to: newId } : e))
            .concat({ from: newId, to: endNode.id, condition: type === 'approval' ? 'Approved' : 'Next' });

          return {
            ...m,
            updatedAt: new Date().toISOString().split('T')[0],
            nodes: nextNodes,
            edges: nextEdges,
          };
        }

        const lastNode = m.nodes[m.nodes.length - 1];
        const x = (lastNode?.x || 48) + 256;
        const y = lastNode?.y ?? 120;
        return {
          ...m,
          updatedAt: new Date().toISOString().split('T')[0],
          nodes: [...m.nodes, { id: newId, label, type, role: roleLabel, slaHours: 4, x, y }],
          edges: lastNode ? [...m.edges, { from: lastNode.id, to: newId }] : m.edges,
        };
      })
    );
    showToast({ variant: 'success', title: 'Step Inserted Before Close', description: `${label} (${type})` });
  };

  // Custom Forms
  const createCustomForm = (form: Partial<CustomFormDefinition>): CustomFormDefinition => {
    const newForm: CustomFormDefinition = {
      id: `FRM-${Math.floor(10 + Math.random() * 89)}`,
      tenantId: activeTenant.id,
      title: form.title || 'Custom Intake Form',
      category: form.category || 'access',
      publishedToPortal: form.publishedToPortal ?? true,
      fields: form.fields || [],
      submissionsCount: 0,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setAllCustomForms(prev => [newForm, ...prev]);
    recordAudit('Custom Forms', 'CREATE', newForm.id, newForm.title);
    showToast({ variant: 'success', title: `Custom Form Saved: ${newForm.id}`, description: newForm.title });
    return newForm;
  };

  const toggleFormPublish = (id: string) => {
    setAllCustomForms(prev => prev.map(f => (f.id === id ? { ...f, publishedToPortal: !f.publishedToPortal } : f)));
    showToast({ variant: 'info', title: `Form Portal Visibility Updated: ${id}` });
  };

  const submitCustomFormToRequest = (formId: string, values: Record<string, string>): ServiceRequest => {
    const form = allCustomForms.find(f => f.id === formId);
    setAllCustomForms(prev => prev.map(f => (f.id === formId ? { ...f, submissionsCount: f.submissionsCount + 1 } : f)));
    const summaryLines = Object.entries(values).map(([k, v]) => `${k}: ${v}`).join(' | ');
    return createServiceRequest({
      catalogItemId: formId,
      catalogItemName: form?.title || 'Custom Portal Form',
      description: summaryLines,
      customFormValues: values,
      cost: 0,
      deliveryEstimateDays: 2
    });
  };

  // Workflow Management
  const createWorkflow = (wf: Partial<WorkflowDefinition>): WorkflowDefinition => {
    const newWf: WorkflowDefinition = {
      id: `WF-${Math.floor(100 + Math.random() * 899)}`,
      tenantId: activeTenant.id,
      name: wf.name || 'Standard Automation Workflow',
      targetModuleId: wf.targetModuleId || wf.triggerConfig?.moduleId || 'all',
      trigger: wf.trigger || 'module_event',
      triggerConfig: wf.triggerConfig,
      description: wf.description || '',
      status: wf.status || 'active',
      stages: wf.stages || [],
      executionCount: 0,
      lastRunTrace: [],
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setAllWorkflows(prev => [newWf, ...prev]);
    recordAudit('Workflow Management', 'CREATE', newWf.id, `${newWf.name} (${newWf.stages.length} steps)`);
    showToast({ variant: 'success', title: `Workflow Saved: ${newWf.id}`, description: `${newWf.name} (${newWf.stages.length} steps)` });
    return newWf;
  };

  const updateWorkflow = (id: string, updates: Partial<WorkflowDefinition>) => {
    setAllWorkflows(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, ...updates, updatedAt: new Date().toISOString().split('T')[0] }
          : w
      )
    );
    recordAudit('Workflow Management', 'UPDATE', id, 'Updated workflow trigger, module scope, or steps');
    showToast({ variant: 'success', title: `Workflow Updated: ${id}`, description: 'Steps and trigger changes saved.' });
  };

  const toggleWorkflowStatus = (id: string, status: WorkflowDefinition['status']) => {
    setAllWorkflows(prev => prev.map(w => (w.id === id ? { ...w, status, updatedAt: new Date().toISOString().split('T')[0] } : w)));
    recordAudit('Workflow Management', 'STATUS_CHANGE', id, `Workflow marked ${status}`);
    showToast({ variant: 'info', title: `Workflow ${status.toUpperCase()}: ${id}` });
  };

  const runWorkflowExecution = (id: string) => {
    const target = allWorkflows.find(w => w.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const trace: WorkflowRunStepTrace[] = target.stages.map((stg, index) => {
      const moduleLabel = getModuleLabel(stg.moduleId);
      const actionLabel = stg.actionLabel || stg.stepType.toUpperCase();
      let detail = `Executed ${actionLabel} via ${stg.assigneeRole} (${stg.slaHours}h SLA)`;

      if (stg.actionKey === 'create_incident') {
        const inc = createIncident({
          title: stg.config?.titleTemplate || `[Workflow] ${target.name} · Step ${index + 1}`,
          description: `Generated automatically by workflow ${target.id} (${target.name}).`,
          priority: (stg.config?.priority as Incident['priority']) || 'P3',
          assignee: stg.config?.targetQueue || activeTenant.preferenceTemplate.defaultQueue,
          sourceChannel: 'monitor'
        });
        detail = `Created Incident ${inc.id} in ${inc.assignee} (${inc.priority})`;
      } else if (stg.actionKey === 'create_kanban_task') {
        const task = createTask({
          title: stg.config?.taskTitle || `[Workflow] ${stg.name}`,
          description: `Auto-generated task from workflow ${target.id}`,
          column: (stg.config?.column as TaskColumn) || 'todo',
          assignee: stg.config?.assignee || stg.assigneeRole
        });
        detail = `Created Task ${task.id} in ${task.column}`;
      } else if (stg.config && Object.keys(stg.config).length > 0) {
        const summary = Object.entries(stg.config)
          .filter(([, v]) => Boolean(v))
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        if (summary) detail = `${actionLabel}: ${summary}`;
      }

      return {
        stepId: stg.id,
        stepName: stg.name,
        moduleLabel,
        actionLabel,
        status: 'succeeded',
        detail,
        executedAt: now
      };
    });

    setAllWorkflows(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, executionCount: w.executionCount + 1, lastExecutedAt: now, lastRunTrace: trace }
          : w
      )
    );
    recordAudit('Workflow Management', 'EXECUTE', id, `Executed ${target.stages.length} workflow step(s)`);
    showToast({ variant: 'success', title: `Workflow Executed: ${target.name}`, description: `${target.stages.length} step(s) succeeded.` });
  };

  const deleteWorkflow = (id: string) => {
    setAllWorkflows(prev => prev.filter(w => w.id !== id));
    recordAudit('Workflow Management', 'DELETE', id, 'Removed workflow definition');
    showToast({ variant: 'info', title: `Workflow Deleted: ${id}` });
  };

  // Ticket Workflow Management
  const createTicketWorkflow = (rule: Partial<TicketWorkflowRule>): TicketWorkflowRule => {
    const newRule: TicketWorkflowRule = {
      id: `TWF-${Math.floor(100 + Math.random() * 899)}`,
      tenantId: activeTenant.id,
      name: rule.name || 'Ticket Routing Rule',
      active: rule.active ?? true,
      sourceChannel: rule.sourceChannel || 'all',
      matchCategory: rule.matchCategory || 'all',
      matchPriority: rule.matchPriority || 'all',
      assignToQueue: rule.assignToQueue || activeTenant.preferenceTemplate.defaultQueue,
      overrideSlaHours: rule.overrideSlaHours,
      autoEscalateAfterMins: rule.autoEscalateAfterMins,
      allowedTransitions: rule.allowedTransitions || {
        new: ['assigned', 'in_progress', 'closed'],
        assigned: ['in_progress', 'pending', 'resolved'],
        in_progress: ['pending', 'resolved'],
        pending: ['in_progress', 'resolved'],
        resolved: ['closed', 'in_progress'],
        closed: ['in_progress']
      },
      notifyRoles: rule.notifyRoles || ['Assignee', 'Service Desk Lead'],
      executionCount: 0,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    setAllTicketWorkflows(prev => [newRule, ...prev]);
    recordAudit('Ticket Workflow', 'CREATE_RULE', newRule.id, newRule.name);
    showToast({ variant: 'success', title: `Routing Rule Created: ${newRule.id}`, description: newRule.name });
    return newRule;
  };

  const toggleTicketWorkflow = (id: string) => {
    setAllTicketWorkflows(prev => prev.map(r => (r.id === id ? { ...r, active: !r.active } : r)));
    recordAudit('Ticket Workflow', 'TOGGLE_RULE', id, 'Toggled ticket workflow rule');
    showToast({ variant: 'info', title: `Routing Rule Updated: ${id}` });
  };

  const deleteTicketWorkflow = (id: string) => {
    setAllTicketWorkflows(prev => prev.filter(r => r.id !== id));
    recordAudit('Ticket Workflow', 'DELETE_RULE', id, 'Deleted ticket workflow rule');
    showToast({ variant: 'info', title: `Routing Rule Deleted: ${id}` });
  };

  // Telephony CTI & Multi-Provider Config
  const updateTelephonyConfig = (updates: Partial<TelephonyProviderConfig>) => {
    setTelephonyConfigsByTenant(prev => ({
      ...prev,
      [activeTenant.id]: {
        ...telephonyConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }));
    recordAudit('Telephony', 'UPDATE_PROVIDER', activeTenant.id, updates.providerLabel || telephonyConfig.providerLabel);
    showToast({
      variant: 'success',
      title: 'Telephony Configuration Saved',
      description: `${updates.providerLabel || telephonyConfig.providerLabel} active for ${activeTenant.name}`,
    });
  };

  const startTelephonyCall = (
    number: string,
    name?: string,
    providerMeta?: { providerType?: TelephonyProviderType; providerLabel?: string; initialNote?: string }
  ): TelephonyCall => {
    const pType = providerMeta?.providerType || telephonyConfig.providerType;
    const pLabel = providerMeta?.providerLabel || telephonyConfig.providerLabel;
    const digitsOnly = number.replace(/\D/g, '');
    const matchedProfile = digitsOnly.length >= 7
      ? authAccounts.find(a => (a.phone || '').replace(/\D/g, '').endsWith(digitsOnly.slice(-7)))
      : undefined;
    const matchedTenant = matchedProfile?.tenantId
      ? tenants.find(t => t.id === matchedProfile.tenantId)
      : undefined;

    const newCall: TelephonyCall = {
      id: `CALL-${Math.floor(9100 + Math.random() * 800)}`,
      tenantId: activeTenant.id,
      callerNumber: number,
      callerName: name || matchedProfile?.name || 'Remote Engineer / Client',
      callerCompany: matchedTenant?.name || activeTenant.name,
      direction: 'outbound',
      status: 'active',
      startTime: new Date().toISOString(),
      durationSec: 0,
      providerType: pType,
      providerLabel: pLabel,
      liveTranscript: [
        `System: Call session opened for ${number} via ${pLabel}`,
        ...(matchedProfile
          ? [`Directory Match: ${matchedProfile.name} (${matchedProfile.department}${matchedProfile.jobTitle ? ` · ${matchedProfile.jobTitle}` : ''})`]
          : []),
        ...(providerMeta?.initialNote ? [providerMeta.initialNote] : []),
      ],
    };
    setActiveCall(newCall);
    setAllCalls(prev => [newCall, ...prev]);
    return newCall;
  };

  const appendCallNote = (callId: string, note: string) => {
    const clean = note.trim();
    if (!clean) return;
    const formatted = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${currentUser.name}: ${clean}`;
    setActiveCall(prev =>
      prev && prev.id === callId ? { ...prev, liveTranscript: [...prev.liveTranscript, formatted] } : prev
    );
    setAllCalls(prev =>
      prev.map(c => (c.id === callId ? { ...c, liveTranscript: [...c.liveTranscript, formatted] } : c))
    );
  };

  const simulateIncomingCall = () => {
    const tenantUsers = authAccounts.filter(a => a.tenantId === activeTenant.id && a.phone);
    const pool = tenantUsers.length > 0 ? tenantUsers : authAccounts.filter(a => a.phone);
    const picked = pool.length > 0 ? pool[Math.floor(Math.random() * Math.min(pool.length, 40))] : undefined;
    const call: TelephonyCall = {
      id: `CALL-${Math.floor(9200 + Math.random() * 700)}`,
      tenantId: activeTenant.id,
      callerNumber: picked?.phone || '+14155550192',
      callerName: picked?.name || 'Dr. Alistair Finch',
      callerCompany: activeTenant.name,
      direction: 'inbound',
      status: 'ringing',
      startTime: new Date().toISOString(),
      durationSec: 0,
      providerType: telephonyConfig.providerType,
      providerLabel: telephonyConfig.providerLabel,
      liveTranscript: [
        `Incoming call signal received via ${telephonyConfig.providerLabel} (${activeTenant.domain})`,
        ...(picked ? [`Caller ID Directory Match: ${picked.name} · ${picked.department} (${picked.email})`] : []),
      ],
    };
    setActiveCall(call);
  };

  const answerIncomingCall = () => {
    if (!activeCall) return;
    const answered = {
      ...activeCall,
      status: 'active' as const,
      liveTranscript: [...activeCall.liveTranscript, `Agent: "Scribble IT Support (${activeTenant.name}), how can I help?"`]
    };
    setActiveCall(answered);
    setAllCalls(prev => [answered, ...prev.filter(c => c.id !== answered.id)]);
  };

  const toggleHoldCall = () => {
    if (!activeCall) return;
    const nextStatus = activeCall.status === 'held' ? 'active' : 'held';
    setActiveCall({ ...activeCall, status: nextStatus as 'active' | 'held' });
  };

  const endTelephonyCall = () => {
    if (!activeCall) return;
    const finished: TelephonyCall = { ...activeCall, status: 'completed', disposition: 'inquiry_resolved' };
    setAllCalls(prev => [finished, ...prev.filter(c => c.id !== finished.id)]);
    setActiveCall(null);
  };

  const popTicketFromCall = (callId: string): Incident => {
    const targetCall = calls.find(c => c.id === callId) || activeCall;
    const newInc = createIncident({
      title: `Telephony Support: ${targetCall?.callerName || 'Inbound Call'}`,
      description: `Auto-generated from telephony session ${callId}.\n${targetCall?.liveTranscript.join('\n') || ''}`,
      category: 'telephony',
      priority: 'P2',
      requesterName: targetCall?.callerName || 'Phone Requester',
      sourceChannel: 'phone'
    });
    setAllCalls(prev => prev.map(c => c.id === callId ? { ...c, relatedTicketId: newInc.id, disposition: 'incident_logged' } : c));
    return newInc;
  };

  // Invoicing
  const payInvoice = (invoiceId: string, method: Invoice['paymentMethod']) => {
    setAllInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid', paidAt: new Date().toISOString(), paymentMethod: method || 'credit_card' } : inv));
    recordAudit('Billing', 'PAY_INVOICE', invoiceId, `Settled via ${method}`);
    showToast({ variant: 'success', title: `Invoice Paid: ${invoiceId}`, description: `Settled via ${method || 'credit_card'}` });
  };

  const createInvoice = (inv: Partial<Invoice>): Invoice => {
    const id = `INV-${Math.floor(9100 + Math.random() * 800)}`;
    const newInv: Invoice = {
      id,
      tenantId: activeTenant.id,
      customerName: inv.customerName || currentUser.name,
      customerEmail: inv.customerEmail || currentUser.email,
      organization: inv.organization || activeTenant.name,
      amount: inv.amount || 250,
      currency: inv.currency || activeTenant.currency,
      status: 'pending',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      lineItems: inv.lineItems || [{ description: 'IT Service Fee', quantity: 1, unitPrice: inv.amount || 250 }],
      notes: inv.notes || 'Net 14 payment terms.'
    };
    setAllInvoices(prev => [newInv, ...prev]);
    recordAudit('Billing', 'CREATE_INVOICE', id, `${newInv.currency} ${newInv.amount}`);
    showToast({ variant: 'success', title: `Invoice Created: ${id}`, description: `${newInv.currency} ${newInv.amount}` });
    return newInv;
  };

  const workspaceTotals = useMemo(
    () => ({
      companies: tenants.length,
      companyLogos: tenants.filter(
        t =>
          Boolean(t.companyLogoDataUrl) ||
          Boolean(t.portalBranding?.employees?.logoDataUrl) ||
          Boolean(t.portalBranding?.enduser?.logoDataUrl) ||
          Boolean(t.portalBranding?.iam?.logoDataUrl)
      ).length,
      users: authAccounts.length,
      policies: allIamPolicies.length,
      kbArticles: allKb.length,
      wikiPages: allWikiPages.length,
      incidents: allIncidents.length,
      requests: allRequests.length,
      problems: allProblems.length,
      changes: allChanges.length,
      assets: allAssets.length,
      tasks: allTasks.length,
      calls: allCalls.length,
    }),
    [
      tenants, authAccounts.length, allIamPolicies.length, allKb.length,
      allWikiPages.length, allIncidents.length, allRequests.length,
      allProblems.length, allChanges.length, allAssets.length, allTasks.length, allCalls.length,
    ]
  );

  // Reload Full Preloaded Enterprise Seed Dataset
  const loadEnterpriseSeedData = () => {
    const seed = generateEnterpriseSeedBundle();
    setTenants(seed.tenants);
    setActiveTenantId(seed.tenants[0].id);
    setAuthAccounts(seed.authAccounts);
    setAllIamPolicies(seed.iamPolicies);
    setAllIncidents(seed.incidents);
    setAllRequests(seed.requests);
    setAllProblems(seed.problems);
    setAllChanges(seed.changes);
    setAllAssets(seed.assets);
    setAllInventory(seed.inventory);
    setAllCalls(seed.calls);
    setAllInvoices(seed.invoices);
    setAllSoftware(seed.software);
    setAllTasks(seed.tasks);
    setAllProjects(seed.projects);
    setAllKb(seed.kbArticles);
    setAllContracts(seed.contracts);
    setAllDomains(seed.domains);
    setAllStatusComponents(seed.statusComponents);
    setAllMorningChecks(seed.morningChecks);
    setAllCalendarEvents(seed.calendarEvents);
    setAllWarRooms(seed.warRooms);
    setAllLmsCourses(seed.lmsCourses);
    setAllWikiPages(seed.wikiPages);
    setAllProcessMaps(seed.processMaps);
    setAllCustomForms(seed.customForms);
    setAllCmdbRelations(seed.cmdbRelations);
    setAllAuditLogs(seed.auditLogs);
    setAllWorkflows(seed.workflows);
    setAllTicketWorkflows(seed.ticketWorkflows);
    setTelephonyConfigsByTenant(seed.telephonyConfigsByTenant);
    showToast({
      variant: 'success',
      title: 'Enterprise Seed Dataset Loaded',
      description: `${seed.tenants.length} companies, ${seed.authAccounts.length} users, ${seed.iamPolicies.length} policies, ${seed.kbArticles.length} KBs, ${seed.incidents.length} incidents, ${seed.requests.length} requests & ${seed.assets.length} assets ready.`,
    });
  };

  // Reset to Blank Workspace (Super Admin Exclusive)
  const resetDatabase = () => {
    if (!requireSuperAdmin('Reset Workspace Database')) return;
    localStorage.clear();
    setTenants([DEFAULT_BLANK_TENANT]);
    setActiveTenantId(DEFAULT_BLANK_TENANT.id);
    setAllIncidents([]);
    setAllRequests([]);
    setAllProblems([]);
    setAllChanges([]);
    setAllAssets([]);
    setAllInventory([]);
    setAllCalls([]);
    setAllInvoices([]);
    setAllSoftware([]);
    setAllTasks([]);
    setAllProjects([]);
    setAllKb([]);
    setAllContracts([]);
    setAllDomains([]);
    setAllStatusComponents([]);
    setAllMorningChecks([]);
    setAllCalendarEvents([]);
    setAllWarRooms([]);
    setAllLmsCourses([]);
    setAllWikiPages([]);
    setAllProcessMaps([]);
    setAllCustomForms([]);
    setAllCmdbRelations([]);
    setAllAuditLogs([]);
    setAllWorkflows([]);
    setAllTicketWorkflows([]);
    setDeviceEnrollmentCodes([]);
    setEnrolledDevices([]);
    setManagedDevice(null);
    setAllIamPolicies(DEFAULT_IAM_POLICIES);
    setAuthAccounts(DEFAULT_TEST_ENV_ACCOUNTS);
    showToast({ variant: 'info', title: 'Workspace Reset', description: 'Tenant data restored to blank baseline.' });
  };

  const exportDatabaseJSON = (): string => {
    showToast({ variant: 'info', title: 'Export Generated', description: `Full workspace snapshot prepared for ${activeTenant.name}.` });
    return JSON.stringify({
      version: '4.1-CorporateGov-MultiTenant',
      exportedAt: new Date().toISOString(),
      activeTenant: activeTenant.id,
      tenantName: activeTenant.name,
      tenants,
      incidents: allIncidents,
      requests: allRequests,
      problems: allProblems,
      changes: allChanges,
      assets: allAssets,
      inventory: allInventory,
      softwareLicenses: allSoftware,
      tasks: allTasks,
      projects: allProjects,
      kbArticles: allKb,
      contracts: allContracts,
      domains: allDomains,
      statusComponents: allStatusComponents,
      morningChecks: allMorningChecks,
      calendarEvents: allCalendarEvents,
      warRooms: allWarRooms,
      lmsCourses: allLmsCourses,
      wikiPages: allWikiPages,
      processMaps: allProcessMaps,
      customForms: allCustomForms,
      cmdbRelations: allCmdbRelations,
      calls: allCalls,
      invoices: allInvoices,
      workflows: allWorkflows,
      ticketWorkflows: allTicketWorkflows,
      telephonyConfigsByTenant,
      deviceEnrollmentCodes,
      enrolledDevices,
      auditLogs: allAuditLogs
    }, null, 2);
  };

  const importDatabaseJSON = (jsonStr: string): boolean => {
    if (!requireSuperAdmin('Import Database Snapshot')) return false;
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.tenants) && data.tenants.length > 0) setTenants(data.tenants);
      if (Array.isArray(data.incidents)) setAllIncidents(data.incidents);
      if (Array.isArray(data.requests)) setAllRequests(data.requests);
      if (Array.isArray(data.problems)) setAllProblems(data.problems);
      if (Array.isArray(data.changes)) setAllChanges(data.changes);
      if (Array.isArray(data.assets)) setAllAssets(data.assets);
      if (Array.isArray(data.inventory)) setAllInventory(data.inventory);
      if (Array.isArray(data.workflows)) setAllWorkflows(data.workflows);
      if (Array.isArray(data.ticketWorkflows)) setAllTicketWorkflows(data.ticketWorkflows);
      if (Array.isArray(data.processMaps)) setAllProcessMaps(data.processMaps);
      if (Array.isArray(data.deviceEnrollmentCodes)) setDeviceEnrollmentCodes(data.deviceEnrollmentCodes);
      if (Array.isArray(data.enrolledDevices)) setEnrolledDevices(data.enrolledDevices);
      if (data.telephonyConfigsByTenant && typeof data.telephonyConfigsByTenant === 'object') {
        setTelephonyConfigsByTenant(data.telephonyConfigsByTenant);
      }
      showToast({ variant: 'success', title: 'Database Snapshot Imported', description: 'Records restored and queued for cloud sync.' });
      return true;
    } catch {
      showToast({ variant: 'error', title: 'Import Failed', description: 'Invalid JSON snapshot format.' });
      return false;
    }
  };

  return (
    <ITSMContext.Provider
      value={{
        tenants, activeTenantId, activeTenant, switchTenant, createTenant, updateTenant, toggleTenantModule, isModuleEnabled,
        updateTenantPortalBranding, applyCompanyLogoToAllPortals, getPortalBranding,
        role, setRole, activeTab, setActiveTab, currentUser,
        authSession, authAccounts, isSuperAdmin, isIamPortal, managedDevice, isManagedDeviceVerified,
        deviceEnrollmentCodes, enrolledDevices,
        registerAccount, loginWithCredentials, loginAsTestAccount,
        generateDeviceEnrollmentCode, revokeDeviceEnrollmentCode, revokeEnrolledDevice,
        enrollCompanyDevice, unenrollCompanyDevice, loginEmployeeDeviceSso, loginViaGooglePortal, logoutSession,
        iamPolicies, createIamIdentity, updateIamIdentity, deleteIamIdentity, createIamPolicy, deleteIamPolicy, hasPermission,
        googleUser, googleToken, loginWithGoogle, loginWithGooglePortal, logoutGoogle, isFirebaseConnected,
        cloudSyncStatus, lastCloudSyncAt, cloudSyncError, forceCloudSync,
        backendSyncStatus, lastBackendSyncAt, backendSyncError, isBackendApiMode, syncWithBackend, loginWithBackendApi,
        incidents, requests, problems, changes, assets, inventory, calls, invoices, activeCall,
        softwareLicenses, tasks, projects, kbArticles, contracts, domains, statusComponents,
        morningChecks, calendarEvents, warRooms, lmsCourses, wikiPages, processMaps,
        customForms, cmdbRelations, auditLogs, workflows, ticketWorkflows,
        createIncident, updateIncidentStatus, assignIncident, logIncidentTime, setIncidentCsat, simulateEmailToTicket,
        createServiceRequest, canApproveRequestStage, approveRequestStage, reassignRequestApprover, createProblem, updateProblem,
        createChangeRequest, canVoteCab, voteCab, reassignCabVoter, updateChangeStatus, addRecordActivity,
        createAsset, updateAssetStatus, addCmdbRelation, removeCmdbRelation,
        updateInventoryQuantity, createInventoryItem, createSoftwareLicense, adjustSoftwareSeats,
        createTask, moveTaskColumn, toggleSubtask, logTaskTime,
        createProject, updateProjectStage,
        createKbArticle, voteKbHelpful,
        createContract, updateContractStatus,
        createDomainRecord, updateComponentHealth, submitMorningCheckRun, createCalendarEvent,
        createWarRoom, postWarRoomMessage, toggleWarRoomChecklist, closeWarRoom,
        toggleLmsLesson, completeLmsQuiz,
        createWikiPage, updateWikiPage,
        createProcessMap, updateProcessMap, deleteProcessMap, addProcessNode,
        createCustomForm, toggleFormPublish, submitCustomFormToRequest,
        createWorkflow, updateWorkflow, toggleWorkflowStatus, runWorkflowExecution, deleteWorkflow,
        createTicketWorkflow, toggleTicketWorkflow, deleteTicketWorkflow,
        telephonyConfig, updateTelephonyConfig, startTelephonyCall, appendCallNote, simulateIncomingCall, answerIncomingCall, endTelephonyCall, toggleHoldCall, popTicketFromCall,
        payInvoice, createInvoice,
        toasts, showToast, dismissToast, clearToasts,
        theme, setTheme, toggleTheme,
        workspaceTotals, loadEnterpriseSeedData,
        resetDatabase, exportDatabaseJSON, importDatabaseJSON
      }}
    >
      {children}
    </ITSMContext.Provider>
  );
};

export const useITSM = () => {
  const context = useContext(ITSMContext);
  if (!context) throw new Error('useITSM must be used within an ITSMProvider');
  return context;
};
