"use client";

import { useState } from "react";
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

function PipelineCard({ pa }: { pa: PipelineAnalytics }) {
  return (
    <article className="card overflow-hidden h-full flex flex-col">
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

      {pa.stages.length > 0 && pa.weightedAmount > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Répartition CA pondéré par étape
          </p>
          <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
            {pa.stages.map((sa, idx) => (
              <div
                key={sa.stage.id}
                className={`${STAGE_COLORS[idx % STAGE_COLORS.length]} transition-all`}
                style={{ width: `${Math.max(2, sa.weightedPct)}%` }}
                title={`${sa.stage.label} : ${sa.weightedPct}%`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {pa.stages.map((sa, idx) => (
              <div
                key={sa.stage.id}
                className="flex items-center gap-1.5 text-[10px] text-slate-600"
              >
                <span
                  className={`h-2 w-2 rounded-full ${STAGE_COLORS[idx % STAGE_COLORS.length]}`}
                />
                {sa.stage.label} ·{" "}
                <span className="font-semibold">{sa.weightedPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-card-border px-5 py-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-medium uppercase text-slate-400">
                <th className="py-1 pr-3">Étape</th>
                <th className="py-1 pr-3 text-right">Deals</th>
                <th className="py-1 pr-3 text-right">CA brut</th>
                <th className="py-1 pr-3 text-right">CA pondéré</th>
                <th className="py-1 pr-3 text-right">Moy. j</th>
                <th className="py-1 text-right">Vélocité</th>
              </tr>
            </thead>
            <tbody>
              {pa.stages.map((sa) => (
                <tr key={sa.stage.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-medium text-slate-700">{sa.stage.label}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-600">{sa.dealCount}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-600">
                    {sa.amount > 0 ? fmtK(sa.amount) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold text-slate-700">
                    {sa.weightedAmount > 0 ? fmtK(sa.weightedAmount) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-slate-600">{sa.avgDaysInStage}j</td>
                  <td className="py-1.5 text-right">
                    {sa.avgDaysInStage <= 7 ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Rapide
                      </span>
                    ) : sa.avgDaysInStage <= 21 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Normal
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Stagnant
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 border-t border-card-border md:grid-cols-2 md:divide-x md:divide-card-border">
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            Étapes efficaces (≤ 7j moy.)
          </p>
          {pa.efficientStages.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {pa.efficientStages.map((s) => (
                <li key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{s.label}</span>
                  <span className="font-medium text-emerald-600">
                    {s.avgDays}j · {s.dealCount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Aucune étape rapide.</p>
          )}
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">
            Étapes stagnantes (&gt; 21j moy.)
          </p>
          {pa.stagnantStages.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {pa.stagnantStages.map((s) => (
                <li key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{s.label}</span>
                  <span className="font-medium text-red-600">
                    {s.avgDays}j · {s.dealCount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Aucune étape stagnante.</p>
          )}
        </div>
      </div>

      <div className="border-t border-card-border bg-slate-50/50 px-5 py-3 mt-auto">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Audit d&apos;attractivité
          </p>
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
    </article>
  );
}

export function PipelineManagementCarousel({
  pipelines,
}: {
  pipelines: PipelineAnalytics[];
}) {
  const [page, setPage] = useState(0);
  const perPage = 2;
  const totalPages = Math.max(1, Math.ceil(pipelines.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * perPage;
  const visible = pipelines.slice(start, start + perPage);

  if (pipelines.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun pipeline détecté. Vérifiez la connexion HubSpot.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Affichage {start + 1}–{Math.min(start + perPage, pipelines.length)} sur {pipelines.length} pipeline{pipelines.length > 1 ? "s" : ""}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Pipelines précédents"
            >
              ←
            </button>
            <span className="text-xs font-medium text-slate-600">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Pipelines suivants"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.map((pa) => (
          <PipelineCard key={pa.pipeline.id} pa={pa} />
        ))}
      </div>
    </div>
  );
}
