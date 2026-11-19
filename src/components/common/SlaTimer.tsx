import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import type { ServiceRequest } from '../../types/itsm';

export type SlaHealthTier =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'breached'
  | 'met'
  | 'paused'
  | 'cancelled';

export interface SlaEvaluation {
  tier: SlaHealthTier;
  /** Positive = ms left before breach, negative = ms overdue */
  remainingMs: number;
  /** 0 to 100 percentage of SLA window remaining */
  remainingPct: number;
  /** Compact tabular countdown readout (e.g., "02:44:19", "1d 22h", "-00:18:05") */
  countdownText: string;
  /** Explicit accessible text label paired with color indicator */
  statusLabel: string;
  /** Formatted target deadline timestamp */
  deadlineLabel: string;
}

// Single shared 1-second ticker across all mounted SLA timers
type TickListener = (now: number) => void;
const tickListeners = new Set<TickListener>();
let sharedIntervalId: number | null = null;

function subscribeSlaClock(listener: TickListener): () => void {
  tickListeners.add(listener);
  if (sharedIntervalId === null && typeof window !== 'undefined') {
    sharedIntervalId = window.setInterval(() => {
      const now = Date.now();
      tickListeners.forEach(cb => cb(now));
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && sharedIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(sharedIntervalId);
      sharedIntervalId = null;
    }
  };
}

export function useSlaNow(active = true): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    return subscribeSlaClock(setNow);
  }, [active]);
  return now;
}

/**
 * Derives a consistent fulfillment SLA deadline ISO string for a Service Request
 * from its creation timestamp and estimated business/calendar delivery days.
 */
export function getRequestSlaDeadline(
  req: Pick<ServiceRequest, 'createdAt' | 'deliveryEstimateDays' | 'deliveryDate'>
): string {
  const createdMs = new Date(req.createdAt).getTime();
  const estDays = Math.max(1, Number(req.deliveryEstimateDays) || 3);
  if (Number.isFinite(createdMs)) {
    return new Date(createdMs + estDays * 24 * 60 * 60 * 1000).toISOString();
  }
  if (req.deliveryDate) {
    const parsed = new Date(req.deliveryDate).getTime();
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(Date.now() + estDays * 24 * 60 * 60 * 1000).toISOString();
}

function formatDurationMs(absMs: number, includeSeconds: boolean): string {
  const totalSeconds = Math.max(0, Math.floor(absMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days >= 1) {
    return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (includeSeconds) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
}

export interface EvaluateSlaOptions {
  createdAt: string;
  deadline: string;
  isCompleted?: boolean;
  isPaused?: boolean;
  isCancelled?: boolean;
  breachedFlag?: boolean;
  warningThresholdPct?: number;
  criticalThresholdPct?: number;
  nowMs?: number;
}

export function evaluateSlaState({
  createdAt,
  deadline,
  isCompleted = false,
  isPaused = false,
  isCancelled = false,
  breachedFlag = false,
  warningThresholdPct = 45,
  criticalThresholdPct = 15,
  nowMs = Date.now(),
}: EvaluateSlaOptions): SlaEvaluation {
  const createdMs = new Date(createdAt).getTime();
  const deadlineMs = new Date(deadline).getTime();
  const validDeadline = Number.isFinite(deadlineMs) ? deadlineMs : nowMs + 4 * 3600 * 1000;
  const validCreated =
    Number.isFinite(createdMs) && createdMs < validDeadline
      ? createdMs
      : validDeadline - 4 * 3600 * 1000;

  const totalWindowMs = Math.max(validDeadline - validCreated, 60 * 1000);
  const remainingMs = validDeadline - nowMs;
  const rawPct = (remainingMs / totalWindowMs) * 100;
  const remainingPct = Math.max(0, Math.min(100, Math.round(rawPct)));

  const deadlineDate = new Date(validDeadline);
  const deadlineLabel = deadlineDate.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isCancelled) {
    return {
      tier: 'cancelled',
      remainingMs,
      remainingPct: 0,
      countdownText: 'Stopped',
      statusLabel: 'Cancelled',
      deadlineLabel,
    };
  }

  if (isCompleted) {
    if (breachedFlag) {
      return {
        tier: 'breached',
        remainingMs: 0,
        remainingPct: 0,
        countdownText: 'Closed Late',
        statusLabel: 'Breached',
        deadlineLabel,
      };
    }
    return {
      tier: 'met',
      remainingMs: Math.max(0, remainingMs),
      remainingPct: 100,
      countdownText: 'Within SLA',
      statusLabel: 'SLA Met',
      deadlineLabel,
    };
  }

  if (isPaused) {
    const absText = formatDurationMs(Math.abs(remainingMs), false);
    return {
      tier: 'paused',
      remainingMs,
      remainingPct,
      countdownText: remainingMs >= 0 ? `${absText} left` : `-${absText}`,
      statusLabel: 'Paused',
      deadlineLabel,
    };
  }

  if (breachedFlag || remainingMs <= 0) {
    const overdueMs = Math.max(0, -remainingMs);
    return {
      tier: 'breached',
      remainingMs,
      remainingPct: 0,
      countdownText: `-${formatDurationMs(overdueMs, true)}`,
      statusLabel: 'Breached',
      deadlineLabel,
    };
  }

  // Critical threshold: <= 15% remaining OR <= 20 minutes remaining
  const isCritical =
    remainingPct <= criticalThresholdPct || remainingMs <= 20 * 60 * 1000;
  if (isCritical) {
    return {
      tier: 'critical',
      remainingMs,
      remainingPct,
      countdownText: formatDurationMs(remainingMs, true),
      statusLabel: 'Critical',
      deadlineLabel,
    };
  }

  // Warning threshold: <= 45% remaining OR <= 60 minutes remaining
  const isWarning =
    remainingPct <= warningThresholdPct || remainingMs <= 60 * 60 * 1000;
  if (isWarning) {
    return {
      tier: 'warning',
      remainingMs,
      remainingPct,
      countdownText: formatDurationMs(remainingMs, true),
      statusLabel: 'Warning',
      deadlineLabel,
    };
  }

  return {
    tier: 'healthy',
    remainingMs,
    remainingPct,
    countdownText: formatDurationMs(remainingMs, true),
    statusLabel: 'On Track',
    deadlineLabel,
  };
}

interface TierStyles {
  textClass: string;
  barClass: string;
  indicatorClass: string;
  containerTintClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getTierStyles(tier: SlaHealthTier): TierStyles {
  switch (tier) {
    case 'healthy':
    case 'met':
      return {
        textClass: 'text-emerald-400',
        barClass: 'bg-emerald-500',
        indicatorClass: 'bg-emerald-500',
        containerTintClass: 'border-emerald-800/70 bg-emerald-950/20',
        Icon: tier === 'met' ? CheckCircle2 : Clock,
      };
    case 'warning':
      return {
        textClass: 'text-amber-400',
        barClass: 'bg-amber-500',
        indicatorClass: 'bg-amber-500',
        containerTintClass: 'border-amber-800/70 bg-amber-950/20',
        Icon: AlertTriangle,
      };
    case 'critical':
    case 'breached':
      return {
        textClass: 'text-rose-400',
        barClass: 'bg-rose-500',
        indicatorClass: 'bg-rose-500',
        containerTintClass: 'border-rose-800/70 bg-rose-950/20',
        Icon: ShieldAlert,
      };
    case 'paused':
      return {
        textClass: 'text-neutral-400',
        barClass: 'bg-neutral-500',
        indicatorClass: 'bg-neutral-500',
        containerTintClass: 'border-neutral-800 bg-neutral-900/40',
        Icon: PauseCircle,
      };
    case 'cancelled':
    default:
      return {
        textClass: 'text-neutral-500',
        barClass: 'bg-neutral-600',
        indicatorClass: 'bg-neutral-600',
        containerTintClass: 'border-neutral-800 bg-neutral-900/30',
        Icon: Ban,
      };
  }
}

export interface SlaTimerProps {
  createdAt: string;
  deadline: string;
  isCompleted?: boolean;
  isPaused?: boolean;
  isCancelled?: boolean;
  breachedFlag?: boolean;
  /** table = table column cell, compact = narrow split-list card row, detailed = full detail header */
  variant?: 'table' | 'compact' | 'detailed';
  /** Optional custom title shown in detailed mode (e.g., "SLA Resolution Window" or "Fulfillment SLA Target") */
  label?: string;
  warningThresholdPct?: number;
  criticalThresholdPct?: number;
  className?: string;
}

export const SlaTimer: React.FC<SlaTimerProps> = ({
  createdAt,
  deadline,
  isCompleted = false,
  isPaused = false,
  isCancelled = false,
  breachedFlag = false,
  variant = 'table',
  label = 'SLA Resolution Window',
  warningThresholdPct = 45,
  criticalThresholdPct = 15,
  className = '',
}) => {
  const isLive = !isCompleted && !isPaused && !isCancelled;
  const nowMs = useSlaNow(isLive);

  const state = evaluateSlaState({
    createdAt,
    deadline,
    isCompleted,
    isPaused,
    isCancelled,
    breachedFlag,
    warningThresholdPct,
    criticalThresholdPct,
    nowMs,
  });

  const { textClass, barClass, indicatorClass, containerTintClass, Icon } = getTierStyles(
    state.tier
  );

  // For breached active records, fill bar 100% red so visual urgency is unmistakable
  const barWidthPct =
    state.tier === 'breached'
      ? 100
      : state.tier === 'met'
      ? 100
      : state.tier === 'cancelled'
      ? 0
      : Math.max(4, state.remainingPct);

  const tooltip = `${state.statusLabel} · ${state.countdownText} · Target: ${state.deadlineLabel}${
    isLive ? ` (${state.remainingPct}% remaining)` : ''
  }`;

  if (variant === 'compact') {
    return (
      <div className={`space-y-1 ${className}`} title={tooltip}>
        <div className="flex items-center justify-between gap-2 text-[10px] leading-none">
          <span className={`inline-flex items-center gap-1 font-semibold ${textClass} whitespace-nowrap`}>
            <Icon className="w-3 h-3 shrink-0" />
            <span>{state.statusLabel}</span>
          </span>
          <span className={`font-mono-strict tabular-nums font-bold ${textClass} whitespace-nowrap`}>
            {state.countdownText}
          </span>
        </div>
        <div className="relative w-full h-1 bg-neutral-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${barClass}`}
            style={{ width: `${barWidthPct}%` }}
          />
          {isLive && (
            <>
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-px bg-neutral-950/70"
                style={{ left: `${criticalThresholdPct}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-px bg-neutral-950/70"
                style={{ left: `${warningThresholdPct}%` }}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div
        className={`p-3 border space-y-2 ${containerTintClass} ${className}`}
        title={tooltip}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 shrink-0 ${indicatorClass}`} aria-hidden="true" />
            <span className="text-neutral-300 font-semibold tracking-wide uppercase truncate">
              {label}
            </span>
            <span className="text-neutral-600" aria-hidden="true">
              ·
            </span>
            <span className={`inline-flex items-center gap-1 font-bold ${textClass} whitespace-nowrap`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{state.statusLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-neutral-500 hidden sm:inline">
              Target {state.deadlineLabel}
            </span>
            <span className={`font-mono-strict tabular-nums text-xs font-bold ${textClass}`}>
              {state.countdownText}
            </span>
          </div>
        </div>

        {/* Visual countdown bar with critical & warning breach markers */}
        <div className="space-y-1">
          <div className="relative w-full h-2 bg-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${barClass}`}
              style={{ width: `${barWidthPct}%` }}
            />
            {isLive && (
              <>
                <span
                  aria-hidden="true"
                  title={`Critical threshold (${criticalThresholdPct}%)`}
                  className="absolute top-0 bottom-0 w-0.5 bg-neutral-950/80"
                  style={{ left: `${criticalThresholdPct}%` }}
                />
                <span
                  aria-hidden="true"
                  title={`Warning threshold (${warningThresholdPct}%)`}
                  className="absolute top-0 bottom-0 w-0.5 bg-neutral-950/80"
                  style={{ left: `${warningThresholdPct}%` }}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-500 tabular-nums">
            <span>
              {state.tier === 'breached'
                ? 'Breach threshold exceeded — immediate escalation required'
                : state.tier === 'critical'
                ? `Critical breach zone (<${criticalThresholdPct}% window remaining)`
                : state.tier === 'warning'
                ? `Approaching SLA breach warning (<${warningThresholdPct}% remaining)`
                : state.tier === 'met'
                ? 'Fulfilled within agreed SLA target'
                : state.tier === 'paused'
                ? 'SLA clock paused while record is pending'
                : state.tier === 'cancelled'
                ? 'SLA tracking stopped'
                : `Healthy buffer (${state.remainingPct}% SLA window remaining)`}
            </span>
            {isLive && <span className="font-mono-strict shrink-0">{state.remainingPct}%</span>}
          </div>
        </div>
      </div>
    );
  }

  // Default: 'table' cell variant
  return (
    <div className={`min-w-[162px] max-w-[210px] space-y-1.5 ${className}`} title={tooltip}>
      <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
        <span className={`inline-flex items-center gap-1.5 font-semibold ${textClass} whitespace-nowrap`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{state.statusLabel}</span>
        </span>
        <span className={`font-mono-strict tabular-nums font-bold ${textClass} whitespace-nowrap`}>
          {state.countdownText}
        </span>
      </div>

      <div className="relative w-full h-1.5 bg-neutral-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barClass}`}
          style={{ width: `${barWidthPct}%` }}
        />
        {isLive && (
          <>
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px bg-neutral-950/75"
              style={{ left: `${criticalThresholdPct}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px bg-neutral-950/75"
              style={{ left: `${warningThresholdPct}%` }}
            />
          </>
        )}
      </div>
    </div>
  );
};
