import React, { useState, useEffect } from 'react';
import { Heart, X, Coffee, ExternalLink } from 'lucide-react';
import { OPEN_SOURCE_CONFIG } from '../../config/openSourceConfig';

export const VoluntarySupportBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    // Check if dismissed recently (e.g. within 14 days)
    const dismissedAt = localStorage.getItem('scribble_support_dismissed_at');
    if (dismissedAt) {
      const parsedTime = parseInt(dismissedAt, 10);
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsedTime < fourteenDaysMs) {
        return;
      }
    }
    // Show banner after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('scribble_support_dismissed_at', Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Voluntary Supporter Program"
      className="fixed bottom-4 right-4 z-50 max-w-sm border border-neutral-800 bg-neutral-950/95 backdrop-blur-md p-4 shadow-2xl rounded-lg text-xs text-neutral-300 space-y-3 animate-fade-in"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-rose-400 font-semibold">
          <Heart className="w-4 h-4 fill-current shrink-0" />
          <span>Voluntary Supporter Program</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss supporter banner"
          className="text-neutral-500 hover:text-neutral-300 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-neutral-400 leading-relaxed">
        Scribble-IT is free to self-host and use under the AGPL-3.0 license. If your organization finds value in our platform, consider supporting ongoing development by Njure Group.
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {OPEN_SOURCE_CONFIG.buyMeACoffeeUrl && (
          <a
            href={OPEN_SOURCE_CONFIG.buyMeACoffeeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded inline-flex items-center gap-1.5"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Support Project</span>
          </a>
        )}
        <a
          href={OPEN_SOURCE_CONFIG.githubRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold rounded inline-flex items-center gap-1.5"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-300 underline"
        >
          Dismiss (14 days)
        </button>
      </div>
    </aside>
  );
};
