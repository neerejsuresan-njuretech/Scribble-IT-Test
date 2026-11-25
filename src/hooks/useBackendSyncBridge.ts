import { useCallback, useState } from 'react';
import {
  Asset,
  AuditLogEntry,
  ChangeRequest,
  CmdbRelation,
  Incident,
  InventoryItem,
  KnowledgeArticle,
  Problem,
  ServiceRequest,
  SoftwareLicense,
} from '../types/itsm';
import {
  authApi,
  BackendMeResponse,
  cmdbApi,
  getAccessToken,
  isBackendApiConfigured,
  itsmApi,
  mapAssetDto,
  mapAuditLogDto,
  mapChangeDto,
  mapCmdbRelationDto,
  mapIncidentDto,
  mapInventoryItemDto,
  mapKnowledgeDto,
  mapProblemDto,
  mapServiceRequestDto,
  mapSoftwareLicenseDto,
  operationsApi,
} from '../services/api';

export interface HydratedBackendSnapshot {
  me: BackendMeResponse;
  incidents: Incident[];
  requests: ServiceRequest[];
  problems: Problem[];
  changes: ChangeRequest[];
  assets: Asset[];
  cmdbRelations: CmdbRelation[];
  inventory: InventoryItem[];
  softwareLicenses: SoftwareLicense[];
  kbArticles: KnowledgeArticle[];
  auditLogs: AuditLogEntry[];
}

export type BackendSyncState = 'idle' | 'unconfigured' | 'loading' | 'connected' | 'error';

/**
 * Domain hydration hook that loads core ITSM, CMDB, Knowledge, and Audit datasets
 * from FastAPI `/api/v1/*` whenever a backend JWT session is active, respecting
 * the user's backend-calculated effective permissions.
 */
export function useBackendSyncBridge() {
  const [backendStatus, setBackendStatus] = useState<BackendSyncState>(() =>
    isBackendApiConfigured() ? 'idle' : 'unconfigured'
  );
  const [backendError, setBackendError] = useState<string | null>(null);
  const [lastBackendSyncAt, setLastBackendSyncAt] = useState<string | null>(null);

  const hydrateFromBackend = useCallback(async (): Promise<HydratedBackendSnapshot | null> => {
    if (!isBackendApiConfigured() || !getAccessToken()) {
      return null;
    }

    setBackendStatus('loading');
    setBackendError(null);
    try {
      const me = await authApi.me();
      const perms = new Set(me.permissions || []);
      const canInc = me.is_super_admin || perms.has('incidents:read');
      const canReq = me.is_super_admin || perms.has('incidents:read') || perms.has('requests:approve') || me.portal_type === 'end_user';
      const canCab = me.is_super_admin || perms.has('incidents:read') || perms.has('changes:cab_vote');
      const canAst = me.is_super_admin || perms.has('assets:read');
      const canAstWrite = me.is_super_admin || perms.has('assets:write');
      const canAudit = me.is_super_admin || me.is_iam_portal || perms.has('audit:read') || perms.has('iam:manage');

      const [
        incRes,
        reqRes,
        prbRes,
        chgRes,
        astRes,
        relRes,
        invRes,
        swRes,
        kbRes,
        auditRes,
      ] = await Promise.all([
        canInc ? itsmApi.listIncidents({ page_size: 100 }).catch(() => null) : Promise.resolve(null),
        canReq ? itsmApi.listRequests({ page_size: 100 }).catch(() => null) : Promise.resolve(null),
        canInc && me.portal_type !== 'end_user'
          ? itsmApi.listProblems({ page_size: 100 }).catch(() => null)
          : Promise.resolve(null),
        canCab && me.portal_type !== 'end_user'
          ? itsmApi.listChanges({ page_size: 100 }).catch(() => null)
          : Promise.resolve(null),
        canAst ? cmdbApi.listAssets({ page_size: 100 }).catch(() => null) : Promise.resolve(null),
        canAst && me.portal_type !== 'end_user'
          ? cmdbApi.listCmdbRelations().catch(() => [])
          : Promise.resolve([]),
        canAstWrite ? cmdbApi.listInventory().catch(() => []) : Promise.resolve([]),
        canAst && me.portal_type !== 'end_user'
          ? cmdbApi.listSoftwareLicenses().catch(() => [])
          : Promise.resolve([]),
        operationsApi.listKnowledge().catch(() => []),
        canAudit ? operationsApi.listAuditLogs(100).catch(() => []) : Promise.resolve([]),
      ]);

      setBackendStatus('connected');
      setLastBackendSyncAt(new Date().toISOString());

      return {
        me,
        incidents: incRes ? incRes.items.map(mapIncidentDto) : [],
        requests: reqRes ? reqRes.items.map(mapServiceRequestDto) : [],
        problems: prbRes ? prbRes.items.map(mapProblemDto) : [],
        changes: chgRes ? chgRes.items.map(mapChangeDto) : [],
        assets: astRes ? astRes.items.map(mapAssetDto) : [],
        cmdbRelations: relRes.map(mapCmdbRelationDto),
        inventory: invRes.map(mapInventoryItemDto),
        softwareLicenses: swRes.map(mapSoftwareLicenseDto),
        kbArticles: kbRes.map(mapKnowledgeDto),
        auditLogs: auditRes.map(mapAuditLogDto),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to FastAPI backend';
      setBackendStatus('error');
      setBackendError(msg);
      return null;
    }
  }, []);

  return {
    backendStatus,
    backendError,
    lastBackendSyncAt,
    isBackendMode: isBackendApiConfigured(),
    hydrateFromBackend,
  };
}
