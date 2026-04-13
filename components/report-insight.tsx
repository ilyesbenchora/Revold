"use client";

import { useState } from "react";

type Props = {
  headline: string;
  detail: string | null;
};

export function ReportInsight({ headline, detail }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5">
      <p className="text-[10px] text-slate-600 leading-relaxed">{headline}</p>
      {detail && (
        <>
          {expanded && (
            <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">{detail}</p>
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
