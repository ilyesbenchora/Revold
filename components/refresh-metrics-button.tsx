"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshMetricsButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleRefresh() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/refresh-metrics", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.updated > 0) {
          setResult(`${data.updated} rapport(s) mis à jour`);
          router.refresh();
        } else {
          setResult("Tous les rapports sont à jour");
        }
      }
    } catch {
      setResult("Erreur");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-slate-500">{result}</span>}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
        {busy ? "Mise à jour..." : "Actualiser les métriques"}
      </button>
    </div>
  );
}
