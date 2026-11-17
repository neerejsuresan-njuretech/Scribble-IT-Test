import React from 'react';
import { useITSM } from '../../context/ITSMContext';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastVariant } from '../../types/itsm';

const VARIANT_STYLES: Record<ToastVariant, { border: string; iconColor: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  success: {
    border: 'border-emerald-700/80',
    iconColor: 'text-emerald-400',
    label: 'SUCCESS',
    Icon: CheckCircle2
  },
  error: {
    border: 'border-rose-700/80',
    iconColor: 'text-rose-400',
    label: 'ERROR',
    Icon: XCircle
  },
  warning: {
    border: 'border-amber-700/80',
    iconColor: 'text-amber-400',
    label: 'NOTICE',
    Icon: AlertTriangle
  },
  info: {
    border: 'border-sky-700/80',
    iconColor: 'text-sky-400',
    label: 'UPDATED',
    Icon: Info
  }
};

export const ToastViewport: React.FC = () => {
  const { toasts, dismissToast } = useITSM();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-12 right-4 z-50 w-full max-w-sm space-y-2 pointer-events-none font-mono text-xs"
    >
      {toasts.map(toast => {
        const cfg = VARIANT_STYLES[toast.variant];
        const Icon = cfg.Icon;
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto border ${cfg.border} bg-neutral-950/95 shadow-2xl p-3.5 flex items-start gap-3 transition-all`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold tracking-wider ${cfg.iconColor}`}>
                  {cfg.label}
                </span>
                <span className="text-[10px] text-neutral-500 tabular-nums">
                  {new Date(toast.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="text-neutral-100 font-bold mt-0.5 truncate">
                {toast.title}
              </div>
              {toast.description && (
                <div className="text-[11px] text-neutral-400 mt-0.5 break-words">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-neutral-500 hover:text-neutral-200 p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
