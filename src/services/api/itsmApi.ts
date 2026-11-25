import {
  ChangeRequest,
  ChangeStatus,
  Incident,
  IncidentCategory,
  IncidentPriority,
  IncidentStatus,
  Problem,
  ProblemStatus,
  ServiceRequest,
} from '../../types/itsm';
import { apiRequest, PaginatedDto } from './httpClient';

// --- Backend DTOs ---
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
  group: 'Incidents' | 'Tickets & Requests' | 'Assets (CMDB)' | 'Problems & Changes' | 'Knowledge Base';
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

// --- Mappers from Backend DTOs to Preserved UI Domain Models ---
export function mapIncidentDto(dto: IncidentDto): Incident {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    title: dto.title,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
    urgency: dto.urgency,
    impact: dto.impact,
    category: dto.category,
    requesterName: dto.requester_name,
    requesterEmail: dto.requester_email,
    assignee: dto.assignee_name,
    assignmentGroup: dto.assignment_group || undefined,
    affectedCI: dto.affected_ci_label || undefined,
    slaDeadline: dto.sla_deadline,
    slaBreached: dto.sla_breached,
    timeLoggedMins: dto.time_logged_mins,
    csatScore: dto.csat_score ?? undefined,
    sourceChannel: dto.source_channel,
    resolutionNotes: dto.resolution_notes ?? undefined,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    activityLog: (dto.activities || []).map(a => ({
      id: a.id,
      timestamp: a.created_at,
      author: a.author_name,
      type: a.activity_type,
      action: a.action,
      note: a.note,
      fieldChanges: a.field_changes,
    })),
  };
}

export function mapServiceRequestDto(dto: ServiceRequestDto): ServiceRequest {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    catalogItemId: dto.catalog_item_id || 'custom',
    catalogItemName: dto.catalog_item_name,
    description: dto.description,
    requesterName: dto.requester_name,
    requesterEmail: dto.requester_email,
    department: dto.department,
    cost: Number(dto.cost || 0),
    status: dto.status,
    currentStage: dto.current_stage,
    deliveryEstimateDays: dto.delivery_estimate_days,
    deliveryDate: dto.delivery_date || undefined,
    customFormValues: dto.custom_form_values,
    createdAt: dto.created_at,
    approvals: (dto.approvals || []).map(a => ({
      role: a.title,
      approver: a.assigned_approver_email,
      approverEmail: a.assigned_approver_email,
      status: a.status,
      timestamp: a.decided_at || undefined,
      notes: a.decision_note || undefined,
    })),
  };
}

export function mapProblemDto(dto: ProblemDto): Problem {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    title: dto.title,
    description: dto.description,
    status: dto.status,
    severity: dto.severity,
    rootCauseAnalysis: dto.root_cause_analysis,
    workaround: dto.workaround,
    permanentSolution: dto.permanent_solution,
    linkedIncidentIds: dto.linked_incident_ids || [],
    linkedChangeId: dto.linked_change_id || undefined,
    owner: dto.owner_name,
    isKnownError: dto.is_known_error,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapChangeDto(dto: ChangeRequestDto): ChangeRequest {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    title: dto.title,
    type: dto.change_type,
    status: dto.status,
    riskScore: dto.risk_score,
    reason: dto.reason,
    implementationPlan: dto.implementation_plan,
    rollbackPlan: dto.rollback_plan,
    testPlan: dto.test_plan,
    scheduledStart: dto.scheduled_start || dto.created_at,
    scheduledEnd: dto.scheduled_end || dto.created_at,
    requestedBy: dto.requester_name,
    assignedEngineer: dto.assigned_engineer_name,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    cabVotes: (dto.cab_seats || []).map(s => ({
      member: s.assigned_member_email,
      memberEmail: s.assigned_member_email,
      role: s.seat_name,
      vote: s.vote === 'approve' ? 'approved' : s.vote === 'reject' ? 'rejected' : 'pending',
      notes: s.vote_comment || undefined,
    })),
  };
}

// --- Typed REST API Calls ---
export const itsmApi = {
  // Incidents
  async listIncidents(params?: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    page?: number;
    page_size?: number;
  }): Promise<PaginatedDto<IncidentDto>> {
    return apiRequest<PaginatedDto<IncidentDto>>('/incidents', { query: params });
  },

  async createIncident(payload: {
    title: string;
    description?: string;
    priority?: IncidentPriority;
    urgency?: 'high' | 'medium' | 'low';
    impact?: 'high' | 'medium' | 'low';
    category?: IncidentCategory;
    assignment_group?: string;
    affected_ci_label?: string;
    source_channel?: 'portal' | 'email' | 'phone' | 'monitor';
  }): Promise<IncidentDto> {
    return apiRequest<IncidentDto>('/incidents', { method: 'POST', body: payload });
  },

  async updateIncident(
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      status: IncidentStatus;
      priority: IncidentPriority;
      category: IncidentCategory;
      time_logged_mins: number;
      csat_score: number;
      note: string;
    }>
  ): Promise<IncidentDto> {
    return apiRequest<IncidentDto>(`/incidents/${id}`, { method: 'PATCH', body: payload });
  },

  async assignIncident(
    id: string,
    payload: { assignee_user_id?: string; assignee_name?: string; assignment_group?: string; note?: string }
  ): Promise<IncidentDto> {
    return apiRequest<IncidentDto>(`/incidents/${id}/assign`, { method: 'POST', body: payload });
  },

  async resolveIncident(id: string, resolutionNotes: string, timeLoggedMins?: number): Promise<IncidentDto> {
    return apiRequest<IncidentDto>(`/incidents/${id}/resolve`, {
      method: 'POST',
      body: { resolution_notes: resolutionNotes, time_logged_mins: timeLoggedMins },
    });
  },

  async closeIncident(id: string, closureNote?: string, csatScore?: number): Promise<IncidentDto> {
    return apiRequest<IncidentDto>(`/incidents/${id}/close`, {
      method: 'POST',
      body: { closure_note: closureNote || 'Closed', csat_score: csatScore },
    });
  },

  async addIncidentActivity(
    id: string,
    payload: { activity_type: IncidentActivityDto['activity_type']; action: string; note: string }
  ): Promise<IncidentActivityDto> {
    return apiRequest<IncidentActivityDto>(`/incidents/${id}/activities`, {
      method: 'POST',
      body: payload,
    });
  },

  // Service Requests
  async listRequests(params?: {
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedDto<ServiceRequestDto>> {
    return apiRequest<PaginatedDto<ServiceRequestDto>>('/requests', { query: params });
  },

  async createRequest(payload: {
    catalog_item_id?: string;
    catalog_item_name?: string;
    description?: string;
    department?: string;
    cost?: number;
    delivery_estimate_days?: number;
    custom_form_values?: Record<string, string>;
    approval_stages?: { title: string; stage_order: number; assigned_approver_user_id: string }[];
  }): Promise<ServiceRequestDto> {
    return apiRequest<ServiceRequestDto>('/requests', { method: 'POST', body: payload });
  },

  async decideRequestApproval(
    requestId: string,
    approvalId: string,
    payload: { decision: 'approved' | 'rejected'; note?: string; override?: boolean; override_reason?: string }
  ): Promise<ServiceRequestDto> {
    return apiRequest<ServiceRequestDto>(
      `/requests/${requestId}/approvals/${approvalId}/decision`,
      { method: 'POST', body: payload }
    );
  },

  async fulfillRequest(requestId: string, fulfillmentNotes: string, markCompleted = true): Promise<ServiceRequestDto> {
    return apiRequest<ServiceRequestDto>(`/requests/${requestId}/fulfill`, {
      method: 'POST',
      body: { fulfillment_notes: fulfillmentNotes, mark_completed: markCompleted },
    });
  },

  // Problems
  async listProblems(params?: {
    status?: string;
    is_known_error?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedDto<ProblemDto>> {
    return apiRequest<PaginatedDto<ProblemDto>>('/problems', { query: params });
  },

  async createProblem(payload: {
    title: string;
    description?: string;
    severity?: Problem['severity'];
    root_cause_analysis?: string;
    workaround?: string;
    linked_incident_ids?: string[];
  }): Promise<ProblemDto> {
    return apiRequest<ProblemDto>('/problems', { method: 'POST', body: payload });
  },

  async updateProblem(id: string, payload: Record<string, unknown>): Promise<ProblemDto> {
    return apiRequest<ProblemDto>(`/problems/${id}`, { method: 'PATCH', body: payload });
  },

  // Changes & CAB
  async listChanges(params?: {
    status?: string;
    change_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedDto<ChangeRequestDto>> {
    return apiRequest<PaginatedDto<ChangeRequestDto>>('/changes', { query: params });
  },

  async createChange(payload: {
    title: string;
    change_type?: ChangeRequest['type'];
    risk_score?: ChangeRequest['riskScore'];
    reason?: string;
    implementation_plan?: string;
    rollback_plan?: string;
    test_plan?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    cab_seats?: { seat_name: string; assigned_member_user_id: string }[];
  }): Promise<ChangeRequestDto> {
    return apiRequest<ChangeRequestDto>('/changes', { method: 'POST', body: payload });
  },

  async transitionChangeStatus(id: string, status: ChangeStatus, note?: string): Promise<ChangeRequestDto> {
    return apiRequest<ChangeRequestDto>(`/changes/${id}/status`, {
      method: 'POST',
      body: { status, note: note || '' },
    });
  },

  async castCabVote(
    changeId: string,
    seatId: string,
    payload: { vote: 'approve' | 'reject' | 'abstain'; comment?: string; override?: boolean; override_reason?: string }
  ): Promise<ChangeRequestDto> {
    return apiRequest<ChangeRequestDto>(`/changes/${changeId}/cab-seats/${seatId}/vote`, {
      method: 'POST',
      body: payload,
    });
  },

  // Server-side RBAC-enforced global search
  async globalSearch(q: string, limit = 20): Promise<GlobalSearchResponseDto> {
    return apiRequest<GlobalSearchResponseDto>('/search', { query: { q, limit } });
  },
};
