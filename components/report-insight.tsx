"use client";

import { useState } from "react";

type Props = {
  headline: string;
  detail: string | null;
  caveat: string | null;
};

function formatText(text: string) {
  // Split by \n\n for paragraphs, then handle **bold** and section headers
  const paragraphs = text.split("\n\n").filter(Boolean);

  return paragraphs.map((para, pIdx) => {
    const trimmed = para.trim();

    // Detect section headers: **Décision**, **Plan d'action**, **Action**, **Objectif**, etc.
    const sectionMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*:\s*([\s\S]*)/);
    if (sectionMatch) {
      const label = sectionMatch[1].trim();
      const content = sectionMatch[2].trim();

      // Color-code sections
      let labelColor = "text-slate-700 bg-slate-100";
      let borderColor = "border-l-slate-300";
      if (label.toLowerCase().includes("décision")) { labelColor = "text-fuchsia-700 bg-fuchsia-50"; borderColor = "border-l-fuchsia-400"; }
      else if (label.toLowerCase().includes("plan d'action") || label.toLowerCase().includes("action")) { labelColor = "text-indigo-700 bg-indigo-50"; borderColor = "border-l-indigo-400"; }
      else if (label.toLowerCase().includes("objectif")) { labelColor = "text-emerald-700 bg-emerald-50"; borderColor = "border-l-emerald-400"; }
      else if (label.toLowerCase().includes("tendance")) { labelColor = "text-blue-700 bg-blue-50"; borderColor = "border-l-blue-400"; }
      else if (label.toLowerCase().includes("seuil")) { labelColor = "text-amber-700 bg-amber-50"; borderColor = "border-l-amber-400"; }

      // Parse inline **bold**
      const parts = renderBold(content);

      return (
        <div key={pIdx} className={`border-l-2 ${borderColor} pl-3 py-1.5`}>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${labelColor} mb-1`}>
            {label}
          </span>
          <p className="text-[11px] text-slate-600 leading-relaxed">{parts}</p>
        </div>
      );
    }

    // Regular paragraph with **bold** support
    return (
      <p key={pIdx} className="text-[11px] text-slate-600 leading-relaxed">
        {renderBold(trimmed)}
      </p>
    );
  });
}

function renderBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<span key={`b${idx++}`} className="font-semibold text-slate-800">{match[1]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`e${idx}`}>{text.slice(lastIndex)}</span>);
  }
  return parts;
}

export function ReportInsight({ headline, detail, caveat }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = detail || caveat;

  return (
    <div className="mt-2">
      {/* Headline */}
      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-medium text-slate-800 leading-relaxed">{renderBold(headline)}</p>
      </div>

      {hasMore && (
        <>
          {expanded && (
            <div className="mt-2 space-y-2.5 px-1">
              {detail && formatText(detail)}
              {caveat && (
                <div className="border-l-2 border-l-amber-400 pl-3 py-1.5">
                  <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 mb-1">
                    Attention
                  </span>
                  <p className="text-[11px] text-amber-700 leading-relaxed">{caveat}</p>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-3 py-1 text-[10px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
          >
            {expanded ? "Réduire l'analyse ▲" : "Lire l'analyse CRO ▼"}
          </button>
        </>
      )}
    </div>
  );
}
