import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Package,
  GitPullRequest,
  Server,
  Shield,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import heroOpsImg from '../../assets/images/hero_scribbleit_ops_1795074484892.jpg';
import featureWireframeImg from '../../assets/images/feature_wireframe_studio_1795074487495.jpg';
import featureTelephonyImg from '../../assets/images/feature_telephony_desk_1795074484589.jpg';
import datacenterRackImg from '../../assets/images/njure_datacenter_rack_1794469331556.jpg';
import securityTokenImg from '../../assets/images/njure_security_token_1794469351579.jpg';

export type PreviewModuleKey =
  | 'dashboard'
  | 'incidents'
  | 'requests'
  | 'changes'
  | 'cmdb'
  | 'iam';

interface PreviewSpec {
  id: PreviewModuleKey;
  label: string;
  route: string;
  portal: 'super_admin' | 'employee' | 'iam';
  headline: string;
  summary: string;
  image: string;
  imageAlt: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  rows: Array<{ ref: string; title: string; meta: string; status: string }>;
}

const PREVIEW_SPECS: PreviewSpec[] = [
  {
    id: 'dashboard',
    label: 'Operational Dashboard',
    route: '/watchtower',
    portal: 'super_admin',
    headline: 'Watchtower & Executive IT Operations Overview',
    summary:
      'Unified real-time command view combining active incidents, SLA compliance timers, service availability, pending CAB votes, and multi-tenant workspace health.',
    image: heroOpsImg,
    imageAlt: 'Scribble-IT operational dashboard workstation and monitoring view',
    metrics: [
      { label: 'Active Queues', value: '31 Modules', note: 'Tenant-toggleable' },
      { label: 'Portal Tiers', value: '4 Portals', note: 'Super Admin, IAM, Ops, End User' },
      { label: 'SLA Engine', value: 'P1 – P4', note: 'Live breach countdowns' },
    ],
    rows: [
      { ref: 'WATCH-01', title: 'Watchtower SLA & Queue Telemetry', meta: 'Command & Operations · Live Metrics', status: 'Available' },
      { ref: 'WAR-02', title: 'Major Incident War Room & Bridge Feed', meta: 'Cross-team triage · Checklists', status: 'Available' },
      { ref: 'STATUS-03', title: 'Public & Internal Service Status Board', meta: 'Component uptime · Advisories', status: 'Available' },
    ],
  },
  {
    id: 'incidents',
    label: 'Incident Management',
    route: '/incidents',
    portal: 'employee',
    headline: 'ITIL Incident Queue, AI Triage & Activity Streams',
    summary:
      'Log, classify, prioritize, assign, and resolve incidents with live SLA countdowns, work notes, attachments, problem linking, and optional Gemini AI triage assistance.',
    image: featureTelephonyImg,
    imageAlt: 'Service desk workstation with incident telephony and support tools',
    metrics: [
      { label: 'Intake Channels', value: 'Portal / Phone / API', note: 'Unified ticket numbers' },
      { label: 'AI Assistance', value: 'Advisory Only', note: 'Human operator applies changes' },
      { label: 'Audit Trail', value: 'Full History', note: 'Work notes & status transitions' },
    ],
    rows: [
      { ref: 'INC-1042', title: 'Core VPN Gateway Latency Across Branch Sites', meta: 'P1 · Network Ops · SLA Active', status: 'In Progress' },
      { ref: 'INC-1041', title: 'SSO Callback Timeout on Managed MacBook Fleet', meta: 'P2 · IAM Operations · Linked to PRB', status: 'Assigned' },
      { ref: 'INC-1038', title: 'ERP Invoice Print Queue Stalled in Warehouse', meta: 'P3 · Endpoint Support · Resolved', status: 'Resolved' },
    ],
  },
  {
    id: 'requests',
    label: 'Service Requests',
    route: '/requests',
    portal: 'employee',
    headline: 'Service Catalog & Multi-Stage Approval Fulfillment',
    summary:
      'Publish self-service catalog offerings with multi-stage designated approvers, fulfillment tracking, and visual pre-close process workflows.',
    image: featureWireframeImg,
    imageAlt: 'Workflow blueprint and service request fulfillment architecture',
    metrics: [
      { label: 'Catalog', value: 'Self-Service', note: 'End-User & Staff portals' },
      { label: 'Approvals', value: 'Multi-Stage', note: 'Backend-verified approvers' },
      { label: 'Workflows', value: 'Visual Mapper', note: 'Pre-close gates & automations' },
    ],
    rows: [
      { ref: 'REQ-512', title: 'Hardware Provisioning — Developer Workstation', meta: 'Stage 1 Approved · IT Fulfillment', status: 'In Fulfillment' },
      { ref: 'REQ-511', title: 'Production Read-Only Database Role Request', meta: 'Awaiting Security Approver · Audited', status: 'Pending Approval' },
      { ref: 'REQ-509', title: 'Google Workspace Shared Drive Onboarding', meta: 'Automated fulfillment checklist', status: 'Completed' },
    ],
  },
  {
    id: 'changes',
    label: 'Change Management',
    route: '/changes',
    portal: 'employee',
    headline: 'Change Advisory Board (CAB), Risk Assessment & Rollback Governance',
    summary:
      'Control Standard, Normal, and Emergency changes with mandatory implementation/rollback plans, AI advisory risk checks, and human CAB voting records.',
    image: featureWireframeImg,
    imageAlt: 'Structured change governance blueprint and engineering workflow diagram',
    metrics: [
      { label: 'CAB Governance', value: 'Human Votes Only', note: 'AI never casts CAB votes' },
      { label: 'Change Types', value: 'Standard / Normal / Emergency', note: 'Scheduled windows' },
      { label: 'Risk Review', value: 'AI Advisory + Checklist', note: 'Rollback & test verification' },
    ],
    rows: [
      { ref: 'CHG-304', title: 'PostgreSQL 16 Minor Patch & Index Maintenance', meta: 'Normal · Low Risk · 3/3 CAB Approved', status: 'Scheduled' },
      { ref: 'CHG-303', title: 'Edge Firewall TLS 1.3 Cipher Hardening', meta: 'Normal · Medium Risk · CAB Voting Open', status: 'CAB Review' },
      { ref: 'CHG-301', title: 'Zero-Downtime Ingress Certificate Rotation', meta: 'Standard · Verified Rollback Plan', status: 'Implemented' },
    ],
  },
  {
    id: 'cmdb',
    label: 'Assets & CMDB',
    route: '/assets',
    portal: 'employee',
    headline: 'Asset Lifecycle, CMDB Dependency Map & IT Inventory',
    summary:
      'Track hardware assets, stock inventory, software licenses, vendor contracts, and domain renewals with interactive CMDB dependency relationships linked to tickets.',
    image: datacenterRackImg,
    imageAlt: 'Enterprise datacenter server rack infrastructure representing CMDB assets',
    metrics: [
      { label: 'CMDB Graph', value: 'Dependency Map', note: 'Impact & root-cause visibility' },
      { label: 'Asset Tracking', value: 'Full Lifecycle', note: 'In Stock to Retired + book value' },
      { label: 'License Ops', value: 'Seat Tracking', note: 'Compliance & renewal dates' },
    ],
    rows: [
      { ref: 'CI-EDGE-01', title: 'Primary Perimeter Firewall Cluster', meta: 'Network CI · 14 Downstream Dependencies', status: 'In Use' },
      { ref: 'AST-MBP-088', title: 'Assigned Engineering Laptop Fleet', meta: 'Hardware Asset · Device Trust Linked', status: 'Assigned' },
      { ref: 'LIC-GW-250', title: 'Google Workspace Enterprise Seats', meta: 'Software License · 218 / 250 Allocated', status: 'Active' },
    ],
  },
  {
    id: 'iam',
    label: 'IAM & Governance',
    route: '/iam',
    portal: 'iam',
    headline: 'Centralized IAM, Role-Based Access, Device Trust & Immutable Audit',
    summary:
      'Manage users, organization memberships, granular RBAC scopes, single-use device enrollment codes, trusted device SSO, and append-only governance audit logs.',
    image: securityTokenImg,
    imageAlt: 'Hardware security token representing enterprise IAM and device trust',
    metrics: [
      { label: 'Isolation', value: 'PostgreSQL RLS', note: 'Transaction-local tenant scope' },
      { label: 'Auth Security', value: 'Argon2id + JWT', note: 'Refresh rotation & reuse lock' },
      { label: 'Audit Logs', value: 'Append-Only', note: 'UPDATE/DELETE revoked in DB' },
    ],
    rows: [
      { ref: 'IAM-DEV-01', title: 'Managed Device Enrollment & SSO Binding', meta: 'Single-use verification codes · Revocable', status: 'Enforced' },
      { ref: 'RBAC-POL-02', title: 'Portal Clearance & Scoped Role Matrix', meta: 'Server-computed effective permissions', status: 'Active' },
      { ref: 'AUD-LOG-03', title: 'Immutable Compliance & AI Action Audit Stream', meta: 'Actor, tenant, timestamp & request ID', status: 'Locked' },
    ],
  },
];

const MODULE_ICONS: Record<PreviewModuleKey, React.FC<{ className?: string }>> = {
  dashboard: Activity,
  incidents: AlertTriangle,
  requests: Package,
  changes: GitPullRequest,
  cmdb: Server,
  iam: Shield,
};

interface ProductPreviewShowcaseProps {
  onLaunchModule: (portal: 'super_admin' | 'employee' | 'iam', route: string) => void;
}

export const ProductPreviewShowcase: React.FC<ProductPreviewShowcaseProps> = ({
  onLaunchModule,
}) => {
  const [activeTab, setActiveTab] = useState<PreviewModuleKey>('dashboard');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const activeSpec = PREVIEW_SPECS.find(item => item.id === activeTab) || PREVIEW_SPECS[0];

  return (
    <div className="space-y-6">
      {/* Interactive Module Selector Tabs */}
      <div
        role="tablist"
        aria-label="Product Module Previews"
        className="flex items-center gap-1 p-1 border border-neutral-800 bg-neutral-900 rounded-lg overflow-x-auto no-scrollbar"
      >
        {PREVIEW_SPECS.map(spec => {
          const Icon = MODULE_ICONS[spec.id];
          const isSelected = spec.id === activeTab;
          return (
            <button
              key={spec.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(spec.id)}
              className={`px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isSelected
                  ? 'bg-rose-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{spec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Preview Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Visual Asset + Interactive Live Preview Shell */}
        <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between text-xs text-neutral-400">
            <span className="font-mono text-neutral-300">scribbleit.njuregroup.in{activeSpec.route}</span>
            <span className="text-[11px] text-neutral-400">Interactive Workspace View</span>
          </div>

          <div className="relative aspect-[16/9] w-full bg-neutral-900 overflow-hidden border-b border-neutral-800">
            {!brokenImages[activeSpec.id] ? (
              <img
                src={activeSpec.image}
                alt={activeSpec.imageAlt}
                referrerPolicy="no-referrer"
                onError={() => setBrokenImages(prev => ({ ...prev, [activeSpec.id]: true }))}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-500 p-6">
                <Activity className="w-8 h-8" />
                <span className="text-xs font-medium">{activeSpec.label}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent p-4 sm:p-5">
              <div className="text-xs text-neutral-50/80">
                {activeSpec.label} · Implemented Module
              </div>
              <div className="text-sm sm:text-base font-bold text-neutral-50 mt-0.5">
                {activeSpec.headline}
              </div>
            </div>
          </div>

          {/* Live Data Table Preview matching operational module structure */}
          <div className="p-4 sm:p-5 space-y-2.5 flex-1">
            {activeSpec.rows.map(row => (
              <div
                key={row.ref}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-neutral-800 bg-neutral-900/40 rounded text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-neutral-400 shrink-0">{row.ref}</span>
                    <span className="font-semibold text-neutral-100 truncate">{row.title}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{row.meta}</div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{row.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module Details & Direct Sandbox Action */}
        <div className="lg:col-span-5 border border-neutral-800 bg-neutral-950 rounded-lg p-6 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs text-neutral-400">
                Verified Application Module · {activeSpec.label}
              </div>
              <h3 className="text-xl font-bold text-neutral-100 leading-snug">
                {activeSpec.headline}
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {activeSpec.summary}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-neutral-800">
              {activeSpec.metrics.map(metric => (
                <div
                  key={metric.label}
                  className="flex items-baseline justify-between gap-4 py-2 border-b border-neutral-800/70 last:border-b-0"
                >
                  <div>
                    <div className="text-xs font-semibold text-neutral-200">{metric.label}</div>
                    <div className="text-[11px] text-neutral-500">{metric.note}</div>
                  </div>
                  <div className="text-sm font-bold font-mono tabular-nums text-neutral-100 whitespace-nowrap">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => onLaunchModule(activeSpec.portal, activeSpec.route)}
              className="w-full px-4 py-3 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>Open Live {activeSpec.label}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
            <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Launches the actual interactive module inside Scribble-IT 2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
