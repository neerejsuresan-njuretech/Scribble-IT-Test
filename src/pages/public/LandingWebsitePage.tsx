import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Menu,
  X,
  Github,
  Heart,
  Coffee,
  ExternalLink,
  Shield,
  Server,
  Workflow,
  Scale,
  Plug,
  AlertTriangle,
  Globe,
  Monitor,
  Smartphone,
  Laptop,
  Code2,
  Bug,
  Lightbulb,
  BookOpen,
  CheckCircle2,
  Palette,
  Languages,
  Users,
  Lock,
  FileText,
  Terminal,
  GitPullRequest,
  Building2,
  GraduationCap,
  Rocket,
  Briefcase,
  UserCheck,
  Sparkles,
  Clock,
  Layers,
} from 'lucide-react';
import { useITSM } from '../../context/ITSMContext';
import {
  PROJECT_IDENTITY,
  GITHUB_REPOSITORY_URL,
  ISSUES_URL,
  DOCUMENTATION_URL,
  NJURE_SUPPORT_PAYMENT_URL,
  BUY_ME_A_COFFEE_URL,
  GITHUB_SPONSORS_URL,
  COMMUNITY_URL,
  ROADMAP_URL,
  CHANGELOG_URL,
  isConfiguredUrl,
} from '../../config/openSourceConfig';
import { ArchitectureDiagram } from '../../components/public/ArchitectureDiagram';
import { ProductPreviewShowcase } from '../../components/public/ProductPreviewShowcase';
import heroOpsImg from '../../assets/images/hero_scribbleit_ops_1795074484892.jpg';
import njureTechLogo from '../../assets/images/njure_tech_logo.png';

type CapabilityCategoryId =
  | 'all'
  | 'itsm'
  | 'cmdb'
  | 'iam'
  | 'automation_ai'
  | 'governance'
  | 'integrations';

type CapabilityStatus = 'Available' | 'In Development' | 'Planned';

interface CapabilityGroup {
  id: Exclude<CapabilityCategoryId, 'all'>;
  title: string;
  subtitle: string;
  items: Array<{
    name: string;
    detail: string;
    status: CapabilityStatus;
  }>;
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'itsm',
    title: 'IT Service Management',
    subtitle: 'ITIL-aligned operational lifecycle for service desks and infrastructure teams.',
    items: [
      {
        name: 'Incident Management',
        detail: 'Ticket intake, categorization, P1–P4 prioritization, assignment queues, work notes, attachments, resolution, and closure.',
        status: 'Available',
      },
      {
        name: 'Service Request Management',
        detail: 'Self-service catalog items, request fulfillment, multi-stage designated approvers, and complete request history.',
        status: 'Available',
      },
      {
        name: 'Problem Management',
        detail: 'Problem records, root cause analysis (RCA), known error documentation, workarounds, and linked incident tracking.',
        status: 'Available',
      },
      {
        name: 'Change Management & CAB',
        detail: 'Standard, Normal, and Emergency changes with risk evaluation, schedules, implementation/rollback plans, and human CAB voting.',
        status: 'Available',
      },
      {
        name: 'SLA Tracking',
        detail: 'Configurable response and resolution SLA targets with live breach timers, escalation tracking, and Watchtower summaries.',
        status: 'Available',
      },
      {
        name: 'Knowledge Base',
        detail: 'Categorized knowledge articles, SOP documentation, self-service visibility controls, and incident-linked lookup.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'cmdb',
    title: 'Configuration & Asset Management',
    subtitle: 'Unified visibility across hardware, software entitlements, and service dependencies.',
    items: [
      {
        name: 'Asset Management',
        detail: 'Hardware and IT asset lifecycle management from acquisition and assignment through maintenance and retirement.',
        status: 'Available',
      },
      {
        name: 'CMDB',
        detail: 'Configuration Item (CI) registry with upstream/downstream dependency mapping tied directly to incidents and changes.',
        status: 'Available',
      },
      {
        name: 'IT Inventory',
        detail: 'Consumable stockroom levels, reorder threshold tracking, vendor assignments, and fulfillment deductions.',
        status: 'Available',
      },
      {
        name: 'Software Licenses',
        detail: 'Seat allocation tracking, license compliance visibility, renewal scheduling, and contract cost monitoring.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'iam',
    title: 'Identity & Access Management',
    subtitle: 'Backend-controlled authentication, portal clearance, and device trust governance.',
    items: [
      {
        name: 'Centralized Authentication',
        detail: 'Argon2id password hashing, short-lived JWT access tokens, hashed refresh-token rotation with reuse detection, and brute-force lockouts.',
        status: 'Available',
      },
      {
        name: 'Role-Based Access Control (RBAC)',
        detail: 'Server-computed effective permissions across Super Admin, IAM, Employee Operations, and End-User Self-Service portals.',
        status: 'Available',
      },
      {
        name: 'Device Trust & Enrollment',
        detail: 'Single-use enrollment verification codes, managed device registration, device binding, and revocable trust states.',
        status: 'Available',
      },
      {
        name: 'Session Management & MFA Foundations',
        detail: 'Active session inventory, targeted session revocation, account suspension controls, email verification, and MFA enrollment foundations.',
        status: 'Available',
      },
      {
        name: 'Trusted Device SSO',
        detail: 'Seamless portal sign-in bound to enrolled company devices with strict backend validation and policy revocation.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'automation_ai',
    title: 'Automation & AI',
    subtitle: 'Human-in-the-loop operational assistance backed by strict governance guardrails.',
    items: [
      {
        name: 'Workflow Automation',
        detail: 'Visual pre-close process mapper and multi-step workflow builder spanning ITSM queues, approval gates, and notifications.',
        status: 'Available',
      },
      {
        name: 'AI-Assisted Incident Triage',
        detail: 'Backend-proxied Gemini advisory recommendations for priority, assignment group, and SOP matching—applied only by human operators.',
        status: 'Available',
      },
      {
        name: 'AI Change Risk Insights',
        detail: 'Automated change impact and rollback review checklists that advise human reviewers without casting CAB votes.',
        status: 'Available',
      },
      {
        name: 'AI Knowledge Generation & ITSM Copilot',
        detail: 'Drafting support for knowledge articles, wiki SOPs, and operational queries with per-organization quotas and audit logs.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'governance',
    title: 'Enterprise Governance',
    subtitle: 'Multi-tenant isolation, append-only auditability, and structured approvals.',
    items: [
      {
        name: 'Multi-Organization Isolation',
        detail: 'PostgreSQL Row-Level Security (RLS) with transaction-local tenant scoping and per-organization module toggles.',
        status: 'Available',
      },
      {
        name: 'Approval Workflows',
        detail: 'Centralized approval requests for service fulfillment, access grants, and governance actions with verified human sign-off.',
        status: 'Available',
      },
      {
        name: 'Audit Logs',
        detail: 'Append-only security, governance, integration, and AI audit records with database-level UPDATE/DELETE revocation.',
        status: 'Available',
      },
      {
        name: 'Reporting & Analytics',
        detail: 'SLA performance summaries, ticket aging analytics, operational Watchtower metrics, and exportable compliance views.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'External Integrations',
    subtitle: 'Encrypted backend adapters with SSRF protection, retries, and webhook verification.',
    items: [
      {
        name: 'Google Workspace (Drive, Sheets, Forms, Chat)',
        detail: 'Backend-managed Workspace integration adapters with encrypted credential storage and organization-level permissions.',
        status: 'Available',
      },
      {
        name: 'Telephony & Twilio',
        detail: 'Twilio Programmable Voice bridge, personal mobile CTI softphone, call logging, and 1-click incident screen-pop.',
        status: 'Available',
      },
      {
        name: 'Webhooks & Notification Providers',
        detail: 'Signed HMAC-SHA256 webhooks with replay-window protection, SSRF egress blocking, and exponential-backoff background workers.',
        status: 'Available',
      },
      {
        name: 'Plugin & Extension SDK',
        detail: 'Standardized third-party extension hooks and community add-on packaging for custom enterprise workflows.',
        status: 'Planned',
      },
    ],
  },
];

const ECOSYSTEM_PLATFORMS = [
  {
    name: 'Web Application',
    platforms: 'Modern Desktop & Mobile Browsers',
    status: 'Available' as const,
    icon: Globe,
    summary:
      'Full-featured React 19 + TypeScript workspace across Super Admin, IAM, Employee Operations, and End-User portals—ready for cloud or self-hosted deployment.',
  },
  {
    name: 'Desktop Applications',
    platforms: 'Windows · macOS · Linux',
    status: 'Coming Soon' as const,
    icon: Monitor,
    summary:
      'Native desktop client architecture audited for Tauri v2 with OS keychain token storage, desktop notifications, and shared TypeScript packages. Installers will be published when built.',
  },
  {
    name: 'Mobile Applications',
    platforms: 'Android · iOS',
    status: 'Coming Soon' as const,
    icon: Smartphone,
    summary:
      'Cross-platform mobile architecture audited for React Native (Expo CNG) with biometric secure storage and incident approvals. Store builds will be published under our AGPL-3.0 Section 7 exception.',
  },
];

interface RoadmapMilestone {
  phase: string;
  title: string;
  status: 'Completed' | 'In Progress' | 'Planned' | 'Coming Soon';
  summary: string;
}

const ROADMAP_MILESTONES: RoadmapMilestone[] = [
  {
    phase: '01',
    title: 'Core Enterprise ITSM Platform',
    status: 'Completed',
    summary: 'Incidents, Service Requests, Problems, Changes & CAB, SLAs, Assets, CMDB, Inventory, Software Licenses, Knowledge Base, and Workflow Mapper.',
  },
  {
    phase: '02',
    title: 'Enterprise IAM & RBAC Architecture',
    status: 'Completed',
    summary: 'Argon2id auth, JWT access/refresh rotation, reuse detection, 4-portal RBAC clearance, device enrollment, trusted device SSO, and immutable audit logs.',
  },
  {
    phase: '03',
    title: 'Backend Migration to FastAPI & PostgreSQL',
    status: 'Completed',
    summary: 'FastAPI REST /api/v1 backend, 50 SQLAlchemy 2.x models, Alembic migrations, PostgreSQL 16 Row-Level Security, and Firebase-to-PostgreSQL migrator.',
  },
  {
    phase: '04',
    title: 'AI-Assisted ITSM Operations',
    status: 'Completed',
    summary: 'Backend-only Gemini advisory services for incident triage, change risk review, KB drafting, and ITSM Copilot with strict human approval boundaries.',
  },
  {
    phase: '05',
    title: 'External Integrations & Automation',
    status: 'Completed',
    summary: 'Encrypted Google Workspace & Twilio adapters, HMAC-verified webhooks, SSRF egress protection, and Redis-backed async retry workers.',
  },
  {
    phase: '06',
    title: 'Self-Hosted Enterprise Deployment',
    status: 'In Progress',
    summary: 'Docker Compose production hardening, Nginx reverse proxy bundles, automated GitHub Actions CI, and streamlined operator deployment guides.',
  },
  {
    phase: '07',
    title: 'Community Ecosystem & Documentation',
    status: 'In Progress',
    summary: 'Expanded contributor handbooks, API references, public architecture docs, and structured GitHub issue templates for community collaboration.',
  },
  {
    phase: '08',
    title: 'Desktop Applications (Windows, macOS, Linux)',
    status: 'Coming Soon',
    summary: 'Native desktop clients sharing core TypeScript API/auth packages with OS-level secure credential storage and signed release pipelines.',
  },
  {
    phase: '09',
    title: 'Mobile Applications (Android, iOS)',
    status: 'Coming Soon',
    summary: 'Dedicated mobile apps for on-call incident response, CAB approvals, self-service tickets, and push alerts distributed with AGPL-3.0 Section 7 clarity.',
  },
  {
    phase: '10',
    title: 'Plugin & Extension Ecosystem',
    status: 'Planned',
    summary: 'Community-contributed workflow templates, custom integration modules, localization packs, and documented extension interfaces.',
  },
];

const CONTRIBUTION_PATHS = [
  {
    icon: Code2,
    title: 'Code Contributions',
    detail: 'Build frontend components, FastAPI endpoints, database migrations, or integration adapters via pull requests.',
  },
  {
    icon: Bug,
    title: 'Bug Reports',
    detail: 'Report reproducible issues with environment details, logs, and expected behavior in the GitHub issue tracker.',
  },
  {
    icon: Lightbulb,
    title: 'Feature Requests',
    detail: 'Propose new ITIL capabilities, compliance workflows, or enterprise integrations backed by real operational use cases.',
  },
  {
    icon: BookOpen,
    title: 'Documentation Improvements',
    detail: 'Strengthen deployment runbooks, API examples, architecture guides, and onboarding tutorials.',
  },
  {
    icon: CheckCircle2,
    title: 'Testing & QA',
    detail: 'Expand pytest backend coverage, RBAC verification cases, and cross-browser accessibility validation.',
  },
  {
    icon: Palette,
    title: 'UI/UX Design Improvements',
    detail: 'Refine information density, keyboard navigation, contrast parity, and responsive service-desk ergonomics.',
  },
  {
    icon: Languages,
    title: 'Translations',
    detail: 'Help prepare multi-language labels and regional operational copy for global IT teams.',
  },
  {
    icon: Users,
    title: 'Community Support',
    detail: 'Answer deployment questions, share self-hosting configurations, and help new administrators get started.',
  },
  {
    icon: Lock,
    title: 'Security Reporting',
    detail: 'Responsibly disclose vulnerabilities in authentication, tenant isolation, or API security following our security specification.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Is Scribble-IT really free?',
    answer:
      'Yes. SCRIBBLE-IT is free and open-source software licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only) with a Section 7 App Store Distribution Exception. There are no per-seat license fees, artificial feature locks, or mandatory subscriptions.',
  },
  {
    question: 'Can organizations self-host Scribble-IT?',
    answer:
      'Yes. You can deploy the full stack—React web application, FastAPI backend, PostgreSQL 16 database with Row-Level Security, Redis 7, and background workers—on your own servers or private cloud using Docker Compose and the deployment guides in docs/deployment/.',
  },
  {
    question: 'Is Scribble-IT open source?',
    answer:
      'Yes. The complete source code is publicly available on GitHub under AGPL-3.0-only (see LICENSE) alongside our Section 7 App Store Distribution Exception (see LICENSE-EXCEPTION.md). Anyone can inspect, audit, modify, and contribute improvements.',
  },
  {
    question: 'How does Scribble-IT sustain development?',
    answer:
      'Development is led by Njure Tech (formally Njure Group) and supported by voluntary community sponsorships, individual donations, and open-source engineering contributions. Support is strictly voluntary and never gates platform capabilities.',
  },
  {
    question: 'Are desktop and mobile apps available?',
    answer:
      'Not yet—the Web Application is available today, while native Desktop (Windows, macOS, Linux) and Mobile (Android, iOS) applications are currently in the architectural planning stage and marked Coming Soon. No installers are published yet.',
  },
  {
    question: 'How does AI work in Scribble-IT?',
    answer:
      'AI capabilities (incident triage, change risk insights, knowledge article drafting, and ITSM Copilot) run strictly through authenticated FastAPI backend services using backend-only Gemini API keys, organization quotas, and audit logging. AI is strictly advisory—it never approves requests, casts CAB votes, alters IAM permissions, or executes Super Admin actions.',
  },
  {
    question: 'How is data security handled?',
    answer:
      'SCRIBBLE-IT enforces Argon2id password hashing, short-lived JWT access tokens, hashed refresh-token rotation with reuse detection, server-computed RBAC, PostgreSQL Row-Level Security (RLS) tenant isolation, append-only audit logs, encrypted integration credentials, HMAC webhook verification, and SSRF egress protection.',
  },
  {
    question: 'Can I contribute to the project?',
    answer:
      'Absolutely. Developers, IT operators, designers, testers, and technical writers are welcome to contribute via GitHub pull requests, bug reports, documentation updates, and architecture discussions. Review CONTRIBUTING.md in the repository for workflow standards.',
  },
  {
    question: 'Can businesses use Scribble-IT in production?',
    answer:
      'Yes. Businesses, startups, educational institutions, and IT departments may deploy SCRIBBLE-IT in production in accordance with AGPL-3.0-only terms (including making Corresponding Source available to network users if modified). Follow docs/deployment/production-cloud-guide.md or docs/deployment/self-hosted-guide.md to configure production secrets, TLS, and backups.',
  },
];

const AUDIENCES = [
  {
    icon: Rocket,
    title: 'Startups & Growing Teams',
    detail: 'Adopt structured incident, request, and asset operations from day one without enterprise licensing overhead.',
  },
  {
    icon: GraduationCap,
    title: 'Educational Institutions',
    detail: 'Equip campus IT departments and labs with self-hosted service desks, inventory control, and RBAC portals.',
  },
  {
    icon: Building2,
    title: 'Enterprises',
    detail: 'Run multi-organization ITSM with PostgreSQL Row-Level Security, CAB governance, device trust, and full source auditability.',
  },
  {
    icon: Briefcase,
    title: 'IT Operations Teams',
    detail: 'Unify Watchtower monitoring, SLA enforcement, CMDB impact mapping, workflows, and telephony in one workspace.',
  },
  {
    icon: UserCheck,
    title: 'Independent IT Professionals',
    detail: 'Manage client infrastructure, knowledge bases, and service delivery using transparent, portable open-source tooling.',
  },
];

function getStatusColorClass(status: string): string {
  switch (status) {
    case 'Available':
    case 'Completed':
      return 'text-emerald-400';
    case 'In Development':
    case 'In Progress':
      return 'text-amber-400';
    case 'Coming Soon':
      return 'text-sky-400';
    default:
      return 'text-neutral-400';
  }
}

export const LandingWebsitePage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsTestAccount, theme, toggleTheme } = useITSM();
  const [activeCategory, setActiveCategory] = useState<CapabilityCategoryId>('all');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImageBroken, setHeroImageBroken] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const currentYear = new Date().getFullYear();

  const visibleCapabilities = useMemo(() => {
    if (activeCategory === 'all') return CAPABILITY_GROUPS;
    return CAPABILITY_GROUPS.filter(group => group.id === activeCategory);
  }, [activeCategory]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLaunchDemo = (
    portalType: 'super_admin' | 'employee' | 'iam' | 'end_user' = 'super_admin',
    destination = '/watchtower'
  ) => {
    loginAsTestAccount(portalType);
    navigate(destination);
  };

  const docsResources = [
    {
      title: 'Documentation',
      description: 'Project overview, setup instructions, and platform operational guides.',
      href: DOCUMENTATION_URL,
      configured: isConfiguredUrl(DOCUMENTATION_URL),
      external: true,
    },
    {
      title: 'Installation Guide',
      description: 'Self-hosted Docker Compose and production cloud deployment runbooks.',
      href: `${GITHUB_REPOSITORY_URL}/blob/main/docs/deployment/self-hosted-guide.md`,
      configured: isConfiguredUrl(GITHUB_REPOSITORY_URL),
      external: true,
    },
    {
      title: 'API Documentation',
      description: 'FastAPI /api/v1 endpoints, authentication flows, and error contracts.',
      href: `${GITHUB_REPOSITORY_URL}/blob/main/docs/api/api-v1-reference.md`,
      configured: isConfiguredUrl(GITHUB_REPOSITORY_URL),
      external: true,
    },
    {
      title: 'GitHub Repository',
      description: 'Full source code, issue tracking, pull requests, and CI workflows.',
      href: GITHUB_REPOSITORY_URL,
      configured: isConfiguredUrl(GITHUB_REPOSITORY_URL),
      external: true,
    },
    {
      title: 'Contributing Guide',
      description: 'Branch conventions, testing checks, and open-source collaboration standards.',
      href: `${GITHUB_REPOSITORY_URL}/blob/main/CONTRIBUTING.md`,
      configured: isConfiguredUrl(GITHUB_REPOSITORY_URL),
      external: true,
    },
    {
      title: 'Security Policy',
      description: 'Security architecture specification, threat boundaries, and reporting guidance.',
      href: `${GITHUB_REPOSITORY_URL}/blob/main/security_spec.md`,
      configured: isConfiguredUrl(GITHUB_REPOSITORY_URL),
      external: true,
    },
    {
      title: 'Changelog',
      description: 'Release notes and version milestones once published to a dedicated changelog URL.',
      href: CHANGELOG_URL,
      configured: isConfiguredUrl(CHANGELOG_URL),
      external: true,
      placeholderVar: 'CHANGELOG_URL',
    },
    {
      title: 'Roadmap',
      description: 'Public milestone tracker and cross-platform delivery stages.',
      href: isConfiguredUrl(ROADMAP_URL) ? ROADMAP_URL : '#roadmap',
      configured: true,
      external: isConfiguredUrl(ROADMAP_URL),
      sectionTarget: isConfiguredUrl(ROADMAP_URL) ? undefined : 'roadmap',
    },
    {
      title: 'Community',
      description: 'Community discussions and support channels (configure COMMUNITY_URL when live).',
      href: COMMUNITY_URL,
      configured: isConfiguredUrl(COMMUNITY_URL),
      external: true,
      placeholderVar: 'COMMUNITY_URL',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-sans selection:bg-rose-600 selection:text-white flex flex-col overflow-x-clip">
      {/* ===================================================================== */}
      {/* TOP BAR — STRICT 3-ZONE CONTRACT                                      */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 h-16 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Identity */}
          <button
            type="button"
            onClick={() => scrollToSection('overview')}
            className="inline-flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-neutral-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-sm"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 shrink-0" aria-hidden="true" />
            <span>{PROJECT_IDENTITY.productName}</span>
          </button>

          {/* Zone 2: Primary Single-Line Navigation (5 links) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-neutral-400"
          >
            {[
              { id: 'about', label: 'About' },
              { id: 'features', label: 'Capabilities' },
              { id: 'architecture', label: 'Architecture' },
              { id: 'opensource', label: 'Open Source' },
              { id: 'roadmap', label: 'Roadmap' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
              className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Explore Platform</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden min-h-[40px] min-w-[40px] border border-neutral-800 bg-neutral-900 text-neutral-200 rounded-md flex items-center justify-center shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-neutral-800 bg-neutral-950 px-4 py-4 space-y-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'about', label: 'About Scribble-IT' },
              { id: 'features', label: 'Platform Capabilities' },
              { id: 'ecosystem', label: 'Cross-Platform Ecosystem' },
              { id: 'architecture', label: 'Technology & Architecture' },
              { id: 'opensource', label: 'Open-Source Commitment' },
              { id: 'sponsor', label: 'Support & Sponsorship' },
              { id: 'roadmap', label: 'Roadmap' },
              { id: 'faq', label: 'FAQ' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left px-3 py-2.5 min-h-[40px] text-sm font-medium text-neutral-200 hover:bg-neutral-900 rounded-md block"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-3 mt-2 border-t border-neutral-800 flex items-center justify-between gap-3">
              <a
                href={GITHUB_REPOSITORY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-300"
              >
                <Github className="w-4 h-4" />
                <span>View GitHub</span>
              </a>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-800 bg-neutral-900 text-neutral-200 text-xs font-medium rounded-md"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* =================================================================== */}
        {/* A. HERO SECTION                                                     */}
        {/* =================================================================== */}
        <section id="overview" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-16 sm:pb-20 space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
              <div className="font-mono tracking-wide">
                {PROJECT_IDENTITY.productName} · Open-Source Enterprise ITSM · AGPL-3.0-only
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-neutral-300 hover:text-neutral-100 font-medium transition-colors"
                >
                  Sign In
                </Link>
                <span aria-hidden="true" className="text-neutral-600">·</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 font-medium transition-colors"
                  aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-7 space-y-6">
                <h1
                  className="font-bold text-neutral-100 tracking-tight leading-[1.06]"
                  style={{ fontSize: 'clamp(2.25rem, 4.8vw, 3.85rem)', textWrap: 'balance' }}
                >
                  {PROJECT_IDENTITY.tagline}
                </h1>

                <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
                  <strong className="text-neutral-200 font-semibold">{PROJECT_IDENTITY.productName}</strong> is an open-source, community-driven Enterprise IT Service Management platform built by{' '}
                  <strong className="text-neutral-200 font-semibold">{PROJECT_IDENTITY.organizationFull}</strong>—uniting incident response, service requests, CAB change governance, CMDB, centralized IAM, workflow automation, and human-supervised AI assistance in one self-hostable system.
                </p>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                    className="px-5 py-3 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>Explore Platform</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>

                  <a
                    href={GITHUB_REPOSITORY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 min-h-[44px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Github className="w-4 h-4 shrink-0" />
                    <span>View GitHub</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => scrollToSection('sponsor')}
                    className="px-5 py-3 min-h-[44px] border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-200 text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Support the Project</span>
                  </button>
                </div>

                {/* Concise Key Facts Row (Zero-Pill Typography) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-neutral-800">
                  {[
                    { value: '100% Free', label: 'Open-Source AGPL-3.0' },
                    { value: '4 Portals', label: 'Admin, IAM, Ops & User' },
                    { value: 'RLS Isolated', label: 'PostgreSQL 16 + FastAPI' },
                    { value: 'Self-Hostable', label: 'Docker & Cloud Ready' },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div className="text-base sm:text-lg font-bold text-neutral-100 font-mono tabular-nums">
                        {stat.value}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actual Application Dashboard Preview Card */}
              <div className="lg:col-span-5 border border-neutral-800 bg-neutral-900/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono text-neutral-200">scribbleit.njuregroup.in/watchtower</span>
                  <span>Live Workspace Preview</span>
                </div>

                <div className="relative aspect-[16/10] w-full bg-neutral-900 overflow-hidden border-b border-neutral-800">
                  {!heroImageBroken ? (
                    <img
                      src={heroOpsImg}
                      alt="SCRIBBLE-IT operational dashboard and enterprise service management interface"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImageBroken(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500 p-6">
                      SCRIBBLE-IT Operational Workspace
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4">
                    <div className="text-xs text-neutral-50/80">
                      Unified Operations Console · Implemented
                    </div>
                    <div className="text-sm font-bold text-neutral-50 mt-0.5">
                      Launch any of the 4 operational portals directly
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Super Admin', route: '/watchtower', portal: 'super_admin' as const, sub: 'Watchtower & Governance' },
                      { label: 'Employee Ops', route: '/incidents', portal: 'employee' as const, sub: 'Incidents, CAB & CMDB' },
                      { label: 'IAM Portal', route: '/iam', portal: 'iam' as const, sub: 'RBAC & Device Trust' },
                      { label: 'End-User Portal', route: '/portal', portal: 'end_user' as const, sub: 'Self-Service Catalog' },
                    ].map(portal => (
                      <button
                        key={portal.label}
                        type="button"
                        onClick={() => handleLaunchDemo(portal.portal, portal.route)}
                        className="text-left p-3 border border-neutral-800 bg-neutral-950 hover:border-rose-500/60 hover:bg-neutral-900 rounded-md transition-colors group"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-100 group-hover:text-rose-400">
                          <span>{portal.label}</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{portal.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* B. ABOUT SCRIBBLE-IT                                                */}
        {/* =================================================================== */}
        <section id="about" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  About SCRIBBLE-IT
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-bold text-neutral-100 leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Enterprise ITSM built for operational rigor, without proprietary lock-in.
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Created by <strong className="text-neutral-200">{PROJECT_IDENTITY.organizationFull}</strong>, SCRIBBLE-IT was engineered to solve a persistent industry problem: enterprise-grade IT Service Management software is routinely locked behind costly per-agent contracts, opaque closed-source stacks, and fragmented point tools.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    title: 'What It Is',
                    body: 'A unified open-source ITSM, CMDB, asset, identity, and governance platform combining a modern React workspace with a hardened FastAPI + PostgreSQL backend.',
                  },
                  {
                    title: 'Problems It Solves',
                    body: 'Eliminates disconnected ticketing tools, unverified manual approvals, shadow asset spreadsheets, and prohibitive enterprise licensing fees.',
                  },
                  {
                    title: 'Open-Source Philosophy',
                    body: 'Every capability is transparent, inspectable, self-hostable, and licensed under AGPL-3.0-only so organizations retain full sovereignty over their operational data.',
                  },
                  {
                    title: 'Human-Supervised Governance',
                    body: 'Built-in separation of duties, append-only audit logs, backend RBAC, and advisory-only AI ensure humans remain accountable for sensitive decisions.',
                  },
                ].map(card => (
                  <div
                    key={card.title}
                    className="p-5 border border-neutral-800 bg-neutral-900/40 rounded-lg space-y-2"
                  >
                    <h3 className="text-sm font-bold text-neutral-100">{card.title}</h3>
                    <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Who It Is Built For */}
            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <h3 className="text-base font-bold text-neutral-100">Who SCRIBBLE-IT Is Built For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {AUDIENCES.map(audience => {
                  const Icon = audience.icon;
                  return (
                    <div
                      key={audience.title}
                      className="p-4 border border-neutral-800 bg-neutral-950 rounded-lg space-y-2.5"
                    >
                      <Icon className="w-4 h-4 text-rose-400" />
                      <div className="text-sm font-semibold text-neutral-100">{audience.title}</div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{audience.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* C. PLATFORM CAPABILITIES                                            */}
        {/* =================================================================== */}
        <section id="features" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  Platform Capabilities
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                  Six unified operational domains in one architecture
                </h2>
                <p className="text-sm text-neutral-400">
                  Every listed module reflects verified repository implementations, clearly distinguishing capabilities available today from planned extensions.
                </p>
              </div>
              <div className="text-xs font-mono text-neutral-400">
                Status Key: <span className="text-emerald-400">Available</span> · <span className="text-amber-400">In Development</span> · <span className="text-neutral-300">Planned</span>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div
              role="tablist"
              aria-label="Filter platform capabilities"
              className="flex items-center gap-1 p-1 border border-neutral-800 bg-neutral-900 rounded-lg overflow-x-auto no-scrollbar"
            >
              {[
                { id: 'all' as const, label: 'All Capabilities' },
                { id: 'itsm' as const, label: 'IT Service Management' },
                { id: 'cmdb' as const, label: 'Assets & CMDB' },
                { id: 'iam' as const, label: 'Identity & Access' },
                { id: 'automation_ai' as const, label: 'Automation & AI' },
                { id: 'governance' as const, label: 'Governance' },
                { id: 'integrations' as const, label: 'Integrations' },
              ].map(tab => {
                const selected = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveCategory(tab.id)}
                    className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-rose-600 text-white'
                        : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Capability Category Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {visibleCapabilities.map(group => {
                const CategoryIcon =
                  group.id === 'itsm'
                    ? AlertTriangle
                    : group.id === 'cmdb'
                    ? Server
                    : group.id === 'iam'
                    ? Shield
                    : group.id === 'automation_ai'
                    ? Workflow
                    : group.id === 'governance'
                    ? Scale
                    : Plug;

                return (
                  <div
                    key={group.id}
                    className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-5"
                  >
                    <div className="flex items-start gap-3 pb-4 border-b border-neutral-800">
                      <CategoryIcon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-base font-bold text-neutral-100">{group.title}</h3>
                        <p className="text-xs text-neutral-400 mt-1">{group.subtitle}</p>
                      </div>
                    </div>

                    <ul className="space-y-3.5">
                      {group.items.map(item => (
                        <li
                          key={item.name}
                          className="pb-3.5 border-b border-neutral-800/70 last:border-b-0 last:pb-0 space-y-1"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-neutral-100">
                              {item.name}
                            </span>
                            <span
                              className={`text-xs font-mono shrink-0 ${getStatusColorClass(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 leading-relaxed">{item.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* D. CROSS-PLATFORM ECOSYSTEM                                         */}
        {/* =================================================================== */}
        <section id="ecosystem" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Cross-Platform Ecosystem
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                Available on the Web today. Expanding to native Desktop and Mobile.
              </h2>
              <p className="text-sm text-neutral-400">
                The web platform is production-ready today. Native desktop and mobile clients are planned on the shared TypeScript and FastAPI architecture—no unverified binaries or placeholder installers are listed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ECOSYSTEM_PLATFORMS.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Icon className="w-5 h-5 text-rose-400 shrink-0" />
                        <span className={`text-xs font-mono ${getStatusColorClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-neutral-100">{item.name}</h3>
                        <div className="text-xs font-mono text-neutral-400 mt-1">
                          {item.platforms}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-neutral-800">
                      {item.status === 'Available' ? (
                        <button
                          type="button"
                          onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>Launch Web Application</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>In roadmap — track updates on GitHub</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* E. TECHNOLOGY & ARCHITECTURE                                        */}
        {/* =================================================================== */}
        <section id="architecture" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Technology &amp; Architecture
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                Modern, auditable, enterprise-ready stack
              </h2>
              <p className="text-sm text-neutral-400">
                Engineered for clear separation of concerns, strict database-level tenant isolation, and portable deployment across cloud and on-premise environments.
              </p>
            </div>

            <ArchitectureDiagram />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Laptop,
                  title: 'Frontend Architecture',
                  stack: [
                    { name: 'React 19 + TypeScript', state: 'Implemented' },
                    { name: 'Vite 8 Build Pipeline', state: 'Implemented' },
                    { name: 'Tailwind CSS v4 Design System', state: 'Implemented' },
                    { name: 'React Router v7 Multi-Portal Routing', state: 'Implemented' },
                    { name: 'Shared Desktop/Mobile Core Packages', state: 'Planned' },
                  ],
                },
                {
                  icon: Server,
                  title: 'Backend Architecture',
                  stack: [
                    { name: 'Python + FastAPI (/api/v1)', state: 'Implemented' },
                    { name: 'PostgreSQL 16 + Row-Level Security', state: 'Implemented' },
                    { name: 'SQLAlchemy 2.x Async + Alembic', state: 'Implemented' },
                    { name: 'Redis 7 Cache & Sliding Rate Limits', state: 'Implemented' },
                    { name: 'Argon2id + PyJWT + Fernet Encryption', state: 'Implemented' },
                  ],
                },
                {
                  icon: Layers,
                  title: 'Infrastructure & Delivery',
                  stack: [
                    { name: 'Docker & Docker Compose', state: 'Implemented' },
                    { name: 'Nginx Reverse Proxy + SPA Bundle', state: 'Implemented' },
                    { name: 'Async Background Workers & Retries', state: 'Implemented' },
                    { name: 'GitHub Actions CI/CD Workflows', state: 'Implemented' },
                    { name: 'Native Store Release Pipelines', state: 'Planned' },
                  ],
                },
              ].map(column => {
                const Icon = column.icon;
                return (
                  <div
                    key={column.title}
                    className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4"
                  >
                    <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
                      <Icon className="w-4 h-4 text-rose-400 shrink-0" />
                      <h3 className="text-sm font-bold text-neutral-100">{column.title}</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {column.stack.map(entry => (
                        <li
                          key={entry.name}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-neutral-200 font-medium">{entry.name}</span>
                          <span
                            className={`font-mono shrink-0 ${
                              entry.state === 'Implemented' ? 'text-emerald-400' : 'text-neutral-400'
                            }`}
                          >
                            {entry.state}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* F. FREE & OPEN-SOURCE COMMITMENT                                    */}
        {/* =================================================================== */}
        <section id="opensource" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  Free &amp; Open-Source Commitment
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  POWERFUL ITSM. WITHOUT THE PRICE TAG.
                </h2>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                  SCRIBBLE-IT is built on the conviction that reliable enterprise IT operations should not be restricted to organizations with six-figure software budgets. Every core capability—from incident queues and CAB governance to PostgreSQL tenant isolation—is free, open-source, and self-hostable.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {[
                    '100% Free to Use & Self-Host',
                    'Transparent Open-Source Codebase',
                    'No Mandatory Per-Agent Fees',
                    'Community-Driven Improvements',
                  ].map(point => (
                    <div
                      key={point}
                      className="flex items-center gap-2 text-xs sm:text-sm text-neutral-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                  <div className="text-sm font-bold text-neutral-100">Verified Repository Licensing</div>
                  <span className="text-xs font-mono text-emerald-400">
                    {PROJECT_IDENTITY.licenseSpdx}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  SCRIBBLE-IT is licensed under the{' '}
                  <strong className="text-neutral-200">
                    GNU Affero General Public License v3.0 (AGPL-3.0-only)
                  </strong>{' '}
                  accompanied by an official{' '}
                  <strong className="text-neutral-200">
                    Section 7 App Store Distribution Exception
                  </strong>{' '}
                  (documented in <code className="text-neutral-200">LICENSE</code> and{' '}
                  <code className="text-neutral-200">LICENSE-EXCEPTION.md</code>).
                </p>
                <ul className="space-y-2 text-xs text-neutral-400">
                  <li>
                    · <strong className="text-neutral-200">Network Copyleft Protection:</strong> Modifications deployed as a hosted service remain open to users under AGPL-3.0.
                  </li>
                  <li>
                    · <strong className="text-neutral-200">App Store Distribution Clarity:</strong> Permits distribution on Apple App Store, Mac App Store, Google Play, and Microsoft Store while requiring free Corresponding Source availability.
                  </li>
                  <li>
                    · <strong className="text-neutral-200">Trademark Boundaries:</strong> License permissions cover source code copyright only and do not grant trademark rights to Njure Tech, Njure Group, or Scribble-IT branding.
                  </li>
                </ul>
                <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold">
                  <a
                    href={`${GITHUB_REPOSITORY_URL}/blob/main/LICENSE`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                  >
                    <span>Read LICENSE (AGPL-3.0)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`${GITHUB_REPOSITORY_URL}/blob/main/LICENSE-EXCEPTION.md`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                  >
                    <span>Read Section 7 Exception</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* G. SUPPORT & SPONSORSHIP                                            */}
        {/* =================================================================== */}
        <section id="sponsor" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Voluntary Support &amp; Sponsorship
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                HELP US BUILD THE FUTURE OF OPEN-SOURCE ITSM.
              </h2>
              <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                SCRIBBLE-IT is free for everyone and never places core features behind a paywall. Voluntary contributions directly support active engineering, documentation, security maintenance, infrastructure testing, and upcoming cross-platform apps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Direct Voluntary Support (Configured) */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <Heart className="w-5 h-5 text-rose-500" />
                  <h3 className="text-base font-bold text-neutral-100">Support Njure Tech Directly</h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    Make a voluntary one-time contribution via the verified Njure Tech payment link to fund hosting, testing, and ongoing releases.
                  </p>
                </div>
                {isConfiguredUrl(NJURE_SUPPORT_PAYMENT_URL) ? (
                  <a
                    href={NJURE_SUPPORT_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 min-h-[42px] bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Support via Payment Link</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <div className="text-xs text-neutral-500 font-mono">
                    Configure VITE_SUPPORT_PAYMENT_URL to enable
                  </div>
                )}
              </div>

              {/* GitHub Sponsors (Configurable Placeholder) */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <Github className="w-5 h-5 text-neutral-200" />
                  <h3 className="text-base font-bold text-neutral-100">Sponsor on GitHub</h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    Recurring community and organizational sponsorship through GitHub Sponsors once the official sponsor profile is activated.
                  </p>
                </div>
                {isConfiguredUrl(GITHUB_SPONSORS_URL) ? (
                  <a
                    href={GITHUB_SPONSORS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 min-h-[42px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-xs sm:text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Sponsor on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <div className="pt-3 border-t border-neutral-800 text-xs text-neutral-400">
                    Placeholder pending activation (<code className="text-neutral-300">GITHUB_SPONSORS_URL</code>)
                  </div>
                )}
              </div>

              {/* Buy Me a Coffee (Configurable Placeholder) */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <Coffee className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-neutral-100">Buy Me a Coffee</h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    Quick voluntary supporter contributions once the official Buy Me a Coffee profile is published and configured.
                  </p>
                </div>
                {isConfiguredUrl(BUY_ME_A_COFFEE_URL) ? (
                  <a
                    href={BUY_ME_A_COFFEE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 min-h-[42px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-xs sm:text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Buy Me a Coffee</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <div className="pt-3 border-t border-neutral-800 text-xs text-neutral-400">
                    Placeholder pending activation (<code className="text-neutral-300">BUY_ME_A_COFFEE_URL</code>)
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                You can also support the project at zero cost by starring the GitHub repository, sharing feedback, or contributing code and documentation.
              </span>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* H. COMMUNITY & CONTRIBUTIONS                                        */}
        {/* =================================================================== */}
        <section id="community" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  Community &amp; Contributions
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  BUILT WITH THE COMMUNITY. IMPROVED BY THE COMMUNITY.
                </h2>
                <p className="text-sm text-neutral-400">
                  Every discipline makes enterprise ITSM stronger—from Python and React engineers to ITIL administrators, QA testers, designers, and technical writers.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <a
                  href={`${GITHUB_REPOSITORY_URL}/blob/main/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 min-h-[40px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Contributing Guide</span>
                </a>
                <a
                  href={ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 min-h-[40px] border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-200 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2"
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>Open an Issue</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CONTRIBUTION_PATHS.map(path => {
                const Icon = path.icon;
                return (
                  <div
                    key={path.title}
                    className="border border-neutral-800 bg-neutral-950 rounded-lg p-5 space-y-2.5"
                  >
                    <Icon className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-neutral-100">{path.title}</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">{path.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* I. PROJECT ROADMAP                                                  */}
        {/* =================================================================== */}
        <section id="roadmap" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  Project Roadmap
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                  Transparent engineering milestones
                </h2>
                <p className="text-sm text-neutral-400">
                  Clear visibility into what is completed in the repository, what is actively being refined, and what comes next.
                </p>
              </div>
              <div className="text-xs font-mono text-neutral-400">
                <span className="text-emerald-400">Completed</span> · <span className="text-amber-400">In Progress</span> · <span className="text-sky-400">Coming Soon</span> · <span>Planned</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROADMAP_MILESTONES.map(milestone => (
                <div
                  key={milestone.phase}
                  className="border border-neutral-800 bg-neutral-950 rounded-lg p-5 flex items-start gap-4"
                >
                  <div className="text-xs font-mono tabular-nums text-neutral-500 pt-0.5 shrink-0">
                    {milestone.phase}
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-neutral-100">{milestone.title}</h3>
                      <span
                        className={`text-xs font-mono shrink-0 ${getStatusColorClass(milestone.status)}`}
                      >
                        {milestone.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{milestone.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* J. PRODUCT SCREENSHOTS & INTERACTIVE MODULE PREVIEWS                */}
        {/* =================================================================== */}
        <section id="screenshots" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Product Previews
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                Inspect core operational workspaces before launching
              </h2>
              <p className="text-sm text-neutral-400">
                Browse each verified module below and launch directly into the live SCRIBBLE-IT application workspace.
              </p>
            </div>

            <ProductPreviewShowcase onLaunchModule={handleLaunchDemo} />
          </div>
        </section>

        {/* =================================================================== */}
        {/* K. DOCUMENTATION & RESOURCES                                        */}
        {/* =================================================================== */}
        <section id="resources" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Documentation &amp; Resources
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                Everything needed to deploy, integrate, and contribute
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsResources.map(resource => {
                if (resource.sectionTarget) {
                  return (
                    <button
                      key={resource.title}
                      type="button"
                      onClick={() => scrollToSection(resource.sectionTarget!)}
                      className="text-left border border-neutral-800 bg-neutral-950 hover:border-neutral-600 rounded-lg p-5 space-y-2 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-neutral-100 group-hover:text-rose-400 transition-colors">
                          {resource.title}
                        </span>
                        <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-rose-400 shrink-0" />
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{resource.description}</p>
                    </button>
                  );
                }

                if (resource.configured) {
                  return (
                    <a
                      key={resource.title}
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-neutral-800 bg-neutral-950 hover:border-neutral-600 rounded-lg p-5 space-y-2 transition-colors group block"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-neutral-100 group-hover:text-rose-400 transition-colors">
                          {resource.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-rose-400 shrink-0" />
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{resource.description}</p>
                    </a>
                  );
                }

                return (
                  <div
                    key={resource.title}
                    className="border border-neutral-800/80 bg-neutral-950/60 rounded-lg p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-neutral-200">{resource.title}</span>
                      <span className="text-[11px] font-mono text-neutral-500">Not Configured</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{resource.description}</p>
                    {resource.placeholderVar && (
                      <div className="text-[11px] font-mono text-neutral-500 pt-1">
                        Set <code>{resource.placeholderVar}</code> in openSourceConfig.ts
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* L. FREQUENTLY ASKED QUESTIONS                                       */}
        {/* =================================================================== */}
        <section id="faq" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-8">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                Straight answers on licensing, security, AI, and self-hosting
              </h2>
            </div>

            <div className="divide-y divide-neutral-800 border border-neutral-800 bg-neutral-950 rounded-lg">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                const panelId = `faq-panel-${idx}`;
                return (
                  <div key={item.question}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full px-5 py-4 min-h-[52px] text-left flex items-center justify-between gap-4 hover:bg-neutral-900/50 transition-colors"
                    >
                      <span className="text-sm font-semibold text-neutral-100">{item.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div
                        id={panelId}
                        className="px-5 pb-5 text-xs sm:text-sm text-neutral-400 leading-relaxed"
                      >
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* M. FOUNDER & ORGANIZATION SECTION                                   */}
        {/* =================================================================== */}
        <section id="founder" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                  Founder &amp; Organization
                </div>
                <div className="pt-1">
                  <a
                    href={PROJECT_IDENTITY.njureTechWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center bg-white px-4 py-2.5 rounded-md border border-neutral-200 hover:opacity-95 transition-opacity"
                    aria-label="Njure Tech — A Njure Group Company"
                  >
                    <img
                      src={njureTechLogo}
                      alt="Njure Tech — A Njure Group Company Logo"
                      width={456}
                      height={174}
                      className="h-12 w-auto object-contain"
                    />
                  </a>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-neutral-100">
                    {PROJECT_IDENTITY.founderName}
                  </div>
                  <div className="text-sm font-medium text-neutral-300">
                    {PROJECT_IDENTITY.founderRole}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {PROJECT_IDENTITY.organizationFull}
                  </div>
                </div>
                <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <a
                    href={PROJECT_IDENTITY.njureTechWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-400 hover:text-rose-300 font-semibold inline-flex items-center gap-1"
                  >
                    <span>Njure Tech (tech.njuregroup.in)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={PROJECT_IDENTITY.njureGroupWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-neutral-100 font-semibold inline-flex items-center gap-1"
                  >
                    <span>Njure Group (njuregroup.in)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={PROJECT_IDENTITY.officialWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-neutral-100 font-semibold inline-flex items-center gap-1"
                  >
                    <span>scribbleit.njuregroup.in</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={GITHUB_REPOSITORY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-neutral-100 font-semibold inline-flex items-center gap-1"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4 lg:border-l lg:border-neutral-800 lg:pl-8">
                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                  {PROJECT_IDENTITY.productName} is developed and maintained under{' '}
                  <strong className="text-neutral-100">{PROJECT_IDENTITY.organizationFull}</strong>{' '}
                  with a clear long-term mission: making dependable, security-first enterprise IT Service Management openly accessible to every organization, institution, and IT operator worldwide.
                </p>
                <div className="p-4 border border-neutral-800 bg-neutral-900/40 rounded-md space-y-1">
                  <div className="text-sm font-bold text-neutral-100">
                    {PROJECT_IDENTITY.founderAttribution}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {PROJECT_IDENTITY.founderAttributionSubline}
                  </div>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {PROJECT_IDENTITY.finalBrandStatement}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===================================================================== */}
      {/* N. FOOTER                                                             */}
      {/* ===================================================================== */}
      <footer className="bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Brand & Founder Attribution */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={PROJECT_IDENTITY.njureTechWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center bg-white px-2.5 py-1.5 rounded border border-neutral-200 hover:opacity-95 transition-opacity shrink-0"
                  aria-label="Njure Tech — Official Website"
                >
                  <img
                    src={njureTechLogo}
                    alt="Njure Tech — A Njure Group Company Logo"
                    width={456}
                    height={174}
                    className="h-7 w-auto object-contain"
                  />
                </a>
                <div className="text-base font-bold text-neutral-100">
                  {PROJECT_IDENTITY.productName}
                </div>
              </div>
              <div className="text-sm text-neutral-300">{PROJECT_IDENTITY.tagline}</div>
              <div className="pt-2 space-y-0.5 text-xs text-neutral-400">
                <div className="font-semibold text-neutral-200">
                  {PROJECT_IDENTITY.founderAttribution}
                </div>
                <div>{PROJECT_IDENTITY.founderAttributionSubline}</div>
              </div>
              <p className="text-xs text-neutral-500 pt-1">
                {PROJECT_IDENTITY.finalBrandStatement}
              </p>
            </div>

            {/* Platform Links */}
            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-neutral-200 uppercase tracking-wider">Platform</div>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <button type="button" onClick={() => scrollToSection('about')} className="hover:text-neutral-100 transition-colors">
                    About
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleLaunchDemo('super_admin', '/watchtower')} className="hover:text-neutral-100 transition-colors">
                    Platform
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-100 transition-colors">
                    Features
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection('roadmap')} className="hover:text-neutral-100 transition-colors">
                    Roadmap
                  </button>
                </li>
              </ul>
            </div>

            {/* Open Source Links */}
            <div className="md:col-span-3 space-y-2.5 text-xs">
              <div className="font-semibold text-neutral-200 uppercase tracking-wider">Open Source</div>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <a href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100 transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100 transition-colors">
                    GitHub
                  </a>
                </li>
                <li>
                  {isConfiguredUrl(COMMUNITY_URL) ? (
                    <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100 transition-colors">
                      Community
                    </a>
                  ) : (
                    <button type="button" onClick={() => scrollToSection('community')} className="hover:text-neutral-100 transition-colors">
                      Community
                    </button>
                  )}
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection('sponsor')} className="hover:text-neutral-100 transition-colors">
                    Support
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal & Theme */}
            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-neutral-200 uppercase tracking-wider">Legal</div>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="hover:text-neutral-100 transition-colors"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="hover:text-neutral-100 transition-colors"
                  >
                    Terms
                  </button>
                </li>
                <li>
                  <a
                    href={`${GITHUB_REPOSITORY_URL}/blob/main/LICENSE`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-neutral-100 transition-colors"
                  >
                    AGPL-3.0 License
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-500">
            <div>
              © {currentYear} {PROJECT_IDENTITY.organizationFull}. Licensed under {PROJECT_IDENTITY.licenseSpdx}.
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={PROJECT_IDENTITY.njureTechWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-200 transition-colors"
              >
                tech.njuregroup.in
              </a>
              <a
                href={PROJECT_IDENTITY.njureGroupWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-200 transition-colors"
              >
                njuregroup.in
              </a>
              <a
                href={PROJECT_IDENTITY.officialWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-200 transition-colors"
              >
                scribbleit.njuregroup.in
              </a>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* LEGAL NOTICE MODAL (PRIVACY POLICY & TERMS — ZERO DEAD LINKS)         */}
      {/* ===================================================================== */}
      {legalModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Use & Licensing'}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="w-full max-w-xl border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-100">
                <FileText className="w-4 h-4 text-rose-400" />
                <span>
                  {legalModal === 'privacy'
                    ? 'SCRIBBLE-IT — Privacy Policy'
                    : 'SCRIBBLE-IT — Terms & Open-Source License'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Close legal notice"
                className="p-1.5 text-neutral-400 hover:text-neutral-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {legalModal === 'privacy' ? (
              <div className="space-y-3 text-xs sm:text-sm text-neutral-400 leading-relaxed">
                <p>
                  <strong className="text-neutral-200">Self-Hosted Sovereignty:</strong> When you deploy SCRIBBLE-IT on your own infrastructure, all operational, identity, and audit data remains strictly within your PostgreSQL and Redis instances. Njure Tech does not collect telemetry from self-hosted deployments.
                </p>
                <p>
                  <strong className="text-neutral-200">Demo &amp; Browser Storage:</strong> Interactive demo sessions launched from this public overview page store sandbox state locally in your browser unless explicitly connected to a configured backend API.
                </p>
                <p>
                  <strong className="text-neutral-200">AI &amp; External Integrations:</strong> Optional Gemini AI features and external connectors (Google Workspace, Twilio, Webhooks) execute strictly through your configured backend credentials and audit logs.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm text-neutral-400 leading-relaxed">
                <p>
                  <strong className="text-neutral-200">Software License:</strong> SCRIBBLE-IT is provided free of charge under the GNU Affero General Public License v3.0 (AGPL-3.0-only) with the Section 7 App Store Distribution Exception published in <code className="text-neutral-200">LICENSE</code> and <code className="text-neutral-200">LICENSE-EXCEPTION.md</code>.
                </p>
                <p>
                  <strong className="text-neutral-200">No Warranty:</strong> In accordance with AGPL-3.0 Sections 15–16, the software is provided &ldquo;AS IS&rdquo; without warranty of any kind. Operators are responsible for configuring TLS, backups, secrets, and compliance controls for production deployments.
                </p>
                <p>
                  <strong className="text-neutral-200">Trademarks:</strong> Neither the license nor the Section 7 exception grants rights to Njure Tech, Njure Group, or Scribble-IT trademarks or logos.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs">
              <div className="text-neutral-500">
                <Terminal className="w-3.5 h-3.5 inline mr-1" />
                {PROJECT_IDENTITY.organizationFull}
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
