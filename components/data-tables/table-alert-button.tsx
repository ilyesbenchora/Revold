"use client";

import { useState } from "react";
import type { SavedTable } from "./data-table-card";

type Row = { name: string; value: number };
type Unit = "percent" | "currency" | "count";

const CHANNELS: { key: string; icon: string; label: string }[] = [
  { key: "in_app", icon: "🔔", label: "App Revold" },
  { key: "email", icon: "📧", label: "Email" },
  { key: "slack", icon: "💬", label: "Slack" },
  { key: "teams", icon: "👥", label: "Teams" },
];

function unitSym(u: Unit): string {
  return u === "percent" ? "%" : u === "currency" ? "€" : "#";
}

/**
 * CTA « alerte technique » chirurgical, propre à une table de données : on ne
 * suit QUE ce que la table expose (son total ou une de ses lignes), avec un
 * seuil, une période, des canaux et une description pour l'agent. Table croisée
 * (KPI perso) → possibilité d'un 2ᵉ KPI.
 */
export function TableAlertButton({ table, rows, team }: { table: SavedTable; rows: Row[]; team: string }) {
  const baseUnit = (table.unit_mode as Unit) || "count";
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(`Alerte — ${table.title}`);
  const [target, setTarget] = useState("Total"); // "Total" ou nom de ligne
  const [threshold, setThreshold] = useState("");
  const [unit, setUnit] = useState<Unit>(baseUnit);
  const [direction, setDirection] = useState<"above" | "below">("above");
  // 2ᵉ KPI — pertinent pour une table croisée (KPI personnalisé).
  const crossed = Boolean(table.custom_kpi);
  const [second, setSecond] = useState(false);
  const [threshold2, setThreshold2] = useState("");
  const [unit2, setUnit2] = useState<Unit>(baseUnit);
  const [continuous, setContinuous] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [description, setDescription] = useState("");
  const [channels, setChannels] = useState<string[]>(["in_app"]);

  function reset() {
    setState("idle"); setError(null);
    setTitle(`Alerte — ${table.title}`); setTarget("Total"); setThreshold(""); setUnit(baseUnit);
    setDirection("above"); setSecond(false); setThreshold2(""); setUnit2(baseUnit);
    setContinuous(true); setDateFrom(""); setDateTo(""); setDescription(""); setChannels(["in_app"]);
  }
  function toggleChannel(k: string) {
    setChannels((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!threshold) { setError("Renseigne le KPI à surveiller."); return; }
    setState("saving"); setError(null);

    const parts = [`Alerte technique sur la table « ${table.title} » (${table.entity} · groupé par ${table.group_by}).`];
    parts.push(`Donnée suivie : ${target}.`);
    parts.push(`KPI à surveiller : ${direction === "below" ? "≤" : "≥"} ${threshold}${unitSym(unit)}.`);
    const secondary = second && threshold2
      ? [{ source: "kpi_2", value: Number(threshold2), unit_mode: unit2 }]
      : [];
    if (secondary.length) parts.push(`2ᵉ KPI (table croisée) : ${threshold2}${unitSym(unit2)}.`);
    parts.push(`Période : ${continuous ? "en continu" : `${dateFrom || "…"} → ${dateTo || "…"}`}.`);
    if (description.trim()) parts.push(`Contexte : ${description.trim()}`);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Alerte — ${table.title}`,
          description: parts.join(" "),
          impact: `Surveillance chirurgicale de « ${target} » sur la table ${table.title}`,
          category: team,
          team,
          forecast_type: null,
          threshold: Number(threshold),
          direction,
          unit_mode: unit,
          priority: "moyen",
          continuous,
          date_from: continuous ? null : dateFrom || null,
          date_to: continuous ? null : dateTo || null,
          user_context: description.trim() || null,
          notification_channels: channels.length ? channels : ["in_app"],
          threshold_secondary: secondary.length ? secondary[0].value : null,
          unit_mode_secondary: secondary.length ? secondary[0].unit_mode : null,
          secondary_kpis: secondary.length ? secondary : null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Création impossible."); setState("idle"); return; }
      setState("done");
      setTimeout(() => { setOpen(false); reset(); }, 1600);
    } catch {
      setError("Création impossible."); setState("idle");
    }
  }

  const lbl = "mb-1 block text-[11px] font-medium text-slate-500";
  const inp = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100";

  return (
    <>
      {/* CTA discret rouge/fuchsia */}
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        title="Créer une alerte chirurgicale sur cette table"
        className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-200 bg-gradient-to-r from-rose-50 to-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:from-rose-100 hover:to-fuchsia-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        Alerte
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => { if (state !== "saving") { setOpen(false); reset(); } }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="max-h-[90vh] w-full max-w-md space-y-3.5 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            {state === "done" ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-600"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Alerte technique créée</p>
                <p className="mt-1 text-xs text-slate-500">Elle apparaît dans Mes alertes et la cloche.</p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                    <span className="h-2 w-2 rounded-full bg-fuchsia-500" /> Alerte technique
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">Chirurgicale, sur les données de « {table.title} » uniquement.</p>
                </div>

                <div>
                  <label className={lbl}>Titre de l&apos;alerte</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
                </div>

                <div>
                  <label className={lbl}>Donnée à suivre</label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={inp}>
                    <option value="Total">Total de la table</option>
                    {rows.map((r) => (
                      <option key={r.name} value={r.name}>{r.name || "—"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={lbl}>KPI à surveiller</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Ex : 20" className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />
                    <div className="flex overflow-hidden rounded-lg border border-slate-200">
                      {(["percent", "currency", "count"] as const).map((u) => (
                        <button key={u} type="button" onClick={() => setUnit(u)} className={`px-2.5 py-1.5 text-xs font-medium transition ${unit === u ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{unitSym(u)}</button>
                      ))}
                    </div>
                    <div className="flex overflow-hidden rounded-lg border border-slate-200">
                      {(["above", "below"] as const).map((d) => (
                        <button key={d} type="button" onClick={() => setDirection(d)} className={`px-2.5 py-1.5 text-sm font-medium transition ${direction === d ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{d === "above" ? "↑" : "↓"}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {crossed && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                      <input type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} /> Table croisée : suivre un 2ᵉ KPI
                    </label>
                    {second && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input type="number" step="any" value={threshold2} onChange={(e) => setThreshold2(e.target.value)} placeholder="Ex : 15" className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100" />
                        <div className="flex overflow-hidden rounded-lg border border-slate-200">
                          {(["percent", "currency", "count"] as const).map((u) => (
                            <button key={u} type="button" onClick={() => setUnit2(u)} className={`px-2.5 py-1.5 text-xs font-medium transition ${unit2 === u ? "bg-fuchsia-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{unitSym(u)}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className={lbl}>Période d&apos;analyse</label>
                  <div className="mb-1.5 flex overflow-hidden rounded-lg border border-slate-200">
                    <button type="button" onClick={() => setContinuous(true)} className={`flex-1 px-3 py-1.5 text-xs font-medium transition ${continuous ? "bg-fuchsia-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>En continu</button>
                    <button type="button" onClick={() => setContinuous(false)} className={`flex-1 px-3 py-1.5 text-xs font-medium transition ${!continuous ? "bg-fuchsia-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Plage de dates</button>
                  </div>
                  {!continuous && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inp} />
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inp} />
                    </div>
                  )}
                </div>

                <div>
                  <label className={lbl}>Description (pour l&apos;agent)</label>
                  <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : alerter si cette ligne décroche vs le mois dernier." className={`${inp} resize-none`} />
                </div>

                <div>
                  <label className={lbl}>Canaux de notification</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANNELS.map((c) => {
                      const on = channels.includes(c.key);
                      return (
                        <button key={c.key} type="button" onClick={() => toggleChannel(c.key)}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${on ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                          <span>{c.icon}</span>{c.label}{on && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-xs text-slate-400 hover:text-fuchsia-600">Annuler</button>
                  <button type="submit" disabled={state === "saving" || !threshold}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-50">
                    {state === "saving" ? "Création…" : "Créer l'alerte"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
