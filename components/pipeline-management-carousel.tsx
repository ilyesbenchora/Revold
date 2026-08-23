"use client";

import { useEffect, useState } from "react";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import type { PipelineAnalytics } from "@/lib/integrations/hubspot-pipelines";

const fmtK = (n: number) =>
  n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

const STAGE_COLORS = [
  "bg-blue-400",
  "bg-indigo-400",
  "bg-violet-400",
  "bg-fuchsia-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-teal-400",
];

/**
 * RÉGLAGES PAR SOUS-BLOC du Pipeline Management : chaque petit bloc de la
 * carte est modifiable (seuils de jours efficace/stagnant, mode de la jauge)
 * et masquable individuellement — persistés par navigateur (localStorage),
 * partagés entre tous les pipelines du carrousel.
 */
type SubBlockKey = "gauge" | "stages" | "efficient" | "stagnant" | "audit";

type PMSettings = {
  /** Étape « efficace » si moy. jours ≤ effDays. */
  effDays: number;
  /** Étape « stagnante » si moy. jours > stagDays. */
  stagDays: number;
  /** Jauge : CA pondéré si dispo (auto) ou toujours en nombre de deals. */
  gaugeMode: "auto" | "deals";
  hidden: SubBlockKey[];
};

const DEFAULT_PM_SETTINGS: PMSettings = { effDays: 7, stagDays: 21, gaugeMode: "auto", hidden: [] };
const PM_STORAGE_KEY = "revold:pipeline-mgmt-settings";

const SUB_BLOCK_LABELS: Record<SubBlockKey, string> = {
  gauge: "Répartition par étape",
  stages: "Tableau des étapes",
  efficient: "Étapes efficaces",
  stagnant: "Étapes stagnantes",
  audit: "Audit d'attractivité",
};

/** Vélocité d'une étape — suit les seuils configurés du bloc. */
function velocityLabel(avgDaysInStage: number, s: PMSettings): string {
  if (avgDaysInStage <= s.effDays) return "Rapide";
  if (avgDaysInStage <= s.stagDays) return "Normal";
  return "Stagnant";
}

/** Bouton « Masquer » discret, commun à tous les sous-blocs. */
function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={onHide}
      className="text-[10px] font-medium text-slate-400 transition hover:text-slate-600"
    >
      Masquer
    </button>
  );
}

/** Saisie inline d'un seuil en jours (petit input numérique). */
function DaysInput({ value, onChange, ariaLabel }: { value: number; onChange: (n: number) => void; ariaLabel: string }) {
  return (
    <input
      type="number"
      min={1}
      max={365}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n) && n >= 1 && n <= 365) onChange(n);
      }}
      aria-label={ariaLabel}
      className="w-12 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center text-[10px] font-semibold text-slate-700 outline-none transition focus:border-accent"
    />
  );
}

function PipelineCard({ pa, settings, onSettings }: {
  pa: PipelineAnalytics;
  settings: PMSettings;
  onSettings: (patch: Partial<PMSettings>) => void;
}) {
  const s = settings;
  const hide = (key: SubBlockKey) => onSettings({ hidden: [...s.hidden.filter((k) => k !== key), key] });
  // Listes efficace/stagnant recalculées avec les seuils configurés (et non
  // plus les listes serveur figées à 7/21 jours).
  const efficient = pa.stages.filter((sa) => sa.dealCount > 0 && sa.avgDaysInStage <= s.effDays);
  const stagnant = pa.stages.filter((sa) => sa.dealCount > 0 && sa.avgDaysInStage > s.stagDays);
  return (
    <article className="card overflow-hidden">
      <div className="flex items-start justify-between border-b border-card-border bg-slate-50 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{pa.pipeline.label}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {pa.totalDeals} deal{pa.totalDeals > 1 ? "s" : ""} en cours · {pa.pipeline.stages.length} étapes
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">
            {pa.totalAmount > 0 ? fmtK(pa.totalAmount) : "—"}
          </p>
          <p className="text-[10px] text-slate-400">
            Pondéré : {pa.weightedAmount > 0 ? fmtK(pa.weightedAmount) : "—"}
          </p>
        </div>
      </div>

      {!s.hidden.includes("gauge") && pa.stages.length > 0 && (() => {
        // Mode « auto » : CA pondéré si dispo, sinon repli sur le dealCount
        // (pipelines de financement / projets sans amount, ou tous closed).
        // Mode « deals » : toujours en nombre de deals (choix utilisateur).
        const usesWeighted = s.gaugeMode === "auto" && pa.weightedAmount > 0;
        const totalDeals = pa.stages.reduce((sum, sa) => sum + sa.dealCount, 0);
        if (!usesWeighted && totalDeals === 0) return null;

        const segments = pa.stages.map((sa) => {
          const pct = usesWeighted
            ? sa.weightedPct
            : totalDeals > 0
              ? Math.round((sa.dealCount / totalDeals) * 100)
              : 0;
          return { sa, pct };
        });

        return (
          <div className="px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {usesWeighted ? "Répartition CA pondéré par étape" : "Répartition deals par étape"}
              </p>
              <div className="flex items-center gap-2">
                {pa.weightedAmount > 0 && (
                  <div className="flex overflow-hidden rounded-md border border-slate-200 text-[10px]">
                    <button
                      type="button"
                      onClick={() => onSettings({ gaugeMode: "auto" })}
                      className={`px-1.5 py-0.5 transition ${s.gaugeMode === "auto" ? "bg-accent/10 font-semibold text-accent" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Pondéré
                    </button>
                    <button
                      type="button"
                      onClick={() => onSettings({ gaugeMode: "deals" })}
                      className={`px-1.5 py-0.5 transition ${s.gaugeMode === "deals" ? "bg-accent/10 font-semibold text-accent" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      Deals
                    </button>
                  </div>
                )}
                <HideButton onHide={() => hide("gauge")} />
              </div>
            </div>
            <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
              {segments.map(({ sa, pct }, idx) => (
                <div
                  key={sa.stage.id}
                  className={`${STAGE_COLORS[idx % STAGE_COLORS.length]} transition-all`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                  title={`${sa.stage.label} : ${pct}%`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {segments.map(({ sa, pct }, idx) => (
                <div key={sa.stage.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[idx % STAGE_COLORS.length]}`} />
                  {sa.stage.label} ·{" "}
                  <span className="font-semibold">{pct}%</span> · {sa.dealCount} deal{sa.dealCount > 1 ? "s" : ""}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Table unique des étapes : reprend TOUTES les colonnes de l'ancien
          tableau (deals, CA brut, CA pondéré, moy. jours, vélocité) et porte
          l'alerte chirurgicale restreinte à ce pipeline. */}
      {!s.hidden.includes("stages") && (
      <div className="border-t border-card-border px-5 py-3">
        <div className="flex justify-end">
          <HideButton onHide={() => hide("stages")} />
        </div>
        <BlockDataTable
          title={`Étapes du pipeline — ${pa.pipeline.label}`}
          subtitle="deals · groupé par étape"
          team="sales"
          unit="count"
          nameLabel="Étape"
          valueLabel="Deals"
          extraColumns={["CA brut", "CA pondéré", "Moy. j", "Vélocité"]}
          showTotal
          aggSpec={{ entity: "deals", groupBy: "stage", measure: "count", pipeline: pa.pipeline.id }}
          rows={pa.stages.map((sa) => ({
            name: sa.stage.label,
            value: sa.dealCount,
            cells: [
              sa.amount > 0 ? fmtK(sa.amount) : "—",
              sa.weightedAmount > 0 ? fmtK(sa.weightedAmount) : "—",
              `${sa.avgDaysInStage}j`,
              velocityLabel(sa.avgDaysInStage, s),
            ],
            spec: { entity: "deals", groupBy: "stage", measure: "count" as const, pipeline: pa.pipeline.id, target: sa.stage.label },
          }))}
          footnote={`Alerte rapprochée des vraies données, restreinte au pipeline « ${pa.pipeline.label} » (deals · groupé par étape) — aucune confusion possible avec une étape homonyme d'un autre pipeline. Vélocité : rapide ≤ ${s.effDays}j, stagnant > ${s.stagDays}j (seuils modifiables sur les sous-blocs).`}
          emptyLabel="Aucune étape avec des deals dans ce pipeline."
        />
      </div>
      )}

      {(!s.hidden.includes("efficient") || !s.hidden.includes("stagnant")) && (
      <div className="grid grid-cols-1 gap-0 border-t border-card-border md:grid-cols-2 md:divide-x md:divide-card-border">
        {!s.hidden.includes("efficient") && (
        <div className="px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Étapes efficaces (≤
              <DaysInput
                value={s.effDays}
                onChange={(n) => onSettings({ effDays: n, stagDays: Math.max(s.stagDays, n) })}
                ariaLabel="Seuil de jours des étapes efficaces"
              />
              j moy.)
            </p>
            <HideButton onHide={() => hide("efficient")} />
          </div>
          {efficient.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {efficient.map((sa) => (
                <li key={sa.stage.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{sa.stage.label}</span>
                  <span className="font-medium text-emerald-600">
                    {sa.avgDaysInStage}j · {sa.dealCount} deal{sa.dealCount > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Aucune étape rapide détectée.</p>
          )}
        </div>
        )}
        {!s.hidden.includes("stagnant") && (
        <div className="px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
              Étapes stagnantes (&gt;
              <DaysInput
                value={s.stagDays}
                onChange={(n) => onSettings({ stagDays: n, effDays: Math.min(s.effDays, n) })}
                ariaLabel="Seuil de jours des étapes stagnantes"
              />
              j moy.)
            </p>
            <HideButton onHide={() => hide("stagnant")} />
          </div>
          {stagnant.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {stagnant.map((sa) => (
                <li key={sa.stage.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{sa.stage.label}</span>
                  <span className="font-medium text-red-600">
                    {sa.avgDaysInStage}j · {sa.dealCount} deal{sa.dealCount > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Aucune étape stagnante.</p>
          )}
        </div>
        )}
      </div>
      )}

      {!s.hidden.includes("audit") && (
      <div className="border-t border-card-border bg-slate-50/50 px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Audit d&apos;attractivité
          </p>
          <div className="flex items-center gap-2">
          <HideButton onHide={() => hide("audit")} />
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              pa.attractiveness.score >= 60
                ? "bg-emerald-100 text-emerald-700"
                : pa.attractiveness.score >= 30
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {pa.attractiveness.score}/100
          </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
          <div>
            <p className="text-slate-500">Activités/deal</p>
            <p
              className={`font-semibold ${
                pa.attractiveness.avgActivities >= 3
                  ? "text-emerald-700"
                  : pa.attractiveness.avgActivities >= 1
                    ? "text-amber-700"
                    : "text-red-600"
              }`}
            >
              {pa.attractiveness.avgActivities}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Close à jour</p>
            <p
              className={`font-semibold ${
                pa.attractiveness.closeDateFreshPct >= 60
                  ? "text-emerald-700"
                  : pa.attractiveness.closeDateFreshPct >= 30
                    ? "text-amber-700"
                    : "text-red-600"
              }`}
            >
              {pa.attractiveness.closeDateFreshPct}%
            </p>
          </div>
          <div>
            <p className="text-slate-500">Gagnés</p>
            <p className="font-semibold text-emerald-700">{pa.attractiveness.wonCount}</p>
          </div>
          <div>
            <p className="text-slate-500">Taux perte</p>
            <p
              className={`font-semibold ${
                pa.attractiveness.lostRate < 30
                  ? "text-emerald-700"
                  : pa.attractiveness.lostRate < 50
                    ? "text-amber-700"
                    : "text-red-600"
              }`}
            >
              {pa.attractiveness.lostRate}%
            </p>
          </div>
          <div>
            <p className="text-slate-500">Forecast</p>
            <p
              className={`font-semibold ${
                pa.attractiveness.forecastReliable ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {pa.attractiveness.forecastReliable ? "Fiable" : "Non fiable"}
            </p>
          </div>
        </div>
      </div>
      )}
    </article>
  );
}

export function PipelineManagementCarousel({
  pipelines,
}: {
  pipelines: PipelineAnalytics[];
}) {
  // 1 pipeline par page : meilleure lisibilité (carte pleine largeur),
  // navigation explicite entre pipelines, et corrige les cas où la
  // jauge / les données ne s'affichaient pas correctement en grille 2-cols
  // (race conditions de layout sur certains navigateurs).
  const [page, setPage] = useState(0);
  const perPage = 1;
  const totalPages = Math.max(1, Math.ceil(pipelines.length / perPage));
  const safePage = Math.min(page, totalPages - 1);

  // Réglages par sous-bloc, partagés entre pipelines — chargés après montage
  // (localStorage) pour éviter tout écart d'hydratation SSR.
  const [settings, setSettings] = useState<PMSettings>(DEFAULT_PM_SETTINGS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PM_STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_PM_SETTINGS, ...JSON.parse(raw) });
    } catch { /* réglages par défaut */ }
  }, []);
  const patchSettings = (patch: Partial<PMSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(PM_STORAGE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  if (pipelines.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun pipeline détecté. Vérifiez la connexion HubSpot.
      </p>
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{pipelines[safePage]?.pipeline.label ?? "—"}</strong> ·
            pipeline {safePage + 1} sur {pipelines.length}
          </p>
          {/* Sous-blocs masqués : restauration en un clic (réglage partagé). */}
          {settings.hidden.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Sous-blocs masqués :</span>
              {settings.hidden.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patchSettings({ hidden: settings.hidden.filter((k) => k !== key) })}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 transition hover:border-accent hover:text-accent"
                  title="Réafficher ce sous-bloc"
                >
                  {SUB_BLOCK_LABELS[key]} +
                </button>
              ))}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Pipeline précédent"
            >
              ←
            </button>
            {/* Dots indicator (cliquable, jusqu'à 10 max) */}
            {totalPages <= 10 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    aria-label={`Aller au pipeline ${i + 1}`}
                    className={`h-2 w-2 rounded-full transition ${
                      i === safePage ? "bg-accent" : "bg-slate-300 hover:bg-slate-400"
                    }`}
                  />
                ))}
              </div>
            )}
            <span className="text-xs font-medium text-slate-600">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Pipeline suivant"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Carrousel : 1 pipeline par page, pleine largeur. Glissement
          horizontal via translateX. */}
      <div className="relative overflow-x-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            width: `${totalPages * 100}%`,
            transform: `translateX(-${(safePage * 100) / totalPages}%)`,
          }}
        >
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const start = pageIdx * perPage;
            const slice = pipelines.slice(start, start + perPage);
            return (
              <div
                key={pageIdx}
                className="space-y-4 px-1"
                style={{ width: `${100 / totalPages}%` }}
              >
                {slice.map((pa) => (
                  <PipelineCard key={pa.pipeline.id} pa={pa} settings={settings} onSettings={patchSettings} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
