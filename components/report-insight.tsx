"use client";

import { useState } from "react";

type Props = {
  headline: string;
  detail: string | null;
  caveat: string | null;
};

export function ReportInsight({ headline, detail, caveat }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = detail || caveat;

  return (
    <div className="mt-1.5">
      <p className="text-[10px] text-slate-600 leading-relaxed">{headline}</p>
      {hasMore && (
        <>
          {expanded && (
            <div className="mt-1 space-y-1.5">
              {detail && (
                <p className="text-[10px] text-slate-500 leading-relaxed">{detail}</p>
              )}
              {caveat && (
                <p className="text-[10px] text-amber-600 leading-relaxed">
                  ⚠ {caveat}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-[9px] font-medium text-accent hover:underline"
          >
            {expanded ? "Voir moins ▲" : "Lire l'analyse ▼"}
          </button>
        </>
      )}
    </div>
  );
}
