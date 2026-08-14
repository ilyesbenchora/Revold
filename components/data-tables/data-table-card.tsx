"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportChart } from "@/components/agents/agent-report";
import { ReportPeriodBar, type AppliedPeriod } from "@/components/agents/report-period-bar";
import { TableAlertButton } from "./table-alert-button";
import { computePeriod, presetLabel, parseStoredPeriod, storedPeriodLabel, serializeCustomPeriod } from "@/lib/reports/periods";
import { entityLabel, dimLabel } from "@/lib/reports/data-table-presets";
import { currentLocale, formatBucketLabel, useLocale } from "@/lib/locale";
import { DrilldownModal, type DrilldownTarget } from "@/components/reports/drilldown-modal";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";
import { toolDomain } from "@/lib/integrations/tool-domains";
import { BrandLogo } from "@/components/brand-logo";
import type { ReportBlock } from "@/lib/ai/agents/agent-runtime";

export type SavedTable = {
  id: string;
  title: string;
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: string;
  custom_kpi?: string | null;
  description?: string | null;
  period_preset?: string | null;
  /** Outils sources choisis dans le funnel (ex : ["pennylane"]) — filtrent la donnée. */
  sources?: string[] | null;
  /** Affiche le total DANS la visualisation (badge graphique / centre anneau / pied de tableau). */
  show_total?: boolean | null;
  /** Deals uniquement : pipeline ciblé (nom ou id) — évite les étapes homonymes. */
  pipeline?: string | null;
  /** Fréquence des dimensions temporelles (day/week/month/quarter/semester/year — null = month). */
  granularity?: string | null;
};

/** Fréquences d'affichage des regroupements temporels (month_*). */
const GRANULARITY_OPTIONS: { id: string; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "quarter", label: "Trimestre" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Année" },
];

type Row = { name: string; value: number };

/** Période « Toutes les données » affichée dans le sélecteur (aucun filtre). */
const ALL_PERIOD: AppliedPeriod = { preset: "all", from: "", to: "", label: "Toutes les données" };

function formatValue(v: number, unit: string | null): string {
  const loc = currentLocale();
  if (unit === "currency") return new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v.toFixed(1)} %`;
  return new Intl.NumberFormat(loc).format(v);
}

export function DataTableCard({
  table,
  team = "revops",
  onDeleted,
  onEdit,
  onUpdated,
}: {
  table: SavedTable;
  team?: string;
  onDeleted: (id: string) => void;
  onEdit: (table: SavedTable) => void;
  onUpdated: (table: SavedTable) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  // Langue choisie (Mon compte) : formate les buckets temporels et les nombres,
  // mise à jour dynamique au changement.
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(table.title);
  const [showTotal, setShowTotal] = useState(Boolean(table.show_total));
  // Fréquence d'affichage — UNIQUEMENT sur les regroupements temporels (date de
  // création / closing…), choisis à la création. Sur un regroupement par étape
  // de pipeline ou de lifecycle, changer la fréquence basculerait l'axe sur une
  // date et casserait complètement le rapport : le sélecteur n'apparaît pas.
  const isTimeDim = table.group_by.startsWith("month_");
  const [granularity, setGranularity] = useState(table.granularity ?? "month");

  // ── Drill-down : clic sur un chiffre (barre, segment, point, ligne, total)
  // → modal listant les enregistrements sous-jacents (deals, factures…). ──
  const [drill, setDrill] = useState<DrilldownTarget | null>(null);
  const drillable = table.entity !== "fiscal";
  function openDrill(bucket: { raw: string; label: string } | null) {
    if (!drillable) return;
    setDrill({
      query: {
        entity: table.entity,
        groupBy: table.group_by,
        measure: table.measure,
        field: table.field ?? undefined,
        pipeline: table.pipeline ?? undefined,
        granularity: isTimeDim ? granularity || null : null,
      },
      sources: table.sources ?? [],
      period: period ? { from: period.from, to: period.to, all: period.preset === "all" } : { all: true },
      bucket,
      title: table.title,
    });
  }

  // Nom lisible du pipeline ciblé (table.pipeline stocke l'id externe HubSpot).
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  useEffect(() => {
    if (!table.pipeline) { setPipelineName(null); return; }
    let alive = true;
    fetch("/api/pipelines")
      .then((r) => (r.ok ? r.json() : { pipelines: [] }))
      .then((d) => {
        if (!alive) return;
        const found = (d.pipelines ?? []).find(
          (p: { id: string; name: string }) => p.id === table.pipeline || p.name === table.pipeline,
        );
        setPipelineName(found?.name ?? table.pipeline);
      })
      .catch(() => alive && setPipelineName(table.pipeline ?? null));
    return () => { alive = false; };
  }, [table.pipeline]);

  // Toggle « total dans la visualisation » — optimiste, persisté sans agent.
  async function toggleShowTotal() {
    const next = !showTotal;
    setShowTotal(next);
    const res = await fetch(`/api/page-tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_total: next }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.table) onUpdated(d.table);
    else setShowTotal(!next);
  }

  const load = useCallback(async (p: AppliedPeriod | null, g?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Échéances fiscales : source dédiée (config Organisation), hors moteur d'agrégat.
      if (table.entity === "fiscal") {
        const res = await fetch("/api/fiscal/echeances");
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Erreur de calcul");
        setRows(Array.isArray(d.data) ? d.data : []);
        return;
      }
      // La fréquence ne s'applique QU'AUX regroupements temporels — le
      // regroupement choisi à la création (étape, statut…) reste intangible.
      const gr = g ?? granularity;
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: {
            entity: table.entity,
            groupBy: table.group_by,
            measure: table.measure,
            field: table.field,
            pipeline: table.pipeline ?? null,
            granularity: isTimeDim ? gr || null : null,
          },
          sources: table.sources ?? [],
          all: !p,
          date_from: p?.from,
          date_to: p?.to,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur de calcul");
      setRows(Array.isArray(d.data) ? d.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.entity, table.group_by, table.measure, table.field, table.pipeline, granularity, isTimeDim, JSON.stringify(table.sources ?? [])]);

  // Changement de fréquence : recalcul immédiat + persistance (sans agent).
  // « Aucune » (tables non temporelles) est persisté en null.
  async function applyGranularity(g: string) {
    setGranularity(g);
    load(period, g);
    const res = await fetch(`/api/page-tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granularity: g || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.table) onUpdated(d.table);
  }

  // Ouverture directe sur la période par défaut choisie à la création :
  // preset recalculé à l'instant T, plage personnalisée figée, ou « période de
  // la description » (l'agent l'a intégrée au câblage → aucun re-filtre).
  useEffect(() => {
    const stored = parseStoredPeriod(table.period_preset);
    if (table.entity === "fiscal" || stored.kind === "description") {
      load(null);
    } else if (stored.kind === "custom") {
      const ap: AppliedPeriod = {
        preset: "custom",
        from: stored.from,
        to: stored.to,
        label: storedPeriodLabel(table.period_preset),
      };
      setPeriod(ap);
      load(ap);
    } else if (stored.preset !== "all") {
      const { from, to } = computePeriod(stored.preset, new Date());
      const ap: AppliedPeriod = { preset: stored.preset, from, to, label: presetLabel(stored.preset) };
      setPeriod(ap);
      load(ap);
    } else {
      load(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Changement de période sur la carte : recalcul immédiat + PERSISTANCE
  // (comme la fréquence) — la période choisie survit au refresh de la page.
  async function applyPeriod(p: AppliedPeriod) {
    const normalized = p.preset === "all" ? null : p;
    setPeriod(normalized);
    load(normalized);
    const stored = p.preset === "custom" ? serializeCustomPeriod(p.from, p.to) : p.preset;
    const res = await fetch(`/api/page-tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_preset: stored }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.table) onUpdated(d.table);
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/page-tables/${table.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(table.id);
    else setDeleting(false);
  }

  // Renommage en ligne du titre — simple nomenclature, sans appeler l'agent.
  async function saveTitle() {
    const t = titleDraft.trim();
    setRenaming(false);
    if (!t || t === table.title) return;
    const res = await fetch(`/api/page-tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.table) onUpdated(d.table);
  }

  const total = rows.reduce((s, r) => s + (r.value || 0), 0);
  const isChart = table.view === "bar" || table.view === "line" || table.view === "donut" || table.view === "bloc";
  const block: ReportBlock = { type: table.view as ReportBlock["type"], title: table.title, data: rows };

  return (
    // Ancre stable pour la navigation vocale (« ouvre le rapport … » → #table-<id>).
    <div id={`table-${table.id}`} className="card scroll-mt-24 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(table.title); setRenaming(false); } }}
                className="w-48 rounded-md border border-accent/50 px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-accent"
              />
              <button onClick={saveTitle} title="Enregistrer" className="rounded-md p-1 text-emerald-500 hover:bg-emerald-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </button>
              <button onClick={() => { setTitleDraft(table.title); setRenaming(false); }} title="Annuler" className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-slate-900">{table.title}</h3>
              <button
                onClick={() => { setTitleDraft(table.title); setRenaming(true); }}
                title="Renommer"
                className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
            </div>
          )}
          {/* Ligne méta : entité · dimension · pipeline ciblé · total — le
              pipeline vit ICI (plus de pastille séparée sous le titre). */}
          <p className="mt-0.5 text-[11px] text-slate-400">
            {entityLabel(table.entity)} · {dimLabel(table.entity, table.group_by)}
            {table.pipeline && <> · Pipeline {pipelineName ?? table.pipeline}</>}
            {rows.length > 0 && <> · total {formatValue(total, table.unit_mode)}</>}
          </p>
          {(table.sources ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(table.sources ?? []).map((key) => {
                const tool = getConnectableTool(key);
                return (
                  <span
                    key={key}
                    title={`Données limitées à ${tool?.label ?? key}`}
                    className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50/70 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-700"
                  >
                    <BrandLogo domain={toolDomain(key)} alt={tool?.label ?? key} fallback={tool?.icon ?? "🔗"} size={11} />
                    {tool?.label ?? key}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TableAlertButton table={table} rows={rows} team={team} />
          <button
            onClick={() => onEdit(table)}
            title="Modifier via l'agent"
            className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
            Modifier
          </button>
          <button
            onClick={remove}
            disabled={deleting}
            title="Supprimer la table"
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ReportPeriodBar
            onApply={applyPeriod}
            loading={loading}
            // KPI personnalisé avec période « déjà précisée dans la description » :
            // le filtre est intégré au câblage par l'agent — on l'affiche tel quel
            // au lieu d'un « Toutes périodes » trompeur.
            activeLabel={
              period?.label ??
              (parseStoredPeriod(table.period_preset).kind === "description"
                ? "Période de la description"
                : "Toutes périodes")
            }
            // Sans filtre actif (table sur « Toutes les données »), le sélecteur
            // affiche « Toutes les données » plutôt qu'un « Choisir… » ambigu.
            applied={period ?? (parseStoredPeriod(table.period_preset).kind === "preset" ? ALL_PERIOD : null)}
          />
          {/* Fréquence — UNIQUEMENT sur les regroupements temporels (date de
              création / closing) : sur les étapes de pipeline ou de lifecycle,
              la modifier casserait le rapport (pas de sélecteur). */}
          {isTimeDim && (
            <label className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              Fréquence
              <select
                value={granularity}
                disabled={loading}
                onChange={(e) => applyGranularity(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 outline-none focus:border-accent"
              >
                {GRANULARITY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <span className="inline-flex items-center gap-2">
          {/* Drill-down du TOTAL : liste tous les enregistrements du rapport. */}
          {drillable && rows.length > 0 && (
            <button
              type="button"
              onClick={() => openDrill(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
              title="Voir les enregistrements derrière ce rapport"
            >
              🔍 Détail
            </button>
          )}
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-slate-400 transition hover:text-slate-600">
            <input
              type="checkbox"
              checked={showTotal}
              onChange={toggleShowTotal}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-500"
            />
            Total dans la visualisation
          </label>
        </span>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-400">Calcul en cours…</div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-xs text-rose-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-400">Aucune donnée sur cette période.</div>
        ) : isChart ? (
          <div className="relative">
            {/* Vue « Bloc » : période active + pipeline ciblé rappelés DANS le
                bloc, en pastilles discrètes (le chiffre héros n'a pas d'axe). */}
            {table.view === "bloc" && (period || table.pipeline) && (
              <span className="absolute right-1 top-1 z-10 flex items-center gap-1">
                {table.pipeline && (
                  <span className="rounded-full bg-indigo-50/90 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                    {pipelineName ?? table.pipeline}
                  </span>
                )}
                {period && (
                  <span className="rounded-full bg-slate-100/90 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {period.label}
                  </span>
                )}
              </span>
            )}
            <ReportChart
              block={block}
              unit={table.unit_mode}
              showTotal={showTotal}
              onBucketClick={drillable ? (bucket) => openDrill(bucket) : undefined}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">{dimLabel(table.entity, table.group_by)}</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => r.name && openDrill({ raw: r.name, label: formatBucketLabel(r.name, locale) })}
                    title={drillable ? "Voir le détail des enregistrements" : undefined}
                    className={`border-t border-slate-50 ${drillable ? "cursor-pointer transition hover:bg-indigo-50/40" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-700">{r.name ? formatBucketLabel(r.name, locale) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatValue(r.value, table.unit_mode)}</td>
                  </tr>
                ))}
              </tbody>
              {showTotal && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-indigo-50/40">
                    <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">Total</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatValue(total, table.unit_mode)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Modal de détail (drill-down) */}
      <DrilldownModal target={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
