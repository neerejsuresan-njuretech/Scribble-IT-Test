export type Role = 'admin' | 'technician' | 'customer';

export type FreeITSMModuleId =
  | 'watchtower'
  | 'dashboard'
  | 'incidents'
  | 'requests'
  | 'problems'
  | 'changes'
  | 'assets'
  | 'network_map'
  | 'inventory'
  | 'software'
  | 'tasks'
  | 'projects'
  | 'knowledge'
  | 'contracts'
  | 'domains'
  | 'status_page'
  | 'morning_checks'
  | 'calendar'
  | 'war_room'
  | 'lms'
  | 'wiki'
  | 'process_mapper'
  | 'workflow_management'
  | 'ticket_workflow'
  | 'custom_forms'
  | 'reports'
  | 'telephony'
  | 'billing'
  | 'database'
  | 'iam'
  | 'google_workspace';

export type AuthPortalType = 'super_admin' | 'employee' | 'end_user' | 'iam';

export type IamPermissionScope =
  | 'incidents:read'
  | 'incidents:write'
  | 'assets:read'
  | 'assets:write'
  | 'requests:approve'
  | 'changes:cab_vote'
  | 'workflows:manage'
  | 'iam:manage'
  | 'tenants:admin'
  | 'billing:read';

export interface IamPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  permissions: IamPermissionScope[];
  mfaRequired: boolean;
  ssoOnly: boolean;
  createdAt: string;
}

export interface AuthAccount {
  id: string;
  portalType: AuthPortalType;
  role: Role;
  name: string;
  email: string;
  password: string;
  department: string;
  companyId?: string;
  tenantId?: string;
  policyIds?: string[];
  status?: 'active' | 'suspended';
  mfaEnabled?: boolean;
  createdAt: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  portalType: AuthPortalType;
  role: Role;
  name: string;
  email: string;
  department: string;
  authMethod: 'admin_credentials' | 'employee_sso' | 'employee_password' | 'portal_login' | 'iam_credentials' | 'google_oauth';
  deviceManaged: boolean;
  deviceId?: string;
  companyId?: string;
  policyIds?: string[];
  authenticatedAt: string;
}

export interface ManagedDeviceTrust {
  deviceId: string;
  hostname: string;
  osPlatform: string;
  mdmProvider: string;
  domain: string;
  enrolledAt: string;
  certificateThumbprint: string;
}

export type CustomPortalKey = 'employees' | 'enduser' | 'iam';

export interface PortalBrandConfig {
  portalName: string;
  subtitle: string;
  logoDataUrl?: string;
}

export interface TenantPortalBranding {
  employees: PortalBrandConfig;
  enduser: PortalBrandConfig;
  iam: PortalBrandConfig;
}

export interface TenantPreferenceTemplate {
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  defaultQueue: string;
  autoAssignRota: boolean;
  requireCabForNormalChange: boolean;
  portalBannerTitle: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  companyCode?: string;
  domain: string;
  plan: 'Enterprise' | 'Managed MSP' | 'Dedicated';
  region: string;
  timezone: string;
  currency: 'USD' | 'GBP' | 'EUR';
  primaryContactEmail: string;
  status: 'active' | 'suspended';
  slaTargets: {
    P1: number; // hours
    P2: number;
    P3: number;
    P4: number;
  };
  enabledModules: Record<FreeITSMModuleId, boolean>;
  preferenceTemplate: TenantPreferenceTemplate;
  portalBranding?: TenantPortalBranding;
  createdAt: string;
}

export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type IncidentCategory = 'hardware' | 'software' | 'network' | 'security' | 'access' | 'telephony';

export type ActivityType = 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  author: string;
  type?: ActivityType;
  action: string;
  note: string;
  fieldChanges?: FieldChange[];
}

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  urgency: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  category: IncidentCategory;
  requesterName: string;
  requesterEmail: string;
  assignee: string;
  assignmentGroup?: string;
  affectedCI?: string;
  slaDeadline: string;
  slaBreached: boolean;
  timeLoggedMins?: number;
  csatScore?: number;
  sourceChannel?: 'portal' | 'email' | 'phone' | 'monitor';
  createdAt: string;
  updatedAt: string;
  resolutionNotes?: string;
  activityLog: ActivityEntry[];
}

export type RequestStatus = 'submitted' | 'manager_approved' | 'security_review' | 'fulfillment' | 'completed' | 'rejected';

export interface RequestApproval {
  role: string;
  approver: string;
  status: 'approved' | 'pending' | 'rejected';
  timestamp?: string;
  notes?: string;
}

export interface ServiceRequest {
  id: string;
  tenantId: string;
  catalogItemId: string;
  catalogItemName: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  cost: number;
  status: RequestStatus;
  currentStage: number; // 1 to 4
  approvals: RequestApproval[];
  deliveryEstimateDays: number;
  deliveryDate?: string;
  customFormValues?: Record<string, string>;
  createdAt: string;
}

export type ProblemStatus = 'investigating' | 'root_cause_identified' | 'workaround_published' | 'change_requested' | 'closed';

export interface Problem {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: ProblemStatus;
  severity: 'critical' | 'high' | 'moderate' | 'minor';
  rootCauseAnalysis: string;
  workaround: string;
  permanentSolution: string;
  linkedIncidentIds: string[];
  linkedChangeId?: string;
  owner: string;
  isKnownError: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChangeType = 'standard' | 'normal' | 'emergency';
export type ChangeStatus = 'draft' | 'cab_review' | 'scheduled' | 'implementation' | 'verification' | 'completed' | 'cancelled';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CabVote {
  member: string;
  role: string;
  vote: 'approved' | 'rejected' | 'pending';
  notes?: string;
}

export interface ChangeRequest {
  id: string;
  tenantId: string;
  title: string;
  type: ChangeType;
  status: ChangeStatus;
  riskScore: RiskLevel;
  reason: string;
  implementationPlan: string;
  rollbackPlan: string;
  testPlan: string;
  scheduledStart: string;
  scheduledEnd: string;
  cabVotes: CabVote[];
  requestedBy: string;
  assignedEngineer: string;
  createdAt: string;
  updatedAt?: string;
  activityLog?: ActivityEntry[];
}

export type AssetType =
  | 'laptop'
  | 'server'
  | 'networking'
  | 'workstation'
  | 'mobile'
  | 'security_key'
  | 'monitor'
  | 'peripherals'
  | 'consumables'
  | 'others';
export type AssetStatus = 'in_use' | 'in_stock' | 'maintenance' | 'retired';

export interface Asset {
  id: string;
  tenantId: string;
  assetTag: string;
  name: string;
  type: AssetType;
  serialNumber: string;
  macAddress?: string;
  ipAddress?: string;
  syncSource?: 'manual' | 'vcenter' | 'intune';
  model: string;
  manufacturer: string;
  status: AssetStatus;
  assignedTo?: string;
  department?: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  purchaseCost: number;
  currentBookValue: number;
  qrCodeData: string;
}

export interface CmdbRelation {
  id: string;
  tenantId: string;
  sourceId: string;
  targetId: string;
  relationType: 'depends_on' | 'hosts' | 'connects_to' | 'backed_up_by' | 'secured_by';
  criticality: 'critical' | 'high' | 'standard';
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: 'peripherals' | 'cabling' | 'components' | 'storage' | 'accessories';
  quantity: number;
  minThreshold: number;
  unitCost: number;
  location: string;
  lastRestocked: string;
}

export interface SoftwareLicense {
  id: string;
  tenantId: string;
  name: string;
  vendor: string;
  version: string;
  licenseType: 'per_seat' | 'site' | 'floating' | 'open_source';
  totalSeats: number;
  usedSeats: number;
  annualCost: number;
  renewalDate: string;
  source: 'Intune' | 'PowerShell' | 'Manual';
  complianceStatus: 'compliant' | 'over_allocated' | 'expiring_soon';
}

export type TaskColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  column: TaskColumn;
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  dueDate: string;
  timeLoggedMins: number;
  linkedRecordId?: string;
  projectId?: string;
  subtasks: TaskSubtask[];
  createdAt: string;
}

export type ProjectStage = 'initiation' | 'planning' | 'execution' | 'uat' | 'closed';

export interface ProjectItem {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  owner: string;
  stage: ProjectStage;
  health: 'on_track' | 'at_risk' | 'delayed';
  progressPct: number;
  budgetTotal: number;
  budgetSpent: number;
  startDate: string;
  targetEndDate: string;
  summary: string;
}

export interface KnowledgeArticle {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  visibility: 'public' | 'internal';
  author: string;
  views: number;
  helpfulVotes: number;
  tags: string[];
  content: string;
  updatedAt: string;
}

export interface ContractRecord {
  id: string;
  tenantId: string;
  title: string;
  vendor: string;
  type: 'hardware' | 'software' | 'telecom_sim' | 'cloud' | 'support';
  annualValue: number;
  startDate: string;
  renewalDate: string;
  noticeDays: number;
  autoRenew: boolean;
  linkedAssetIds: string[];
  status: 'active' | 'expiring_soon' | 'rfp_open' | 'expired';
  rfpNotes?: string;
}

export interface DomainRecord {
  id: string;
  tenantId: string;
  domain: string;
  registrar: string;
  domainExpiry: string;
  sslExpiry: string;
  securityGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  dnssecEnabled: boolean;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcPolicy: 'reject' | 'quarantine' | 'none';
  registrarLocked: boolean;
  lookalikeAlerts: number;
}

export type ComponentHealth = 'operational' | 'degraded' | 'partial_outage' | 'major_outage';

export interface ServiceStatusComponent {
  id: string;
  tenantId: string;
  name: string;
  group: 'Core Platform' | 'Network & Edge' | 'Identity & Auth' | 'Customer Portal';
  status: ComponentHealth;
  uptimePct: number;
  latencyMs: number;
  linkedIncidentId?: string;
  updatedAt: string;
}

export interface MorningCheckItem {
  id: string;
  label: string;
  category: 'Infrastructure' | 'Backups' | 'Security' | 'Network' | 'Databases';
  status: 'pass' | 'warn' | 'fail' | 'pending';
  note?: string;
}

export interface MorningCheckRun {
  id: string;
  tenantId: string;
  date: string;
  engineer: string;
  items: MorningCheckItem[];
  completedAt: string;
}

export interface CalendarEvent {
  id: string;
  tenantId: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'change' | 'contract_renewal' | 'ssl_expiry' | 'project_milestone' | 'duty_rota';
  owner: string;
  linkedId?: string;
}

export interface WarRoomMessage {
  id: string;
  timestamp: string;
  author: string;
  role: string;
  message: string;
}

export interface WarRoomSession {
  id: string;
  tenantId: string;
  incidentId: string;
  title: string;
  severity: 'P1' | 'P2';
  status: 'active' | 'monitoring' | 'closed';
  commander: string;
  bridgeNumber: string;
  startedAt: string;
  checklist: { id: string; label: string; done: boolean }[];
  feed: WarRoomMessage[];
}

export interface LmsCourse {
  id: string;
  tenantId: string;
  title: string;
  category: 'Security' | 'ITIL' | 'Compliance' | 'Operations';
  durationMins: number;
  mandatory: boolean;
  lessons: { id: string; title: string; summary: string; completed: boolean }[];
  scorePct?: number;
  certified: boolean;
}

export interface WikiPage {
  id: string;
  tenantId: string;
  title: string;
  section: 'Architecture' | 'Runbooks' | 'SOPs' | 'Onboarding';
  author: string;
  updatedAt: string;
  content: string;
}

export type ProcessNodeType =
  | 'start'
  | 'action'
  | 'decision'
  | 'approval'
  | 'notification'
  | 'automation'
  | 'end';

export interface ProcessNode {
  id: string;
  label: string;
  type: ProcessNodeType;
  role: string;
  x: number;
  y: number;
  slaHours?: number;
  moduleId?: FreeITSMModuleId | 'all';
  description?: string;
  approverGroup?: string;
}

export interface ProcessEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface ProcessMap {
  id: string;
  tenantId: string;
  title: string;
  recordScope?: 'incident' | 'request' | 'change' | 'general';
  owner: string;
  linkedKbId?: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  updatedAt: string;
}

export interface CustomFormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox';
  required: boolean;
  options?: string[];
}

export interface CustomFormDefinition {
  id: string;
  tenantId: string;
  title: string;
  category: 'hardware' | 'software' | 'access' | 'cloud' | 'telephony';
  publishedToPortal: boolean;
  fields: CustomFormField[];
  submissionsCount: number;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  timestamp: string;
  actor: string;
  module: string;
  action: string;
  targetId: string;
  detail: string;
}

export type TelephonyProviderType =
  | 'amazon_connect'
  | 'twilio'
  | 'sip_webrtc'
  | 'ringcentral'
  | 'genesys'
  | 'custom_provider'
  | 'personal_mobile';

export interface TelephonyProviderConfig {
  providerType: TelephonyProviderType;
  providerLabel: string;
  // Amazon Connect CCP settings
  amazonConnectInstanceAlias?: string;
  amazonConnectRegion?: string;
  amazonConnectCcpUrl?: string;
  amazonConnectQueueArn?: string;
  // Generic SIP / WebRTC settings
  sipWssUrl?: string;
  sipDomain?: string;
  sipExtension?: string;
  stunServer?: string;
  // Generic / Custom Provider / RingCentral / Genesys / Twilio webhook
  customCtiEmbedUrl?: string;
  outboundWebhookUrl?: string;
  callerIdNumber?: string;
  // Personal Mobile Number as Telephony System
  personalMobileEnabled?: boolean;
  personalMobileNumber?: string;
  personalMobileCountryCode?: string;
  personalMobileBridgeMode?: 'native_dialer' | 'qr_handoff' | 'carrier_two_leg';
  forwardToDeskNumber?: string;
  autoPopTicketOnInbound?: boolean;
  updatedAt?: string;
}

export interface TelephonyCall {
  id: string;
  tenantId: string;
  callerNumber: string;
  callerName: string;
  callerCompany: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'active' | 'held' | 'completed' | 'missed';
  startTime: string;
  durationSec: number;
  liveTranscript: string[];
  relatedTicketId?: string;
  providerType?: TelephonyProviderType;
  providerLabel?: string;
  disposition?: 'incident_logged' | 'inquiry_resolved' | 'escalated' | 'voicemail';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerName: string;
  customerEmail: string;
  organization: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'overdue';
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: 'credit_card' | 'wire_ach' | 'purchase_order' | 'stripe';
  lineItems: InvoiceItem[];
  notes?: string;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: 'hardware' | 'software' | 'access' | 'cloud' | 'telephony' | 'peripherals' | 'consumables' | 'others';
  price: number;
  estimatedHours: number;
  requiresApproval: boolean;
  tags: string[];
}

export type WorkflowTrigger =
  | 'service_request'
  | 'change_request'
  | 'asset_lifecycle'
  | 'employee_onboarding'
  | 'module_event'
  | 'schedule'
  | 'manual';

export interface WorkflowTriggerConfig {
  moduleId: FreeITSMModuleId | 'all';
  eventKey: string;
  eventLabel: string;
  conditionField?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'greater_than';
  conditionValue?: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  stepType: 'approval' | 'task' | 'condition' | 'notification' | 'automation' | 'delay' | 'module_action';
  moduleId?: FreeITSMModuleId | 'all';
  actionKey?: string;
  actionLabel?: string;
  assigneeRole: string;
  slaHours: number;
  branch?: 'main' | 'if_yes' | 'if_no';
  config?: Record<string, string>;
}

export interface WorkflowRunStepTrace {
  stepId: string;
  stepName: string;
  moduleLabel: string;
  actionLabel: string;
  status: 'succeeded' | 'skipped';
  detail: string;
  executedAt: string;
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  targetModuleId?: FreeITSMModuleId | 'all';
  trigger: WorkflowTrigger;
  triggerConfig?: WorkflowTriggerConfig;
  description: string;
  status: 'active' | 'draft' | 'paused';
  stages: WorkflowStage[];
  executionCount: number;
  lastExecutedAt?: string;
  lastRunTrace?: WorkflowRunStepTrace[];
  updatedAt: string;
}

export interface TicketWorkflowRule {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  sourceChannel: 'all' | 'portal' | 'email' | 'phone' | 'monitor';
  matchCategory: 'all' | IncidentCategory;
  matchPriority: 'all' | IncidentPriority;
  assignToQueue: string;
  overrideSlaHours?: number;
  autoEscalateAfterMins?: number;
  allowedTransitions: Record<IncidentStatus, IncidentStatus[]>;
  notifyRoles: string[];
  executionCount: number;
  updatedAt: string;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs?: number;
  createdAt: string;
}

export type ThemeMode = 'dark' | 'light';


