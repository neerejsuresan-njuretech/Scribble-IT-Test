import { FreeITSMModuleId, WorkflowStage } from '../types/itsm';
import { ALL_FREEITSM_MODULES } from './freeitsmSeedData';

export interface WorkflowActionField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'select' | 'number' | 'textarea';
  options?: string[];
  defaultValue?: string;
}

export interface WorkflowActionDef {
  key: string;
  label: string;
  stepType: WorkflowStage['stepType'];
  description: string;
  defaultRole: string;
  fields: WorkflowActionField[];
}

export interface WorkflowTriggerDef {
  key: string;
  label: string;
  description: string;
  suggestedFields: string[];
}

export interface WorkflowModuleOption {
  id: FreeITSMModuleId | 'all';
  label: string;
  group: string;
}

export const ALL_WORKFLOW_MODULES: WorkflowModuleOption[] = [
  { id: 'all', label: 'Platform Control (Manual / Schedule / Logic)', group: 'Built-in Controls' },
  ...ALL_FREEITSM_MODULES.map(m => ({
    id: m.id,
    label: m.label,
    group: m.group
  }))
];

const MODULE_SPECIFIC_TRIGGERS: Partial<Record<FreeITSMModuleId | 'all', WorkflowTriggerDef[]>> = {
  all: [
    { key: 'manual_trigger', label: 'Manually trigger a flow', description: 'Run on demand from Workflow Management or record menu', suggestedFields: ['actor', 'tenantId'] },
    { key: 'recurrence_schedule', label: 'Recurrence schedule (Cron / Daily)', description: 'Runs on a recurring time interval', suggestedFields: ['scheduleInterval', 'timezone'] },
    { key: 'http_webhook_received', label: 'When an HTTP webhook request is received', description: 'Triggered by external SIEM, MDM, or CI/CD payload', suggestedFields: ['sourceIp', 'eventType'] }
  ],
  incidents: [
    { key: 'incident_created', label: 'When an incident is created', description: 'Fires immediately when a ticket enters the tenant queue', suggestedFields: ['priority', 'category', 'sourceChannel'] },
    { key: 'incident_priority_escalated', label: 'When incident priority escalates (P1/P2)', description: 'Fires when severity is raised to Critical or High', suggestedFields: ['priority', 'affectedCI'] },
    { key: 'incident_sla_breached', label: 'When incident SLA approaches or breaches', description: 'Fires when SLA countdown hits threshold', suggestedFields: ['slaBreached', 'assignee'] },
    { key: 'incident_resolved', label: 'When an incident is resolved', description: 'Fires on resolution for CSAT or PIR follow-up', suggestedFields: ['resolutionNotes', 'category'] }
  ],
  requests: [
    { key: 'request_submitted', label: 'When a service request is submitted', description: 'Fires for catalog items and "I Need Something Else" requests', suggestedFields: ['catalogItemName', 'cost', 'department'] },
    { key: 'request_approved', label: 'When request reaches final approval', description: 'Fires after manager/security sign-off completes', suggestedFields: ['department', 'catalogItemId'] }
  ],
  changes: [
    { key: 'change_submitted', label: 'When a Change (CAB) request is submitted', description: 'Fires when a new normal or emergency change opens', suggestedFields: ['type', 'riskScore'] },
    { key: 'change_cab_approved', label: 'When CAB quorum approves a change', description: 'Fires when all CAB votes pass', suggestedFields: ['type', 'assignedEngineer'] }
  ],
  problems: [
    { key: 'problem_created', label: 'When a problem record is opened', description: 'Fires on RCA investigation creation', suggestedFields: ['severity', 'owner'] },
    { key: 'known_error_published', label: 'When a Known Error (KEDB) is published', description: 'Fires when workaround is flagged as known error', suggestedFields: ['isKnownError', 'owner'] }
  ],
  assets: [
    { key: 'asset_registered', label: 'When a new asset is registered', description: 'Fires when CI enters CMDB asset register', suggestedFields: ['type', 'status', 'location'] },
    { key: 'asset_status_changed', label: 'When asset status changes (e.g. Maintenance)', description: 'Fires on lifecycle transition', suggestedFields: ['status', 'assignedTo'] },
    { key: 'asset_warranty_expiring', label: 'When asset warranty is expiring (<30d)', description: 'Fires during asset warranty sweep', suggestedFields: ['warrantyExpiry', 'manufacturer'] }
  ],
  inventory: [
    { key: 'inventory_low_stock', label: 'When stock drops below minimum threshold', description: 'Fires when quantity <= minThreshold', suggestedFields: ['category', 'quantity', 'location'] },
    { key: 'inventory_restocked', label: 'When inventory stock is replenished', description: 'Fires on positive stock delta', suggestedFields: ['sku', 'quantity'] }
  ],
  software: [
    { key: 'software_over_allocated', label: 'When license seats are over-allocated', description: 'Fires when usedSeats > totalSeats', suggestedFields: ['vendor', 'complianceStatus'] },
    { key: 'software_renewal_due', label: 'When software renewal date approaches', description: 'Fires ahead of renewal cutoff', suggestedFields: ['vendor', 'annualCost'] }
  ],
  contracts: [
    { key: 'contract_expiring', label: 'When vendor contract enters notice window', description: 'Fires before contract noticeDays cutoff', suggestedFields: ['vendor', 'annualValue'] },
    { key: 'contract_rfp_opened', label: 'When contract moves to RFP Open', description: 'Fires when procurement RFP opens', suggestedFields: ['type', 'vendor'] }
  ],
  domains: [
    { key: 'ssl_expiring_soon', label: 'When SSL certificate expires within 14 days', description: 'Fires during domain & SSL audit', suggestedFields: ['domain', 'sslExpiry'] },
    { key: 'domain_lookalike_alert', label: 'When lookalike domain threat detected', description: 'Fires when lookalikeAlerts > 0', suggestedFields: ['domain', 'securityGrade'] }
  ],
  iam: [
    { key: 'iam_identity_created', label: 'When a new IAM identity is provisioned', description: 'Fires when a user ID & Company ID are created', suggestedFields: ['companyId', 'role', 'portalType'] },
    { key: 'iam_identity_suspended', label: 'When an IAM identity is suspended', description: 'Fires when account access is revoked', suggestedFields: ['companyId', 'email'] },
    { key: 'iam_policy_created', label: 'When an IAM access policy is modified', description: 'Fires on policy scope updates', suggestedFields: ['mfaRequired', 'ssoOnly'] }
  ],
  tasks: [
    { key: 'task_created', label: 'When a Kanban task is created', description: 'Fires when a task enters backlog/todo', suggestedFields: ['priority', 'assignee'] },
    { key: 'task_moved_done', label: 'When a Kanban task moves to Done', description: 'Fires on task completion', suggestedFields: ['projectId', 'linkedRecordId'] }
  ],
  projects: [
    { key: 'project_stage_changed', label: 'When project stage advances', description: 'Fires on Initiation/Planning/Execution/UAT transition', suggestedFields: ['stage', 'health'] }
  ],
  war_room: [
    { key: 'war_room_opened', label: 'When a P1/P2 War Room bridge is opened', description: 'Fires when major incident bridge starts', suggestedFields: ['severity', 'commander'] }
  ],
  morning_checks: [
    { key: 'morning_check_failed', label: 'When a Morning Check item fails', description: 'Fires when any daily check is marked FAIL', suggestedFields: ['category', 'engineer'] }
  ],
  status_page: [
    { key: 'component_degraded', label: 'When a service component degrades or outages', description: 'Fires when health drops from operational', suggestedFields: ['group', 'status'] }
  ],
  billing: [
    { key: 'invoice_overdue', label: 'When an invoice becomes overdue', description: 'Fires when payment due date passes', suggestedFields: ['organization', 'amount'] },
    { key: 'invoice_paid', label: 'When an invoice is marked paid', description: 'Fires upon settlement', suggestedFields: ['paymentMethod', 'amount'] }
  ],
  telephony: [
    { key: 'inbound_call_received', label: 'When an inbound SIP call is answered', description: 'Fires during CTI call intake', suggestedFields: ['callerCompany', 'direction'] }
  ],
  custom_forms: [
    { key: 'custom_form_submitted', label: 'When a Custom Portal Form is submitted', description: 'Fires when end-user submits a custom intake form', suggestedFields: ['category', 'title'] }
  ],
  google_workspace: [
    { key: 'gws_form_synced', label: 'When Google Form responses sync into ITSM', description: 'Fires on new Google Workspace intake row', suggestedFields: ['sourceSheet', 'requesterEmail'] }
  ]
};

const MODULE_SPECIFIC_ACTIONS: Partial<Record<FreeITSMModuleId | 'all', WorkflowActionDef[]>> = {
  all: [
    {
      key: 'condition_branch',
      label: 'Condition (If / Else Branch)',
      stepType: 'condition',
      description: 'Evaluate a field condition and branch into Yes / No steps',
      defaultRole: 'Workflow Engine',
      fields: [
        { key: 'conditionField', label: 'Field / Expression', placeholder: 'e.g. priority, cost, department', defaultValue: 'priority' },
        { key: 'conditionOperator', label: 'Operator', placeholder: 'equals', type: 'select', options: ['equals', 'not_equals', 'contains', 'greater_than'], defaultValue: 'equals' },
        { key: 'conditionValue', label: 'Expected Value', placeholder: 'e.g. P1, 500, Security', defaultValue: 'P1' }
      ]
    },
    {
      key: 'approval_gate',
      label: 'Start and Wait for Approval',
      stepType: 'approval',
      description: 'Pause workflow until designated approver signs off',
      defaultRole: 'Department Lead',
      fields: [
        { key: 'approverGroup', label: 'Approver Role / Email', placeholder: 'e.g. IT Manager or CAB Board', defaultValue: 'IT Manager' },
        { key: 'approvalMode', label: 'Approval Mode', placeholder: 'First to respond', type: 'select', options: ['First to respond', 'Everyone must approve'], defaultValue: 'First to respond' }
      ]
    },
    {
      key: 'send_notification',
      label: 'Send Email / Portal Alert',
      stepType: 'notification',
      description: 'Send automated notification to requester, assignee, or Slack/Email',
      defaultRole: 'Notification Engine',
      fields: [
        { key: 'recipients', label: 'Recipients / Role', placeholder: 'e.g. requester, secops@njure.tech', defaultValue: 'Requester & Service Desk' },
        { key: 'messageTemplate', label: 'Message Template', placeholder: 'Ticket {{id}} has progressed to stage...', type: 'textarea' }
      ]
    },
    {
      key: 'wait_delay',
      label: 'Delay / Wait Timer',
      stepType: 'delay',
      description: 'Wait for a configured interval before running the next action',
      defaultRole: 'Scheduler',
      fields: [
        { key: 'durationValue', label: 'Duration', placeholder: '30', type: 'number', defaultValue: '30' },
        { key: 'durationUnit', label: 'Time Unit', placeholder: 'Minutes', type: 'select', options: ['Minutes', 'Hours', 'Days'], defaultValue: 'Minutes' }
      ]
    },
    {
      key: 'http_webhook',
      label: 'HTTP Request / Webhook',
      stepType: 'automation',
      description: 'Invoke an external REST API endpoint or automation script',
      defaultRole: 'Automation Runner',
      fields: [
        { key: 'httpMethod', label: 'HTTP Method', placeholder: 'POST', type: 'select', options: ['POST', 'PUT', 'GET', 'PATCH'], defaultValue: 'POST' },
        { key: 'endpointUrl', label: 'Endpoint URL', placeholder: 'https://api.njuretech.io/hooks/workflow' }
      ]
    }
  ],
  incidents: [
    {
      key: 'create_incident',
      label: 'Create Incident Ticket',
      stepType: 'module_action',
      description: 'Open a new incident in the tenant queue',
      defaultRole: 'Service Desk',
      fields: [
        { key: 'titleTemplate', label: 'Incident Title', placeholder: 'e.g. Automated Escalation: {{trigger.title}}' },
        { key: 'priority', label: 'Priority', placeholder: 'P2', type: 'select', options: ['P1', 'P2', 'P3', 'P4'], defaultValue: 'P2' },
        { key: 'targetQueue', label: 'Assign Queue', placeholder: 'Service Desk L2', defaultValue: 'Service Desk' }
      ]
    },
    {
      key: 'assign_incident_queue',
      label: 'Route / Assign Incident',
      stepType: 'task',
      description: 'Assign ticket to a specialist team or engineer',
      defaultRole: 'Triage Lead',
      fields: [
        { key: 'targetQueue', label: 'Target Queue / Assignee', placeholder: 'SecOps SOC Tier 2' },
        { key: 'workNote', label: 'Auto Work Note', placeholder: 'Routed automatically via workflow' }
      ]
    }
  ],
  requests: [
    {
      key: 'advance_request_stage',
      label: 'Advance Service Request Stage',
      stepType: 'module_action',
      description: 'Move catalog request to fulfillment or completion',
      defaultRole: 'Fulfillment Team',
      fields: [
        { key: 'targetStage', label: 'Target Stage', placeholder: 'fulfillment', type: 'select', options: ['manager_approved', 'security_review', 'fulfillment', 'completed'], defaultValue: 'fulfillment' }
      ]
    }
  ],
  changes: [
    {
      key: 'create_cab_change',
      label: 'Create Change (CAB) Record',
      stepType: 'module_action',
      description: 'Schedule a change request and queue CAB votes',
      defaultRole: 'Change Manager',
      fields: [
        { key: 'changeType', label: 'Change Type', placeholder: 'normal', type: 'select', options: ['standard', 'normal', 'emergency'], defaultValue: 'normal' },
        { key: 'riskScore', label: 'Risk Level', placeholder: 'medium', type: 'select', options: ['low', 'medium', 'high', 'critical'], defaultValue: 'medium' }
      ]
    }
  ],
  tasks: [
    {
      key: 'create_kanban_task',
      label: 'Create Kanban Task',
      stepType: 'task',
      description: 'Add an actionable fulfillment task on the Kanban board',
      defaultRole: 'Fulfillment Engineer',
      fields: [
        { key: 'taskTitle', label: 'Task Title', placeholder: 'e.g. Provision Workstation & FIDO2 Key' },
        { key: 'column', label: 'Target Column', placeholder: 'todo', type: 'select', options: ['backlog', 'todo', 'in_progress'], defaultValue: 'todo' },
        { key: 'assignee', label: 'Assignee', placeholder: 'IT Operations' }
      ]
    }
  ],
  assets: [
    {
      key: 'assign_asset_user',
      label: 'Allocate / Update Asset Status',
      stepType: 'module_action',
      description: 'Update CMDB asset allocation or maintenance state',
      defaultRole: 'Asset Manager',
      fields: [
        { key: 'assetStatus', label: 'New Asset Status', placeholder: 'in_use', type: 'select', options: ['in_use', 'in_stock', 'maintenance', 'retired'], defaultValue: 'in_use' },
        { key: 'notes', label: 'Allocation Note', placeholder: 'Assigned during automated workflow' }
      ]
    }
  ],
  iam: [
    {
      key: 'provision_iam_policy',
      label: 'Assign IAM Role & Policy',
      stepType: 'module_action',
      description: 'Bind company ID, portal role, or access policy to identity',
      defaultRole: 'IAM Administrator',
      fields: [
        { key: 'policyId', label: 'Policy ID / Scope', placeholder: 'e.g. POL-EMPLOYEE-OPS', defaultValue: 'POL-EMPLOYEE-OPS' },
        { key: 'targetPortal', label: 'Target Portal', placeholder: 'employee', type: 'select', options: ['employee', 'end_user', 'iam', 'super_admin'], defaultValue: 'employee' }
      ]
    },
    {
      key: 'suspend_iam_identity',
      label: 'Suspend IAM Identity',
      stepType: 'automation',
      description: 'Disable portal login access for offboarding or security alert',
      defaultRole: 'IAM Security',
      fields: [
        { key: 'reason', label: 'Suspension Reason', placeholder: 'Offboarding / Security Policy Trigger' }
      ]
    }
  ],
  war_room: [
    {
      key: 'open_war_room_bridge',
      label: 'Open P1/P2 War Room Bridge',
      stepType: 'module_action',
      description: 'Spin up an active major incident war room session',
      defaultRole: 'Incident Commander',
      fields: [
        { key: 'severity', label: 'Bridge Severity', placeholder: 'P1', type: 'select', options: ['P1', 'P2'], defaultValue: 'P1' },
        { key: 'commander', label: 'Commander Role', placeholder: 'On-Call SRE Lead', defaultValue: 'On-Call SRE Lead' }
      ]
    }
  ],
  status_page: [
    {
      key: 'update_status_component',
      label: 'Update Service Status Component',
      stepType: 'module_action',
      description: 'Publish operational/degraded state to public status page',
      defaultRole: 'NOC Operator',
      fields: [
        { key: 'healthState', label: 'Component State', placeholder: 'degraded', type: 'select', options: ['operational', 'degraded', 'partial_outage', 'major_outage'], defaultValue: 'degraded' }
      ]
    }
  ],
  billing: [
    {
      key: 'generate_invoice',
      label: 'Generate Tenant Invoice',
      stepType: 'module_action',
      description: 'Create pending billing line item for fulfillment cost',
      defaultRole: 'FinOps',
      fields: [
        { key: 'amount', label: 'Default Amount', placeholder: '250', type: 'number', defaultValue: '250' },
        { key: 'notes', label: 'Invoice Memo', placeholder: 'Automated fulfillment charge' }
      ]
    }
  ],
  google_workspace: [
    {
      key: 'post_google_chat',
      label: 'Post Message to Google Chat Space',
      stepType: 'notification',
      description: 'Send structured card alert to Google Chat channel',
      defaultRole: 'Workspace Bot',
      fields: [
        { key: 'chatSpace', label: 'Google Chat Space', placeholder: 'IT Ops Alerts' },
        { key: 'message', label: 'Card Message', placeholder: 'Automated alert from Scribble IT Workflow' }
      ]
    },
    {
      key: 'append_google_sheet',
      label: 'Append Row to Google Sheet',
      stepType: 'automation',
      description: 'Log execution record into connected Google Spreadsheet',
      defaultRole: 'Workspace Sync',
      fields: [
        { key: 'spreadsheetName', label: 'Target Sheet Name', placeholder: 'ITSM_Automation_Audit_Log' }
      ]
    }
  ]
};

export function getTriggersForModule(moduleId: FreeITSMModuleId | 'all'): WorkflowTriggerDef[] {
  const explicit = MODULE_SPECIFIC_TRIGGERS[moduleId];
  if (explicit && explicit.length > 0) return explicit;
  const mod = ALL_FREEITSM_MODULES.find(m => m.id === moduleId);
  const label = mod?.label || moduleId;
  return [
    {
      key: `${moduleId}_record_created`,
      label: `When a ${label} record is created`,
      description: `Fires whenever a new entry is added in ${label}`,
      suggestedFields: ['id', 'status', 'owner']
    },
    {
      key: `${moduleId}_record_updated`,
      label: `When a ${label} record is modified`,
      description: `Fires on field or state change in ${label}`,
      suggestedFields: ['status', 'updatedAt']
    },
    {
      key: `${moduleId}_scheduled_audit`,
      label: `On scheduled ${label} check`,
      description: `Runs periodic workflow checks against ${label}`,
      suggestedFields: ['tenantId']
    }
  ];
}

export function getActionsForModule(moduleId: FreeITSMModuleId | 'all'): WorkflowActionDef[] {
  const explicit = MODULE_SPECIFIC_ACTIONS[moduleId];
  if (explicit && explicit.length > 0) return explicit;
  const mod = ALL_FREEITSM_MODULES.find(m => m.id === moduleId);
  const label = mod?.label || moduleId;
  return [
    {
      key: `${moduleId}_create_record`,
      label: `Create / Log Entry in ${label}`,
      stepType: 'module_action',
      description: `Create a new record or execution entry inside ${label}`,
      defaultRole: 'Module Operator',
      fields: [
        { key: 'recordTitle', label: 'Entry Title / Summary', placeholder: `Automated ${label} entry` },
        { key: 'targetOwner', label: 'Assigned Owner / Queue', placeholder: 'Service Desk' }
      ]
    },
    {
      key: `${moduleId}_update_record`,
      label: `Update ${label} Status / Field`,
      stepType: 'module_action',
      description: `Modify state or metadata on the linked ${label} record`,
      defaultRole: 'Module Operator',
      fields: [
        { key: 'targetStatus', label: 'Target Status / Value', placeholder: 'active / completed' },
        { key: 'notes', label: 'Audit Note', placeholder: 'Updated automatically by workflow' }
      ]
    },
    {
      key: `${moduleId}_notify_owner`,
      label: `Notify ${label} Stakeholders`,
      stepType: 'notification',
      description: `Send alert to ${label} module owners`,
      defaultRole: 'Notification Engine',
      fields: [
        { key: 'recipients', label: 'Recipients', placeholder: `${label} Owners` },
        { key: 'messageTemplate', label: 'Message', placeholder: 'Action required in module' }
      ]
    }
  ];
}

export function getModuleLabel(moduleId?: FreeITSMModuleId | 'all'): string {
  if (!moduleId || moduleId === 'all') return 'Platform Control';
  return ALL_FREEITSM_MODULES.find(m => m.id === moduleId)?.label || moduleId;
}
