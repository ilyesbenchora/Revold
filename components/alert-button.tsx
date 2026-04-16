"use client";

import { useState } from "react";

type AlertButtonProps = {
  title: string;
  description: string;
  impact: string;
  category: string;
  forecastType?: string;
  threshold?: number;
  direction?: "above" | "below";
};

export function AlertButton({ title, description, impact, category, forecastType, threshold, direction }: AlertButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          impact,
          category,
          forecast_type: forecastType || null,
          threshold: threshold ?? null,
          direction: direction || "above",
        }),
      });
      if (res.ok) setState("done");
      else setState("idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
        Alerte activée — suivi en cours
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {state === "loading" ? "Activation..." : "Suivre cet objectif"}
    </button>
  );
}
