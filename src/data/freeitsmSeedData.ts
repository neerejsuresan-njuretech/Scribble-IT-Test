import {
  Tenant, FreeITSMModuleId, Incident, ServiceRequest, Asset, ChangeRequest,
  SoftwareLicense, TaskItem, ProjectItem, KnowledgeArticle, ContractRecord,
  DomainRecord, ServiceStatusComponent, MorningCheckRun, CalendarEvent,
  WarRoomSession, LmsCourse, WikiPage, ProcessMap, CustomFormDefinition,
  CmdbRelation, AuditLogEntry, InventoryItem, Problem, Invoice, TelephonyCall,
  TenantPortalBranding
} from '../types/itsm';

export interface ModuleDefinition {
  id: FreeITSMModuleId;
  label: string;
  code: string;
  group: 'Command' | 'ITSM' | 'CMDB & Assets' | 'Knowledge & Automation' | 'Platform & Workspace';
  path: string;
}

export const ALL_FREEITSM_MODULES: ModuleDefinition[] = [
  { id: 'watchtower', label: 'Watchtower', code: 'watchtower.do', group: 'Command', path: '/watchtower' },
  { id: 'dashboard', label: 'Service Desk', code: 'sys_portal', group: 'Command', path: '/dashboard' },
  { id: 'war_room', label: 'War Room', code: 'war_room.do', group: 'Command', path: '/war-room' },
  { id: 'morning_checks', label: 'Morning Checks', code: 'morning_check.list', group: 'Command', path: '/checks' },
  { id: 'status_page', label: 'Service Status', code: 'status_page.do', group: 'Command', path: '/status' },
  { id: 'calendar', label: 'Calendar & Rota', code: 'sys_calendar.do', group: 'Command', path: '/calendar' },
  { id: 'incidents', label: 'Tickets / Incidents', code: 'incident.list', group: 'ITSM', path: '/incidents' },
  { id: 'requests', label: 'Service Requests', code: 'sc_request.list', group: 'ITSM', path: '/requests' },
  { id: 'problems', label: 'Problem Mgmt', code: 'problem.list', group: 'ITSM', path: '/problems' },
  { id: 'changes', label: 'Change (CAB)', code: 'change_request.list', group: 'ITSM', path: '/changes' },
  { id: 'tasks', label: 'Tasks (Kanban)', code: 'pm_task.list', group: 'ITSM', path: '/tasks' },
  { id: 'projects', label: 'Projects Portfolio', code: 'pm_project.list', group: 'ITSM', path: '/projects' },
  { id: 'assets', label: 'Assets Register', code: 'cmdb_ci.list', group: 'CMDB & Assets', path: '/assets' },
  { id: 'network_map', label: 'CMDB Network Map', code: 'cmdb_map.do', group: 'CMDB & Assets', path: '/cmdb/network-map' },
  { id: 'inventory', label: 'Hardware Inventory', code: 'alm_hardware.list', group: 'CMDB & Assets', path: '/inventory' },
  { id: 'software', label: 'Software & Licences', code: 'sam_software.list', group: 'CMDB & Assets', path: '/software' },
  { id: 'contracts', label: 'Contracts & RFP', code: 'ast_contract.list', group: 'CMDB & Assets', path: '/contracts' },
  { id: 'domains', label: 'Domains & SSL', code: 'cmdb_domain.list', group: 'CMDB & Assets', path: '/domains' },
  { id: 'knowledge', label: 'Knowledge Base', code: 'kb_knowledge.list', group: 'Knowledge & Automation', path: '/knowledge' },
  { id: 'wiki', label: 'System Wiki', code: 'sys_wiki.do', group: 'Knowledge & Automation', path: '/wiki' },
  { id: 'process_mapper', label: 'Process Mapper', code: 'wf_process.do', group: 'Knowledge & Automation', path: '/process-mapper' },
  { id: 'workflow_management', label: 'Workflow Management', code: 'wf_engine.do', group: 'Knowledge & Automation', path: '/workflows' },
  { id: 'ticket_workflow', label: 'Ticket Workflow Mgmt', code: 'wf_ticket.do', group: 'ITSM', path: '/ticket-workflows' },
  { id: 'custom_forms', label: 'Custom Forms', code: 'sc_form_builder.do', group: 'Knowledge & Automation', path: '/forms-builder' },
  { id: 'lms', label: 'LMS Training', code: 'lms_course.list', group: 'Knowledge & Automation', path: '/lms' },
  { id: 'reports', label: 'Reporting & Audit', code: 'sys_report.do', group: 'Platform & Workspace', path: '/reports' },
  { id: 'billing', label: 'Invoices & Billing', code: 'fin_invoice.list', group: 'Platform & Workspace', path: '/billing' },
  { id: 'telephony', label: 'Telephony CTI', code: 'cti_console', group: 'Platform & Workspace', path: '/telephony' },
  { id: 'database', label: 'Database & Sync', code: 'sys_db_sync', group: 'Platform & Workspace', path: '/database' },
  { id: 'iam', label: 'IAM Portal', code: 'sys_iam.do', group: 'Platform & Workspace', path: '/iam' },
  { id: 'google_workspace', label: 'Google Workspace', code: 'gws_bridge', group: 'Platform & Workspace', path: '/workspace/forms' }
];

export const createAllEnabledModules = (): Record<FreeITSMModuleId, boolean> => ({
  watchtower: true,
  dashboard: true,
  incidents: true,
  requests: true,
  problems: true,
  changes: true,
  assets: true,
  network_map: true,
  inventory: true,
  software: true,
  tasks: true,
  projects: true,
  knowledge: true,
  contracts: true,
  domains: true,
  status_page: true,
  morning_checks: true,
  calendar: true,
  war_room: true,
  lms: true,
  wiki: true,
  process_mapper: true,
  workflow_management: true,
  ticket_workflow: true,
  custom_forms: true,
  reports: true,
  telephony: true,
  billing: true,
  database: true,
  iam: true,
  google_workspace: true
});

export const getDefaultTenantBranding = (tenantName = 'Njure Tech'): TenantPortalBranding => ({
  employees: {
    portalName: `${tenantName} IT Portal`,
    subtitle: 'Employee Service Desk & Operations',
    logoDataUrl: ''
  },
  enduser: {
    portalName: `${tenantName} Self-Service`,
    subtitle: 'End-User Support Portal',
    logoDataUrl: ''
  },
  iam: {
    portalName: `${tenantName} IAM`,
    subtitle: 'Identity, Company & Policy Governance',
    logoDataUrl: ''
  }
});

export const DEFAULT_BLANK_TENANT: Tenant = {
  id: 'tenant-default',
  name: 'Njure Tech',
  slug: 'njure-tech',
  companyCode: 'COMP-NJURE-01',
  domain: 'njure.tech',
  plan: 'Enterprise',
  region: 'asia-south1',
  timezone: 'UTC',
  currency: 'USD',
  primaryContactEmail: 'admin@njure.tech',
  status: 'active',
  slaTargets: { P1: 1, P2: 4, P3: 24, P4: 72 },
  enabledModules: createAllEnabledModules(),
  preferenceTemplate: {
    dateFormat: 'YYYY-MM-DD',
    defaultQueue: 'Service Desk',
    autoAssignRota: false,
    requireCabForNormalChange: true,
    portalBannerTitle: 'IT SERVICE DESK'
  },
  portalBranding: getDefaultTenantBranding('Njure Tech'),
  createdAt: new Date().toISOString()
};

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-njure',
    name: 'Njure Tech HQ',
    slug: 'njure-hq',
    domain: 'njuretech.io',
    plan: 'Enterprise',
    region: 'asia-south1',
    timezone: 'UTC',
    currency: 'USD',
    primaryContactEmail: 'ops@njuretech.io',
    status: 'active',
    slaTargets: { P1: 1, P2: 4, P3: 24, P4: 72 },
    enabledModules: createAllEnabledModules(),
    preferenceTemplate: {
      dateFormat: 'YYYY-MM-DD',
      defaultQueue: 'Service Desk Triage Pool',
      autoAssignRota: true,
      requireCabForNormalChange: true,
      portalBannerTitle: 'NJURE TECH SELF SERVICE'
    },
    createdAt: '2025-01-10T00:00:00.000Z'
  },
  {
    id: 'tenant-apex',
    name: 'Apex Genomics Lab',
    slug: 'apex-genomics',
    domain: 'apexgenomics.org',
    plan: 'Dedicated',
    region: 'eu-west2',
    timezone: 'Europe/London',
    currency: 'GBP',
    primaryContactEmail: 'it-desk@apexgenomics.org',
    status: 'active',
    slaTargets: { P1: 1, P2: 2, P3: 12, P4: 48 },
    enabledModules: {
      ...createAllEnabledModules(),
      telephony: false,
      google_workspace: false
    },
    preferenceTemplate: {
      dateFormat: 'DD/MM/YYYY',
      defaultQueue: 'BioCompute NOC',
      autoAssignRota: true,
      requireCabForNormalChange: true,
      portalBannerTitle: 'APEX GENOMICS IT PORTAL'
    },
    createdAt: '2025-04-18T00:00:00.000Z'
  },
  {
    id: 'tenant-meridian',
    name: 'Meridian FinTech Corp',
    slug: 'meridian-fintech',
    domain: 'meridianfin.com',
    plan: 'Managed MSP',
    region: 'us-east1',
    timezone: 'America/New_York',
    currency: 'USD',
    primaryContactEmail: 'noc@meridianfin.com',
    status: 'active',
    slaTargets: { P1: 0.5, P2: 2, P3: 8, P4: 24 },
    enabledModules: createAllEnabledModules(),
    preferenceTemplate: {
      dateFormat: 'MM/DD/YYYY',
      defaultQueue: 'FinOps Tier-2 Escalation',
      autoAssignRota: false,
      requireCabForNormalChange: true,
      portalBannerTitle: 'MERIDIAN SUPPORT DESK'
    },
    createdAt: '2025-07-02T00:00:00.000Z'
  }
];

export const MULTI_TENANT_INCIDENTS: Incident[] = [
  {
    id: 'INC-5102',
    tenantId: 'tenant-apex',
    title: 'Sequencing Cluster NFS Storage Mount Stale Handle on Node-08',
    description: 'HPC sequencing pipeline stalled due to NFSv4 lock lease expiration on Lustre storage controller.',
    status: 'in_progress',
    priority: 'P1',
    urgency: 'high',
    impact: 'high',
    category: 'hardware',
    requesterName: 'Dr. Alistair Finch',
    requesterEmail: 'a.finch@apexgenomics.org',
    assignee: 'Hannah Vance (BioCompute NOC)',
    affectedCI: 'AST-APX-01',
    slaDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    slaBreached: false,
    timeLoggedMins: 42,
    sourceChannel: 'monitor',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    activityLog: [
      { id: 'act-apx-1', timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), author: 'Prometheus Probe', action: 'Alert Ingested', note: 'NFS mount /mnt/seq-raw unresponsive > 45s.' }
    ]
  },
  {
    id: 'INC-5101',
    tenantId: 'tenant-apex',
    title: 'LIMS Barcode Printer Driver Crash on Lab Bench 4',
    description: 'Zebra ZT411 label printer spooling blank manifests after Windows cumulative update.',
    status: 'assigned',
    priority: 'P3',
    urgency: 'medium',
    impact: 'low',
    category: 'hardware',
    requesterName: 'Clara Osei',
    requesterEmail: 'c.osei@apexgenomics.org',
    assignee: 'Liam Reid',
    affectedCI: 'AST-APX-02',
    slaDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
    slaBreached: false,
    timeLoggedMins: 15,
    sourceChannel: 'email',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    activityLog: [
      { id: 'act-apx-2', timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), author: 'Email Parser', action: 'Email-to-Ticket', note: 'Parsed from it-desk@apexgenomics.org.' }
    ]
  },
  {
    id: 'INC-7004',
    tenantId: 'tenant-meridian',
    title: 'FIX Trading Gateway TLS Handshake Latency Spike (>120ms)',
    description: 'Hardware HSM module queue depth exceeded 85% during London/NY market overlap.',
    status: 'in_progress',
    priority: 'P1',
    urgency: 'high',
    impact: 'high',
    category: 'security',
    requesterName: 'Victor Reyes',
    requesterEmail: 'v.reyes@meridianfin.com',
    assignee: 'SecOps Trading Desk',
    affectedCI: 'AST-MRD-01',
    slaDeadline: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
    slaBreached: false,
    timeLoggedMins: 28,
    sourceChannel: 'phone',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    activityLog: [
      { id: 'act-mrd-1', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), author: 'Victor Reyes', action: 'P1 Bridge Opened', note: 'Shifting FIX session load to secondary HSM cluster.' }
    ]
  }
];

export const MULTI_TENANT_ASSETS: Asset[] = [
  {
    id: 'AST-APX-01',
    tenantId: 'tenant-apex',
    assetTag: 'APX-HPC-STOR-01',
    name: 'NetApp AFF A400 NVMe Genomics Array',
    type: 'server',
    serialNumber: 'NTAP-99382-UK',
    ipAddress: '10.44.10.12',
    syncSource: 'vcenter',
    model: 'AFF A400 Dual Controller',
    manufacturer: 'NetApp',
    status: 'in_use',
    location: 'Cambridge BioDC - Cage 2',
    purchaseDate: '2024-02-11',
    warrantyExpiry: '2029-02-11',
    purchaseCost: 48000,
    currentBookValue: 41000,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-APX-01'
  },
  {
    id: 'AST-APX-02',
    tenantId: 'tenant-apex',
    assetTag: 'APX-WS-LAB-04',
    name: 'Lenovo ThinkStation P620 Bench Node',
    type: 'workstation',
    serialNumber: 'LNV-P620-4410',
    ipAddress: '10.44.22.104',
    syncSource: 'intune',
    model: 'Threadripper PRO 5975WX',
    manufacturer: 'Lenovo',
    status: 'in_use',
    assignedTo: 'Dr. Alistair Finch',
    department: 'Wet Lab Automation',
    location: 'Lab Wing B',
    purchaseDate: '2024-06-01',
    warrantyExpiry: '2027-06-01',
    purchaseCost: 6200,
    currentBookValue: 5400,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-APX-02'
  },
  {
    id: 'AST-MRD-01',
    tenantId: 'tenant-meridian',
    assetTag: 'MRD-HSM-NY4-01',
    name: 'Thales Luna Network HSM 7',
    type: 'security_key',
    serialNumber: 'THL-77102-NY',
    ipAddress: '172.16.8.40',
    syncSource: 'manual',
    model: 'Luna A790 FIPS 140-3',
    manufacturer: 'Thales',
    status: 'in_use',
    location: 'Equinix NY4 - SecCage 09',
    purchaseDate: '2024-03-15',
    warrantyExpiry: '2028-03-15',
    purchaseCost: 34000,
    currentBookValue: 29500,
    qrCodeData: 'https://scribble.njuretech.io/asset/AST-MRD-01'
  }
];

export const MULTI_TENANT_REQUESTS: ServiceRequest[] = [
  {
    id: 'REQ-8101',
    tenantId: 'tenant-apex',
    catalogItemId: 'CAT-CLD-GPU',
    catalogItemName: 'A100 GPU Compute Quota Expansion (+4 Nodes)',
    description: 'Required for whole-genome variant calling batch run.',
    requesterName: 'Dr. Alistair Finch',
    requesterEmail: 'a.finch@apexgenomics.org',
    department: 'Bioinformatics',
    cost: 1800,
    status: 'manager_approved',
    currentStage: 2,
    approvals: [
      { role: 'Lab Director', approver: 'Dr. Priya Nair', status: 'approved', timestamp: new Date().toISOString() },
      { role: 'Cloud FinOps', approver: 'Hannah Vance', status: 'pending' }
    ],
    deliveryEstimateDays: 1,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  }
];

export const MULTI_TENANT_PROBLEMS: Problem[] = [
  {
    id: 'PRB-APX-01',
    tenantId: 'tenant-apex',
    title: 'Lustre Metadata Server Memory Fragmentation During Parallel FastQC Jobs',
    description: 'Recurring I/O stalls on compute nodes 01-16 when >400 concurrent small files are opened.',
    status: 'workaround_published',
    severity: 'high',
    rootCauseAnalysis: 'Kernel slab cache pressure on MDS01 caused by un-batched bioinformatics temp files.',
    workaround: 'Route temp scratch I/O to local NVMe /scratch before staging.',
    permanentSolution: 'Upgrade Lustre client kernel module to 2.15.4 LTS.',
    linkedIncidentIds: ['INC-5102'],
    owner: 'Hannah Vance',
    isKnownError: true,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MULTI_TENANT_CHANGES: ChangeRequest[] = [
  {
    id: 'CHG-APX-12',
    tenantId: 'tenant-apex',
    title: 'Upgrade Lustre MDS Kernel & Firmware on Storage Cage 2',
    type: 'normal',
    status: 'cab_review',
    riskScore: 'high',
    reason: 'Resolves PRB-APX-01 NFS/Lustre stale handle lockups.',
    implementationPlan: 'Drain batch queue -> failover MDS01 to MDS02 -> apply kernel patch -> verify mount health.',
    rollbackPlan: 'Revert GRUB default boot entry and failback MDS02.',
    testPlan: 'Run synthetic mdtest 10k-file benchmark.',
    scheduledStart: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
    cabVotes: [
      { member: 'Dr. Priya Nair', role: 'Lab Sponsor', vote: 'approved' },
      { member: 'Hannah Vance', role: 'Storage Lead', vote: 'pending' }
    ],
    requestedBy: 'Hannah Vance',
    assignedEngineer: 'Hannah Vance',
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    activityLog: []
  }
];

export const MULTI_TENANT_INVENTORY: InventoryItem[] = [
  {
    id: 'INV-APX-01',
    tenantId: 'tenant-apex',
    sku: 'QSFP28-100G-SR4',
    name: '100GBASE-SR4 QSFP28 InfiniBand Optical Transceiver',
    category: 'components',
    quantity: 3,
    minThreshold: 6,
    unitCost: 240,
    location: 'Cambridge Cage 2 Locker',
    lastRestocked: '2025-10-01'
  }
];

export const MULTI_TENANT_INVOICES: Invoice[] = [
  {
    id: 'INV-APX-901',
    tenantId: 'tenant-apex',
    customerName: 'Apex Genomics Lab',
    customerEmail: 'accounts@apexgenomics.org',
    organization: 'Apex Genomics Lab Ltd',
    amount: 4200,
    currency: 'GBP',
    status: 'pending',
    issueDate: '2026-11-01',
    dueDate: '2026-11-30',
    lineItems: [{ description: 'Managed BioCompute ITSM & SRE Retainer', quantity: 1, unitPrice: 4200 }]
  }
];

export const MULTI_TENANT_CALLS: TelephonyCall[] = [
  {
    id: 'CALL-MRD-01',
    tenantId: 'tenant-meridian',
    callerNumber: '+1 (212) 555-0184',
    callerName: 'Victor Reyes',
    callerCompany: 'Meridian FinTech Corp',
    direction: 'inbound',
    status: 'completed',
    startTime: new Date(Date.now() - 1800 * 1000).toISOString(),
    durationSec: 210,
    liveTranscript: ['Caller: "FIX gateway latency breached 120ms threshold."', 'Agent: "Opened P1 bridge and engaged SecOps HSM team."'],
    relatedTicketId: 'INC-7004',
    disposition: 'incident_logged'
  }
];

export const INITIAL_SOFTWARE: SoftwareLicense[] = [
  {
    id: 'SW-101',
    tenantId: 'tenant-njure',
    name: 'Microsoft 365 E5 Enterprise',
    vendor: 'Microsoft',
    version: '2026.11',
    licenseType: 'per_seat',
    totalSeats: 150,
    usedSeats: 142,
    annualCost: 85500,
    renewalDate: '2027-02-01',
    source: 'Intune',
    complianceStatus: 'compliant'
  },
  {
    id: 'SW-102',
    tenantId: 'tenant-njure',
    name: 'JetBrains All Products Pack',
    vendor: 'JetBrains',
    version: '2026.3',
    licenseType: 'per_seat',
    totalSeats: 40,
    usedSeats: 43,
    annualCost: 11560,
    renewalDate: '2026-12-10',
    source: 'PowerShell',
    complianceStatus: 'over_allocated'
  },
  {
    id: 'SW-103',
    tenantId: 'tenant-njure',
    name: 'CrowdStrike Falcon Complete',
    vendor: 'CrowdStrike',
    version: '7.18',
    licenseType: 'per_seat',
    totalSeats: 200,
    usedSeats: 184,
    annualCost: 32000,
    renewalDate: '2026-12-05',
    source: 'Intune',
    complianceStatus: 'expiring_soon'
  },
  {
    id: 'SW-APX-01',
    tenantId: 'tenant-apex',
    name: 'Benchling Molecular Biology Suite',
    vendor: 'Benchling',
    version: 'Enterprise 2026',
    licenseType: 'per_seat',
    totalSeats: 60,
    usedSeats: 54,
    annualCost: 42000,
    renewalDate: '2027-03-15',
    source: 'Manual',
    complianceStatus: 'compliant'
  }
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'TSK-301',
    tenantId: 'tenant-njure',
    title: 'Replace rack A-04 blanking baffles and SFP+ optic',
    description: 'Physical datacenter dispatch tied to INC-2048 and CHG-0512.',
    column: 'in_progress',
    priority: 'high',
    assignee: 'Elena Rostova',
    dueDate: '2026-11-18',
    timeLoggedMins: 65,
    linkedRecordId: 'INC-2048',
    projectId: 'PRJ-01',
    subtasks: [
      { id: 'st-1', title: 'Collect -40C/+85C SFP+ from Lockbox B', done: true },
      { id: 'st-2', title: 'Shift HSRP primary to Stack A', done: true },
      { id: 'st-3', title: 'Mount 4U baffles and validate optical dBm', done: false }
    ],
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    id: 'TSK-302',
    tenantId: 'tenant-njure',
    title: 'Rotate Okta SAML IdP signing certificate',
    description: 'Upload rollover metadata XML before 72h expiry deadline.',
    column: 'todo',
    priority: 'high',
    assignee: 'Noah Bennett',
    dueDate: '2026-11-19',
    timeLoggedMins: 0,
    linkedRecordId: 'INC-2046',
    projectId: 'PRJ-02',
    subtasks: [
      { id: 'st-4', title: 'Export staging SAML metadata', done: true },
      { id: 'st-5', title: 'Apply cert in Jira & Confluence SSO', done: false }
    ],
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  },
  {
    id: 'TSK-303',
    tenantId: 'tenant-njure',
    title: 'Audit JetBrains seat reclamation for inactive contractors',
    description: 'Reclaim 5 unused licenses to bring SW-102 back into compliance.',
    column: 'review',
    priority: 'medium',
    assignee: 'Claire Sterling',
    dueDate: '2026-11-22',
    timeLoggedMins: 30,
    subtasks: [
      { id: 'st-6', title: 'Pull 90-day inactivity list from PowerShell audit', done: true }
    ],
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'TSK-304',
    tenantId: 'tenant-njure',
    title: 'Publish WireGuard VPN onboarding KB article',
    description: 'Document macOS/Linux split-tunnel profile install.',
    column: 'done',
    priority: 'low',
    assignee: 'Tariq Al-Mansoor',
    dueDate: '2026-11-15',
    timeLoggedMins: 45,
    linkedRecordId: 'CHG-0511',
    subtasks: [],
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString()
  },
  {
    id: 'TSK-APX-01',
    tenantId: 'tenant-apex',
    title: 'Stage Lustre 2.15.4 RPMs on MDS02',
    description: 'Pre-stage kernel packages ahead of CHG-APX-12 window.',
    column: 'todo',
    priority: 'high',
    assignee: 'Hannah Vance',
    dueDate: '2026-11-18',
    timeLoggedMins: 20,
    linkedRecordId: 'CHG-APX-12',
    subtasks: [],
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'PRJ-01',
    tenantId: 'tenant-njure',
    code: 'PRJ-2026-NET',
    title: 'Zero-Trust WireGuard Mesh & Core Switch Modernization',
    owner: 'Elena Rostova',
    stage: 'execution',
    health: 'on_track',
    progressPct: 68,
    budgetTotal: 65000,
    budgetSpent: 41200,
    startDate: '2026-09-01',
    targetEndDate: '2026-12-20',
    summary: 'Replacing legacy OpenVPN appliances with WireGuard mesh gateways and upgrading DC1 Top-of-Rack 10GbE fabric.'
  },
  {
    id: 'PRJ-02',
    tenantId: 'tenant-njure',
    code: 'PRJ-2026-IAM',
    title: 'FIDO2 Passkey Mandatory Enforcement (ISO 27001)',
    owner: 'Noah Bennett',
    stage: 'uat',
    health: 'at_risk',
    progressPct: 84,
    budgetTotal: 22000,
    budgetSpent: 19400,
    startDate: '2026-08-15',
    targetEndDate: '2026-11-30',
    summary: 'Enforcing hardware WebAuthn tokens across engineering, finance, and production AWS bastions.'
  },
  {
    id: 'PRJ-APX-01',
    tenantId: 'tenant-apex',
    code: 'APX-STOR-26',
    title: 'Lustre All-Flash Genomics Scratch Tier Expansion',
    owner: 'Hannah Vance',
    stage: 'planning',
    health: 'on_track',
    progressPct: 35,
    budgetTotal: 120000,
    budgetSpent: 28000,
    startDate: '2026-10-01',
    targetEndDate: '2027-01-31',
    summary: 'Adding 400TB NVMe OST enclosure to eliminate sequencing pipeline I/O wait.'
  }
];

export const INITIAL_KB: KnowledgeArticle[] = [
  {
    id: 'KB-1001',
    tenantId: 'tenant-njure',
    title: 'WireGuard Multi-Gateway VPN Client Setup (macOS / Linux / Windows)',
    category: 'Networking & VPN',
    visibility: 'public',
    author: 'Tariq Al-Mansoor',
    views: 418,
    helpfulVotes: 64,
    tags: ['VPN', 'WireGuard', 'Remote Access'],
    updatedAt: '2026-11-12',
    content: '1. Download the signed WireGuard profile from the Self-Service Portal.\n2. Import njure-mesh.conf and authenticate via Scribble FIDO2 token.\n3. Verify split-tunnel DNS resolution against 10.100.0.5.'
  },
  {
    id: 'KB-1002',
    tenantId: 'tenant-njure',
    title: 'Runbook: Mitigating Top-of-Rack SFP+ Optical Thermal Throttling',
    category: 'Datacenter Runbooks',
    visibility: 'internal',
    author: 'Elena Rostova',
    views: 92,
    helpfulVotes: 19,
    tags: ['Cisco', 'Switch', 'Thermal', 'PRB-0089'],
    updatedAt: '2026-11-15',
    content: 'Check transceiver DOM telemetry with `show interfaces transceiver detail`. If Rx power drops below -18 dBm or temp exceeds 65C, force fan-speed max and dispatch rack hands to inspect blanking panels.'
  },
  {
    id: 'KB-APX-01',
    tenantId: 'tenant-apex',
    title: 'BioCompute Scratch Staging Protocol (Lustre Best Practices)',
    category: 'HPC Storage',
    visibility: 'public',
    author: 'Hannah Vance',
    views: 154,
    helpfulVotes: 31,
    tags: ['Lustre', 'HPC', 'Storage'],
    updatedAt: '2026-11-10',
    content: 'Always stage raw FASTQ shards on local NVMe /scratch before archiving consolidated BAM/CRAM outputs to /mnt/seq-raw.'
  }
];

export const INITIAL_CONTRACTS: ContractRecord[] = [
  {
    id: 'CTR-401',
    tenantId: 'tenant-njure',
    title: 'Cisco SmartNet Total Care (DC1 Core Switching)',
    vendor: 'Cisco Systems',
    type: 'hardware',
    annualValue: 18400,
    startDate: '2024-04-15',
    renewalDate: '2026-12-10',
    noticeDays: 30,
    autoRenew: false,
    linkedAssetIds: ['AST-4011'],
    status: 'expiring_soon',
    rfpNotes: 'Evaluate multi-year renewal vs Juniper EX4400 competitive RFP.'
  },
  {
    id: 'CTR-402',
    tenantId: 'tenant-njure',
    title: 'SIP Trunking & Global DID Enterprise Voice',
    vendor: 'Twilio / Colt Telecom',
    type: 'telecom_sim',
    annualValue: 24000,
    startDate: '2025-01-01',
    renewalDate: '2027-01-01',
    noticeDays: 60,
    autoRenew: true,
    linkedAssetIds: [],
    status: 'active'
  },
  {
    id: 'CTR-403',
    tenantId: 'tenant-njure',
    title: 'Cloud Observability & APM Log Retention',
    vendor: 'Datadog Inc.',
    type: 'cloud',
    annualValue: 46800,
    startDate: '2026-02-01',
    renewalDate: '2026-12-01',
    noticeDays: 45,
    autoRenew: false,
    linkedAssetIds: ['AST-1002'],
    status: 'rfp_open',
    rfpNotes: 'RFP comparing Datadog vs Grafana Cloud / Prometheus self-hosted.'
  },
  {
    id: 'CTR-APX-01',
    tenantId: 'tenant-apex',
    title: 'NetApp SupportEdge Premium 4-Hour Onsite',
    vendor: 'NetApp UK',
    type: 'hardware',
    annualValue: 14500,
    startDate: '2025-02-11',
    renewalDate: '2027-02-11',
    noticeDays: 30,
    autoRenew: true,
    linkedAssetIds: ['AST-APX-01'],
    status: 'active'
  }
];

export const INITIAL_DOMAINS: DomainRecord[] = [
  {
    id: 'DOM-01',
    tenantId: 'tenant-njure',
    domain: 'njuretech.io',
    registrar: 'Cloudflare Registrar',
    domainExpiry: '2028-04-12',
    sslExpiry: '2026-12-08',
    securityGrade: 'A+',
    dnssecEnabled: true,
    spfValid: true,
    dkimValid: true,
    dmarcPolicy: 'reject',
    registrarLocked: true,
    lookalikeAlerts: 0
  },
  {
    id: 'DOM-02',
    tenantId: 'tenant-njure',
    domain: 'scribble-itsm.com',
    registrar: 'GoDaddy Corporate',
    domainExpiry: '2026-12-03',
    sslExpiry: '2026-11-29',
    securityGrade: 'C',
    dnssecEnabled: false,
    spfValid: true,
    dkimValid: false,
    dmarcPolicy: 'none',
    registrarLocked: true,
    lookalikeAlerts: 2
  },
  {
    id: 'DOM-APX-01',
    tenantId: 'tenant-apex',
    domain: 'apexgenomics.org',
    registrar: 'AWS Route53',
    domainExpiry: '2027-08-19',
    sslExpiry: '2027-01-14',
    securityGrade: 'A',
    dnssecEnabled: true,
    spfValid: true,
    dkimValid: true,
    dmarcPolicy: 'quarantine',
    registrarLocked: true,
    lookalikeAlerts: 0
  }
];

export const INITIAL_STATUS_COMPONENTS: ServiceStatusComponent[] = [
  {
    id: 'STS-01',
    tenantId: 'tenant-njure',
    name: 'Core Switching & DevOps Staging VLAN 100',
    group: 'Network & Edge',
    status: 'degraded',
    uptimePct: 99.42,
    latencyMs: 148,
    linkedIncidentId: 'INC-2048',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'STS-02',
    tenantId: 'tenant-njure',
    name: 'PostgreSQL Primary & Read Replica Cluster',
    group: 'Core Platform',
    status: 'degraded',
    uptimePct: 99.81,
    latencyMs: 62,
    linkedIncidentId: 'INC-2047',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'STS-03',
    tenantId: 'tenant-njure',
    name: 'Okta SAML / FIDO2 Identity Provider',
    group: 'Identity & Auth',
    status: 'operational',
    uptimePct: 99.99,
    latencyMs: 19,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'STS-04',
    tenantId: 'tenant-njure',
    name: 'Customer Self-Service Portal & API Gateway',
    group: 'Customer Portal',
    status: 'operational',
    uptimePct: 99.98,
    latencyMs: 24,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'STS-APX-01',
    tenantId: 'tenant-apex',
    name: 'Lustre Parallel Genomics Storage Cluster',
    group: 'Core Platform',
    status: 'partial_outage',
    uptimePct: 98.9,
    latencyMs: 310,
    linkedIncidentId: 'INC-5102',
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_MORNING_CHECKS: MorningCheckRun[] = [
  {
    id: 'MC-2026-11-17',
    tenantId: 'tenant-njure',
    date: '2026-11-17',
    engineer: 'Elena Rostova',
    completedAt: '08:15 UTC',
    items: [
      { id: 'm1', label: 'Off-site Immutable Backup Snapshot Verification (S3 Object Lock)', category: 'Backups', status: 'pass', note: 'Verified 04:00 UTC snapshot checksum.' },
      { id: 'm2', label: 'Core Switch Stack A/B BGP Peer & Optical Rx Thresholds', category: 'Network', status: 'fail', note: 'Stack B Te1/0/2 Rx at -19.4 dBm (INC-2048).' },
      { id: 'm3', label: 'PostgreSQL Replication Lag (<30s)', category: 'Databases', status: 'warn', note: 'Replica lag spiked to 620s during analytics batch (INC-2047).' },
      { id: 'm4', label: 'CrowdStrike & SIEM Critical Alert Queue Clear', category: 'Security', status: 'pass', note: '0 unacknowledged P1 security alerts.' },
      { id: 'm5', label: 'UPS Battery Telemetry & Rack A/B Hot-Aisle Temp (<28C)', category: 'Infrastructure', status: 'pass', note: 'Rack B nominal at 23.4C.' }
    ]
  },
  {
    id: 'MC-2026-11-16',
    tenantId: 'tenant-njure',
    date: '2026-11-16',
    engineer: 'Tariq Al-Mansoor',
    completedAt: '08:05 UTC',
    items: [
      { id: 'm1', label: 'Off-site Immutable Backup Snapshot Verification (S3 Object Lock)', category: 'Backups', status: 'pass' },
      { id: 'm2', label: 'Core Switch Stack A/B BGP Peer & Optical Rx Thresholds', category: 'Network', status: 'pass' },
      { id: 'm3', label: 'PostgreSQL Replication Lag (<30s)', category: 'Databases', status: 'pass' },
      { id: 'm4', label: 'CrowdStrike & SIEM Critical Alert Queue Clear', category: 'Security', status: 'pass' },
      { id: 'm5', label: 'UPS Battery Telemetry & Rack A/B Hot-Aisle Temp (<28C)', category: 'Infrastructure', status: 'pass' }
    ]
  },
  {
    id: 'MC-APX-11-17',
    tenantId: 'tenant-apex',
    date: '2026-11-17',
    engineer: 'Hannah Vance',
    completedAt: '08:30 UTC',
    items: [
      { id: 'm1', label: 'Lustre MDS & OST Mount Health Across Compute Nodes', category: 'Infrastructure', status: 'fail', note: 'Node-08 stale file handle (INC-5102).' },
      { id: 'm2', label: 'Genomics Archive Tape Sync', category: 'Backups', status: 'pass' }
    ]
  }
];

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'CAL-01', tenantId: 'tenant-njure', title: 'CHG-0512: Rack A-04 Baffle & Switch Reload', date: '2026-11-18', type: 'change', owner: 'Elena Rostova', linkedId: 'CHG-0512' },
  { id: 'CAL-02', tenantId: 'tenant-njure', title: 'On-Call Primary Duty Rota: Elena Rostova (NetOps)', date: '2026-11-17', endDate: '2026-11-24', type: 'duty_rota', owner: 'Elena Rostova' },
  { id: 'CAL-03', tenantId: 'tenant-njure', title: 'SSL Renewal: scribble-itsm.com', date: '2026-11-29', type: 'ssl_expiry', owner: 'Noah Bennett', linkedId: 'DOM-02' },
  { id: 'CAL-04', tenantId: 'tenant-njure', title: 'Contract Notice Deadline: Datadog APM (CTR-403)', date: '2026-12-01', type: 'contract_renewal', owner: 'Claire Sterling', linkedId: 'CTR-403' },
  { id: 'CAL-05', tenantId: 'tenant-njure', title: 'PRJ-02 FIDO2 Mandatory Cutover Gate', date: '2026-11-30', type: 'project_milestone', owner: 'Noah Bennett', linkedId: 'PRJ-02' },
  { id: 'CAL-APX-01', tenantId: 'tenant-apex', title: 'On-Call BioCompute Rota: Hannah Vance', date: '2026-11-17', endDate: '2026-11-24', type: 'duty_rota', owner: 'Hannah Vance' }
];

export const INITIAL_WAR_ROOMS: WarRoomSession[] = [
  {
    id: 'WAR-2048',
    tenantId: 'tenant-njure',
    incidentId: 'INC-2048',
    title: 'Major Incident Bridge: Core Switch Stack B 10GbE Optical Degradation',
    severity: 'P1',
    status: 'active',
    commander: 'Elena Rostova',
    bridgeNumber: '+44 20 7946 8800 · PIN 4409#',
    startedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    checklist: [
      { id: 'wc-1', label: 'Confirm secondary Stack A HSRP failover active', done: true },
      { id: 'wc-2', label: 'Dispatch datacenter smart-hands to Rack A-04', done: true },
      { id: 'wc-3', label: 'Update Service Status Page banner', done: true },
      { id: 'wc-4', label: 'Swap SFP+ optic & verify 0% packet loss for 15m', done: false }
    ],
    feed: [
      { id: 'wm-1', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), author: 'Elena Rostova', role: 'Incident Commander', message: 'Bridge opened. Traffic shifted off Te1/0/2 onto backup Stack A link.' },
      { id: 'wm-2', timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(), author: 'Marcus Vance', role: 'DevOps Stakeholder', message: 'Staging build cluster packet loss dropped from 28% to 0.4% after reroute.' },
      { id: 'wm-3', timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(), author: 'DC1 Smart Hands', role: 'Field Tech', message: 'At Rack A-04 now with replacement industrial SFP-10G-SR-X.' }
    ]
  },
  {
    id: 'WAR-APX-01',
    tenantId: 'tenant-apex',
    incidentId: 'INC-5102',
    title: 'BioCompute P1 Bridge: Lustre /mnt/seq-raw Stale Mount Recovery',
    severity: 'P1',
    status: 'active',
    commander: 'Hannah Vance',
    bridgeNumber: 'Bridge Room #2 (Internal SIP 7001)',
    startedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    checklist: [
      { id: 'wca-1', label: 'Pause Slurm genomics batch queue', done: true },
      { id: 'wca-2', label: 'Force unmount stale NFSv4 sessions on Node-08', done: false }
    ],
    feed: [
      { id: 'wma-1', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), author: 'Hannah Vance', role: 'Storage Lead', message: 'Slurm queue drained; running Lustre lctl health check.' }
    ]
  }
];

export const INITIAL_LMS_COURSES: LmsCourse[] = [
  {
    id: 'LMS-01',
    tenantId: 'tenant-njure',
    title: 'ISO 27001 & FIDO2 Zero-Trust Authentication Standards',
    category: 'Security',
    durationMins: 25,
    mandatory: true,
    certified: true,
    scorePct: 100,
    lessons: [
      { id: 'l1', title: '1. Hardware WebAuthn & Phishing Resistance', summary: 'How FIDO2 cryptographic origin binding blocks AitM proxies.', completed: true },
      { id: 'l2', title: '2. Bastion Session Recording & Least Privilege', summary: 'Ephemeral SSH certificates and audit logging.', completed: true }
    ]
  },
  {
    id: 'LMS-02',
    tenantId: 'tenant-njure',
    title: 'ITIL v4 Incident, Problem & CAB Change Lifecycle',
    category: 'ITIL',
    durationMins: 35,
    mandatory: true,
    certified: false,
    lessons: [
      { id: 'l3', title: '1. Differentiating Incidents vs Known Errors (KEDB)', summary: 'Linking recurring tickets to Root Cause Investigations.', completed: true },
      { id: 'l4', title: '2. Emergency vs Normal CAB Risk Scoring', summary: 'Mandatory rollback criteria and blast-radius verification.', completed: false },
      { id: 'l5', title: '3. Post-Incident Review (PIR) Blameless Standards', summary: 'Actionable remediation tracking in Kanban tasks.', completed: false }
    ]
  },
  {
    id: 'LMS-APX-01',
    tenantId: 'tenant-apex',
    title: 'GxP & HIPAA Compliant Bioinformatics Data Handling',
    category: 'Compliance',
    durationMins: 40,
    mandatory: true,
    certified: false,
    lessons: [
      { id: 'la1', title: '1. Encryption at Rest & Sample Pseudonymization', summary: 'Handling genomic metadata under regulatory controls.', completed: false }
    ]
  }
];

export const INITIAL_WIKI_PAGES: WikiPage[] = [
  {
    id: 'WIKI-01',
    tenantId: 'tenant-njure',
    title: 'DC1 Top-of-Rack Network Architecture & VLAN Allocation',
    section: 'Architecture',
    author: 'Elena Rostova',
    updatedAt: '2026-11-10',
    content: 'VLAN 100: DevOps Staging (10.100.0.0/16)\nVLAN 200: Production DB Tier (10.200.0.0/16)\nVLAN 300: Voice & SIP Trunking (10.250.4.0/24)\nAll core links terminate on Catalyst 9300 Stack A/B via LACP 2x10GbE.'
  },
  {
    id: 'WIKI-02',
    tenantId: 'tenant-njure',
    title: 'SOP: Morning Operational Checks & Escalation Thresholds',
    section: 'SOPs',
    author: 'Claire Sterling',
    updatedAt: '2026-11-14',
    content: 'Daily checks must complete by 08:30 UTC. Any FAIL status requires opening a P1/P2 Incident within 10 minutes and linking the incident ID in the check note.'
  },
  {
    id: 'WIKI-APX-01',
    tenantId: 'tenant-apex',
    title: 'Cambridge BioDC Storage Cage Wiring Map',
    section: 'Architecture',
    author: 'Hannah Vance',
    updatedAt: '2026-11-05',
    content: 'NetApp AFF A400 controllers connect to dual Mellanox 100GbE switches in Cage 2 via QSFP28 optical trunks.'
  }
];

export const INITIAL_PROCESS_MAPS: ProcessMap[] = [
  {
    id: 'PROC-01',
    tenantId: 'tenant-njure',
    title: 'P1 Major Incident & War Room Escalation Flow',
    owner: 'Elena Rostova',
    linkedKbId: 'KB-1002',
    updatedAt: '2026-11-11',
    nodes: [
      { id: 'n1', label: 'Inbound Alert / Ticket', type: 'start', role: 'Monitoring / Portal', x: 40, y: 80 },
      { id: 'n2', label: 'Impact >= High?', type: 'decision', role: 'Triage Engineer', x: 250, y: 80 },
      { id: 'n3', label: 'Open War Room & Update Status Page', type: 'action', role: 'Incident Commander', x: 470, y: 30 },
      { id: 'n4', label: 'Standard Queue SLA', type: 'action', role: 'L2 Service Desk', x: 470, y: 150 },
      { id: 'n5', label: 'PIR & KEDB Closure', type: 'end', role: 'Problem Manager', x: 690, y: 80 }
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3', condition: 'P1 / P2' },
      { from: 'n2', to: 'n4', condition: 'P3 / P4' },
      { from: 'n3', to: 'n5' },
      { from: 'n4', to: 'n5' }
    ]
  }
];

export const INITIAL_CUSTOM_FORMS: CustomFormDefinition[] = [
  {
    id: 'FRM-01',
    tenantId: 'tenant-njure',
    title: 'New Contractor Onboarding & Hardware Kit Request',
    category: 'access',
    publishedToPortal: true,
    submissionsCount: 14,
    updatedAt: '2026-11-12',
    fields: [
      { id: 'f1', label: 'Contractor Full Name', type: 'text', required: true },
      { id: 'f2', label: 'Start Date', type: 'date', required: true },
      { id: 'f3', label: 'Target Access Tier', type: 'select', required: true, options: ['Standard SaaS Only', 'Engineering Repo + VPN', 'Production Bastion Read-Only'] },
      { id: 'f4', label: 'Requires FIDO2 Hardware Token', type: 'checkbox', required: false }
    ]
  },
  {
    id: 'FRM-02',
    tenantId: 'tenant-njure',
    title: 'Firewall Port & Cloud Security Group Exception',
    category: 'cloud',
    publishedToPortal: true,
    submissionsCount: 9,
    updatedAt: '2026-11-14',
    fields: [
      { id: 'f5', label: 'Source CIDR / Service', type: 'text', required: true },
      { id: 'f6', label: 'Destination Port & Protocol', type: 'text', required: true },
      { id: 'f7', label: 'Business Justification', type: 'textarea', required: true }
    ]
  }
];

export const INITIAL_CMDB_RELATIONS: CmdbRelation[] = [
  { id: 'REL-01', tenantId: 'tenant-njure', sourceId: 'AST-1002', targetId: 'AST-4011', relationType: 'connects_to', criticality: 'critical' },
  { id: 'REL-02', tenantId: 'tenant-njure', sourceId: 'AST-4011', targetId: 'DOM-01', relationType: 'hosts', criticality: 'critical' },
  { id: 'REL-03', tenantId: 'tenant-njure', sourceId: 'AST-5023', targetId: 'AST-9014', relationType: 'secured_by', criticality: 'high' },
  { id: 'REL-04', tenantId: 'tenant-njure', sourceId: 'AST-1002', targetId: 'AST-9014', relationType: 'secured_by', criticality: 'critical' },
  { id: 'REL-APX-01', tenantId: 'tenant-apex', sourceId: 'AST-APX-02', targetId: 'AST-APX-01', relationType: 'depends_on', criticality: 'critical' }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  { id: 'AUD-01', tenantId: 'tenant-njure', timestamp: new Date(Date.now() - 1800 * 1000).toISOString(), actor: 'Elena Rostova', module: 'Incidents', action: 'ASSIGN', targetId: 'INC-2048', detail: 'Assigned P1 optical flapping ticket to L3 NetOps' },
  { id: 'AUD-02', tenantId: 'tenant-njure', timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), actor: 'Noah Bennett', module: 'Change (CAB)', action: 'CAB_VOTE', targetId: 'CHG-0512', detail: 'Approved emergency firmware window after hash check' },
  { id: 'AUD-03', tenantId: 'tenant-njure', timestamp: new Date(Date.now() - 7200 * 1000).toISOString(), actor: 'System Scheduler', module: 'Domains & SSL', action: 'ALERT', targetId: 'DOM-02', detail: 'SSL certificate scribble-itsm.com expires in <14 days' },
  { id: 'AUD-APX-01', tenantId: 'tenant-apex', timestamp: new Date(Date.now() - 2400 * 1000).toISOString(), actor: 'Hannah Vance', module: 'War Room', action: 'OPEN_BRIDGE', targetId: 'WAR-APX-01', detail: 'Opened P1 BioCompute bridge for Lustre /mnt/seq-raw' }
];
