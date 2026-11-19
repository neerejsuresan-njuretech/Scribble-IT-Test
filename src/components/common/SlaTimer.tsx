import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import type { ServiceRequest } from '../../types/itsm';

export type SlaTier = 'breached' | 'critical' | 'warning' | 'healthy' | 'met' | 'paused' | 'cancelled';

export interface SlaEvaluationInput {
  createdAt: string;
  deadline: string;
  isCompleted?: boolean;
  isPaused?: boolean;
  isCancelled?: boolean;
  breachedFlag?: boolean;
  nowMs?: number;
}

export interface SlaEvaluationResult {
  tier: SlaTier;
  percentElapsed: number;
  remainingMs: number;
  label: string;
  shortText: string;
}

export function getRequestSlaDeadline(req: Pick<ServiceRequest, 'createdAt' | 'deliveryEstimateDays' | 'deliveryDate'>): string {
  if (req.deliveryDate) {
    const parsed = new Date(req.deliveryDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  const createdMs = new Date(req.createdAt).getTime();
  const baseMs = Number.isNaN(createdMs) ? Date.now() : createdMs;
  const days = Math.max(1, Number(req.deliveryEstimateDays) || 3);
  return new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDurationMs(absMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(absMs / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function evaluateSlaState(input: SlaEvaluationInput): SlaEvaluationResult {
  const now = input.nowMs ?? Date.now();
  const createdMs = new Date(input.createdAt).getTime();
  const deadlineMs = new Date(input.deadline).getTime();
  const totalWindowMs = Math.max(60000, (Number.isNaN(deadlineMs) ? now + 3600000 : deadlineMs) - (Number.isNaN(createdMs) ? now : createdMs));
  const remainingMs = (Number.isNaN(deadlineMs) ? now : deadlineMs) - now;
  const elapsedMs = totalWindowMs - remainingMs;
  const percentElapsed = Math.max(0, Math.min(100, Math.round((elapsedMs / totalWindowMs) * 100)));

  if (input.isCancelled) {
    return {
      tier: 'cancelled',
      percentElapsed,
      remainingMs,
      label: 'SLA Cancelled',
      shortText: 'Cancelled',
    };
  }

  if (input.isCompleted) {
    return {
      tier: 'met',
      percentElapsed: 100,
      remainingMs,
      label: input.breachedFlag ? 'Completed (Post-Breach)' : 'SLA Met',
      shortText: input.breachedFlag ? 'Met Late' : 'SLA Met',
    };
  }

  if (input.isPaused) {
    return {
      tier: 'paused',
      percentElapsed,
      remainingMs,
      label: `SLA Paused (${formatDurationMs(Math.abs(remainingMs))} left)`,
      shortText: `Paused · ${formatDurationMs(Math.abs(remainingMs))}`,
    };
  }

  if (input.breachedFlag || remainingMs <= 0) {
    const overdue = formatDurationMs(Math.abs(remainingMs));
    return {
      tier: 'breached',
      percentElapsed: 100,
      remainingMs,
      label: `SLA Breached by ${overdue}`,
      shortText: `Breached -${overdue}`,
    };
  }

  const remainingFormatted = formatDurationMs(remainingMs);
  if (percentElapsed >= 85 || remainingMs <= 30 * 60 * 1000) {
    return {
      tier: 'critical',
      percentElapsed,
      remainingMs,
      label: `Critical · ${remainingFormatted} remaining`,
      shortText: `${remainingFormatted} left`,
    };
  }

  if (percentElapsed >= 65) {
    return {
      tier: 'warning',
      percentElapsed,
      remainingMs,
      label: `Warning · ${remainingFormatted} remaining`,
      shortText: `${remainingFormatted} left`,
    };
  }

  return {
    tier: 'healthy',
    percentElapsed,
    remainingMs,
    label: `On Track · ${remainingFormatted} remaining`,
    shortText: `${remainingFormatted} left`,
  };
}

export interface SlaTimerProps {
  createdAt: string;
  deadline: string;
  isCompleted?: boolean;
  isPaused?: boolean;
  isCancelled?: boolean;
  breachedFlag?: boolean;
  variant?: 'compact' | 'table' | 'detailed';
  label?: string;
}

const TIER_STYLES: Record<SlaTier, { text: string; bar: string; border: string; bg: string }> = {
  breached: {
    text: 'text-rose-400',
    bar: 'bg-rose-500',
    border: 'border-rose-800/70',
    bg: 'bg-rose-950/20',
  },
  critical: {
    text: 'text-rose-300',
    bar: 'bg-rose-500',
    border: 'border-rose-800/60',
    bg: 'bg-rose-950/15',
  },
  warning: {
    text: 'text-amber-400',
    bar: 'bg-amber-500',
    border: 'border-amber-800/60',
    bg: 'bg-amber-950/15',
  },
  healthy: {
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    border: 'border-neutral-800',
    bg: 'bg-neutral-900/40',
  },
  met: {
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    border: 'border-emerald-800/50',
    bg: 'bg-emerald-950/15',
  },
  paused: {
    text: 'text-sky-400',
    bar: 'bg-sky-500',
    border: 'border-sky-800/50',
    bg: 'bg-sky-950/15',
  },
  cancelled: {
    text: 'text-neutral-500',
    bar: 'bg-neutral-600',
    border: 'border-neutral-800',
    bg: 'bg-neutral-900/30',
  },
};

export const SlaTimer: React.FC<SlaTimerProps> = ({
  createdAt,
  deadline,
  isCompleted,
  isPaused,
  isCancelled,
  breachedFlag,
  variant = 'compact',
  label = 'SLA Window',
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (isCompleted || isPaused || isCancelled) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [isCompleted, isPaused, isCancelled]);

  const state = evaluateSlaState({
    createdAt,
    deadline,
    isCompleted,
    isPaused,
    isCancelled,
    breachedFlag,
    nowMs,
  });
  const styles = TIER_STYLES[state.tier];

  const renderIcon = () => {
    if (state.tier === 'breached' || state.tier === 'critical') return <AlertTriangle className="w-3 h-3 shrink-0" />;
    if (state.tier === 'met') return <CheckCircle2 className="w-3 h-3 shrink-0" />;
    if (state.tier === 'paused') return <PauseCircle className="w-3 h-3 shrink-0" />;
    if (state.tier === 'cancelled') return <XCircle className="w-3 h-3 shrink-0" />;
    return <Clock className="w-3 h-3 shrink-0" />;
  };

  if (variant === 'table') {
    return (
      <div className="min-w-[115px] space-y-1">
        <div className={`flex items-center gap-1 text-[11px] font-mono-strict tabular-nums font-semibold ${styles.text}`}>
          {renderIcon()}
          <span className="truncate">{state.shortText}</span>
        </div>
        <div className="h-1 w-full bg-neutral-800 overflow-hidden">
          <div className={`h-full ${styles.bar}`} style={{ width: `${state.percentElapsed}%` }} />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-1">
        <div className={`flex items-center justify-between gap-2 text-[10px] font-mono-strict tabular-nums ${styles.text}`}>
          <span className="inline-flex items-center gap-1 truncate">
            {renderIcon()}
            <span>{state.shortText}</span>
          </span>
          <span className="text-neutral-500">{state.percentElapsed}%</span>
        </div>
        <div className="h-1 w-full bg-neutral-800 overflow-hidden">
          <div className={`h-full ${styles.bar}`} style={{ width: `${state.percentElapsed}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border ${styles.border} ${styles.bg} space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`font-semibold inline-flex items-center gap-1.5 ${styles.text}`}>
          {renderIcon()}
          <span>{label}</span>
        </span>
        <span className={`font-mono-strict tabular-nums font-bold ${styles.text}`}>{state.label}</span>
      </div>
      <div className="h-1.5 w-full bg-neutral-800 overflow-hidden">
        <div className={`h-full ${styles.bar} transition-all`} style={{ width: `${state.percentElapsed}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono-strict tabular-nums text-neutral-500">
        <span>Opened: {new Date(createdAt).toLocaleString()}</span>
        <span>Target: {new Date(deadline).toLocaleString()}</span>
      </div>
    </div>
  );
};
