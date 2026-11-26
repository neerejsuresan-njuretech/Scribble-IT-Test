import type {
  ApprovalItemDto,
  CabSeatDto,
  ChangeRequest,
  ChangeRequestDto,
  ChangeStatus,
  GlobalSearchHitDto,
  GlobalSearchResponseDto,
  Incident,
  IncidentActivityDto,
  IncidentCategory,
  IncidentDto,
  IncidentPriority,
  IncidentStatus,
  PaginatedDto,
  Problem,
  ProblemDto,
  ProblemStatus,
  ServiceRequest,
  ServiceRequestDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  ApprovalItemDto,
  CabSeatDto,
  ChangeRequestDto,
  GlobalSearchHitDto,
  GlobalSearchResponseDto,
  IncidentActivityDto,
  IncidentDto,
  ProblemDto,
  ServiceRequestDto,
};

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
    activityLog: (dto.activities || []).map((a) => ({
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
    approvals: (dto.approvals || []).map((a) => ({
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
    cabVotes: (dto.cab_seats || []).map((s) => ({
      member: s.assigned_member_email,
      memberEmail: s.assigned_member_email,
      role: s.seat_name,
      vote: s.vote === 'approve' ? 'approved' : s.vote === 'reject' ? 'rejected' : 'pending',
      notes: s.vote_comment || undefined,
    })),
  };
}

export function createItsmApi(http: ScribbleHttpClient) {
  return {
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
      return http.request<PaginatedDto<IncidentDto>>('/incidents', { query: params });
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
      return http.request<IncidentDto>('/incidents', { method: 'POST', body: payload });
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
      }>,
    ): Promise<IncidentDto> {
      return http.request<IncidentDto>(`/incidents/${id}`, { method: 'PATCH', body: payload });
    },

    async assignIncident(
      id: string,
      payload: {
        assignee_user_id?: string;
        assignee_name?: string;
        assignment_group?: string;
        note?: string;
      },
    ): Promise<IncidentDto> {
      return http.request<IncidentDto>(`/incidents/${id}/assign`, { method: 'POST', body: payload });
    },

    async resolveIncident(
      id: string,
      resolutionNotes: string,
      timeLoggedMins?: number,
    ): Promise<IncidentDto> {
      return http.request<IncidentDto>(`/incidents/${id}/resolve`, {
        method: 'POST',
        body: { resolution_notes: resolutionNotes, time_logged_mins: timeLoggedMins },
      });
    },

    async closeIncident(
      id: string,
      closureNote?: string,
      csatScore?: number,
    ): Promise<IncidentDto> {
      return http.request<IncidentDto>(`/incidents/${id}/close`, {
        method: 'POST',
        body: { closure_note: closureNote || 'Closed', csat_score: csatScore },
      });
    },

    async addIncidentActivity(
      id: string,
      payload: { activity_type: IncidentActivityDto['activity_type']; action: string; note: string },
    ): Promise<IncidentActivityDto> {
      return http.request<IncidentActivityDto>(`/incidents/${id}/activities`, {
        method: 'POST',
        body: payload,
      });
    },

    async listRequests(params?: {
      status?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedDto<ServiceRequestDto>> {
      return http.request<PaginatedDto<ServiceRequestDto>>('/requests', { query: params });
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
      return http.request<ServiceRequestDto>('/requests', { method: 'POST', body: payload });
    },

    async decideRequestApproval(
      requestId: string,
      approvalId: string,
      payload: {
        decision: 'approved' | 'rejected';
        note?: string;
        override?: boolean;
        override_reason?: string;
      },
    ): Promise<ServiceRequestDto> {
      return http.request<ServiceRequestDto>(
        `/requests/${requestId}/approvals/${approvalId}/decision`,
        { method: 'POST', body: payload },
      );
    },

    async fulfillRequest(
      requestId: string,
      fulfillmentNotes: string,
      markCompleted = true,
    ): Promise<ServiceRequestDto> {
      return http.request<ServiceRequestDto>(`/requests/${requestId}/fulfill`, {
        method: 'POST',
        body: { fulfillment_notes: fulfillmentNotes, mark_completed: markCompleted },
      });
    },

    async listProblems(params?: {
      status?: string;
      is_known_error?: boolean;
      search?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedDto<ProblemDto>> {
      return http.request<PaginatedDto<ProblemDto>>('/problems', { query: params });
    },

    async createProblem(payload: {
      title: string;
      description?: string;
      severity?: Problem['severity'];
      root_cause_analysis?: string;
      workaround?: string;
      linked_incident_ids?: string[];
    }): Promise<ProblemDto> {
      return http.request<ProblemDto>('/problems', { method: 'POST', body: payload });
    },

    async updateProblem(id: string, payload: Record<string, unknown>): Promise<ProblemDto> {
      return http.request<ProblemDto>(`/problems/${id}`, { method: 'PATCH', body: payload });
    },

    async listChanges(params?: {
      status?: string;
      change_type?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedDto<ChangeRequestDto>> {
      return http.request<PaginatedDto<ChangeRequestDto>>('/changes', { query: params });
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
      return http.request<ChangeRequestDto>('/changes', { method: 'POST', body: payload });
    },

    async transitionChangeStatus(
      id: string,
      status: ChangeStatus,
      note?: string,
    ): Promise<ChangeRequestDto> {
      return http.request<ChangeRequestDto>(`/changes/${id}/status`, {
        method: 'POST',
        body: { status, note: note || '' },
      });
    },

    async castCabVote(
      changeId: string,
      seatId: string,
      payload: {
        vote: 'approve' | 'reject' | 'abstain';
        comment?: string;
        override?: boolean;
        override_reason?: string;
      },
    ): Promise<ChangeRequestDto> {
      return http.request<ChangeRequestDto>(`/changes/${changeId}/cab-seats/${seatId}/vote`, {
        method: 'POST',
        body: payload,
      });
    },

    async globalSearch(q: string, limit = 20): Promise<GlobalSearchResponseDto> {
      return http.request<GlobalSearchResponseDto>('/search', { query: { q, limit } });
    },
  };
}

export const itsmApi = createItsmApi(defaultHttpClient);
