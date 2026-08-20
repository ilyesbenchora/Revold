"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { entityLabel, dimLabel, fieldLabel } from "@/lib/reports/data-table-presets";
import { InfoHint } from "@/components/info-hint";
import { DictationButton } from "@/components/voice/dictation-button";
import { WiredToolsRow } from "@/components/wired-tools-row";

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
  /** Outils sources de la table d'origine — le cron applique le même filtre. */
  sources?: string[] | null;
};

function unitSym(u: SurgicalUnit): string {
  return u === "percent" ? "%" : u === "currency" ? "€" : "#";
}

function fmtVal(v: number, u: SurgicalUnit): string {
  if (u === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (u === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

function measurePhrase(spec: SurgicalAggSpec): string {
  const m = spec.measure ?? "count";
  if (m === "count" || !spec.field) return "Nombre de lignes";
  const f = fieldLabel(spec.entity, spec.field);
  if (m === "avg") return `Moyenne · ${f}`;
  if (m === "weighted") return `Projection pondérée · ${f}`;
  return `Somme · ${f}`;
}

type PipelineOption = { id: string; name: string };
type VerifyState = {
  loading: boolean;
  rowCount: number | null;
  targetValue: number | null;
  error: string | null;
};

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
  iconOnly = false,
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
  /** Déclencheur compact : cloche seule, sans libellé (petits blocs / tuiles). */
  iconOnly?: boolean;
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

  // La modale est montée dans <body> plutôt qu'à côté du bouton : un ancêtre
  // avec `transform` (carrousel pipeline) redéfinit le bloc conteneur de
  // `position: fixed`, et la modale s'ouvrait hors écran / clippée — le clic
  // semblait ne rien faire. Le portal rend le composant utilisable dans
  // n'importe quel conteneur, transformé ou non.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  // Étape de CONFIRMATION avant création : le câblage réel (source, pipeline,
  // regroupement, mesure) + la valeur actuelle calculée + le récap de l'alerte.
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [pipeline, setPipeline] = useState<string | null>(aggSpec?.pipeline ?? null);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [verify, setVerify] = useState<VerifyState>({ loading: false, rowCount: null, targetValue: null, error: null });

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
  // Portée : « personal » (mon suivi) ou « team » (partagé avec l'équipe) —
  // même sélecteur que le formulaire d'alerte classique. Les CANAUX, eux,
  // sont gérés centralement dans Mon compte → Notifications.
  const [scope, setScope] = useState<"personal" | "team">("personal");

  function reset() {
    setState("idle"); setError(null); setStep("form");
    setPipeline(aggSpec?.pipeline ?? null);
    setVerify({ loading: false, rowCount: null, targetValue: null, error: null });
    setAlertTitle(`Alerte — ${title}`); setTarget(defaultTarget); setThreshold(""); setUnit(baseUnit);
    setDirection("above"); setSecond(false); setThreshold2(""); setUnit2(baseUnit);
    setContinuous(true); setDateFrom(""); setDateTo(""); setDescription("");
    setScope("personal");
  }

  /** Recalcule la donnée avec le câblage courant (dont le pipeline choisi). */
  const runVerify = useCallback(async (pipelineOverride: string | null) => {
    if (!aggSpec) return;
    setVerify((v) => ({ ...v, loading: true, error: null }));
    try {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: {
            entity: aggSpec.entity,
            groupBy: aggSpec.groupBy,
            measure: aggSpec.measure,
            field: aggSpec.field ?? undefined,
            pipeline: pipelineOverride ?? undefined,
          },
          sources: aggSpec.sources ?? [],
          all: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Recalcul impossible");
      const data = (d.data ?? []) as SurgicalRow[];
      const targetValue =
        target === "Total"
          ? data.reduce((s, r) => s + (Number(r.value) || 0), 0)
          : data.find((r) => r.name === target)?.value ?? null;
      setVerify({
        loading: false,
        rowCount: Number(d.totalRows) || data.length,
        targetValue: targetValue == null ? null : Number(targetValue),
        error: targetValue == null && target !== "Total" ? `La ligne « ${target} » n'existe pas avec ce câblage.` : null,
      });
    } catch (e) {
      setVerify({ loading: false, rowCount: null, targetValue: null, error: e instanceof Error ? e.message : "Recalcul impossible" });
    }
  }, [aggSpec, target]);

  /** Étape 1 → 2 : validation du formulaire puis vérification du câblage. */
  async function goConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!threshold) { setError("Renseigne le KPI à surveiller."); return; }
    setError(null);
    setStep("confirm");
    if (aggSpec) {
      // Pipelines de deals : sans restriction, les étapes homonymes de TOUS les
      // pipelines s'agrègent — la confirmation permet de choisir le bon.
      if (aggSpec.entity === "deals" && pipelines.length === 0) {
        fetch("/api/pipelines")
          .then((r) => (r.ok ? r.json() : { pipelines: [] }))
          .then((d) => setPipelines(Array.isArray(d.pipelines) ? d.pipelines : []))
          .catch(() => { /* sélecteur simplement absent */ });
      }
      runVerify(pipeline);
    }
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
          // Canaux gérés centralement (Mon compte → Notifications).
          scope,
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
                // Pipeline CONFIRMÉ à l'étape de vérification (peut différer de
                // celui de la table si l'utilisateur l'a corrigé).
                pipeline: pipeline ?? null,
                sources: aggSpec.sources?.length ? aggSpec.sources : null,
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
      {/* CTA discret rouge/fuchsia — cloche seule en mode compact (tuiles). */}
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        title="Créer une alerte chirurgicale sur ces données"
        className={iconOnly
          ? "inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-300 transition hover:bg-fuchsia-50 hover:text-fuchsia-600"
          : "inline-flex items-center gap-1 rounded-lg border border-fuchsia-200 bg-gradient-to-r from-rose-50 to-fuchsia-50 px-2 py-1 text-[11px] font-semibold text-fuchsia-700 transition hover:border-fuchsia-300 hover:from-rose-100 hover:to-fuchsia-100"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        {!iconOnly && "Alerte"}
      </button>

      {/* Alertes déjà posées sur cette table : compteur + accès direct (masqué en mode compact). */}
      {!iconOnly && linked.length > 0 && (
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

      {open && mounted && createPortal(
        /* dashboard-shell : le portal sort du shell → sans ce marqueur, le
           remap des thèmes sombres ne s'applique pas et la modale reste
           BLANCHE sur fond violet. */
        <div className="dashboard-shell fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => { if (state !== "saving") { setOpen(false); reset(); } }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={step === "form" ? goConfirm : submit} className="max-h-[90vh] w-full max-w-md space-y-3.5 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            {state === "done" ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-600"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Alerte technique créée</p>
                <p className="mt-1 text-xs text-slate-500">Elle apparaît dans Mes alertes et la cloche.</p>
              </div>
            ) : step === "confirm" ? (
              <>
                <div>
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                    <span className="h-2 w-2 rounded-full bg-fuchsia-500" /> Vérification avant création
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Le câblage réel de l&apos;alerte et son contenu — ce qui est affiché est exactement ce qui sera surveillé.
                  </p>
                </div>

                {/* ── Câblage sur les données ── */}
                {aggSpec ? (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">✨ Câblage sur les données</p>
                    <dl className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Source de données</dt>
                        <dd className="text-xs font-semibold text-slate-900">{entityLabel(aggSpec.entity)}</dd>
                      </div>
                      {/* Outil(s) connecté(s) qui alimentent cette entité. */}
                      <WiredToolsRow entity={aggSpec.entity} sourceKeys={aggSpec.sources ?? null} />
                      {aggSpec.entity === "deals" && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                            Pipeline
                            <InfoHint text="Sans restriction de pipeline, les étapes homonymes de TOUS les pipelines s'agrègent — l'alerte serait fausse. Choisis le pipeline explicité dans le titre de la table." />
                          </dt>
                          <dd className="min-w-0">
                            <select
                              value={pipeline ?? ""}
                              disabled={verify.loading}
                              onChange={(e) => { const p = e.target.value || null; setPipeline(p); runVerify(p); }}
                              className={`w-full max-w-48 rounded-lg border px-2 py-1 text-xs font-medium outline-none focus:border-fuchsia-400 ${pipeline ? "border-slate-200 bg-white text-slate-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}
                            >
                              <option value="">⚠ Tous les pipelines (mélange)</option>
                              {pipelines.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                              {pipeline && !pipelines.some((p) => p.id === pipeline) && (
                                <option value={pipeline}>{pipeline}</option>
                              )}
                            </select>
                          </dd>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Regroupement</dt>
                        <dd className="text-xs font-semibold text-slate-900">{dimLabel(aggSpec.entity, aggSpec.groupBy)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Mesure</dt>
                        <dd className="text-xs font-semibold text-slate-900">{measurePhrase(aggSpec)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Donnée suivie</dt>
                        <dd className="text-xs font-semibold text-slate-900">{target === "Total" ? totalLabel : target}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Lignes trouvées</dt>
                        <dd className={`text-xs font-semibold ${(verify.rowCount ?? 0) > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {verify.loading ? "…" : verify.rowCount != null ? new Intl.NumberFormat("fr-FR").format(verify.rowCount) : "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Valeur actuelle</dt>
                        <dd className="text-xs font-bold tabular-nums text-slate-900">
                          {verify.loading ? "…" : verify.targetValue != null ? fmtVal(verify.targetValue, unit) : "—"}
                        </dd>
                      </div>
                    </dl>
                    {verify.error && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-600">{verify.error}</p>}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                    Cette donnée n&apos;est pas reproductible en agrégat direct : l&apos;agent rattachera le KPI aux
                    vraies données à la création (résolution vérifiée avant activation).
                  </div>
                )}

                {/* ── Contenu de l'alerte saisi en amont ── */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contenu de l&apos;alerte</p>
                  <dl className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-xs text-slate-500">Titre</dt>
                      <dd className="text-right text-xs font-semibold text-slate-900">{alertTitle.trim() || `Alerte — ${title}`}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">Seuil</dt>
                      <dd className="text-xs font-semibold text-slate-900">
                        {direction === "below" ? "≤" : "≥"} {threshold}{unitSym(unit)}
                        {second && threshold2 ? ` · 2ᵉ KPI : ${threshold2}${unitSym(unit2)}` : ""}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">Période</dt>
                      <dd className="text-xs font-semibold text-slate-900">{continuous ? "En continu" : `${dateFrom || "…"} → ${dateTo || "…"}`}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">Portée</dt>
                      <dd className="text-xs font-semibold text-slate-900">{scope === "team" ? "👥 Équipe" : "👤 Personnel"}</dd>
                    </div>
                    {description.trim() && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-xs text-slate-500">Contexte</dt>
                        <dd className="text-right text-xs text-slate-700">{description.trim()}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Seuil vs valeur actuelle : lecture immédiate de la pertinence. */}
                {aggSpec && verify.targetValue != null && !verify.loading && threshold && (
                  <p className="rounded-lg bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-800">
                    Aujourd&apos;hui : <strong>{fmtVal(verify.targetValue, unit)}</strong> — l&apos;alerte se déclenchera{" "}
                    {direction === "below" ? "si la valeur passe sous" : "si la valeur atteint"}{" "}
                    <strong>{threshold}{unitSym(unit)}</strong>.
                  </p>
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => setStep("form")} className="text-xs text-slate-400 hover:text-fuchsia-600">← Modifier</button>
                  <button type="submit" disabled={state === "saving" || verify.loading}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-50">
                    {state === "saving" ? "Création…" : "Confirmer la création"}
                  </button>
                </div>
              </>
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
                  <div className="flex items-center justify-between gap-2">
                    <label className={lbl}>Description (pour l&apos;agent)</label>
                    <DictationButton onText={(t) => setDescription((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
                  </div>
                  <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : alerter si cette ligne décroche vs le mois dernier." className={`${inp} resize-none`} />
                </div>

                {/* Portée : personnelle ou d'équipe — iso avec l'alerte classique */}
                <div>
                  <label className={lbl}>Portée</label>
                  <div className="flex gap-2">
                    {([
                      { id: "personal", label: "👤 Personnel", hint: "Mon suivi" },
                      { id: "team", label: "👥 Équipe", hint: "Partagée avec l'équipe de l'espace" },
                    ] as const).map((s) => (
                      <button key={s.id} type="button" title={s.hint} onClick={() => setScope(s.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          scope === s.id ? "bg-indigo-100 text-indigo-700" : "bg-white border border-slate-200 text-slate-500"
                        }`}>{s.label}</button>
                    ))}
                  </div>
                </div>

                {/* Canaux gérés centralement — plus de choix par alerte. */}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  🔔 Les canaux de notification se règlent une fois pour toutes vos alertes techniques dans{" "}
                  <a href="/dashboard/mon-compte/notifications" target="_blank" className="font-medium text-fuchsia-600 underline">
                    Mon compte → Notifications
                  </a>
                  .
                </p>

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-xs text-slate-400 hover:text-fuchsia-600">Annuler</button>
                  <button type="submit" disabled={state === "saving" || !threshold}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-50">
                    Vérifier le câblage →
                  </button>
                </div>
              </>
            )}
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
