import { AuthPortalType, FreeITSMModuleId, IamPermissionScope, Role } from '../types/itsm';

export type NavSectionId =
  | 'command'
  | 'itsm'
  | 'cmdb'
  | 'automation'
  | 'finance'
  | 'audit_comms'
  | 'knowledge'
  | 'workspace'
  | 'governance';

export type NavIconKey =
  | 'eye'
  | 'server'
  | 'radio'
  | 'clipboard_check'
  | 'activity'
  | 'calendar'
  | 'alert_triangle'
  | 'package'
  | 'shield_check'
  | 'git_pull_request'
  | 'kanban'
  | 'folder_kanban'
  | 'hard_drive_server'
  | 'git_fork'
  | 'refresh_cw'
  | 'key_round'
  | 'file_spreadsheet'
  | 'globe'
  | 'workflow'
  | 'git_commit'
  | 'network'
  | 'form_input'
  | 'book_open'
  | 'library'
  | 'graduation_cap'
  | 'dollar_sign'
  | 'bar_chart'
  | 'phone'
  | 'file_text'
  | 'message_square'
  | 'sheet'
  | 'hard_drive'
  | 'shield'
  | 'building'
  | 'sliders'
  | 'database';

export interface NavAccessRule {
  /** Strictly restricted to authenticated Super Admin Portal sessions */
  superAdminOnly?: boolean;
  /** Always accessible to authenticated IAM Portal sessions in addition to scopes */
  allowIamPortal?: boolean;
  /** Accessible to any authenticated corporate staff user (non-end-user) */
  publicCorporate?: boolean;
  /** Single required IAM permission scope (Super Admin bypasses) */
  requiredScope?: IamPermissionScope;
  /** User must possess at least one of these scopes (Super Admin bypasses) */
  anyOfScopes?: IamPermissionScope[];
  /** Human-readable access requirement shown on direct URL route denial */
  clearanceLabel: string;
}

export interface NavModuleItem {
  id: string;
  sectionId: NavSectionId;
  moduleId?: FreeITSMModuleId;
  path: string;
  label: string;
  code: string;
  icon: NavIconKey;
  newPath?: string;
  newPathScope?: IamPermissionScope;
  access: NavAccessRule;
}

export interface NavSectionMeta {
  id: NavSectionId;
  title: string;
  subtitle: string;
  defaultExpanded: boolean;
}

/**
 * 9 Preserved Enterprise Navigation Groups:
 * 1. Command & Operations
 * 2. ITSM & Delivery
 * 3. CMDB & Assets
 * 4. Automation & Workflows
 * 5. Finance
 * 6. Audit & Communications
 * 7. Knowledge & Learning
 * 8. Google Workspace
 * 9. Governance & Platform
 */
export const NAV_SECTION_METADATA: Record<NavSectionId, NavSectionMeta> = {
  command: {
    id: 'command',
    title: 'Command & Operations',
    subtitle: 'Live monitoring & response',
    defaultExpanded: true,
  },
  itsm: {
    id: 'itsm',
    title: 'ITSM & Delivery',
    subtitle: 'Tickets, requests & CAB',
    defaultExpanded: true,
  },
  cmdb: {
    id: 'cmdb',
    title: 'CMDB & Assets',
    subtitle: 'Hardware, software & vendors',
    defaultExpanded: true,
  },
  automation: {
    id: 'automation',
    title: 'Automation & Workflows',
    subtitle: 'Rules, maps & custom forms',
    defaultExpanded: true,
  },
  finance: {
    id: 'finance',
    title: 'Finance',
    subtitle: 'Invoices & billing controls',
    defaultExpanded: true,
  },
  audit_comms: {
    id: 'audit_comms',
    title: 'Audit & Communications',
    subtitle: 'Reporting, audit & telephony',
    defaultExpanded: true,
  },
  knowledge: {
    id: 'knowledge',
    title: 'Knowledge & Learning',
    subtitle: 'SOPs, wiki & LMS',
    defaultExpanded: false,
  },
  workspace: {
    id: 'workspace',
    title: 'Google Workspace',
    subtitle: 'Connected workspace apps',
    defaultExpanded: false,
  },
  governance: {
    id: 'governance',
    title: 'Governance & Platform',
    subtitle: 'IAM, tenants & cloud sync',
    defaultExpanded: true,
  },
};

export const NAV_MODULES: NavModuleItem[] = [
  // 1. Command & Operations
  {
    id: 'watchtower',
    sectionId: 'command',
    moduleId: 'watchtower',
    path: '/watchtower',
    label: 'Watchtower',
    code: 'watchtower.do',
    icon: 'eye',
    access: {
      publicCorporate: true,
      clearanceLabel: 'Authenticated corporate access',
    },
  },
  {
    id: 'dashboard',
    sectionId: 'command',
    moduleId: 'dashboard',
    path: '/dashboard',
    label: 'Service Desk',
    code: 'sys_portal',
    icon: 'server',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'IT Operations (incidents:write)',
    },
  },
  {
    id: 'war_room',
    sectionId: 'command',
    moduleId: 'war_room',
    path: '/war-room',
    label: 'War Room',
    code: 'war_room.do',
    icon: 'radio',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Incident Response (incidents:write)',
    },
  },
  {
    id: 'morning_checks',
    sectionId: 'command',
    moduleId: 'morning_checks',
    path: '/checks',
    label: 'Morning Checks',
    code: 'morning_check.list',
    icon: 'clipboard_check',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Operations Checks (incidents:write)',
    },
  },
  {
    id: 'status_page',
    sectionId: 'command',
    moduleId: 'status_page',
    path: '/status',
    label: 'Service Status',
    code: 'status_page.do',
    icon: 'activity',
    access: {
      publicCorporate: true,
      clearanceLabel: 'Authenticated corporate access',
    },
  },
  {
    id: 'calendar',
    sectionId: 'command',
    moduleId: 'calendar',
    path: '/calendar',
    label: 'Calendar & Rota',
    code: 'sys_calendar.do',
    icon: 'calendar',
    access: {
      anyOfScopes: ['incidents:write', 'changes:cab_vote', 'iam:manage'],
      clearanceLabel: 'Operations, CAB, or IAM access',
    },
  },

  // 2. ITSM & Delivery
  {
    id: 'incidents',
    sectionId: 'itsm',
    moduleId: 'incidents',
    path: '/incidents',
    label: 'Tickets & Incidents',
    code: 'incident.list',
    icon: 'alert_triangle',
    newPath: '/incidents/new',
    newPathScope: 'incidents:write',
    access: {
      requiredScope: 'incidents:read',
      clearanceLabel: 'Incident Read (incidents:read)',
    },
  },
  {
    id: 'requests',
    sectionId: 'itsm',
    moduleId: 'requests',
    path: '/requests',
    label: 'Service Requests',
    code: 'sc_request.list',
    icon: 'package',
    newPath: '/requests/new',
    newPathScope: 'incidents:write',
    access: {
      anyOfScopes: ['incidents:read', 'requests:approve'],
      clearanceLabel: 'Service Request or Approver scope',
    },
  },
  {
    id: 'problems',
    sectionId: 'itsm',
    moduleId: 'problems',
    path: '/problems',
    label: 'Problem Mgmt',
    code: 'problem.list',
    icon: 'shield_check',
    newPath: '/problems/new',
    newPathScope: 'incidents:write',
    access: {
      requiredScope: 'incidents:read',
      clearanceLabel: 'Problem Visibility (incidents:read)',
    },
  },
  {
    id: 'changes',
    sectionId: 'itsm',
    moduleId: 'changes',
    path: '/changes',
    label: 'Change Advisory (CAB)',
    code: 'change_request.list',
    icon: 'git_pull_request',
    newPath: '/changes/new',
    newPathScope: 'incidents:write',
    access: {
      anyOfScopes: ['incidents:read', 'changes:cab_vote'],
      clearanceLabel: 'Change Visibility or CAB Member scope',
    },
  },
  {
    id: 'tasks',
    sectionId: 'itsm',
    moduleId: 'tasks',
    path: '/tasks',
    label: 'Tasks (Kanban)',
    code: 'pm_task.list',
    icon: 'kanban',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Operations Delivery (incidents:write)',
    },
  },
  {
    id: 'projects',
    sectionId: 'itsm',
    moduleId: 'projects',
    path: '/projects',
    label: 'Projects Portfolio',
    code: 'pm_project.list',
    icon: 'folder_kanban',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Operations Delivery (incidents:write)',
    },
  },

  // 3. CMDB & Assets
  {
    id: 'assets',
    sectionId: 'cmdb',
    moduleId: 'assets',
    path: '/assets',
    label: 'Assets Register',
    code: 'cmdb_ci.list',
    icon: 'hard_drive_server',
    newPath: '/assets/new',
    newPathScope: 'assets:write',
    access: {
      requiredScope: 'assets:read',
      clearanceLabel: 'CMDB Asset Read (assets:read)',
    },
  },
  {
    id: 'network_map',
    sectionId: 'cmdb',
    moduleId: 'network_map',
    path: '/cmdb/network-map',
    label: 'CMDB Network Map',
    code: 'cmdb_map.do',
    icon: 'git_fork',
    access: {
      requiredScope: 'assets:read',
      clearanceLabel: 'CMDB Topology (assets:read)',
    },
  },
  {
    id: 'inventory',
    sectionId: 'cmdb',
    moduleId: 'inventory',
    path: '/inventory',
    label: 'Hardware Inventory',
    code: 'alm_consumable.list',
    icon: 'refresh_cw',
    newPath: '/inventory/new',
    newPathScope: 'assets:write',
    access: {
      requiredScope: 'assets:write',
      clearanceLabel: 'Asset Operations (assets:write)',
    },
  },
  {
    id: 'software',
    sectionId: 'cmdb',
    moduleId: 'software',
    path: '/software',
    label: 'Software & Licences',
    code: 'sam_software.list',
    icon: 'key_round',
    access: {
      requiredScope: 'assets:read',
      clearanceLabel: 'Software Asset Visibility (assets:read)',
    },
  },
  {
    id: 'contracts',
    sectionId: 'cmdb',
    moduleId: 'contracts',
    path: '/contracts',
    label: 'Contracts & RFP',
    code: 'ast_contract.list',
    icon: 'file_spreadsheet',
    access: {
      anyOfScopes: ['assets:write', 'billing:read'],
      clearanceLabel: 'Asset Management or FinOps (assets:write / billing:read)',
    },
  },
  {
    id: 'domains',
    sectionId: 'cmdb',
    moduleId: 'domains',
    path: '/domains',
    label: 'Domains & SSL',
    code: 'cmdb_domain.list',
    icon: 'globe',
    access: {
      anyOfScopes: ['assets:read', 'iam:manage'],
      clearanceLabel: 'Asset or IAM Security visibility',
    },
  },

  // 4. Automation & Workflows (Dynamically hidden unless workflows:manage or Super Admin)
  {
    id: 'workflow_management',
    sectionId: 'automation',
    moduleId: 'workflow_management',
    path: '/workflows',
    label: 'Workflow Engine',
    code: 'wf_engine.do',
    icon: 'workflow',
    access: {
      requiredScope: 'workflows:manage',
      clearanceLabel: 'Workflow Architecture (workflows:manage)',
    },
  },
  {
    id: 'ticket_workflow',
    sectionId: 'automation',
    moduleId: 'ticket_workflow',
    path: '/ticket-workflows',
    label: 'Ticket Routing Rules',
    code: 'wf_ticket.do',
    icon: 'git_commit',
    access: {
      requiredScope: 'workflows:manage',
      clearanceLabel: 'Workflow Architecture (workflows:manage)',
    },
  },
  {
    id: 'process_mapper',
    sectionId: 'automation',
    moduleId: 'process_mapper',
    path: '/process-mapper',
    label: 'Process Mapper',
    code: 'wf_process.do',
    icon: 'network',
    access: {
      requiredScope: 'workflows:manage',
      clearanceLabel: 'Workflow Architecture (workflows:manage)',
    },
  },
  {
    id: 'custom_forms',
    sectionId: 'automation',
    moduleId: 'custom_forms',
    path: '/forms-builder',
    label: 'Custom Forms Builder',
    code: 'sc_form_builder.do',
    icon: 'form_input',
    access: {
      requiredScope: 'workflows:manage',
      clearanceLabel: 'Workflow Architecture (workflows:manage)',
    },
  },

  // 5. Finance
  {
    id: 'billing',
    sectionId: 'finance',
    moduleId: 'billing',
    path: '/billing',
    label: 'Invoices & Billing',
    code: 'fin_invoice.list',
    icon: 'dollar_sign',
    newPath: '/billing/new',
    newPathScope: 'billing:read',
    access: {
      requiredScope: 'billing:read',
      clearanceLabel: 'Financial Operations (billing:read)',
    },
  },

  // 6. Audit & Communications
  {
    id: 'reports',
    sectionId: 'audit_comms',
    moduleId: 'reports',
    path: '/reports',
    label: 'Reporting & Audit',
    code: 'sys_report.do',
    icon: 'bar_chart',
    access: {
      allowIamPortal: true,
      anyOfScopes: ['audit:read', 'iam:manage', 'billing:read', 'incidents:write'],
      clearanceLabel: 'Audit, IAM, FinOps, or Operations clearance',
    },
  },
  {
    id: 'telephony',
    sectionId: 'audit_comms',
    moduleId: 'telephony',
    path: '/telephony',
    label: 'Telephony Softphone',
    code: 'cti_console',
    icon: 'phone',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Service Desk Operations (incidents:write)',
    },
  },

  // 7. Knowledge & Learning
  {
    id: 'knowledge',
    sectionId: 'knowledge',
    moduleId: 'knowledge',
    path: '/knowledge',
    label: 'Knowledge Base',
    code: 'kb_knowledge.list',
    icon: 'book_open',
    access: {
      publicCorporate: true,
      clearanceLabel: 'Authenticated corporate access',
    },
  },
  {
    id: 'wiki',
    sectionId: 'knowledge',
    moduleId: 'wiki',
    path: '/wiki',
    label: 'System Wiki',
    code: 'sys_wiki.do',
    icon: 'library',
    access: {
      publicCorporate: true,
      clearanceLabel: 'Authenticated corporate access',
    },
  },
  {
    id: 'lms',
    sectionId: 'knowledge',
    moduleId: 'lms',
    path: '/lms',
    label: 'LMS Training',
    code: 'lms_course.list',
    icon: 'graduation_cap',
    access: {
      publicCorporate: true,
      clearanceLabel: 'Authenticated corporate access',
    },
  },

  // 8. Google Workspace
  {
    id: 'google_forms',
    sectionId: 'workspace',
    moduleId: 'google_workspace',
    path: '/workspace/forms',
    label: 'Google Forms',
    code: 'google_forms',
    icon: 'file_text',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Operations Workspace (incidents:write)',
    },
  },
  {
    id: 'google_chat',
    sectionId: 'workspace',
    moduleId: 'google_workspace',
    path: '/workspace/chat',
    label: 'Google Chat',
    code: 'google_chat',
    icon: 'message_square',
    access: {
      requiredScope: 'incidents:write',
      clearanceLabel: 'Operations Workspace (incidents:write)',
    },
  },
  {
    id: 'google_sheets',
    sectionId: 'workspace',
    moduleId: 'google_workspace',
    path: '/workspace/sheets',
    label: 'Google Sheets',
    code: 'google_sheets',
    icon: 'sheet',
    access: {
      anyOfScopes: ['incidents:write', 'billing:read'],
      clearanceLabel: 'Operations or FinOps Workspace',
    },
  },
  {
    id: 'google_drive',
    sectionId: 'workspace',
    moduleId: 'google_workspace',
    path: '/workspace/drive',
    label: 'Google Drive',
    code: 'google_drive',
    icon: 'hard_drive',
    access: {
      anyOfScopes: ['incidents:write', 'assets:write'],
      clearanceLabel: 'Operations or Asset Workspace',
    },
  },

  // 9. Governance & Platform
  {
    id: 'iam',
    sectionId: 'governance',
    moduleId: 'iam',
    path: '/iam',
    label: 'IAM & Device Trust',
    code: 'sys_iam.do',
    icon: 'shield',
    access: {
      allowIamPortal: true,
      anyOfScopes: ['iam:manage', 'devices:enroll_code'],
      clearanceLabel: 'IAM Portal Officer or iam:manage scope',
    },
  },
  {
    id: 'tenants',
    sectionId: 'governance',
    path: '/tenants',
    label: 'Tenant Directory',
    code: 'sys_tenant.list',
    icon: 'building',
    access: {
      superAdminOnly: true,
      clearanceLabel: 'Super Admin Portal exclusive',
    },
  },
  {
    id: 'module_controls',
    sectionId: 'governance',
    path: '/system/modules',
    label: 'Module Availability',
    code: 'sys_modules.do',
    icon: 'sliders',
    access: {
      superAdminOnly: true,
      clearanceLabel: 'Super Admin Portal exclusive',
    },
  },
  {
    id: 'database',
    sectionId: 'governance',
    moduleId: 'database',
    path: '/database',
    label: 'Database & Sync',
    code: 'sys_db_sync',
    icon: 'database',
    access: {
      superAdminOnly: true,
      clearanceLabel: 'Super Admin Portal exclusive',
    },
  },
];

export const NAV_MODULES_BY_ID: Record<string, NavModuleItem> = Object.fromEntries(
  NAV_MODULES.map(item => [item.id, item])
);

export const NAV_MODULES_BY_PATH: Record<string, NavModuleItem> = Object.fromEntries(
  NAV_MODULES.map(item => [item.path, item])
);

export const NAV_MODULES_BY_NEW_PATH: Record<string, NavModuleItem> = Object.fromEntries(
  NAV_MODULES.filter(item => Boolean(item.newPath)).map(item => [item.newPath as string, item])
);

export interface NavRbacContext {
  role: Role;
  portalType?: AuthPortalType;
  isSuperAdmin: boolean;
  isIamPortal: boolean;
  isModuleEnabled: (moduleId: FreeITSMModuleId) => boolean;
  hasPermission: (scope: IamPermissionScope) => boolean;
}

/**
 * Evaluates whether the currently authenticated user has permission to access
 * a module (both in sidebar navigation and at the route level).
 */
export function hasModuleRolePermission(
  item: NavModuleItem,
  ctx: Pick<NavRbacContext, 'role' | 'isSuperAdmin' | 'isIamPortal' | 'hasPermission'>
): boolean {
  if (ctx.role === 'customer') return false;

  const { access } = item;

  if (access.superAdminOnly) {
    return ctx.isSuperAdmin;
  }

  if (ctx.isSuperAdmin) {
    return true;
  }

  if (access.allowIamPortal && ctx.isIamPortal) {
    return true;
  }

  if (access.publicCorporate) {
    return true;
  }

  if (access.requiredScope) {
    return ctx.hasPermission(access.requiredScope);
  }

  if (access.anyOfScopes && access.anyOfScopes.length > 0) {
    return access.anyOfScopes.some(scope => ctx.hasPermission(scope));
  }

  return false;
}

/**
 * Full visibility check: module must be enabled for the active tenant AND
 * permitted for the active user's role / backend effective permissions.
 */
export function canAccessNavModule(item: NavModuleItem, ctx: NavRbacContext): boolean {
  if (item.moduleId && !ctx.isModuleEnabled(item.moduleId)) {
    return false;
  }
  return hasModuleRolePermission(item, ctx);
}

export function canAccessNavId(navId: string, ctx: NavRbacContext): boolean {
  const item = NAV_MODULES_BY_ID[navId];
  if (!item) return false;
  return canAccessNavModule(item, ctx);
}

export function canUseQuickCreate(
  item: NavModuleItem,
  ctx: Pick<NavRbacContext, 'isSuperAdmin' | 'hasPermission'> & Partial<Pick<NavRbacContext, 'isModuleEnabled'>>
): boolean {
  if (!item.newPath) return false;
  if (item.moduleId && ctx.isModuleEnabled && !ctx.isModuleEnabled(item.moduleId)) {
    return false;
  }
  if (!item.newPathScope) return true;
  return ctx.isSuperAdmin || ctx.hasPermission(item.newPathScope);
}

/**
 * Shared direct-route & quick-create authorization check consuming the same registry.
 */
export function canAccessRoutePath(pathname: string, ctx: NavRbacContext): boolean {
  const quickCreateOwner = NAV_MODULES_BY_NEW_PATH[pathname];
  if (quickCreateOwner) {
    return canAccessNavModule(quickCreateOwner, ctx) && canUseQuickCreate(quickCreateOwner, ctx);
  }
  const directModule = NAV_MODULES_BY_PATH[pathname];
  if (directModule) {
    return canAccessNavModule(directModule, ctx);
  }
  return false;
}

/**
 * Shared global search domain authorization rules aligned with backend /api/v1/search.
 */
export interface GlobalSearchPermissions {
  canSearchIncidents: boolean;
  canSearchRequests: boolean;
  canSearchAssets: boolean;
  canSearchProblems: boolean;
  canSearchChanges: boolean;
  ownRecordsOnly: boolean;
}

export function getGlobalSearchPermissions(ctx: NavRbacContext): GlobalSearchPermissions {
  const ownRecordsOnly = ctx.role === 'customer' || ctx.portalType === 'end_user';
  return {
    canSearchIncidents:
      ctx.isModuleEnabled('incidents') && (ctx.isSuperAdmin || ctx.hasPermission('incidents:read')),
    canSearchRequests: ownRecordsOnly
      ? true
      : ctx.isModuleEnabled('requests') &&
        (ctx.isSuperAdmin || ctx.hasPermission('incidents:read') || ctx.hasPermission('requests:approve')),
    canSearchAssets:
      ctx.isModuleEnabled('assets') && (ctx.isSuperAdmin || ctx.hasPermission('assets:read')),
    canSearchProblems:
      !ownRecordsOnly &&
      ctx.isModuleEnabled('problems') &&
      (ctx.isSuperAdmin || ctx.hasPermission('incidents:read')),
    canSearchChanges:
      !ownRecordsOnly &&
      ctx.isModuleEnabled('changes') &&
      (ctx.isSuperAdmin || ctx.hasPermission('incidents:read') || ctx.hasPermission('changes:cab_vote')),
    ownRecordsOnly,
  };
}

/**
 * Portal-aware section ordering across all 9 preserved enterprise groups.
 */
export function getOrderedSectionIds(portalType?: AuthPortalType): NavSectionId[] {
  if (portalType === 'iam') {
    return [
      'governance',
      'audit_comms',
      'command',
      'itsm',
      'cmdb',
      'finance',
      'knowledge',
      'automation',
      'workspace',
    ];
  }

  return [
    'command',
    'itsm',
    'cmdb',
    'automation',
    'finance',
    'audit_comms',
    'knowledge',
    'workspace',
    'governance',
  ];
}

export interface AccessibleNavSection {
  meta: NavSectionMeta;
  items: NavModuleItem[];
}

/**
 * Returns only sections that contain at least one enabled & permitted module.
 * Unauthorized modules and empty sections are completely hidden from the DOM.
 */
export function getAccessibleNavSections(ctx: NavRbacContext): AccessibleNavSection[] {
  const orderedIds = getOrderedSectionIds(ctx.portalType);
  const sections: AccessibleNavSection[] = [];

  for (const sectionId of orderedIds) {
    const items = NAV_MODULES.filter(
      item => item.sectionId === sectionId && canAccessNavModule(item, ctx)
    );
    if (items.length > 0) {
      sections.push({
        meta: NAV_SECTION_METADATA[sectionId],
        items,
      });
    }
  }

  return sections;
}
