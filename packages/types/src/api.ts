import type {
  Asset,
  AuthPortalType,
  ChangeRequest,
  ChangeStatus,
  CmdbRelation,
  IamPermissionScope,
  IncidentCategory,
  IncidentPriority,
  IncidentStatus,
  InventoryItem,
  Problem,
  ProblemStatus,
  RiskLevel,
  ServiceRequest,
  SoftwareLicense,
  WorkflowDefinition,
} from './itsm';

// ---------------------------------------------------------------------------
// Envelope, Pagination & Error DTOs
// ---------------------------------------------------------------------------

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  detail?: string;
}

export interface PageMetaDto {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedDto<T> {
  items: T[];
  meta: PageMetaDto;
}

// ---------------------------------------------------------------------------
// Auth & Organization Governance DTOs (/api/v1/auth/*, /api/v1/organizations/*)
// ---------------------------------------------------------------------------

export type ClientType = 'web' | 'desktop' | 'mobile';
export type ClientPlatform = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

export interface ClientMetadataDto {
  client_type: ClientType;
  client_platform?: ClientPlatform;
  app_version?: string;
  app_id?: string;
  device_name?: string;
  os_version?: string;
  device_model?: string;
}

export interface ClientConfigDto {
  service: string;
  instance_name: string;
  deployment_mode: 'cloud' | 'self_hosted' | string;
  public_api_url: string | null;
  api_version: string;
  api_prefix: string;
  supported_client_types: string[];
  supported_client_platforms: string[];
  minimum_client_versions: {
    desktop: string;
    mobile: string;
    [key: string]: string;
  };
  allowed_native_app_ids: string[];
  auth: {
    access_token_ttl_minutes: number;
    refresh_token_ttl_days: number;
    refresh_token_rotation: boolean;
    mfa_totp_supported: boolean;
    device_sso_supported: boolean;
  };
  features: {
    push_notifications_enabled: boolean;
    fcm_configured: boolean;
    apns_configured: boolean;
    device_trust_enabled: boolean;
    ai_enabled: boolean;
  };
}

export interface BackendMeResponse {
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  organization_slug: string;
  organization_name?: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  is_super_admin: boolean;
  is_iam_portal: boolean;
  permissions: IamPermissionScope[];
  roles: string[];
  session_id: string;
  device_managed?: boolean;
  device_id?: string | null;
}

export interface BackendLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  organization_slug: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  permissions: IamPermissionScope[];
  session_id: string;
  client_type?: ClientType;
  client_platform?: ClientPlatform;
  is_platform_super_admin?: boolean;
  mfa_required?: boolean;
  mfa_enrolled?: boolean;
  device_managed?: boolean;
  email_verified?: boolean;
}

export interface BackendOrganizationDto {
  id: string;
  name: string;
  slug: string;
  company_code: string;
  domain: string;
  plan: string;
  region: string;
  timezone: string;
  currency: string;
  primary_contact_email: string;
  status: 'active' | 'suspended';
  sla_targets: { P1: number; P2: number; P3: number; P4: number };
  enabled_modules: Record<string, boolean>;
  portal_branding: Record<string, unknown>;
  preference_template: Record<string, unknown>;
  company_logo_storage_key?: string | null;
  created_at: string;
}

export interface OrganizationSwitchResponseDto {
  access_token: string;
  expires_in: number;
  organization_id: string;
  organization_slug: string;
  portal_type: AuthPortalType;
  clearance_tier: string;
  permissions: IamPermissionScope[];
}

export interface DeviceEnrollResponseDto {
  device_id: string;
  hostname: string;
  os_platform?: string;
  client_type?: string;
  device_platform?: string;
  app_version?: string | null;
  os_version?: string | null;
  device_model?: string | null;
  mdm_provider?: string;
  trust_level: string;
  mdm_verified: boolean;
  certificate_thumbprint: string;
  status?: string;
}

export interface UserSessionDto {
  id: string;
  organization_id: string;
  portal_type: string;
  auth_method: string;
  client_type: string;
  client_platform: string;
  app_version: string | null;
  app_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  is_current: boolean;
}

export interface SessionListResponseDto {
  items: UserSessionDto[];
  total: number;
}

export interface ManagedDeviceDto {
  id: string;
  organization_id: string;
  hostname: string;
  os_platform: string;
  client_type: string;
  device_platform: string;
  app_version: string | null;
  os_version: string | null;
  device_model: string | null;
  mdm_provider: string;
  certificate_thumbprint: string;
  enrolled_by_email: string;
  trust_level: string;
  verified_by_iam: boolean;
  mdm_verified: boolean;
  mdm_verified_at: string | null;
  mdm_authority_ref: string | null;
  status: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface DeviceListResponseDto {
  items: ManagedDeviceDto[];
  total: number;
}

export interface IncidentAttachmentCreateDto {
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256?: string;
}

export interface IncidentAttachmentDto {
  id: string;
  incident_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256: string | null;
  uploaded_by_email: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Core ITSM DTOs (/api/v1/incidents, /requests, /problems, /changes, /search)
// ---------------------------------------------------------------------------

export interface IncidentActivityDto {
  id: string;
  incident_id: string;
  author_name: string;
  activity_type: 'work_note' | 'comment' | 'field_change' | 'system_alert' | 'audit';
  action: string;
  note: string;
  field_changes: { field: string; from: string; to: string }[];
  created_at: string;
}

export interface IncidentDto {
  id: string;
  organization_id: string;
  number: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  urgency: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  category: IncidentCategory;
  requester_name: string;
  requester_email: string;
  assignee_name: string;
  assignment_group: string | null;
  affected_ci_label: string | null;
  sla_deadline: string;
  sla_breached: boolean;
  time_logged_mins: number;
  csat_score: number | null;
  source_channel: 'portal' | 'email' | 'phone' | 'monitor';
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  activities: IncidentActivityDto[];
  attachments?: IncidentAttachmentDto[];
}

export interface ApprovalItemDto {
  id: string;
  subject_ref: string;
  title: string;
  stage_order: number;
  assigned_approver_user_id: string;
  assigned_approver_email: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at?: string | null;
  decision_note?: string | null;
}

export interface ServiceRequestDto {
  id: string;
  organization_id: string;
  number: string;
  catalog_item_id: string | null;
  catalog_item_name: string;
  description: string;
  requester_name: string;
  requester_email: string;
  department: string;
  cost: string | number;
  status: ServiceRequest['status'];
  current_stage: number;
  delivery_estimate_days: number;
  delivery_date: string | null;
  custom_form_values: Record<string, string>;
  created_at: string;
  approvals: ApprovalItemDto[];
}

export interface ProblemDto {
  id: string;
  organization_id: string;
  number: string;
  title: string;
  description: string;
  status: ProblemStatus;
  severity: Problem['severity'];
  root_cause_analysis: string;
  workaround: string;
  permanent_solution: string;
  owner_name: string;
  is_known_error: boolean;
  linked_change_id: string | null;
  linked_incident_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CabSeatDto {
  id: string;
  seat_name: string;
  assigned_member_email: string;
  vote: 'pending' | 'approve' | 'reject' | 'abstain';
  vote_comment?: string | null;
}

export interface ChangeRequestDto {
  id: string;
  organization_id: string;
  number: string;
  title: string;
  change_type: ChangeRequest['type'];
  status: ChangeStatus;
  risk_score: ChangeRequest['riskScore'];
  reason: string;
  implementation_plan: string;
  rollback_plan: string;
  test_plan: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  requester_name: string;
  assigned_engineer_name: string;
  created_at: string;
  updated_at: string;
  cab_seats: CabSeatDto[];
}

export interface GlobalSearchHitDto {
  id: string;
  ref: string;
  group:
    | 'Incidents'
    | 'Tickets & Requests'
    | 'Assets (CMDB)'
    | 'Problems & Changes'
    | 'Knowledge Base';
  title: string;
  subtitle: string;
  status: string;
  path: string;
}

export interface GlobalSearchResponseDto {
  query: string;
  organization_id: string;
  total: number;
  hits: GlobalSearchHitDto[];
}

// ---------------------------------------------------------------------------
// CMDB, Inventory & Software License DTOs
// ---------------------------------------------------------------------------

export interface AssetDto {
  id: string;
  organization_id: string;
  asset_tag: string;
  name: string;
  asset_type: Asset['type'];
  serial_number: string;
  mac_address: string | null;
  ip_address: string | null;
  sync_source: 'manual' | 'vcenter' | 'intune';
  model: string;
  manufacturer: string;
  status: Asset['status'];
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  department: string | null;
  location: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  purchase_cost: string | number;
  current_book_value: string | number;
  qr_code_data: string;
}

export interface CmdbRelationDto {
  id: string;
  organization_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relation_type: CmdbRelation['relationType'];
  criticality: CmdbRelation['criticality'];
}

export interface InventoryItemDto {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  category: InventoryItem['category'];
  quantity: number;
  min_threshold: number;
  unit_cost: string | number;
  location: string;
  last_restocked_at: string | null;
}

export interface SoftwareLicenseDto {
  id: string;
  organization_id: string;
  name: string;
  vendor: string;
  version: string;
  license_type: SoftwareLicense['licenseType'];
  total_seats: number;
  used_seats: number;
  annual_cost: string | number;
  renewal_date: string | null;
  source: SoftwareLicense['source'];
  compliance_status: SoftwareLicense['complianceStatus'];
}

// ---------------------------------------------------------------------------
// Knowledge, Workflows, Audit, Reports & Notifications DTOs
// ---------------------------------------------------------------------------

export interface KnowledgeArticleDto {
  id: string;
  organization_id: string;
  title: string;
  category: string;
  visibility: 'public' | 'internal';
  author_name: string;
  views: number;
  helpful_votes: number;
  tags: string[];
  content: string;
  updated_at: string;
}

export interface WorkflowDto {
  id: string;
  organization_id: string;
  name: string;
  target_module_id: string;
  trigger: WorkflowDefinition['trigger'];
  description: string;
  status: WorkflowDefinition['status'];
  stages: WorkflowDefinition['stages'];
  execution_count: number;
  last_executed_at: string | null;
  updated_at: string;
}

export interface AuditLogDto {
  id: string;
  organization_id: string | null;
  created_at: string;
  actor_email: string;
  module: string;
  action: string;
  target_id: string | null;
  detail: string;
}

export interface OperationsReportSummaryDto {
  organization_id: string;
  generated_at: string;
  incidents_total: number;
  incidents_open: number;
  incidents_breached_sla: number;
  incidents_by_priority: Record<string, number>;
  requests_total: number;
  requests_pending_approval: number;
  problems_total: number;
  known_errors_total: number;
  changes_total: number;
  changes_in_cab_review: number;
  assets_total: number;
  assets_in_use: number;
  inventory_low_stock: number;
  software_over_allocated: number;
  audit_events_count: number;
}

export interface NotificationDto {
  id: string;
  category: string;
  title: string;
  message: string;
  record_type: string | null;
  record_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Integrations, Webhooks, Telephony, Jobs & AI Advisory DTOs
// ---------------------------------------------------------------------------

export interface IntegrationConnectionDto {
  id: string;
  organization_id: string;
  provider: string;
  display_name: string;
  status: 'active' | 'disabled' | 'error';
  config_json: Record<string, unknown>;
  has_credentials: boolean;
  has_oauth_token: boolean;
  oauth_token_expires_at: string | null;
  oauth_scopes: string[];
  allowed_roles: string[];
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpointDto {
  id: string;
  organization_id: string;
  name: string;
  target_url: string;
  subscribed_events: string[];
  is_active: boolean;
  max_retries: number;
  last_delivery_status: number | null;
  last_delivered_at: string | null;
  created_at: string;
}

export interface TelephonyCallDto {
  id: string;
  organization_id: string;
  provider: string;
  provider_call_sid: string | null;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string;
  to_number: string;
  caller_name: string | null;
  linked_incident_id: string | null;
  duration_seconds: number;
  notes: string;
  created_at: string;
}

export interface BackgroundJobDto {
  id: string;
  organization_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'retrying' | 'succeeded' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AiUsageSummaryDto {
  organization_id: string;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  rate_limit_per_minute: number;
  model: string;
  recent_logs: Array<{
    id: string;
    actor_email: string;
    action_type: string;
    model_name: string;
    target_entity_type: string | null;
    target_entity_id: string | null;
    prompt_chars: number;
    response_chars: number;
    latency_ms: number;
    status: string;
    requires_human_approval: boolean;
    advisory_summary: string;
    created_at: string;
  }>;
}

export interface IncidentTriageResponse {
  recommendedPriority: IncidentPriority;
  recommendedCategory: IncidentCategory;
  suggestedQueue: string;
  rootCauseHypothesis: string;
  diagnosticSteps: string[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface ChangeAssessResponse {
  assessedRisk: RiskLevel;
  readinessScore: number;
  riskFindings: string[];
  missingControls: string[];
  recommendedCabGuidance: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface DraftKbResponse {
  title: string;
  category: string;
  tags: string[];
  content: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface WikiAssistResponse {
  summary: string;
  sources: Array<{ title: string; uri: string }>;
  searchQueries: string[];
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface CopilotTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CopilotResponse {
  reply: string;
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface MatchedKbSuggestion {
  kbId: string;
  title: string;
  relevanceReason: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export interface SuggestedNewKbTopic {
  title: string;
  category: string;
  summary: string;
  draftBody: string;
}

export interface TriageAssistantResponse {
  realTimeSummary: string;
  urgencySignal: 'critical' | 'elevated' | 'normal';
  slaAssessment: string;
  recommendedPriority: IncidentPriority;
  recommendedCategory: IncidentCategory;
  suggestedQueue: string;
  rootCauseHypothesis: string;
  nextSteps: string[];
  matchedKbArticles: MatchedKbSuggestion[];
  suggestedNewKbTopics: SuggestedNewKbTopic[];
  draftResolutionNote: string;
  draftCustomerReply: string;
  model: string;
  generatedAt: string;
  requiresHumanApproval?: boolean;
}

export interface TriageAssistantKbPayload {
  id: string;
  title: string;
  category: string;
  tags: string[];
  excerpt: string;
}
