"use client";

import { useState } from "react";
import { PERIOD_PRESETS, computePeriod, presetLabel, type PeriodPreset } from "@/lib/reports/periods";

export type AppliedPeriod = { preset: PeriodPreset; from: string; to: string; label: string };

/**
 * Sélecteur de période pour un rapport (ventilation temporelle type HubSpot).
 * Émet la période (from/to exacts) à appliquer ; le recalcul se fait côté serveur
 * avec les vrais chiffres. Ne découpe RIEN côté client.
 */
export function ReportPeriodBar({
  onApply,
  loading = false,
  activeLabel,
}: {
  onApply: (p: AppliedPeriod) => void;
  loading?: boolean;
  /** Libellé de la période actuellement appliquée (affiché à droite). */
  activeLabel?: string | null;
}) {
  const [preset, setPreset] = useState<PeriodPreset | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function choose(id: PeriodPreset) {
    setPreset(id);
    if (id === "custom") return; // on attend les dates
    const range = computePeriod(id, new Date());
    setFrom(range.from);
    setTo(range.to);
    onApply({ preset: id, from: range.from, to: range.to, label: presetLabel(id) });
  }

  function applyCustom() {
    if (!from || !to) return;
    onApply({ preset: "custom", from, to, label: `${from} → ${to}` });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        Période
      </span>
      <select
        value={preset}
        onChange={(e) => choose(e.target.value as PeriodPreset)}
        disabled={loading}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="" disabled>Choisir…</option>
        {PERIOD_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {preset === "custom" && (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-60" />
          <span className="text-[11px] text-slate-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-60" />
          <button onClick={applyCustom} disabled={loading || !from || !to}
            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Appliquer
          </button>
        </>
      )}

      {loading && <span className="text-[11px] text-slate-400">Recalcul…</span>}
      {!loading && activeLabel && (
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
          {activeLabel}
        </span>
      )}
    </div>
  );
}
