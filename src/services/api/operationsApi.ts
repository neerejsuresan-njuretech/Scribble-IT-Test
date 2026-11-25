import { AuditLogEntry, KnowledgeArticle, WorkflowDefinition } from '../../types/itsm';
import { apiRequest } from './httpClient';

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

export function mapKnowledgeDto(dto: KnowledgeArticleDto): KnowledgeArticle {
  return {
    id: dto.id,
    tenantId: dto.organization_id,
    title: dto.title,
    category: dto.category,
    visibility: dto.visibility,
    author: dto.author_name,
    views: dto.views,
    helpfulVotes: dto.helpful_votes,
    tags: dto.tags || [],
    content: dto.content,
    updatedAt: dto.updated_at,
  };
}

export function mapAuditLogDto(dto: AuditLogDto): AuditLogEntry {
  return {
    id: dto.id,
    tenantId: dto.organization_id || 'global',
    timestamp: dto.created_at,
    actor: dto.actor_email,
    module: dto.module,
    action: dto.action,
    targetId: dto.target_id || '-',
    detail: dto.detail,
  };
}

export const operationsApi = {
  async listKnowledge(params?: { category?: string; search?: string }): Promise<KnowledgeArticleDto[]> {
    return apiRequest<KnowledgeArticleDto[]>('/knowledge', { query: params });
  },

  async createKnowledge(payload: {
    title: string;
    category?: string;
    visibility?: 'public' | 'internal';
    tags?: string[];
    content?: string;
  }): Promise<KnowledgeArticleDto> {
    return apiRequest<KnowledgeArticleDto>('/knowledge', { method: 'POST', body: payload });
  },

  async voteKnowledgeHelpful(id: string): Promise<KnowledgeArticleDto> {
    return apiRequest<KnowledgeArticleDto>(`/knowledge/${id}/helpful`, { method: 'POST' });
  },

  async listWorkflows(): Promise<WorkflowDto[]> {
    return apiRequest<WorkflowDto[]>('/workflows');
  },

  async executeWorkflow(id: string): Promise<WorkflowDto> {
    return apiRequest<WorkflowDto>(`/workflows/${id}/execute`, { method: 'POST' });
  },

  async listNotifications(unreadOnly = false): Promise<NotificationDto[]> {
    return apiRequest<NotificationDto[]>('/notifications', {
      query: { unread_only: unreadOnly },
    });
  },

  async markNotificationRead(id: string): Promise<NotificationDto> {
    return apiRequest<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' });
  },

  async getReportSummary(): Promise<OperationsReportSummaryDto> {
    return apiRequest<OperationsReportSummaryDto>('/reports/summary');
  },

  async listAuditLogs(limit = 100): Promise<AuditLogDto[]> {
    return apiRequest<AuditLogDto[]>('/audit-logs', { query: { limit } });
  },
};
