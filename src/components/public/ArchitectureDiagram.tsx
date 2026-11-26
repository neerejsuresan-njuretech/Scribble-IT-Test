import React from 'react';
import {
  Monitor,
  Server,
  Database,
  Layers,
  Cpu,
  Bot,
  Plug,
  ShieldCheck,
} from 'lucide-react';

/**
 * Architectural system diagram reflecting the verified SCRIBBLE-IT stack:
 * Frontend clients -> Nginx/API v1 -> FastAPI (RBAC/JWT/RLS) -> PostgreSQL 16,
 * Redis 7, Async Background Workers, Backend-Only Gemini AI, and External Integrations.
 */
export const ArchitectureDiagram: React.FC = () => {
  return (
    <div
      role="region"
      aria-label="SCRIBBLE-IT System Architecture Diagram"
      className="border border-neutral-800 bg-neutral-950 rounded-lg p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-800">
        <div>
          <h3 className="text-base font-bold text-neutral-100">
            End-to-End Platform Architecture
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Stateless FastAPI control plane enforcing JWT authentication, RBAC permissions, and PostgreSQL Row-Level Security.
          </p>
        </div>
        <div className="text-xs text-neutral-400 font-mono tabular-nums">
          REST /api/v1 · RLS Isolated · Backend-Only Secrets
        </div>
      </div>

      {/* Tier 1: Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-3 border border-neutral-800 bg-neutral-900/50 rounded-md p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Monitor className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold text-neutral-100">Client Applications</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 border border-neutral-800 bg-neutral-950 rounded">
              <div className="font-semibold text-neutral-100">Web Application</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                React 19 · TypeScript · Vite · Tailwind CSS · Available
              </div>
            </div>
            <div className="p-2.5 border border-neutral-800/80 bg-neutral-950/60 rounded">
              <div className="font-semibold text-neutral-300">Desktop &amp; Mobile Clients</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Windows · macOS · Linux · Android · iOS · Coming Soon
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: FastAPI Core */}
        <div className="lg:col-span-5 border border-neutral-700 bg-neutral-900/70 rounded-md p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-400">
              <Server className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold text-neutral-100">
                FastAPI Core Backend (/api/v1)
              </span>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">Nginx TLS Proxy</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Auth & Sessions', sub: 'Argon2id · JWT · Rotation' },
              { label: 'Centralized IAM', sub: 'RBAC · Device Trust · SSO' },
              { label: 'ITSM Modules', sub: 'Incidents · Requests · CAB' },
              { label: 'CMDB & Operations', sub: 'Assets · SLA · KB · Audit' },
            ].map(box => (
              <div key={box.label} className="p-2.5 border border-neutral-800 bg-neutral-950 rounded">
                <div className="font-semibold text-neutral-100">{box.label}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{box.sub}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Per-request CORS, Origin CSRF, SSRF egress guard, sliding-window rate limits &amp; audit logging
            </span>
          </div>
        </div>

        {/* Tier 3: Data, Workers & External Services */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-2.5 text-xs">
          <div className="p-3 border border-neutral-800 bg-neutral-900/50 rounded-md flex items-start gap-3">
            <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-neutral-100">PostgreSQL 16 + SQLAlchemy + Alembic</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                50 ORM models · Enforced Row-Level Security · Append-only audit tables
              </div>
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-900/50 rounded-md flex items-start gap-3">
            <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-neutral-100">Redis 7 + Async Background Workers</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Rate-limit counters · Worker heartbeats · Exponential-backoff job retries
              </div>
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-900/50 rounded-md flex items-start gap-3">
            <Bot className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-neutral-100">Secured AI Services (Gemini API)</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Backend-only API keys · Org quotas · Strictly advisory with human approval boundary
              </div>
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-900/50 rounded-md flex items-start gap-3">
            <Plug className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-neutral-100">Encrypted External Integrations</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Google Workspace (Drive, Sheets, Forms, Chat) · Twilio · Signed HMAC Webhooks
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flow Legend */}
      <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span>
            Deployment targets: Docker Compose (self-hosted), Managed Cloud (PostgreSQL + Redis + Container API/Workers), CI verified via GitHub Actions.
          </span>
        </div>
      </div>
    </div>
  );
};
