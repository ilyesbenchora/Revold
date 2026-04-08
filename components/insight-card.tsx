"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  templateKey: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  recommendation: string;
  hubspotUrl?: string;
};

const severityConfig = {
  critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", label: "Critique" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention" },
  info: { bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700", label: "Info" },
} as const;

export function InsightCard({ templateKey, severity, title, body, recommendation, hubspotUrl }: Props) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const [hidden, setHidden] = useState(false);
  const config = severityConfig[severity];

  async function handleMarkDone() {
    setMarking(true);
    try {
      const res = await fetch("/api/insights/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey }),
      });
      if (res.ok) {
        setHidden(true);
        router.refresh();
      } else {
        setMarking(false);
      }
    } catch {
      setMarking(false);
    }
  }

  if (hidden) return null;

  return (
    <article className={`rounded-xl border p-5 transition ${config.border} ${config.bg} ${marking ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.badge}`}>{config.label}</span>
        </div>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-700">{body}</p>
      <div className="mt-3 rounded-lg bg-white/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommandation</p>
        <p className="mt-1 text-sm font-medium text-slate-800">{recommendation}</p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {hubspotUrl && (
          <a
            href={hubspotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
          >
            À faire dans HubSpot
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
        <button
          onClick={handleMarkDone}
          disabled={marking}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {marking ? "Marquage..." : "Marquer comme fait"}
        </button>
      </div>
    </article>
  );
}
