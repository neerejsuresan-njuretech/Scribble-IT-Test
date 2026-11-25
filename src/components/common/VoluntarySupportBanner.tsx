import React, { useState, useEffect } from 'react';
import { Heart, X, ExternalLink } from 'lucide-react';
import {
  OPEN_SOURCE_CONFIG,
  PROJECT_IDENTITY,
  isConfiguredUrl,
} from '../../config/openSourceConfig';

export const VoluntarySupportBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    // Respect 14-day dismissal window and wait >= 12s dwell before showing
    const dismissedAt = localStorage.getItem('scribble_support_dismissed_at');
    if (dismissedAt) {
      const parsedTime = parseInt(dismissedAt, 10);
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsedTime < fourteenDaysMs) {
        return;
      }
    }
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('scribble_support_dismissed_at', Date.now().toString());
  };

  if (!isVisible) return null;

  const primarySupportUrl = isConfiguredUrl(OPEN_SOURCE_CONFIG.supportPaymentUrl)
    ? OPEN_SOURCE_CONFIG.supportPaymentUrl
    : isConfiguredUrl(OPEN_SOURCE_CONFIG.githubSponsorsUrl)
      ? OPEN_SOURCE_CONFIG.githubSponsorsUrl
      : isConfiguredUrl(OPEN_SOURCE_CONFIG.buyMeACoffeeUrl)
        ? OPEN_SOURCE_CONFIG.buyMeACoffeeUrl
        : '';

  return (
    <aside
      aria-label="Voluntary Project Support"
      className="fixed bottom-4 right-4 z-50 max-w-sm border border-neutral-800 bg-neutral-950/95 backdrop-blur-md p-4 shadow-2xl rounded-lg text-xs text-neutral-300 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-rose-400 font-semibold">
          <Heart className="w-4 h-4 shrink-0" />
          <span>Support {PROJECT_IDENTITY.productName}</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss support prompt"
          className="text-neutral-500 hover:text-neutral-300 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-neutral-400 leading-relaxed">
        {PROJECT_IDENTITY.productName} is free and open source under GNU AGPL-3.0. Voluntary support
        helps {PROJECT_IDENTITY.organizationFull} sustain open development and security audits.
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {primarySupportUrl && (
          <a
            href={primarySupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Support Development</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {isConfiguredUrl(OPEN_SOURCE_CONFIG.githubRepoUrl) && (
          <a
            href={OPEN_SOURCE_CONFIG.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-300 underline whitespace-nowrap"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
};
