"use client";

/**
 * Client wrapper that displays a list of integration cards with a "show more"
 * pattern: by default only the first N (default 2) cards are visible, the
 * rest are hidden behind a "Voir les X autres applications" button.
 */

import { useState, type ReactNode } from "react";

type Props = {
  totalCount: number;
  visibleByDefault?: number;
  /** Pre-rendered integration cards (server components rendered into JSX). */
  children: ReactNode[];
};

export function ExpandableIntegrationsList({
  totalCount,
  visibleByDefault = 2,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const cards = Array.isArray(children) ? children : [children];
  const visibleCards = expanded ? cards : cards.slice(0, visibleByDefault);
  const hiddenCount = Math.max(0, totalCount - visibleByDefault);

  return (
    <div className="space-y-3">
      {visibleCards}
      {hiddenCount > 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {expanded ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                Réduire
              </>
            ) : (
              <>
                Voir les {hiddenCount} autres applications
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
