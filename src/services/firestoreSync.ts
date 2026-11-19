import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Incident,
  ServiceRequest,
  Tenant,
  ThemeMode,
} from '../types/itsm';
import { getDefaultTenantBranding } from '../data/freeitsmSeedData';

export interface WorkspaceRootData {
  ownerUid: string;
  ownerEmail: string;
  activeTenantId: string;
  theme: ThemeMode;
}

export interface ModuleBucketRecord {
  id: string;
  moduleKey: string;
  items?: unknown[];
  settingsMap?: Record<string, unknown>;
  itemCount: number;
}

export interface CloudWorkspaceSnapshot {
  activeTenantId: string;
  theme: ThemeMode;
  tenants: Tenant[];
  incidents: Incident[];
  requests: ServiceRequest[];
  moduleBuckets: Record<string, { items?: unknown[]; settingsMap?: Record<string, unknown> }>;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

function toSafeId(raw: string, fallbackPrefix: string): string {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  if (cleaned && VALID_ID_RE.test(cleaned)) return cleaned;
  return `${fallbackPrefix}-${Date.now()}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const raw = typeof val === 'string' ? val : '';
  const str = raw.trim().length > 0 ? raw : fallback;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function tsToIso(val: unknown, fallback?: string): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) return val;
  return fallback || new Date().toISOString();
}

// Track known existing Firestore document paths so updates never overwrite immutable createdAt
const existingDocPaths = new Set<string>();

export function clearKnownCloudDocPaths(): void {
  existingDocPaths.clear();
}

async function upsertWithImmutableCreatedAt(
  path: string,
  createPayload: Record<string, unknown>,
  updatePayload: Record<string, unknown>
): Promise<void> {
  const ref = doc(db, path);
  try {
    let exists = existingDocPaths.has(path);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) existingDocPaths.add(path);
    }

    if (exists) {
      await updateDoc(ref, {
        ...stripUndefinedDeep(updatePayload),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...stripUndefinedDeep(createPayload),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      existingDocPaths.add(path);
    }
  } catch (error) {
    handleFirestoreError(error, existingDocPaths.has(path) ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function ensureWorkspaceRoot(
  ownerUid: string,
  ownerEmail: string,
  activeTenantId: string,
  theme: ThemeMode
): Promise<void> {
  const safeUid = toSafeId(ownerUid, 'user');
  const path = `workspaces/${safeUid}`;
  const cleanEmail = clampStr(ownerEmail || 'user@scribbleit.local', 160, 'user@scribbleit.local');
  const cleanTenant = clampStr(activeTenantId || 'tenant-njure-hq', 128, 'tenant-njure-hq');
  const cleanTheme: ThemeMode = theme === 'light' ? 'light' : 'dark';

  await upsertWithImmutableCreatedAt(
    path,
    {
      ownerUid: safeUid,
      ownerEmail: cleanEmail,
      activeTenantId: cleanTenant,
      theme: cleanTheme,
    },
    {
      ownerEmail: cleanEmail,
      activeTenantId: cleanTenant,
      theme: cleanTheme,
    }
  );
}

export async function upsertTenantInCloud(ownerUid: string, tenant: Tenant): Promise<void> {
  const safeUid = toSafeId(ownerUid, 'user');
  const safeId = toSafeId(tenant.id, 'tenant');
  const path = `workspaces/${safeUid}/tenants/${safeId}`;

  const branding = tenant.portalBranding || getDefaultTenantBranding(tenant.name);
  const cleanBranding = {
    employees: {
      portalName: clampStr(branding.employees?.portalName, 120, tenant.name),
      subtitle: clampStr(branding.employees?.subtitle, 160, 'Employee IT Operations'),
      logoDataUrl: clampStr(branding.employees?.logoDataUrl, 200000, ''),
    },
    enduser: {
      portalName: clampStr(branding.enduser?.portalName, 120, `${tenant.name} Help Center`),
      subtitle: clampStr(branding.enduser?.subtitle, 160, 'Self-Service Portal'),
      logoDataUrl: clampStr(branding.enduser?.logoDataUrl, 200000, ''),
    },
    iam: {
      portalName: clampStr(branding.iam?.portalName, 120, `${tenant.name} IAM`),
      subtitle: clampStr(branding.iam?.subtitle, 160, 'Identity & Access Governance'),
      logoDataUrl: clampStr(branding.iam?.logoDataUrl, 200000, ''),
    },
  };

  const mutableFields: Record<string, unknown> = {
    name: clampStr(tenant.name, 160, 'Organization'),
    slug: clampStr(tenant.slug || tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 96, 'org'),
    companyCode: clampStr(tenant.companyCode || tenant.slug.toUpperCase(), 48),
    domain: clampStr(tenant.domain, 160, 'company.local'),
    plan: tenant.plan === 'Managed MSP' || tenant.plan === 'Dedicated' ? tenant.plan : 'Enterprise',
    region: clampStr(tenant.region, 64, 'asia-south1'),
    timezone: clampStr(tenant.timezone, 64, 'UTC'),
    currency: tenant.currency === 'GBP' || tenant.currency === 'EUR' ? tenant.currency : 'USD',
    primaryContactEmail: clampStr(tenant.primaryContactEmail, 160, 'ops@company.local'),
    status: tenant.status === 'suspended' ? 'suspended' : 'active',
    companyLogoDataUrl: clampStr(tenant.companyLogoDataUrl, 250000, ''),
    slaTargets: tenant.slaTargets || { P1: 1, P2: 4, P3: 24, P4: 72 },
    enabledModules: tenant.enabledModules || {},
    preferenceTemplate: tenant.preferenceTemplate || {
      dateFormat: 'YYYY-MM-DD',
      defaultQueue: 'Service Desk Triage Pool',
      autoAssignRota: true,
      requireCabForNormalChange: true,
      portalBannerTitle: `${tenant.name.toUpperCase()} SUPPORT`,
    },
    portalBranding: cleanBranding,
  };

  const createPayload: Record<string, unknown> = {
    id: safeId,
    ownerUid: safeUid,
    clientCreatedAt: clampStr(tenant.createdAt || new Date().toISOString(), 64),
    ...mutableFields,
  };

  await upsertWithImmutableCreatedAt(path, createPayload, mutableFields);
}

export async function upsertIncidentInCloud(ownerUid: string, inc: Incident): Promise<void> {
  const safeUid = toSafeId(ownerUid, 'user');
  const safeId = toSafeId(inc.id, 'INC');
  const safeTenantId = toSafeId(inc.tenantId, 'tenant');
  const path = `workspaces/${safeUid}/incidents/${safeId}`;

  const mutableFields: Record<string, unknown> = {
    tenantId: safeTenantId,
    title: clampStr(inc.title, 256, 'Untitled Incident'),
    description: clampStr(inc.description, 8192, ''),
    status: ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'].includes(inc.status)
      ? inc.status
      : 'new',
    priority: ['P1', 'P2', 'P3', 'P4'].includes(inc.priority) ? inc.priority : 'P3',
    urgency: ['high', 'medium', 'low'].includes(inc.urgency) ? inc.urgency : 'medium',
    impact: ['high', 'medium', 'low'].includes(inc.impact) ? inc.impact : 'medium',
    category: ['hardware', 'software', 'network', 'security', 'access', 'telephony'].includes(inc.category)
      ? inc.category
      : 'software',
    requesterName: clampStr(inc.requesterName, 128, 'Requester'),
    requesterEmail: clampStr(inc.requesterEmail, 160, 'requester@company.local'),
    assignee: clampStr(inc.assignee, 128, 'Unassigned'),
    assignmentGroup: clampStr(inc.assignmentGroup || 'Service Desk Triage Pool', 128),
    affectedCI: clampStr(inc.affectedCI || '', 128),
    slaDeadline: clampStr(inc.slaDeadline || new Date(Date.now() + 4 * 3600000).toISOString(), 64),
    slaBreached: Boolean(inc.slaBreached),
    sourceChannel:
      inc.sourceChannel && ['portal', 'email', 'phone', 'monitor'].includes(inc.sourceChannel)
        ? inc.sourceChannel
        : 'portal',
    resolutionNotes: clampStr(inc.resolutionNotes || '', 4096),
    activityLog: Array.isArray(inc.activityLog) ? inc.activityLog.slice(0, 100) : [],
  };

  const createPayload: Record<string, unknown> = {
    id: safeId,
    ownerUid: safeUid,
    clientCreatedAt: clampStr(inc.createdAt || new Date().toISOString(), 64),
    ...mutableFields,
  };

  await upsertWithImmutableCreatedAt(path, createPayload, mutableFields);
}

export async function upsertRequestInCloud(ownerUid: string, req: ServiceRequest): Promise<void> {
  const safeUid = toSafeId(ownerUid, 'user');
  const safeId = toSafeId(req.id, 'REQ');
  const safeTenantId = toSafeId(req.tenantId, 'tenant');
  const path = `workspaces/${safeUid}/service_requests/${safeId}`;

  const mutableFields: Record<string, unknown> = {
    tenantId: safeTenantId,
    catalogItemId: clampStr(req.catalogItemId, 64, 'cat-custom'),
    catalogItemName: clampStr(req.catalogItemName, 256, 'Service Request'),
    description: clampStr(req.description, 4096, ''),
    requesterName: clampStr(req.requesterName, 128, 'Requester'),
    requesterEmail: clampStr(req.requesterEmail, 160, 'requester@company.local'),
    department: clampStr(req.department, 128, 'General'),
    cost: Math.max(0, Number(req.cost) || 0),
    status: ['submitted', 'manager_approved', 'security_review', 'fulfillment', 'completed', 'rejected'].includes(
      req.status
    )
      ? req.status
      : 'submitted',
    currentStage: Math.max(1, Math.min(4, Number(req.currentStage) || 1)),
    approvals: Array.isArray(req.approvals) ? req.approvals.slice(0, 12) : [],
    deliveryEstimateDays: Math.max(0, Number(req.deliveryEstimateDays) || 1),
    deliveryDate: clampStr(req.deliveryDate || '', 64),
    customFormValues: req.customFormValues || {},
  };

  const createPayload: Record<string, unknown> = {
    id: safeId,
    ownerUid: safeUid,
    clientCreatedAt: clampStr(req.createdAt || new Date().toISOString(), 64),
    ...mutableFields,
  };

  await upsertWithImmutableCreatedAt(path, createPayload, mutableFields);
}

export async function upsertModuleBucketInCloud(
  ownerUid: string,
  bucketKey: string,
  data: { items?: unknown[]; settingsMap?: Record<string, unknown> }
): Promise<void> {
  const safeUid = toSafeId(ownerUid, 'user');
  const safeBucketId = toSafeId(bucketKey, 'bucket');
  const path = `workspaces/${safeUid}/module_state/${safeBucketId}`;

  const boundedItems = Array.isArray(data.items) ? data.items.slice(0, 500) : undefined;
  const itemCount = boundedItems
    ? boundedItems.length
    : data.settingsMap
    ? Math.min(500, Object.keys(data.settingsMap).length)
    : 0;

  const mutableFields: Record<string, unknown> = {
    moduleKey: clampStr(bucketKey, 64, safeBucketId),
    itemCount,
    ...(boundedItems !== undefined ? { items: boundedItems } : {}),
    ...(data.settingsMap !== undefined ? { settingsMap: data.settingsMap } : {}),
  };

  const createPayload: Record<string, unknown> = {
    id: safeBucketId,
    ownerUid: safeUid,
    ...mutableFields,
  };

  await upsertWithImmutableCreatedAt(path, createPayload, mutableFields);
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    await Promise.all(slice.map(worker));
  }
}

export async function pushFullWorkspaceSnapshotToCloud(
  ownerUid: string,
  ownerEmail: string,
  snapshot: CloudWorkspaceSnapshot
): Promise<void> {
  await ensureWorkspaceRoot(ownerUid, ownerEmail, snapshot.activeTenantId, snapshot.theme);

  await runInBatches(snapshot.tenants, 10, t => upsertTenantInCloud(ownerUid, t));
  await runInBatches(Object.entries(snapshot.moduleBuckets), 10, ([key, value]) =>
    upsertModuleBucketInCloud(ownerUid, key, value)
  );
  await runInBatches(snapshot.incidents, 20, inc => upsertIncidentInCloud(ownerUid, inc));
  await runInBatches(snapshot.requests, 20, req => upsertRequestInCloud(ownerUid, req));
}

export interface WorkspaceSubscriptionCallbacks {
  onWorkspaceRoot: (root: WorkspaceRootData | null) => void;
  onTenants: (tenants: Tenant[]) => void;
  onIncidents: (incidents: Incident[]) => void;
  onRequests: (requests: ServiceRequest[]) => void;
  onModuleBuckets: (buckets: Record<string, ModuleBucketRecord>) => void;
  onError: (err: Error) => void;
}

export function subscribeWorkspace(
  ownerUid: string,
  callbacks: WorkspaceSubscriptionCallbacks
): Unsubscribe {
  const safeUid = toSafeId(ownerUid, 'user');
  const unsubs: Unsubscribe[] = [];

  const rootPath = `workspaces/${safeUid}`;
  unsubs.push(
    onSnapshot(
      doc(db, rootPath),
      snap => {
        if (!snap.exists()) {
          callbacks.onWorkspaceRoot(null);
          return;
        }
        existingDocPaths.add(rootPath);
        const raw = snap.data();
        callbacks.onWorkspaceRoot({
          ownerUid: String(raw.ownerUid || safeUid),
          ownerEmail: String(raw.ownerEmail || ''),
          activeTenantId: String(raw.activeTenantId || ''),
          theme: raw.theme === 'light' ? 'light' : 'dark',
        });
      },
      err => {
        try {
          handleFirestoreError(err, OperationType.GET, rootPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const tenantsPath = `workspaces/${safeUid}/tenants`;
  unsubs.push(
    onSnapshot(
      query(collection(db, tenantsPath), where('ownerUid', '==', safeUid)),
      snap => {
        const list: Tenant[] = snap.docs.map(d => {
          existingDocPaths.add(`${tenantsPath}/${d.id}`);
          const raw = d.data();
          return {
            id: String(raw.id || d.id),
            name: String(raw.name || 'Organization'),
            slug: String(raw.slug || d.id),
            companyCode: raw.companyCode ? String(raw.companyCode) : undefined,
            domain: String(raw.domain || 'company.local'),
            plan: (raw.plan as Tenant['plan']) || 'Enterprise',
            region: String(raw.region || 'asia-south1'),
            timezone: String(raw.timezone || 'UTC'),
            currency: (raw.currency as Tenant['currency']) || 'USD',
            primaryContactEmail: String(raw.primaryContactEmail || 'ops@company.local'),
            status: raw.status === 'suspended' ? 'suspended' : 'active',
            slaTargets: (raw.slaTargets as Tenant['slaTargets']) || { P1: 1, P2: 4, P3: 24, P4: 72 },
            enabledModules: (raw.enabledModules as Tenant['enabledModules']) || ({} as Tenant['enabledModules']),
            preferenceTemplate: raw.preferenceTemplate as Tenant['preferenceTemplate'],
            companyLogoDataUrl: raw.companyLogoDataUrl ? String(raw.companyLogoDataUrl) : undefined,
            portalBranding: raw.portalBranding as Tenant['portalBranding'],
            createdAt: tsToIso(raw.clientCreatedAt || raw.createdAt),
          };
        });
        callbacks.onTenants(list);
      },
      err => {
        try {
          handleFirestoreError(err, OperationType.LIST, tenantsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const incidentsPath = `workspaces/${safeUid}/incidents`;
  unsubs.push(
    onSnapshot(
      query(collection(db, incidentsPath), where('ownerUid', '==', safeUid)),
      snap => {
        const list: Incident[] = snap.docs.map(d => {
          existingDocPaths.add(`${incidentsPath}/${d.id}`);
          const raw = d.data();
          return {
            id: String(raw.id || d.id),
            tenantId: String(raw.tenantId || ''),
            title: String(raw.title || ''),
            description: String(raw.description || ''),
            status: (raw.status as Incident['status']) || 'new',
            priority: (raw.priority as Incident['priority']) || 'P3',
            urgency: (raw.urgency as Incident['urgency']) || 'medium',
            impact: (raw.impact as Incident['impact']) || 'medium',
            category: (raw.category as Incident['category']) || 'software',
            requesterName: String(raw.requesterName || ''),
            requesterEmail: String(raw.requesterEmail || ''),
            assignee: String(raw.assignee || ''),
            assignmentGroup: raw.assignmentGroup ? String(raw.assignmentGroup) : undefined,
            affectedCI: raw.affectedCI ? String(raw.affectedCI) : undefined,
            slaDeadline: String(raw.slaDeadline || ''),
            slaBreached: Boolean(raw.slaBreached),
            sourceChannel: raw.sourceChannel as Incident['sourceChannel'],
            resolutionNotes: raw.resolutionNotes ? String(raw.resolutionNotes) : undefined,
            activityLog: Array.isArray(raw.activityLog) ? raw.activityLog : [],
            createdAt: tsToIso(raw.clientCreatedAt || raw.createdAt),
            updatedAt: tsToIso(raw.updatedAt || raw.clientCreatedAt),
          };
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callbacks.onIncidents(list);
      },
      err => {
        try {
          handleFirestoreError(err, OperationType.LIST, incidentsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const requestsPath = `workspaces/${safeUid}/service_requests`;
  unsubs.push(
    onSnapshot(
      query(collection(db, requestsPath), where('ownerUid', '==', safeUid)),
      snap => {
        const list: ServiceRequest[] = snap.docs.map(d => {
          existingDocPaths.add(`${requestsPath}/${d.id}`);
          const raw = d.data();
          return {
            id: String(raw.id || d.id),
            tenantId: String(raw.tenantId || ''),
            catalogItemId: String(raw.catalogItemId || ''),
            catalogItemName: String(raw.catalogItemName || ''),
            description: String(raw.description || ''),
            requesterName: String(raw.requesterName || ''),
            requesterEmail: String(raw.requesterEmail || ''),
            department: String(raw.department || ''),
            cost: Number(raw.cost) || 0,
            status: (raw.status as ServiceRequest['status']) || 'submitted',
            currentStage: Number(raw.currentStage) || 1,
            approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
            deliveryEstimateDays: Number(raw.deliveryEstimateDays) || 1,
            deliveryDate: raw.deliveryDate ? String(raw.deliveryDate) : undefined,
            customFormValues: (raw.customFormValues as Record<string, string>) || undefined,
            createdAt: tsToIso(raw.clientCreatedAt || raw.createdAt),
          };
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callbacks.onRequests(list);
      },
      err => {
        try {
          handleFirestoreError(err, OperationType.LIST, requestsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  const bucketsPath = `workspaces/${safeUid}/module_state`;
  unsubs.push(
    onSnapshot(
      query(collection(db, bucketsPath), where('ownerUid', '==', safeUid)),
      snap => {
        const map: Record<string, ModuleBucketRecord> = {};
        snap.docs.forEach(d => {
          existingDocPaths.add(`${bucketsPath}/${d.id}`);
          const raw = d.data();
          const key = String(raw.moduleKey || d.id);
          map[key] = {
            id: d.id,
            moduleKey: key,
            items: Array.isArray(raw.items) ? raw.items : undefined,
            settingsMap:
              raw.settingsMap && typeof raw.settingsMap === 'object'
                ? (raw.settingsMap as Record<string, unknown>)
                : undefined,
            itemCount: Number(raw.itemCount) || 0,
          };
        });
        callbacks.onModuleBuckets(map);
      },
      err => {
        try {
          handleFirestoreError(err, OperationType.LIST, bucketsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  return () => {
    unsubs.forEach(u => u());
  };
}
