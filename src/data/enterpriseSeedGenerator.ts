import {
  Tenant,
  AuthAccount,
  AuthPortalType,
  Role,
  IamPolicy,
  IamPermissionScope,
  Incident,
  IncidentCategory,
  IncidentPriority,
  IncidentStatus,
  ServiceRequest,
  RequestStatus,
  Problem,
  ProblemStatus,
  ChangeRequest,
  ChangeStatus,
  ChangeType,
  RiskLevel,
  Asset,
  AssetStatus,
  AssetType,
  InventoryItem,
  SoftwareLicense,
  TaskItem,
  TaskColumn,
  ProjectItem,
  ProjectStage,
  KnowledgeArticle,
  ContractRecord,
  DomainRecord,
  ServiceStatusComponent,
  MorningCheckRun,
  CalendarEvent,
  WarRoomSession,
  LmsCourse,
  WikiPage,
  ProcessMap,
  CustomFormDefinition,
  CmdbRelation,
  AuditLogEntry,
  WorkflowDefinition,
  TicketWorkflowRule,
  TelephonyCall,
  TelephonyProviderConfig,
  Invoice,
} from '../types/itsm';
import { createAllEnabledModules } from './freeitsmSeedData';

export interface EnterpriseSeedBundle {
  tenants: Tenant[];
  authAccounts: AuthAccount[];
  iamPolicies: IamPolicy[];
  incidents: Incident[];
  requests: ServiceRequest[];
  problems: Problem[];
  changes: ChangeRequest[];
  assets: Asset[];
  inventory: InventoryItem[];
  software: SoftwareLicense[];
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
  calls: TelephonyCall[];
  invoices: Invoice[];
  telephonyConfigsByTenant: Record<string, TelephonyProviderConfig>;
}

/**
 * Creates a crisp, lightweight SVG data URL emblem for each company profile.
 * Compact (~450 bytes each) so localStorage and Firestore stay fast and well under quota.
 */
function makeCompanyLogoSvg(
  bg: string,
  accent: string,
  accent2: string,
  monogram: string,
  shape: 'prism' | 'helix' | 'meridian' | 'compass' | 'shield' | 'solar' | 'delta' | 'hex'
): string {
  let glyph = '';
  switch (shape) {
    case 'prism':
      glyph = `<polygon points="32,10 54,48 10,48" fill="none" stroke="${accent}" stroke-width="3.5" stroke-linejoin="round"/><polygon points="32,20 44,42 20,42" fill="${accent2}" opacity="0.9"/>`;
      break;
    case 'helix':
      glyph = `<circle cx="24" cy="24" r="11" fill="none" stroke="${accent}" stroke-width="3.5"/><circle cx="40" cy="40" r="11" fill="none" stroke="${accent2}" stroke-width="3.5"/><line x1="24" y1="35" x2="40" y2="29" stroke="#ffffff" stroke-width="2.5"/>`;
      break;
    case 'meridian':
      glyph = `<circle cx="32" cy="32" r="20" fill="none" stroke="${accent}" stroke-width="3"/><ellipse cx="32" cy="32" rx="9" ry="20" fill="none" stroke="${accent2}" stroke-width="2.5"/><line x1="12" y1="32" x2="52" y2="32" stroke="${accent}" stroke-width="2.5"/>`;
      break;
    case 'compass':
      glyph = `<rect x="14" y="14" width="36" height="36" rx="6" fill="none" stroke="${accent}" stroke-width="3"/><polygon points="32,16 38,32 32,48 26,32" fill="${accent2}"/>`;
      break;
    case 'shield':
      glyph = `<path d="M32 10 L50 17 V33 C50 44 41 51 32 55 C23 51 14 44 14 33 V17 Z" fill="none" stroke="${accent}" stroke-width="3.5"/><path d="M29 24 H35 V30 H41 V36 H35 V42 H29 V36 H23 V30 H29 Z" fill="${accent2}"/>`;
      break;
    case 'solar':
      glyph = `<circle cx="32" cy="32" r="11" fill="${accent2}"/><circle cx="32" cy="32" r="19" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="6 4"/>`;
      break;
    case 'delta':
      glyph = `<polygon points="32,11 53,49 32,40 11,49" fill="${accent}" opacity="0.9"/><polygon points="32,18 43,43 32,37 21,43" fill="${accent2}"/>`;
      break;
    case 'hex':
      glyph = `<polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="none" stroke="${accent}" stroke-width="3.5"/><polygon points="32,20 42,26 42,38 32,44 22,38 22,26" fill="${accent2}"/>`;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${bg}"/>${glyph}<text x="56" y="60" text-anchor="end" font-family="monospace" font-size="9" font-weight="700" fill="#ffffff" opacity="0.85">${monogram}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const COMPANY_SPECS: Array<{
  id: string;
  name: string;
  slug: string;
  companyCode: string;
  domain: string;
  plan: Tenant['plan'];
  region: string;
  timezone: string;
  currency: Tenant['currency'];
  phonePrefix: string;
  industry: string;
  locations: string[];
  logo: string;
}> = [
  {
    id: 'tenant-default',
    name: 'Njure Tech HQ',
    slug: 'njure-tech',
    companyCode: 'COMP-NJURE-01',
    domain: 'njuretech.io',
    plan: 'Enterprise',
    region: 'asia-south1',
    timezone: 'Asia/Kolkata',
    currency: 'USD',
    phonePrefix: '+1415',
    industry: 'Cloud Infrastructure & Enterprise SaaS',
    locations: ['Bengaluru HQ · Floor 5', 'San Francisco DC-01', 'London NOC', 'Singapore Edge'],
    logo: makeCompanyLogoSvg('#0b1120', '#f43f5e', '#38bdf8', 'NT', 'prism'),
  },
  {
    id: 'tenant-apex',
    name: 'Apex Genomics Lab',
    slug: 'apex-genomics',
    companyCode: 'COMP-APEX-02',
    domain: 'apexgenomics.org',
    plan: 'Dedicated',
    region: 'eu-west2',
    timezone: 'Europe/London',
    currency: 'GBP',
    phonePrefix: '+4420',
    industry: 'Biotech & High-Performance Sequencing',
    locations: ['Cambridge BioPark', 'Oxford WetLab-B', 'Zurich Compute Vault'],
    logo: makeCompanyLogoSvg('#081c24', '#22d3ee', '#818cf8', 'AG', 'helix'),
  },
  {
    id: 'tenant-meridian',
    name: 'Meridian FinTech Corp',
    slug: 'meridian-fintech',
    companyCode: 'COMP-MERIDIAN-03',
    domain: 'meridianfin.com',
    plan: 'Enterprise',
    region: 'us-east1',
    timezone: 'America/New_York',
    currency: 'USD',
    phonePrefix: '+1212',
    industry: 'Low-Latency Payments & Clearing',
    locations: ['Manhattan Trading Tower', 'Secaucus Colo-NY4', 'Chicago Risk Hub'],
    logo: makeCompanyLogoSvg('#18130a', '#f59e0b', '#fbbf24', 'MF', 'meridian'),
  },
  {
    id: 'tenant-orion',
    name: 'Orion Logistics EU',
    slug: 'orion-logistics',
    companyCode: 'COMP-ORION-04',
    domain: 'orionlogistics.eu',
    plan: 'Managed MSP',
    region: 'eu-west2',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    phonePrefix: '+4930',
    industry: 'Autonomous Freight & Cold-Chain Telemetry',
    locations: ['Rotterdam Port Hub', 'Hamburg Dispatch', 'Frankfurt Core'],
    logo: makeCompanyLogoSvg('#0a192f', '#38bdf8', '#34d399', 'OL', 'compass'),
  },
  {
    id: 'tenant-vanguard',
    name: 'Vanguard Health Systems',
    slug: 'vanguard-health',
    companyCode: 'COMP-VANGUARD-05',
    domain: 'vanguardhealth.org',
    plan: 'Dedicated',
    region: 'us-east1',
    timezone: 'America/Chicago',
    currency: 'USD',
    phonePrefix: '+1312',
    industry: 'Clinical EHR & Hospital Telemetry',
    locations: ['Chicago Medical Center', 'Boston Clinical Wing', 'Dallas Telehealth NOC'],
    logo: makeCompanyLogoSvg('#1f0d14', '#fb7185', '#f43f5e', 'VH', 'shield'),
  },
  {
    id: 'tenant-solstice',
    name: 'Solstice Energy Grid',
    slug: 'solstice-energy',
    companyCode: 'COMP-SOLSTICE-06',
    domain: 'solsticegrid.io',
    plan: 'Enterprise',
    region: 'eu-west2',
    timezone: 'Europe/Stockholm',
    currency: 'EUR',
    phonePrefix: '+4685',
    industry: 'Renewable Microgrid & SCADA Operations',
    locations: ['Stockholm Grid Control', 'Oslo Substation Hub', 'Copenhagen Wind Ops'],
    logo: makeCompanyLogoSvg('#1a1207', '#fb923c', '#facc15', 'SE', 'solar'),
  },
  {
    id: 'tenant-atlas',
    name: 'Atlas Aerospace Mfg',
    slug: 'atlas-aerospace',
    companyCode: 'COMP-ATLAS-07',
    domain: 'atlasaero.com',
    plan: 'Dedicated',
    region: 'us-east1',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    phonePrefix: '+1206',
    industry: 'Avionics PLM & Precision Manufacturing',
    locations: ['Seattle Hangar 4', 'Toulouse Assembly Wing', 'Phoenix Avionics Lab'],
    logo: makeCompanyLogoSvg('#120e24', '#a78bfa', '#38bdf8', 'AA', 'delta'),
  },
  {
    id: 'tenant-cobalt',
    name: 'Cobalt Retail Cloud',
    slug: 'cobalt-retail',
    companyCode: 'COMP-COBALT-08',
    domain: 'cobaltretail.io',
    plan: 'Managed MSP',
    region: 'asia-south1',
    timezone: 'Asia/Singapore',
    currency: 'USD',
    phonePrefix: '+6568',
    industry: 'Omnichannel POS & Global E-Commerce',
    locations: ['Singapore Marina HQ', 'Tokyo POS Gateway', 'Sydney Fulfillment Edge'],
    logo: makeCompanyLogoSvg('#081826', '#60a5fa', '#2dd4bf', 'CR', 'hex'),
  },
];

export const DEFAULT_TEST_ENV_ACCOUNTS: AuthAccount[] = [
  {
    id: 'USR-TEST-ADMIN',
    portalType: 'super_admin',
    role: 'admin',
    name: 'Test Super Admin',
    email: 'admin@njuretech.io',
    password: 'Admin@Scribble2025',
    department: 'Platform Governance',
    jobTitle: 'VP of IT Infrastructure',
    phone: '+14155550101',
    companyId: 'COMP-NJURE-01',
    tenantId: 'tenant-default',
    policyIds: ['POL-SUPER-ADMIN'],
    status: 'active',
    mfaEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-TEST-EMP',
    portalType: 'employee',
    role: 'technician',
    name: 'Test IT Employee',
    email: 'employee@njuretech.io',
    password: 'Employee@Scribble2025',
    department: 'IT Operations',
    jobTitle: 'Lead SRE & Incident Commander',
    phone: '+14155550102',
    companyId: 'COMP-NJURE-01',
    tenantId: 'tenant-default',
    policyIds: ['POL-EMPLOYEE-OPS'],
    status: 'active',
    mfaEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-TEST-IAM',
    portalType: 'iam',
    role: 'technician',
    name: 'Test IAM Administrator',
    email: 'iam@njuretech.io',
    password: 'Iam@Scribble2025',
    department: 'Identity & Access',
    jobTitle: 'Principal IAM Architect',
    phone: '+14155550103',
    companyId: 'COMP-NJURE-01',
    tenantId: 'tenant-default',
    policyIds: ['POL-IAM-ADMIN'],
    status: 'active',
    mfaEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'USR-TEST-PORTAL',
    portalType: 'end_user',
    role: 'customer',
    name: 'Test End User',
    email: 'user@njuretech.io',
    password: 'Portal@Scribble2025',
    department: 'Self-Service',
    jobTitle: 'Product Operations Manager',
    phone: '+14155550104',
    companyId: 'COMP-NJURE-01',
    tenantId: 'tenant-default',
    policyIds: ['POL-END-USER'],
    status: 'active',
    mfaEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const CORE_IAM_POLICIES: IamPolicy[] = [
  {
    id: 'POL-SUPER-ADMIN',
    tenantId: 'tenant-default',
    name: 'Root Tenant Governance',
    description: 'Full access across multi-tenant controls, IAM, workflows, incidents, and CMDB assets.',
    permissions: [
      'incidents:read', 'incidents:write', 'assets:read', 'assets:write',
      'requests:approve', 'changes:cab_vote', 'workflows:manage',
      'iam:manage', 'tenants:admin', 'billing:read',
    ],
    mfaRequired: true,
    ssoOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'POL-EMPLOYEE-OPS',
    tenantId: 'tenant-default',
    name: 'ITIL Operations & CMDB Engineer',
    description: 'Read/write access to incidents, requests, assets, and change reviews.',
    permissions: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write', 'requests:approve', 'changes:cab_vote'],
    mfaRequired: false,
    ssoOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'POL-IAM-ADMIN',
    tenantId: 'tenant-default',
    name: 'IAM Directory & Policy Officer',
    description: 'Create identity IDs, assign company IDs, roles, and access policies.',
    permissions: ['iam:manage', 'incidents:read', 'assets:read', 'workflows:manage'],
    mfaRequired: true,
    ssoOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'POL-END-USER',
    tenantId: 'tenant-default',
    name: 'Self-Service Requester',
    description: 'Scoped read/submit access limited to requester own tickets and assigned assets.',
    permissions: ['incidents:read', 'assets:read'],
    mfaRequired: false,
    ssoOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const FIRST_NAMES = [
  'Aarav', 'Elena', 'Marcus', 'Priya', 'Liam', 'Sophia', 'Kenji', 'Amara',
  'Noah', 'Zara', 'Vikram', 'Hannah', 'Mateo', 'Chloe', 'Rohan', 'Nadia',
  'Julian', 'Meera', 'Owen', 'Freya', 'Tariq', 'Isabel', 'Devon', 'Ananya',
  'Caleb', 'Sienna', 'Arjun', 'Maya', 'Lucas', 'Leila', 'Ethan', 'Kiran',
  'Clara', 'Soren', 'Diya', 'Gavin', 'Yuki', 'Samira', 'Felix', 'Rhea',
  'Nikhil', 'Audrey', 'Declan', 'Farah', 'Siddharth', 'Tessa', 'Omar', 'Iris',
];

const LAST_NAMES = [
  'Patel', 'Vance', 'Chen', 'Nair', 'Okafor', 'Lindqvist', 'Sato', 'Kowalski',
  'Alvarez', 'Bennett', 'Kapoor', 'Haddad', 'Mercer', 'Reyes', 'Desai', 'Fischer',
  'Moreau', 'Sinclair', 'Iyer', 'Novak', 'Kim', 'Bhatia', 'Gallagher', 'Silva',
  'Rao', 'Sterling', 'Weber', 'Menon', 'Thornton', 'Keller', 'Bose', 'Castillo',
];

const DEPARTMENTS = [
  'Cloud Engineering', 'Service Desk L1', 'Service Desk L2', 'Network & Edge NOC',
  'Security Operations (SOC)', 'Identity & Access (IAM)', 'Database Reliability',
  'Workplace Endpoints', 'Platform Automation', 'Compliance & Risk',
  'FinOps & Procurement', 'Enterprise Telephony', 'Product Engineering', 'Customer Success',
];

const JOB_TITLES: Record<Role, string[]> = {
  admin: [
    'Director of IT Operations', 'Head of Platform Governance', 'VP Enterprise Security',
    'Principal Cloud Architect', 'Chief Information Security Officer',
  ],
  technician: [
    'Senior SRE Engineer', 'L2 Incident Specialist', 'Network Reliability Engineer',
    'CMDB & Asset Analyst', 'IAM Policy Engineer', 'Telephony CTI Specialist',
    'SOC Threat Responder', 'Change Advisory Coordinator',
  ],
  customer: [
    'Staff Product Manager', 'Financial Controller', 'Clinical Data Scientist',
    'Logistics Coordinator', 'Account Executive', 'Supply Chain Analyst',
    'Research Biologist', 'Quality Assurance Lead',
  ],
};

const POLICY_TEMPLATES: Array<{
  code: string;
  name: string;
  desc: string;
  perms: IamPermissionScope[];
  mfa: boolean;
  sso: boolean;
}> = [
  { code: 'POL-SOC-L1', name: 'SOC Tier-1 Threat Triage', desc: 'Monitor security incidents and read CMDB asset exposure maps.', perms: ['incidents:read', 'incidents:write', 'assets:read'], mfa: true, sso: true },
  { code: 'POL-SOC-L3', name: 'SOC Tier-3 Incident Commander', desc: 'Full security containment, emergency change approval, and workflow triggers.', perms: ['incidents:read', 'incidents:write', 'assets:read', 'changes:cab_vote', 'workflows:manage'], mfa: true, sso: true },
  { code: 'POL-CAB-CHAIR', name: 'CAB Chair & Release Authority', desc: 'Approve high-risk production changes and review linked incidents.', perms: ['changes:cab_vote', 'incidents:read', 'assets:read', 'requests:approve'], mfa: true, sso: false },
  { code: 'POL-CAB-MEMBER', name: 'CAB Technical Reviewer', desc: 'Cast technical review votes on normal and standard RFCs.', perms: ['changes:cab_vote', 'incidents:read', 'assets:read'], mfa: true, sso: false },
  { code: 'POL-NET-NOC', name: 'Network Operations NOC Engineer', desc: 'Manage network switches, BGP routers, and network P1/P2 queues.', perms: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'], mfa: true, sso: false },
  { code: 'POL-DESK-L1', name: 'Service Desk Tier-1 Agent', desc: 'Triage incoming calls, emails, and portal incidents with KB search.', perms: ['incidents:read', 'incidents:write', 'assets:read'], mfa: false, sso: false },
  { code: 'POL-DESK-L2', name: 'Service Desk Tier-2 Escalation', desc: 'Resolve escalated endpoint, SaaS, and access tickets plus approve low-cost requests.', perms: ['incidents:read', 'incidents:write', 'assets:read', 'requests:approve'], mfa: true, sso: false },
  { code: 'POL-DESK-LEAD', name: 'Service Desk Shift Manager', desc: 'Oversee queues, approve fulfillment workflows, and manage routing rules.', perms: ['incidents:read', 'incidents:write', 'requests:approve', 'workflows:manage'], mfa: true, sso: false },
  { code: 'POL-CMDB-CUST', name: 'CMDB Asset Custodian', desc: 'Full lifecycle management for hardware assets, inventory stock, and CI relations.', perms: ['assets:read', 'assets:write', 'incidents:read'], mfa: false, sso: false },
  { code: 'POL-FINOPS-AUD', name: 'FinOps & License Auditor', desc: 'Read-only access to billing invoices, software seat compliance, and asset book value.', perms: ['billing:read', 'assets:read'], mfa: true, sso: false },
  { code: 'POL-PROC-APPR', name: 'Procurement Budget Approver', desc: 'Approve hardware and SaaS catalog requests above department thresholds.', perms: ['requests:approve', 'billing:read', 'assets:read'], mfa: true, sso: true },
  { code: 'POL-CTI-SUP', name: 'Telephony & Amazon Connect Supervisor', desc: 'Configure CTI providers, personal mobile bridge policies, and triage voice queues.', perms: ['incidents:read', 'incidents:write', 'workflows:manage'], mfa: true, sso: false },
  { code: 'POL-WF-ARCH', name: 'Workflow & Process Mapper Architect', desc: 'Design pre-close Figma wireframes and cross-module automation pipelines.', perms: ['workflows:manage', 'incidents:read', 'assets:read'], mfa: true, sso: false },
  { code: 'POL-IAM-AUD', name: 'IAM Compliance Auditor (Read-Only)', desc: 'Inspect directory bindings, MFA compliance, and audit trails for SOC2/ISO27001.', perms: ['incidents:read', 'assets:read', 'billing:read'], mfa: true, sso: true },
  { code: 'POL-HIPAA-OPS', name: 'HIPAA Clinical Endpoint Operator', desc: 'Enforces hardware MFA and SSO-only login for hospital EHR asset management.', perms: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write'], mfa: true, sso: true },
  { code: 'POL-PCI-PAY', name: 'PCI-DSS Payment Rail SRE', desc: 'Restricted access for clearing switches, emergency CAB voting, and P1 war rooms.', perms: ['incidents:read', 'incidents:write', 'changes:cab_vote', 'assets:read'], mfa: true, sso: true },
  { code: 'POL-SCADA-OT', name: 'SCADA & Substation OT Engineer', desc: 'Zero-trust access for energy grid telemetry CIs and maintenance windows.', perms: ['assets:read', 'assets:write', 'incidents:read', 'changes:cab_vote'], mfa: true, sso: true },
  { code: 'POL-BIO-HPC', name: 'Genomics HPC Cluster Admin', desc: 'Manage GPU/sequencer nodes, storage arrays, and lab software licenses.', perms: ['assets:read', 'assets:write', 'incidents:read', 'incidents:write'], mfa: true, sso: false },
  { code: 'POL-AERO-PLM', name: 'Avionics PLM Security Officer', desc: 'Strict ITAR-aligned SSO policy for CAD workstations and change sign-off.', perms: ['assets:read', 'changes:cab_vote', 'iam:manage'], mfa: true, sso: true },
  { code: 'POL-RETAIL-POS', name: 'Omnichannel POS Support Tech', desc: 'Fast triage for store checkout terminals, payment gateways, and SIM failover.', perms: ['incidents:read', 'incidents:write', 'assets:read'], mfa: false, sso: false },
  { code: 'POL-EXEC-VIEW', name: 'Executive Watchtower Briefing', desc: 'Read-only KPI access across incidents, SLAs, assets, and billing statements.', perms: ['incidents:read', 'assets:read', 'billing:read'], mfa: true, sso: true },
  { code: 'POL-CONTRACTOR', name: 'Time-Bound Vendor Contractor', desc: 'MFA-gated temporary incident and asset visibility without approval privileges.', perms: ['incidents:read', 'assets:read'], mfa: true, sso: false },
  { code: 'POL-MSP-ADMIN', name: 'Managed MSP Tenant Admin', desc: 'Provision new customer tenants, upload company logos, and toggle module matrices.', perms: ['tenants:admin', 'iam:manage', 'workflows:manage', 'billing:read'], mfa: true, sso: false },
  { code: 'POL-CLOUD-K8S', name: 'Kubernetes Platform SRE', desc: 'Respond to cluster alerts, update CMDB nodes, and deploy standard RFCs.', perms: ['incidents:read', 'incidents:write', 'assets:read', 'assets:write', 'changes:cab_vote'], mfa: true, sso: false },
  { code: 'POL-DB-ADMIN', name: 'Enterprise Database Reliability', desc: 'Manage PostgreSQL/Firestore backup checks, failover tests, and schema RFCs.', perms: ['incidents:read', 'incidents:write', 'changes:cab_vote', 'assets:read'], mfa: true, sso: true },
  { code: 'POL-MDM-INTUNE', name: 'Endpoint MDM & Intune Operator', desc: 'Sync fleet laptops, enroll managed devices, and enforce disk encryption.', perms: ['assets:read', 'assets:write', 'incidents:read', 'incidents:write'], mfa: true, sso: false },
];

const EXTRA_POLICY_DOMAINS = [
  'Zero-Trust VPN Gatekeeper',
  'Cloud IAM Break-Glass Emergency',
  'Disaster Recovery Coordinator',
  'Major Incident War Room Scribe',
  'Vendor Risk & Contract Officer',
  'SSL & Domain Security Guardian',
  'SAP / ERP Integration Support',
  'Identity Lifecycle Automator',
  'Self-Service VIP Executive',
  'Field Service Hardware Dispatch',
  'ISO 27001 Internal Examiner',
  'SOC 2 Type II Evidence Collector',
  'GDPR Data Privacy Steward',
  'Software Asset Compliance Lead',
  'Helpdesk Knowledge Editor',
  'LMS Security Training Proctor',
  'API Gateway Operations Engineer',
  'Mobile Fleet Carrier Administrator',
  'Citrix / VDI Workspace Engineer',
  'Active Directory Sync Operator',
  'Okta / Entra Federation Lead',
  'Backup & Vault Immutable Operator',
  'DNS & Edge WAF Specialist',
  'Observability & Alerting Engineer',
  'DevSecOps Pipeline Approver',
  'Branch Office Network Tech',
];

const KB_TOPICS: Array<{
  category: string;
  title: string;
  tags: string[];
  steps: string[];
}> = [
  {
    category: 'SOP · Identity & SSO',
    title: 'SOP-101: Hardware FIDO2 / YubiKey Enrollment & Lost Token Recovery',
    tags: ['mfa', 'fido2', 'iam', 'sop', 'zero-trust'],
    steps: [
      'Verify requester government/employee badge via video call or registered manager callback.',
      'Open IAM Portal > Identities, locate the user ID, and temporarily revoke compromised token binding.',
      'Issue a 15-minute Temporary Access Pass (TAP) scoped to corporate managed-device SSO only.',
      'Guide user through enrolling primary + backup FIDO2 keys and verify successful MFA login.',
      'Log audit note in ticket and close with resolution code IDENTITY_TOKEN_ROTATED.',
    ],
  },
  {
    category: 'SOP · Network & VPN',
    title: 'SOP-102: WireGuard / GlobalProtect VPN Tunnel Flapping & Split-Tunnel Remediation',
    tags: ['vpn', 'network', 'mtu', 'dns', 'sop'],
    steps: [
      'Confirm user ISP latency and check edge gateway health on the Service Status page.',
      'Flush local DNS resolver cache and verify split-tunnel routes include corporate RFC1918 subnets.',
      'Lower tunnel interface MTU from 1420 to 1360 on cellular/hotel Wi-Fi hotspots experiencing packet fragmentation.',
      'Re-authenticate SSO token if SAML assertion exceeded 8-hour session lifetime.',
      'Escalate to Network NOC if packet loss exceeds 3% across multiple regions.',
    ],
  },
  {
    category: 'Runbook · Cloud & Kubernetes',
    title: 'RB-204: Kubernetes CrashLoopBackOff & OOMKilled Pod Recovery Playbook',
    tags: ['kubernetes', 'k8s', 'oom', 'sre', 'runbook'],
    steps: [
      'Inspect pod termination reason via kubectl describe pod and capture last 200 log lines.',
      'Verify recent Helm release or ConfigMap diff from the Change Advisory Board log.',
      'If exit code 137 (OOMKilled), compare memory working set against container limits and check for heap leaks.',
      'Apply immediate rollback to last known good image digest or scale HPA replica floor by +2.',
      'Link affected cluster CI from CMDB and open a Problem ticket for permanent memory profiling.',
    ],
  },
  {
    category: 'SOP · Telephony & Mobile CTI',
    title: 'SOP-108: Operating Personal Mobile Number as On-Call Helpdesk Telephony Endpoint',
    tags: ['telephony', 'mobile', 'amazon-connect', 'gsm', 'cti'],
    steps: [
      'Open Telephony Hub > Personal Mobile System and enter your E.164 mobile number (e.g. +14155550199).',
      'Select Native Carrier Dialer (zero-config smartphone/Continuity), Desktop QR Handoff, or Two-Leg Twilio Bridge.',
      'Before starting on-call shift, tap or scan the GSM forwarding code (*21*<mobile>#) to route desk calls to mobile.',
      'Use Quick-Dial Directory Lookup to match incoming Caller IDs against the 500+ IAM user directory.',
      'At shift end, dial #21# to cancel forwarding and verify all logged calls have linked Incident IDs.',
    ],
  },
  {
    category: 'SOP · Database & Storage',
    title: 'SOP-112: PostgreSQL Primary Failover & Read-Replica Lag Mitigation',
    tags: ['database', 'postgres', 'failover', 'sre', 'sop'],
    steps: [
      'Check replication slot WAL retention and pg_stat_replication lag in seconds.',
      'Identify long-running analytical queries blocking vacuum or holding AccessExclusive locks.',
      'Terminate runaway reporting PIDs with pg_terminate_backend after notifying FinOps owner.',
      'If primary is unresponsive for > 45s, trigger Patroni controlled switchover to standby zone.',
      'Verify application connection pools (PgBouncer) reconnected cleanly and document MTTR.',
    ],
  },
  {
    category: 'SOP · Security & SOC',
    title: 'SOP-119: Phishing Credential Compromise Containment & Session Revocation',
    tags: ['security', 'soc', 'phishing', 'containment', 'sop'],
    steps: [
      'Immediately revoke all active OAuth refresh tokens and Google/Entra SSO sessions.',
      'Suspend identity in IAM Portal and isolate endpoint via MDM quarantine policy.',
      'Quarantine malicious email campaign across all tenant mailboxes by Message-ID and sender SPF domain.',
      'Inspect mailbox forwarding rules and OAuth app consents created within the last 24 hours.',
      'Trigger P1 War Room if privileged admin credentials or production keys were exposed.',
    ],
  },
  {
    category: 'Runbook · Certificates & TLS',
    title: 'RB-210: Emergency TLS / SSL Certificate Renewal & CDN Edge Propagation',
    tags: ['ssl', 'tls', 'domains', 'nginx', 'runbook'],
    steps: [
      'Inspect expiring domain in Domains & SSL Surveillance module and verify ACME DNS-01 TXT record.',
      'Force cert-manager renewal or upload new signed chain to edge load balancers.',
      'Validate full intermediate chain with openssl s_client and confirm HTTP/2 + HSTS headers.',
      'Purge CDN edge cache and verify zero browser certificate warnings across global probes.',
      'Update Domain Surveillance expiry date and record linked Change RFC.',
    ],
  },
  {
    category: 'SOP · Endpoints & MDM',
    title: 'SOP-124: Zero-Touch macOS / Windows Laptop Onboarding & BitLocker/FileVault Escrow',
    tags: ['mdm', 'intune', 'laptop', 'onboarding', 'sop'],
    steps: [
      'Assign hardware asset tag in Asset & CMDB Registry and bind serial number to user profile.',
      'Confirm device appears in MDM Autopilot / ABM enrollment group for the target company tenant.',
      'Verify FileVault or BitLocker recovery key is escrowed before shipping to employee.',
      'Push standard productivity suite, EDR sensor, and corporate Wi-Fi/SSO device certificate.',
      'Mark Service Request fulfillment stage complete and capture employee sign-off.',
    ],
  },
  {
    category: 'SOP · Cloud & FinOps',
    title: 'SOP-130: Multi-Company Branding, Logo Optimization & Cross-Device Firestore Sync',
    tags: ['firestore', 'branding', 'logos', 'multi-tenant', 'sop'],
    steps: [
      'Navigate to Tenant Administration and select the target Company Profile card.',
      'Upload PNG, SVG, or WebP corporate logo — the built-in optimizer compresses it cleanly under 256px.',
      'Click "Apply Logo to All Portals" to brand Employee Ops, Self-Service, and IAM login screens.',
      'Connect Google Sign-In on Database Topology to sync all tenants, logos, and tickets to Cloud Firestore.',
      'Verify instant propagation by opening the workspace on a secondary tablet or smartphone.',
    ],
  },
  {
    category: 'Runbook · Email & Workspace',
    title: 'RB-218: SPF / DKIM / DMARC Alignment & Bounced Corporate Email Troubleshooting',
    tags: ['email', 'dmarc', 'spf', 'dkim', 'google-workspace'],
    steps: [
      'Inspect bounce NDR header (550 5.7.26 or 5.7.1) to determine whether SPF, DKIM, or DMARC failed.',
      'Audit SPF record lookup count to ensure total DNS lookups remain strictly <= 10.',
      'Rotate 2048-bit DKIM selector key in Google Workspace / Exchange Admin and publish DNS TXT record.',
      'Verify DMARC policy alignment (p=quarantine or p=reject) in Domain & SSL Surveillance.',
      'Send diagnostic test message and confirm PASS on Authentication-Results headers.',
    ],
  },
  {
    category: 'SOP · Change Management',
    title: 'SOP-135: Emergency CAB Fast-Track & Automated Pre-Close Process Gate Verification',
    tags: ['cab', 'change', 'process-map', 'itil', 'sop'],
    steps: [
      'Open Change Advisory Board (CAB) and classify RFC as Emergency with linked P1 Incident ID.',
      'Document verified rollback steps, blast radius CIs, and automated smoke test criteria.',
      'Collect at least two CAB approvals (Operations Lead + Security Officer) before implementation.',
      'Follow the Pre-Close Process Mapper wireframe gates before transitioning ticket to Completed.',
      'Conduct blameless post-implementation review within 48 hours and update KEDB.',
    ],
  },
  {
    category: 'Runbook · Messaging & API',
    title: 'RB-225: High Latency on API Gateway & Circuit Breaker Recovery',
    tags: ['api', 'latency', 'gateway', 'redis', 'runbook'],
    steps: [
      'Inspect p95/p99 latency breakdown between API edge, auth middleware, and upstream microservices.',
      'Check Redis rate-limiter memory fragmentation and cache hit ratio.',
      'Enable graceful degradation / circuit breaker on non-critical downstream enrichment calls.',
      'Scale API gateway worker pool and verify HTTP 502/504 error rate drops below 0.1%.',
      'Post status update on Service Status page and notify affected enterprise tenants.',
    ],
  },
];

const INCIDENT_TEMPLATES: Array<{
  title: string;
  desc: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  group: string;
  ci: string;
  channel: 'portal' | 'email' | 'phone' | 'monitor';
}> = [
  { title: 'Core BGP Edge Router Packet Loss > 8% on Primary Uplink', desc: 'Synthetic probes report 8.4% packet loss and elevated jitter across primary ISP peering transit. Voice calls and VPN sessions experiencing intermittent drops.', category: 'network', priority: 'P1', group: 'Network & Edge NOC', ci: 'EDGE-RTR-01', channel: 'monitor' },
  { title: 'SSO SAML Assertion Clock Skew Blocking Enterprise Portal Logins', desc: 'Multiple departments report HTTP 403 SAML token expired immediately upon Google/Okta redirect. Suspect NTP drift on secondary auth proxy.', category: 'access', priority: 'P1', group: 'Identity & Access (IAM)', ci: 'IAM-IDP-GW02', channel: 'phone' },
  { title: 'Production PostgreSQL Read Replica Lag Exceeding 45 Seconds', desc: 'Reporting dashboard and ticket search queries returning stale rows due to WAL apply delay on replica node db-prod-ro-02.', category: 'software', priority: 'P2', group: 'Database Reliability', ci: 'DB-PG-PROD-02', channel: 'monitor' },
  { title: 'Amazon Connect CCP Audio One-Way on Remote MacBook Workstations', desc: 'Service desk agents on macOS report caller hears agent clearly, but inbound voice audio drops after 20 seconds over corporate VPN.', category: 'telephony', priority: 'P2', group: 'Enterprise Telephony', ci: 'CTI-CONNECT-GW', channel: 'phone' },
  { title: 'EDR Agent High CPU Spike (94%) on Finance Windows 11 Fleet', desc: 'After overnight signature update 4.18.2, endpoint sensor scanning locks Excel macro workbooks across 30+ finance laptops.', category: 'security', priority: 'P2', group: 'Security Operations (SOC)', ci: 'EDR-POLICY-WIN11', channel: 'portal' },
  { title: 'Warehouse Barcode Handheld Wi-Fi Roaming Disconnection', desc: 'Zebra TC77 scanners drop TCP session when moving between Aisle 4 and Cold Storage AP-14, forcing order re-scan.', category: 'hardware', priority: 'P2', group: 'Workplace Endpoints', ci: 'WLAN-AP-WH14', channel: 'phone' },
  { title: 'Suspicious Impossible Travel Login Detected on Contractor Account', desc: 'SIEM correlation flagged authenticated login from Frankfurt followed 9 minutes later by residential proxy in Sao Paulo.', category: 'security', priority: 'P1', group: 'Security Operations (SOC)', ci: 'SIEM-CORR-01', channel: 'monitor' },
  { title: 'TLS Certificate Expiring in 48 Hours on Customer Billing API', desc: 'Automated Domain Surveillance probe detected staging & prod webhook subdomain cert renewal stalled on DNS-01 challenge.', category: 'network', priority: 'P2', group: 'Cloud Engineering', ci: 'LB-BILLING-EDGE', channel: 'monitor' },
  { title: 'Docking Station Dual 4K Display Flicker After Firmware Patch', desc: 'USB-C Thunderbolt docks disconnect external monitors when waking laptops from sleep mode on Floor 5 desks.', category: 'hardware', priority: 'P3', group: 'Workplace Endpoints', ci: 'HW-DOCK-TB4', channel: 'portal' },
  { title: 'SAP ERP Purchase Order Approval Emails Delayed by 4 Hours', desc: 'SMTP relay queue backing up on mail-relay-03 due to rate limiting from external mail gateway.', category: 'software', priority: 'P3', group: 'Service Desk L2', ci: 'MAIL-RELAY-03', channel: 'email' },
  { title: 'Unable to Mount Shared NFS Research Volume on GPU Node', desc: 'Sequencing pipeline jobs failing with stale file handle error on /mnt/genomics-vol04 after storage snapshot.', category: 'software', priority: 'P2', group: 'Cloud Engineering', ci: 'NAS-NVME-04', channel: 'portal' },
  { title: 'Personal Mobile On-Call Forwarding Loop Detected on Night Shift Queue', desc: 'GSM conditional forward bounced back to IVR greeting when secondary on-call handset had VoLTE disabled.', category: 'telephony', priority: 'P3', group: 'Enterprise Telephony', ci: 'CTI-MOBILE-BRIDGE', channel: 'phone' },
  { title: 'MFA Push Notification Timeout on New Employee iPhone Enrollment', desc: 'Newly provisioned accounts do not receive push challenges until authenticator app is manually re-registered.', category: 'access', priority: 'P3', group: 'Service Desk L1', ci: 'MFA-PUSH-SVC', channel: 'portal' },
  { title: 'Printer Spooler Stuck on Executive Briefing Room MFP', desc: 'Large PDF architectural deck jammed queue on Canon iR-ADV C5860i; jobs piling up in pending state.', category: 'hardware', priority: 'P4', group: 'Service Desk L1', ci: 'PRT-EXEC-02', channel: 'email' },
  { title: 'GitHub Actions Self-Hosted Runner Disk Space at 98%', desc: 'Docker build cache layers not pruned on CI runner pool causing deployment pipelines to stall.', category: 'software', priority: 'P3', group: 'Platform Automation', ci: 'CI-RUNNER-POOL', channel: 'monitor' },
  { title: 'VPN Split-Tunnel Blocking Access to Internal Wiki & CMDB Graph', desc: 'Remote engineers on travel hotspot cannot resolve internal .local DNS records after client upgrade.', category: 'network', priority: 'P3', group: 'Network & Edge NOC', ci: 'VPN-WG-GW01', channel: 'portal' },
];

const REQUEST_CATALOG_TEMPLATES: Array<{
  catalogItemId: string;
  name: string;
  desc: string;
  cost: number;
  days: number;
}> = [
  { catalogItemId: 'cat-hw-mbp', name: 'MacBook Pro 16" M4 Max Engineering Workstation', desc: 'Provision encrypted developer laptop with 64GB RAM, MDM profile, and dual USB-C dock.', cost: 3499, days: 4 },
  { catalogItemId: 'cat-hw-win', name: 'ThinkPad X1 Carbon Gen 12 Executive Ultrabook', desc: 'BitLocker pre-imaged corporate workstation with hardware privacy filter and eSIM.', cost: 2150, days: 3 },
  { catalogItemId: 'cat-acc-fido', name: 'YubiKey 5C NFC Dual Hardware MFA Kit', desc: 'Primary + backup FIDO2 security keys pre-registered in IAM Directory.', cost: 140, days: 2 },
  { catalogItemId: 'cat-cld-gpu', name: 'Dedicated A100 GPU Compute Quota Expansion', desc: 'Expand Kubernetes GPU namespace quota by 4x A100 nodes for quarterly model training.', cost: 4800, days: 2 },
  { catalogItemId: 'cat-sw-figma', name: 'Figma Enterprise Design & Wireframe Seat', desc: 'Assign SSO-bound design license to product operations team member.', cost: 900, days: 1 },
  { catalogItemId: 'cat-sw-jb', name: 'JetBrains All Products Pack Annual License', desc: 'Floating enterprise developer IDE allocation synced via license server.', cost: 779, days: 1 },
  { catalogItemId: 'cat-tel-did', name: 'Dedicated Regional Helpdesk DID & Personal Mobile Bridge', desc: 'Allocate E.164 support line with on-call mobile forwarding and Amazon Connect queue routing.', cost: 180, days: 1 },
  { catalogItemId: 'cat-acc-vpn', name: 'Zero-Trust Production Bastion & VPN Access', desc: 'Time-bound elevated SSH certificate and WireGuard profile for release engineering.', cost: 0, days: 1 },
  { catalogItemId: 'cat-hw-mon', name: '34" Curved Ultrawide USB-C Hub Monitor', desc: 'Ergonomic desk display with integrated 90W PD charging and Ethernet passthrough.', cost: 890, days: 5 },
  { catalogItemId: 'cat-sw-bi', name: 'Tableau / Looker Executive Analytics Creator Seat', desc: 'Provision BI creator license with FinOps read-only database warehouse credentials.', cost: 840, days: 2 },
  { catalogItemId: 'cat-acc-onb', name: 'New Hire Day-1 Full Onboarding Bundle', desc: 'Bundled IAM identity creation, Google Workspace mailbox, laptop dispatch, and LMS assignment.', cost: 2650, days: 5 },
  { catalogItemId: 'cat-cld-s3', name: 'Immutable Compliance Backup Bucket (50 TB)', desc: 'Provision Object-Lock WORM archive storage with cross-region replication for audit retention.', cost: 1450, days: 2 },
];

const ASSET_TEMPLATES: Array<{
  type: AssetType;
  model: string;
  manufacturer: string;
  cost: number;
  prefix: string;
  syncSource: 'manual' | 'vcenter' | 'intune';
}> = [
  { type: 'server', model: 'PowerEdge R760xs Dual Xeon', manufacturer: 'Dell Technologies', cost: 14200, prefix: 'SRV', syncSource: 'vcenter' },
  { type: 'networking', model: 'Catalyst 9500-48Y4C Core Switch', manufacturer: 'Cisco Systems', cost: 18500, prefix: 'NET', syncSource: 'manual' },
  { type: 'networking', model: 'PA-3420 Next-Gen Firewall', manufacturer: 'Palo Alto Networks', cost: 22400, prefix: 'FW', syncSource: 'manual' },
  { type: 'laptop', model: 'MacBook Pro 16" M4 Max', manufacturer: 'Apple', cost: 3499, prefix: 'MBP', syncSource: 'intune' },
  { type: 'laptop', model: 'ThinkPad X1 Carbon Gen 12', manufacturer: 'Lenovo', cost: 2150, prefix: 'LTP', syncSource: 'intune' },
  { type: 'workstation', model: 'Precision 7960 Tower AI Rig', manufacturer: 'Dell Technologies', cost: 6800, prefix: 'WKS', syncSource: 'intune' },
  { type: 'mobile', model: 'iPhone 16 Pro Corporate eSIM', manufacturer: 'Apple', cost: 1199, prefix: 'MOB', syncSource: 'intune' },
  { type: 'mobile', model: 'Pixel 9 Pro Managed Android', manufacturer: 'Google', cost: 1099, prefix: 'MOB', syncSource: 'intune' },
  { type: 'security_key', model: 'YubiKey 5C NFC FIPS', manufacturer: 'Yubico', cost: 85, prefix: 'KEY', syncSource: 'manual' },
  { type: 'monitor', model: 'UltraSharp U3425WE 34" Hub', manufacturer: 'Dell Technologies', cost: 890, prefix: 'MON', syncSource: 'manual' },
  { type: 'peripherals', model: 'Thunderbolt 4 Pro Dock', manufacturer: 'CalDigit', cost: 399, prefix: 'DOC', syncSource: 'manual' },
  { type: 'server', model: 'ProLiant DL380 Gen11 K8s Node', manufacturer: 'HPE', cost: 12900, prefix: 'K8S', syncSource: 'vcenter' },
];

const BASE_TS = new Date('2026-05-12T09:00:00.000Z').getTime();

function isoDaysAgo(days: number, hoursOffset = 0): string {
  return new Date(BASE_TS - days * 86400000 - hoursOffset * 3600000).toISOString();
}

function dateDaysFromNow(days: number): string {
  return new Date(BASE_TS + days * 86400000).toISOString().split('T')[0];
}

let cachedBundle: EnterpriseSeedBundle | null = null;

export function generateEnterpriseSeedBundle(): EnterpriseSeedBundle {
  if (cachedBundle) return cachedBundle;

  // 1. MULTI-COMPANY TENANTS (8 Companies, EACH with custom corporate SVG logo + portal branding)
  const tenants: Tenant[] = COMPANY_SPECS.map((spec, idx) => ({
    id: spec.id,
    name: spec.name,
    slug: spec.slug,
    companyCode: spec.companyCode,
    domain: spec.domain,
    plan: spec.plan,
    region: spec.region,
    timezone: spec.timezone,
    currency: spec.currency,
    primaryContactEmail: `ops@${spec.domain}`,
    status: 'active',
    slaTargets:
      spec.plan === 'Dedicated'
        ? { P1: 0.5, P2: 2, P3: 12, P4: 48 }
        : { P1: 1, P2: 4, P3: 24, P4: 72 },
    enabledModules: createAllEnabledModules(),
    preferenceTemplate: {
      dateFormat: spec.currency === 'USD' ? 'YYYY-MM-DD' : 'DD/MM/YYYY',
      defaultQueue: `${spec.name.split(' ')[0]} Service Desk Pool`,
      autoAssignRota: true,
      requireCabForNormalChange: true,
      portalBannerTitle: `${spec.name.toUpperCase()} SERVICE HUB`,
    },
    companyLogoDataUrl: spec.logo,
    portalBranding: {
      employees: {
        portalName: `${spec.name} Ops`,
        subtitle: `${spec.industry} · Employee IT Console`,
        logoDataUrl: spec.logo,
      },
      enduser: {
        portalName: `${spec.name} Help Center`,
        subtitle: 'Self-Service Catalog, Knowledge Bank & Status',
        logoDataUrl: spec.logo,
      },
      iam: {
        portalName: `${spec.name} IAM`,
        subtitle: 'Zero-Trust Identity, Company ID & RBAC Governance',
        logoDataUrl: spec.logo,
      },
    },
    createdAt: isoDaysAgo(180 - idx * 14),
  }));

  // 2. IAM USER POLICIES (56 Granular Enterprise Policies)
  const iamPolicies: IamPolicy[] = [...CORE_IAM_POLICIES];
  POLICY_TEMPLATES.forEach((tpl, idx) => {
    iamPolicies.push({
      id: tpl.code,
      tenantId: 'tenant-default',
      name: tpl.name,
      description: tpl.desc,
      permissions: tpl.perms,
      mfaRequired: tpl.mfa,
      ssoOnly: tpl.sso,
      createdAt: isoDaysAgo(120 - idx),
    });
  });

  const permPool: IamPermissionScope[][] = [
    ['incidents:read', 'incidents:write', 'assets:read'],
    ['incidents:read', 'assets:read', 'assets:write'],
    ['incidents:read', 'changes:cab_vote', 'requests:approve'],
    ['incidents:read', 'workflows:manage', 'assets:read'],
    ['incidents:read', 'billing:read', 'assets:read'],
    ['iam:manage', 'incidents:read', 'assets:read'],
  ];

  EXTRA_POLICY_DOMAINS.forEach((name, idx) => {
    iamPolicies.push({
      id: `POL-ENT-${String(idx + 31).padStart(3, '0')}`,
      tenantId: 'tenant-default',
      name,
      description: `Enterprise RBAC scope governing ${name.toLowerCase()} operations with auditable approval guardrails.`,
      permissions: permPool[idx % permPool.length],
      mfaRequired: idx % 3 !== 0,
      ssoOnly: idx % 4 === 0,
      createdAt: isoDaysAgo(90 - idx),
    });
  });

  // 3. 524 USER PROFILES ACROSS ALL 8 COMPANIES (4 Test Env + 520 Realistic Users with Phone & Job Titles)
  const authAccounts: AuthAccount[] = [...DEFAULT_TEST_ENV_ACCOUNTS];
  const usersByTenant: Record<string, AuthAccount[]> = {};
  tenants.forEach(t => {
    usersByTenant[t.id] = [];
  });
  DEFAULT_TEST_ENV_ACCOUNTS.forEach(a => {
    if (a.tenantId && usersByTenant[a.tenantId]) usersByTenant[a.tenantId].push(a);
  });

  // Distribution: 135 users in Njure Tech HQ + 55 users in each of the 7 other companies = 520 generated + 4 test = 524 total!
  const countsPerTenant = [135, 55, 55, 55, 55, 55, 55, 55];
  let globalUserSeq = 1001;

  COMPANY_SPECS.forEach((spec, tIdx) => {
    const targetCount = countsPerTenant[tIdx];
    for (let i = 0; i < targetCount; i++) {
      const first = FIRST_NAMES[(tIdx * 11 + i * 7) % FIRST_NAMES.length];
      const last = LAST_NAMES[(tIdx * 5 + i * 13) % LAST_NAMES.length];
      const fullName = `${first} ${last}`;
      const role: Role = i % 15 === 0 ? 'admin' : i % 3 === 0 ? 'technician' : 'customer';
      const portalType: AuthPortalType =
        role === 'admin'
          ? i % 30 === 0
            ? 'super_admin'
            : 'iam'
          : role === 'technician'
          ? 'employee'
          : 'end_user';
      const dept = DEPARTMENTS[(tIdx * 3 + i) % DEPARTMENTS.length];
      const titles = JOB_TITLES[role];
      const jobTitle = titles[(tIdx + i) % titles.length];
      const localDigits = String(1000000 + ((tIdx + 1) * 11111 + i * 79) % 8999999).slice(0, 7);
      const phone = `${spec.phonePrefix}${localDigits}`;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${i > 0 ? i : ''}@${spec.domain}`;
      const primaryPol =
        role === 'admin'
          ? 'POL-SUPER-ADMIN'
          : role === 'technician'
          ? iamPolicies[4 + ((tIdx * 7 + i) % (iamPolicies.length - 4))].id
          : 'POL-END-USER';
      const secondaryPol =
        role === 'technician' && i % 2 === 0
          ? iamPolicies[4 + ((tIdx * 3 + i + 5) % (iamPolicies.length - 4))].id
          : null;

      const acc: AuthAccount = {
        id: `USR-${spec.companyCode.split('-')[1]}-${globalUserSeq}`,
        portalType,
        role,
        name: fullName,
        email,
        password: 'Enterprise@Scribble2026',
        department: dept,
        jobTitle,
        phone,
        companyId: spec.companyCode,
        tenantId: spec.id,
        policyIds: secondaryPol && secondaryPol !== primaryPol ? [primaryPol, secondaryPol] : [primaryPol],
        status: i % 29 === 28 ? 'suspended' : 'active',
        mfaEnabled: role !== 'customer' || i % 2 === 0,
        createdAt: isoDaysAgo(160 - (i % 140)),
      };
      authAccounts.push(acc);
      usersByTenant[spec.id].push(acc);
      globalUserSeq += 1;
    }
  });

  // Helper to pick a realistic user from a tenant
  const pickUser = (tenantId: string, idx: number, preferTech = false): AuthAccount => {
    const pool = usersByTenant[tenantId] || authAccounts;
    if (preferTech) {
      const techs = pool.filter(u => u.role === 'technician' || u.role === 'admin');
      if (techs.length > 0) return techs[idx % techs.length];
    }
    return pool[idx % pool.length];
  };

  // 4. 125 KNOWLEDGE BASE ARTICLES & SOPs (104 in Njure Tech HQ + 3 each in other 7 companies)
  const kbArticles: KnowledgeArticle[] = [];
  let kbSeq = 1001;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 104 : 3;
    for (let i = 0; i < count; i++) {
      const tpl = KB_TOPICS[i % KB_TOPICS.length];
      const rev = Math.floor(i / KB_TOPICS.length) + 1;
      const author = pickUser(spec.id, i + 2, true);
      const envTag = spec.locations[i % spec.locations.length];
      const title =
        rev === 1
          ? tpl.title
          : `${tpl.title.replace(/^(SOP|RB)-\d+:/, `$1-${kbSeq}:`)} (${envTag} · Rev ${rev})`;
      const content = [
        `DOCUMENT ID: KB-${kbSeq} | TENANT: ${spec.name} (${spec.companyCode})`,
        `SCOPE: ${envTag} · Compliance Classification: ${i % 3 === 0 ? 'Internal Operations' : 'Enterprise Standard'}`,
        `OWNER: ${author.name} (${author.department})`,
        '',
        '1. PURPOSE & PRECONDITIONS',
        `   Standardized operational procedure for ${spec.name} engineering and service desk teams covering ${tpl.tags.join(', ')}.`,
        '',
        '2. EXECUTION STEPS',
        ...tpl.steps.map((s, sIdx) => `   Step ${sIdx + 1}: ${s}`),
        '',
        '3. VERIFICATION & ESCALATION',
        `   Confirm telemetry green on Watchtower for ${envTag}. If unresolved within SLA, escalate to P1 War Room bridge.`,
      ].join('\n');

      kbArticles.push({
        id: `KB-${kbSeq}`,
        tenantId: spec.id,
        title,
        category: tpl.category,
        visibility: i % 3 === 0 ? 'internal' : 'public',
        author: author.name,
        views: 120 + ((kbSeq * 37) % 1840),
        helpfulVotes: 14 + ((kbSeq * 13) % 210),
        tags: [...tpl.tags, spec.slug],
        content,
        updatedAt: isoDaysAgo((i * 2) % 90).split('T')[0],
      });
      kbSeq += 1;
    }
  });

  // 5. 42 SYSTEM WIKI & ARCHITECTURE DOCUMENTS (28 in Njure Tech HQ + 2 each in other 7 companies)
  const wikiSections: WikiPage['section'][] = ['Architecture', 'Runbooks', 'SOPs', 'Onboarding'];
  const wikiTitles = [
    'Multi-Region Active-Active Failover Blueprint',
    'Zero-Trust Network Segmentation & Bastion Architecture',
    'Enterprise Telephony & Personal Mobile CTI Operations Manual',
    'Incident Commander P1 War Room SOP Handbook',
    'Cloud Firestore Centralized Persistence & Sync Topology',
    'New Engineer Day-1 Access & MDM Enrollment Guide',
    'CAB Risk Matrix & Emergency Release Governance Standard',
    'CMDB Discovery Pipeline (vCenter + Intune + Manual)',
    'SOC2 Type II & ISO 27001 Quarterly Audit Evidence Guide',
    'Automated Ticket Routing & AI Triage Scoring Specification',
    'Kubernetes Production Cluster Upgrade SOP',
    'Disaster Recovery RPO/RTO Tabletop Drill Playbook',
    'Corporate Email Authentication (SPF/DKIM/DMARC) Reference',
    'Vendor SLA & Contract Renewal Negotiation Checklist',
  ];
  const wikiPages: WikiPage[] = [];
  let wikiSeq = 201;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 28 : 2;
    for (let i = 0; i < count; i++) {
      const baseTitle = wikiTitles[i % wikiTitles.length];
      const author = pickUser(spec.id, i + 4, true);
      const sec = wikiSections[i % wikiSections.length];
      wikiPages.push({
        id: `WIKI-${wikiSeq}`,
        tenantId: spec.id,
        title: i >= wikiTitles.length ? `${baseTitle} — ${spec.locations[i % spec.locations.length]}` : baseTitle,
        section: sec,
        author: author.name,
        updatedAt: isoDaysAgo(i % 45).split('T')[0],
        content: [
          `# ${baseTitle}`,
          `Organization: ${spec.name} (${spec.domain}) | Section: ${sec}`,
          '',
          `## Architectural Overview`,
          `This reference manual defines the approved ${spec.industry} standards operated across ${spec.locations.join(', ')}.`,
          '',
          `## Operational Controls`,
          `- Primary Region: ${spec.region} (${spec.timezone})`,
          `- Escalation Owner: ${author.name} (${author.email})`,
          `- Review Cadence: Every 90 days during quarterly CAB & Security audit cycle.`,
          '',
          `## Recovery & Verification`,
          `All production changes must pass automated smoke validation and pre-close process map approvals before ticket closure.`,
        ].join('\n'),
      });
      wikiSeq += 1;
    }
  });

  // 6. 132 CMDB ASSETS (104 in Njure Tech HQ + 4 each in other 7 companies)
  const assets: Asset[] = [];
  const assetStatuses: AssetStatus[] = ['in_use', 'in_use', 'in_use', 'in_stock', 'maintenance', 'retired'];
  let assetSeq = 4001;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 104 : 4;
    for (let i = 0; i < count; i++) {
      const tpl = ASSET_TEMPLATES[i % ASSET_TEMPLATES.length];
      const owner = pickUser(spec.id, i + 1);
      const st = assetStatuses[i % assetStatuses.length];
      const tag = `${spec.companyCode.split('-')[1]}-${tpl.prefix}-${assetSeq}`;
      const purchaseDaysAgo = 90 + ((i * 23) % 900);
      const bookFactor = Math.max(0.35, 1 - purchaseDaysAgo / 1400);
      assets.push({
        id: `AST-${assetSeq}`,
        tenantId: spec.id,
        assetTag: tag,
        name: `${tpl.prefix}-${spec.slug.split('-')[0].toUpperCase()}-${String(i + 1).padStart(3, '0')} (${tpl.model.split(' ')[0]})`,
        type: tpl.type,
        serialNumber: `SN${spec.companyCode.slice(-2)}${assetSeq}${String(10 + (i % 89))}`,
        macAddress: `00:1B:44:${String(10 + (tIdx * 7 + i) % 85).padStart(2, '0')}:${String(10 + (i * 3) % 85).padStart(2, '0')}:${String(10 + (i * 11) % 85).padStart(2, '0')}`,
        ipAddress: `10.${20 + tIdx}.${Math.floor(i / 25) + 1}.${10 + (i % 220)}`,
        syncSource: tpl.syncSource,
        model: tpl.model,
        manufacturer: tpl.manufacturer,
        status: st,
        assignedTo: st === 'in_use' ? owner.name : undefined,
        department: owner.department,
        location: spec.locations[i % spec.locations.length],
        purchaseDate: isoDaysAgo(purchaseDaysAgo).split('T')[0],
        warrantyExpiry: dateDaysFromNow(365 * 3 - purchaseDaysAgo),
        purchaseCost: tpl.cost,
        currentBookValue: Math.round(tpl.cost * bookFactor),
        qrCodeData: `SCRIBBLE-ASSET://${spec.companyCode}/${tag}`,
      });
      assetSeq += 1;
    }
  });

  // 7. 46 CMDB DEPENDENCY RELATIONS
  const cmdbRelations: CmdbRelation[] = [];
  const relTypes: CmdbRelation['relationType'][] = ['depends_on', 'hosts', 'connects_to', 'backed_up_by', 'secured_by'];
  let relSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const tenantAssets = assets.filter(a => a.tenantId === spec.id);
    const pairCount = tIdx === 0 ? 32 : 2;
    for (let i = 0; i < pairCount && tenantAssets.length >= 2; i++) {
      const src = tenantAssets[i % tenantAssets.length];
      const tgt = tenantAssets[(i + 1) % tenantAssets.length];
      cmdbRelations.push({
        id: `REL-${String(relSeq).padStart(3, '0')}`,
        tenantId: spec.id,
        sourceId: src.id,
        targetId: tgt.id,
        relationType: relTypes[i % relTypes.length],
        criticality: i % 4 === 0 ? 'critical' : i % 2 === 0 ? 'high' : 'standard',
      });
      relSeq += 1;
    }
  });

  // 8. 53 HARDWARE INVENTORY SKUs
  const invCatalog: Array<{ name: string; cat: InventoryItem['category']; cost: number }> = [
    { name: 'USB-C Thunderbolt 4 Active Cable (2m)', cat: 'cabling', cost: 48 },
    { name: 'YubiKey 5C NFC Security Token (Bulk Pack)', cat: 'accessories', cost: 65 },
    { name: '10GBASE-SR SFP+ Optical Transceiver', cat: 'components', cost: 115 },
    { name: '2TB NVMe Gen4 Enterprise M.2 SSD', cat: 'storage', cost: 245 },
    { name: 'Logitech MX Master 3S Corporate Mouse', cat: 'peripherals', cost: 99 },
    { name: 'Jabra Evolve2 75 Active ANC Headset', cat: 'peripherals', cost: 329 },
    { name: 'Cat6A Shielded Patch Cord Pack (10x)', cat: 'cabling', cost: 64 },
    { name: '64GB DDR5 ECC Server RDIMM Module', cat: 'components', cost: 290 },
  ];
  const inventory: InventoryItem[] = [];
  let invSeq = 101;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 32 : 3;
    for (let i = 0; i < count; i++) {
      const tpl = invCatalog[i % invCatalog.length];
      const qty = i % 6 === 0 ? 4 : 18 + ((i * 7) % 65);
      inventory.push({
        id: `INV-SKU-${invSeq}`,
        tenantId: spec.id,
        sku: `SKU-${spec.companyCode.split('-')[1]}-${invSeq}`,
        name: i >= invCatalog.length ? `${tpl.name} · Batch ${Math.floor(i / invCatalog.length) + 1}` : tpl.name,
        category: tpl.cat,
        quantity: qty,
        minThreshold: 10,
        unitCost: tpl.cost,
        location: `${spec.locations[i % spec.locations.length]} · Cage B`,
        lastRestocked: isoDaysAgo((i * 4) % 45).split('T')[0],
      });
      invSeq += 1;
    }
  });

  // 9. 38 SOFTWARE LICENSES
  const swCatalog: Array<{ name: string; vendor: string; ver: string; type: SoftwareLicense['licenseType']; cost: number }> = [
    { name: 'Google Workspace Enterprise Plus', vendor: 'Google Cloud', ver: '2026.04', type: 'per_seat', cost: 34800 },
    { name: 'CrowdStrike Falcon Complete EDR', vendor: 'CrowdStrike', ver: '7.18', type: 'per_seat', cost: 42500 },
    { name: 'Okta Workforce Identity Cloud', vendor: 'Okta', ver: '2026.2', type: 'per_seat', cost: 28900 },
    { name: 'Datadog Infrastructure & APM Pro', vendor: 'Datadog', ver: '7.56', type: 'site', cost: 54000 },
    { name: 'Figma Enterprise Organization', vendor: 'Figma', ver: 'Cloud', type: 'per_seat', cost: 16200 },
    { name: 'JetBrains All Products Enterprise', vendor: 'JetBrains', ver: '2026.1', type: 'floating', cost: 19400 },
    { name: 'Amazon Connect Voice & Contact Lens', vendor: 'AWS', ver: 'CCP v2', type: 'site', cost: 24600 },
    { name: 'PostgreSQL Enterprise HA Cluster', vendor: 'EDB / Open Source', ver: '16.4', type: 'open_source', cost: 12000 },
  ];
  const software: SoftwareLicense[] = [];
  let swSeq = 301;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 24 : 2;
    for (let i = 0; i < count; i++) {
      const tpl = swCatalog[i % swCatalog.length];
      const totalSeats = 50 + ((i * 25) % 250);
      const usedSeats = i % 7 === 0 ? totalSeats + 4 : Math.round(totalSeats * (0.68 + ((i * 7) % 28) / 100));
      software.push({
        id: `SW-${swSeq}`,
        tenantId: spec.id,
        name: i >= swCatalog.length ? `${tpl.name} (${spec.locations[i % spec.locations.length].split(' ')[0]})` : tpl.name,
        vendor: tpl.vendor,
        version: tpl.ver,
        licenseType: tpl.type,
        totalSeats,
        usedSeats,
        annualCost: tpl.cost,
        renewalDate: dateDaysFromNow(18 + ((i * 27) % 340)),
        source: i % 3 === 0 ? 'Intune' : i % 3 === 1 ? 'PowerShell' : 'Manual',
        complianceStatus: usedSeats > totalSeats ? 'over_allocated' : i % 5 === 0 ? 'expiring_soon' : 'compliant',
      });
      swSeq += 1;
    }
  });

  // 10. 132 INCIDENTS (104 in Njure Tech HQ + 4 each in other 7 companies)
  const incidents: Incident[] = [];
  const incStatuses: IncidentStatus[] = ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'];
  let incSeq = 5001;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 104 : 4;
    for (let i = 0; i < count; i++) {
      const tpl = INCIDENT_TEMPLATES[i % INCIDENT_TEMPLATES.length];
      const requester = pickUser(spec.id, i + 5, false);
      const tech = pickUser(spec.id, i + 1, true);
      const status = incStatuses[i % incStatuses.length];
      const createdAt = isoDaysAgo((i * 2) % 40, i % 18);
      const slaHours = tpl.priority === 'P1' ? 1 : tpl.priority === 'P2' ? 4 : tpl.priority === 'P3' ? 24 : 72;
      const slaDeadline = new Date(new Date(createdAt).getTime() + slaHours * 3600000).toISOString();
      const slaBreached = status !== 'resolved' && status !== 'closed' && i % 9 === 0;
      const loc = spec.locations[i % spec.locations.length];

      incidents.push({
        id: `INC-${incSeq}`,
        tenantId: spec.id,
        title: i < INCIDENT_TEMPLATES.length ? tpl.title : `${tpl.title} — ${loc}`,
        description: `${tpl.desc}\nLocation: ${loc} (${spec.name}). Reported via ${tpl.channel.toUpperCase()} channel.`,
        status,
        priority: tpl.priority,
        urgency: tpl.priority === 'P1' ? 'high' : tpl.priority === 'P2' ? 'high' : tpl.priority === 'P3' ? 'medium' : 'low',
        impact: tpl.priority === 'P1' ? 'high' : tpl.priority === 'P2' ? 'medium' : 'low',
        category: tpl.category,
        requesterName: requester.name,
        requesterEmail: requester.email,
        assignee: status === 'new' ? 'Unassigned' : tech.name,
        assignmentGroup: tpl.group,
        affectedCI: `${tpl.ci}-${spec.companyCode.slice(-2)}`,
        slaDeadline,
        slaBreached,
        timeLoggedMins: status === 'new' ? 0 : 20 + ((i * 15) % 180),
        csatScore: status === 'resolved' || status === 'closed' ? (i % 5 === 0 ? 4 : 5) : undefined,
        sourceChannel: tpl.channel,
        createdAt,
        updatedAt: isoDaysAgo(Math.max(0, ((i * 2) % 40) - 1)),
        resolutionNotes:
          status === 'resolved' || status === 'closed'
            ? `Applied standard runbook fix on ${tpl.ci}-${spec.companyCode.slice(-2)} and verified green telemetry with ${requester.name}.`
            : undefined,
        activityLog: [
          {
            id: `ACT-${incSeq}-1`,
            timestamp: createdAt,
            author: requester.name,
            type: 'system_alert',
            action: 'INCIDENT_OPENED',
            note: `Ticket opened via ${tpl.channel} and auto-routed to ${tpl.group}.`,
          },
          ...(status !== 'new'
            ? [
                {
                  id: `ACT-${incSeq}-2`,
                  timestamp: isoDaysAgo(Math.max(0, ((i * 2) % 40) - 1)),
                  author: tech.name,
                  type: 'work_note' as const,
                  action: 'TRIAGE_UPDATE',
                  note: `Diagnostics captured on ${tpl.ci}; linked runbook KB-${1001 + (i % 12)} consulted.`,
                },
              ]
            : []),
        ],
      });
      incSeq += 1;
    }
  });

  // 11. 123 SERVICE REQUESTS (102 in Njure Tech HQ + 3 each in other 7 companies)
  const requests: ServiceRequest[] = [];
  const reqStatuses: RequestStatus[] = ['submitted', 'manager_approved', 'security_review', 'fulfillment', 'completed', 'rejected'];
  let reqSeq = 6001;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 102 : 3;
    for (let i = 0; i < count; i++) {
      const tpl = REQUEST_CATALOG_TEMPLATES[i % REQUEST_CATALOG_TEMPLATES.length];
      const requester = pickUser(spec.id, i + 7, false);
      const approver = pickUser(spec.id, i + 2, true);
      const st = reqStatuses[i % reqStatuses.length];
      const stage = st === 'submitted' ? 1 : st === 'manager_approved' ? 2 : st === 'security_review' ? 3 : 4;
      requests.push({
        id: `REQ-${reqSeq}`,
        tenantId: spec.id,
        catalogItemId: tpl.catalogItemId,
        catalogItemName: tpl.name,
        description: `${tpl.desc} Requested for ${requester.department} at ${spec.locations[i % spec.locations.length]}.`,
        requesterName: requester.name,
        requesterEmail: requester.email,
        department: requester.department,
        cost: tpl.cost,
        status: st,
        currentStage: stage,
        approvals: [
          {
            role: 'Line Manager',
            approver: approver.name,
            status: st === 'submitted' ? 'pending' : st === 'rejected' ? 'rejected' : 'approved',
            timestamp: st !== 'submitted' ? isoDaysAgo((i % 25)) : undefined,
            notes: st === 'rejected' ? 'Deferred to Q3 departmental budget cycle.' : 'Approved per standard role profile.',
          },
          {
            role: 'Security & FinOps Review',
            approver: 'Elena Vance',
            status: stage >= 3 && st !== 'rejected' ? 'approved' : 'pending',
            timestamp: stage >= 3 && st !== 'rejected' ? isoDaysAgo(Math.max(0, (i % 25) - 1)) : undefined,
          },
        ],
        deliveryEstimateDays: tpl.days,
        deliveryDate: st === 'completed' ? isoDaysAgo(Math.max(0, (i % 15) - 2)).split('T')[0] : undefined,
        createdAt: isoDaysAgo((i * 2) % 35),
      });
      reqSeq += 1;
    }
  });

  // 12. 46 PROBLEM / KEDB TICKETS (32 in Njure Tech HQ + 2 each in other 7 companies)
  const problemTemplates = [
    { title: 'Recurring BGP Route Flap on Secondary Edge Carrier', rca: 'Asymmetric BFD timer mismatch between edge router and transit peer.', workaround: 'Pin egress prefix to Carrier-A primary circuit.', perm: 'Standardize BFD 300ms interval across both carriers.' },
    { title: 'Memory Leak in Telemetry Ingestion Collector v4.8', rca: 'Unbounded goroutine map during burst webhook retries.', workaround: 'Scheduled rolling pod restart every 12 hours.', perm: 'Upgrade collector image to v4.9.2 with bounded ring buffer.' },
    { title: 'Windows 11 24H2 Thunderbolt Dock Sleep-Wake Black Screen', rca: 'DisplayPort MST handshake timeout in older dock firmware.', workaround: 'Unplug/replug USB-C host cable or switch display refresh to 60Hz.', perm: 'Deploy dock firmware v3.14 via Intune Win32 package.' },
    { title: 'Intermittent One-Way WebRTC Audio Over Split-Tunnel VPN', rca: 'UDP ephemeral ports 3478-3490 hairpinned through corporate NAT.', workaround: 'Bypass media relay CIDRs from VPN tunnel or switch to Personal Mobile bridge.', perm: 'Push updated split-tunnel exclusion rules for AWS Connect & STUN ranges.' },
    { title: 'PostgreSQL Autovacuum Freeze Contention During Nightly ETL', rca: 'Bulk upsert batch size triggers full-table lock during peak reporting window.', workaround: 'Throttle ETL worker concurrency to 4 threads.', perm: 'Partition audit_events table monthly and tune autovacuum_cost_limit.' },
  ];
  const probStatuses: ProblemStatus[] = ['investigating', 'root_cause_identified', 'workaround_published', 'change_requested', 'closed'];
  const problems: Problem[] = [];
  let probSeq = 701;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 32 : 2;
    const tenantInc = incidents.filter(inc => inc.tenantId === spec.id);
    for (let i = 0; i < count; i++) {
      const tpl = problemTemplates[i % problemTemplates.length];
      const owner = pickUser(spec.id, i + 3, true);
      problems.push({
        id: `PRB-${probSeq}`,
        tenantId: spec.id,
        title: i >= problemTemplates.length ? `${tpl.title} (${spec.locations[i % spec.locations.length]})` : tpl.title,
        description: `Root-cause investigation tracking correlated incidents across ${spec.name} infrastructure.`,
        status: probStatuses[i % probStatuses.length],
        severity: i % 5 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'moderate',
        rootCauseAnalysis: tpl.rca,
        workaround: tpl.workaround,
        permanentSolution: tpl.perm,
        linkedIncidentIds: tenantInc.length > 0 ? [tenantInc[i % tenantInc.length].id] : [],
        owner: owner.name,
        isKnownError: i % 2 === 0,
        createdAt: isoDaysAgo(25 - (i % 20)),
        updatedAt: isoDaysAgo(i % 7),
      });
      probSeq += 1;
    }
  });

  // 13. 50 CHANGE REQUESTS / CAB RFCs (36 in Njure Tech HQ + 2 each in other 7 companies)
  const changeTitles = [
    'Upgrade Kubernetes Control Plane to v1.31 Across Production Clusters',
    'Migrate Primary Telephony IVR Queue to Amazon Connect + Mobile Failover',
    'Enforce Hardware FIDO2 MFA Policy for All Privileged IAM Accounts',
    'Rotate Wildcard Edge TLS Certificates & Enable TLS 1.3 Strict Mode',
    'Deploy PostgreSQL 16.4 Minor Security Patch with Zero-Downtime Switchover',
    'Cutover Branch Office SD-WAN Circuit to Dual Active 10GbE Fiber',
    'Enable Automated Firestore Multi-Company Backup & Cross-Device Sync',
    'Roll Out CrowdStrike Falcon 7.19 Sensor to Managed Workstation Fleet',
  ];
  const chgStatuses: ChangeStatus[] = ['draft', 'cab_review', 'scheduled', 'implementation', 'verification', 'completed'];
  const chgTypes: ChangeType[] = ['normal', 'standard', 'emergency'];
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const changes: ChangeRequest[] = [];
  let chgSeq = 801;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 36 : 2;
    for (let i = 0; i < count; i++) {
      const title = changeTitles[i % changeTitles.length];
      const reqBy = pickUser(spec.id, i + 1, true);
      const eng = pickUser(spec.id, i + 3, true);
      const st = chgStatuses[i % chgStatuses.length];
      changes.push({
        id: `CHG-${chgSeq}`,
        tenantId: spec.id,
        title: i >= changeTitles.length ? `${title} · Wave ${Math.floor(i / changeTitles.length) + 1}` : title,
        type: chgTypes[i % chgTypes.length],
        status: st,
        riskScore: riskLevels[i % riskLevels.length],
        reason: `Planned resilience and security modernization initiative for ${spec.name} (${spec.region}).`,
        implementationPlan: '1. Snapshot current production state. 2. Apply rolling update to canary node. 3. Validate p99 latency and error budget. 4. Promote to remaining nodes.',
        rollbackPlan: 'Revert Helm chart / infrastructure state to pre-change immutable snapshot within 8 minutes.',
        testPlan: 'Execute automated synthetic API checks, SSO login probe, and voice test call verification.',
        scheduledStart: `${dateDaysFromNow((i % 14) + 1)}T02:00:00Z`,
        scheduledEnd: `${dateDaysFromNow((i % 14) + 1)}T04:00:00Z`,
        cabVotes: [
          { member: 'Test Super Admin', role: 'CAB Chair', vote: st === 'draft' ? 'pending' : 'approved', notes: 'Rollback plan validated.' },
          { member: eng.name, role: 'Security Reviewer', vote: st === 'draft' || st === 'cab_review' ? 'pending' : 'approved' },
        ],
        requestedBy: reqBy.name,
        assignedEngineer: eng.name,
        createdAt: isoDaysAgo(20 - (i % 18)),
        updatedAt: isoDaysAgo(i % 5),
      });
      chgSeq += 1;
    }
  });

  // 14. 26 PROJECTS & 73 KANBAN TASKS
  const projTitles = [
    'Zero-Trust IAM & FIDO2 Rollout',
    'Global Amazon Connect + Mobile CTI Migration',
    'Multi-Company Branded Portal Consolidation',
    'CMDB Automated Discovery & Dependency Graph',
    'SOC 2 Type II Continuous Compliance Automation',
    'SD-WAN & Edge Firewall Refresh Program',
  ];
  const projStages: ProjectStage[] = ['initiation', 'planning', 'execution', 'uat', 'closed'];
  const projects: ProjectItem[] = [];
  let projSeq = 101;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 12 : 2;
    for (let i = 0; i < count; i++) {
      const owner = pickUser(spec.id, i + 2, true);
      const budget = 45000 + (i % 6) * 22000;
      const pct = 20 + ((i * 17) % 80);
      projects.push({
        id: `PRJ-${projSeq}`,
        tenantId: spec.id,
        code: `${spec.companyCode.split('-')[1]}-26-${projSeq}`,
        title: i >= projTitles.length ? `${projTitles[i % projTitles.length]} (Phase 2)` : projTitles[i % projTitles.length],
        owner: owner.name,
        stage: projStages[i % projStages.length],
        health: i % 5 === 0 ? 'at_risk' : 'on_track',
        progressPct: pct,
        budgetTotal: budget,
        budgetSpent: Math.round((budget * pct) / 100),
        startDate: isoDaysAgo(60 + (i * 5)).split('T')[0],
        targetEndDate: dateDaysFromNow(30 + (i * 10)),
        summary: `Strategic IT transformation program for ${spec.name} across ${spec.locations[0]}.`,
      });
      projSeq += 1;
    }
  });

  const taskCols: TaskColumn[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const taskNames = [
    'Audit privileged IAM policy MFA enforcement',
    'Verify personal mobile GSM shift forwarding codes',
    'Reconcile CMDB serial numbers against Intune export',
    'Draft SOP runbook for Redis failover recovery',
    'Test pre-close approval gates on Incident Process Map',
    'Update SSL renewal alerts for customer domains',
    'Review Q2 software seat compliance over-allocations',
    'Configure AI Triage routing thresholds for P1 security alerts',
  ];
  const tasks: TaskItem[] = [];
  let taskSeq = 901;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 52 : 3;
    const tenantProjs = projects.filter(p => p.tenantId === spec.id);
    for (let i = 0; i < count; i++) {
      const assignee = pickUser(spec.id, i + 1, true);
      const col = taskCols[i % taskCols.length];
      tasks.push({
        id: `TSK-${taskSeq}`,
        tenantId: spec.id,
        title: i >= taskNames.length ? `${taskNames[i % taskNames.length]} · ${spec.locations[i % spec.locations.length].split(' ')[0]}` : taskNames[i % taskNames.length],
        description: `Operational execution task assigned to ${assignee.department} under ${spec.name}.`,
        column: col,
        priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
        assignee: assignee.name,
        dueDate: dateDaysFromNow((i % 21) + 1),
        timeLoggedMins: col === 'backlog' ? 0 : 30 + ((i * 20) % 240),
        projectId: tenantProjs[i % tenantProjs.length]?.id,
        subtasks: [
          { id: `SUB-${taskSeq}-1`, title: 'Validate prerequisites & change window', done: col !== 'backlog' },
          { id: `SUB-${taskSeq}-2`, title: 'Execute verification checklist & capture evidence', done: col === 'review' || col === 'done' },
        ],
        createdAt: isoDaysAgo(15 - (i % 14)),
      });
      taskSeq += 1;
    }
  });

  // 15. CONTRACTS & DOMAINS
  const contracts: ContractRecord[] = [];
  let conSeq = 101;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 18 : 2;
    const vendors = ['Amazon Web Services', 'Google Cloud', 'Palo Alto Networks', 'Twilio Carrier Voice', 'Dell Enterprise Support', 'CrowdStrike'];
    const cTypes: ContractRecord['type'][] = ['cloud', 'software', 'hardware', 'telecom_sim', 'support'];
    for (let i = 0; i < count; i++) {
      const vendor = vendors[i % vendors.length];
      contracts.push({
        id: `CON-${conSeq}`,
        tenantId: spec.id,
        title: `${vendor} Enterprise Agreement (${spec.name.split(' ')[0]})`,
        vendor,
        type: cTypes[i % cTypes.length],
        annualValue: 18000 + ((i * 9500) % 145000),
        startDate: isoDaysAgo(320).split('T')[0],
        renewalDate: dateDaysFromNow(25 + ((i * 31) % 300)),
        noticeDays: 60,
        autoRenew: i % 2 === 0,
        linkedAssetIds: [],
        status: i % 5 === 0 ? 'expiring_soon' : i % 7 === 0 ? 'rfp_open' : 'active',
      });
      conSeq += 1;
    }
  });

  const domains: DomainRecord[] = [];
  let domSeq = 101;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 16 : 2;
    const subs = ['', 'portal.', 'api.', 'status.', 'sso.', 'cti.', 'billing.', 'docs.'];
    for (let i = 0; i < count; i++) {
      domains.push({
        id: `DOM-${domSeq}`,
        tenantId: spec.id,
        domain: `${subs[i % subs.length]}${spec.domain}`,
        registrar: i % 2 === 0 ? 'Cloudflare Registrar' : 'AWS Route 53',
        domainExpiry: dateDaysFromNow(90 + ((i * 45) % 600)),
        sslExpiry: dateDaysFromNow(14 + ((i * 19) % 180)),
        securityGrade: i % 6 === 0 ? 'A' : 'A+',
        dnssecEnabled: true,
        spfValid: true,
        dkimValid: true,
        dmarcPolicy: i % 4 === 0 ? 'quarantine' : 'reject',
        registrarLocked: true,
        lookalikeAlerts: i % 5 === 0 ? 1 : 0,
      });
      domSeq += 1;
    }
  });

  // 16. SERVICE STATUS, MORNING CHECKS, CALENDAR, WAR ROOMS, LMS
  const statusComponents: ServiceStatusComponent[] = [];
  const compDefs: Array<{ name: string; group: ServiceStatusComponent['group'] }> = [
    { name: 'ITSM API & Firestore Sync Engine', group: 'Core Platform' },
    { name: 'AI Incident Triage & Routing Service', group: 'Core Platform' },
    { name: 'Global Edge VPN & SD-WAN Gateways', group: 'Network & Edge' },
    { name: 'Amazon Connect & Mobile CTI Bridge', group: 'Network & Edge' },
    { name: 'Enterprise SSO & FIDO2 Identity Broker', group: 'Identity & Auth' },
    { name: 'End-User Self-Service & Knowledge Bank', group: 'Customer Portal' },
  ];
  let stSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 12 : 2;
    for (let i = 0; i < count; i++) {
      const def = compDefs[i % compDefs.length];
      statusComponents.push({
        id: `CMP-${stSeq}`,
        tenantId: spec.id,
        name: i >= compDefs.length ? `${def.name} (${spec.locations[i % spec.locations.length].split(' ')[0]})` : def.name,
        group: def.group,
        status: i === 2 && tIdx === 0 ? 'degraded' : 'operational',
        uptimePct: i === 2 && tIdx === 0 ? 99.82 : 99.98,
        latencyMs: 18 + ((i * 9) % 45),
        updatedAt: isoDaysAgo(0, i % 4),
      });
      stSeq += 1;
    }
  });

  const morningChecks: MorningCheckRun[] = [];
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const runs = tIdx === 0 ? 10 : 1;
    for (let r = 0; r < runs; r++) {
      const eng = pickUser(spec.id, r + 1, true);
      morningChecks.push({
        id: `CHK-${tIdx + 1}-${r + 1}`,
        tenantId: spec.id,
        date: isoDaysAgo(r).split('T')[0],
        engineer: eng.name,
        completedAt: isoDaysAgo(r),
        items: [
          { id: 'c1', label: 'Primary & Replica Cloud Database Sync Health', category: 'Databases', status: 'pass' },
          { id: 'c2', label: 'Immutable Nightly Backup Verification', category: 'Backups', status: 'pass' },
          { id: 'c3', label: 'Edge BGP & VPN Tunnel Latency < 35ms', category: 'Network', status: r === 0 && tIdx === 0 ? 'warn' : 'pass', note: r === 0 && tIdx === 0 ? 'Elevated jitter on secondary carrier' : undefined },
          { id: 'c4', label: 'SIEM High-Severity Alert Queue Cleared', category: 'Security', status: 'pass' },
          { id: 'c5', label: 'Telephony CCP & Personal Mobile Forwarding Ready', category: 'Infrastructure', status: 'pass' },
        ],
      });
    }
  });

  const calendarEvents: CalendarEvent[] = [];
  let calSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 22 : 2;
    const evTypes: CalendarEvent['type'][] = ['change', 'contract_renewal', 'ssl_expiry', 'project_milestone', 'duty_rota'];
    for (let i = 0; i < count; i++) {
      const owner = pickUser(spec.id, i + 2, true);
      const et = evTypes[i % evTypes.length];
      calendarEvents.push({
        id: `CAL-${calSeq}`,
        tenantId: spec.id,
        title:
          et === 'duty_rota'
            ? `On-Call Mobile Shift Rota · ${owner.name}`
            : et === 'change'
            ? `CAB Maintenance Window · ${spec.locations[i % spec.locations.length]}`
            : et === 'ssl_expiry'
            ? `TLS Certificate Auto-Renewal Audit (${spec.domain})`
            : et === 'contract_renewal'
            ? `Enterprise Vendor Renewal Checkpoint`
            : `Phase Gate Milestone Review`,
        date: dateDaysFromNow((i % 28) + 1),
        type: et,
        owner: owner.name,
      });
      calSeq += 1;
    }
  });

  const warRooms: WarRoomSession[] = [];
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 6 : 1;
    const tIncs = incidents.filter(inc => inc.tenantId === spec.id && inc.priority === 'P1');
    for (let i = 0; i < count; i++) {
      const cmd = pickUser(spec.id, i + 1, true);
      const linked = tIncs[i % Math.max(1, tIncs.length)];
      warRooms.push({
        id: `WR-${tIdx + 1}-${i + 1}`,
        tenantId: spec.id,
        incidentId: linked?.id || `INC-${5001 + i}`,
        title: linked?.title || `Major Incident Command Bridge · ${spec.name}`,
        severity: i % 3 === 0 ? 'P1' : 'P2',
        status: i === 0 ? 'active' : i === 1 ? 'monitoring' : 'closed',
        commander: cmd.name,
        bridgeNumber: `${spec.phonePrefix}880${100 + i}`,
        startedAt: isoDaysAgo(i * 3),
        checklist: [
          { id: 'w1', label: 'Assign Incident Commander & Scribe', done: true },
          { id: 'w2', label: 'Publish initial Service Status advisory', done: true },
          { id: 'w3', label: 'Confirm mitigation & customer verification', done: i > 0 },
        ],
        feed: [
          {
            id: `WM-${tIdx}-${i}-1`,
            timestamp: isoDaysAgo(i * 3),
            author: cmd.name,
            role: 'Incident Commander',
            message: `Bridge initialized for ${spec.name}. Reviewing affected CMDB blast radius and routing live customer updates.`,
          },
        ],
      });
    }
  });

  const lmsCourses: LmsCourse[] = [];
  const courseDefs: Array<{ title: string; cat: LmsCourse['category']; mins: number }> = [
    { title: 'Zero-Trust Phishing & FIDO2 Defense Essentials', cat: 'Security', mins: 25 },
    { title: 'ITIL 4 Incident, Problem & CAB Change Mastery', cat: 'ITIL', mins: 45 },
    { title: 'SOC 2 Type II & ISO 27001 Operational Controls', cat: 'Compliance', mins: 35 },
    { title: 'Omnichannel Telephony & Personal Mobile CTI Operations', cat: 'Operations', mins: 20 },
  ];
  let lmsSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 14 : 1;
    for (let i = 0; i < count; i++) {
      const def = courseDefs[i % courseDefs.length];
      lmsCourses.push({
        id: `LMS-${lmsSeq}`,
        tenantId: spec.id,
        title: i >= courseDefs.length ? `${def.title} · Track ${Math.floor(i / courseDefs.length) + 1}` : def.title,
        category: def.cat,
        durationMins: def.mins,
        mandatory: i % 2 === 0,
        lessons: [
          { id: `L-${lmsSeq}-1`, title: 'Core Policy & Operational Standards', summary: `Mandatory controls for ${spec.name} personnel.`, completed: true },
          { id: `L-${lmsSeq}-2`, title: 'Hands-On Escalation Scenario', summary: 'Walkthrough of live triage, CAB gates, and audit logging.', completed: i % 3 === 0 },
        ],
        scorePct: i % 3 === 0 ? 94 : undefined,
        certified: i % 3 === 0,
      });
      lmsSeq += 1;
    }
  });

  // 17. PROCESS MAPS (Figma-Style Pre-Close Wireframe Maps), CUSTOM FORMS, WORKFLOWS & TICKET RULES
  const processMaps: ProcessMap[] = [];
  let pmSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 10 : 1;
    for (let i = 0; i < count; i++) {
      const scope: ProcessMap['recordScope'] = i % 3 === 0 ? 'incident' : i % 3 === 1 ? 'request' : 'change';
      processMaps.push({
        id: `PMAP-${pmSeq}`,
        tenantId: spec.id,
        title:
          scope === 'incident'
            ? `P1/P2 Incident Pre-Close Verification Blueprint (${i + 1})`
            : scope === 'request'
            ? `Service Request Multi-Stage Approval Flow (${i + 1})`
            : `CAB Change Pre-Close Governance Wireframe (${i + 1})`,
        recordScope: scope,
        owner: pickUser(spec.id, i + 1, true).name,
        updatedAt: isoDaysAgo(i % 15).split('T')[0],
        nodes: [
          { id: 'n1', label: scope === 'incident' ? 'Incident Opened' : scope === 'request' ? 'Request Submitted' : 'RFC Drafted', type: 'start', role: 'Portal / Phone', x: 64, y: 128, slaHours: 0 },
          { id: 'n2', label: 'AI Triage & Routing', type: 'automation', role: 'Gemini Router', x: 304, y: 128, slaHours: 0.25 },
          { id: 'n3', label: 'Manager / CAB Approval Gate', type: 'approval', role: 'Approver Group', x: 560, y: 128, slaHours: 4, approverGroup: 'CAB & Security Leads' },
          { id: 'n4', label: 'Runbook Action & Customer Notify', type: 'action', role: 'L2 Operations', x: 816, y: 128, slaHours: 2 },
          { id: 'n5', label: 'Verified Close & CSAT', type: 'end', role: 'System Gate', x: 1072, y: 128, slaHours: 0 },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3', condition: 'Priority <= P2' },
          { from: 'n3', to: 'n4', condition: 'Approved' },
          { from: 'n4', to: 'n5' },
        ],
      });
      pmSeq += 1;
    }
  });

  const customForms: CustomFormDefinition[] = [];
  let cfSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 10 : 1;
    const cats: CustomFormDefinition['category'][] = ['hardware', 'software', 'access', 'cloud', 'telephony'];
    for (let i = 0; i < count; i++) {
      customForms.push({
        id: `FRM-${cfSeq}`,
        tenantId: spec.id,
        title: `${cats[i % cats.length].toUpperCase()} Provisioning Intake Form #${cfSeq}`,
        category: cats[i % cats.length],
        publishedToPortal: true,
        submissionsCount: 12 + ((cfSeq * 7) % 85),
        updatedAt: isoDaysAgo(i % 20).split('T')[0],
        fields: [
          { id: 'f1', label: 'Business Justification', type: 'textarea', required: true },
          { id: 'f2', label: 'Cost Center Code', type: 'text', required: true },
          { id: 'f3', label: 'Urgency Tier', type: 'select', required: true, options: ['Standard (3-5d)', 'Expedited (24h)', 'Emergency'] },
        ],
      });
      cfSeq += 1;
    }
  });

  const workflows: WorkflowDefinition[] = [];
  let wfSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 12 : 1;
    for (let i = 0; i < count; i++) {
      workflows.push({
        id: `WF-${wfSeq}`,
        tenantId: spec.id,
        name: `Automated ${['P1 Escalation & War Room', 'Hardware Fulfillment', 'Zero-Trust Access Provisioning', 'SSL Expiry Remediation'][i % 4]} Pipeline #${wfSeq}`,
        targetModuleId: i % 2 === 0 ? 'incidents' : 'requests',
        trigger: i % 2 === 0 ? 'module_event' : 'service_request',
        description: `Cross-module automation workflow operating for ${spec.name}.`,
        status: i % 6 === 5 ? 'paused' : 'active',
        executionCount: 18 + ((wfSeq * 11) % 240),
        updatedAt: isoDaysAgo(i % 14).split('T')[0],
        stages: [
          { id: `s-${wfSeq}-1`, name: 'Evaluate Priority & SLA Policy', stepType: 'condition', moduleId: 'incidents', assigneeRole: 'Automation Engine', slaHours: 1 },
          { id: `s-${wfSeq}-2`, name: 'Dispatch Approval / Escalation', stepType: 'approval', moduleId: 'requests', assigneeRole: 'Service Desk Lead', slaHours: 4 },
          { id: `s-${wfSeq}-3`, name: 'Log Audit & Notify Stakeholder', stepType: 'notification', moduleId: 'telephony', assigneeRole: 'System Notifier', slaHours: 1 },
        ],
      });
      wfSeq += 1;
    }
  });

  const ticketWorkflows: TicketWorkflowRule[] = [];
  let twfSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 12 : 1;
    const cats: IncidentCategory[] = ['network', 'security', 'access', 'hardware', 'software', 'telephony'];
    for (let i = 0; i < count; i++) {
      const cat = cats[i % cats.length];
      ticketWorkflows.push({
        id: `TWF-${twfSeq}`,
        tenantId: spec.id,
        name: `Auto-Route ${cat.toUpperCase()} ${i % 2 === 0 ? 'P1/P2' : 'Standard'} Queue Rule`,
        active: true,
        sourceChannel: i % 3 === 0 ? 'phone' : i % 3 === 1 ? 'monitor' : 'all',
        matchCategory: cat,
        matchPriority: i % 2 === 0 ? 'P1' : 'all',
        assignToQueue: `${cat.toUpperCase()} Operations Pool`,
        overrideSlaHours: i % 2 === 0 ? 1 : 8,
        autoEscalateAfterMins: i % 2 === 0 ? 30 : 120,
        allowedTransitions: {
          new: ['assigned', 'in_progress'],
          assigned: ['in_progress', 'pending', 'resolved'],
          in_progress: ['pending', 'resolved'],
          pending: ['in_progress', 'resolved'],
          resolved: ['closed', 'in_progress'],
          closed: ['in_progress'],
        },
        notifyRoles: ['Assignee', 'Shift Manager', 'On-Call Mobile'],
        executionCount: 25 + ((twfSeq * 19) % 310),
        updatedAt: isoDaysAgo(i % 10).split('T')[0],
      });
      twfSeq += 1;
    }
  });

  // 18. 42 TELEPHONY CDRs & PERSONAL MOBILE OPERATIONAL CONFIG PER COMPANY
  const calls: TelephonyCall[] = [];
  const telephonyConfigsByTenant: Record<string, TelephonyProviderConfig> = {};
  let callSeq = 9101;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    telephonyConfigsByTenant[spec.id] = {
      providerType: 'personal_mobile',
      providerLabel: 'Personal Mobile System',
      amazonConnectInstanceAlias: `${spec.slug}-desk`,
      amazonConnectRegion: spec.region.startsWith('eu') ? 'eu-west-2' : 'us-east-1',
      amazonConnectCcpUrl: '',
      sipWssUrl: '',
      sipDomain: spec.domain,
      sipExtension: String(4401 + tIdx),
      stunServer: 'stun:stun.l.google.com:19302',
      personalMobileEnabled: true,
      personalMobileNumber: `${spec.phonePrefix}555019${tIdx}`,
      personalMobileCountryCode: spec.phonePrefix.slice(0, 3),
      personalMobileBridgeMode: 'native_dialer',
      forwardToDeskNumber: `${spec.phonePrefix}800010${tIdx}`,
      autoPopTicketOnInbound: true,
      updatedAt: isoDaysAgo(1),
    };

    const count = tIdx === 0 ? 28 : 2;
    const tenantInc = incidents.filter(inc => inc.tenantId === spec.id);
    for (let i = 0; i < count; i++) {
      const caller = pickUser(spec.id, i + 3, false);
      const viaMobile = i % 2 === 0;
      calls.push({
        id: `CALL-${callSeq}`,
        tenantId: spec.id,
        callerNumber: caller.phone || `${spec.phonePrefix}55502${String(i).padStart(2, '0')}`,
        callerName: caller.name,
        callerCompany: spec.name,
        direction: i % 3 === 0 ? 'outbound' : 'inbound',
        status: 'completed',
        startTime: isoDaysAgo(i % 14, i % 10),
        durationSec: 85 + ((i * 47) % 620),
        providerType: viaMobile ? 'personal_mobile' : 'amazon_connect',
        providerLabel: viaMobile ? 'Personal Mobile System' : 'Amazon Connect CCP',
        disposition: i % 3 === 0 ? 'incident_logged' : 'inquiry_resolved',
        relatedTicketId: i % 3 === 0 && tenantInc[i % tenantInc.length] ? tenantInc[i % tenantInc.length].id : undefined,
        liveTranscript: [
          `System: Session authenticated via ${viaMobile ? 'Personal Mobile Carrier Handoff' : 'Amazon Connect CCP v2'}.`,
          `Caller ID Matched: ${caller.name} · ${caller.department} (${spec.name}).`,
          `Agent Note: Verified identity and resolved / logged operational follow-up.`,
        ],
      });
      callSeq += 1;
    }
  });

  // 19. 38 INVOICES & 92 AUDIT LOGS
  const invoices: Invoice[] = [];
  let invcSeq = 7001;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 24 : 2;
    for (let i = 0; i < count; i++) {
      const amt = 4200 + ((i * 1850) % 28000);
      invoices.push({
        id: `INV-${invcSeq}`,
        tenantId: spec.id,
        customerName: pickUser(spec.id, i, true).name,
        customerEmail: `billing@${spec.domain}`,
        organization: spec.name,
        amount: amt,
        currency: spec.currency,
        status: i % 5 === 0 ? 'overdue' : i % 3 === 0 ? 'pending' : 'paid',
        issueDate: isoDaysAgo(30 + (i * 5)).split('T')[0],
        dueDate: dateDaysFromNow((i % 5 === 0 ? -6 : 14) + (i % 12)),
        paidAt: i % 5 !== 0 && i % 3 !== 0 ? isoDaysAgo(12 + (i % 15)) : undefined,
        paymentMethod: i % 2 === 0 ? 'wire_ach' : 'credit_card',
        lineItems: [
          { description: `Scribble IT ${spec.plan} Seat Allocation & Managed Operations`, quantity: 1, unitPrice: Math.round(amt * 0.75) },
          { description: 'Cloud Telephony CTI & Firestore Multi-Region Sync', quantity: 1, unitPrice: Math.round(amt * 0.25) },
        ],
      });
      invcSeq += 1;
    }
  });

  const auditLogs: AuditLogEntry[] = [];
  let audSeq = 1;
  COMPANY_SPECS.forEach((spec, tIdx) => {
    const count = tIdx === 0 ? 64 : 4;
    const mods = ['Incidents', 'IAM Portal', 'Tenant Governance', 'Telephony', 'Change Advisory', 'Knowledge Bank'];
    const acts = ['CREATE', 'UPDATE', 'POLICY_BIND', 'BRANDING_SYNC', 'CAB_APPROVE', 'CALL_LOGGED'];
    for (let i = 0; i < count; i++) {
      const actor = pickUser(spec.id, i, true);
      auditLogs.push({
        id: `AUD-${String(audSeq).padStart(4, '0')}`,
        tenantId: spec.id,
        timestamp: isoDaysAgo(i % 21, i % 12),
        actor: actor.name,
        module: mods[i % mods.length],
        action: acts[i % acts.length],
        targetId: `${spec.companyCode.split('-')[1]}-${100 + i}`,
        detail: `Verified compliance action recorded for ${spec.name} (${spec.region}).`,
      });
      audSeq += 1;
    }
  });

  cachedBundle = {
    tenants,
    authAccounts,
    iamPolicies,
    incidents,
    requests,
    problems,
    changes,
    assets,
    inventory,
    software,
    tasks,
    projects,
    kbArticles,
    contracts,
    domains,
    statusComponents,
    morningChecks,
    calendarEvents,
    warRooms,
    lmsCourses,
    wikiPages,
    processMaps,
    customForms,
    cmdbRelations,
    auditLogs,
    workflows,
    ticketWorkflows,
    calls,
    invoices,
    telephonyConfigsByTenant,
  };

  return cachedBundle;
}
