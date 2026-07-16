"use client";

import { useState } from "react";
import Link from "next/link";
import { ALERT_CHANNELS, SectionLabel, readable } from "./alert-ui";
import { AlertCrossTools, crossSummary, emptyCross, type CrossState, type ToolOption } from "./alert-cross-tools";
import type { ProposedAction } from "@/lib/ai/agents/agent-runtime";

/**
 * Carte de suggestion d'alerte — affichée dans l'onglet « Alertes » du chat
 * (pas dans le fil de discussion, pour ne pas casser le flux). L'utilisateur
 * peut ajuster le KPI, la période, la description, l'impact et les canaux, puis
 * activer l'alerte (écriture Supabase via /execute).
 */
export function AlertSuggestionCard({
  agentKey,
  action,
  tools = [],
  initialSources = [],
}: {
  agentKey: string;
  action: ProposedAction;
  /** Outils connectés disponibles dans le chat (pour « outils à croiser »). */
  tools?: ToolOption[];
  /** Sources déjà sélectionnées dans le chat — reprises dynamiquement. */
  initialSources?: string[];
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [channels, setChannels] = useState<string[]>(["app"]);
  const [editing, setEditing] = useState(false);
  const [kpiValue, setKpiValue] = useState("");
  const [kpiFormat, setKpiFormat] = useState<"percent" | "count">("percent");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [continuous, setContinuous] = useState(true);
  const [descEdit, setDescEdit] = useState<string | null>(null);
  const [impactEdit, setImpactEdit] = useState<string | null>(null);
  // Outils à croiser : pré-remplis avec la sélection du chat (uniquement ceux
  // réellement disponibles), + éventuel second KPI.
  const [cross, setCross] = useState<CrossState>({
    ...emptyCross,
    sources: initialSources.filter((k) => tools.some((t) => t.key === k)),
  });

  const done = state === "done";

  function toggleChannel(key: string) {
    setChannels((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function confirm() {
    setState("saving");
    const chosen = channels.length ? channels : ["app"];
    const baseDesc = descEdit ?? action.description;
    const summary = crossSummary(tools, cross);
    const finalAction = {
      ...action,
      description: summary ? `${baseDesc} · ${summary}` : baseDesc,
      impact: impactEdit ?? action.impact,
    };
    try {
      const res = await fetch(`/api/agents/${agentKey}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: finalAction,
          channels: chosen,
          threshold: kpiValue ? Number(kpiValue) : null,
          unit_mode: kpiFormat,
          date_from: dateFrom || null,
          date_to: continuous ? null : dateTo || null,
          cross_sources: cross.sources.length ? cross.sources : null,
          threshold_secondary: cross.sources.length >= 2 && cross.kpi2 ? Number(cross.kpi2) : null,
          unit_mode_secondary: cross.sources.length >= 2 && cross.kpi2 ? cross.unit2 : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-fuchsia-200 bg-white shadow-sm">
      {/* En-tête */}
      <div className="flex items-center gap-1.5 border-b border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-indigo-50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
        <span>✨</span> Alerte de suivi suggérée
      </div>

      <div className="space-y-3 p-3.5">
        {/* Objectif (gauche) + KPIs attendus (droite) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <SectionLabel>Objectif</SectionLabel>
            <div className="mt-0.5 text-sm font-semibold leading-snug text-slate-900 break-words">
              {readable(action.title)}
            </div>
          </div>
          <div>
            <SectionLabel>KPI attendu</SectionLabel>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="number"
                value={kpiValue}
                onChange={(e) => setKpiValue(e.target.value)}
                disabled={done}
                placeholder="Ex : 30"
                className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:opacity-60"
              />
              <div className="flex overflow-hidden rounded-lg border border-slate-200">
                {(["percent", "count"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setKpiFormat(f)}
                    disabled={done}
                    className={`px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                      kpiFormat === f ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {f === "percent" ? "%" : "Nombre"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Outils à croiser (pré-remplis du chat) + 2ᵉ KPI si multi-outils */}
        <AlertCrossTools tools={tools} value={cross} onChange={setCross} disabled={done} />

        {/* Période : date de début / fin (ou en continu) */}
        <div>
          <SectionLabel>Période de suivi</SectionLabel>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-slate-400">
              Début
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={done}
                className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-fuchsia-300 disabled:opacity-60" />
            </label>
            {!continuous && (
              <label className="text-[11px] text-slate-400">
                Fin
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={done}
                  className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-fuchsia-300 disabled:opacity-60" />
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} disabled={done} />
              En continu (sans date de fin)
            </label>
          </div>
        </div>

        <div>
          <SectionLabel>Description</SectionLabel>
          {editing ? (
            <textarea rows={2} value={descEdit ?? ""} onChange={(e) => setDescEdit(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100" />
          ) : (
            <p className="mt-0.5 text-sm leading-relaxed text-slate-700 break-words">
              {descEdit ?? readable(action.description)}
            </p>
          )}
        </div>
        {(editing || action.impact) && (
          <div>
            <SectionLabel>Impact attendu</SectionLabel>
            {editing ? (
              <textarea rows={2} value={impactEdit ?? ""} onChange={(e) => setImpactEdit(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100" />
            ) : (
              <p className="mt-0.5 text-sm leading-relaxed text-slate-700 break-words">
                {impactEdit ?? (action.impact ? readable(action.impact) : "")}
              </p>
            )}
          </div>
        )}

        <div>
          <SectionLabel>Recevoir l&apos;alerte via</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ALERT_CHANNELS.map((c) => {
              const on = channels.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleChannel(c.key)}
                  disabled={done || state === "saving"}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-70 ${
                    on
                      ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm">{c.icon}</span>
                  {c.label}
                  {on && <span className="text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {done ? (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Alerte activée —{" "}
              <Link href="/dashboard/alertes" className="underline hover:text-emerald-700">
                voir mes alertes
              </Link>
            </span>
          ) : (
            <>
              <button
                onClick={confirm}
                disabled={state === "saving"}
                className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {state === "saving" ? "Activation…" : "Activer l'alerte"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editing) {
                    setDescEdit(descEdit ?? readable(action.description));
                    setImpactEdit(impactEdit ?? (action.impact ? readable(action.impact) : ""));
                  }
                  setEditing((v) => !v);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {editing ? "✓ Terminer la modification" : "Modifier l'alerte"}
              </button>
            </>
          )}
          {state === "error" && <span className="text-xs text-red-500">Échec de la création.</span>}
        </div>
      </div>
    </div>
  );
}
