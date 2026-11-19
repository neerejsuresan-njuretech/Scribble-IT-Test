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
} from 'lucide-react';
import { useITSM } from '../../context/ITSMContext';
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
      '16px snap-to-grid node canvas with cubic Bezier connectors and inline + wire insertion',
      'Multi-step Power Automate-style creator spanning all 31 Scribble IT modules',
      'Built-in Incident and Service Request wireframe templates with SLA & approver inspection',
    ],
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
    span: 'wide',
  },
];

const UNIQUENESS_ITEMS = [
  {
    index: '01.',
    title: 'Visual Pre-Close Wireframe Architecture',
    detail:
      'Instead of burying approval logic inside opaque XML tables, teams lay out actions, approvals, and escalation branches on a Figma-style blueprint canvas explicitly anchored between Ticket Open and Ticket Close.',
  },
  {
    index: '02.',
    title: 'Personal Mobile Number as an Operational Helpdesk Line',
    detail:
      'Small IT teams and on-call engineers do not need a PBX contract to run live support. Scribble IT turns any personal smartphone into a tracked telephony system via native carrier calling, WhatsApp/SMS dispatch, desktop scan-to-call QR, scannable GSM shift-forwarding codes, and server-side two-leg carrier bridging — alongside full Amazon Connect CCP embeds.',
  },
  {
    index: '03.',
    title: 'Multi-Company Logo Branding & Cross-Device Cloud Persistence',
    detail:
      'Every company profile stores its own optimized brand logo, portal titles, SLAs, tickets, and telephony configuration inside Google Cloud Firestore so admins can switch companies and manage operations seamlessly from desktop, tablet, or phone.',
  },
  {
    index: '04.',
    title: 'Role-Isolated Portals Under One Architecture',
    detail:
      'Super Admin, Service Desk Operations, IAM Governance, and End-User Self-Service portals share a single synchronized data backbone while keeping permissions, branding, and module visibility cleanly separated per company.',
  },
  {
    index: '05.',
    title: 'AI Embedded Inside Operational Forms & Dual-Theme Ergonomics',
    detail:
      'AI routing runs inside the New Incident intake form, the Triage Assistant updates beside every ticket, and System Wiki stays grounded via Google Search — all wrapped in dark dot-matrix and corporate light modes engineered for phones, tablets, and widescreens.',
  },
];

const PLUS_POINTS = [
  {
    title: 'Centralized Cloud Firestore Database & Cross-Device Sync',
    detail: 'Incidents, requests, company profiles, custom logos, IAM policies, and telephony settings persist in Google Cloud Firestore and sync live across desktop, tablet, and smartphone sessions.',
  },
  {
    title: 'Multi-Company Branding & Per-Tenant Governance',
    detail: 'Run multiple isolated organizations from one workspace with custom uploaded corporate logos, per-portal titles, tailored SLAs, and granular module toggles.',
  },
  {
    title: 'Operational Personal Mobile + Enterprise Carrier Telephony',
    detail: 'Start immediately using any personal mobile number with QR handoff, GSM shift forwarding, directory Caller ID lookup, and WhatsApp/SMS — then scale to Amazon Connect or Twilio.',
  },
  {
    title: '31 Modules Unified with Visual Pre-Close Workflows',
    detail: 'Replaces fragmented ticketing, CMDB, wiki, process mapper, status page, LMS, and CTI tools with one cohesive interface anchored by Figma-style pre-close gates.',
  },
  {
    title: 'Practical AI & Search-Grounded Documentation',
    detail: 'Accelerates intake categorization, ticket triage, CAB assessments, KB drafting, and external IT documentation research via server-side Gemini routes.',
  },
  {
    title: 'Responsive Across Every Device & Theme',
    detail: 'Adaptive layouts, paginated high-volume tables, mobile bottom navigation, 44px touch targets, and dark/light themes perform cleanly from 360px smartphones to 1440px+ monitors.',
  },
];

const MINUS_POINTS = [
  {
    title: 'Google Sign-In Required for Cloud Cross-Device Sync',
    detail: 'Unauthenticated sessions save cleanly to local browser storage for offline speed, while real-time multi-device Cloud Firestore sync activates once you sign in with Google.',
  },
  {
    title: 'Evaluation Portals vs. Production SAML/OIDC IdP',
    detail: 'Built-in portal logins and one-click Test Accounts streamline evaluation; enterprise production deployments should connect a dedicated corporate IdP (Okta, Microsoft Entra ID, SAML 2.0).',
  },
  {
    title: 'External Prerequisites for Cloud Carrier Bridges',
    detail: 'Embedding Amazon Connect requires whitelisting your origin in AWS Approved Origins, and server-side Twilio two-leg bridging requires carrier credentials configured in environment secrets.',
  },
  {
    title: 'Cellular Carrier Audio Not Recorded in Browser',
    detail: 'Using a personal mobile number via native tel:, WhatsApp, or QR handoff uses your mobile network directly, so server-side audio recording requires routing through Twilio or Amazon Connect.',
  },
  {
    title: 'Server API Key Required for AI Capabilities',
    detail: 'AI incident routing, the Triage Assistant sidebar, CAB review, and Google Search wiki grounding rely on a server-configured Gemini API key.',
  },
  {
    title: 'Broad 31-Module Surface Benefits from Curation',
    detail: 'Smaller teams may not need all 31 modules on day one and should toggle unused modules per company inside Tenant Governance Controls.',
  },
];

const DEMO_PORTALS = [
  {
    id: 'super_admin' as const,
    route: '/watchtower',
    title: 'Super Admin Demo',
    subtitle: 'Full 31-module suite, multi-tenant controls, workflow studio, and telephony hub.',
    icon: ShieldAlert,
    accent: 'text-rose-400',
  },
  {
    id: 'employee' as const,
    route: '/incidents',
    title: 'Service Desk Operations',
    subtitle: 'Incident queue, AI Triage Assistant, Change CAB, CMDB map, and softphone.',
    icon: Laptop,
    accent: 'text-sky-400',
  },
  {
    id: 'iam' as const,
    route: '/iam',
    title: 'IAM Governance Portal',
    subtitle: 'Directory accounts, Company ID bindings, MFA flags, and RBAC permission policies.',
    icon: Shield,
    accent: 'text-amber-400',
  },
  {
    id: 'end_user' as const,
    route: '/portal',
    title: 'End-User Self-Service',
    subtitle: 'Service catalog requests, issue reporting, live service status, and Knowledge Bank.',
    icon: UserCheck,
    accent: 'text-emerald-400',
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-sans selection:bg-rose-600 selection:text-white flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 h-16 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element Brand Wordmark */}
          <button
            type="button"
            onClick={() => scrollToSection('overview')}
            className="text-lg font-bold tracking-tight text-neutral-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-sm"
          >
            Scribble IT
          </button>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
            <button
              type="button"
              onClick={() => scrollToSection('overview')}
              className="hover:text-neutral-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-neutral-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('uniqueness')}
              className="hover:text-neutral-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Uniqueness
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('tradeoffs')}
              className="hover:text-neutral-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Pros &amp; Cons
            </button>
            <Link
              to="/login"
              className="hover:text-neutral-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Menu Trigger (< md only) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
              className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Demo</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden min-h-[40px] min-w-[40px] border border-neutral-800 bg-neutral-900 text-neutral-200 flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Responsive Navigation Panel (< md) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'features', label: 'Platform Features' },
              { id: 'uniqueness', label: 'What Makes It Unique' },
              { id: 'tradeoffs', label: 'Plus & Minus Points' },
              { id: 'portals', label: 'Interactive Demo Roles' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm font-medium text-neutral-200 hover:bg-neutral-900 rounded-sm block"
              >
                {item.label}
              </button>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm font-semibold text-rose-400 hover:bg-neutral-900 rounded-sm flex items-center justify-between"
            >
              <span>Sign In to Portals</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* ===================================================== */}
        {/* HERO: WHAT IS SCRIBBLE IT                             */}
        {/* ===================================================== */}
        <section id="overview" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20 space-y-12">
            {/* Editorial Copy + Primary Action */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
              <div className="lg:col-span-8 space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span>Njure Tech</span>
                  <span aria-hidden="true">·</span>
                  <span>Multi-Tenant Enterprise ITSM</span>
                  <span aria-hidden="true">·</span>
                  <span>Operations, Workflows &amp; Voice CTI</span>
                </div>

                <h1
                  className="font-bold text-neutral-100 tracking-tight leading-[1.08] max-w-3xl"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 3.75rem)',
                    textWrap: 'balance',
                  }}
                >
                  Unified IT service management, visual workflows, and telephony in one workspace.
                </h1>

                <p className="text-[15px] sm:text-base text-neutral-400 leading-relaxed max-w-2xl">
                  <strong className="text-neutral-200 font-semibold">Scribble IT</strong> is a modular IT Service
                  Management and operations platform built for service desks, MSPs, and internal IT teams. It brings
                  ITIL ticketing, CMDB asset tracking, Figma-style pre-close process modeling, AI-assisted incident
                  triage, multi-tenant IAM, and Amazon Connect or personal-mobile telephony into a single browser
                  workspace.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full lg:justify-end">
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                    className="px-5 py-3 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Live Demo</span>
                  </button>
                  <Link
                    to="/login"
                    className="px-4 py-3 min-h-[44px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Login Portals</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span>No signup required for interactive demo</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 transition-colors whitespace-nowrap"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-sky-400" />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Dominant 16:9 Architectural Hero Frame */}
            <div className="border border-neutral-800 bg-neutral-900/40 overflow-hidden rounded-lg">
              {!brokenImages.hero ? (
                <div className="relative aspect-16/9 w-full overflow-hidden">
                  <img
                    src={heroOpsImg}
                    alt="Scribble IT modern minimalist IT operations command center with dual monitors and glass partitions"
                    referrerPolicy="no-referrer"
                    onError={() => markImageBroken('hero')}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 sm:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-neutral-50/80">Operations Command &amp; Service Delivery</div>
                      <div className="text-sm sm:text-base font-semibold text-neutral-50">
                        One operational surface for Watchtower monitoring, Incident triage, CMDB mapping, and voice queues.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollToSection('portals')}
                      className="text-xs font-semibold text-neutral-50 hover:underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-auto"
                    >
                      Choose Demo Role →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aspect-16/9 w-full bg-neutral-900 flex flex-col items-center justify-center p-8 text-center gap-3">
                  <Layers className="w-10 h-10 text-neutral-500" />
                  <div className="text-sm font-semibold text-neutral-200">Scribble IT Operations Workspace</div>
                  <p className="text-xs text-neutral-400 max-w-md">
                    Unified command center for Incident Management, Process Modeling, CMDB, and Voice CTI.
                  </p>
                </div>
              )}
            </div>

            {/* Full-Width Platform Architecture Specification Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border border-neutral-800 bg-neutral-950 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800 rounded-lg overflow-hidden">
              {[
                {
                  metric: '31',
                  label: 'Integrated ITSM Modules',
                  detail: 'Incidents, Requests, Change CAB, CMDB, Knowledge & Billing',
                },
                {
                  metric: '4',
                  label: 'Role-Isolated Portals',
                  detail: 'Super Admin, Service Desk, IAM Governance & End-User',
                },
                {
                  metric: '7+',
                  label: 'Telephony Integrations',
                  detail: 'Personal Mobile, Amazon Connect, Twilio, SIP & WebRTC',
                },
                {
                  metric: 'Cloud',
                  label: 'Cross-Device Sync',
                  detail: 'Google Cloud Firestore persistence across desktop & mobile',
                },
              ].map(item => (
                <div key={item.label} className="p-5 sm:p-6 space-y-1.5">
                  <div className="text-2xl sm:text-3xl font-bold font-mono-strict tabular-nums text-neutral-100">
                    {item.metric}
                  </div>
                  <div className="text-sm font-semibold text-neutral-200">{item.label}</div>
                  <div className="text-xs text-neutral-400 leading-relaxed">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 01. PLATFORM FEATURES (ASYMMETRIC BENTO GRID)         */}
        {/* ===================================================== */}
        <section id="features" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs text-neutral-400">Platform Capabilities</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                  01. Everything a modern IT desk runs daily
                </h2>
                <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                  Filter by operational discipline to inspect the modules included inside Scribble IT today.
                </p>
              </div>

              {/* Interactive Functional Filter Control */}
              <div
                role="tablist"
                aria-label="Filter platform features"
                className="inline-flex flex-wrap items-center gap-1 p-1 border border-neutral-800 bg-neutral-900/70 rounded-lg self-start md:self-auto"
              >
                {[
                  { id: 'all' as const, label: 'All Capabilities' },
                  { id: 'itsm_ai' as const, label: 'ITSM & AI' },
                  { id: 'workflows_cmdb' as const, label: 'Workflows & CMDB' },
                  { id: 'telephony_iam' as const, label: 'Telephony & IAM' },
                ].map(tab => {
                  const active = featureFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFeatureFilter(tab.id)}
                      className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-rose-600 text-white'
                          : 'text-neutral-400 hover:text-neutral-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asymmetric Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {visibleFeatures.map(feature => {
                const colSpanClass =
                  featureFilter !== 'all'
                    ? 'lg:col-span-6'
                    : feature.span === 'wide'
                    ? 'lg:col-span-7'
                    : 'lg:col-span-5';

                return (
                  <article
                    key={feature.id}
                    className={`${colSpanClass} border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden flex flex-col justify-between`}
                  >
                    {feature.image && (
                      <div className="aspect-4/3 sm:aspect-16/9 w-full border-b border-neutral-800 bg-neutral-900/50 overflow-hidden">
                        {!brokenImages[feature.id] ? (
                          <img
                            src={feature.image}
                            alt={feature.imageAlt || feature.title}
                            referrerPolicy="no-referrer"
                            onError={() => markImageBroken(feature.id)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-neutral-400">
                            {feature.fallbackIcon === 'workflow' ? (
                              <Workflow className="w-8 h-8" />
                            ) : (
                              <PhoneCall className="w-8 h-8" />
                            )}
                            <span className="text-xs font-medium">{feature.title}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="text-xs text-neutral-400">{feature.categoryLabel}</div>
                        <h3 className="text-lg sm:text-xl font-semibold text-neutral-100 tracking-tight">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">{feature.summary}</p>
                      </div>

                      <ul className="pt-4 border-t border-neutral-800/80 space-y-2 text-xs sm:text-[13px] text-neutral-300">
                        {feature.highlights.map(point => (
                          <li key={point} className="flex items-start gap-2.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 02. WHAT MAKES SCRIBBLE IT UNIQUE                     */}
        {/* ===================================================== */}
        <section id="uniqueness" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-24">
                <div className="text-xs text-neutral-400">Architectural Distinction</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                  02. What makes Scribble IT unique
                </h2>
                <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                  Legacy ITSM suites force teams to bolt together separate diagramming apps, softphone vendors, and
                  identity consoles. Scribble IT designs these workflows to operate natively together.
                </p>
              </div>

              <div className="lg:col-span-8 border-t border-neutral-800 divide-y divide-neutral-800">
                {UNIQUENESS_ITEMS.map(item => (
                  <div
                    key={item.index}
                    className="py-6 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6 items-start"
                  >
                    <div className="sm:col-span-2 text-sm font-mono-strict tabular-nums text-neutral-500 font-semibold pt-0.5">
                      {item.index}
                    </div>
                    <div className="sm:col-span-10 space-y-2">
                      <h3 className="text-base sm:text-lg font-semibold text-neutral-100">{item.title}</h3>
                      <p className="text-sm text-neutral-400 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 03. HONEST TRADE-OFFS: PLUS POINTS & MINUS POINTS     */}
        {/* ===================================================== */}
        <section id="tradeoffs" className="border-b border-neutral-800">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-10">
            <div className="space-y-2 max-w-2xl">
              <div className="text-xs text-neutral-400">Transparent Engineering Evaluation</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                03. Plus points &amp; minus points
              </h2>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                A clear breakdown of where Scribble IT delivers immediate operational value and which architectural
                trade-offs to plan for before a full production rollout.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Plus Points Column */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-7 space-y-6 flex flex-col">
                <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                  <div className="space-y-0.5">
                    <div className="text-xs text-emerald-400 font-semibold">Plus Points</div>
                    <h3 className="text-lg font-semibold text-neutral-100">Core Strengths &amp; Advantages</h3>
                  </div>
                  <span className="text-xs font-mono-strict tabular-nums text-neutral-500">
                    {PLUS_POINTS.length} strengths
                  </span>
                </div>

                <ul className="space-y-5 flex-1">
                  {PLUS_POINTS.map(item => (
                    <li key={item.title} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-sm border border-emerald-700/70 bg-emerald-950/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
                        <p className="text-xs sm:text-[13px] text-neutral-400 leading-relaxed">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Minus Points Column */}
              <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-7 space-y-6 flex flex-col">
                <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                  <div className="space-y-0.5">
                    <div className="text-xs text-amber-400 font-semibold">Minus Points</div>
                    <h3 className="text-lg font-semibold text-neutral-100">Current Limitations &amp; Trade-Offs</h3>
                  </div>
                  <span className="text-xs font-mono-strict tabular-nums text-neutral-500">
                    {MINUS_POINTS.length} considerations
                  </span>
                </div>

                <ul className="space-y-5 flex-1">
                  {MINUS_POINTS.map(item => (
                    <li key={item.title} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-sm border border-amber-700/70 bg-amber-950/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </span>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
                        <p className="text-xs sm:text-[13px] text-neutral-400 leading-relaxed">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================== */}
        {/* 04. DEMO LAUNCHER & PORTAL ACCESS                     */}
        {/* ===================================================== */}
        <section id="portals">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-10">
            <div className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-10 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-neutral-800 pb-8">
                <div className="space-y-2 max-w-2xl">
                  <div className="text-xs text-neutral-400">Interactive Sandbox</div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-neutral-100 tracking-tight">
                    04. Launch the live Scribble IT demo
                  </h2>
                  <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                    Jump directly into the interactive workspace across any role portal — or proceed to the multi-portal
                    login screen to sign in with credentials or Google Cloud sync.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLaunchDemo('super_admin', '/watchtower')}
                    className="px-5 py-3 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Full Demo</span>
                  </button>
                  <Link
                    to="/login"
                    className="px-4 py-3 min-h-[44px] border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>Go to Login Screen</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* 4 Role-Based Quick Demo Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {DEMO_PORTALS.map(portal => {
                  const Icon = portal.icon;
                  return (
                    <button
                      key={portal.id}
                      type="button"
                      onClick={() => handleLaunchDemo(portal.id, portal.route)}
                      className="text-left p-5 border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-600 rounded-md transition-colors flex flex-col justify-between gap-4 group"
                    >
                      <div className="space-y-3">
                        <Icon className={`w-5 h-5 ${portal.accent}`} aria-hidden="true" />
                        <div className="space-y-1.5">
                          <div className="text-sm font-semibold text-neutral-100">{portal.title}</div>
                          <p className="text-xs text-neutral-400 leading-relaxed">{portal.subtitle}</p>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-neutral-200 group-hover:text-white inline-flex items-center gap-1.5">
                        <span>Open workspace</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950/95">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-semibold text-neutral-100">Scribble IT</span>
            <span aria-hidden="true">·</span>
            <span>Powered by Scribble IT</span>
            <span aria-hidden="true">·</span>
            <span>Njure Tech</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-neutral-100 transition-colors"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('uniqueness')}
              className="hover:text-neutral-100 transition-colors"
            >
              Uniqueness
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('tradeoffs')}
              className="hover:text-neutral-100 transition-colors"
            >
              Pros &amp; Cons
            </button>
            <Link to="/login" className="hover:text-neutral-100 transition-colors">
              Login Portals
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
