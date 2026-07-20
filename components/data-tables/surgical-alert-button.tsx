"use client";

import { useCallback, useEffect, useState } from "react";

export type SurgicalUnit = "percent" | "currency" | "count";

/**
 * Clé stable identifiant la table/bloc qui porte l'alerte, dérivée de son titre
 * (et sous-titre) : permet de recompter les alertes posées dessus et d'y
 * renvoyer, sans avoir à câbler un identifiant à travers chaque page.
 */
export function blockSourceKey(title: string, subtitle?: string): string {
  return [title, subtitle]
    .filter(Boolean)
    .join("|")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

type LinkedAlert = { id: string; title: string; status: string };
export type SurgicalRow = { name: string; value: number };

/**
 * Spec d'agrégat canonique rejouée par le cron (`valueFromAggSpec`) pour
 * rapprocher l'alerte des VRAIES données. `target` est ajouté à la volée selon
 * la ligne choisie. Laisser `undefined` quand la donnée du bloc n'est pas
 * reproductible via `computeAggregate` (ex : un taux de conversion) : l'API
 * bascule alors sur la résolution par l'agent.
 */
export type SurgicalAggSpec = {
  entity: string;
  groupBy: string;
  measure: string;
  field?: string | null;
  /** Conversion linéaire déterministe (ex : 12 pour MRR → ARR). */
  multiplier?: number | null;
  /**
   * Deals uniquement : restreint l'agrégat à UN pipeline (id HubSpot ou nom).
   * Sans lui, `groupBy: "stage"` agrège les étapes homonymes de tous les
   * pipelines — donc une alerte fausse.
   */
  pipeline?: string | null;
};

const CHANNELS: { key: string; icon: string; label: string }[] = [
  { key: "in_app", icon: "🔔", label: "App Revold" },
  { key: "email", icon: "📧", label: "Email" },
  { key: "slack", icon: "💬", label: "Slack" },
  { key: "teams", icon: "👥", label: "Teams" },
];

function unitSym(u: SurgicalUnit): string {
  return u === "percent" ? "%" : u === "currency" ? "€" : "#";
}

/**
 * CTA « alerte technique » chirurgical, générique : on ne suit QUE ce que la
 * source expose (son total ou une de ses lignes), avec un seuil, une période,
 * des canaux et une description pour l'agent. Utilisé aussi bien par les tables
 * de données sauvegardées que par les blocs métier convertis en table
 * (pipeline management, taux de conversion, facturation…).
 */
export function SurgicalAlertButton({
  title,
  scopeLabel,
  impactScope,
  rows,
  team,
  unit: baseUnit = "count",
  aggSpec,
  crossed = false,
  allowTotal = true,
  totalLabel = "Total du bloc",
  sourceKey,
}: {
  /** Nom affiché de la source (bloc ou table). */
  title: string;
  /** Phrase de contexte pour l'agent, ex : « la table « X » (deals · groupé par stage) ». */
  scopeLabel: string;
  /** Portée courte reprise dans le champ `impact`, ex : « la table X ». */
  impactScope: string;
  rows: SurgicalRow[];
  team: string;
  unit?: SurgicalUnit;
  aggSpec?: SurgicalAggSpec;
  /** Table/bloc croisé (KPI perso) → propose un 2ᵉ KPI. */
  crossed?: boolean;
  /** false quand les lignes ont des unités hétérogènes : un total n'y a aucun sens. */
  allowTotal?: boolean;
  totalLabel?: string;
  /** Identifie la table pour compter les alertes déjà posées dessus. */
  sourceKey?: string;
}) {
  const defaultTarget = allowTotal ? "Total" : rows[0]?.name ?? "Total";
  const key = sourceKey ?? blockSourceKey(title);
  const [linked, setLinked] = useState<LinkedAlert[]>([]);

  const refreshLinked = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?source_key=${encodeURIComponent(key)}`);
      if (!res.ok) return;
      const d = await res.json();
      setLinked(Array.isArray(d.alerts) ? d.alerts : []);
    } catch {
      /* compteur best-effort : jamais bloquant pour la table */
    }
  }, [key]);

  useEffect(() => { refreshLinked(); }, [refreshLinked]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const [alertTitle, setAlertTitle] = useState(`Alerte — ${title}`);
  const [target, setTarget] = useState(defaultTarget); // "Total" ou nom de ligne
  const [threshold, setThreshold] = useState("");
  const [unit, setUnit] = useState<SurgicalUnit>(baseUnit);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [second, setSecond] = useState(false);
  const [threshold2, setThreshold2] = useState("");
  const [unit2, setUnit2] = useState<SurgicalUnit>(baseUnit);
  const [continuous, setContinuous] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [description, setDescription] = useState("");
  const [channels, setChannels] = useState<string[]>(["in_app"]);

  function reset() {
    setState("idle"); setError(null);
    setAlertTitle(`Alerte — ${title}`); setTarget(defaultTarget); setThreshold(""); setUnit(baseUnit);
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

    const parts = [`Alerte technique sur ${scopeLabel}.`];
    parts.push(`Donnée suivie : ${target}.`);
    parts.push(`KPI à surveiller : ${direction === "below" ? "≤" : "≥"} ${threshold}${unitSym(unit)}.`);
    const secondary = second && threshold2
      ? [{ source: "kpi_2", value: Number(threshold2), unit_mode: unit2 }]
      : [];
    if (secondary.length) parts.push(`2ᵉ KPI (croisé) : ${threshold2}${unitSym(unit2)}.`);
    parts.push(`Période : ${continuous ? "en continu" : `${dateFrom || "…"} → ${dateTo || "…"}`}.`);
    if (description.trim()) parts.push(`Contexte : ${description.trim()}`);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alertTitle.trim() || `Alerte — ${title}`,
          description: parts.join(" "),
          impact: `Surveillance chirurgicale de « ${target} » sur ${impactScope}`,
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
          source_key: key,
          threshold_secondary: secondary.length ? secondary[0].value : null,
          unit_mode_secondary: secondary.length ? secondary[0].unit_mode : null,
          secondary_kpis: secondary.length ? secondary : null,
          // Rapprochement données réelles : le cron rejoue cette agrégation.
          // Absente (bloc non reproductible en agrégat) → l'API laisse l'agent
          // rattacher le KPI aux vraies données.
          agg_spec: aggSpec
            ? {
                entity: aggSpec.entity,
                groupBy: aggSpec.groupBy,
                measure: aggSpec.measure,
                field: aggSpec.field ?? null,
                multiplier: aggSpec.multiplier ?? null,
                pipeline: aggSpec.pipeline ?? null,
                target,
              }
            : null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Création impossible."); setState("idle"); return; }
      setState("done");
      refreshLinked();
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
        title="Créer une alerte chirurgicale sur ces données"
        className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-200 bg-gradient-to-r from-rose-50 to-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:from-rose-100 hover:to-fuchsia-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        Alerte
      </button>

      {/* Alertes déjà posées sur cette table : compteur + accès direct. */}
      {linked.length > 0 && (
        <a
          href={`/dashboard/mes-alertes#alerte-${linked[0].id}`}
          title={
            linked.length === 1
              ? `Voir l'alerte « ${linked[0].title} »`
              : `Voir les ${linked.length} alertes posées sur cette table`
          }
          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
        >
          {linked.length === 1 ? "1 alerte" : `${linked.length} alertes`}
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
        </a>
      )}

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
                  <p className="mt-0.5 text-xs text-slate-500">Chirurgicale, sur les données de « {title} » uniquement.</p>
                </div>

                <div>
                  <label className={lbl}>Titre de l&apos;alerte</label>
                  <input value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} className={inp} />
                </div>

                <div>
                  <label className={lbl}>Donnée à suivre</label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={inp}>
                    {allowTotal && <option value="Total">{totalLabel}</option>}
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
                      <input type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} /> Donnée croisée : suivre un 2ᵉ KPI
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
