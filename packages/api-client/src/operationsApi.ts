import type {
  AuditLogDto,
  AuditLogEntry,
  KnowledgeArticle,
  KnowledgeArticleDto,
  NotificationDto,
  OperationsReportSummaryDto,
  WorkflowDto,
} from '@scribble-it/types';
import { defaultHttpClient, ScribbleHttpClient } from './httpClient';

export type {
  AuditLogDto,
  KnowledgeArticleDto,
  NotificationDto,
  OperationsReportSummaryDto,
  WorkflowDto,
};

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

export function createOperationsApi(http: ScribbleHttpClient) {
  return {
    async listKnowledge(params?: {
      category?: string;
      search?: string;
    }): Promise<KnowledgeArticleDto[]> {
      return http.request<KnowledgeArticleDto[]>('/knowledge', { query: params });
    },

    async createKnowledge(payload: {
      title: string;
      category?: string;
      visibility?: 'public' | 'internal';
      tags?: string[];
      content?: string;
    }): Promise<KnowledgeArticleDto> {
      return http.request<KnowledgeArticleDto>('/knowledge', { method: 'POST', body: payload });
    },

    async voteKnowledgeHelpful(id: string): Promise<KnowledgeArticleDto> {
      return http.request<KnowledgeArticleDto>(`/knowledge/${id}/helpful`, { method: 'POST' });
    },

    async listWorkflows(): Promise<WorkflowDto[]> {
      return http.request<WorkflowDto[]>('/workflows');
    },

    async executeWorkflow(id: string): Promise<WorkflowDto> {
      return http.request<WorkflowDto>(`/workflows/${id}/execute`, { method: 'POST' });
    },

    async listNotifications(unreadOnly = false): Promise<NotificationDto[]> {
      return http.request<NotificationDto[]>('/notifications', {
        query: { unread_only: unreadOnly },
      });
    },

    async markNotificationRead(id: string): Promise<NotificationDto> {
      return http.request<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' });
    },

    async getReportSummary(): Promise<OperationsReportSummaryDto> {
      return http.request<OperationsReportSummaryDto>('/reports/summary');
    },

    async listAuditLogs(limit = 100): Promise<AuditLogDto[]> {
      return http.request<AuditLogDto[]>('/audit-logs', { query: { limit } });
    },
  };
}

export const operationsApi = createOperationsApi(defaultHttpClient);
