"use client";

import { useEffect, useState, useTransition } from "react";
import type { DealRiskBuckets } from "@/lib/integrations/hubspot-deal-risk";
import { AlertButton } from "./alert-button";

const fmtK = (n: number) =>
  n >= 1000
    ? `${Math.round(n / 1000).toLocaleString("fr-FR")}K€`
    : `${Math.round(n).toLocaleString("fr-FR")}€`;

type PipelineOption = { id: string; label: string; stages: Array<{ id: string; label: string }> };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

export function DealsAtRiskBlock({
  pipelines,
  initialPipelineId,
  initialBuckets,
}: {
  pipelines: PipelineOption[];
  initialPipelineId: string;
  initialBuckets: DealRiskBuckets;
}) {
  const [pipelineId, setPipelineId] = useState(initialPipelineId);
  const [buckets, setBuckets] = useState<DealRiskBuckets>(initialBuckets);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pipelineId === initialPipelineId) {
      setBuckets(initialBuckets);
      return;
    }
    startTransition(() => {
      fetch(`/api/integrations/hubspot/deal-risk?pipelineId=${encodeURIComponent(pipelineId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setBuckets(data as DealRiskBuckets);
        })
        .catch(() => {});
    });
  }, [pipelineId, initialPipelineId, initialBuckets]);

  const stageMap = new Map(
    pipelines.find((p) => p.id === pipelineId)?.stages.map((s) => [s.id, s.label]) ?? [],
  );
  const selectedPipelineLabel =
    pipelines.find((p) => p.id === pipelineId)?.label ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline :</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {isPending && <span className="text-xs text-slate-400">Chargement…</span>}
        </div>
      </div>

      <RiskTable
        title="Deals bloqués"
        subtitle="Plus de 7 jours dans la même étape"
        accent="bg-red-500"
        countBg="bg-red-50 text-red-700"
        deals={buckets.blocked}
        stageMap={stageMap}
        valueLabel="Jours dans étape"
        formatValue={(d) => `${d.daysInStage}j`}
        alert={
          <AlertButton
            title={`Deals bloqués · ${selectedPipelineLabel}`}
            description="Deals restant > 7 jours dans la même étape sur ce pipeline."
            impact="Détecte les deals qui stagnent et déclenche une alerte si leur nombre dépasse le seuil défini."
            category="ventes"
            forecastType="deals_blocked"
            threshold={5}
            direction="above"
          />
        }
      />

      <RiskTable
        title="Deals sans visibilité"
        subtitle="Aucune prochaine activité planifiée (next_activity_date vide)"
        accent="bg-orange-500"
        countBg="bg-orange-50 text-orange-700"
        deals={buckets.noVisibility}
        stageMap={stageMap}
        valueLabel="Montant"
        formatValue={(d) => (d.amount > 0 ? fmtK(d.amount) : "—")}
        alert={
          <AlertButton
            title={`Deals sans visibilité · ${selectedPipelineLabel}`}
            description="Deals sans prochaine activité planifiée — impossible de prévoir leur évolution."
            impact="Détecte les deals où l'équipe n'a pas planifié la suite et déclenche une alerte au-delà du seuil défini."
            category="ventes"
            forecastType="deals_no_visibility"
            threshold={10}
            direction="above"
          />
        }
      />

      <RiskTable
        title="Deals sans activités"
        subtitle="Aucun contact (note, email, call) depuis plus de 10 jours"
        accent="bg-amber-500"
        countBg="bg-amber-50 text-amber-700"
        deals={buckets.noActivity}
        stageMap={stageMap}
        valueLabel="Dernier contact"
        formatValue={(d) => fmtDate(d.lastContactedAt)}
        alert={
          <AlertButton
            title={`Deals sans activités · ${selectedPipelineLabel}`}
            description="Deals sans aucune activité commerciale depuis plus de 10 jours."
            impact="Détecte les deals oubliés et déclenche une alerte si leur nombre dépasse le seuil défini."
            category="ventes"
            forecastType="deals_no_activity"
            threshold={5}
            direction="above"
          />
        }
      />
    </div>
  );
}

function RiskTable({
  title,
  subtitle,
  accent,
  countBg,
  deals,
  stageMap,
  valueLabel,
  formatValue,
  alert,
}: {
  title: string;
  subtitle: string;
  accent: string;
  countBg: string;
  deals: DealRiskBuckets["blocked"];
  stageMap: Map<string, string>;
  valueLabel: string;
  formatValue: (d: DealRiskBuckets["blocked"][number]) => string;
  alert: React.ReactNode;
}) {
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent}`} />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${countBg}`}>
            {deals.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">{subtitle}</p>
          {alert}
        </div>
      </header>

      {deals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-emerald-600">Aucun deal détecté dans cette catégorie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
                <th className="px-5 py-2">Deal</th>
                <th className="px-3 py-2">Étape</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-5 py-2 text-right">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {deals.slice(0, 25).map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2 font-medium text-slate-700">{d.name}</td>
                  <td className="px-3 py-2 text-slate-600">{stageMap.get(d.stageId) ?? d.stageId}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {d.amount > 0 ? fmtK(d.amount) : "—"}
                  </td>
                  <td className="px-5 py-2 text-right font-semibold text-slate-700">
                    {formatValue(d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deals.length > 25 && (
            <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
              + {deals.length - 25} autre{deals.length - 25 > 1 ? "s" : ""} non affiché
              {deals.length - 25 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
