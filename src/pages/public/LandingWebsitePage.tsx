import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Minus,
  Sun,
  Moon,
  Play,
  ShieldAlert,
  Laptop,
  Shield,
  UserCheck,
  Workflow,
  PhoneCall,
  Layers,
  Menu,
  X,
  Github,
  Heart,
  FileText,
  Code2,
  Cpu,
  Server,
  Terminal,
  Globe,
  GitPullRequest,
  MessageSquare,
  LifeBuoy,
  Coffee,
  ExternalLink,
} from 'lucide-react';
import { useITSM } from '../../context/ITSMContext';
import { OPEN_SOURCE_CONFIG } from '../../config/openSourceConfig';
import heroOpsImg from '../../assets/images/hero_scribbleit_ops_1795074484892.jpg';
import featureWireframeImg from '../../assets/images/feature_wireframe_studio_1795074487495.jpg';
import featureTelephonyImg from '../../assets/images/feature_telephony_desk_1795074484589.jpg';

type FeatureCategory = 'all' | 'itsm_ai' | 'workflows_cmdb' | 'telephony_iam';

interface FeatureItem {
  id: string;
  category: Exclude<FeatureCategory, 'all'>;
  categoryLabel: string;
  title: string;
  summary: string;
  highlights: string[];
  status: 'Implemented' | 'In Progress' | 'Planned';
  span?: 'wide' | 'standard';
  image?: string;
  imageAlt?: string;
  fallbackIcon?: 'workflow' | 'telephony';
}

const FEATURES: FeatureItem[] = [
  {
    id: 'wireframe-workflows',
    category: 'workflows_cmdb',
    categoryLabel: 'Process & Automation',
    title: 'Figma-Style Pre-Close Process Mapper & Workflow Builder',
    summary:
      'Design incident and service request lifecycles on an interactive blueprint canvas. Insert approvals, operational actions, conditional branches, and webhook automations directly between Record Open and Close gates.',
    highlights: [
      '16px snap-to-grid node canvas with cubic Bezier connectors and inline wire insertion',
      'Multi-step workflow creator spanning all 31 Scribble IT modules',
      'Built-in Incident and Service Request wireframe templates with SLA & approver inspection',
    ],
    status: 'Implemented',
    span: 'wide',
    image: featureWireframeImg,
    imageAlt: 'Architectural system flowchart blueprints and precision modular diagrams on a slate workstation',
    fallbackIcon: 'workflow',
  },
  {
    id: 'telephony-cti',
    category: 'telephony_iam',
    categoryLabel: 'Voice & Personal Mobile CTI',
    title: 'Operational Personal Mobile & Multi-Provider Softphone',
    summary:
      'Turn any personal smartphone number into an operational helpdesk line immediately — or connect Amazon Connect CCP v2, Twilio Programmable Voice, SIP/WebRTC gateways, RingCentral, or Genesys Cloud.',
    highlights: [
      'Direct personal mobile calling (tel:/sms:/WhatsApp) & desktop-to-phone scan-to-call QR handoff',
      'Live Caller ID directory lookup, 1-tap GSM shift forwarding QR codes & two-leg Twilio bridge',
      'Web Audio DTMF dialpad, incoming ringtone cadence, microphone test, call notes & 1-click incident screen-pop',
    ],
    status: 'Implemented',
    span: 'standard',
    image: featureTelephonyImg,
    imageAlt: 'Minimalist corporate desk with smartphone on aluminum stand beside workstation monitor and microphone',
    fallbackIcon: 'telephony',
  },
  {
    id: 'itsm-ai',
    category: 'itsm_ai',
    categoryLabel: 'Core ITIL & AI Triage',
    title: 'Incident, Problem, Change (CAB) & AI Triage Assistant',
    summary:
      'Manage full ITIL service delivery across incidents, service requests, problems, CAB changes, and knowledge articles — paired with automated assignment-group recommendations on intake and a live AI Triage Assistant sidebar.',
    highlights: [
      'AI-powered ticket routing on the New Incident form with one-click priority and queue apply',
      'Real-time Incident Triage sidebar matching SOPs and KB articles with actionable remediation steps',
      'CAB voting workflows, Change risk analysis, SLA tracking, and centralized audit logs',
    ],
    status: 'Implemented',
    span: 'standard',
  },
  {
    id: 'iam-multitenant',
    category: 'telephony_iam',
    categoryLabel: 'Multi-Company Cloud & IAM',
    title: 'Centralized Cloud Sync, Multi-Company Branding & IAM Governance',
    summary:
      'Operate isolated company profiles with custom uploaded logos across Super Admin, Employee Ops, IAM Governance, and End-User Self-Service portals — synchronized live across desktop, tablet, and mobile via Google Cloud Firestore.',
    highlights: [
      'Per-company logo upload & optimization synced to Cloud Firestore across every portal and device',
      'Granular IAM directory profiles, RBAC & MFA access policies, and Company ID bindings',
      'Instant per-tenant module enable/disable matrix, custom SLAs, and cross-device workspace continuity',
    ],
    status: 'Implemented',
    span: 'wide',
  },
  {
    id: 'cmdb-operations',
    category: 'workflows_cmdb',
    categoryLabel: 'Infrastructure & Operations',
    title: 'CMDB Dependency Map, Asset Lifecycle & Operations Suite',
    summary:
      'Track hardware CIs, software licenses, vendor contracts, SSL/domain expirations, morning infrastructure checks, major incident War Rooms, Kanban tasks, LMS training, and client invoicing in one unified suite.',
    highlights: [
      'Interactive CMDB dependency mapping linked directly to incidents, hardware assets, and software seats',
      'Major incident War Room bridge feeds, checklists, and live Service Status publishing',
      'Self-service catalog, custom form builder, Google Workspace connectors, and full JSON/CSV backup',
    ],
    status: 'Implemented',
    span: 'wide',
  },
];

const ROADMAP_ITEMS = [
  {
    title: 'Backend Python & PostgreSQL Migration',
    status: 'In Progress',
    detail: 'Modular FastAPI backend, SQLAlchemy 2.x async models, Alembic migrations, and Argon2id security schemas developed in /backend.',
  },
  {
    title: 'Enterprise Authentication & IAM Governance',
    status: 'Completed',
    detail: 'Secure JWT access/refresh rotation, reuse-detection families, role-based access control, and organization membership isolation.',
  },
  {
    title: 'Multi-Tenant Isolation & RLS',
    status: 'Completed',
    detail: 'PostgreSQL Row-Level Security (RLS) enforcement, transaction-local tenant context, and append-only immutable audit logs.',
  },
  {
    title: 'Device Trust & Secure SSO',
    status: 'Completed',
    detail: 'IAM-portal-exclusive single-use device verification codes (IAM-XXXX-XXXX) and company-managed device SSO binding.',
  },
  {
    title: 'Core ITSM & 31 Module Suite',
    status: 'Completed',
    detail: 'All 31 operational modules, visual process mapper, CTI softphone, and Google Workspace integrations active in the React client.',
  },
  {
    title: 'Server-Side Google Gemini AI Integrations',
    status: 'Completed',
    detail: 'Automated ticket classification, triage assistant, CAB risk analysis, and search-grounded wiki documentation using @google/genai.',
  },
  {
    title: 'Desktop & Mobile Native Integration',
    status: 'In Progress',
    detail: 'Electron and PWA packaging for offline support, local storage persistence, and native push notifications.',
  },
  {
    title: 'Self-Hosted Docker & Enterprise Deployment',
    status: 'In Progress',
    detail: 'Docker Compose orchestration, Nginx reverse proxy configurations, and automated GitHub Actions CI/CD pipelines.',
  },
  {
    title: 'Global Community Ecosystem & Add-on Marketplace',
    status: 'Planned',
    detail: 'Community plugin marketplace, community-contributed workflow templates, and localized language packs.',
  },
];

export const LandingWebsitePage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsTestAccount, theme, toggleTheme } = useITSM();
  const [featureFilter, setFeatureFilter] = useState<FeatureCategory>('all');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleFeatures = useMemo(() => {
    if (featureFilter === 'all') return FEATURES;
    return FEATURES.filter(item => item.category === featureFilter);
  }, [featureFilter]);

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

  const markImageBroken = (key: string) => {
    setBrokenImages(prev => ({ ...prev, [key]: true }));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-sans selection:bg-rose-600 selection:text-white flex flex-col overflow-x-clip">
      {/* Strict Top Header */}
      <header className="sticky top-0 z-40 h-14 sm:h-16 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => scrollToSection('overview')}
            className="text-base sm:text-lg font-bold tracking-tight text-neutral-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-sm"
          >
            Scribble-IT — Enterprise ITSM
          </button>

          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-5 text-sm font-medium text-neutral-400">
            <button type="button" onClick={() => scrollToSection('overview')} className="hover:text-neutral-100 transition-colors">Overview</button>
            <button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-100 transition-colors">Features</button>
            <button type="button" onClick={() => scrollToSection('architecture')} className="hover:text-neutral-100 transition-colors">Architecture</button>
            <button type="button" onClick={() => scrollToSection('opensource')} className="hover:text-neutral-100 transition-colors">Open Source</button>
            <button type="button" onClick={() => scrollToSection('roadmap')} className="hover:text-neutral-100 transition-colors">Roadmap</button>
            <button type="button" onClick={() => scrollToSection('community')} className="hover:text-neutral-100 transition-colors">Community</button>
            <button type="button" onClick={() => scrollToSection('sponsor')} className="hover:text-neutral-100 transition-colors text-rose-400">Sponsor</button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={OPEN_SOURCE_CONFIG.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold rounded-sm transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <button
              type="button"
              onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
              className="px-3 sm:px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Launch Demo</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="lg:hidden min-h-[40px] min-w-[40px] border border-neutral-800 bg-neutral-900 text-neutral-200 flex items-center justify-center shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'features', label: 'Platform Features' },
              { id: 'architecture', label: 'Technology Architecture' },
              { id: 'opensource', label: 'Free & Open Source Commitment' },
              { id: 'roadmap', label: 'Project Roadmap' },
              { id: 'community', label: 'Community & Contribution' },
              { id: 'sponsor', label: 'Sponsor & Support' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left px-3 py-2.5 min-h-[40px] text-sm font-medium text-neutral-200 hover:bg-neutral-900 rounded-sm block"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <a
                href={OPEN_SOURCE_CONFIG.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-300"
              >
                <Github className="w-4 h-4" />
                <span>View GitHub Repository</span>
              </a>
              <Link to="/login" className="text-xs font-semibold text-rose-400 hover:underline">
                Sign In →
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* ===================================================== */}
        {/* 1. PROJECT INTRODUCTION & HERO SECTION                  */}
        {/* ===================================================== */}
        <section id="overview" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-16 sm:pb-20 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-8 space-y-5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-neutral-800 bg-neutral-900/80 rounded-full text-xs font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Open Source Enterprise ITSM · AGPL-3.0</span>
                </div>

                <h1
                  className="font-bold text-neutral-100 tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2rem, 4.5vw, 3.75rem)', textWrap: 'balance' }}
                >
                  Enterprise IT Service Management. Open to Everyone.
                </h1>

                <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
                  <strong className="text-neutral-200 font-semibold">Scribble-IT</strong> is a modern, open-source IT Service Management platform designed to help organizations manage their IT operations, service delivery, assets, incidents, workflows, users, and enterprise governance through one unified, transparent platform.
                </p>

                {/* Vision Points */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {[
                    'Enterprise-grade',
                    'Open-Source',
                    'Free for Everyone',
                    'Self-Hosting',
                    'Community-Driven',
                    'Transparent',
                    'AI-Assisted IT',
                    'Accessible to All',
                  ].map(vision => (
                    <div key={vision} className="flex items-center gap-2 text-xs font-medium text-neutral-300 bg-neutral-900/60 border border-neutral-800/80 px-3 py-2 rounded-md">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{vision}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-3.5">
                <button
                  type="button"
                  onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                  className="w-full px-5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch Live Demo Workspace</span>
                </button>
                <a
                  href={OPEN_SOURCE_CONFIG.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-3 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  <span>Star on GitHub</span>
                </a>
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                  <span>Current Release: v2.0-alpha</span>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hero Image Showcase */}
            <div className="border border-neutral-800 bg-neutral-900/40 overflow-hidden rounded-lg">
              {!brokenImages.hero ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={heroOpsImg}
                    alt="Scribble-IT Enterprise ITSM Command Center"
                    referrerPolicy="no-referrer"
                    onError={() => markImageBroken('hero')}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-emerald-400 font-mono font-semibold">PRODUCTION-READY OPEN SOURCE ITSM</div>
                      <div className="text-base font-bold text-neutral-50">Unified ITIL Operations, CMDB, and Security Governance</div>
                    </div>
                    <Link to="/login" className="px-4 py-2 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-white whitespace-nowrap">
                      Sign In to Portals →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="aspect-[16/9] w-full bg-neutral-900 flex flex-col items-center justify-center gap-3 p-8">
                  <Layers className="w-10 h-10 text-neutral-500" />
                  <div className="text-sm font-bold text-neutral-200">Scribble-IT Enterprise Architecture</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 2. CORE CAPABILITIES                                  */}
        {/* ===================================================== */}
        <section id="features" className="border-b border-neutral-800 bg-neutral-950/50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs text-neutral-400">Comprehensive Feature Suite</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                  02. Core Capabilities &amp; Module Status
                </h2>
                <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                  Explore the full operational suite. Features are clearly marked as implemented or under development based on the current repository state.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 border border-neutral-800 bg-neutral-900 rounded-lg overflow-x-auto no-scrollbar">
                {[
                  { id: 'all' as const, label: 'All Modules' },
                  { id: 'itsm_ai' as const, label: 'ITSM & AI' },
                  { id: 'workflows_cmdb' as const, label: 'Workflows & CMDB' },
                  { id: 'telephony_iam' as const, label: 'Telephony & IAM' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeatureFilter(tab.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      featureFilter === tab.id ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-neutral-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              {visibleFeatures.map(feature => (
                <article
                  key={feature.id}
                  className={`${feature.span === 'wide' ? 'lg:col-span-7' : 'lg:col-span-5'} border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden flex flex-col justify-between`}
                >
                  {feature.image && (
                    <div className="aspect-[16/9] w-full border-b border-neutral-800 bg-neutral-900 overflow-hidden">
                      {!brokenImages[feature.id] ? (
                        <img
                          src={feature.image}
                          alt={feature.imageAlt || feature.title}
                          referrerPolicy="no-referrer"
                          onError={() => markImageBroken(feature.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                          <Workflow className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400 uppercase tracking-wider">{feature.categoryLabel}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {feature.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100">{feature.title}</h3>
                      <p className="text-sm text-neutral-400 leading-relaxed">{feature.summary}</p>
                    </div>

                    <ul className="pt-4 border-t border-neutral-800 space-y-2 text-xs text-neutral-300">
                      {feature.highlights.map(hl => (
                        <li key={hl} className="flex items-start gap-2.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>

            {/* Additional Capability List */}
            <div className="border border-neutral-800 bg-neutral-900/50 rounded-lg p-6 sm:p-8 space-y-6">
              <h3 className="text-base font-bold text-neutral-100">Additional Enterprise Modules Included in Scribble-IT</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {[
                  { name: 'Incident Management', status: 'Implemented' },
                  { name: 'Service Request Management', status: 'Implemented' },
                  { name: 'Problem Management', status: 'Implemented' },
                  { name: 'Change Management & CAB', status: 'Implemented' },
                  { name: 'Asset Management & CMDB', status: 'Implemented' },
                  { name: 'IT Inventory & Software', status: 'Implemented' },
                  { name: 'SLA Management & Tracking', status: 'Implemented' },
                  { name: 'Identity & Access Management', status: 'Implemented' },
                  { name: 'Role-Based Access Control', status: 'Implemented' },
                  { name: 'Device Trust & Secure SSO', status: 'Implemented' },
                  { name: 'Knowledge Management & Wiki', status: 'Implemented' },
                  { name: 'Workflow Automation Engine', status: 'Implemented' },
                  { name: 'Audit & Governance Logs', status: 'Implemented' },
                  { name: 'Reporting & Analytics', status: 'Implemented' },
                  { name: 'AI-Powered ITSM Assistance', status: 'Implemented' },
                  { name: 'Google Workspace & Telephony', status: 'Implemented' },
                ].map(mod => (
                  <div key={mod.name} className="flex items-center justify-between p-3 border border-neutral-800 bg-neutral-950 rounded">
                    <span className="font-semibold text-neutral-200">{mod.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-900">
                      {mod.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 3. TECHNOLOGY ARCHITECTURE                            */}
        {/* ===================================================== */}
        <section id="architecture" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs text-neutral-400">Enterprise Stack</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                03. Technology Architecture &amp; Migration Status
              </h2>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                Scribble-IT is engineered with a decoupled, modular architecture designed for high throughput, strict tenant isolation, and future horizontal scaling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Frontend Stack */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3 text-sky-400">
                  <Laptop className="w-5 h-5" />
                  <h3 className="text-base font-bold text-neutral-100">Frontend Layer</h3>
                </div>
                <ul className="space-y-2.5 text-xs text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>React 19</strong> + TypeScript</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>Vite</strong> lightning-fast build system</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>Tailwind CSS</strong> responsive styling</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Lucide icons &amp; adaptive dark/light themes</span>
                  </li>
                </ul>
                <div className="pt-3 border-t border-neutral-800 text-[11px] text-emerald-400 font-mono">
                  Status: Fully Integrated &amp; Active
                </div>
              </div>

              {/* Backend Stack */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3 text-rose-400">
                  <Server className="w-5 h-5" />
                  <h3 className="text-base font-bold text-neutral-100">Backend Architecture</h3>
                </div>
                <ul className="space-y-2.5 text-xs text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>Python 3.11</strong> + <strong>FastAPI</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>PostgreSQL 16</strong> + Row-Level Security</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>SQLAlchemy 2.x</strong> + <strong>Alembic</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>Redis 7</strong> cache &amp; rate limiting</span>
                  </li>
                </ul>
                <div className="pt-3 border-t border-neutral-800 text-[11px] text-amber-400 font-mono">
                  Status: Foundation Built / Preview on Vite+Express
                </div>
              </div>

              {/* Infrastructure */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3 text-emerald-400">
                  <Cpu className="w-5 h-5" />
                  <h3 className="text-base font-bold text-neutral-100">Infrastructure &amp; Ops</h3>
                </div>
                <ul className="space-y-2.5 text-xs text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>Docker</strong> &amp; Docker Compose orchestration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>REST APIs &amp; OpenAPI / Swagger docs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span><strong>GitHub Actions</strong> CI/CD workflows</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cloud &amp; Self-hosted deployment specs</span>
                  </li>
                </ul>
                <div className="pt-3 border-t border-neutral-800 text-[11px] text-emerald-400 font-mono">
                  Status: Ready for Self-Hosting &amp; Cloud
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 4. FREE AND OPEN-SOURCE COMMITMENT                    */}
        {/* ===================================================== */}
        <section id="opensource" className="border-b border-neutral-800 bg-neutral-950/50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-10 space-y-6">
              <div className="space-y-3 max-w-3xl">
                <div className="text-xs text-emerald-400 font-mono font-semibold">OUR PROMISE TO THE COMMUNITY</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                  Enterprise ITSM should not be accessible only to enterprises with large budgets.
                </h2>
                <p className="text-base text-neutral-300 leading-relaxed">
                  Scribble-IT aims to make enterprise-grade IT service management accessible to everyone. We believe that core operational tooling, security governance, and workflow automation are public goods for modern engineering teams.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {[
                  { title: 'Free to Use', detail: 'The core community edition is 100% free with no hidden user limits or core feature paywalls.' },
                  { title: 'No Mandatory Subscriptions', detail: 'Run your IT desk without forced monthly cloud licensing fees or artificial paywalls.' },
                  { title: 'Self-Hosting Flexibility', detail: 'Deploy Scribble-IT on your own private infrastructure using Docker and PostgreSQL.' },
                  { title: 'Open Source Inspection', detail: 'Inspect, audit, and modify every line of source code under the GNU AGPL-3.0 license.' },
                  { title: 'Community-Driven', detail: 'Roadmap priorities, security audits, and new modules are guided by community feedback.' },
                  { title: 'Transparent Governance', detail: 'No proprietary lock-in. Your data remains fully owned and controlled by your organization.' },
                ].map(commit => (
                  <div key={commit.title} className="p-4 border border-neutral-800 bg-neutral-900/60 rounded-md space-y-2">
                    <div className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{commit.title}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{commit.detail}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
                <div>
                  Licensed under <strong className="text-neutral-200">{OPEN_SOURCE_CONFIG.licenseName}</strong> with Section 7 App Store Exception.
                </div>
                <a
                  href={OPEN_SOURCE_CONFIG.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-rose-400 hover:underline font-semibold"
                >
                  <span>Read License Terms</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 5. PROJECT ROADMAP                                    */}
        {/* ===================================================== */}
        <section id="roadmap" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs text-neutral-400">Development Milestones</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                05. Project Roadmap &amp; Progress
              </h2>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                Transparent status of our architectural rebuild and enterprise feature rollout.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ROADMAP_ITEMS.map(item => {
                const statusColor =
                  item.status === 'Completed'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : item.status === 'In Progress'
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800';

                return (
                  <div key={item.title} className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusColor}`}>
                          {item.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-100">{item.title}</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 6. COMMUNITY & CONTRIBUTION                           */}
        {/* ===================================================== */}
        <section id="community" className="border-b border-neutral-800 bg-neutral-950/50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs text-neutral-400">Collaborative Engineering</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                Built for the Community. Improved by the Community.
              </h2>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                Whether you are fixing a bug, suggesting a workflow feature, improving documentation, or conducting security reviews, your contribution makes Scribble-IT stronger.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Contribute Code', desc: 'Fork the repository, submit pull requests, and help build new ITSM modules.', icon: Code2, link: OPEN_SOURCE_CONFIG.githubRepoUrl },
                { title: 'Report Issues', desc: 'Found a bug or security edge case? File an issue on our GitHub tracker.', icon: LifeBuoy, link: OPEN_SOURCE_CONFIG.issueTrackerUrl },
                { title: 'Improve Documentation', desc: 'Help us write clear deployment guides, API references, and admin tutorials.', icon: FileText, link: OPEN_SOURCE_CONFIG.documentationUrl },
                { title: 'Participate in Discussions', desc: 'Join community discussions, propose features, and share your ITSM workflows.', icon: MessageSquare, link: OPEN_SOURCE_CONFIG.githubRepoUrl },
                { title: 'Security Reviews', desc: 'Audit our authentication flows, RLS database policies, and IAM permissions.', icon: Shield, link: OPEN_SOURCE_CONFIG.githubRepoUrl },
                { title: 'Spread the Word', desc: 'Star the repository and share Scribble-IT with other IT operations professionals.', icon: Github, link: OPEN_SOURCE_CONFIG.githubRepoUrl },
              ].map(comm => {
                const Icon = comm.icon;
                return (
                  <a
                    key={comm.title}
                    href={comm.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 rounded-lg p-6 space-y-3 transition-colors group block"
                  >
                    <Icon className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                    <h3 className="text-base font-bold text-neutral-100 flex items-center justify-between">
                      <span>{comm.title}</span>
                      <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-100 transition-colors" />
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">{comm.desc}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 7. SPONSOR AND SUPPORT THE PROJECT                    */}
        {/* ===================================================== */}
        <section id="sponsor" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
            <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-8 sm:p-12 text-center space-y-6 max-w-3xl mx-auto">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/80 mx-auto">
                <Heart className="w-6 h-6 fill-current" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                  Help Us Build Better Open-Source ITSM.
                </h2>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl mx-auto">
                  Scribble-IT is built with the vision of making enterprise ITSM accessible to everyone. Your support helps us maintain the project, improve security, develop new features, maintain infrastructure, and grow the open-source community.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                {OPEN_SOURCE_CONFIG.githubSponsorsUrl ? (
                  <a
                    href={OPEN_SOURCE_CONFIG.githubSponsorsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                    <span>GitHub Sponsors</span>
                  </a>
                ) : (
                  <a
                    href={OPEN_SOURCE_CONFIG.githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Github className="w-4 h-4" />
                    <span>Sponsor on GitHub (Configured via URL)</span>
                  </a>
                )}

                {OPEN_SOURCE_CONFIG.buyMeACoffeeUrl && (
                  <a
                    href={OPEN_SOURCE_CONFIG.buyMeACoffeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Coffee className="w-4 h-4" />
                    <span>Buy Me a Coffee</span>
                  </a>
                )}

                <a
                  href={OPEN_SOURCE_CONFIG.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <Code2 className="w-4 h-4" />
                  <span>Contribute Code</span>
                </a>
              </div>

              <div className="text-xs text-neutral-500 pt-2">
                Donations and financial support are completely voluntary and never required to use the free community edition.
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 8. INTERACTIVE DEMO LAUNCHER                          */}
        {/* ===================================================== */}
        <section id="portals">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
            <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-10 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-neutral-800 pb-8">
                <div className="space-y-2 max-w-2xl">
                  <div className="text-xs text-neutral-400">Interactive Sandbox</div>
                  <h2 className="text-xl sm:text-2xl font-bold text-neutral-100">
                    Explore Scribble-IT by Role
                  </h2>
                  <p className="text-sm text-neutral-400">
                    Test drive the platform instantly with pre-configured test accounts across all four security portals.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Launch Super Admin Demo
                  </button>
                  <Link
                    to="/login"
                    className="px-4 py-2.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold"
                  >
                    Portal Login
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { id: 'super_admin' as const, route: '/watchtower', title: 'Super Admin Portal', desc: 'Full 31-module suite & tenant controls', icon: ShieldAlert, color: 'text-rose-400' },
                  { id: 'employee' as const, route: '/incidents', title: 'Service Desk Ops', desc: 'Incident queue, AI triage & CTI phone', icon: Laptop, color: 'text-sky-400' },
                  { id: 'iam' as const, route: '/iam', title: 'IAM Governance', desc: 'Directory, device enrollment & RBAC', icon: Shield, color: 'text-amber-400' },
                  { id: 'end_user' as const, route: '/portal', title: 'End-User Self-Service', desc: 'Request catalog & live service status', icon: UserCheck, color: 'text-emerald-400' },
                ].map(portal => {
                  const Icon = portal.icon;
                  return (
                    <button
                      key={portal.id}
                      type="button"
                      onClick={() => handleLaunchDemo(portal.id, portal.route)}
                      className="text-left p-5 border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 rounded-md transition-colors flex flex-col justify-between gap-4 group"
                    >
                      <div className="space-y-3">
                        <Icon className={`w-5 h-5 ${portal.color}`} />
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-neutral-100">{portal.title}</div>
                          <p className="text-xs text-neutral-400">{portal.desc}</p>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-neutral-200 group-hover:text-white inline-flex items-center gap-1.5">
                        <span>Launch Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-semibold text-neutral-100">Scribble-IT — Enterprise ITSM</span>
            <span aria-hidden="true">·</span>
            <span>Open Source (AGPL-3.0)</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href={OPEN_SOURCE_CONFIG.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100">GitHub</a>
            <a href={OPEN_SOURCE_CONFIG.documentationUrl} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-100">Documentation</a>
            <button type="button" onClick={() => scrollToSection('opensource')} className="hover:text-neutral-100">License</button>
            <Link to="/login" className="hover:text-neutral-100">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
